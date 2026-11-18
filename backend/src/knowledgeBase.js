import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { searchChunks, tokenize } from './ragEngine.js';

// Built-in knowledge base of syllabus topics used by the tutor and quiz agents
// (especially when AI is offline). Seed files live in backend/data/knowledge and
// are loaded into MongoDB, which then serves them; the files are the fallback.

const KnowledgeTopicSchema = new mongoose.Schema(
  {
    topicId: { type: String, required: true, unique: true },
    subject: { type: String, index: true },
    title: { type: String, required: true },
    aliases: { type: [String], default: [] },
    version: { type: Number, default: 1 },
    source: { type: String, default: 'builtin' },
    content: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, minimize: false },
);

export const KnowledgeTopic = mongoose.models.KnowledgeTopic || mongoose.model('KnowledgeTopic', KnowledgeTopicSchema);

const KB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'knowledge');
const CACHE_MS = 60 * 1000;
const isMongoReady = () => mongoose.connection.readyState === 1;

let fileTopics = null;
let cache = { at: 0, topics: null };

const loadFileTopics = async () => {
  if (fileTopics) return fileTopics;
  const files = (await readdir(KB_DIR)).filter((name) => name.endsWith('.json'));
  const groups = await Promise.all(files.map(async (name) => JSON.parse(await readFile(path.join(KB_DIR, name), 'utf8'))));
  fileTopics = groups.flat().map((topic) => ({ version: 1, source: 'builtin', ...topic }));
  return fileTopics;
};

const toDocument = ({ id, subject, title, aliases, version, source, ...content }) => ({
  topicId: id,
  subject,
  title,
  aliases,
  version: version || 1,
  source: source || 'builtin',
  content,
});

const fromDocument = (doc) => ({ id: doc.topicId, subject: doc.subject, title: doc.title, aliases: doc.aliases || [], version: doc.version, source: doc.source, ...(doc.content || {}) });

// Inserts new topics and updates built-in topics whose seed version is newer,
// so edits made directly in the database are kept.
export const seedKnowledgeBase = async () => {
  if (!isMongoReady()) return { inserted: 0, updated: 0 };
  const topics = await loadFileTopics();
  const existing = new Map((await KnowledgeTopic.find({}, { topicId: 1, version: 1, source: 1 }).lean()).map((doc) => [doc.topicId, doc]));
  const operations = [];
  let inserted = 0;
  let updated = 0;

  for (const topic of topics) {
    const current = existing.get(topic.id);
    if (!current) {
      operations.push({ insertOne: { document: toDocument(topic) } });
      inserted += 1;
    } else if (current.source === 'builtin' && (current.version || 1) < (topic.version || 1)) {
      operations.push({ updateOne: { filter: { topicId: topic.id }, update: { $set: toDocument(topic) } } });
      updated += 1;
    }
  }

  if (operations.length) await KnowledgeTopic.bulkWrite(operations, { ordered: false });
  cache = { at: 0, topics: null };
  return { inserted, updated, total: topics.length };
};

const loadTopics = async () => {
  if (cache.topics && Date.now() - cache.at < CACHE_MS) return cache.topics;
  let topics = [];
  if (isMongoReady()) {
    topics = (await KnowledgeTopic.find({}).lean()).map(fromDocument);
  }
  if (!topics.length) topics = await loadFileTopics();
  cache = { at: Date.now(), topics };
  return topics;
};

const normalize = (value) => String(value || '').toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9'+#/.*\s-]/g, ' ').replace(/\s+/g, ' ').trim();

