import { knownWordRatio, textQuality } from './textQuality.js';
import { referenceTopic, spotTopics } from './topicSpotter.js';

const STOP_WORDS = new Set(
  'about after again against along also because before being between could does doing during each from further have into more most other over should some such than their there these they those through under very what when where which while with would your code used void exec'.split(' '),
);

const PAGE_MARKER = /^--\s*(\d+)\s+of\s+\d+\s*--$/i;

// ---------------------------------------------------------------------------
// Extractive summary: picks the document's most representative sentences.
// ---------------------------------------------------------------------------

const SUMMARY_STOP_WORDS = new Set([
  ...STOP_WORDS,
  ...'this that with from have been were will shall them they then than also into only many much more most such each both well just like make made using used uses within without upon among however therefore thus figure table page fig'.split(' '),
]);

const contentWords = (sentence) =>
  (sentence.toLowerCase().match(/[a-z][a-z-]{3,}/g) || []).filter((word) => !SUMMARY_STOP_WORDS.has(word) && isUsefulKeyword(word));

// PDF fonts often store letters as special glyphs ("efϐiciency", "signiϔicant").
const fixLigatures = (text) => String(text || '').replace(/[ϐϔ]/g, 'f').replace(/ﬁ/g, 'fi').replace(/ﬂ/g, 'fl').replace(/ﬀ/g, 'ff');

// Journal headers and footers ("Impact Factor 7.538 | ...") repeat on every
// page; they are not content.
const withoutRunningHeaders = (lines) => {
  const pages = Math.max(1, lines.filter((line) => PAGE_MARKER.test(line)).length);
  if (pages < 3) return lines;
  const key = (line) => line.toLowerCase().replace(/\d+/g, '#');
  const counts = new Map();
  for (const line of lines) counts.set(key(line), (counts.get(key(line)) || 0) + 1);
  return lines.filter((line) => PAGE_MARKER.test(line) || counts.get(key(line)) < Math.max(3, pages * 0.3));
};

const BULLET_START = /^(?:[•▪◦‣●○■□➢►✓\-*]|\d{1,2}[.)]|[a-z][.)])\s+/;
const SECTION_NAME = /^(abstract|introduction|conclusions?|methodology|materials and methods|methods|results(?: and discussion)?|discussion|background|summary|literature review|research analysis|keywords?|index terms)\s*[:.\-–]?\s+(?=[A-Z])/i;

// Rebuilds the text as separate units: paragraphs are re-joined across line
// wraps ("plat-\nform" -> "platform"), while headings and bullet points stay
// their own units instead of being glued onto the next sentence.
const toUnits = (text) => {
  const lines = withoutRunningHeaders(fixLigatures(text).split(/\r?\n/).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean));
  const units = [];
  let current = '';
  let kind = 'para';
  const flush = (as = kind) => {
    if (current.trim()) units.push({ text: current.trim(), kind: as });
    current = '';
    kind = 'para';
  };
  lines.forEach((line, index) => {
    if (PAGE_MARKER.test(line)) return;
    const next = lines[index + 1] || '';
    const isHeading = wordCount(line) <= 10 && !/[.,;:!?]$/.test(line) && /^[A-Z0-9]/.test(next) && !/[-‑]$/.test(line);
    if (BULLET_START.test(line)) {
      flush();
      kind = 'bullet';
    }
    const startsUnit = !current;
    if (/[-‑]$/.test(current) && /^[a-z]/.test(line)) current = current.replace(/[-‑]$/, '') + line;
    else current = current ? `${current} ${line}` : line;
    // A short unpunctuated line on its own is a heading, not part of a sentence.
    if (isHeading && startsUnit && kind !== 'bullet') flush('heading');
    else if (isHeading || BULLET_START.test(next)) flush();
  });
  flush();
  return units.map((unit) => ({ ...unit, text: unit.text.replace(BULLET_START, '').replace(SECTION_NAME, '').trim() }));
};

