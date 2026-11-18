import { extractTopicPhrase, findFaq, findTopic } from '../knowledgeBase.js';
import { splitSentences, tokenize } from '../ragEngine.js';
import { askAi, asList, asText } from './aiClient.js';
import { describeMemory, getMemory, noteTopic } from './memoryAgent.js';
import { retrieve } from './ragAgent.js';

// Concept Tutor Agent: simple explanations, analogies, worked examples,
// formulas and practice exercises. Answers come from the AI when available
// (grounded with the built-in knowledge base and the student's notes), and
// from the knowledge base directly when AI is offline. Problem solving runs a
// reflection pass in which a reviewer step checks and corrects the solution.

const LEVELS = ['beginner', 'intermediate', 'advanced'];

const normalizeFormulas = (value) =>
  (Array.isArray(value) ? value : [])
    .map((item) => (typeof item === 'string' ? { formula: item, meaning: '' } : { formula: asText(item?.formula), meaning: asText(item?.meaning) }))
    .filter((item) => item.formula)
    .slice(0, 6);

const normalizePractice = (value) =>
  (Array.isArray(value) ? value : [])
    .map((item) => ({ question: asText(item?.question), hint: asText(item?.hint), answer: asText(item?.answer) }))
    .filter((item) => item.question)
    .slice(0, 5);

const normalizeWorked = (value) =>
  value && typeof value === 'object' && asText(value.problem)
    ? { problem: asText(value.problem), steps: asList(value.steps, 10), answer: asText(value.answer) }
    : null;

// Evaluates plain arithmetic (numbers, + - * / ^ % and brackets) for offline problem help.
const evaluateArithmetic = (expression) => {
  const cleaned = String(expression).replace(/[=?]/g, '').replace(/\s+/g, '').replace(/×/g, '*').replace(/÷/g, '/');
  if (!cleaned || !/^[\d+\-*/().^%]+$/.test(cleaned) || !/\d/.test(cleaned)) return null;
  try {
    const value = Function(`"use strict"; return (${cleaned.replace(/\^/g, '**')});`)();
    return Number.isFinite(value) ? { expression: cleaned, value: Math.round(value * 1e8) / 1e8 } : null;
  } catch {
    return null;
  }
};

const notesContext = async (userId, query) => {
  const hits = await retrieve({ userId, query, topK: 3 });
  return hits.filter((hit) => hit.coverage >= 0.3);
};

const referenceText = (entry) =>
  entry
    ? [
      `Reference notes (${entry.title}): ${entry.simpleExplanation}`,
      ...(entry.keyPoints || []).map((point) => `- ${point}`),
      ...(entry.formulas || []).map((item) => `Formula: ${item.formula} (${item.meaning})`),
    ].join('\n')
    : '';

const explainPrompt = ({ topic, level, question, memoryText, notes, entry, faq }) =>
  [
    'You are the Concept Tutor Agent, a patient teacher for students.',
    `Explain the topic for a ${level} student in simple language.`,
    'Return ONLY valid JSON with keys:',
    'answer (a direct answer to the student\'s exact question, 2-5 sentences), title (string), simpleExplanation (3-5 sentences, plain language), analogy (string),',
    'keyPoints (3-6 strings), steps (step-by-step explanation, 3-7 strings), examples (2-3 strings),',
    'formulas (array of {formula, meaning}; empty if none apply), workedExample ({problem, steps[], answer} or null),',
    'practice (3 objects {question, hint, answer}, increasing difficulty), commonMistakes (2-4 strings), followUps (2-3 related topics).',
    entry ? 'Use the reference notes below to stay accurate.' : '',
    notes.length ? 'Prefer the student\'s own notes below when they are relevant.' : '',
    '',
    `Topic: ${topic}`,
    question ? `Student question: ${question}` : '',
    `Student context:\n${memoryText}`,
    referenceText(entry),
    faq ? `Reference answer for a similar question ("${faq.question}"): ${faq.answer}` : '',
    ...notes.map((note, index) => `Student note ${index + 1} (${note.documentName}${note.page ? `, page ${note.page}` : ''}): ${note.text}`),
  ].filter(Boolean).join('\n');

const solvePrompt = ({ problem, level, entry }) =>
  [
    'You are the Concept Tutor Agent helping with a numeric problem or formula question.',
    `Solve it step by step for a ${level} student. Show the formula used, substitute values, and compute carefully.`,
    'Return ONLY valid JSON with keys: title, simpleExplanation (what the problem is asking), formulas (array of {formula, meaning}),',
    'steps (each calculation step as a string), finalAnswer (string with units), check (how to verify the answer),',
    'practice (2 similar problems as {question, hint, answer}), commonMistakes (2-3 strings).',
    '',
    `Problem: ${problem}`,
    referenceText(entry),
  ].filter(Boolean).join('\n');

