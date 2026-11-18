import { parseDueDate } from '../assignmentTrackerService.js';
import { aiStatus, askAi, asText } from './aiClient.js';
import { extractDeadlines } from './deadlineAgent.js';
import { describeMemory, getMemory, updateMemory } from './memoryAgent.js';
import { planStudy } from './plannerAgent.js';
import { generateQuiz, getPerformance } from './quizAgent.js';
import { answerQuestion, listDocuments, retrieve } from './ragAgent.js';
import { summarizeStudyMaterial } from './summarizerAgent.js';
import { tutorConcept } from './tutorAgent.js';

// Coordinator Agent: routes a student's message to one or more specialist
// agents, passes results between them (e.g. extracted deadlines feed the
// planner), and records a trace of every step.

export const AGENTS = [
  { id: 'planner', name: 'Study Planner Agent', description: 'Daily, weekly and monthly schedules, missed-task rescheduling, exam revision plans.' },
  { id: 'summarizer', name: 'Notes Summarizer Agent', description: 'Key points, flashcards, Q&A pairs and revision notes from notes, PDFs, slides and images.' },
  { id: 'deadlines', name: 'Assignment & Deadline Tracker Agent', description: 'Extracts deadlines from messages and documents and flags urgent or overdue work.' },
  { id: 'rag', name: 'Retrieval (RAG) Study Helper Agent', description: 'Grounded, page-referenced answers from your uploaded study library.' },
  { id: 'tutor', name: 'Concept Tutor Agent', description: 'Simple explanations, analogies, step-by-step solutions and practice exercises.' },
  { id: 'quiz', name: 'Revision & Quiz Agent', description: 'MCQ, short and long-answer quizzes with performance tracking and weak areas.' },
  { id: 'memory', name: 'Memory Agent', description: 'Remembers your subjects, mood, studied topics and weak areas to personalise every agent.' },
];

const AGENT_IDS = AGENTS.map((agent) => agent.id).filter((id) => id !== 'memory');

const PATTERNS = {
  deadlines: /\b(due|deadline|submit|submission)\b/i,
  planner: /\b(plan|schedule|timetable|routine|study plan)\b/i,
  quiz: /\b(quiz|mcq|test me|practice questions|question paper|mock test)\b/i,
  performance: /\b(weak (areas?|topics?)|my progress|my performance|how am i doing|my scores?|what should i revise|revise today|forgetting|fading)\b/i,
  summarizer: /\b(summari[sz]e|summary|flashcards?|key points|revision notes)\b/i,
  rag: /\b(my notes|my documents?|my library|uploaded|according to (my|the)|from (my|the) (notes|pdf|book|textbook|slides|document))\b/i,
  tutor: /\b(explain|what is|what are|how does|how do|why|solve|calculate|formula|derive|understand|teach me|example of|difference between)\b/i,
};

const extractTopic = (message) =>
  String(message)
    .replace(/\b(please|can you|could you|i want to|i need to|help me|for me)\b/gi, ' ')
    .replace(/\b(explain|teach me|what is|what are|how does|how do|tell me about|quiz me on|quiz me|make a quiz on|make a quiz|give me (a )?quiz on|test me on|questions on|mcqs? on|from my notes|from my documents?|according to my notes)\b/gi, ' ')
    .replace(/[?!.]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);

const extractExamDate = (message, today) => {
  const match = String(message).match(/\bexams?\b[^.]*?\b(?:on|is|by)?\s*([a-z]+\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+20\d{2})?|\d{1,2}[/-]\d{1,2}[/-]20\d{2}|\d{4}[-/]\d{1,2}[-/]\d{1,2}|tomorrow|next week)/i);
  return match ? parseDueDate(match[1], new Date(`${today}T00:00:00`)) : '';
};

const extractHours = (message) => {
  const match = String(message).match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b/i);
  return match ? Number(match[1]) : undefined;
};

const extractSubjects = (message) => {
  // "subjects: Maths, DBMS" or, more naturally, "a plan for DBMS and OS exams".
  const match = String(message).match(/\bsubjects?\s*(?:are|:|-)?\s*([^.]+)/i)
    || String(message).match(/\b(?:plan|schedule|timetable|routine)\b[^.]*?\b(?:for|on|covering)\s+(?:my\s+|the\s+)?([^.]+?)(?=\s+(?:exams?|tests?|finals?|mid-?terms?|semester|with|in\s+\d|by|from|starting|before|until|\d)\b|[.!?]|$)/i);
  if (!match) return [];
  return match[1]
    .split(/,|\band\b/i)
    .map((name) => name.trim())
    .filter((name) => name && name.length < 40 && !/\d|\b(me|myself|us|hours?|hrs?|exams?|days?|weeks?|months?|plans?|deadlines?|daily|weekly|monthly|semesters?|terms?|years?|finals?)\b/i.test(name))
    .map((name) => ({ name, priority: 3 }));
};

