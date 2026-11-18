import { TARGET_RECALL, pickRevisionTopics, predictRecall } from './retentionService.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// Session length and style per mood (mood-based study recommendations).
const MOOD_PROFILES = {
  energized: { sessionMinutes: 50, label: 'Deep-work sessions', tip: 'You have energy today: tackle the hardest topic first in long, focused blocks.' },
  normal: { sessionMinutes: 30, label: 'Balanced sessions', tip: 'Alternate learning and practice blocks and take a 5-minute break after each session.' },
  tired: { sessionMinutes: 25, label: 'Short Pomodoro sessions', tip: 'Keep sessions short, start with light review, and stop for a proper break every 25 minutes.' },
  stressed: { sessionMinutes: 25, label: 'Gentle sessions', tip: 'Begin with a topic you already know to build confidence, and keep a list of what you finish.' },
};

const toDate = (value) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const startOfDay = (value) => {
  const date = toDate(value);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const formatDate = (date) => date.toISOString().slice(0, 10);

const normalizeSubjects = (subjects) =>
  (Array.isArray(subjects) ? subjects : [])
    .map((subject) => ({
      name: typeof subject?.name === 'string' ? subject.name.trim() : '',
      priority: Math.min(5, Math.max(1, Number(subject?.priority) || 3)),
    }))
    .filter((subject) => subject.name);

const matchesTopic = (subjectName, topic) => {
  const left = subjectName.toLowerCase();
  const right = String(topic).toLowerCase();
  return left.includes(right) || right.includes(left);
};

// Smooth weighted round-robin: higher-priority subjects get proportionally more
// sessions while still being interleaved with the others.
const createSubjectPicker = (subjects, weakTopics) => {
  const entries = subjects.map((subject) => ({
    subject,
    weight: subject.priority + (weakTopics.some((topic) => matchesTopic(subject.name, topic)) ? 2 : 0),
    current: 0,
  }));
  const totalWeight = entries.reduce((total, entry) => total + entry.weight, 0);

  return () => {
    let best = entries[0];
    for (const entry of entries) {
      entry.current += entry.weight;
      if (entry.current > best.current) best = entry;
    }
    best.current -= totalWeight;
    return best.subject;
  };
};

const buildTasks = ({ subjects, startDate, days, hoursPerDay, missedTaskIds = [], examDate, mood, weakTopics, assignments, memoryStates }) => {
  const profile = MOOD_PROFILES[mood] || MOOD_PROFILES.normal;
  // Topics the memory model tracks return when they are about to fade, so the
  // fixed weak-topic slots are only for the ones it does not track.
  const tracked = new Set(memoryStates.map((state) => state.topic.toLowerCase()));
  const otherWeakTopics = weakTopics.filter((topic) => !tracked.has(topic.toLowerCase()));
  const gentleFirst = mood === 'tired' || mood === 'stressed';
  const memorySessions = [];
  const taskCount = Math.max(1, Math.round((hoursPerDay * 60) / profile.sessionMinutes));
  const sessionMinutes = Math.max(20, Math.round((hoursPerDay * 60) / taskCount));
  const missed = new Set(missedTaskIds);
  const pickSubject = createSubjectPicker(subjects, weakTopics);
  const endDate = new Date(startDate.getTime() + (days - 1) * DAY_MS);
  const tasks = [];

  const pendingAssignments = assignments
    .filter((item) => item?.title && item?.dueDate && !item.completed)
    .map((item) => {
      const due = startOfDay(item.dueDate);
      const workDate = new Date(Math.max(startDate.getTime(), due.getTime() - DAY_MS));
      return { ...item, workDate: formatDate(workDate), due };
    })
    .filter((item) => item.due >= startDate && new Date(`${item.workDate}T00:00:00Z`) <= endDate);

  for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
    const date = new Date(startDate.getTime() + dayIndex * DAY_MS);
    const dateKey = formatDate(date);
    const isRevisionDay = Boolean(examDate) && date < examDate && date >= new Date(examDate.getTime() - 7 * DAY_MS);
    const dueWork = pendingAssignments.filter((item) => item.workDate === dateKey);
    const dayTasks = [];

    dueWork.forEach((item, index) => {
      dayTasks.push({
        id: `assignment-task-${dateKey}-${index}`,
        date: dateKey,
        subject: item.course || 'Assignment',
        type: 'Assignment',
        title: `Finish: ${item.title} (due ${item.dueDate})`,
        minutes: sessionMinutes,
        status: 'planned',
        priority: 5,
      });
    });

    const studySlots = Math.max(1, taskCount - dueWork.length);
    // More revision when energized or close to an exam, less on an assignment day,
    // and one slot is kept for normal study whenever the day has room.
    const revisionLimit = dueWork.length ? 1 : (mood === 'energized' ? 2 : 1) + (isRevisionDay ? 1 : 0);
    const revisions = pickRevisionTopics({
      states: memoryStates,
      date: dateKey,
      limit: Math.min(revisionLimit, Math.max(1, studySlots - 1)),
      gentleFirst,
    });

    for (let taskIndex = 0; taskIndex < studySlots; taskIndex += 1) {
      const taskId = `study-${dateKey}-${taskIndex}`;
      const isMissed = missed.has(taskId);
      const revision = revisions[taskIndex];
      if (revision) {
        const title = `Revise before you forget: ${revision.topic} (recall ${revision.recall}%)`;
        const revisionDate = isMissed ? new Date(date.getTime() + DAY_MS) : date;
        memorySessions.push({ date: formatDate(revisionDate), topic: revision.topic, recall: revision.recall });
        dayTasks.push({
          id: taskId,
          date: formatDate(revisionDate),
          subject: revision.topic,
          type: 'Memory revision',
          title: isMissed ? `Rescheduled: ${title}` : title,
          minutes: sessionMinutes,
          status: isMissed ? 'rescheduled' : 'planned',
          priority: 5,
        });
        continue;
      }

      const subject = pickSubject();
      const isWeakTopicSlot = otherWeakTopics.length > 0 && taskIndex === studySlots - 1 && dayIndex % 2 === 1;
      const weakTopic = isWeakTopicSlot ? otherWeakTopics[Math.floor(dayIndex / 2) % otherWeakTopics.length] : '';
      const isLightStart = gentleFirst && taskIndex === 0;
      const baseType = isRevisionDay ? 'Exam revision' : taskIndex % 2 === 0 ? 'Learn' : 'Practice';
      const type = weakTopic ? 'Weak topic' : isLightStart && !isRevisionDay ? 'Light review' : baseType;
      const scheduledDate = isMissed ? new Date(date.getTime() + DAY_MS) : date;

      let title = `${type} ${subject.name}`;
      if (weakTopic) title = `Strengthen weak topic: ${weakTopic}`;
      else if (isRevisionDay) title = `Revise ${subject.name} exam topics`;
      if (isMissed) title = `Rescheduled: ${title}`;

      dayTasks.push({
        id: taskId,
        date: formatDate(scheduledDate),
        subject: weakTopic ? weakTopic : subject.name,
        type,
        title,
        minutes: sessionMinutes,
        status: isMissed ? 'rescheduled' : 'planned',
        priority: weakTopic ? 5 : subject.priority,
      });
    }

    tasks.push(...dayTasks);
  }

  return { tasks, profile, sessionMinutes, memorySessions };
};

