import { randomBytes } from 'node:crypto';
import { deleteRecord, listRecords, saveRecord } from '../studyStore.js';
import { chunkText, searchChunks, splitSentences, supportRatio, tokenize } from '../ragEngine.js';
import { knownWordRatio } from '../textQuality.js';
import { askAi, asText } from './aiClient.js';

// Retrieval (RAG) Study Helper Agent: a per-student document library, BM25
// retrieval, grounded generation with page citations, and validation rules
// that reject unsupported answers (with one self-correction attempt).

const KIND = 'rag-document';
const MAX_CHUNKS = 2500;
const MIN_COVERAGE = 0.3;
const SENTENCE_SUPPORT = 0.5;
const MIN_KNOWN_WORDS = 0.8;
const MAX_ANSWER_SENTENCE_WORDS = 60;
const NO_CLEAR_ANSWER = 'Your study material mentions these words, but I could not find a clear answer in it. Part of it may be a poor scan of handwriting. Add cleaner notes, or use the Tutor page for a general explanation.';

const toSummary = ({ chunks, ...document }) => ({ ...document, chunkCount: chunks?.length || 0 });

export const addDocument = async ({ userId, name, text, sourceType = 'text' }) => {
  const chunks = chunkText(text).slice(0, MAX_CHUNKS);
  if (!chunks.length) {
    const error = new Error('No readable text was found to add to the library.');
    error.status = 422;
    throw error;
  }

  const pages = chunks.map((chunk) => chunk.page).filter(Boolean);
  const document = {
    id: `doc-${Date.now()}-${randomBytes(3).toString('hex')}`,
    name: String(name || 'Study material').slice(0, 160),
    sourceType,
    createdAt: new Date().toISOString(),
    wordCount: String(text).split(/\s+/).filter(Boolean).length,
    pageCount: pages.length ? Math.max(...pages) : null,
    chunks,
  };
  await saveRecord({ kind: KIND, userId, recordId: document.id, data: document });
  return toSummary(document);
};

export const listDocuments = async (userId) => (await listRecords(KIND, userId)).map(toSummary);

export const deleteDocument = (userId, documentId) => deleteRecord(KIND, userId, documentId);

const loadChunks = async (userId, documentIds) => {
  const documents = await listRecords(KIND, userId);
  const selected = Array.isArray(documentIds) && documentIds.length
    ? documents.filter((document) => documentIds.includes(document.id))
    : documents;
  return selected.flatMap((document) =>
    (document.chunks || []).map((chunk) => ({
      ...chunk,
      id: `${document.id}#${chunk.index}`,
      documentId: document.id,
      documentName: document.name,
    })),
  );
};

export const retrieve = async ({ userId, query, documentIds, text, sourceName = 'Pasted material', topK = 5 }) => {
  const adHocChunks = text
    ? chunkText(text).map((chunk) => ({ ...chunk, id: `adhoc#${chunk.index}`, documentId: 'adhoc', documentName: sourceName }))
    : [];
  const libraryChunks = text ? [] : await loadChunks(userId, documentIds);
  return searchChunks([...adHocChunks, ...libraryChunks], query, { topK });
};

const toCitation = (hit, label) => ({
  label,
  chunkId: hit.id,
  documentName: hit.documentName,
  page: hit.page,
  excerpt: hit.text,
  score: Math.round(hit.score * 100) / 100,
});

const buildPrompt = (question, sources, feedback = '') =>
  [
    'You are the Retrieval (RAG) Study Helper Agent for a student.',
    'Answer the question using ONLY the numbered sources below. Do not use outside knowledge.',
    'Cite the sources you used inline like [S1] or [S2].',
    'If the sources do not contain the answer, set answer to "NOT_FOUND".',
    'Return ONLY valid JSON with keys: answer (string, 2-6 sentences), citations (array of labels like "S1"), confidence (number 0-1).',
    feedback ? `\nYour previous answer failed validation: ${feedback}\nRewrite it so every sentence is directly supported by the cited sources.` : '',
    '',
    `Question: ${question}`,
    '',
    ...sources.map((source) => `[${source.label}] (${source.documentName}${source.page ? `, page ${source.page}` : ''})\n${source.excerpt}`),
  ].join('\n');

