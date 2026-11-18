import { PACK_LANGUAGES, detectLanguage, isTranslated, repairScript, resolveLanguage } from '../languages.js';
import { callGeminiFast, isGeminiConfigured } from '../mistralService.js';
import { summarizeNotes } from '../notesSummarizerService.js';
import { askAi, asList, asText } from './aiClient.js';
import { noteTopic } from './memoryAgent.js';

// Notes Summarizer Agent: AI study packs with a map-reduce pass for long
// material, falling back to the extractive summarizer when AI is unavailable.

// Gemini reads long input in one call, which is faster than a map-reduce round,
// so only material longer than this is summarized in parts (at the same time).
const PART_CHARS = 40000;
// Six parts cover a 3-hour lecture transcript (about 210,000 characters).
const MAX_PARTS = 6;

// Study packs and translations use Gemini with thinking switched off: several
// times faster. "High demand" usually passes in seconds, so it gets two retries,
// the last one after that model's short pause. Other providers go through askAi.
const askFast = async (prompt, { maxTokens, timeoutMs }) => {
  if (!isGeminiConfigured()) return askAi(prompt, { maxTokens, timeoutMs });
  for (const wait of [0, 3000, 7000]) {
    await new Promise((resolve) => setTimeout(resolve, wait));
    try {
      const result = await callGeminiFast(prompt, { maxTokens, timeoutMs, json: true });
      if (result?.parsed && typeof result.parsed === 'object') return result;
    } catch {
      // The second try, or no AI answer.
    }
  }
  return null;
};

// A key point is a sentence; the AI sometimes slips a stray heading ("Keywords") into the list.
// (Characters count too: Chinese or Japanese has no spaces between words.)
const toPoints = (value) => asList(value, 12).filter((point) => point.split(/\s+/).length >= 3 || point.length >= 12).slice(0, 8);

const toPairs = (value, limit) =>
  (Array.isArray(value) ? value : [])
    .map((item) => ({ question: asText(item?.question), answer: asText(item?.answer) }))
    .filter((item) => item.question && item.answer)
    .slice(0, limit);

const splitParts = (text) => {
  if (text.length <= PART_CHARS) return [text];
  const parts = [];
  for (let start = 0; start < text.length && parts.length < MAX_PARTS; start += PART_CHARS) {
    parts.push(text.slice(start, start + PART_CHARS));
  }
  return parts;
};

export { PACK_LANGUAGES };

const MAX_TOPICS = 15;

// The topic list: detected headings are kept (and only translated); material
// without headings, such as a spoken transcript, gets topics from the AI.
const outlineInstruction = (outline, language) => {
  const name = PACK_LANGUAGES[language].name;
  if (!outline.length) return `outline: 3-8 objects {title, summary} in ${name} naming the main topics in the order they are taught, each summary one sentence`;
  if (language === 'english') return '';
  return `outline: exactly ${Math.min(outline.length, MAX_TOPICS)} objects {title, summary}, these topics translated into ${name}, in the same order: ${outline.slice(0, MAX_TOPICS).map((topic) => JSON.stringify({ title: topic.title, summary: topic.summary || '' })).join('; ')}`;
};

const packPrompt = (title, material, outline = [], language = 'english') =>
  [
    'You are the Notes Summarizer Agent. Turn the study material into an exam-ready study pack.',
    'The material may be in English, Hindi, Telugu or a mix (for example a lecture transcript).',
    'Return ONLY valid JSON with keys:',
    'points: 5-8 short bullet points covering the most important ideas',
    'keywords: 6-10 key terms',
    'topics: 3-8 topic names covered',
    'readingGuide: 3-6 short suggestions on what to read or practise next',
    'flashcards: 6-8 objects {question, answer} testing definitions and concepts',
    'qa: 5 objects {question, answer} with exam-style questions and concise answers',
    'revision: 5-8 short exam revision notes (formulas, definitions, must-remember facts)',
    outlineInstruction(outline, language),
    'Use only the material provided. Keep every string concise.',
    outline.length ? `The document's main topics (in order) are: ${outline.map((topic) => topic.title).join('; ')}. Cover all of them.` : '',
    PACK_LANGUAGES[language]?.instruction || '',
    '',
    `Title: ${title}`,
    'Material:',
    material,
  ].join('\n');

