import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Estimates whether extracted text is real language or OCR garbage. Phone
// scanner apps often embed an unusable hidden text layer in PDFs of
// handwritten notes; this lets us detect that and run our own OCR instead.

const COMMON_WORDS = new Set(
  ('the of and to a in is it that for on are as with be this by an or can from at which not have has was use used using all '
  + 'but one more also when its we you your they their there these them than then into if each other such only may will would '
  + 'should must how what where who why do does make like way new two first some any many most data value values type types '
  + 'class object method function code program system example called known called set get two three number time each between '
  + 'java python file list string int public static void main return true false null new name same different allows provides').split(' '),
);

export const textQuality = (text) => {
  const tokens = String(text || '').toLowerCase().match(/[a-z]+/g) || [];
  if (!tokens.length) return { words: 0, commonRatio: 0, readable: false };
  const common = tokens.filter((token) => COMMON_WORDS.has(token)).length;
  const realWords = tokens.filter((token) => token.length >= 3 && /[aeiou]/.test(token)).length;
  const commonRatio = common / tokens.length;
  const realWordRatio = realWords / tokens.length;
  // Calibrated on real notes (commonRatio ≥ 0.28, realWordRatio ≥ 0.78) versus a
  // garbage scanner layer (0.08 and 0.23).
  return {
    words: tokens.length,
    commonRatio: Math.round(commonRatio * 100) / 100,
    realWordRatio: Math.round(realWordRatio * 100) / 100,
    readable: tokens.length >= 20 && commonRatio >= 0.12 && realWordRatio >= 0.5,
  };
};

// Vocabulary of real words, drawn from the knowledge base explanations. Used to
// tell clean OCR sentences from misreads that merely look word-shaped
// ("the doubly Inked fist cont aths").
const KB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'knowledge');

const buildVocabulary = () => {
  const vocabulary = new Set(COMMON_WORDS);
  try {
    for (const file of readdirSync(KB_DIR).filter((name) => name.endsWith('.json'))) {
      for (const word of readFileSync(path.join(KB_DIR, file), 'utf8').toLowerCase().match(/[a-z]{2,}/g) || []) vocabulary.add(word);
    }
  } catch (error) {
    console.error('Vocabulary: unable to read knowledge base files:', error.message);
  }
  return vocabulary;
};

const VOCABULARY = buildVocabulary();

const isKnownWord = (word) =>
  VOCABULARY.has(word)
  || [/s$/, /es$/, /ed$/, /d$/, /ing$/, /ly$/].some((suffix) => suffix.test(word) && VOCABULARY.has(word.replace(suffix, '')));

// Share of a text's words (3+ letters) that are known vocabulary words.
export const knownWordRatio = (text) => {
  const tokens = String(text || '').toLowerCase().match(/[a-z]{3,}/g) || [];
  return tokens.length ? tokens.filter(isKnownWord).length / tokens.length : 0;
};

const PAGE_MARKER_LINE = /^--\s*\d+\s+of\s+\d+\s*--$/;

// Drops OCR lines that contain no recognisable words ("EE oe ve |", "BE a
// Ere"), which handwriting OCR produces from margins, ruling and scribbles.
// Lines with a few misspelled real words, or listed in `keep`, are kept:
// they still carry topics.
export const dropNoiseLines = (text, { keep = new Set() } = {}) =>
  String(text || '')
    .split(/\r?\n/)
    .filter((line) => {
      const value = line.trim();
      if (!value) return false;
      if (PAGE_MARKER_LINE.test(value) || keep.has(value)) return true;
      const words = value.toLowerCase().match(/[a-z]{3,}/g) || [];
      const known = words.filter(isKnownWord).length;
      return known >= 2 || (known === 1 && words.length <= 2);
    })
    .join('\n');
