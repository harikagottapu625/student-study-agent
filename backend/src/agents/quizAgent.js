import { randomBytes } from 'node:crypto';
import { getRecord, listRecords, saveRecord } from '../studyStore.js';
import { findTopic, topicAsText } from '../knowledgeBase.js';
import { splitSentences, supportRatio, tokenize } from '../ragEngine.js';
import { buildTopicStates, summarizeRetention } from '../retentionService.js';
import { askAi, asList, asText } from './aiClient.js';
import { getMemory, updateMemory } from './memoryAgent.js';
import { retrieve } from './ragAgent.js';

// Revision & Quiz Agent: generates MCQ / short / long-answer quizzes, grades
// submissions, and tracks per-topic performance to surface weak areas.

const QUIZ_KIND = 'quiz';
const ATTEMPT_KIND = 'quiz-attempt';
const TYPES = ['mcq', 'short', 'long'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];
const WEAK_THRESHOLD = 0.6;
const STRONG_THRESHOLD = 0.8;

const newId = (prefix) => `${prefix}-${Date.now()}-${randomBytes(3).toString('hex')}`;

const distributeCounts = (count, types) => {
  const counts = Object.fromEntries(types.map((type) => [type, 0]));
  for (let index = 0; index < count; index += 1) counts[types[index % types.length]] += 1;
  return counts;
};

const STOP = new Set('which these those their there about would could should other being where while after before because between through during within without'.split(' '));

const keywordsOf = (text, limit = 12) => {
  const counts = (String(text).match(/\b[A-Za-z][A-Za-z-]{4,}\b/g) || [])
    .map((word) => word.toLowerCase())
    .filter((word) => !STOP.has(word))
    .reduce((map, word) => map.set(word, (map.get(word) || 0) + 1), new Map());
  return [...counts.entries()].sort((left, right) => right[1] - left[1]).slice(0, limit).map(([word]) => word);
};

// Deterministic shuffle so the correct option is not always first.
const placeAnswer = (options, seed) => {
  const position = seed % options.length;
  const [answer, ...rest] = options;
  rest.splice(position, 0, answer);
  return { options: rest, answerIndex: position };
};

const ruleBasedQuestions = ({ material, topic, counts, readyShort = [] }) => {
  const sentences = splitSentences(material).filter((sentence) => sentence.length > 40 && sentence.length < 320);
  const keywords = keywordsOf(material);
  const questions = [];
  const used = new Set();

  const pick = (predicate) => {
    const found = sentences.find((sentence) => !used.has(sentence) && predicate(sentence));
    if (found) used.add(found);
    return found;
  };

  for (let index = 0; index < counts.mcq; index += 1) {
    const keyword = keywords[index % Math.max(1, keywords.length)];
    const sentence = keyword && pick((candidate) => new RegExp(`\\b${keyword}\\b`, 'i').test(candidate));
    if (!sentence) break;
    // Distractors must not appear in the question itself, or they give the answer away.
    const lowerSentence = sentence.toLowerCase();
    const candidates = keywords.filter((word) => word !== keyword && !lowerSentence.includes(word));
    const distractors = [...candidates.slice(index), ...candidates.slice(0, index)].slice(0, 3);
    while (distractors.length < 3) distractors.push(['definition', 'process', 'structure', 'function'][distractors.length]);
    const { options, answerIndex } = placeAnswer([keyword, ...distractors], index + 1);
    questions.push({
      type: 'mcq',
      question: `Fill in the blank: ${sentence.replace(new RegExp(`\\b${keyword}\\b`, 'i'), '_____')}`,
      options,
      answerIndex,
      explanation: sentence,
      topic: topic || keyword,
    });
  }

  for (let index = 0; index < counts.short; index += 1) {
    if (readyShort[index]) {
      const { question, answer } = readyShort[index];
      questions.push({ type: 'short', question, answer, keyPoints: [...new Set(tokenize(answer))].slice(0, 6), topic: topic || 'General' });
      continue;
    }
    const sentence = pick(() => true);
    if (!sentence) break;
    const keyword = keywords.find((word) => sentence.toLowerCase().includes(word)) || topic || 'this concept';
    questions.push({
      type: 'short',
      question: `In one or two sentences, what does your material say about "${keyword}"?`,
      answer: sentence,
      keyPoints: [...new Set(tokenize(sentence))].slice(0, 6),
      topic: topic || keyword,
    });
  }

  for (let index = 0; index < counts.long; index += 1) {
    const focus = keywords.slice(index * 3, index * 3 + 3);
    const supporting = sentences.filter((sentence) => focus.some((word) => sentence.toLowerCase().includes(word))).slice(0, 4);
    if (!supporting.length) break;
    questions.push({
      type: 'long',
      question: `Write a detailed answer on ${topic || focus[0]}, covering: ${focus.join(', ')}.`,
      answer: supporting.join(' '),
      keyPoints: focus,
      topic: topic || focus[0],
    });
  }

  return questions;
};

