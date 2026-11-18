import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TARGET_RECALL, applyReview, buildTopicStates, dueTime, pickRevisionTopics, predictRecall, summarizeRetention } from '../src/retentionService.js';
import { createStudyPlan } from '../src/studyPlannerService.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const START = '2026-11-02T10:00:00.000Z';
const daysLater = (days) => new Date(new Date(START).getTime() + days * DAY_MS).toISOString();
const attempt = (topic, score, at = START) => ({ createdAt: at, topic, results: [{ topic, score }] });
const subjects = [{ name: 'DBMS', priority: 3 }];

test('predicted recall falls with time and never rises by itself', () => {
  const state = applyReview(null, 0.9, START);
  const recalls = [0, 1, 3, 7, 30].map((days) => predictRecall(state, daysLater(days)));
  assert.equal(recalls[0], 0.9);
  recalls.slice(1).forEach((recall, index) => assert.ok(recall < recalls[index]));
});

test('a good review makes a memory last longer and a poor one shortens it', () => {
  const first = applyReview(null, 0.9, START);
  assert.ok(applyReview(first, 0.9, daysLater(2)).stability > first.stability);
  assert.ok(applyReview(first, 0.3, daysLater(2)).stability < first.stability);
});

test('a later successful review strengthens more than an early one (spacing effect)', () => {
  const first = applyReview(null, 0.9, START);
  assert.ok(applyReview(first, 0.9, daysLater(4)).stability > applyReview(first, 0.9, daysLater(1)).stability);
});

test('repeating a quiz the same day builds no lasting memory', () => {
  const first = applyReview(null, 0.9, START);
  assert.equal(applyReview(first, 1, daysLater(0.1)).stability, first.stability);
});

test('a strong topic is due on the first day recall reaches the target', () => {
  const state = applyReview(null, 1, START);
  const due = dueTime(state);
  assert.ok(predictRecall(state, new Date(due).toISOString()) <= TARGET_RECALL);
  assert.ok(predictRecall(state, new Date(due - DAY_MS).toISOString()) > TARGET_RECALL);
});

test('a failed topic comes back the next day', () => {
  const state = applyReview(null, 0.3, START);
  assert.equal(new Date(dueTime(state)).toISOString(), daysLater(1));
});

test('attempts are replayed oldest first whatever order they arrive in', () => {
  const late = attempt('Normalization', 0.2, daysLater(3));
  const early = attempt('Normalization', 0.9);
  assert.deepEqual(buildTopicStates([late, early]), buildTopicStates([early, late]));
});

test('topic names differing only by case are one topic', () => {
  const states = buildTopicStates([attempt('SQL Joins', 0.8), attempt('sql joins', 0.8, daysLater(2))]);
  assert.equal(states.length, 1);
  assert.equal(states[0].reviews, 2);
});

test('one quiz needs an early review, and the summary shows revise-now once it is overdue', () => {
  const states = buildTopicStates([attempt('Normalization', 1)]);
  assert.equal(summarizeRetention(states, START).topics[0].status, 'revise-soon');
  const later = summarizeRetention(states, daysLater(20));
  assert.equal(later.topics[0].status, 'revise-now');
  assert.deepEqual(later.dueNow, ['Normalization']);
});

test('a topic already below the target shows revise-now straight after a poor quiz', () => {
  const summary = summarizeRetention(buildTopicStates([attempt('Normalization', 0.25)]), START);
  assert.deepEqual(summary.dueNow, ['Normalization']);
});

test('repeated good reviews make a topic safe', () => {
  const states = buildTopicStates([attempt('Normalization', 1), attempt('Normalization', 1, daysLater(2)), attempt('Normalization', 1, daysLater(8))]);
  assert.equal(summarizeRetention(states, daysLater(8)).topics[0].status, 'safe');
});

test('tired students start with the strongest topic, others with the weakest', () => {
  const states = () => buildTopicStates([attempt('Strong', 1), attempt('Weak', 0.4)]);
  const date = daysLater(20).slice(0, 10);
  assert.equal(pickRevisionTopics({ states: states(), date, limit: 1, gentleFirst: false })[0].topic, 'Weak');
  assert.equal(pickRevisionTopics({ states: states(), date, limit: 1, gentleFirst: true })[0].topic, 'Strong');
});

test('the plan adds revision when a topic is due and none when it is safe', () => {
  const memoryStates = buildTopicStates([attempt('Normalization', 1)]);
  const plan = (startDate) => createStudyPlan({ subjects, hoursPerDay: 2, planType: 'daily', startDate, memoryStates }).memoryRevision.sessions;
  assert.equal(plan('2026-11-02').length, 0);
  assert.equal(plan('2026-11-22')[0].topic, 'Normalization');
});

test('a monthly plan returns to a topic at growing gaps', () => {
  const memoryStates = buildTopicStates([attempt('Normalization', 0.9)]);
  const { sessions } = createStudyPlan({ subjects, hoursPerDay: 2, planType: 'monthly', startDate: '2026-11-02', memoryStates }).memoryRevision;
  const gaps = sessions.slice(1).map((item, index) => (new Date(item.date) - new Date(sessions[index].date)) / DAY_MS);
  assert.ok(sessions.length >= 3);
  gaps.slice(1).forEach((gap, index) => assert.ok(gap >= gaps[index]));
});

test('planning does not change the states it was given', () => {
  const memoryStates = buildTopicStates([attempt('Normalization', 0.9)]);
  const before = structuredClone(memoryStates);
  createStudyPlan({ subjects, planType: 'monthly', startDate: '2026-11-02', memoryStates });
  assert.deepEqual(memoryStates, before);
});

test('energized students get more revision in a day than tired ones', () => {
  const memoryStates = buildTopicStates([attempt('A', 0.4), attempt('B', 0.5), attempt('C', 0.5)]);
  const sessions = (mood) => createStudyPlan({ subjects, hoursPerDay: 4, planType: 'daily', startDate: '2026-11-05', mood, memoryStates }).memoryRevision.sessions.length;
  assert.equal(sessions('energized'), 2);
  assert.equal(sessions('tired'), 1);
});

test('an assignment day allows only one revision session', () => {
  const memoryStates = buildTopicStates([attempt('A', 0.4), attempt('B', 0.5)]);
  const assignments = [{ title: 'Lab', dueDate: '2026-11-06' }];
  const plan = createStudyPlan({ subjects, hoursPerDay: 4, planType: 'daily', startDate: '2026-11-05', mood: 'energized', memoryStates, assignments });
  assert.equal(plan.memoryRevision.sessions.length, 1);
  assert.equal(plan.summary.assignmentTasks, 1);
});

test('the week before an exam allows one more revision session and reports risks', () => {
  const memoryStates = buildTopicStates([attempt('A', 0.4), attempt('B', 0.5), attempt('C', 0.5)]);
  const plan = createStudyPlan({ subjects, hoursPerDay: 4, planType: 'daily', startDate: '2026-11-05', examDate: '2026-11-08', memoryStates });
  assert.equal(plan.memoryRevision.sessions.length, 2);
  assert.ok(plan.memoryRevision.examRisks.length > 0);
});

test('a student with no quizzes gets a normal plan', () => {
  const plan = createStudyPlan({ subjects, hoursPerDay: 2, planType: 'weekly', startDate: '2026-11-02' });
  assert.equal(plan.memoryRevision.trackedTopics, 0);
  assert.equal(plan.schedule.flatMap((day) => day.tasks).filter((task) => task.type === 'Memory revision').length, 0);
});