const reflectPrompt = ({ problem, steps, finalAnswer }) =>
  [
    'You are a strict reviewer checking another tutor\'s solution. Recompute every step independently.',
    'Return ONLY valid JSON with keys: correct (boolean), issue (string, empty if correct), correctedSteps (array of strings, empty if correct), correctedAnswer (string, empty if correct).',
    '',
    `Problem: ${problem}`,
    `Steps: ${steps.join(' | ')}`,
    `Final answer: ${finalAnswer}`,
  ].join('\n');

const searchLinks = (topic) => {
  const query = encodeURIComponent(topic);
  return [
    { title: `Khan Academy: ${topic}`, url: `https://www.khanacademy.org/search?page_search_query=${query}` },
    { title: `YouTube lessons: ${topic}`, url: `https://www.youtube.com/results?search_query=${query}+explained` },
  ];
};

const noteSentences = (notes, topic) => {
  const topicTerms = new Set(tokenize(topic));
  return notes
    .flatMap((note) => splitSentences(note.text))
    .filter((sentence) => tokenize(sentence).some((term) => topicTerms.has(term)))
    .slice(0, 4);
};

const noteSources = (notes) => notes.map((note) => ({ documentName: note.documentName, page: note.page }));

// Offline answer built from a knowledge-base entry, plus the student's own notes.
const knowledgeAnswer = ({ entry, notes, topic, mode, problem, faq }) => {
  const arithmetic = mode === 'problem' ? evaluateArithmetic(problem) : null;
  const fromNotes = noteSentences(notes, topic);
  return {
    directAnswer: faq ? { question: faq.question, answer: faq.answer } : null,
    title: entry.title,
    subject: entry.subject,
    simpleExplanation: entry.simpleExplanation,
    analogy: entry.analogy || '',
    keyPoints: entry.keyPoints || [],
    steps: arithmetic
      ? [`Rewrite the expression: ${arithmetic.expression}`, 'Apply brackets first, then powers, then multiplication/division, then addition/subtraction.', `Result: ${arithmetic.value}`]
      : mode === 'problem'
        ? ['Write down the known values and the unknown, with units.', 'Pick the formula below that links them.', 'Substitute the values and solve for the unknown.', 'Check the units and whether the answer is reasonable.']
        : entry.steps || [],
    examples: entry.examples || [],
    formulas: entry.formulas || [],
    workedExample: entry.workedExample || null,
    finalAnswer: arithmetic ? String(arithmetic.value) : '',
    practice: entry.practice || [],
    commonMistakes: entry.commonMistakes || [],
    followUps: entry.followUps || [],
    fromNotes,
    resources: searchLinks(entry.title),
    sources: [{ documentName: 'Built-in knowledge base', page: null }, ...noteSources(notes)],
  };
};

// Offline answer when the knowledge base has no matching topic.
const notesOrGuidance = ({ topic, notes, mode, problem, suggestions }) => {
  const arithmetic = mode === 'problem' ? evaluateArithmetic(problem) : null;
  const fromNotes = noteSentences(notes, topic);

  return {
    title: topic,
    simpleExplanation: fromNotes.length
      ? fromNotes.slice(0, 3).join(' ')
      : arithmetic
        ? `This is a calculation: ${arithmetic.expression} = ${arithmetic.value}.`
        : `"${topic}" is not in the built-in knowledge base yet, and the AI tutor is offline. ${suggestions.length ? 'Pick one of the related topics below, ' : 'Try a more specific topic name, '}or add your notes on it to the RAG library and ask again.`,
    analogy: '',
    keyPoints: fromNotes.slice(3),
    steps: arithmetic
      ? [`Rewrite the expression: ${arithmetic.expression}`, 'Apply brackets first, then powers, then multiplication/division, then addition/subtraction.', `Result: ${arithmetic.value}`]
      : fromNotes.length
        ? []
        : [
          `Write down what you already know about ${topic} in one sentence.`,
          'Find the definition and one real example in your textbook or notes.',
          'Explain it out loud as if teaching a friend (Feynman technique) and note where you get stuck.',
          'Re-read only the parts you got stuck on, then explain again.',
        ],
    examples: [],
    formulas: [],
    workedExample: null,
    finalAnswer: arithmetic ? String(arithmetic.value) : '',
    practice: [],
    commonMistakes: [],
    followUps: suggestions,
    fromNotes: [],
    resources: searchLinks(topic),
    sources: noteSources(notes),
  };
};

