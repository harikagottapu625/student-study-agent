import { createStudyPlan } from '../studyPlannerService.js';
import { askAi, asList } from './aiClient.js';
import { getMemory, updateMemory } from './memoryAgent.js';
import { getMemoryStates } from './quizAgent.js';

// Study Planner Agent: builds the schedule deterministically (so it is always
// valid), then asks the AI for personalised coaching tips on top of it. Topics
// the student has been quizzed on return just before they are predicted to fade.

export const planStudy = async ({ userId, ...input }) => {
  const memory = await getMemory(userId);
  const subjects = Array.isArray(input.subjects) && input.subjects.length ? input.subjects : memory.subjects;
  const weakTopics = Array.isArray(input.weakTopics) && input.weakTopics.length ? input.weakTopics : memory.weakTopics;
  const mood = input.mood || memory.mood;

  const memoryStates = await getMemoryStates(userId);
  const plan = createStudyPlan({ ...input, subjects, weakTopics, mood, memoryStates });

  const ai = await askAi(
    [
      'You are the Study Planner Agent, a supportive study coach.',
      'Given this study plan summary, return ONLY valid JSON with key "tips": an array of 3-5 short, specific, actionable tips for this student.',
      `Plan: ${plan.planType}, ${plan.hoursPerDay} hours/day, mood: ${plan.mood}, session style: ${plan.sessionStyle.label}`,
      `Subjects and share of time: ${plan.subjectAllocations.map((item) => `${item.subject} (priority ${item.priority}, ${item.share}%)`).join(', ')}`,
      `Exam date: ${plan.examDate || 'none'}; weak topics: ${plan.weakTopics.join(', ') || 'none'}; assignment tasks: ${plan.summary.assignmentTasks}`,
      `Topics about to fade from memory, already scheduled for revision: ${[...new Set(plan.memoryRevision.sessions.map((item) => item.topic))].join(', ') || 'none'}`,
    ].join('\n'),
    { maxTokens: 400 },
  );
  const aiTips = asList(ai?.parsed?.tips, 5);

  await updateMemory(userId, {
    subjects: plan.subjectAllocations.map((item) => ({ name: item.subject, priority: item.priority })),
    lastPlan: { createdAt: new Date().toISOString(), planType: plan.planType, examDate: plan.examDate, totalTasks: plan.summary.totalTasks },
  });

  return {
    ...plan,
    recommendations: aiTips.length ? aiTips : plan.recommendations,
    engine: aiTips.length ? 'ai' : 'rule-based',
  };
};