// "Java assignment" gives the subject "Java" when the student named no subjects.
const subjectsFromDeadlines = (assignments = []) =>
  assignments
    .map((item) => item.title.replace(/\b(assignments?|homework|projects?|labs?|reports?|records?|presentations?|submissions?)\b/gi, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map((name) => ({ name, priority: 3 }));

const ruleRoute = async ({ userId, message, attachmentText }) => {
  const intents = [];
  const add = (agent) => !intents.includes(agent) && intents.push(agent);

  if (PATTERNS.deadlines.test(message) && /\d|tomorrow|today|next week|\b(?:sun|mon|tues|wednes|thurs|fri|satur)day\b/i.test(message)) add('deadlines');
  if (PATTERNS.summarizer.test(message) && (attachmentText || message.length > 300)) add('summarizer');
  if (PATTERNS.quiz.test(message)) add('quiz');
  if (PATTERNS.performance.test(message)) add('performance');
  if (PATTERNS.planner.test(message)) add('planner');

  if (!intents.length || PATTERNS.rag.test(message) || PATTERNS.tutor.test(message)) {
    const asksLibrary = PATTERNS.rag.test(message);
    const hits = await retrieve({ userId, query: message, topK: 1 });
    const strongHit = hits[0] && hits[0].coverage >= 0.5;
    if (asksLibrary || (strongHit && !intents.length)) add('rag');
    if (!asksLibrary && (PATTERNS.tutor.test(message) || !intents.length)) add('tutor');
  }
  return intents;
};

const aiRoute = async ({ message, memoryText, libraryCount }) => {
  const ai = await askAi(
    [
      'You are the Coordinator Agent of a multi-agent study assistant. Decide which specialist agents should handle the student\'s message.',
      `Agents: ${AGENTS.filter((agent) => agent.id !== 'memory').map((agent) => `${agent.id} = ${agent.description}`).join('; ')}; performance = report quiz performance and weak areas.`,
      `The student has ${libraryCount} document(s) in their RAG library. Use "rag" only for questions about their own material.`,
      'Return ONLY valid JSON: {"intents": [agent ids in execution order], "topic": "main topic or empty", "reasoning": "one sentence"}.',
      'Put "deadlines" before "planner" when both apply so new deadlines are included in the plan.',
      'Use the fewest agents that answer the message, usually one. Add another only when the student clearly asks for it.',
      '',
      `Student memory:\n${memoryText}`,
      `Message: ${message}`,
    ].join('\n'),
    { maxTokens: 300 },
  );
  const intents = (Array.isArray(ai?.parsed?.intents) ? ai.parsed.intents : []).filter((id) => [...AGENT_IDS, 'performance'].includes(id));
  return intents.length ? { intents: [...new Set(intents)], topic: asText(ai.parsed.topic), reasoning: asText(ai.parsed.reasoning) } : null;
};

const runStep = async (agent, context) => {
  const { userId, message, attachmentText, today, topic, memory, state } = context;
  switch (agent) {
    case 'deadlines': {
      const result = await extractDeadlines({ text: attachmentText || message, today });
      state.assignments = result.assignments;
      return {
        result,
        reply: result.assignments.length
          ? `I found ${result.assignments.length} deadline(s): ${result.assignments.map((item) => `${item.title} (due ${item.dueDate}, ${item.status})`).join('; ')}. They have been added to your Assignment Tracker.`
          : 'I could not find a dated deadline in that message.',
      };
    }
    case 'planner': {
      let subjects = extractSubjects(message);
      if (!subjects.length && !memory.subjects.length) subjects = subjectsFromDeadlines(state.assignments);
      if (!subjects.length && !memory.subjects.length) {
        return { status: 'needs-input', reply: 'To build a plan I need your subjects. Try: "Make a weekly plan, subjects: Maths, Physics, DBMS, 3 hours a day, exam on December 5".' };
      }
      const result = await planStudy({
        userId,
        subjects,
        hoursPerDay: extractHours(message),
        planType: /\bmonth/i.test(message) ? 'monthly' : /\b(today|daily|day plan)\b/i.test(message) ? 'daily' : 'weekly',
        startDate: today,
        examDate: extractExamDate(message, today) || undefined,
        assignments: state.assignments || [],
      });
      return {
        result,
        reply: `Your ${result.planType} plan is ready: ${result.summary.totalTasks} sessions, ${Math.round(result.summary.totalMinutes / 60)} hours in total, ${result.sessionStyle.label.toLowerCase()} of ${result.sessionStyle.minutes} minutes.${result.memoryRevision.sessions.length ? ` It includes ${result.memoryRevision.sessions.length} memory revision session(s) before topics fade.` : ''}${result.examDate ? ` Exam-revision mode starts the week before ${result.examDate}.` : ''}`,
      };
    }
    case 'summarizer': {
      const result = await summarizeStudyMaterial({ userId, text: attachmentText || message, title: topic || 'Chat notes' });
      return { result, reply: `Here are the key points:\n${result.points.map((point) => `• ${point}`).join('\n')}` };
    }
    case 'rag': {
      const question = message.replace(new RegExp(PATTERNS.rag.source, 'gi'), ' ').replace(/\s+/g, ' ').trim();
      const result = await answerQuestion({ userId, question: question || message });
      return {
        result,
        status: result.grounded ? 'done' : 'no-evidence',
        reply: result.grounded
          ? `${result.answer}\n\nSources: ${result.citations.map((citation) => `${citation.documentName}${citation.page ? ` p.${citation.page}` : ''}`).join(', ')}`
          : result.answer,
      };
    }
    case 'tutor': {
      const isProblem = /\b(solve|calculate|find the value|compute)\b/i.test(message) || /\d\s*[-+*/^×÷]\s*\d/.test(message);
      const result = await tutorConcept({ userId, topic: isProblem ? message : topic || message, question: message, mode: isProblem ? 'problem' : 'explain' });
      const parts = [result.simpleExplanation, result.analogy ? `Analogy: ${result.analogy}` : '', result.finalAnswer ? `Answer: ${result.finalAnswer}` : ''];
      return { result, reply: parts.filter(Boolean).join('\n\n') || 'Open the Concept Tutor for a full explanation.' };
    }
    case 'quiz': {
      try {
        const result = await generateQuiz({ userId, topic: topic || message, text: attachmentText, count: 5 });
        return { result, reply: `I made a ${result.questions.length}-question quiz: "${result.title}". Open the Quiz page to take it.` };
      } catch (error) {
        return { status: 'needs-input', reply: error.message };
      }
    }
    case 'performance': {
      const result = await getPerformance(userId);
      return {
        result,
        reply: result.attempts
          ? `Across ${result.attempts} quiz attempt(s) your average is ${result.averageScore}%. ${result.weakTopics.length ? `Weak areas: ${result.weakTopics.join(', ')}.` : 'No weak areas right now.'} ${result.retention.dueNow.length ? `Revise now before you forget: ${result.retention.dueNow.join(', ')}.` : 'Nothing is fading from memory yet.'}`
          :'You have not taken any quizzes yet. Ask me to "quiz me on <topic>" to start.',
      };
    }
    default:
      return { status: 'skipped', reply: '' };
  }
};

export const handleMessage = async ({ userId, message, attachmentText = '', today, mood }) => {
  const cleanMessage = String(message || '').trim().slice(0, 4000);
  if (!cleanMessage) {
    const error = new Error('Type a message for the study agent.');
    error.status = 400;
    throw error;
  }
  const referenceDay = today || new Date().toISOString().slice(0, 10);
  if (mood) await updateMemory(userId, { mood });

  const [memory, documents] = await Promise.all([getMemory(userId), listDocuments(userId)]);
  const memoryText = describeMemory(memory);
  // A message with a clear keyword ("explain", "quiz me", "plan") is routed by
  // rules; asking the AI to route it would add a full AI round-trip.
  const clearIntent = Object.values(PATTERNS).some((pattern) => pattern.test(cleanMessage));
  const aiRouting = clearIntent ? null : await aiRoute({ message: cleanMessage, memoryText, libraryCount: documents.length });
  const intents = aiRouting?.intents || (await ruleRoute({ userId, message: cleanMessage, attachmentText }));
  if (intents.includes('deadlines') && intents.includes('planner')) {
    intents.sort((left, right) => (left === 'deadlines' ? -1 : right === 'deadlines' ? 1 : 0));
  }

  const context = {
    userId,
    message: cleanMessage,
    attachmentText,
    today: referenceDay,
    topic: aiRouting?.topic || extractTopic(cleanMessage),
    memory,
    state: {},
  };

  const steps = [];
  const results = {};
  const replies = [];
  const run = async (agent) => {
    const startedAt = Date.now();
    try {
      const outcome = await runStep(agent, context);
      return { agent, outcome, ms: Date.now() - startedAt };
    } catch (error) {
      return { agent, error, ms: Date.now() - startedAt };
    }
  };
  // Deadlines run first because the planner uses what they find; the other
  // agents are independent, so they run at the same time.
  const selected = intents.slice(0, 4);
  const first = selected.includes('deadlines') && selected.includes('planner') ? [await run('deadlines')] : [];
  const rest = await Promise.all(selected.filter((agent) => !first.some((item) => item.agent === agent)).map(run));
  for (const { agent, outcome, error, ms } of [...first, ...rest]) {
    if (error) {
      steps.push({ agent, status: 'error', error: error.message, ms });
      replies.push(`The ${agent} agent could not finish: ${error.message}`);
      continue;
    }
    steps.push({ agent, status: outcome.status || 'done', engine: outcome.result?.engine || null, ms });
    if (outcome.result) results[agent] = outcome.result;
    if (outcome.reply) replies.push(outcome.reply);
  }

  return {
    reply: replies.join('\n\n') || 'I am not sure how to help with that yet. Try asking me to explain a topic, plan your week, or quiz you.',
    routedBy: aiRouting ? 'ai' : 'rules',
    reasoning: aiRouting?.reasoning || `Matched intents: ${intents.join(', ')}`,
    steps,
    results,
    memory: { subjects: memory.subjects, weakTopics: memory.weakTopics, mood: memory.mood },
    ai: aiStatus(),
  };
};