// Exam-focused revision plan for the final week before the exam.
const buildRevisionPlan = ({ examDate, startDate, subjects, weakTopics }) => {
  if (!examDate) return [];
  const ranked = [...subjects].sort((left, right) => right.priority - left.priority);
  const top = ranked.slice(0, Math.ceil(ranked.length / 2)).map((subject) => subject.name);
  const rest = ranked.slice(Math.ceil(ranked.length / 2)).map((subject) => subject.name);
  const weak = weakTopics.length ? weakTopics.join(', ') : 'topics you scored lowest on';
  const steps = {
    7: { focus: 'Map the syllabus', activities: ['List every exam topic per subject', 'Mark each topic as strong, okay or weak', 'Collect notes, formulas and past papers in one place'] },
    6: { focus: `Deep revision: ${top.join(', ') || 'highest-priority subjects'}`, activities: ['Re-read summaries and key points', 'Rewrite definitions and formulas from memory', 'Generate flashcards with the Notes Summarizer Agent'] },
    5: { focus: `Deep revision: ${rest.join(', ') || 'remaining subjects'}`, activities: ['Revise remaining subjects with active recall', 'Ask the Concept Tutor Agent about anything unclear'] },
    4: { focus: 'Practice and self-testing', activities: ['Take a quiz with the Revision & Quiz Agent', 'Solve one past paper section per subject'] },
    3: { focus: `Fix weak areas: ${weak}`, activities: ['Re-learn weak topics step by step', 'Do 5 practice questions per weak topic'] },
    2: { focus: 'Full timed mock exam', activities: ['Attempt a mock paper under exam timing', 'Review every mistake and note why it happened'] },
    1: { focus: 'Light review and rest', activities: ['Skim flashcards and formula sheets only', 'Prepare exam materials and sleep early'] },
  };

  const plan = [];
  for (let daysLeft = 7; daysLeft >= 1; daysLeft -= 1) {
    const date = new Date(examDate.getTime() - daysLeft * DAY_MS);
    if (date < startDate) continue;
    plan.push({ date: formatDate(date), daysLeft, ...steps[daysLeft] });
  }
  return plan;
};