const LEADING = /^(please\s+|can you\s+|could you\s+|what\s+(is|are|was|were|does|do)\s+|what's\s+|whats\s+|explain\s+(me\s+)?|define\s+|describe\s+|tell\s+me\s+(about\s+)?|meaning\s+of\s+|definition\s+of\s+|how\s+(does|do|is|are)\s+|why\s+(is|are|do|does)\s+|teach\s+me\s+(about\s+)?|help\s+me\s+(understand|with)\s+|i\s+want\s+to\s+(learn|know)\s+(about\s+)?|introduction\s+to\s+|basics\s+of\s+|concept\s+of\s+|about\s+|the\s+|an?\s+)/;
const TRAILING = /(\s+(in\s+(simple|easy|layman'?s?)\s+(words|terms|language))|\s+with\s+(an?\s+)?(real[- ]life\s+)?examples?|\s+(please|briefly|in\s+detail|simply|for\s+beginners|for\s+exams?)|\s+works?|\s+mean)$/;

// "what is dbms?" -> "dbms"; "explain normalization with example" -> "normalization"
export const extractTopicPhrase = (query) => {
  let phrase = normalize(query).replace(/[?.!]+$/g, '').trim();
  for (let index = 0; index < 4; index += 1) {
    const next = phrase.replace(LEADING, '').replace(TRAILING, '').trim();
    if (next === phrase) break;
    phrase = next;
  }
  return phrase || normalize(query);
};

const containsPhrase = (haystack, needle) => needle && new RegExp(`(^|\\s)${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`).test(haystack);

export const findTopic = async (query, { minCoverage = 0.6 } = {}) => {
  const topics = await loadTopics();
  const phrase = extractTopicPhrase(query);
  if (!phrase) return { topic: null, suggestions: [] };

  const exact = topics.find((topic) => [topic.id, topic.title, ...topic.aliases].some((name) => normalize(name) === phrase));
  if (exact) return { topic: exact, matchedBy: 'alias', suggestions: [] };

  // "normalization in dbms": the subject comes before "in"; the rest is only context.
  const subject = phrase.match(/^(.+?)\s+in\s+.+$/)?.[1];
  const subjectExact = subject && topics.find((topic) => [topic.id, topic.title, ...topic.aliases].some((name) => normalize(name) === subject));
  if (subjectExact) return { topic: subjectExact, matchedBy: 'alias', suggestions: [] };

  // Score aliases that appear as whole phrases (longer aliases win) plus BM25 relevance.
  const aliasScores = new Map(topics.map((topic) => [
    topic.id,
    Math.max(0, ...[topic.title, ...topic.aliases].map((alias) => normalize(alias)).filter((alias) => alias.length > 1 && containsPhrase(phrase, alias)).map((alias) => alias.split(' ').length)),
  ]));
  const documents = topics.map((topic) => ({
    id: topic.id,
    text: [topic.title, topic.title, topic.aliases.join(' '), topic.aliases.join(' '), topic.simpleExplanation, (topic.keyPoints || []).join(' ')].join(' '),
  }));
  const hits = searchChunks(documents, phrase, { topK: topics.length });
  const maxScore = hits[0]?.score || 1;
  const ranked = topics
    .map((topic) => {
      const hit = hits.find((item) => item.id === topic.id);
      const relevance = hit ? hit.score / maxScore : 0;
      return { topic, alias: aliasScores.get(topic.id) || 0, coverage: hit?.coverage || 0, score: (aliasScores.get(topic.id) || 0) * 2 + relevance };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score);

  const best = ranked[0];
  const confident = best && (best.alias > 0 || best.coverage >= minCoverage);
  return {
    topic: confident ? best.topic : null,
    matchedBy: confident ? (best.alias > 0 ? 'alias' : 'search') : null,
    suggestions: ranked.slice(confident ? 1 : 0, confident ? 4 : 5).map((item) => item.topic.title),
  };
};

// What a specific question asks for: "advantages of ...", "types of ...", "X vs Y".
const INTENT_WORDS = /\b(advantages?|disadvantages?|benefits?|limitations?|drawbacks?|types?|kinds?|applications?|uses|examples?|difference|steps?|phases?|stages?|components?|architecture|layers?|works?|working|how|why|features?|characteristics?|history|father|prevent|handle|avoid|issues?|challenges?|principles?|assumptions?|operators?|services?|equivalents?|skills?|roadmap|salary|salaries|become|responsibility|responsibilities|tools?|levels?|certifications?)\b/gi;
const intentsOf = (text) => new Set([...String(text).toLowerCase().matchAll(INTENT_WORDS)].map(([word]) =>
  word.replace(/ies$/, 'y').replace(/s$/, '').replace(/^working$/, 'work')));
const asDifference = (text) => String(text).replace(/\b(vs\.?|versus|compared?\s+(to|with)|comparison(\s+of|\s+between)?|differentiate(\s+between)?|differences)\b/gi, ' difference ');

// Specific questions ("advantages of cloud computing", "bagging vs boosting")
// are answered from the topics' FAQ entries. A plain "what is X" has no intent
// word, so it still gets the topic's full explanation.
export const findFaq = async (query) => {
  const question = asDifference(query);
  const wanted = intentsOf(question);
  if (!wanted.size) return null;
  const topics = await loadTopics();
  // The topic's names are searched with each FAQ, so "applications of
  // artificial intelligence" finds the FAQ written as "applications of AI".
  const documents = topics.flatMap((topic) => (topic.faq || []).map((item, index) => ({
    id: `${topic.id}#${index}`,
    topic,
    item,
    text: [item.question, topic.title, ...topic.aliases].join(' '),
  })));
  if (!documents.length) return null;
  // Prefer the FAQ whose own question the student asked most fully.
  const accepted = searchChunks(documents, question, { topK: 12 })
    .map((hit) => {
      const questionTerms = [...new Set(tokenize(hit.item.question))];
      const matched = new Set(hit.matchedTerms);
      return { ...hit, questionCoverage: questionTerms.filter((term) => matched.has(term)).length / Math.max(questionTerms.length, 1) };
    })
    .filter((hit) => [...intentsOf(hit.item.question)].some((intent) => wanted.has(intent)) && hit.coverage >= 0.6 && hit.questionCoverage >= 0.5)
    .sort((left, right) => right.questionCoverage - left.questionCoverage || right.score - left.score);
  const [best] = accepted;
  if (!best) return null;
  // "Advantages and disadvantages of AI" asks two things: add the same topic's
  // FAQ for the intent the first answer does not cover.
  const covered = intentsOf(best.item.question);
  const second = accepted.find((hit) => hit !== best && hit.topic.id === best.topic.id
    && [...intentsOf(hit.item.question)].some((intent) => wanted.has(intent) && !covered.has(intent)));
  const faq = second
    ? { question: `${best.item.question} ${second.item.question}`, answer: `${best.item.answer}\n\n${second.item.answer}` }
    : best.item;
  return { topic: best.topic, faq };
};

export const listTopics = async () =>
  (await loadTopics())
    .map(({ id, title, subject }) => ({ id, title, subject }))
    .sort((left, right) => left.subject.localeCompare(right.subject) || left.title.localeCompare(right.title));

export const countTopics = async () => (await loadTopics()).length;

// Plain-text version of a topic, used as quiz material.
export const topicAsText = (topic) =>
  [
    topic.simpleExplanation,
    ...(topic.keyPoints || []).map((point) => `${point.replace(/\.$/, '')}.`),
    ...(topic.steps || []).map((step) => `${step.replace(/\.$/, '')}.`),
    ...(topic.examples || []).map((example) => `${example.replace(/\.$/, '')}.`),
    ...(topic.faq || []).map((item) => item.answer),
  ].join(' ');
