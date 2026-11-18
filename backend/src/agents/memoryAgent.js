import { getRecord, saveRecord } from '../studyStore.js';

// Memory Agent: a small per-student profile every other agent reads from, so
// plans, explanations and quizzes are personalised across sessions.

const KIND = 'memory';
const RECORD_ID = 'profile';
const MOODS = ['energized', 'normal', 'tired', 'stressed'];

const emptyMemory = () => ({
  subjects: [],
  goals: '',
  mood: 'normal',
  topicsStudied: [],
  weakTopics: [],
  strongTopics: [],
  fadingTopics: [],
  lastPlan: null,
  updatedAt: null,
});

export const getMemory = async (userId) => ({ ...emptyMemory(), ...((await getRecord(KIND, userId, RECORD_ID)) || {}) });

export const updateMemory = async (userId, patch = {}) => {
  const current = await getMemory(userId);
  const next = { ...current, updatedAt: new Date().toISOString() };

  if (Array.isArray(patch.subjects)) {
    next.subjects = patch.subjects
      .map((subject) => (typeof subject === 'string' ? { name: subject, priority: 3 } : subject))
      .filter((subject) => subject?.name)
      .map((subject) => ({ name: String(subject.name).trim(), priority: Math.min(5, Math.max(1, Number(subject.priority) || 3)) }))
      .slice(0, 20);
  }
  if (typeof patch.goals === 'string') next.goals = patch.goals.slice(0, 500);
  if (MOODS.includes(patch.mood)) next.mood = patch.mood;
  if (Array.isArray(patch.weakTopics)) next.weakTopics = patch.weakTopics.slice(0, 15);
  if (Array.isArray(patch.strongTopics)) next.strongTopics = patch.strongTopics.slice(0, 15);
  if (Array.isArray(patch.fadingTopics)) next.fadingTopics = patch.fadingTopics.slice(0, 15);
  if (patch.lastPlan !== undefined) next.lastPlan = patch.lastPlan;

  await saveRecord({ kind: KIND, userId, recordId: RECORD_ID, data: next });
  return next;
};

export const noteTopic = async (userId, topic, source) => {
  const cleanTopic = String(topic || '').trim().slice(0, 120);
  if (!cleanTopic) return;
  const memory = await getMemory(userId);
  const topicsStudied = [
    { topic: cleanTopic, source, at: new Date().toISOString() },
    ...memory.topicsStudied.filter((item) => item.topic.toLowerCase() !== cleanTopic.toLowerCase()),
  ].slice(0, 30);
  await saveRecord({ kind: KIND, userId, recordId: RECORD_ID, data: { ...memory, topicsStudied, updatedAt: new Date().toISOString() } });
};

export const describeMemory = (memory) =>
  [
    memory.subjects.length ? `Subjects: ${memory.subjects.map((subject) => subject.name).join(', ')}` : '',
    memory.weakTopics.length ? `Weak topics: ${memory.weakTopics.join(', ')}` : '',
    memory.fadingTopics.length ? `Fading from memory: ${memory.fadingTopics.join(', ')}` : '',
    memory.topicsStudied.length ? `Recently studied: ${memory.topicsStudied.slice(0, 5).map((item) => item.topic).join(', ')}` : '',
    memory.mood && memory.mood !== 'normal' ? `Current mood: ${memory.mood}` : '',
    memory.goals ? `Goals: ${memory.goals}` : '',
  ]
    .filter(Boolean)
    .join('\n') || 'No saved study history yet.';
