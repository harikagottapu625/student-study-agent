import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Bot, Brain, Mic, MicOff, Paperclip, RotateCcw, Send, Volume2, VolumeX, X } from 'lucide-react';
import { OPEN_QUIZ_EVENT, addTrackedAssignments, studyApi, useStudyUserId } from '../utils/studyApi.js';

const EXAMPLES = [
  'Explain normalization in DBMS with an example',
  'Make a weekly study plan, subjects: Maths, Physics, DBMS, 3 hours a day, exam on December 5',
  'My OS assignment is due on November 10 and the DBMS project by November 14',
  'Quiz me on photosynthesis',
  'What does my notes say about primary keys?',
  'How am I doing in my quizzes?',
];

const STATUS_STYLE = {
  done: 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100',
  error: 'border-rose-300/30 bg-rose-400/10 text-rose-100',
  'needs-input': 'border-amber-300/30 bg-amber-400/10 text-amber-100',
  'no-evidence': 'border-amber-300/30 bg-amber-400/10 text-amber-100',
};

// Next steps offered under a tutor answer: related topics, then a quiz or another example.
const nextSteps = (tutor) => {
  if (!tutor?.title) return [];
  // AI titles can read like headlines ("Database Normalization for Beginners").
  const topic = tutor.title
    .replace(/\s*\([^)]*\)\s*$/, '')
    .replace(/^(an?\s+)?(introduction to|intro to|understanding|basics of|the basics of|a beginner'?s guide to)\s+/i, '')
    .replace(/\s+(for beginners|made simple|explained|basics)$/i, '')
    .trim();
  return [
    ...(tutor.followUps || []).slice(0, 3).map((followUp) => ({ label: followUp, message: `Explain ${followUp} with an example` })),
    { label: `Quiz me on ${topic}`, message: `Quiz me on ${topic}` },
    { label: 'Another example', message: `Give me another example of ${topic}` },
  ];
};

const SpeechRecognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

export default function AgentHub({ onNavigate }) {
  const userId = useStudyUserId();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [agentInfo, setAgentInfo] = useState(null);
  const [memory, setMemory] = useState(null);
  const [listening, setListening] = useState(false);
  const [speakReplies, setSpeakReplies] = useState(false);
  const recognitionRef = useRef(null);
  const listRef = useRef(null);

  const agentNames = Object.fromEntries((agentInfo?.agents || []).map((agent) => [agent.id, agent.name]));

  const refreshSidebar = () => {
    studyApi.get('/api/agents').then(setAgentInfo).catch(() => setAgentInfo(null));
    studyApi.get('/api/memory').then(setMemory).catch(() => setMemory(null));
  };

  useEffect(refreshSidebar, [userId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const speak = (text) => {
    if (!speakReplies || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text.slice(0, 1200)));
  };

  const send = async (text = input) => {
    const message = text.trim();
    if (!message || loading) return;
    setMessages((current) => [...current, { role: 'user', text: message, fileName: file?.name }]);
    setInput('');
    setError('');
    setLoading(true);
    try {
      const form = new FormData();
      form.append('message', message);
      form.append('today', new Date().toISOString().slice(0, 10));
      if (file) form.append('material', file);
      const data = await studyApi.upload('/api/agent/chat', form);
      if (data.results?.deadlines?.assignments?.length) addTrackedAssignments(data.results.deadlines.assignments);
      setMessages((current) => [...current, { role: 'agent', ...data }]);
      speak(data.reply);
      setFile(null);
      refreshSidebar();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleListening = () => {
    if (!SpeechRecognition) return;
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.onresult = (event) => setInput((current) => `${current} ${event.results[0][0].transcript}`.trim());
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  const openQuiz = (quiz) => {
    window.dispatchEvent(new CustomEvent(OPEN_QUIZ_EVENT, { detail: quiz }));
    onNavigate?.('quiz');
  };

  const startNewTopic = () => {
    if (loading) return;
    window.speechSynthesis?.cancel();
    setMessages([]);
    setInput('');
    setError('');
    setFile(null);
  };

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-7xl">
        <header className="page-header mb-8">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300"><Bot className="h-4 w-4" /> Coordinator Agent · Multi-agent system</p>
          <h2 className="glow-text text-4xl font-black">Hub</h2>
          <p className="mt-3 max-w-3xl text-gray-300">Ask anything in plain language. The coordinator decides which specialist agents to use, passes results between them, and shows every step it took.</p>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <section className="glass-card flex min-h-[620px] flex-col rounded-3xl p-5">
            {messages.length ? (
              <div className="mb-3 flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                <p className="text-xs text-gray-400">Ask a follow-up below, or start a new topic.</p>
                <button type="button" onClick={startNewTopic} disabled={loading} className="flex items-center gap-1.5 rounded-lg border border-cyan-300/30 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/10 disabled:opacity-40">
                  <RotateCcw className="h-3.5 w-3.5" /> New topic
                </button>
              </div>
            ) : null}
            <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto pr-1" style={{ maxHeight: 560 }}>
              {!messages.length ? (
                <div className="py-8 text-center">
                  <Brain className="mx-auto mb-3 h-10 w-10 text-cyan-300" />
                  <p className="text-gray-300">Try one of these to see the agents work together:</p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    {EXAMPLES.map((example) => <button type="button" key={example} onClick={() => send(example)} className="rounded-full border border-cyan-300/25 bg-cyan-400/5 px-3 py-2 text-left text-xs text-cyan-100 transition hover:bg-cyan-400/15">{example}</button>)}
                  </div>
                </div>
              ) : null}

              {messages.map((message, index) => message.role === 'user' ? (
                <div key={index} className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-gradient-to-r from-purple-500/40 to-cyan-500/30 px-4 py-3 text-sm text-white">
                  {message.text}
                  {message.fileName ? <p className="mt-1 text-[11px] text-cyan-100/80">📎 {message.fileName}</p> : null}
                </div>
              ) : (
                <div key={index} className="max-w-[92%] rounded-2xl rounded-bl-sm border border-white/10 bg-white/5 px-4 py-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {message.steps?.map((step, stepIndex) => (
                      <span key={stepIndex} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLE[step.status] || 'border-white/15 text-gray-300'}`} title={step.error || ''}>
                        {stepIndex + 1}. {agentNames[step.agent] || (step.agent === 'performance' ? 'Quiz performance' : step.agent)}{step.engine ? ` · ${step.engine}` : ''}
                      </span>
                    ))}
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-100">{message.reply}</p>
                  {message.results?.rag?.citations?.length ? (
                    <div className="mt-3 space-y-1 border-t border-white/10 pt-2">
                      {message.results.rag.citations.map((citation) => <p key={citation.chunkId} className="text-[11px] text-amber-100/90">[{citation.label}] {citation.documentName}{citation.page ? `, page ${citation.page}` : ''}</p>)}
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {message.results?.quiz?.questions ? <button type="button" onClick={() => openQuiz(message.results.quiz)} className="rounded-lg bg-cyan-500/20 px-3 py-1.5 text-xs font-semibold text-cyan-100">Take this quiz →</button> : null}
                    {message.results?.planner ? <button type="button" onClick={() => onNavigate?.('planner')} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-gray-200">Open Study Planner →</button> : null}
                    {message.results?.deadlines?.assignments?.length ? <button type="button" onClick={() => onNavigate?.('assignments')} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-gray-200">View deadlines →</button> : null}
                    {message.results?.tutor ? <button type="button" onClick={() => onNavigate?.('tutor')} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-gray-200">Open Concept Tutor →</button> : null}
                  </div>
                  {nextSteps(message.results?.tutor).length ? (
                    <div className="mt-3 border-t border-white/10 pt-3">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-300">Continue learning</p>
                      <div className="flex flex-wrap gap-2">
                        {nextSteps(message.results.tutor).map((step) => (
                          <button type="button" key={step.label} onClick={() => send(step.message)} disabled={loading} className="flex items-center gap-1 rounded-full border border-cyan-300/25 bg-cyan-400/5 px-3 py-1.5 text-left text-xs text-cyan-100 transition hover:bg-cyan-400/15 disabled:opacity-40">
                            {step.label} <ArrowRight className="h-3 w-3" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-gray-500">Routed by {message.routedBy === 'ai' ? 'AI coordinator' : 'rule-based coordinator'}</p>
                </div>
              ))}
              {loading ? <div className="w-fit rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-300">Agents are working...</div> : null}
            </div>

            {error ? <p className="mt-3 rounded-xl border border-rose-300/25 bg-rose-500/10 p-3 text-xs text-rose-100">{error}</p> : null}
            {file ? <p className="mt-3 flex items-center gap-2 text-xs text-emerald-200">📎 {file.name}<button type="button" onClick={() => setFile(null)} aria-label="Remove attachment"><X className="h-3.5 w-3.5" /></button></p> : null}
            <div className="mt-3 flex flex-wrap items-end gap-2 sm:flex-nowrap">
              <label className="cursor-pointer rounded-xl border border-white/15 p-3 text-gray-300 hover:text-cyan-200" title="Attach notes, a PDF, slides or an image">
                <Paperclip className="h-4 w-4" />
                <input type="file" className="sr-only" accept=".pdf,.txt,.md,.csv,.pptx,.odp,.png,.jpg,.jpeg" onChange={(event) => setFile(event.target.files?.[0] || null)} />
              </label>
              {SpeechRecognition ? <button type="button" onClick={toggleListening} className={`rounded-xl border p-3 ${listening ? 'border-rose-300/50 text-rose-200' : 'border-white/15 text-gray-300 hover:text-cyan-200'}`} title={listening ? 'Stop listening' : 'Speak your question'}>{listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</button> : null}
              <button type="button" onClick={() => setSpeakReplies((value) => !value)} className={`rounded-xl border p-3 ${speakReplies ? 'border-cyan-300/50 text-cyan-200' : 'border-white/15 text-gray-300'}`} title={speakReplies ? 'Stop reading replies aloud' : 'Read replies aloud'}>{speakReplies ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</button>
              <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} rows={2} className="input-field order-first min-w-0 flex-1 basis-full resize-none rounded-xl px-4 py-3 text-sm text-white sm:order-none sm:basis-0" placeholder={listening ? 'Listening...' : 'Ask the study agent... (Enter to send)'} />
              <button type="button" onClick={() => send()} disabled={loading || !input.trim()} className="btn-primary ml-auto rounded-xl p-3 disabled:opacity-40 sm:ml-0" aria-label="Send"><Send className="h-4 w-4" /></button>
            </div>
          </section>

          <aside className="space-y-4">
            <div className="glass-card rounded-3xl p-5">
              <h3 className="mb-3 flex items-center gap-2 font-bold"><Brain className="h-4 w-4 text-purple-300" /> Memory Agent</h3>
              {memory ? (
                <div className="space-y-3 text-xs text-gray-300">
                  <p><span className="text-gray-500">Subjects:</span> {memory.subjects?.length ? memory.subjects.map((subject) => subject.name).join(', ') : 'none yet'}</p>
                  <p><span className="text-gray-500">Weak topics:</span> {memory.weakTopics?.length ? memory.weakTopics.join(', ') : 'none yet'}</p>
                  <p><span className="text-gray-500">Recently studied:</span> {memory.topicsStudied?.length ? memory.topicsStudied.slice(0, 5).map((item) => item.topic).join(', ') : 'nothing yet'}</p>
                </div>
              ) : <p className="text-xs text-gray-500">Memory loads once the backend is running.</p>}
              <p className="mt-3 text-[11px] text-gray-500">Signed in as {userId.startsWith('guest-') ? 'guest (sign in to keep your data across devices)' : userId}</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
