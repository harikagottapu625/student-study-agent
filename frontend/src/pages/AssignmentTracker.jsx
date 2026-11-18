import { useEffect, useMemo, useState } from 'react';
import { Bell, CalendarClock, CheckCircle2, FileSearch, Plus, Trash2 } from 'lucide-react';
import { ASSIGNMENTS_EVENT, engineLabel, loadTrackedAssignments, saveTrackedAssignments } from '../utils/studyApi.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export default function AssignmentTracker() {
  const [assignments, setAssignments] = useState(loadTrackedAssignments);
  const [noticeText, setNoticeText] = useState('');
  const [resultMessage, setResultMessage] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [manualDate, setManualDate] = useState(today());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [documentFile, setDocumentFile] = useState(null);

  // Other agents (e.g. the Agent Hub) can add deadlines while this page is mounted.
  useEffect(() => {
    const reload = () => setAssignments(loadTrackedAssignments());
    window.addEventListener(ASSIGNMENTS_EVENT, reload);
    return () => window.removeEventListener(ASSIGNMENTS_EVENT, reload);
  }, []);

  useEffect(() => {
    saveTrackedAssignments(assignments);
  }, [assignments]);

  useEffect(() => {
    const urgent = refreshStatuses(assignments).filter((item) => !item.completed && (item.status === 'urgent' || item.status === 'overdue'));
    if (Notification.permission === 'granted') {
      urgent.forEach((item) => {
        const reminderKey = `study-agent-reminded-${item.id}-${today()}`;
        if (!localStorage.getItem(reminderKey)) {
          new Notification(item.status === 'overdue' ? `Overdue: ${item.title}` : `Due soon: ${item.title}`, { body: `Due ${item.dueDate}` });
          localStorage.setItem(reminderKey, '1');
        }
      });
    }
  }, [assignments]);

  const refreshStatuses = (items) => items.map((item) => {
    if (item.completed) return { ...item, status: 'completed' };
    const days = Math.ceil((new Date(`${item.dueDate}T23:59:59`) - new Date()) / 86400000);
    return { ...item, status: days < 0 ? 'overdue' : days <= 2 ? 'urgent' : 'upcoming' };
  });

  const analyzeText = async (text) => {
    const trimmedText = String(text || '').trim();
    if (!trimmedText) {
      setError('Paste a message or notice containing a deadline before extracting.');
      setResultMessage('');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/assignments/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmedText, today: today() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to extract assignments.');
      setAssignments((current) => refreshStatuses([...current, ...(data.assignments || [])]));
      setResultMessage(`${data.assignments?.length || 0} deadline(s) found by the ${engineLabel(data.engine).toLowerCase()}.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const analyzeDocument = async () => {
    if (!documentFile) return;
    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('material', documentFile);
      const response = await fetch(`${API_BASE_URL}/api/notes/extract`, { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to read the document.');
      await analyzeText(data.text || '');
    } catch (requestError) {
      setError(requestError.message);
      setLoading(false);
    }
  };

  const addManual = () => {
    if (!manualTitle.trim() || !manualDate) return;
    setAssignments((current) => refreshStatuses([...current, {
      id: `assignment-manual-${Date.now()}`,
      title: manualTitle.trim(),
      dueDate: manualDate,
      source: 'Added manually',
      completed: false,
      status: 'upcoming',
    }]));
    setManualTitle('');
    setResultMessage('Assignment added.');
  };

  const toggleComplete = (id) => {
    setAssignments((current) => refreshStatuses(current.map((item) => item.id === id ? { ...item, completed: !item.completed } : item)));
  };

  const requestReminder = async (item) => {
    if (!('Notification' in window)) {
      setError('Browser notifications are not supported.');
      return;
    }
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (permission === 'granted') new Notification(`Upcoming deadline: ${item.title}`, { body: `Due ${item.dueDate}` });
    else setError('Notification permission was not granted.');
  };

  const counts = useMemo(() => ({
    overdue: assignments.filter((item) => item.status === 'overdue').length,
    urgent: assignments.filter((item) => item.status === 'urgent').length,
    upcoming: assignments.filter((item) => item.status === 'upcoming').length,
  }), [assignments]);

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl">
        <header className="page-header mb-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Assignment & Deadline Tracker Agent</p>
          <h2 className="glow-text text-4xl font-black">Never miss a submission</h2>
          <p className="mt-3 max-w-2xl text-gray-300">Paste a message or notice to extract deadlines, track assignments, and identify urgent or overdue work.</p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <section className="glass-card rounded-3xl p-6">
            <h3 className="mb-3 text-xl font-bold">Extract from a message</h3>
            <textarea id="deadline-message" value={noticeText} onChange={(event) => { setNoticeText(event.target.value); setError(''); setResultMessage(''); }} className="input-field min-h-48 w-full rounded-2xl p-4 text-sm text-white" placeholder="Paste a notice here. Example: DBMS project is due on October 30, 2026. Java assignment submission by tomorrow." />
            <p className="mt-2 text-xs text-gray-400">Include words such as <span className="text-cyan-200">due</span>, <span className="text-cyan-200">deadline</span>, or <span className="text-cyan-200">submit by</span> with a date.</p>
            <button type="button" disabled={loading || !noticeText.trim()} onClick={() => analyzeText(noticeText)} className="btn-primary mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-50"><FileSearch className="h-4 w-4" /> {loading ? 'Finding deadlines...' : 'Extract deadlines'}</button>
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
              <label className="text-xs text-gray-300">Or upload a document</label>
              <input type="file" accept=".pdf,.txt,.md,.csv,.pptx,.odp,.png,.jpg,.jpeg" className="mt-2 block w-full text-xs text-gray-400" onChange={(event) => setDocumentFile(event.target.files?.[0] || null)} />
              <button type="button" disabled={!documentFile || loading} onClick={analyzeDocument} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/30 px-4 py-2 text-xs font-semibold text-cyan-100 disabled:opacity-40"><FileSearch className="h-3.5 w-3.5" /> Scan document for deadlines</button>
            </div>
            <div className="my-6 border-t border-white/10 pt-5">
              <h3 className="mb-3 text-xl font-bold">Add assignment</h3>
              <input className="input-field mb-3 w-full rounded-xl px-3 py-3 text-sm text-white" placeholder="Assignment title" value={manualTitle} onChange={(event) => setManualTitle(event.target.value)} />
              <input type="date" className="input-field w-full rounded-xl px-3 py-3 text-sm text-white" value={manualDate} onChange={(event) => setManualDate(event.target.value)} />
              <button type="button" onClick={addManual} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/30 px-4 py-3 text-sm font-semibold text-cyan-100"><Plus className="h-4 w-4" /> Add to tracker</button>
            </div>
            {resultMessage ? <p className="rounded-xl border border-emerald-300/25 bg-emerald-500/10 p-3 text-xs text-emerald-100">{resultMessage}</p> : null}
            {error ? <p className="mt-3 rounded-xl border border-rose-300/25 bg-rose-500/10 p-3 text-xs text-rose-100">{error}</p> : null}
          </section>

          <section>
            <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-3">
              <div className="glass-card rounded-2xl p-4"><p className="text-xs text-gray-400">Overdue</p><p className="mt-1 text-2xl font-bold text-rose-300">{counts.overdue}</p></div>
              <div className="glass-card rounded-2xl p-4"><p className="text-xs text-gray-400">Urgent (2 days)</p><p className="mt-1 text-2xl font-bold text-amber-300">{counts.urgent}</p></div>
              <div className="glass-card rounded-2xl p-4"><p className="text-xs text-gray-400">Upcoming</p><p className="mt-1 text-2xl font-bold text-cyan-300">{counts.upcoming}</p></div>
            </div>
            <div className="space-y-3">
              {!assignments.length ? <div className="glass-card rounded-3xl p-10 text-center text-gray-400">Your assignment list will appear here.</div> : assignments.map((item) => (
                <article key={item.id} className={`glass-card rounded-2xl border-l-4 p-4 ${item.status === 'overdue' ? 'border-l-rose-400' : item.status === 'urgent' ? 'border-l-amber-400' : item.status === 'completed' ? 'border-l-emerald-400' : 'border-l-cyan-400'}`}>
                  <div className="flex items-start gap-3">
                    <button type="button" aria-label={`Mark ${item.title} complete`} onClick={() => toggleComplete(item.id)}><CheckCircle2 className={`mt-1 h-5 w-5 ${item.completed ? 'text-emerald-300' : 'text-gray-500'}`} /></button>
                    <div className="min-w-0 flex-1"><h3 className={`font-semibold ${item.completed ? 'text-gray-500 line-through' : 'text-white'}`}>{item.title}</h3><p className="mt-1 flex items-center gap-2 text-xs text-gray-400"><CalendarClock className="h-3.5 w-3.5" /> Due {item.dueDate} · <span className="capitalize">{item.status}</span></p></div>
                    {!item.completed ? <button type="button" onClick={() => requestReminder(item)} title="Send reminder now" className="text-amber-200"><Bell className="h-4 w-4" /></button> : null}
                    <button type="button" onClick={() => setAssignments((current) => current.filter((entry) => entry.id !== item.id))} title="Delete assignment" className="text-gray-500 hover:text-rose-300"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