const buildRecommendations = ({ subjects, weakTopics, profile, examDate, startDate, assignments, memorySessions }) => {
  const tips = [profile.tip];
  const top = [...subjects].sort((left, right) => right.priority - left.priority)[0];
  if (top) tips.push(`${top.name} has the highest priority, so it gets the most sessions in this plan.`);
  if (memorySessions.length) tips.push(`${memorySessions.length} memory revision session(s) are placed just before those topics are predicted to fade.`);
  if (weakTopics.length) tips.push(`Weak topics from your quiz results (${weakTopics.slice(0, 3).join(', ')}) are scheduled for extra review.`);
  if (examDate) {
    const daysLeft = Math.round((examDate - startDate) / DAY_MS);
    if (daysLeft >= 0) tips.push(`${daysLeft} day(s) until the exam. The final week switches to exam-revision mode.`);
  }
  const pending = assignments.filter((item) => item?.dueDate && !item.completed).length;
  if (pending) tips.push(`${pending} pending assignment(s) were added to the day before they are due.`);
  return tips;
};

export const createStudyPlan = (input = {}) => {
  const subjects = normalizeSubjects(input.subjects);
  if (!subjects.length) {
    const error = new Error('Add at least one subject to create a study plan.');
    error.status = 400;
    throw error;
  }

  const hoursPerDay = Math.min(12, Math.max(0.5, Number(input.hoursPerDay) || 2));
  const planType = ['daily', 'weekly', 'monthly'].includes(input.planType) ? input.planType : 'weekly';
  const days = planType === 'daily' ? 1 : planType === 'monthly' ? 30 : 7;
  const startDate = startOfDay(input.startDate || new Date());
  const examDate = input.examDate ? startOfDay(input.examDate) : null;
  const mood = MOOD_PROFILES[input.mood] ? input.mood : 'normal';
  const weakTopics = (Array.isArray(input.weakTopics) ? input.weakTopics : []).filter((topic) => typeof topic === 'string' && topic.trim()).slice(0, 8);
  const assignments = Array.isArray(input.assignments) ? input.assignments : [];
  // A copy, because planning moves each topic forward through the plan.
  const memoryStates = (Array.isArray(input.memoryStates) ? input.memoryStates : []).map((state) => ({ ...state }));
  const { tasks, profile, sessionMinutes, memorySessions } = buildTasks({
    subjects,
    startDate,
    days,
    hoursPerDay,
    missedTaskIds: input.missedTaskIds,
    examDate,
    mood,
    weakTopics,
    assignments,
    memoryStates,
  });
  // After the planned sessions, which topics would still be fading on exam day?
  const examRisks = examDate
    ? memoryStates
      .map((state) => ({ topic: state.topic, recall: Math.round(predictRecall(state, examDate.toISOString()) * 100) }))
      .filter((item) => item.recall < TARGET_RECALL * 100)
      .sort((left, right) => left.recall - right.recall)
    : [];

  const byDate = tasks.reduce((groups, task) => {
    groups[task.date] ||= [];
    groups[task.date].push(task);
    return groups;
  }, {});

  const subjectAllocations = subjects.map((subject) => {
    const subjectTasks = tasks.filter((task) => task.subject === subject.name);
    return {
      subject: subject.name,
      priority: subject.priority,
      sessions: subjectTasks.length,
      minutes: subjectTasks.reduce((total, task) => total + task.minutes, 0),
    };
  });
  const totalMinutes = tasks.reduce((total, task) => total + task.minutes, 0);

  return {
    planType,
    startDate: formatDate(startDate),
    examDate: examDate ? formatDate(examDate) : null,
    hoursPerDay,
    days,
    mood,
    sessionStyle: { label: profile.label, minutes: sessionMinutes },
    weakTopics,
    subjectAllocations: subjectAllocations.map((item) => ({
      ...item,
      share: totalMinutes ? Math.round((item.minutes / totalMinutes) * 100) : 0,
    })),
    schedule: Object.entries(byDate)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, dateTasks]) => ({ date, tasks: dateTasks })),
    revisionPlan: buildRevisionPlan({ examDate, startDate, subjects, weakTopics }),
    recommendations: buildRecommendations({ subjects, weakTopics, profile, examDate, startDate, assignments, memorySessions }),
    memoryRevision: {
      targetRecall: Math.round(TARGET_RECALL * 100),
      trackedTopics: memoryStates.length,
      sessions: memorySessions,
      examRisks,
    },
    summary: {
      totalTasks: tasks.length,
      totalMinutes,
      rescheduledTasks: tasks.filter((task) => task.status === 'rescheduled').length,
      assignmentTasks: tasks.filter((task) => task.type === 'Assignment').length,
    },
  };
};