const toOutline = (value) =>
  (Array.isArray(value) ? value : [])
    .map((item) => ({ title: asText(item?.title), summary: asText(item?.summary) }))
    .filter((item) => item.title)
    .slice(0, MAX_TOPICS);

// Every string inside a pack section, without the JSON keys.
const allStrings = (value) => {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(allStrings);
  return value && typeof value === 'object' ? Object.values(value).flatMap(allStrings) : [];
};
const allText = (value) => allStrings(value).join(' ');

// One point left in the source language can hide inside a well-translated pack,
// so full sentences are checked one by one. Short terms may rightly stay in English.
const everySentenceTranslated = (value, language, source) => {
  const original = new Set(allStrings(source));
  return allStrings(value)
    .filter((item) => item.split(/\s+/).length >= 4)
    .every((item) => !original.has(item) && isTranslated(item, language, '', { minShare: 0.05 }));
};

const mapStrings = (value, change) => {
  if (typeof value === 'string') return change(value);
  if (Array.isArray(value)) return value.map((item) => mapStrings(item, change));
  return value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, mapStrings(item, change)])) : value;
};

const textList = (value, limit) =>
  (Array.isArray(value) ? value : []).map((item) => String(item ?? '').trim()).filter(Boolean).slice(0, limit);

// Re-writes a finished study pack in another language, keeping its structure
// (same topics, same number of cards) so the student sees the same matter.
export const translateStudyPack = async ({ pack, language: requested }) => {
  const target = resolveLanguage(requested);
  if (!target) {
    const error = new Error('Type a language name, for example English, Hindi, Telugu, Tamil or Kannada.');
    error.status = 400;
    throw error;
  }
  const language = target.id;
  if (!pack || typeof pack !== 'object' || !Array.isArray(pack.points) || !pack.points.length) {
    const error = new Error('There is no study pack to translate. Generate one first.');
    error.status = 400;
    throw error;
  }

  const outline = (Array.isArray(pack.outline) ? pack.outline : []).slice(0, MAX_TOPICS);
  const source = {
    title: String(pack.title || ''),
    outline: outline.map((topic) => ({ title: String(topic?.title || ''), summary: String(topic?.summary || '') })),
    points: textList(pack.points, 8),
    keywords: textList(pack.keywords, 10),
    readingGuide: textList(pack.readingGuide || pack.topics, 6),
    flashcards: toPairs(pack.flashcards, 8),
    qa: toPairs(pack.qa, 6),
    revision: textList(pack.revision, 8),
  };
  const { name, instruction } = target;
  const prompt = (part) => [
    `Translate this part of a student study pack into ${name}. The meaning must stay exactly the same; do not add, drop or merge items.`,
    'Return ONLY valid JSON with exactly the same keys, and the same number of items in every list, in the same order.',
    language === 'english' ? 'Write every string value in clear, simple English.' : `${instruction} Use only ${name} letters; never mix in letters of another Indian script.`,
    '',
    JSON.stringify(part),
  ].join('\n');

  // Two halves translated at the same time: Hindi and Telugu script are long,
  // and two shorter answers come back much sooner than one long one.
  const { flashcards: sourceCards, qa: sourceQa, ...notes } = source;
  const maxTokens = language === 'english' ? 2500 : 5000;
  const timeoutMs = language === 'english' ? 30000 : 60000;
  // Only a real translation is accepted. The last try repairs stray letters of
  // another script rather than failing, and accepts a leftover short phrase.
  const translatePart = async (part) => {
    const source = allText(part);
    const first = await askFast(prompt(part), { maxTokens, timeoutMs });
    if (!first) return null;
    if (isTranslated(allText(first.parsed), language, source) && everySentenceTranslated(first.parsed, language, part)) return first;
    const second = await askFast(prompt(part), { maxTokens, timeoutMs });
    if (!second) return null;
    const parsed = mapStrings(second.parsed, (value) => repairScript(value, language));
    return isTranslated(allText(parsed), language, source) ? { ...second, parsed } : null;
  };
  const [notesAi, cardsAi] = await Promise.all([translatePart(notes), translatePart({ flashcards: sourceCards, qa: sourceQa })]);
  const ai = notesAi;
  const parsed = { ...(cardsAi?.parsed || {}), ...(notesAi?.parsed || {}) };
  const points = toPoints(parsed.points);
  // Half a translation would leave the pack in two languages, so both must succeed.
  if (!points.length || !toPairs(parsed.flashcards, 8).length) {
    const error = new Error(`AI is busy right now, so the pack could not be translated into ${name}. Try again in a minute.`);
    error.status = 503;
    throw error;
  }

  const translatedOutline = toOutline(parsed.outline);
  const pick = (value, limit, original) => (asList(value, limit).length ? asList(value, limit) : original);
  const flashcards = toPairs(parsed.flashcards, 8);
  const qa = toPairs(parsed.qa, 6);
  const readingGuide = pick(parsed.readingGuide, 6, source.readingGuide);
  return {
    ...pack,
    title: asText(parsed.title, pack.title),
    // Page numbers and mention counts stay with their topic; only the words change.
    outline: outline.map((topic, index) => ({
      ...topic,
      title: translatedOutline[index]?.title || topic.title,
      summary: translatedOutline[index]?.summary || topic.summary,
      subtopics: language === 'english' ? topic.subtopics || [] : [],
    })),
    points,
    keywords: pick(parsed.keywords, 10, source.keywords),
    readingGuide,
    topics: readingGuide,
    flashcards: flashcards.length ? flashcards : source.flashcards,
    qa: qa.length ? qa : source.qa,
    revision: pick(parsed.revision, 8, source.revision),
    language,
    languageName: name,
    languageNote: '',
    engine: 'ai',
    provider: ai.provider,
  };
};

