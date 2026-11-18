// Retrieval engine for the RAG Study Helper: page-aware chunking and BM25 ranking.

const STOP_WORDS = new Set(
  'a about above after again all also am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers him his how i if in into is it its itself just me more most my no nor not now of off on once only or other our out over own same she should so some such than that the their them then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your explain define describe tell give list please'.split(' '),
);

const PAGE_MARKER = /--\s*(\d+)\s+of\s+\d+\s*--/gi;

const stem = (word) => {
  if (word.length > 5 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 5 && word.endsWith('ing')) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith('ed')) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
};

export const tokenize = (text) =>
  String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word))
    .map(stem);

export const splitSentences = (text) =>
  String(text || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);

// pdf-parse (and our OCR) put "-- N of M --" after page N's text, so the text
// before each marker belongs to that marker's page.
const splitPages = (text) => {
  const parts = String(text || '').split(PAGE_MARKER);
  if (parts.length === 1) return [{ page: null, text: parts[0] }];

  const pages = [];
  for (let index = 1; index < parts.length; index += 2) {
    pages.push({ page: Number(parts[index]), text: parts[index - 1] || '' });
  }
  const trailing = parts[parts.length - 1];
  if (trailing.trim()) pages.push({ page: (pages[pages.length - 1]?.page || 0) + 1, text: trailing });
  return pages;
};

// Sentence-aware windows of ~chunkWords with a small overlap so answers that
// span a chunk boundary can still be retrieved.
export const chunkText = (text, { chunkWords = 140, overlapWords = 35 } = {}) => {
  const chunks = [];

  for (const { page, text: pageText } of splitPages(text)) {
    const sentences = splitSentences(pageText);
    let current = [];
    let currentWords = 0;

    const flush = () => {
      const content = current.join(' ').trim();
      if (content.length >= 40) chunks.push({ index: chunks.length, page, text: content });
    };

    for (const sentence of sentences) {
      const words = sentence.split(' ').length;
      if (currentWords + words > chunkWords && current.length) {
        flush();
        const overlap = [];
        let overlapCount = 0;
        for (let index = current.length - 1; index >= 0 && overlapCount < overlapWords; index -= 1) {
          overlap.unshift(current[index]);
          overlapCount += current[index].split(' ').length;
        }
        current = overlapCount < currentWords ? overlap : [];
        currentWords = current.join(' ').split(' ').filter(Boolean).length;
      }
      current.push(sentence);
      currentWords += words;
    }
    flush();
  }

  return chunks;
};

// BM25 ranking over the supplied chunks, with a bonus for exact query phrases.
export const searchChunks = (chunks, query, { topK = 5 } = {}) => {
  const queryTerms = [...new Set(tokenize(query))];
  if (!queryTerms.length || !chunks.length) return [];

  const k1 = 1.5;
  const b = 0.75;
  const docs = chunks.map((chunk) => {
    const tokens = tokenize(chunk.text);
    const frequencies = tokens.reduce((map, token) => map.set(token, (map.get(token) || 0) + 1), new Map());
    return { chunk, length: tokens.length, frequencies };
  });
  const averageLength = docs.reduce((total, doc) => total + doc.length, 0) / docs.length || 1;
  const documentFrequency = new Map(
    queryTerms.map((term) => [term, docs.filter((doc) => doc.frequencies.has(term)).length]),
  );

  const lowerQuery = String(query).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const phrases = lowerQuery.split(' ').filter((word) => word.length > 2 && !STOP_WORDS.has(word));
  const bigrams = phrases.slice(0, -1).map((word, index) => `${word} ${phrases[index + 1]}`);

  return docs
    .map(({ chunk, length, frequencies }) => {
      let score = 0;
      const matchedTerms = [];
      for (const term of queryTerms) {
        const frequency = frequencies.get(term) || 0;
        if (!frequency) continue;
        matchedTerms.push(term);
        const df = documentFrequency.get(term) || 0;
        const idf = Math.log(1 + (docs.length - df + 0.5) / (df + 0.5));
        score += idf * ((frequency * (k1 + 1)) / (frequency + k1 * (1 - b + (b * length) / averageLength)));
      }
      const lowerText = chunk.text.toLowerCase();
      score += bigrams.filter((bigram) => lowerText.includes(bigram)).length * 0.75;
      return { ...chunk, score, matchedTerms, coverage: matchedTerms.length / queryTerms.length };
    })
    .filter((hit) => hit.matchedTerms.length > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, topK);
};

// Share of a sentence's content words that also appear in the evidence text.
export const supportRatio = (sentence, evidenceText) => {
  const sentenceTerms = [...new Set(tokenize(sentence))];
  if (!sentenceTerms.length) return 1;
  const evidenceTerms = new Set(tokenize(evidenceText));
  return sentenceTerms.filter((term) => evidenceTerms.has(term)).length / sentenceTerms.length;
};
