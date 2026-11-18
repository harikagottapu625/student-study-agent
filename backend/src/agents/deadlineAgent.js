import { randomBytes } from 'node:crypto';
import { extractAssignments, updateAssignmentStatuses } from '../assignmentTrackerService.js';
import { askAi, asText } from './aiClient.js';

// Assignment & Deadline Tracker Agent: AI extraction from free-form messages
// (WhatsApp notices, emails, documents) merged with the pattern-based extractor.

const ISO_DATE = /^20\d{2}-\d{2}-\d{2}$/;
const TYPES = ['assignment', 'exam', 'project', 'quiz', 'lab', 'presentation', 'other'];

const formatToday = (today) => today || new Date().toISOString().slice(0, 10);
const uniqueId = (dueDate) => `assignment-${dueDate}-${randomBytes(4).toString('hex')}`;
const normalizeTitle = (title) => title.toLowerCase().replace(/[^a-z0-9]/g, '');

const isValidDate = (value) => ISO_DATE.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime());

export const extractDeadlines = async ({ text, today }) => {
  const referenceDay = formatToday(today);
  const ruleBased = extractAssignments({ text, today: referenceDay }).map((item) => ({
    ...item,
    title: item.title.replace(/^(?:i|we)(?:\s+have|'ve)(?:\s+got)?\s+(?!to\b)(?:an?\s+)?/i, '').replace(/^(my|our|the)\s+/i, '').replace(/\s+\b(is|are|was|will be|has to be|should be|must be)\s*$/i, '').trim() || item.title,
    id: uniqueId(item.dueDate),
    type: 'assignment',
    course: '',
  }));
  const weekday = new Date(`${referenceDay}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long' });

  const ai = await askAi(
    [
      'You are the Assignment & Deadline Tracker Agent.',
      `Today is ${weekday}, ${referenceDay}. Resolve relative dates like "tomorrow", "next Friday" or "end of this week" against today.`,
      'Extract every assignment, exam, project, quiz, lab or presentation that has a due date from the message below.',
      'Return ONLY valid JSON with key "assignments": an array of objects {title, dueDate (YYYY-MM-DD), course, type, sourceText}.',
      `type must be one of: ${TYPES.join(', ')}. Use an empty string for course if unknown. Skip items without a date.`,
      '',
      String(text).slice(0, 8000),
    ].join('\n'),
    { maxTokens: 900 },
  );

  const aiItems = (Array.isArray(ai?.parsed?.assignments) ? ai.parsed.assignments : [])
    .map((item) => ({
      title: asText(item?.title).slice(0, 140),
      dueDate: asText(item?.dueDate),
      course: asText(item?.course).slice(0, 80),
      type: TYPES.includes(item?.type) ? item.type : 'assignment',
      source: asText(item?.sourceText, 'Extracted by AI').slice(0, 300),
    }))
    .filter((item) => item.title && isValidDate(item.dueDate))
    .map((item) => ({ ...item, id: uniqueId(item.dueDate), completed: false }));

  const seen = new Set(aiItems.map((item) => `${item.dueDate}|${normalizeTitle(item.title)}`));
  const merged = [
    ...aiItems,
    ...ruleBased.filter((item) => {
      const sameDay = aiItems.filter((aiItem) => aiItem.dueDate === item.dueDate);
      const duplicate = seen.has(`${item.dueDate}|${normalizeTitle(item.title)}`)
        || sameDay.some((aiItem) => normalizeTitle(aiItem.title).includes(normalizeTitle(item.title)) || normalizeTitle(item.title).includes(normalizeTitle(aiItem.title)));
      return !duplicate;
    }),
  ];

  return {
    assignments: updateAssignmentStatuses(merged, referenceDay),
    engine: aiItems.length ? 'ai' : 'rule-based',
  };
};
