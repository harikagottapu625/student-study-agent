import { useEffect, useState } from 'react';
import { BookOpen, Calculator, GraduationCap, Lightbulb, ShieldCheck, Sparkles, Volume2 } from 'lucide-react';
import EngineBadge from '../components/EngineBadge.jsx';
import { studyApi } from '../utils/studyApi.js';

const LEVELS = ['beginner', 'intermediate', 'advanced'];

function Block({ title, children, tone = 'cyan' }) {
  const tones = {
    cyan: 'border-cyan-300/15 bg-cyan-500/5 text-cyan-200',
    purple: 'border-purple-300/15 bg-purple-500/5 text-purple-200',
    amber: 'border-amber-300/15 bg-amber-400/5 text-amber-200',
    emerald: 'border-emerald-300/15 bg-emerald-500/5 text-emerald-200',
    rose: 'border-rose-300/15 bg-rose-500/5 text-rose-200',
  };
  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em]">{title}</p>
      <div className="text-sm leading-relaxed text-gray-200">{children}</div>
    </div>
  );
}

export default function ConceptTutor() {
  const [knownTopics, setKnownTopics] = useState([]);
  const [topic, setTopic] = useState('');
  const [mode, setMode] = useState('explain');
  const [level, setLevel] = useState('beginner');
  const [useNotes, setUseNotes] = useState(true);
  const [result, setResult] = useState(null);
  const [revealed, setRevealed] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    studyApi.get('/api/knowledge/topics').then((data) => setKnownTopics(data.topics || [])).catch(() => setKnownTopics([]));
  }, []);

  const topicsBySubject = knownTopics.reduce((groups, item) => {
    (groups[item.subject] ||= []).push(item);
    return groups;
  }, {});

  const ask = async (nextTopic = topic, nextMode = mode) => {
    if (!nextTopic.trim()) return;
    setTopic(nextTopic);
    setMode(nextMode);
    setLoading(true);
    setError('');
    setRevealed({});
    try {
      setResult(await studyApi.post('/api/tutor/explain', { topic: nextTopic, mode: nextMode, level, useNotes }));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const readAloud = () => {
    if (!result || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const text = [result.title, result.directAnswer?.answer, result.simpleExplanation, result.analogy, ...result.steps, result.finalAnswer].filter(Boolean).join('. ');
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  };

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl">
        <header className="page-header mb-8">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-purple-300"><GraduationCap className="h-4 w-4" /> Concept Tutor Agent</p>
          <h2 className="glow-text text-4xl font-black">Understand difficult topics</h2>
          <p className="mt-3 max-w-2xl text-gray-300">Simple explanations, analogies, step-by-step solutions for numeric problems and formulas, and practice exercises. Problem solutions are double-checked by a reviewer step.</p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <section className="glass-card h-fit rounded-3xl p-6">
            <div className="mb-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setMode('explain')} className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${mode === 'explain' ? 'bg-purple-500/25 text-purple-100' : 'border border-white/10 text-gray-400'}`}><Lightbulb className="h-4 w-4" /> Explain</button>
              <button type="button" onClick={() => setMode('problem')} className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${mode === 'problem' ? 'bg-purple-500/25 text-purple-100' : 'border border-white/10 text-gray-400'}`}><Calculator className="h-4 w-4" /> Solve</button>
            </div>
            <label className="block text-sm text-gray-300">{mode === 'explain' ? 'Topic or question' : 'Numeric problem or formula'}
              <textarea value={topic} onChange={(event) => setTopic(event.target.value)} className="input-field mt-2 min-h-28 w-full rounded-2xl p-4 text-sm text-white" placeholder={mode === 'explain' ? 'e.g. Recursion, Ohm\'s law, normalization in DBMS' : 'e.g. A car travels at 60 km/h for 2.5 hours. Find the distance.'} />
            </label>
            <label className="mt-4 block text-sm text-gray-300">Level
              <select value={level} onChange={(event) => setLevel(event.target.value)} className="input-field mt-2 w-full rounded-xl px-3 py-2 capitalize text-white">
                {LEVELS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="mt-4 flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" checked={useNotes} onChange={(event) => setUseNotes(event.target.checked)} /> Use my RAG library notes</label>
            <button type="button" onClick={() => ask()} disabled={loading || !topic.trim()} className="btn-primary mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold disabled:opacity-40"><Sparkles className="h-4 w-4" /> {loading ? 'Tutor is thinking...' : mode === 'explain' ? 'Explain it simply' : 'Solve step by step'}</button>
            {error ? <p className="mt-3 rounded-xl border border-rose-300/25 bg-rose-500/10 p-3 text-xs text-rose-100">{error}</p> : null}
          </section>

          <section className="glass-card rounded-3xl p-6">
            {!result ? (
              <div>
                <div className="flex flex-col items-center py-8 text-center text-gray-400"><BookOpen className="mb-3 h-10 w-10 text-purple-300" /><p>Your explanation will appear here.</p></div>
                {knownTopics.length ? (
                  <div className="border-t border-white/10 pt-5">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">{knownTopics.length} topics the tutor can always explain, even offline</p>
                    <div className="space-y-3">
                      {Object.entries(topicsBySubject).map(([subject, items]) => (
                        <div key={subject}>
                          <p className="mb-1.5 text-xs text-purple-200">{subject}</p>
                          <div className="flex flex-wrap gap-1.5">{items.map((item) => <button type="button" key={item.id} onClick={() => ask(item.title, 'explain')} className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-gray-300 transition hover:border-purple-300/40 hover:text-white">{item.title}</button>)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-2xl font-bold">{result.title}</h3>
                    {result.subject ? <p className="text-xs text-gray-400">{result.subject}</p> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <EngineBadge engine={result.engine} />
                    {result.reflection ? <span className="inline-flex items-center gap-1 rounded-full bg-cyan-400/15 px-2.5 py-1 text-[11px] font-semibold text-cyan-100"><ShieldCheck className="h-3 w-3" /> {result.reflection.corrected ? `Self-corrected: ${result.reflection.issue}` : 'Verified by reviewer'}</span> : null}
                    {'speechSynthesis' in window ? <button type="button" onClick={readAloud} className="rounded-lg border border-white/15 p-2 text-gray-300" title="Read aloud"><Volume2 className="h-4 w-4" /></button> : null}
                  </div>
                </div>
                {result.directAnswer?.answer ? <Block title="Answer to your question" tone="emerald"><p className="mb-2 text-xs text-gray-400">{result.directAnswer.question}</p><div className="space-y-2">{result.directAnswer.answer.split(/\n\n+/).map((part) => <p key={part}>{part}</p>)}</div></Block> : null}
                {result.simpleExplanation ? <Block title={result.directAnswer?.answer ? `About ${result.title}` : 'In simple words'}>{result.simpleExplanation}</Block> : null}
                {result.analogy ? <Block title="Analogy" tone="purple">{result.analogy}</Block> : null}
                {result.fromNotes?.length ? <Block title="From your notes" tone="emerald"><ul className="space-y-1">{result.fromNotes.map((sentence) => <li key={sentence}>• {sentence}</li>)}</ul></Block> : null}
                {result.keyPoints?.length ? <Block title="Key points" tone="amber"><ul className="space-y-1">{result.keyPoints.map((point) => <li key={point}>• {point}</li>)}</ul></Block> : null}
                {result.formulas?.length ? <Block title="Formulas" tone="emerald"><ul className="space-y-2">{result.formulas.map((item) => <li key={item.formula}><code className="rounded bg-black/30 px-2 py-0.5 text-emerald-100">{item.formula}</code>{item.meaning ? <span className="ml-2 text-gray-300">{item.meaning}</span> : null}</li>)}</ul></Block> : null}
                {result.steps?.length ? <Block title={result.mode === 'problem' ? 'Solution steps' : 'Step by step'}><ol className="space-y-2">{result.steps.map((step, index) => <li key={`${index}-${step}`} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 text-xs font-bold text-cyan-200">{index + 1}</span>{step}</li>)}</ol></Block> : null}
                {result.finalAnswer ? <Block title="Final answer" tone="emerald"><p className="text-lg font-bold text-white">{result.finalAnswer}</p>{result.check ? <p className="mt-1 text-xs text-gray-400">Check: {result.check}</p> : null}</Block> : null}
                {result.examples?.length ? <Block title="Examples" tone="purple"><ul className="space-y-1">{result.examples.map((example) => <li key={example}>• {example}</li>)}</ul></Block> : null}
                {result.workedExample ? <Block title="Worked example" tone="amber"><p className="font-semibold">{result.workedExample.problem}</p><ol className="mt-2 list-decimal space-y-1 pl-5">{result.workedExample.steps.map((step) => <li key={step}>{step}</li>)}</ol>{result.workedExample.answer ? <p className="mt-2 text-emerald-200">Answer: {result.workedExample.answer}</p> : null}</Block> : null}
                {result.practice?.length ? (
                  <Block title="Practice exercises" tone="rose">
                    <div className="space-y-3">
                      {result.practice.map((item, index) => (
                        <div key={item.question} className="rounded-xl border border-white/10 bg-black/20 p-3">
                          <p className="font-semibold">{index + 1}. {item.question}</p>
                          {item.hint ? <p className="mt-1 text-xs text-gray-400">Hint: {item.hint}</p> : null}
                          {item.answer ? (revealed[index] ? <p className="mt-2 text-emerald-200">Answer: {item.answer}</p> : <button type="button" onClick={() => setRevealed((current) => ({ ...current, [index]: true }))} className="mt-2 text-xs text-cyan-300">Reveal answer</button>) : null}
                        </div>
                      ))}
                    </div>
                  </Block>
                ) : null}
                {result.commonMistakes?.length ? <Block title="Common mistakes" tone="rose"><ul className="space-y-1">{result.commonMistakes.map((item) => <li key={item}>• {item}</li>)}</ul></Block> : null}
                {result.followUps?.length ? <div className="flex flex-wrap gap-2"><span className="text-xs text-gray-400">{result.engine === 'offline' ? 'Related topics I can explain:' : 'Learn next:'}</span>{result.followUps.map((item) => <button type="button" key={item} onClick={() => ask(item, 'explain')} className="rounded-full border border-purple-300/30 px-3 py-1 text-xs text-purple-100">{item}</button>)}</div> : null}
                {result.resources?.length ? <div className="flex flex-wrap gap-3 text-xs">{result.resources.map((item) => <a key={item.url} href={item.url} target="_blank" rel="noreferrer" className="text-cyan-300 underline">{item.title}</a>)}</div> : null}
                {result.sources?.length ? <p className="text-xs text-gray-500">Sources: {result.sources.map((source) => `${source.documentName}${source.page ? ` p.${source.page}` : ''}`).join(', ')}</p> : null}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
