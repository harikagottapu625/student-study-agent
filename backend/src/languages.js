// Languages study material can be summarized or translated into, whatever the source language.
export const PACK_LANGUAGES = {
  english: { name: 'English', instruction: '' },
  hindi: { name: 'Hindi', instruction: 'Write every string value, including titles, in Hindi using Devanagari script. Use Hindi for ordinary words and sentences; keep only technical terms and abbreviations (for example DBMS, SQL, 1NF, primary key) in English.' },
  telugu: { name: 'Telugu', instruction: 'Write every string value, including titles, in Telugu using Telugu script. Use Telugu for ordinary words and sentences; keep only technical terms and abbreviations (for example DBMS, SQL, 1NF, primary key) in English.' },
};

// Translation can go into any language the student types, like asking a chatbot
// ("Tamil", "Kannada", "French"). Known ids keep their tuned instructions; a
// typed name must be a plain language name (letters, spaces, brackets).
export const resolveLanguage = (value) => {
  const raw = String(value || '').trim().replace(/\s+/g, ' ');
  const id = raw.toLowerCase();
  if (PACK_LANGUAGES[id]) return { id, ...PACK_LANGUAGES[id] };
  if (!/^[\p{L}][\p{L}\p{M} ()'-]{1,29}$/u.test(raw)) return null;
  const name = raw.replace(/(^|\s)\p{Ll}/gu, (letter) => letter.toUpperCase());
  return {
    id,
    name,
    instruction: `Write every string value, including titles, in ${name} using its usual script. Keep only technical terms and abbreviations (for example DBMS, SQL, 1NF, primary key) in English.`,
  };
};

// Start of each Indian script's Unicode block. The blocks follow one shared
// layout, so the same letter sits at the same offset in each of them.
const SCRIPT_BLOCKS = {
  hindi: 0x900, marathi: 0x900, nepali: 0x900, sanskrit: 0x900, bengali: 0x980, assamese: 0x980, punjabi: 0xa00,
  gujarati: 0xa80, odia: 0xb00, tamil: 0xb80, telugu: 0xc00, kannada: 0xc80, malayalam: 0xd00,
};
// Indian-script letters, leaving out the danda (। ॥) that every script shares.
const INDIAN_LETTER = /[\u0900-\u0963\u0966-\u0D7F]/g;

// Models sometimes hand the text back unchanged, or slip letters of a neighbouring
// script into a word. Technical terms stay in English, so Latin letters are fine.
export const isTranslated = (text, language, source, { minShare = 0.2 } = {}) => {
  const value = String(text || '').trim();
  if (!value || value === String(source || '').trim()) return false;
  if (language === 'english') return detectLanguage(value) === 'english';
  const block = SCRIPT_BLOCKS[language];
  if (!block) return true;
  const letters = (value.match(INDIAN_LETTER) || []).map((letter) => letter.codePointAt(0));
  const target = letters.filter((code) => code >= block && code < block + 0x80).length;
  const latin = (value.match(/[A-Za-z]/g) || []).length;
  return target === letters.length && target / (target + latin || 1) >= minShare;
};

// Last resort for a stray letter: move it to the same position in the target script.
export const repairScript = (text, language) => {
  const block = SCRIPT_BLOCKS[language];
  if (!block) return text;
  return String(text).replace(INDIAN_LETTER, (letter) => String.fromCodePoint(block + ((letter.codePointAt(0) - 0x900) % 0x80)));
};

// The language a text is written in, judged by its script: Hindi transcripts
// are Devanagari even when most words are English ("डेटाबेस").
export const detectLanguage = (text) => {
  const sample = String(text || '').slice(0, 20000);
  const counts = {
    hindi: (sample.match(/[ऀ-ॿ]/g) || []).length,
    telugu: (sample.match(/[ఀ-౿]/g) || []).length,
    english: (sample.match(/[A-Za-z]/g) || []).length,
  };
  const [language, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return count ? language : 'english';
};