const normalizeAiQuestions = (value, fallbackTopic) =>
  (Array.isArray(value) ? value : [])
    .map((item) => {
      const type = TYPES.includes(item?.type) ? item.type : null;
      const question = asText(item?.question);
      if (!type || !question) return null;
      const topic = asText(item?.topic, fallbackTopic || 'General');
      if (type === 'mcq') {
        const options = asList(item.options, 6);
        const answerIndex = Number(item.answerIndex);
        if (options.length < 2 || !Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= options.length) return null;
        return { type, question, options, answerIndex, explanation: asText(item.explanation), topic };
      }
      const answer = asText(item?.answer);
      if (!answer) return null;
      return { type, question, answer, keyPoints: asList(item.keyPoints, 8), topic };
    })
    .filter(Boolean);

const publicQuiz = (quiz) => ({
  ...quiz,
  questions: quiz.questions.map(({ answerIndex, answer, explanation, keyPoints, ...question }) => question),
});

export const generateQuiz = async ({ userId, topic = '', text = '', documentIds, count = 6, types = TYPES, difficulty = 'medium' }) => {
  const cleanTopic = String(topic).trim().slice(0, 200);
  const safeTypes = (Array.isArray(types) ? types : TYPES).filter((type) => TYPES.includes(type));
  const questionTypes = safeTypes.length ? safeTypes : TYPES;
  const safeCount = Math.min(15, Math.max(1, Number(count) || 6));
  const safeDifficulty = DIFFICULTIES.includes(difficulty) ? difficulty : 'medium';
  const counts = distributeCounts(safeCount, questionTypes);

  let material = String(text || '').trim();
  let sources = [];
  let knowledgeEntry = null;
  if (!material && cleanTopic) {
    const hits = (await retrieve({ userId, query: cleanTopic, documentIds, topK: 6 })).filter((hit) => hit.coverage >= 0.5);
    sources = hits.map((hit) => ({ documentName: hit.documentName, page: hit.page }));
    material = hits.map((hit) => hit.text).join('\n');
  }
  // No matching notes: fall back to the built-in knowledge base for this topic.
  if (!material && cleanTopic) {
    knowledgeEntry = (await findTopic(cleanTopic)).topic;
    if (knowledgeEntry) {
      material = topicAsText(knowledgeEntry);
      sources = [{ documentName: `Built-in knowledge base: ${knowledgeEntry.title}`, page: null }];
    }
  }
  const quizTopic = knowledgeEntry?.title || cleanTopic;
  if (!material && !cleanTopic) {
    const error = new Error('Enter a topic or paste study material to build a quiz.');
    error.status = 400;
    throw error;
  }

  const memory = await getMemory(userId);
  const ai = await askAi(
    [
      'You are the Revision & Quiz Agent. Create an exam-style quiz.',
      `Difficulty: ${safeDifficulty}. Exactly ${counts.mcq || 0} mcq, ${counts.short || 0} short and ${counts.long || 0} long questions.`,
      'Return ONLY valid JSON with keys: title (string), questions (array).',
      'mcq question: {type:"mcq", question, options (4 strings), answerIndex (0-3), explanation, topic}',
      'short question: {type:"short", question, answer (1-2 sentences), keyPoints (2-4 strings), topic}',
      'long question: {type:"long", question, answer (model answer, 4-8 sentences), keyPoints (4-6 strings), topic}',
      'topic is a short sub-topic name used to track weak areas.',
      material ? 'Base every question strictly on the material below.' : `Base the questions on the topic: ${cleanTopic}.`,
      memory.weakTopics.length ? `The student is weak in: ${memory.weakTopics.join(', ')}. Include questions on these if relevant.` : '',
      memory.fadingTopics.length ? `These topics are fading from the student's memory: ${memory.fadingTopics.join(', ')}. Include questions on these if relevant.` : '',
      '',
      cleanTopic ? `Topic: ${cleanTopic}` : '',
      material ? `Material:\n${material.slice(0, 9000)}` : '',
    ].filter(Boolean).join('\n'),
    { maxTokens: 2200 },
  );

  let questions = normalizeAiQuestions(ai?.parsed?.questions, cleanTopic);
  let engine = 'ai';
  if (!questions.length) {
    engine = 'rule-based';
    questions = material ? ruleBasedQuestions({ material, topic: quizTopic, counts, readyShort: knowledgeEntry?.practice || [] }) : [];
  }
  if (!questions.length) {
    const error = new Error(material
      ? 'The material was too short to build questions from. Paste more notes.'
      : 'This topic is not in the built-in knowledge base and AI is offline. Paste notes, or add documents about it to your RAG library.');
    error.status = 422;
    throw error;
  }

  const quiz = {
    id: newId('quiz'),
    title: asText(ai?.parsed?.title, `${quizTopic || 'Study material'} quiz`),
    topic: quizTopic,
    difficulty: safeDifficulty,
    createdAt: new Date().toISOString(),
    engine,
    sources,
    questions: questions.map((question, index) => ({ ...question, id: `q${index + 1}` })),
  };
  await saveRecord({ kind: QUIZ_KIND, userId, recordId: quiz.id, data: quiz });
  return publicQuiz(quiz);
};