// The document's sentences (headings left out), each marked if it is a bullet.
const toSentences = (text) =>
  toUnits(text)
    .filter((unit) => unit.kind !== 'heading')
    .flatMap((unit) =>
      unit.text
        // "..., India ABSTRACT: The platform ..." starts a new sentence at the label.
        .replace(/\s*\b(?:ABSTRACT|Abstract|KEYWORDS|Keywords|Index Terms)\s*[:—–]\s*/g, '. ')
        .replace(/\b(etc|e\.g|i\.e|vs|approx|eg|ie|et al|fig|no|dr|mr|mrs|ms)\./gi, '$1§')
        .split(/(?<=[.!?])\s+(?=["“(]?[A-Z0-9])/)
        .map((sentence) => ({ text: sentence.replace(/§/g, '.').trim(), bullet: unit.kind === 'bullet' })));

// A summary sentence must be a complete, readable statement, not a fragment,
// citation, URL or table row. Bullet points ("Learn GD rules and etiquette")
// count too, even without a full stop.
const isSummaryCandidate = ({ text: sentence, bullet }, strict) => {
  const words = wordCount(sentence);
  const complete = /[.!?]["”)]?$/.test(sentence);
  return words >= (complete ? 8 : 4) && words <= 45
    && /^["“(]?[A-Z]/.test(sentence)
    && (complete || bullet)
    && !/https?:|www\.|doi|©|copyright|@|issn|impact factor|university|department of/i.test(sentence)
    // Comma lists ("Online platform, Rural farmers, User-Friendly, ...") are not statements.
    && (sentence.match(/,/g) || []).length < words / 4
    && (sentence.match(/\d/g) || []).length / sentence.length < 0.08
    && isClearSentence(sentence, strict);
};

// Scores sentences by how many of the document's frequent words they carry,
// with a bonus for definitions and conclusions, then keeps the best few in
// document order, skipping near-duplicates.
const summarySentences = (text, { count = 7, strict = false } = {}) => {
  const sentences = toSentences(text);
  const frequency = new Map();
  for (const { text: sentence } of sentences) {
    for (const word of new Set(contentWords(sentence))) frequency.set(word, (frequency.get(word) || 0) + 1);
  }
  const scored = sentences
    .map((sentence, index) => ({ sentence, index }))
    .filter(({ sentence }) => isSummaryCandidate(sentence, strict))
    .map(({ sentence: { text: sentence }, index }) => {
      const words = [...new Set(contentWords(sentence))];
      const weight = words.reduce((sum, word) => sum + Math.log(1 + (frequency.get(word) || 0)), 0) / Math.sqrt(Math.max(words.length, 1));
      const cue = /\b(is defined as|refers to|is called|is known as|is a|are the|the main|this (study|paper|chapter)|in conclusion|results? (show|indicate)|we (propose|found)|important|purpose|aims? to)\b/i.test(sentence) ? 0.6 : 0;
      const early = index < sentences.length * 0.15 ? 0.3 : 0;
      return { sentence, index, words: new Set(words), score: weight + cue + early };
    })
    .sort((left, right) => right.score - left.score);

  const chosen = [];
  for (const candidate of scored) {
    const overlaps = chosen.some((other) => {
      const shared = [...candidate.words].filter((word) => other.words.has(word)).length;
      return shared / Math.min(candidate.words.size, other.words.size) > 0.6;
    });
    if (!overlaps) chosen.push(candidate);
    if (chosen.length >= count) break;
  }
  return chosen.sort((left, right) => left.index - right.index).map((item) => item.sentence);
};

// Frequent two-word phrases ("digital platforms") first, then frequent words.
const keyPhrases = (text, limit = 10) => {
  const counts = new Map();
  const add = (phrase) => counts.set(phrase, (counts.get(phrase) || 0) + 1);
  for (const { text: sentence } of toSentences(text)) {
    const tokens = sentence.toLowerCase().match(/[a-z][a-z-]+/g) || [];
    tokens.forEach((token, index) => {
      const next = tokens[index + 1];
      const usable = (word) => word && word.length >= 4 && !SUMMARY_STOP_WORDS.has(word) && isUsefulKeyword(word);
      if (usable(token)) add(token);
      if (usable(token) && usable(next)) add(`${token} ${next}`);
    });
  }
  const singular = (word) => word.replace(/(?<!s)s$/, '');
  const phrases = [...counts.entries()].filter(([phrase, count]) => phrase.includes(' ') && count >= 3).sort((a, b) => b[1] - a[1]);
  const words = [...counts.entries()].filter(([phrase, count]) => !phrase.includes(' ') && count >= 3).sort((a, b) => b[1] - a[1]);
  const result = [];
  for (const [phrase] of [...phrases.slice(0, Math.ceil(limit / 2)), ...words]) {
    const stems = phrase.split(' ').map(singular);
    const covered = result.some((kept) => {
      const keptStems = kept.split(' ').map(singular);
      return stems.every((stem) => keptStems.includes(stem)) || (stems.length > 1 && keptStems.every((stem) => stems.includes(stem)));
    });
    if (!covered) result.push(phrase);
    if (result.length >= limit) break;
  }
  return result;
};

// Main topics for a clear document without usable headings: its own most
// frequent phrases, each with the page it is discussed most and a sentence
// from the document that uses it.
const phraseOutline = (text, phrases, strict) => {
  const pages = [];
  let page = [];
  for (const line of fixLigatures(text).split(/\r?\n/)) {
    if (PAGE_MARKER.test(line.trim())) {
      pages.push(page.join(' ').toLowerCase());
      page = [];
    } else page.push(line);
  }
  pages.push(page.join(' ').toLowerCase());
  const candidates = toSentences(text).filter((sentence) => isSummaryCandidate(sentence, strict)).map((sentence) => sentence.text);
  return phrases
    .filter((phrase) => phrase.includes(' '))
    .slice(0, 8)
    .map((phrase) => {
      const mentions = pages.map((content) => content.split(phrase).length - 1);
      const best = mentions.indexOf(Math.max(...mentions));
      return {
        title: phrase.replace(/\b\w/g, (letter) => letter.toUpperCase()),
        page: pages.length > 1 ? best + 1 : null,
        mentions: mentions.reduce((sum, count) => sum + count, 0),
        summary: candidates.find((sentence) => sentence.toLowerCase().includes(phrase)) || '',
        subtopics: [],
      };
    })
    .sort((left, right) => (left.page || 0) - (right.page || 0));
};

// "A stack is a linear data structure..." -> "What is a stack?"
const DEFINITION = /^(?:An?\s+|The\s+)?([A-Z]?[\w() -]{2,40}?)\s+(?:is|are|refers to|means)\s+(.+)$/;

const makeFlashcards = (sentences, phrases) => {
  const used = new Set();
  return sentences.slice(0, 8).map((sentence) => {
    const definition = sentence.match(DEFINITION);
    if (definition && wordCount(definition[1]) <= 5) return { question: `What is ${definition[1].trim().replace(/^\w/, (letter) => letter.toLowerCase())}?`, answer: sentence };
    // Otherwise blank out an important phrase not already used as an answer.
    const phrase = phrases.find((item) => !used.has(item) && sentence.toLowerCase().includes(item));
    if (phrase) used.add(phrase);
    if (phrase) {
      const blanked = sentence.replace(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '_____');
      return { question: `Fill in the blank: ${blanked}`, answer: phrase.replace(/\b\w/g, (letter) => letter.toUpperCase()) };
    }
    return { question: 'What does the document say about this point?', answer: sentence };
  });
};

const makeQuestionPairs = (sentences, phrases) =>
  sentences.slice(0, 6).map((sentence, index) => {
    const phrase = phrases.find((item) => sentence.toLowerCase().includes(item));
    return {
      question: phrase ? `What does the document say about ${phrase}?` : ['What is the main point here?', 'Why is this important?', 'How does this work?', 'What is the practical takeaway?', 'What conclusion is drawn?', 'What should you remember?'][index],
      answer: sentence,
    };
  });

function isUsefulKeyword(word) {
  const normalized = word.toLowerCase();
  const vowels = (normalized.match(/[aeiou]/g) || []).length;
  return /^[a-z][a-z-]{3,}$/.test(normalized) && vowels > 0 && vowels / normalized.length >= 0.15;
}

// ---------------------------------------------------------------------------
// Outline detection: finds the main topics (headings) of a document and the
// subtopics and summary under each one.
// ---------------------------------------------------------------------------

const NUMBERED_HEADING = /^(?:(?:chapter|unit|module|lesson|section|part|topic)\s+)?(\d{1,3}(?:\.\d{1,2})?)\s*[.):\-–]?\s+([A-Za-z(][^]{1,90})$/i;
const NAMED_HEADING = /^(chapter|unit|module|lesson|section|part|topic)\s+([0-9ivxlc]+)\s*[:.\-–]?\s*(.{2,90})$/i;
const MARKDOWN_HEADING = /^#{1,4}\s+(.{2,90})$/;
const BULLET = /^(?:[•▪◦‣\-*]|\d+[.)]|[a-z][.)])\s+/;

const wordCount = (value) => value.split(/\s+/).filter(Boolean).length;
const cleanHeading = (value) => value.replace(/[:\-–\s]+$/, '').replace(/\s+/g, ' ').trim();

const looksLikeHeadingText = (value) => {
  const text = cleanHeading(value);
  return text.length >= 2
    && wordCount(text) <= 10
    && !/[.;,]$/.test(text)
    && !/[=;{}<>]/.test(text)
    // "1. Platform Independence: Java's bytecode can..." is a numbered definition, not a heading.
    && !/:\s*\S+\s+\S+\s+\S+/.test(text)
    && /[A-Za-z]{2,}/.test(text);
};

const toLines = (text) => {
  const lines = [];
  let page = 1;
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.replace(/\s+/g, ' ').trim();
    if (!line) continue;
    const marker = line.match(PAGE_MARKER);
    if (marker) {
      page = Number(marker[1]) + 1;
      continue;
    }
    lines.push({ text: line, page });
  }
  return lines;
};

const findHeadings = (lines) => {
  const numbered = [];
  lines.forEach((line, index) => {
    const named = line.text.match(NAMED_HEADING);
    const markdown = line.text.match(MARKDOWN_HEADING);
    const match = line.text.match(NUMBERED_HEADING);
    if (named && looksLikeHeadingText(named[3])) numbered.push({ index, title: cleanHeading(named[3]), label: `${named[1]} ${named[2]}`, page: line.page });
    else if (markdown && looksLikeHeadingText(markdown[1])) numbered.push({ index, title: cleanHeading(markdown[1]), page: line.page });
    else if (match && looksLikeHeadingText(match[2])) numbered.push({ index, title: cleanHeading(match[2]), number: match[1], page: line.page });
  });

  const labelled = numbered.filter((heading) => !heading.number);
  if (labelled.length >= 2) return labelled;

  // Sub-section headings like "3.1 Decision making" become subtopics of chapter 3.
  const sections = numbered.filter((heading) => heading.number?.includes('.'));
  const hasSections = (heading) => sections.some((section) => section.number.startsWith(`${heading.number}.`) && section.index > heading.index);

  // Numbered items inside a topic ("1. Open the file") also match, so keep the
  // best run of consecutive top-level numbers (1, 2, 3, ...) as the headings,
  // preferring runs whose headings have sub-sections (real chapters).
  // One skipped number is tolerated in case OCR misread a heading.
  const topLevel = numbered.filter((heading) => heading.number && !heading.number.includes('.'));
  let best = [];
  let bestScore = 0;
  topLevel.forEach((start, startIndex) => {
    const chain = [start];
    let expected = Number(start.number) + 1;
    for (const heading of topLevel.slice(startIndex + 1)) {
      const value = Number(heading.number);
      if (value === expected || value === expected + 1) {
        chain.push(heading);
        expected = value + 1;
      }
    }
    const score = chain.length + 2 * chain.filter(hasSections).length;
    if (score > bestScore) {
      best = chain;
      bestScore = score;
    }
  });
  if (best.length >= 2) return best.map((heading) => ({ ...heading, sections: sections.filter((section) => section.number.startsWith(`${heading.number}.`)) }));
  // Chapter titles unreadable (common with handwriting OCR) but sub-sections found.
  if (sections.length >= 2) return sections;

  // No numbered headings: fall back to ALL-CAPS title lines.
  const caps = lines
    .map((line, index) => ({ index, page: line.page, text: line.text }))
    .filter(({ text }) => text === text.toUpperCase() && /[A-Z]{3,}/.test(text) && looksLikeHeadingText(text) && wordCount(text) <= 8)
    .map(({ index, page, text }) => ({ index, page, title: cleanHeading(text).toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) }));
  if (caps.length >= 2) return caps;

  // Typed notes often use plain short headings ("CPU Scheduling") on their own
  // line, each followed by a sentence of explanation.
  const plain = lines
    .map((line, index) => ({ index, page: line.page, text: line.text, next: lines[index + 1]?.text || '' }))
    .filter(({ index, text, next }) => index > 0 && wordCount(text) <= 6 && /^[A-Z]/.test(text) && !/[.,;:!?]$/.test(text)
      && looksLikeHeadingText(text) && wordCount(next) >= 8 && /[.!?]/.test(next))
    .map(({ index, page, text }) => ({ index, page, title: cleanHeading(text) }));
  return plain.length >= 2 && plain.length <= lines.length * 0.4 ? plain : [];
};

// Labels like "Syntax:" or "Example:" introduce detail rather than naming a subtopic;
// list labels like "Types:" introduce several subtopics at once.
const LIST_LABEL = /^(examples?|types?|states?|keywords?|steps?|advantages?|disadvantages?|features?|methods?|components?|kinds?)$/i;
const GENERIC_LABEL = /^(examples?|e\.?g\.?|syntax|types?|states?|notes?|keywords?|usage|output|code|steps?|advantages?|disadvantages?|features?|methods?|components?|kinds?)$/i;

// Returns the subtopics named on a line: "• Encapsulation: Bind data..." -> Encapsulation;
// "Types: Bootstrap, Extension, Application" -> the three listed items.
const subtopicsFromLine = (line) => {
  const text = line.replace(BULLET, '').trim();
  const term = text.match(/^([^:–—]{2,48})\s*[:–—]\s*(.+)$/);
  if (term && wordCount(term[1]) <= 6) {
    const name = term[1].trim();
    const detail = term[2].trim();
    if (!GENERIC_LABEL.test(name)) return [{ name, detail }];
    if (!LIST_LABEL.test(name)) return [];
    const items = detail.replace(/\.$/, '').split(/\s*(?:,|→|->|\||\s[—–]\s)\s*/).map((item) => item.replace(/[\s—–-]+$/, '')).filter((item) => item && wordCount(item) <= 4);
    return items.length >= 2 ? items.map((item) => ({ name: item, detail: '' })) : [];
  }
  return wordCount(text) <= 6 && !/[.;]$/.test(text) ? [{ name: text, detail: '' }] : [];
};

export const detectOutline = (text) => {
  const lines = toLines(text);
  const headings = findHeadings(lines);
  if (!headings.length) return { documentTitle: '', outline: [] };

  // The title is the first line before the first heading, skipping the
  // institution name that cover pages and slides often start with.
  const firstLine = lines.slice(0, Math.min(headings[0].index, 3)).map((line) => line.text)
    .find((line) => !/\b(institute|university|college|department)\b/i.test(line)) || '';
  const documentTitle = headings[0].index > 0 && looksLikeHeadingText(firstLine) ? cleanHeading(firstLine) : '';

  const outline = headings.map((heading, position) => {
    const end = headings[position + 1]?.index ?? lines.length;
    const sectionLines = new Set((heading.sections || []).map((section) => section.index));
    const body = lines.slice(heading.index + 1, end).filter((_, offset) => !sectionLines.has(heading.index + 1 + offset)).map((line) => line.text);
    // Sub-section headings ("3.1 Decision making") come first, then bullets and terms.
    const subtopics = (heading.sections || [])
      .filter((section) => section.index > heading.index && section.index < end)
      .map((section) => ({ name: section.title, detail: '' }));
    const prose = [];
    for (const line of body) {
      const isBullet = BULLET.test(line);
      const isTerm = /^[A-Za-z][\w() /+-]{1,40}:\s+\S/.test(line);
      const found = isBullet || isTerm ? subtopicsFromLine(line) : [];
      for (const sub of found) {
        if (subtopics.length < 10 && !subtopics.some((item) => item.name.toLowerCase() === sub.name.toLowerCase())) subtopics.push(sub);
      }
      if (!isBullet && !found.length) prose.push(line);
    }
    const paragraph = prose.join(' ').replace(/\s+/g, ' ').trim();
    // Protect abbreviations so "int, char, etc." does not end a sentence.
    const protectedText = paragraph.replace(/\b(etc|e\.g|i\.e|vs|approx|eg|ie)\./gi, '$1§');
    const sentences = (protectedText.match(/[^.!?]+[.!?]+(?=\s|$)/g) || [protectedText]).map((sentence) => sentence.replace(/§/g, '.'));
    const summary = (sentences.find((sentence) => wordCount(sentence) >= 4) || sentences[0] || '').trim().slice(0, 260);
    return { title: heading.title, page: heading.page, summary, subtopics, content: paragraph.slice(0, 1200) };
  });

  return { documentTitle, outline };
};

const fromOutline = ({ title, outline, keywords }) => {
  const definitions = outline.flatMap((topic) => topic.subtopics.filter((sub) => sub.detail).map((sub) => ({ ...sub, topic: topic.title })));
  const subtopicList = (topic) => topic.subtopics.map((sub) => sub.name).join(', ');

  return {
    title,
    outline: outline.map(({ content, ...topic }) => topic),
    topics: outline.map((topic) => topic.title),
    points: outline.slice(0, 10).map((topic) => [topic.title + (topic.page ? ` (page ${topic.page})` : ''), topic.summary || subtopicList(topic)].filter(Boolean).join(': ')),
    keywords,
    readingGuide: outline.slice(0, 8).map((topic) => `${topic.title}${topic.page ? ` (page ${topic.page})` : ''}${topic.subtopics.length ? `: cover ${subtopicList(topic)}` : ''}.`),
    flashcards: [
      ...definitions.slice(0, 6).map((sub) => ({ question: `${sub.topic}: what is ${sub.name.replace(/:$/, '')}?`, answer: sub.detail })),
      ...outline.filter((topic) => topic.summary).slice(0, Math.max(2, 8 - Math.min(6, definitions.length))).map((topic) => ({ question: `What is ${topic.title}?`, answer: topic.summary })),
    ].slice(0, 8),
    qa: outline.filter((topic) => topic.summary || topic.subtopics.length).slice(0, 6).map((topic) => ({
      question: topic.subtopics.length ? `Explain ${topic.title} and its key parts.` : `Explain ${topic.title}.`,
      answer: [topic.summary, topic.subtopics.length ? `Key parts: ${topic.subtopics.map((sub) => (sub.detail ? `${sub.name} (${sub.detail.replace(/\.$/, '')})` : sub.name)).join('; ')}.` : ''].filter(Boolean).join(' '),
    })),
    revision: [
      `${title} covers ${outline.length} main topics: ${outline.map((topic) => topic.title).join(', ')}.`,
      ...outline.slice(0, 7).map((topic) => [topic.title, topic.subtopics.length ? subtopicList(topic) : topic.summary].filter(Boolean).join(': ')),
      'Exam check: for each topic, write the definition and one example from memory, then compare with your notes.',
    ],
  };
};

// A heading read by OCR must be mostly real words to be trusted.
const SHORT_WORDS = new Set('a an as at by if in is it of on or to vs and the for io os ds db ai ml ui'.split(' '));

const isReadableTitle = (title) => {
  // OCR noise shows up as stray symbols ("%", "[V1", "&") and odd casing ("hE", "joMous").
  if (/[%&[\]|~{}<>@#$^*=_\\]/.test(title) || /\b[a-z]+[A-Z]/.test(title)) return false;
  // Wrapped sentence fragments ("To examine the extent to which ...", "plat-").
  if (/[-‑]$/.test(title) || (/^to\s+[a-z]+\s/i.test(title) && wordCount(title) >= 4)) return false;
  const words = title.match(/[a-z]+/gi) || [];
  // Acronyms such as "JVM" or "SQL" have no vowels but are real words.
  const real = words.filter((word) => SHORT_WORDS.has(word.toLowerCase()) || /^[A-Z]{2,5}$/.test(word)
    || (word.length >= 3 && /[aeiou]/i.test(word) && !/(.)\1\1/.test(word) && !/[^aeiouy]{5}/i.test(word)));
  return words.length > 0 && real.length / words.length >= 0.8 && words.some((word) => word.length >= 4);
};

const clearestLine = (lines) =>
  lines
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => wordCount(line) >= 5)
    // Contents-page lines ("Method Overriding 145-51") and code make poor summaries.
    .map((line) => ({
      line,
      score: textQuality(line).realWordRatio + Math.min(wordCount(line), 15) / 100
        - ((line.match(/\d+/g) || []).length >= 2 ? 0.3 : 0)
        - (/[;{}()=]/.test(line) ? 0.2 : 0),
    }))
    .sort((left, right) => right.score - left.score)[0]?.line || '';

// Printed notes OCR at ~0.87 real words; handwriting at ~0.6, where misread
// words still look like headings, so known terms are the safer topic source.
const NOISY_TEXT_RATIO = 0.75;
const GENERIC_TITLE = /^(index|contents?|table of contents|notes?|untitled|page \d+)$/i;

// Only sentences that are mostly real words are worth showing to a student.
// For noisy (handwritten) OCR, misreads look word-shaped, so strict mode also
// requires the words to be known vocabulary.
const isClearSentence = (sentence, strict = false) => {
  const quality = textQuality(sentence);
  // realWordRatio skips short words ("is", "of", "a"), so a clean sentence with
  // many of them scores low; in clean documents known vocabulary counts too.
  const realEnough = quality.realWordRatio >= 0.8 || (!strict && knownWordRatio(sentence) >= 0.85);
  return quality.words >= 4 && realEnough
    && (!strict || (knownWordRatio(sentence) >= 0.85 && !/[%&[\]|~{}<>@#$^*=_\\]/.test(sentence)));
};

const cleanTopic = (topic, strict) => ({
  ...topic,
  summary: isClearSentence(topic.summary, strict) ? topic.summary : '',
  subtopics: topic.subtopics.filter((sub) => isReadableTitle(sub.name) && (!sub.detail || isClearSentence(sub.detail, strict) || wordCount(sub.detail) < 5)),
});

// A topic spotted in unreadable handwriting gets the knowledge base's short
// explanation instead, flagged so the student knows it is not their own notes.
const withReference = (topic) => {
  if (topic.summary) return topic;
  const reference = referenceTopic(topic.title);
  return reference ? { ...topic, summary: reference.simpleExplanation, summaryFromReference: true } : topic;
};

// Headings when they are readable; otherwise topics spotted from key terms.
const findOutline = (text) => {
  const noisy = textQuality(text).realWordRatio < NOISY_TEXT_RATIO;
  const detected = detectOutline(text);
  const readable = detected.outline.filter((topic) => isReadableTitle(topic.title)).map((topic) => cleanTopic(topic, noisy));
  // "INDEX" or "13 VII July 2025" on the first line is not the document's title.
  const titleOk = detected.documentTitle && !GENERIC_TITLE.test(detected.documentTitle) && isReadableTitle(detected.documentTitle)
    && !/journal|volume|issn|proceedings/i.test(detected.documentTitle)
    && (detected.documentTitle.match(/\d/g) || []).length <= 2;
  const documentTitle = titleOk ? detected.documentTitle : '';
  const spotted = () => spotTopics(text).map((topic) => withReference(cleanTopic({
    title: topic.title,
    page: topic.page,
    mentions: topic.mentions,
    summary: clearestLine(topic.lines).slice(0, 260),
    subtopics: [],
  }, noisy)));

  const headingsOk = readable.length >= 2 && readable.length >= detected.outline.length * (noisy ? 0.8 : 0.5);
  // Clear text is summarised from its own words only; spotting syllabus terms
  // there finds unrelated topics ("Transactions" in a farming paper).
  if (!noisy) return { documentTitle, outline: headingsOk ? readable : [], outlineSource: headingsOk ? 'headings' : null, noisy };
  const terms = spotted();
  if (terms.length >= 3) return { documentTitle: '', outline: terms, outlineSource: 'key-terms', noisy };
  if (headingsOk) return { documentTitle, outline: readable, outlineSource: 'headings', noisy };
  return { documentTitle: '', outline: terms.length >= 2 ? terms : [], outlineSource: terms.length >= 2 ? 'key-terms' : null, noisy };
};

// transcript: spoken captions have no headings, and topics spotted from their
// words would mislead, so they are summarised by their key sentences only.
export const summarizeNotes = ({ text, title = 'Study Notes', transcript = false }) => {
  const { documentTitle, outline, outlineSource, noisy } = transcript
    ? { documentTitle: '', outline: [], outlineSource: null, noisy: false }
    : findOutline(text);
  let summary = summarySentences(text, { count: 7, strict: noisy });
  // Auto-captions often have no punctuation; use the opening of each passage instead.
  if (transcript && !summary.length) {
    summary = String(text).split(/\n\s*\n/).map((part) => part.trim().split(/\s+/)).filter((part) => part.length >= 12)
      .filter((_, index, parts) => index % Math.max(1, Math.floor(parts.length / 7)) === 0).slice(0, 7)
      .map((part) => `${part.slice(0, 30).join(' ')}${part.length > 30 ? '…' : ''}`);
  }
  if (!summary.length && outline.length < 2) {
    const error = new Error('This file has too little readable text to summarize (it may be a certificate, form or image-only page). Upload study notes, slides or a document with full sentences.');
    error.status = 422;
    throw error;
  }
  const packTitle = documentTitle || title || 'Study Notes';

  // Handwriting: misread words make word counts and sentences unreliable, so
  // the pack is built from the topics spotted in it.
  if (noisy && outline.length >= 2) {
    return { ...fromOutline({ title: packTitle, outline, keywords: outline.map((topic) => topic.title).slice(0, 10) }), outlineSource };
  }

  const phrases = keyPhrases(text, 10);
  const subtopicKeywords = outline.flatMap((topic) => topic.subtopics.map((sub) => sub.name)).filter((name) => wordCount(name) <= 3 && /^[A-Za-z]/.test(name) && !/'/.test(name));
  const keywords = [...new Set([...subtopicKeywords, ...phrases])].slice(0, 10);

  if (outline.length >= 2) {
    // Headings give the topics. Notes organised under many headings are best
    // summarised topic by topic; papers with a few sections by their key sentences.
    const pack = fromOutline({ title: packTitle, outline, keywords });
    const byTopic = outline.length >= 8 && outline.filter((topic) => topic.summary).length >= outline.length / 2;
    return {
      ...pack,
      points: byTopic || summary.length < 3 ? pack.points : summary,
      flashcards: pack.flashcards.length >= 4 ? pack.flashcards : [...pack.flashcards, ...makeFlashcards(summary, phrases)].slice(0, 8),
      qa: pack.qa.length >= 3 ? pack.qa : makeQuestionPairs(summary, phrases),
      outlineSource,
    };
  }

  // A short note is one topic; splitting it by frequent phrases gives
  // fragments like "Form Removes".
  const topics = !transcript && wordCount(text) >= 250 ? phraseOutline(text, phrases, noisy) : [];
  return {
    title: packTitle,
    outline: topics.length >= 2 ? topics : [],
    outlineSource: topics.length >= 2 ? 'key-phrases' : null,
    points: summary,
    keywords,
    topics: phrases,
    readingGuide: phrases.slice(0, 6).map((phrase) => `Review what the document says about ${phrase}.`),
    flashcards: makeFlashcards(summary, phrases),
    qa: makeQuestionPairs(summary, phrases),
    revision: [
      `${packTitle}: ${summary[0] || ''}`,
      ...summary.slice(1, 5),
      phrases.length ? `Key terms to remember: ${phrases.slice(0, 6).join(', ')}.` : '',
      'Exam check: explain the main points in your own words, then compare with the document.',
    ].filter(Boolean),
  };
};
