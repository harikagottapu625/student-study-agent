import { detectLanguage, isTranslated, repairScript, resolveLanguage } from './languages.js';
import { callGeminiFast } from './mistralService.js';

// Full-text translation of study material: the whole transcript or notes, not
// just the study pack. The text is cut into parts that are translated a few at
// a time, so a one-hour lecture comes back in about a minute.
const PART_CHARS = 2500;
const CONCURRENCY = 4;
// A long lecture can reach the free per-minute AI limit, which clears within a
// minute, so failed parts are tried again more slowly instead of being left out.
const RETRY_CONCURRENCY = 2;
const RETRY_ROUNDS = 5;
const RETRY_WAIT_MS = 20000;
export const MAX_TRANSLATE_CHARS = 120000;

// Paragraphs first, then sentence ends (including the Hindi danda), then words,
// so no part is cut in the middle of a sentence when it can be helped.
const splitParts = (text) => {
  const parts = [];
  let current = '';
  const add = (piece, separator) => {
    if (current && current.length + piece.length > PART_CHARS) {
      parts.push(current);
      current = piece;
    } else {
      current = current ? `${current}${separator}${piece}` : piece;
    }
  };

  for (const paragraph of text.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean)) {
    if (paragraph.length <= PART_CHARS) {
      add(paragraph, '\n\n');
      continue;
    }
    const sentences = (paragraph.match(/[^.!?।]+[.!?।]*/g) || [paragraph]).map((item) => item.trim()).filter(Boolean);
    sentences.forEach((sentence, index) => {
      const separator = index === 0 ? '\n\n' : ' ';
      if (sentence.length <= PART_CHARS) {
        add(sentence, separator);
        return;
      }
      // A transcript with no punctuation at all: about 350 words per part.
      const words = sentence.split(/\s+/);
      for (let start = 0; start < words.length; start += 350) add(words.slice(start, start + 350).join(' '), start === 0 ? separator : ' ');
    });
  }
  if (current) parts.push(current);
  return parts;
};

const partPrompt = (part, language, name) => [
  `Translate this part of a student's study material into ${name}.`,
  'It may be a speech-to-text lecture transcript without punctuation: write it as clear, well-punctuated sentences and paragraphs.',
  'Translate everything. Do not summarize, shorten, skip or add anything, and do not add notes or headings of your own.',
  language === 'english'
    ? 'English words written in another script (for example डेटाबेस, క్వెరీ) become normal English words.'
    : `Use ${name} in its usual script, and never mix in letters of another Indian script. Keep technical terms, commands and abbreviations (for example SQL, DBMS, CREATE TABLE, primary key) in English.`,
  'Return only the translation as plain text.',
  '',
  part,
].join('\n');

const translatePart = async (part, language, name) => {
  // Indian scripts take several times more tokens than English.
  const options = { maxTokens: language === 'english' ? 2500 : 6000, timeoutMs: 60000 };
  // "High demand" usually passes in a few seconds, and an untranslated or
  // mixed-script answer gets another try; the last try repairs stray letters.
  let lastError = new Error('The answer was not a translation.');
  const waits = [0, 3000, 7000];
  for (const [attempt, wait] of waits.entries()) {
    await new Promise((resolve) => setTimeout(resolve, wait));
    try {
      const result = await callGeminiFast(partPrompt(part, language, name), options);
      const text = attempt === waits.length - 1 ? repairScript(result.text, language) : result.text;
      if (isTranslated(text, language, part)) return { ...result, text };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
};

// onProgress(done, total) after every translated part. Parts that fail every
// round are kept in the original language and counted, so the rest is not lost.
export const translateFullText = async (text, requested, { onProgress } = {}) => {
  const target = resolveLanguage(requested);
  if (!target) {
    const error = new Error('Type a language name, for example English, Hindi, Telugu, Tamil or Kannada.');
    error.status = 400;
    throw error;
  }
  const { id: language, name } = target;
  let clean = String(text || '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();
  // In an unpunctuated caption transcript a line break is a pause in speech,
  // often mid-sentence; joined up, the AI writes real paragraphs instead.
  const words = clean.split(/\s+/).length;
  if (words >= 80 && (clean.match(/[.!?।]/g) || []).length / words < 0.01) clean = clean.replace(/\s*\n\s*/g, ' ');
  if (!clean) {
    const error = new Error('There is no text to translate. Add notes or a link first.');
    error.status = 400;
    throw error;
  }

  const sourceLanguage = detectLanguage(clean);
  if (sourceLanguage === language) {
    return { text: clean, sourceLanguage, language, languageName: name, parts: 0, failedParts: 0, truncated: false, sameLanguage: true };
  }

  const truncated = clean.length > MAX_TRANSLATE_CHARS;
  const parts = splitParts(truncated ? clean.slice(0, MAX_TRANSLATE_CHARS) : clean);
  const results = new Array(parts.length);
  let done = 0;
  onProgress?.(0, parts.length);

  // Translates the given parts a few at a time and returns the ones that failed.
  const runRound = async (indexes, concurrency) => {
    const failed = [];
    let next = 0;
    const worker = async () => {
      while (next < indexes.length) {
        const index = indexes[next++];
        try {
          results[index] = (await translatePart(parts[index], language, name)).text;
          done += 1;
          onProgress?.(done, parts.length);
        } catch (error) {
          console.warn(`Translation part ${index + 1} of ${parts.length} failed: ${String(error.message).slice(0, 160)}`);
          failed.push(index);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, indexes.length) }, worker));
    return failed;
  };

  let failed = await runRound(parts.map((_, index) => index), CONCURRENCY);
  for (let round = 0; failed.length && round < RETRY_ROUNDS; round += 1) {
    await new Promise((resolve) => setTimeout(resolve, RETRY_WAIT_MS));
    failed = await runRound(failed, RETRY_CONCURRENCY);
  }
  for (const index of failed) results[index] = parts[index];
  const failedParts = failed.length;

  if (failedParts === parts.length) {
    const error = new Error(`AI is busy right now, so the text could not be translated into ${name}. Try again in a minute.`);
    error.status = 503;
    throw error;
  }
  return { text: results.join('\n\n'), sourceLanguage, language, languageName: name, parts: parts.length, failedParts, truncated, sameLanguage: false };
};