const keywordGrade = (question, response) => {
  const points = question.keyPoints.length ? question.keyPoints : [...new Set(tokenize(question.answer))].slice(0, 6);
  const responseTerms = new Set(tokenize(response));
  const covered = points.filter((point) => tokenize(point).some((term) => responseTerms.has(term)));
  const coverage = points.length ? covered.length / points.length : 0;
  const overlap = supportRatio(question.answer, response);
  const score = Math.min(1, Math.max(coverage, overlap * 0.9));
  const missing = points.filter((point) => !covered.includes(point));
  return {
    score: Math.round(score * 100) / 100,
    feedback: missing.length ? `Try to include: ${missing.join(', ')}.` : 'Good coverage of the key points.',
  };
};

const aiGrade = async (written) => {
  if (!written.length) return new Map();
  const ai = await askAi(
    [
      'You are grading a student\'s written quiz answers against model answers. Be fair: accept correct ideas phrased differently.',
      'Return ONLY valid JSON with key "grades": array of {id, score (0 to 1), feedback (one sentence)}.',
      '',
      ...written.map(({ question, response }) => `ID ${question.id}\nQuestion: ${question.question}\nModel answer: ${question.answer}\nKey points: ${question.keyPoints.join('; ')}\nStudent answer: ${response || '(blank)'}`),
    ].join('\n\n'),
    { maxTokens: 900 },
  );
  const grades = Array.isArray(ai?.parsed?.grades) ? ai.parsed.grades : [];
  return new Map(
    grades
      .filter((grade) => grade && Number.isFinite(Number(grade.score)))
      .map((grade) => [String(grade.id), { score: Math.min(1, Math.max(0, Number(grade.score))), feedback: asText(grade.feedback) }]),
  );
};

