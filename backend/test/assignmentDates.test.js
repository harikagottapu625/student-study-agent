import test from 'node:test';
import assert from 'node:assert/strict';
import { extractAssignments, parseDueDate } from '../src/assignmentTrackerService.js';

const tuesday = new Date('2026-11-03T00:00:00');

test('a weekday means the coming one', () => {
  assert.equal(parseDueDate('Friday', tuesday), '2026-11-06');
  assert.equal(parseDueDate('this Friday', tuesday), '2026-11-06');
  assert.equal(parseDueDate('Monday', tuesday), '2026-11-09');
});

test('today\'s weekday means a week from now', () => {
  assert.equal(parseDueDate('Tuesday', tuesday), '2026-11-10');
});

test('next Friday is the Friday of the following week', () => {
  assert.equal(parseDueDate('next Friday', tuesday), '2026-11-13');
});

test('a weekday deadline is found in a plain sentence', () => {
  const [assignment] = extractAssignments({ text: 'I have a Java assignment due Friday. Prepare a study plan for me.', today: '2026-11-03' });
  assert.equal(assignment.dueDate, '2026-11-06');
  assert.equal(assignment.status, 'upcoming');
});

test('day-first and short month names are dates', () => {
  assert.equal(parseDueDate('6 Nov', tuesday), '2026-11-06');
  assert.equal(parseDueDate('6nov', tuesday), '2026-11-06');
  assert.equal(parseDueDate('6th November 2026', tuesday), '2026-11-06');
  assert.equal(parseDueDate('Nov 6', tuesday), '2026-11-06');
  assert.equal(parseDueDate('Sept 14', tuesday), '2026-09-14');
  assert.equal(parseDueDate('November 6', tuesday), '2026-11-06');
});

test('a day-first deadline is found in a plain sentence', () => {
  for (const text of ['I have a Java assignment due 6nov. Prepare a study plan for me.', 'I have a Java assignment due 6 Nov. Prepare a study plan for me.']) {
    const [assignment] = extractAssignments({ text, today: '2026-11-03' });
    assert.equal(assignment?.dueDate, '2026-11-06', text);
  }
});

test('a number before a non-month word is not a date', () => {
  assert.deepEqual(extractAssignments({ text: 'Lab record due 3 hours after class.', today: '2026-11-03' }), []);
});

test('a sentence without a date gives no deadline', () => {
  assert.deepEqual(extractAssignments({ text: 'Prepare a study plan for Friends of Java.', today: '2026-11-03' }), []);
});