export const tutorConcept = async ({ userId, topic, question = '', level = 'beginner', mode = 'explain', useNotes = true }) => {
  const rawTopic = String(topic || question || '').trim().slice(0, 300);
  if (!rawTopic) {
    const error = new Error('Enter a topic or a problem for the tutor.');
    error.status = 400;
    throw error;
  }
  const safeLevel = LEVELS.includes(level) ? level : 'beginner';
  const safeMode = mode === 'problem' ? 'problem' : 'explain';
  const cleanTopic = safeMode === 'problem' ? rawTopic : extractTopicPhrase(rawTopic);

  // The exact question asked, e.g. "difference between bagging and boosting".
  const fullQuestion = [rawTopic, String(question || '').trim()].filter((part, index, parts) => part && parts.indexOf(part) === index).join(' ');
  const [memory, notes, knowledge, matchedFaq] = await Promise.all([
    getMemory(userId),
    useNotes ? notesContext(userId, cleanTopic) : [],
    findTopic(rawTopic, { minCoverage: safeMode === 'problem' ? 0.3 : undefined }),
    safeMode === 'explain' ? findFaq(fullQuestion) : null,
  ]);
  // A matching FAQ names the topic the question is really about.
  const faq = matchedFaq?.faq || null;
  const entry = matchedFaq?.topic || knowledge.topic;
  await noteTopic(userId, entry?.title || cleanTopic, 'tutor');

  const prompt = safeMode === 'problem'
    ? solvePrompt({ problem: rawTopic, level: safeLevel, entry })
    : explainPrompt({ topic: cleanTopic, level: safeLevel, question: question || (faq ? rawTopic : ''), memoryText: describeMemory(memory), notes, entry, faq });
  const ai = await askAi(prompt, { maxTokens: 1800 });

  if (!ai) {
    const offline = entry
      ? { ...knowledgeAnswer({ entry, notes, topic: cleanTopic, mode: safeMode, problem: rawTopic, faq }), engine: 'knowledge-base' }
      : { ...notesOrGuidance({ topic: cleanTopic, notes, mode: safeMode, problem: rawTopic, suggestions: knowledge.suggestions }), engine: 'offline' };
    return { ...offline, mode: safeMode, level: safeLevel, query: rawTopic };
  }

  const parsed = ai.parsed;
  const directAnswer = asText(parsed.answer) || faq?.answer || '';
  const result = {
    directAnswer: directAnswer && (faq || question) ? { question: faq?.question || rawTopic, answer: directAnswer } : null,
    title: asText(parsed.title, entry?.title || cleanTopic),
    simpleExplanation: asText(parsed.simpleExplanation, entry?.simpleExplanation || ''),
    analogy: asText(parsed.analogy, entry?.analogy || ''),
    keyPoints: asList(parsed.keyPoints, 6),
    steps: asList(parsed.steps, 12),
    examples: asList(parsed.examples, 4),
    formulas: normalizeFormulas(parsed.formulas),
    workedExample: normalizeWorked(parsed.workedExample),
    finalAnswer: asText(parsed.finalAnswer),
    check: asText(parsed.check),
    practice: normalizePractice(parsed.practice),
    commonMistakes: asList(parsed.commonMistakes, 4),
    followUps: asList(parsed.followUps, 3),
    sources: [...(entry ? [{ documentName: 'Built-in knowledge base', page: null }] : []), ...noteSources(notes)],
    mode: safeMode,
    level: safeLevel,
    query: rawTopic,
    engine: 'ai',
    provider: ai.provider,
  };

  if (safeMode === 'problem' && result.steps.length) {
    const review = await askAi(reflectPrompt({ problem: rawTopic, steps: result.steps, finalAnswer: result.finalAnswer }), { maxTokens: 900 });
    if (review?.parsed && review.parsed.correct === false && asList(review.parsed.correctedSteps, 12).length) {
      result.reflection = { corrected: true, issue: asText(review.parsed.issue) };
      result.steps = asList(review.parsed.correctedSteps, 12);
      result.finalAnswer = asText(review.parsed.correctedAnswer, result.finalAnswer);
    } else if (review?.parsed) {
      result.reflection = { corrected: false, issue: '' };
    }
  }

  return result;
};
