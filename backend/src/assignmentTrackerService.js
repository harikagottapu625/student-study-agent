const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
// Full or short month names: "November", "Nov", "Sept".
const MONTH_NAME = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const pad = (value) => String(value).padStart(2, '0');
const formatDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const parseDueDate = (value, today) => {
  const iso = value.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (iso) return `${iso[1]}-${pad(iso[2])}-${pad(iso[3])}`;

  const dayMonth = value.match(/\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b/);
  if (dayMonth) return formatDate(new Date(Number(dayMonth[3]), Number(dayMonth[2]) - 1, Number(dayMonth[1])));

  // "November 6", "Nov 6th, 2026", or day first: "6 Nov", "6th November", "6nov".
  const monthDay = value.match(new RegExp(`\\b(${MONTH_NAME})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(20\\d{2}))?\\b`, 'i'));
  const dayFirst = monthDay ? null : value.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:of\\s+)?(${MONTH_NAME})\\b\\.?(?:,?\\s+(20\\d{2}))?`, 'i'));
  if (monthDay || dayFirst) {
    const [month, day, year] = monthDay ? [monthDay[1], monthDay[2], monthDay[3]] : [dayFirst[2], dayFirst[1], dayFirst[3]];
    return formatDate(new Date(Number(year || today.getFullYear()), MONTHS.indexOf(month.toLowerCase().slice(0, 3)), Number(day)));
  }

  const relative = value.match(/\b(today|tomorrow|next week)\b/i);
  if (relative) {
    const date = new Date(today);
    if (relative[1].toLowerCase() === 'tomorrow') date.setDate(date.getDate() + 1);
    if (relative[1].toLowerCase() === 'next week') date.setDate(date.getDate() + 7);
    return formatDate(date);
  }

  // "Friday" and "this Friday" mean the coming one; "next Friday" the week after.
  const weekday = value.match(/\b(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);
  if (weekday) {
    const date = new Date(today);
    const daysAhead = (WEEKDAYS.indexOf(weekday[2].toLowerCase()) - date.getDay() + 7) % 7 || 7;
    date.setDate(date.getDate() + daysAhead + (weekday[1] ? 7 : 0));
    return formatDate(date);
  }

  return '';
};

const statusFor = (dueDate, completed, today) => {
  if (completed) return 'completed';
  const due = new Date(`${dueDate}T23:59:59`);
  const days = Math.ceil((due - today) / 86400000);
  if (days < 0) return 'overdue';
  if (days <= 2) return 'urgent';
  return 'upcoming';
};

export const extractAssignments = ({ text = '', today: todayValue } = {}) => {
  const referenceDate = new Date(`${todayValue || formatDate(new Date())}T00:00:00`);
  const lines = String(text)
    .split(/\r?\n|(?<=[.!?])\s+/)
    .map((line) => line.replace(/^[-*•\d.)\s]+/, '').trim())
    .filter(Boolean);
  const assignments = [];

  for (const line of lines) {
    const dateMatch = line.match(/\b(?:due|deadline|submit|submission|by|on)\b[\s:,-]*(?:date\s*)?(?:is\s*)?(?:on\s*)?([a-z]+\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+20\d{2})?|\d{1,2}(?:st|nd|rd|th)?\s*(?:of\s+)?[a-z]{3,9}\.?(?:,?\s+20\d{2})?|\d{1,2}[/-]\d{1,2}[/-]20\d{2}|\d{4}[-/]\d{1,2}[-/]\d{1,2}|today|tomorrow|next week|(?:next\s+|this\s+)?(?:sun|mon|tues|wednes|thurs|fri|satur)day)\b/i);
    if (!dateMatch) continue;
    const dueDate = parseDueDate(dateMatch[1], referenceDate);
    if (!dueDate) continue;
    let title = line
      .replace(/\b(?:due|deadline|submit|submission|by|on)\b[\s:,-]*(?:date\s*)?(?:is\s*)?(?:on\s*)?.*$/i, '')
      .replace(/[:\-–]\s*$/, '')
      .trim() || 'Assignment';
    if (title === 'Assignment' && /^(?:submit|submission)\b/i.test(line)) {
      title = line
        .replace(/^(?:submit|submission)\b\s*(?:the\s+)?/i, '')
        .replace(/\s+\b(?:by|due|deadline|on)\b.*$/i, '')
        .trim() || title;
    }
    assignments.push({
      id: `assignment-${dueDate}-${assignments.length + 1}`,
      title: title.slice(0, 140),
      dueDate,
      source: line,
      completed: false,
      status: statusFor(dueDate, false, referenceDate),
    });
  }

  return assignments;
};

export const updateAssignmentStatuses = (assignments = [], todayValue) => {
  const referenceDate = new Date(`${todayValue || formatDate(new Date())}T00:00:00`);
  return assignments.map((assignment) => ({
    ...assignment,
    status: statusFor(assignment.dueDate, Boolean(assignment.completed), referenceDate),
  }));
};