export const submitQuiz = async ({ userId, quizId, answers = {} }) => {
  const quiz = await getRecord(QUIZ_KIND, userId, quizId);
  if (!quiz) {
    const error = new Error('Quiz not found. Generate a new quiz and try again.');
    error.status = 404;
    throw error;
  }

  const written = quiz.questions
    .filter((question) => question.type !== 'mcq')
    .map((question) => ({ question, response: String(answers[question.id] ?? '').trim() }));
  const aiGrades = await aiGrade(written.filter((item) => item.response));

  const results = quiz.questions.map((question) => {
    const response = answers[question.id];
    if (question.type === 'mcq') {
      const correct = Number(response) === question.answerIndex;
      return {
        id: question.id,
        type: question.type,
        topic: question.topic,
        score: correct ? 1 : 0,
        correct,
        response,
        correctAnswer: question.options[question.answerIndex],
        feedback: question.explanation,
      };
    }
    const text = String(response ?? '').trim();
    const grade = !text ? { score: 0, feedback: 'No answer given.' } : aiGrades.get(question.id) || keywordGrade(question, text);
    return {
      id: question.id,
      type: question.type,
      topic: question.topic,
      score: grade.score,
      correct: grade.score >= WEAK_THRESHOLD,
      response: text,
      correctAnswer: question.answer,
      feedback: grade.feedback,
    };
  });

  const total = results.reduce((sum, result) => sum + result.score, 0);
  const attempt = {
    id: newId('attempt'),
    quizId,
    title: quiz.title,
    topic: quiz.topic,
    createdAt: new Date().toISOString(),
    percentage: Math.round((total / results.length) * 100),
    results: results.map(({ id, topic, score, type }) => ({ id, topic, score, type })),
  };
  await saveRecord({ kind: ATTEMPT_KIND, userId, recordId: attempt.id, data: attempt });
  const performance = await getPerformance(userId);

  return { attemptId: attempt.id, percentage: attempt.percentage, score: Math.round(total * 10) / 10, total: results.length, results, performance };
};

// The memory model's state for every quiz topic, used by the planner.
export const getMemoryStates = async (userId) => buildTopicStates(await listRecords(ATTEMPT_KIND, userId, { limit: 100 }));

// Predicted recall for each topic on the given day (today by default).
export const getRetention = async (userId, date) => summarizeRetention(await getMemoryStates(userId), date || undefined);

export const getPerformance = async (userId) => {
  const attempts = await listRecords(ATTEMPT_KIND, userId, { limit: 100 });
  const byTopic = new Map();
  for (const attempt of attempts) {
    for (const result of attempt.results || []) {
      const key = String(result.topic || attempt.topic || 'General').trim();
      const entry = byTopic.get(key.toLowerCase()) || { topic: key, questions: 0, total: 0 };
      entry.questions += 1;
      entry.total += Number(result.score) || 0;
      byTopic.set(key.toLowerCase(), entry);
    }
  }

  const topics = [...byTopic.values()]
    .map((entry) => ({ topic: entry.topic, questions: entry.questions, accuracy: Math.round((entry.total / entry.questions) * 100) }))
    .sort((left, right) => left.accuracy - right.accuracy);
  const weakTopics = topics.filter((entry) => entry.accuracy < WEAK_THRESHOLD * 100).map((entry) => entry.topic);
  const strongTopics = topics.filter((entry) => entry.accuracy >= STRONG_THRESHOLD * 100).map((entry) => entry.topic);
  const retention = summarizeRetention(buildTopicStates(attempts));
  await updateMemory(userId, { weakTopics, strongTopics, fadingTopics: retention.dueNow });

  const average = attempts.length ? Math.round(attempts.reduce((sum, attempt) => sum + attempt.percentage, 0) / attempts.length) : 0;
  return {
    attempts: attempts.length,
    averageScore: average,
    history: attempts.slice(0, 20).reverse().map((attempt) => ({ date: attempt.createdAt, title: attempt.title, percentage: attempt.percentage })),
    topics,
    weakTopics,
    strongTopics,
    retention,
    suggestions: [
      retention.dueNow.length ? `Fading from memory: ${retention.dueNow.slice(0, 3).join(', ')}. A short quiz now will make it last longer.` : '',
      ...weakTopics.slice(0, 3).map((topic) => `Revise "${topic}" with the Concept Tutor, then retake a quiz on it.`),
      weakTopics.length ? 'Your weak topics are added to your next study plan automatically.' : '',
      !attempts.length ? 'Take your first quiz to start tracking performance.' : '',
      attempts.length && !weakTopics.length ? 'No weak topics right now. Try a harder difficulty level.' : '',
    ].filter(Boolean),
  };
};