// Pasted lecture transcripts read like captions even when not marked as such:
// Hindi or Telugu script (the sentence finder reads English sentences), or
// long text with almost no sentence ends.
const looksSpoken = (text) => {
  const value = String(text || '');
  const words = value.split(/\s+/).filter(Boolean).length;
  if (words < 80) return false;
  return detectLanguage(value) !== 'english' || (value.match(/[.!?।]/g) || []).length / words < 0.01;
};

// The sentence finder is strict, and it runs before the AI. Long material it
// cannot read, such as bullet-point notes, still goes on to the AI as passages;
// only short text (a certificate or form) is refused. The finder reads only
// English sentences, so a short Hindi or Telugu paragraph is allowed through.
const extractiveFallback = ({ text, title, transcript }) => {
  try {
    return summarizeNotes({ text, title, transcript });
  } catch (error) {
    const words = String(text || '').split(/\s+/).filter(Boolean).length;
    const enough = detectLanguage(text) === 'english' ? 80 : 30;
    if (transcript || error.status !== 422 || words < enough) throw error;
    return summarizeNotes({ text, title, transcript: true });
  }
};

// sourceKind 'transcript' (spoken captions) has no headings, so topics spotted
// from its key terms would mislead; the AI names its topics instead.
export const summarizeStudyMaterial = async ({ userId, text, title, language = 'english', sourceKind = 'notes' }) => {
  language = PACK_LANGUAGES[language] ? language : 'english';
  const fallback = extractiveFallback({ text, title, transcript: sourceKind === 'transcript' || looksSpoken(text) });
  const detectedOutline = fallback.outline;
  // A study pack is a long answer, and Hindi or Telugu script is several times longer again.
  const timeoutMs = language === 'english' ? 40000 : 60000;
  const parts = splitParts(String(text).replace(/\s+/g, ' ').trim());

  let material = parts[0];
  if (parts.length > 1) {
    const results = await Promise.all(parts.map((part) => askFast(
      ['Summarize this part of a student\'s study material.', 'Return ONLY valid JSON with key "points": 6-10 concise bullet points.', '', part].join('\n'),
      { maxTokens: 1200, timeoutMs: 30000 },
    )));
    const partials = results.filter(Boolean).flatMap((result) => asList(result.parsed.points, 10));
    material = partials.length ? partials.map((point) => `- ${point}`).join('\n') : '';
  }

  // Hindi and Telugu script take several times more tokens than English.
  const maxTokens = language === 'english' ? 3000 : 6500;
  const ai = material ? await askFast(packPrompt(fallback.title, material, detectedOutline, language), { maxTokens, timeoutMs }) : null;
  const parsed = ai?.parsed || {};
  const points = toPoints(parsed.points);
  await noteTopic(userId, fallback.title, 'notes');

  if (!points.length) {
    // The fallback quotes the material itself, so it is in the material's language.
    const fallbackLanguage = detectLanguage([fallback.title, ...fallback.points].join(' '));
    const basicPack = {
      ...fallback,
      outline: detectedOutline,
      outlineSource: detectedOutline.length ? fallback.outlineSource : null,
      engine: 'rule-based',
      language: fallbackLanguage,
      languageNote: '',
    };
    if (fallbackLanguage === language) return basicPack;
    try {
      return { ...(await translateStudyPack({ pack: basicPack, language })), engine: 'rule-based' };
    } catch {
      return {
        ...basicPack,
        languageNote: `AI is busy right now, so this study pack uses sentences from your material in ${PACK_LANGUAGES[fallbackLanguage].name} instead of ${PACK_LANGUAGES[language].name}. Try again in a minute.`,
      };
    }
  }

  // Translated or AI-named topics keep the page numbers of the detected ones.
  const aiOutline = toOutline(parsed.outline);
  const outline = !detectedOutline.length
    ? aiOutline
    : language !== 'english' && aiOutline.length
      ? detectedOutline.slice(0, MAX_TOPICS).map((topic, index) => ({ ...topic, title: aiOutline[index]?.title || topic.title, summary: aiOutline[index]?.summary || topic.summary, subtopics: [] }))
      : detectedOutline;
  const outlineSource = !detectedOutline.length ? (outline.length ? 'ai' : null) : fallback.outlineSource;

  const flashcards = toPairs(parsed.flashcards, 8);
  const qa = toPairs(parsed.qa, 6);
  const pack = {
    title: fallback.title,
    outline,
    outlineSource,
    language,
    points,
    keywords: asList(parsed.keywords, 10).length ? asList(parsed.keywords, 10) : fallback.keywords,
    // Headings detected in the document are more reliable than AI-guessed topics.
    topics: detectedOutline.length && language === 'english' ? fallback.topics : asList(parsed.topics, 8).length ? asList(parsed.topics, 8) : fallback.topics,
    readingGuide: asList(parsed.readingGuide, 6).length ? asList(parsed.readingGuide, 6) : fallback.readingGuide,
    flashcards: flashcards.length ? flashcards : fallback.flashcards,
    qa: qa.length ? qa : fallback.qa,
    revision: asList(parsed.revision, 8).length ? asList(parsed.revision, 8) : fallback.revision,
    engine: 'ai',
    provider: ai.provider,
  };

  // Models sometimes answer in the language of the material instead of the one
  // asked for. The pack must say what it is really written in, or the student
  // could not translate it: the language would look already selected.
  const written = detectLanguage(points.join(' '));
  if (written === language || isTranslated(points.join(' '), language, '', { minShare: 0.05 })) return pack;
  try {
    return await translateStudyPack({ pack: { ...pack, language: written }, language });
  } catch {
    return {
      ...pack,
      language: written,
      languageNote: `AI is busy right now, so this study pack is in ${PACK_LANGUAGES[written].name} instead of ${PACK_LANGUAGES[language].name}. Pick ${PACK_LANGUAGES[language].name} again in a minute.`,
    };
  }
};