// Validation rules that keep generated answers grounded in the retrieved text.
const validate = (parsed, sources) => {
  const answer = asText(parsed?.answer);
  const cited = (Array.isArray(parsed?.citations) ? parsed.citations : [])
    .map((label) => String(label).replace(/[[\]\s]/g, '').toUpperCase());
  const inlineLabels = [...answer.matchAll(/\[(S\d+)\]/gi)].map((match) => match[1].toUpperCase());
  const labels = [...new Set([...cited, ...inlineLabels])];
  const citedSources = sources.filter((source) => labels.includes(source.label));
  const evidence = citedSources.map((source) => source.excerpt).join(' ');
  const sentences = splitSentences(answer.replace(/\[S\d+\]/gi, ''));
  const unsupported = sentences.filter((sentence) => supportRatio(sentence, evidence) < SENTENCE_SUPPORT);

  const rules = [
    { rule: 'Answer is not empty and not refused', passed: Boolean(answer) && !/NOT_FOUND/i.test(answer) },
    { rule: 'Cites at least one retrieved source', passed: citedSources.length > 0 },
    { rule: 'Only cites sources that were retrieved', passed: labels.length > 0 && labels.every((label) => sources.some((source) => source.label === label)) },
    {
      rule: `Every sentence is supported by cited text (≥${SENTENCE_SUPPORT * 100}% word overlap)`,
      passed: sentences.length > 0 && unsupported.length === 0,
      detail: unsupported.length ? `${unsupported.length} unsupported sentence(s)` : undefined,
    },
  ];

  return {
    passed: rules.every((rule) => rule.passed),
    rules,
    unsupported,
    answer: answer.replace(/\s+/g, ' ').trim(),
    citedSources,
  };
};

// OCR of handwriting yields long runs of misread words with no sentence breaks.
const isReadableSentence = (sentence) =>
  sentence.split(' ').length <= MAX_ANSWER_SENTENCE_WORDS && knownWordRatio(sentence) >= MIN_KNOWN_WORDS;

// Extractive fallback: the best-matching readable sentences from the retrieved
// chunks. Used when AI is unavailable or fails validation, not when it refuses.
const extractiveAnswer = (question, hits) => {
  const queryTerms = new Set(tokenize(question));
  const candidates = hits.flatMap((hit, hitIndex) =>
    splitSentences(hit.text).map((sentence, position) => {
      const terms = tokenize(sentence);
      const overlap = terms.filter((term) => queryTerms.has(term)).length;
      return { sentence, hitIndex, position, score: overlap / Math.sqrt(terms.length + 1) - hitIndex * 0.05 };
    }),
  );
  const ranked = candidates
    .filter((candidate) => candidate.score > 0 && isReadableSentence(candidate.sentence))
    .sort((left, right) => right.score - left.score);
  const best = ranked[0]?.score || 0;
  const chosen = ranked.filter((candidate) => candidate.score >= best * 0.75).slice(0, 3);

  return {
    answer: chosen.map((candidate) => candidate.sentence).join(' '),
    hitIndexes: [...new Set(chosen.map((candidate) => candidate.hitIndex))],
  };
};

export const answerQuestion = async ({ userId, question, documentIds, text, sourceName }) => {
  const cleanQuestion = String(question || '').trim();
  if (!tokenize(cleanQuestion).length) {
    const error = new Error('Ask a specific question about your study material.');
    error.status = 400;
    throw error;
  }

  const hits = await retrieve({ userId, query: cleanQuestion, documentIds, text, sourceName });
  const sources = hits.map((hit, index) => toCitation(hit, `S${index + 1}`));
  const base = { question: cleanQuestion, retrieved: sources.length, sourceName: sourceName || 'Study library' };

  if (!hits.length || hits[0].coverage < MIN_COVERAGE) {
    return {
      ...base,
      grounded: false,
      engine: 'retrieval',
      answer: 'I could not find enough evidence in your study material to answer that. Try different keywords or add the relevant notes to your library.',
      citations: [],
      validation: { attempts: 0, rules: [{ rule: `Retrieved evidence covers ≥${MIN_COVERAGE * 100}% of the question terms`, passed: false }] },
    };
  }

  const noClearAnswer = { ...base, grounded: false, engine: 'retrieval', answer: NO_CLEAR_ANSWER, citations: [], validation: { attempts: 0, rules: [] } };

  let feedback = '';
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const result = await askAi(buildPrompt(cleanQuestion, sources, feedback), { maxTokens: 700 });
    if (!result) break;

    const check = validate(result.parsed, sources);
    if (check.passed) {
      return {
        ...base,
        grounded: true,
        engine: 'ai',
        provider: result.provider,
        answer: check.answer,
        citations: check.citedSources,
        allSources: sources,
        confidence: Number(result.parsed.confidence) || null,
        validation: { attempts: attempt, selfCorrected: attempt > 1, rules: check.rules },
      };
    }
    // The AI read the passages and found no answer, so keyword matches are not one.
    if (/NOT_FOUND/i.test(check.answer)) return noClearAnswer;
    feedback = check.unsupported.length
      ? `These sentences are not supported by the sources: ${check.unsupported.join(' | ')}`
      : 'Cite the sources you used with labels like [S1].';
  }

  const extractive = extractiveAnswer(cleanQuestion, hits);
  if (!extractive.answer) return noClearAnswer;

  return {
    ...base,
    grounded: true,
    engine: 'extractive',
    answer: extractive.answer,
    citations: extractive.hitIndexes.map((index) => sources[index]),
    allSources: sources,
    validation: {
      attempts: 0,
      rules: [
        { rule: `Retrieved evidence covers ≥${MIN_COVERAGE * 100}% of the question terms`, passed: true },
        { rule: 'Answer sentences are copied verbatim from cited sources', passed: true },
      ],
    },
  };
};
