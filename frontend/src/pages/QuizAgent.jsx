import { useEffect, useState } from 'react';
import { Award, BrainCircuit, ClipboardCheck, ListChecks, RotateCcw, Target, TrendingUp } from 'lucide-react';
import EngineBadge from '../components/EngineBadge.jsx';
import { OPEN_QUIZ_EVENT, studyApi, useStudyUserId } from '../utils/studyApi.js';

const TYPE_LABELS = { mcq: 'Multiple choice', short: 'Short answer', long: 'Long answer' };

const scoreColor = (value) => (value >= 80 ? 'text-emerald-300' : value >= 60 ? 'text-amber-300' : 'text-rose-300');

export default function QuizAgent() {
  const userId = useStudyUserId();
  const [topic, setTopic] = useState('');
  const [material, setMaterial] = useState('');
  const [count, setCount] = useState(6);
  const [types, setTypes] = useState(['mcq', 'short', 'long']);
  const [difficulty, setDifficulty] = useState('medium');
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [grading, setGrading] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadPerformance = () => studyApi.get('/api/quiz/performance').then(setPerformance).catch(() => setPerformance(null));

  useEffect(() => {
    loadPerformance();
  }, [userId]);

  useEffect(() => {
    const openQuiz = (event) => {
      setQuiz(event.detail);
      setAnswers({});
      setGrading(null);
      setError('');
    };
    window.addEventListener(OPEN_QUIZ_EVENT, openQuiz);
    return () => window.removeEventListener(OPEN_QUIZ_EVENT, openQuiz);
  }, []);

  const toggleType = (type) => setTypes((current) => (current.includes(type) ? current.filter((item) => item !== type) : [...current, type]));

  const generate = async () => {
    setLoading(true);
    setError('');
    setGrading(null);
    setAnswers({});
    try {
      setQuiz(await studyApi.post('/api/quiz/generate', { topic, text: material, count, types, difficulty }));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await studyApi.post('/api/quiz/submit', { quizId: quiz.id, answers });
      setGrading(result);
      setPerformance(result.performance);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const resultFor = (id) => grading?.results.find((item) => item.id === id);

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-7xl">
        <header className="page-header mb-8">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300"><ClipboardCheck className="h-4 w-4" /> Revision & Quiz Agent</p>
          <h2 className="glow-text text-4xl font-black">Test yourself, find weak areas</h2>
          <p className="mt-3 max-w-2xl text-gray-300">Generate MCQs, short and long-answer questions from a topic, your notes, or your RAG library. Every attempt updates your topic-wise performance.</p>
        </header>

        <div className="grid gap-6 xl:grid-cols-[320px_1fr_300px]">
          <section className="glass-card h-fit rounded-3xl p-6">
            <h3 className="mb-4 text-lg font-bold">Customize quiz</h3>
            <label className="block text-sm text-gray-300">Topic
              <input value={topic} onChange={(event) => setTopic(event.target.value)} className="input-field mt-2 w-full rounded-xl px-3 py-2 text-white" placeholder="e.g. Normalization" />
            </label>
            <label className="mt-4 block text-sm text-gray-300">Material (optional)
              <textarea value={material} onChange={(event) => setMaterial(event.target.value)} className="input-field mt-2 min-h-28 w-full rounded-xl p-3 text-sm text-white" placeholder="Paste notes, or leave empty to use your RAG library" />
            </label>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="text-sm text-gray-300">Questions
                <input type="number" min="1" max="15" value={count} onChange={(event) => setCount(Number(event.target.value))} className="input-field mt-2 w-full rounded-xl px-3 py-2 text-white" />
              </label>
              <label className="text-sm text-gray-300">Difficulty
                <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)} className="input-field mt-2 w-full rounded-xl px-3 py-2 text-white"><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select>
              </label>
            </div>
            <div className="mt-4 space-y-2">
              {Object.entries(TYPE_LABELS).map(([type, label]) => <label key={type} className="flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" checked={types.includes(type)} onChange={() => toggleType(type)} /> {label}</label>)}
            </div>
            <button type="button" onClick={generate} disabled={loading || (!topic.trim() && !material.trim()) || !types.length} className="btn-primary mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold disabled:opacity-40"><ListChecks className="h-4 w-4" /> {loading && !quiz ? 'Building quiz...' : 'Generate quiz'}</button>
            {error ? <p className="mt-3 rounded-xl border border-rose-300/25 bg-rose-500/10 p-3 text-xs text-rose-100">{error}</p> : null}
          </section>

          <section className="glass-card rounded-3xl p-6">
            {!quiz ? (
              <div className="flex min-h-80 flex-col items-center justify-center text-center text-gray-400"><Target className="mb-3 h-10 w-10 text-emerald-300" /><p>Your quiz will appear here.</p></div>
            ) : (
              <div>
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div><h3 className="text-2xl font-bold">{quiz.title}</h3><p className="text-xs capitalize text-gray-400">{quiz.difficulty} · {quiz.questions.length} questions{quiz.sources?.length ? ` · from ${[...new Set(quiz.sources.map((source) => source.documentName))].join(', ')}` : ''}</p></div>
                  <EngineBadge engine={quiz.engine} />
                </div>
                {grading ? <div className="mb-5 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4"><p className="text-sm text-gray-300">Your score</p><p className={`text-4xl font-black ${scoreColor(grading.percentage)}`}>{grading.percentage}%</p><p className="text-xs text-gray-400">{grading.score} / {grading.total} points</p></div> : null}
                <div className="space-y-4">
                  {quiz.questions.map((question, index) => {
                    const result = resultFor(question.id);
                    return (
                      <article key={question.id} className={`rounded-2xl border p-4 ${result ? (result.correct ? 'border-emerald-300/30 bg-emerald-500/5' : 'border-rose-300/30 bg-rose-500/5') : 'border-white/10 bg-white/5'}`}>
                        <p className="mb-1 text-[11px] uppercase tracking-[0.14em] text-gray-500">{TYPE_LABELS[question.type]} · {question.topic}</p>
                        <p className="font-semibold">{index + 1}. {question.question}</p>
                        {question.type === 'mcq' ? (
                          <div className="mt-3 space-y-2">
                            {question.options.map((option, optionIndex) => (
                              <label key={option} className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm">
                                <input type="radio" name={`${quiz.id}-${question.id}`} disabled={Boolean(grading)} checked={answers[question.id] === optionIndex} onChange={() => setAnswers((current) => ({ ...current, [question.id]: optionIndex }))} /> {option}
                              </label>
                            ))}
                          </div>
                        ) : (
                          <textarea disabled={Boolean(grading)} value={answers[question.id] || ''} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} className={`input-field mt-3 w-full rounded-xl p-3 text-sm text-white ${question.type === 'long' ? 'min-h-32' : 'min-h-16'}`} placeholder="Write your answer..." />
                        )}
                        {result ? (
                          <div className="mt-3 border-t border-white/10 pt-3 text-sm">
                            <p className={result.correct ? 'text-emerald-200' : 'text-rose-200'}>{result.correct ? 'Correct' : 'Needs work'} · {Math.round(result.score * 100)}%</p>
                            <p className="mt-1 text-gray-300"><span className="text-gray-500">{question.type === 'mcq' ? 'Answer' : 'Model answer'}:</span> {result.correctAnswer}</p>
                            {result.feedback ? <p className="mt-1 text-xs text-gray-400">{result.feedback}</p> : null}
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
                <div className="mt-5 flex gap-3">
                  {!grading ? <button type="button" onClick={submit} disabled={loading} className="btn-primary flex-1 rounded-xl px-4 py-3 font-semibold disabled:opacity-40">{loading ? 'Grading...' : 'Submit answers'}</button> : null}
                  <button type="button" onClick={generate} disabled={loading || (!topic.trim() && !material.trim())} className="flex items-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-sm text-gray-200 disabled:opacity-40"><RotateCcw className="h-4 w-4" /> New quiz</button>
                </div>
              </div>
            )}
          </section>

          <aside className="glass-card h-fit rounded-3xl p-6">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-bold"><TrendingUp className="h-5 w-5 text-emerald-300" /> Performance</h3>
            {!performance?.attempts ? <p className="text-sm text-gray-400">Take a quiz to start tracking your performance.</p> : (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white/5 p-3"><p className="text-xs text-gray-400">Average</p><p className={`text-2xl font-bold ${scoreColor(performance.averageScore)}`}>{performance.averageScore}%</p></div>
                  <div className="rounded-xl bg-white/5 p-3"><p className="text-xs text-gray-400">Attempts</p><p className="text-2xl font-bold text-cyan-300">{performance.attempts}</p></div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">By topic</p>
                  <div className="space-y-2">
                    {performance.topics.slice(0, 8).map((item) => (
                      <div key={item.topic}>
                        <div className="flex justify-between text-xs"><span className="truncate pr-2">{item.topic}</span><span className={scoreColor(item.accuracy)}>{item.accuracy}%</span></div>
                        <div className="mt-1 h-1.5 rounded-full bg-white/10"><div className={`h-1.5 rounded-full ${item.accuracy >= 80 ? 'bg-emerald-400' : item.accuracy >= 60 ? 'bg-amber-400' : 'bg-rose-400'}`} style={{ width: `${item.accuracy}%` }} /></div>
                      </div>
                    ))}
                  </div>
                </div>
                {performance.retention?.topics.length ? (
                  <div>
                    <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300"><BrainCircuit className="h-3.5 w-3.5" /> Memory strength</p>
                    <div className="space-y-2">
                      {performance.retention.topics.slice(0, 6).map((item) => (
                        <button type="button" key={item.topic} onClick={() => setTopic(item.topic)} className="block w-full text-left" title="Quiz this topic">
                          <span className="flex justify-between text-xs"><span className="truncate pr-2">{item.topic}</span><span className={scoreColor(item.recall)}>{item.recall}%</span></span>
                          <span className="mt-0.5 block text-[11px] text-gray-400">{item.status === 'revise-now' ? 'Revise now' : `Revise by ${new Date(`${item.dueDate}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}</span>
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-[11px] text-gray-500">Predicted recall today. It falls over time and grows when you review.</p>
                  </div>
                ) : null}
                {performance.weakTopics.length ? <div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-rose-300">Weak areas</p><div className="flex flex-wrap gap-2">{performance.weakTopics.map((item) => <button type="button" key={item} onClick={() => setTopic(item)} className="rounded-full bg-rose-400/15 px-3 py-1 text-xs text-rose-100" title="Quiz this topic">{item}</button>)}</div></div> : null}
                {performance.strongTopics.length ? <div><p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300"><Award className="h-3.5 w-3.5" /> Strong</p><p className="text-xs text-gray-300">{performance.strongTopics.join(', ')}</p></div> : null}
                <ul className="space-y-1 text-xs text-gray-300">{performance.suggestions.map((item) => <li key={item}>• {item}</li>)}</ul>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
