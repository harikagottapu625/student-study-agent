import { useEffect, useMemo, useState } from 'react';
import { BrainCircuit, CalendarDays, CheckCircle2, Clock3, GraduationCap, Lightbulb, RefreshCw, Sparkles, Target } from 'lucide-react';
import EngineBadge from '../components/EngineBadge.jsx';
import { loadTrackedAssignments, studyApi } from '../utils/studyApi.js';

const today = new Date().toISOString().slice(0, 10);
const COMPLETED_KEY = 'study-agent-completed-tasks';

const TYPE_STYLE = {
  Assignment: 'bg-amber-400/15 text-amber-100',
  'Exam revision': 'bg-rose-400/15 text-rose-100',
  'Weak topic': 'bg-purple-400/15 text-purple-100',
  'Memory revision': 'bg-cyan-400/15 text-cyan-100',
  'Light review': 'bg-emerald-400/15 text-emerald-100',
};

const loadCompleted = () => {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(COMPLETED_KEY) || '[]'));
  } catch {
    return new Set();
  }
};

export default function StudyPlanner() {
  const [subjects, setSubjects] = useState([
    { name: 'Mathematics', priority: 4 },
    { name: 'Programming', priority: 5 },
  ]);
  const [hoursPerDay, setHoursPerDay] = useState(2);
  const [planType, setPlanType] = useState('weekly');
  const [startDate, setStartDate] = useState(today);
  const [examDate, setExamDate] = useState('');
  const [mood, setMood] = useState('normal');
  const [includeDeadlines, setIncludeDeadlines] = useState(true);
  const [plan, setPlan] = useState(null);
  const [missedTaskIds, setMissedTaskIds] = useState([]);
  const [completed, setCompleted] = useState(loadCompleted);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      window.localStorage.setItem(COMPLETED_KEY, JSON.stringify([...completed].slice(-500)));
    } catch {
      // Progress still works for this session without storage.
    }
  }, [completed]);

  const generatePlan = async (nextMissedTaskIds = missedTaskIds) => {
    setLoading(true);
    setError('');
    try {
      const nextPlan = await studyApi.post('/api/study-planner', {
        subjects,
        hoursPerDay,
        planType,
        startDate,
        examDate: examDate || undefined,
        mood,
        missedTaskIds: nextMissedTaskIds,
        assignments: includeDeadlines ? loadTrackedAssignments() : [],
      });
      setPlan(nextPlan);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleMissed = (taskId) => {
    const nextMissed = missedTaskIds.includes(taskId)
      ? missedTaskIds.filter((id) => id !== taskId)
      : [...missedTaskIds, taskId];
    setMissedTaskIds(nextMissed);
    if (plan) generatePlan(nextMissed);
  };

  const toggleDone = (taskId) => {
    setCompleted((current) => {
      const next = new Set(current);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const updateSubject = (index, field, value) => {
    setSubjects((current) => current.map((subject, subjectIndex) => (
      subjectIndex === index
        ? { ...subject, [field]: field === 'priority' ? Number(value) : value }
        : subject
    )));
  };

  const progress = useMemo(() => {
    if (!plan) return null;
    const tasks = plan.schedule.flatMap((day) => day.tasks);
    const todayTasks = tasks.filter((task) => task.date === today);
    const doneCount = (list) => list.filter((task) => completed.has(task.id)).length;
    return {
      done: doneCount(tasks),
      total: tasks.length,
      todayDone: doneCount(todayTasks),
      todayTotal: todayTasks.length,
      minutesDone: tasks.filter((task) => completed.has(task.id)).reduce((total, task) => total + task.minutes, 0),
    };
  }, [plan, completed]);

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl">
        <header className="page-header mb-8">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300"><Sparkles className="h-4 w-4" /> Study Planner Agent</p>
          <h2 className="glow-text text-4xl font-black">A study plan that adapts with you</h2>
          <p className="mt-3 max-w-2xl text-gray-300">Daily, weekly or monthly schedules weighted by subject priority. Deadlines from your tracker and weak topics from your quizzes are included automatically, and the week before your exam becomes a revision plan.</p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <section className="glass-card h-fit rounded-3xl p-6">
            <h3 className="mb-5 text-xl font-bold">Plan settings</h3>
            <label className="mb-4 block text-sm text-gray-300">Plan range
              <select className="input-field mt-2 w-full rounded-xl px-3 py-2 text-white" value={planType} onChange={(event) => setPlanType(event.target.value)}>
                <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
              </select>
            </label>
            <label className="mb-4 block text-sm text-gray-300">Start date
              <input type="date" className="input-field mt-2 w-full rounded-xl px-3 py-2 text-white" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </label>
            <label className="mb-4 block text-sm text-gray-300">Hours per day
              <input type="number" min="0.5" max="12" step="0.5" className="input-field mt-2 w-full rounded-xl px-3 py-2 text-white" value={hoursPerDay} onChange={(event) => setHoursPerDay(event.target.value)} />
            </label>
            <label className="mb-4 block text-sm text-gray-300">Exam date (optional)
              <input type="date" className="input-field mt-2 w-full rounded-xl px-3 py-2 text-white" value={examDate} onChange={(event) => setExamDate(event.target.value)} />
            </label>
            <label className="mb-4 block text-sm text-gray-300">How are you feeling?
              <select className="input-field mt-2 w-full rounded-xl px-3 py-2 text-white" value={mood} onChange={(event) => setMood(event.target.value)}>
                <option value="energized">Energized: long deep-work sessions</option>
                <option value="normal">Normal: balanced sessions</option>
                <option value="tired">Tired: short Pomodoro sessions</option>
                <option value="stressed">Stressed: gentle start</option>
              </select>
            </label>
            <label className="mb-5 flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" checked={includeDeadlines} onChange={(event) => setIncludeDeadlines(event.target.checked)} /> Include deadlines from Assignment Tracker</label>
            <div className="mb-5">
              <div className="mb-2 flex items-center justify-between"><span className="text-sm text-gray-300">Subjects</span><button type="button" className="text-xs text-cyan-300" onClick={() => setSubjects([...subjects, { name: '', priority: 3 }])}>+ Add subject</button></div>
              <div className="space-y-2">
                {subjects.map((subject, index) => (
                  <div className="flex gap-2" key={index}>
                    <input aria-label={`Subject ${index + 1}`} className="input-field min-w-0 flex-1 rounded-xl px-3 py-2 text-sm text-white" placeholder="Subject" value={subject.name} onChange={(event) => updateSubject(index, 'name', event.target.value)} />
                    <select aria-label={`Priority for subject ${index + 1}`} className="input-field w-20 rounded-xl px-2 py-2 text-sm text-white" value={subject.priority} onChange={(event) => updateSubject(index, 'priority', event.target.value)}><option value="5">High</option><option value="4">Med+</option><option value="3">Med</option><option value="1">Low</option></select>
                  </div>
                ))}
              </div>
            </div>
            <button type="button" onClick={() => generatePlan()} disabled={loading} className="btn-primary flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold disabled:opacity-50"><CalendarDays className="h-4 w-4" /> {loading ? 'Building plan...' : 'Generate study plan'}</button>
            {error ? <p className="mt-3 rounded-xl border border-rose-300/30 bg-rose-500/10 p-3 text-xs text-rose-100">{error}</p> : null}
          </section>

          <section className="space-y-6">
            {!plan ? <div className="glass-card flex min-h-[420px] items-center justify-center rounded-3xl p-8 text-center text-gray-400">Set your subjects and generate a personalized schedule.</div> : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="glass-card rounded-2xl p-4"><p className="text-xs text-gray-400">Planned sessions</p><p className="mt-1 text-2xl font-bold text-cyan-300">{plan.summary.totalTasks}</p></div>
                  <div className="glass-card rounded-2xl p-4"><p className="text-xs text-gray-400">Study time</p><p className="mt-1 text-2xl font-bold text-purple-300">{Math.round(plan.summary.totalMinutes / 60)}h</p></div>
                  <div className="glass-card rounded-2xl p-4"><p className="text-xs text-gray-400">Completed</p><p className="mt-1 text-2xl font-bold text-emerald-300">{progress.done}/{progress.total}</p></div>
                  <div className="glass-card rounded-2xl p-4"><p className="text-xs text-gray-400">Rescheduled</p><p className="mt-1 text-2xl font-bold text-amber-300">{plan.summary.rescheduledTasks}</p></div>
                </div>

                <div className="glass-card rounded-3xl p-6">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="flex items-center gap-2 text-lg font-bold"><Target className="h-5 w-5 text-emerald-300" /> Daily progress</h3>
                    <EngineBadge engine={plan.engine} />
                  </div>
                  <p className="text-sm text-gray-300">Today: {progress.todayDone}/{progress.todayTotal} sessions done · {Math.round(progress.minutesDone / 6) / 10}h studied in this plan · {plan.sessionStyle.label} ({plan.sessionStyle.minutes} min)</p>
                  <div className="mt-3 h-2 rounded-full bg-white/10"><div className="h-2 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} /></div>
                </div>

                {plan.recommendations?.length ? (
                  <div className="glass-card rounded-3xl p-6">
                    <h3 className="mb-3 flex items-center gap-2 text-lg font-bold"><Lightbulb className="h-5 w-5 text-amber-300" /> Agent recommendations</h3>
                    <ul className="space-y-2 text-sm text-gray-300">{plan.recommendations.map((tip) => <li key={tip}>• {tip}</li>)}</ul>
                  </div>
                ) : null}

                {plan.memoryRevision?.trackedTopics ? (
                  <div className="glass-card rounded-3xl p-6">
                    <h3 className="mb-2 flex items-center gap-2 text-lg font-bold"><BrainCircuit className="h-5 w-5 text-cyan-300" /> Forgetting-aware revision</h3>
                    <p className="text-sm text-gray-300">
                      {plan.memoryRevision.sessions.length
                        ? `${plan.memoryRevision.sessions.length} session(s) added from your quiz results, each just before predicted recall falls below ${plan.memoryRevision.targetRecall}%.`
                        : `All ${plan.memoryRevision.trackedTopics} quiz topic(s) stay above ${plan.memoryRevision.targetRecall}% recall during this plan, so no revision is needed yet.`}
                    </p>
                    {plan.memoryRevision.sessions.length ? (
                      <ul className="mt-3 space-y-1 text-sm text-gray-300">
                        {plan.memoryRevision.sessions.slice(0, 6).map((item) => (
                          <li key={`${item.date}-${item.topic}`} className="flex justify-between gap-3"><span className="truncate">• {item.topic}</span><span className="whitespace-nowrap text-cyan-200">{new Date(`${item.date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {item.recall}% recall</span></li>
                        ))}
                      </ul>
                    ) : null}
                    {plan.memoryRevision.examRisks.length ? <p className="mt-3 rounded-xl border border-amber-300/25 bg-amber-400/10 p-3 text-xs text-amber-100">Predicted to be below target on exam day: {plan.memoryRevision.examRisks.slice(0, 5).map((item) => `${item.topic} (${item.recall}%)`).join(', ')}. Add time to these topics.</p> : null}
                  </div>
                ) : null}

                <div className="glass-card rounded-3xl p-6">
                  <h3 className="mb-4 flex items-center gap-2 text-xl font-bold"><Clock3 className="h-5 w-5 text-cyan-300" /> Time allocation per subject</h3>
                  <div className="grid gap-3 sm:grid-cols-2">{plan.subjectAllocations.map((item) => <div key={item.subject} className="rounded-xl border border-white/10 bg-white/5 p-3"><div className="flex justify-between text-sm"><span>{item.subject}</span><span className="text-cyan-200">{Math.round(item.minutes / 60 * 10) / 10}h · {item.share}%</span></div><div className="mt-2 h-2 rounded-full bg-white/10"><div className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-purple-400" style={{ width: `${item.share}%` }} /></div></div>)}</div>
                  {plan.weakTopics?.length ? <p className="mt-3 text-xs text-purple-200">Extra review for weak topics: {plan.weakTopics.join(', ')}</p> : null}
                </div>

                {plan.revisionPlan?.length ? (
                  <div className="glass-card rounded-3xl p-6">
                    <h3 className="mb-4 flex items-center gap-2 text-xl font-bold"><GraduationCap className="h-5 w-5 text-rose-300" /> Exam revision plan</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {plan.revisionPlan.map((day) => (
                        <div key={day.date} className="rounded-xl border border-rose-300/15 bg-rose-500/5 p-4">
                          <p className="text-xs text-rose-200">{day.daysLeft} day(s) before · {new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                          <p className="mt-1 font-semibold">{day.focus}</p>
                          <ul className="mt-2 space-y-1 text-xs text-gray-300">{day.activities.map((activity) => <li key={activity}>• {activity}</li>)}</ul>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="space-y-3">{plan.schedule.map((day) => (
                  <div className="glass-card rounded-2xl p-5" key={day.date}>
                    <h3 className="mb-3 font-bold text-cyan-100">{new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</h3>
                    <div className="space-y-2">{day.tasks.map((task) => {
                      const done = completed.has(task.id);
                      return (
                        <div key={task.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
                          <button type="button" onClick={() => toggleDone(task.id)} aria-label={done ? `Mark ${task.title} not done` : `Mark ${task.title} done`}><CheckCircle2 className={`h-5 w-5 ${done ? 'text-emerald-300' : 'text-gray-600'}`} /></button>
                          <span className="flex-1">
                            <span className={`font-medium ${done ? 'text-gray-500 line-through' : ''}`}>{task.title}</span>
                            <span className="ml-2 text-xs text-gray-400">{task.minutes} min</span>
                            {TYPE_STYLE[task.type] ? <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${TYPE_STYLE[task.type]}`}>{task.type}</span> : null}
                            {task.status === 'rescheduled' ? <span className="ml-2 text-xs text-amber-300"><RefreshCw className="mr-1 inline h-3 w-3" />rescheduled</span> : null}
                          </span>
                          {!done && task.id.startsWith('study-') ? <button type="button" onClick={() => toggleMissed(task.id)} className={`rounded-lg border px-2 py-1 text-[11px] ${missedTaskIds.includes(task.id) ? 'border-amber-300/40 text-amber-200' : 'border-white/15 text-gray-400 hover:text-amber-200'}`}>{missedTaskIds.includes(task.id) ? 'Undo missed' : 'Missed'}</button> : null}
                        </div>
                      );
                    })}</div>
                  </div>
                ))}</div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
