// Forgetting-aware revision: an Ebbinghaus-style memory model for each quiz topic.
// Predicted recall = mastery × e^(−days since review ÷ stability). Stability is how
// many days a memory lasts: it grows after a good review, most of all when the review
// came late (the spacing effect), and shrinks after a poor one.
// The model uses no AI, so it gives the same answer every time and works offline.
const DAY_MS = 24 * 60 * 60 * 1000;

export const TARGET_RECALL = 0.7;
const INITIAL_STABILITY = 2;
const MAX_STABILITY = 180;
const PASS_SCORE = 0.6;
// A planned session is assumed to go about this well when looking further ahead.
const PLANNED_REVIEW_SCORE = 0.8;
const SOON_DAYS = 3;

const toTime = (value) => {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? Date.now() : time;
};
const toDateKey = (time) => new Date(time).toISOString().slice(0, 10);
const daysBetween = (from, to) => Math.max(0, (toTime(to) - toTime(from)) / DAY_MS);
const percent = (value) => Math.round(value * 100);

export const predictRecall = (state, at) => state.mastery * Math.exp(-daysBetween(state.lastReviewed, at) / state.stability);

// The state after one review with a score from 0 to 1.
export const applyReview = (state, score, at) => {
  const time = toDateKey(toTime(at)) === at ? `${at}T00:00:00Z` : at;
  if (!state) {
    return { mastery: score, stability: INITIAL_STABILITY * (0.5 + score), lastReviewed: time, reviews: 1 };
  }
  const mastery = 0.6 * score + 0.4 * state.mastery;
  const base = { ...state, mastery, lastReviewed: time, reviews: state.reviews + 1 };
  // Repeating a quiz the same day shows what is known now but builds no lasting memory.
  if (daysBetween(state.lastReviewed, time) < 0.5) return base;
  const recall = predictRecall(state, time);
  const stability = score >= PASS_SCORE
    ? state.stability * (1 + 1.5 * score * (2 - recall))
    : state.stability * 0.6;
  return { ...base, stability: Math.min(MAX_STABILITY, Math.max(1, stability)) };
};

// The day recall is predicted to reach the target. A topic already below it comes back the next day.
export const dueTime = (state) => {
  const days = state.mastery > TARGET_RECALL ? state.stability * Math.log(state.mastery / TARGET_RECALL) : 1;
  return toTime(state.lastReviewed) + Math.max(1, Math.ceil(days)) * DAY_MS;
};

// One memory state per topic, replaying quiz attempts from oldest to newest.
export const buildTopicStates = (attempts = []) => {
  const topics = new Map();
  const ordered = [...attempts].sort((left, right) => toTime(left.createdAt) - toTime(right.createdAt));
  for (const attempt of ordered) {
    const scores = new Map();
    for (const result of attempt.results || []) {
      const name = String(result.topic || attempt.topic || 'General').trim();
      const entry = scores.get(name.toLowerCase()) || { name, total: 0, count: 0 };
      entry.total += Number(result.score) || 0;
      entry.count += 1;
      scores.set(name.toLowerCase(), entry);
    }
    for (const [key, { name, total, count }] of scores) {
      const current = topics.get(key);
      topics.set(key, { topic: current?.topic || name, ...applyReview(current, total / count, attempt.createdAt) });
    }
  }
  return [...topics.values()];
};

const statusOf = (state, due, at) => {
  const days = Math.ceil((due - toTime(at)) / DAY_MS);
  if (days <= 0 || predictRecall(state, at) < TARGET_RECALL) return 'revise-now';
  return days <= SOON_DAYS ? 'revise-soon' : 'safe';
};

export const summarizeRetention = (states, at = new Date().toISOString()) => {
  const topics = states
    .map((state) => {
      const due = dueTime(state);
      return {
        topic: state.topic,
        recall: percent(predictRecall(state, at)),
        mastery: percent(state.mastery),
        stabilityDays: Math.round(state.stability * 10) / 10,
        reviews: state.reviews,
        lastReviewed: toDateKey(toTime(state.lastReviewed)),
        dueDate: toDateKey(due),
        status: statusOf(state, due, at),
      };
    })
    .sort((left, right) => left.recall - right.recall);
  return {
    targetRecall: percent(TARGET_RECALL),
    topics,
    dueNow: topics.filter((item) => item.status === 'revise-now').map((item) => item.topic),
    dueSoon: topics.filter((item) => item.status === 'revise-soon').map((item) => item.topic),
    averageRecall: topics.length ? Math.round(topics.reduce((total, item) => total + item.recall, 0) / topics.length) : 0,
  };
};

// Chooses the topics to revise on one day and moves each one forward as if it was
// revised, so a longer plan brings it back again at a wider gap. Tired or stressed
// students start with the topics they know best; otherwise the weakest come first.
export const pickRevisionTopics = ({ states, date, limit, gentleFirst }) => {
  const dateKey = toDateKey(toTime(date));
  const due = states
    .filter((state) => toDateKey(dueTime(state)) <= dateKey)
    .map((state) => ({ state, recall: predictRecall(state, date) }))
    .sort((left, right) => (gentleFirst ? right.recall - left.recall : left.recall - right.recall))
    .slice(0, limit);
  for (const { state } of due) Object.assign(state, applyReview(state, PLANNED_REVIEW_SCORE, dateKey));
  return due.map(({ state, recall }) => ({ topic: state.topic, recall: percent(recall) }));
};
