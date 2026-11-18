import { useEffect, useState } from 'react';
import { BookOpen, CheckCircle2, FileSearch, Library, ShieldCheck, Trash2, Upload, XCircle } from 'lucide-react';
import EngineBadge from '../components/EngineBadge.jsx';
import { studyApi, useStudyUserId } from '../utils/studyApi.js';

// Renders [S1]-style citation markers as highlighted chips.
const renderAnswer = (answer) =>
  String(answer || '').split(/(\[S\d+\])/g).map((part, index) => (
    /^\[S\d+\]$/.test(part)
      ? <span key={index} className="mx-0.5 rounded bg-amber-300/20 px-1 text-xs font-semibold text-amber-100">{part.slice(1, -1)}</span>
      : <span key={index}>{part}</span>
  ));

export default function RetrievalHelper() {
  const userId = useStudyUserId();
  const [documents, setDocuments] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [file, setFile] = useState(null);
  const [pastedText, setPastedText] = useState('');
  const [docName, setDocName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadDocuments = () =>
    studyApi.get('/api/rag/documents').then((data) => setDocuments(data.documents || [])).catch((requestError) => setError(requestError.message));

  useEffect(() => {
    loadDocuments();
  }, [userId]);

  const addToLibrary = async () => {
    if (!file && !pastedText.trim()) return;
    setUploading(true);
    setError('');
    setMessage('');
    try {
      const form = new FormData();
      if (file) form.append('material', file);
      form.append('text', pastedText);
      form.append('name', docName.trim() || file?.name || 'Pasted notes');
      const { document } = await studyApi.upload('/api/rag/documents', form);
      setMessage(`Indexed "${document.name}" into ${document.chunkCount} searchable chunk(s).`);
      setFile(null);
      setPastedText('');
      setDocName('');
      loadDocuments();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setUploading(false);
    }
  };

  const removeDocument = async (id) => {
    try {
      await studyApi.del(`/api/rag/documents/${encodeURIComponent(id)}`);
      setSelectedIds((current) => current.filter((item) => item !== id));
      loadDocuments();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const askQuestion = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setError('');
    try {
      setResult(await studyApi.post('/api/rag/query', { question, documentIds: selectedIds }));
    } catch (requestError) {
      setError(requestError.message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelected = (id) => setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-7xl">
        <header className="page-header mb-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Retrieval Study Helper Agent</p>
          <h2 className="glow-text text-4xl font-black">Ask your study library</h2>
          <p className="mt-3 max-w-3xl text-gray-300">Add notes, PDFs, textbooks and slides once. Each document is split into chunks and indexed. Your question retrieves the most relevant passages, and the answer is generated only from them, with page references. Validation rules reject any sentence the sources don't support.</p>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
          <div className="space-y-6">
            <section className="glass-card rounded-3xl p-6">
              <h3 className="mb-3 flex items-center gap-2 text-lg font-bold"><Upload className="h-5 w-5 text-cyan-300" /> Add to library</h3>
              <input type="file" accept=".pdf,.txt,.md,.csv,.pptx,.odp,.png,.jpg,.jpeg" onChange={(event) => { setFile(event.target.files?.[0] || null); setError(''); }} className="block w-full text-xs text-gray-400" />
              <textarea value={pastedText} onChange={(event) => setPastedText(event.target.value)} className="input-field mt-3 min-h-24 w-full rounded-2xl p-3 text-sm text-white" placeholder="Or paste textbook / class notes text..." />
              <input value={docName} onChange={(event) => setDocName(event.target.value)} className="input-field mt-3 w-full rounded-xl px-3 py-2 text-sm text-white" placeholder="Document name (optional)" />
              <button type="button" onClick={addToLibrary} disabled={uploading || (!file && !pastedText.trim())} className="btn-primary mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-40"><BookOpen className="h-4 w-4" /> {uploading ? 'Extracting and indexing...' : 'Index document'}</button>
              {message ? <p className="mt-3 rounded-xl border border-emerald-300/25 bg-emerald-500/10 p-3 text-xs text-emerald-100">{message}</p> : null}
            </section>

            <section className="glass-card rounded-3xl p-6">
              <h3 className="mb-1 flex items-center gap-2 text-lg font-bold"><Library className="h-5 w-5 text-purple-300" /> Your library</h3>
              <p className="mb-3 text-xs text-gray-400">{selectedIds.length ? `Searching ${selectedIds.length} selected document(s).` : 'Searching all documents. Tick documents to narrow the search.'}</p>
              {!documents.length ? <p className="text-sm text-gray-500">No documents yet.</p> : (
                <ul className="space-y-2">
                  {documents.map((document) => (
                    <li key={document.id} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                      <input type="checkbox" className="mt-1" checked={selectedIds.includes(document.id)} onChange={() => toggleSelected(document.id)} aria-label={`Search ${document.name}`} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{document.name}</p>
                        <p className="text-[11px] text-gray-400">{document.chunkCount} chunks · {document.wordCount} words{document.pageCount ? ` · ${document.pageCount} pages` : ''}</p>
                      </div>
                      <button type="button" onClick={() => removeDocument(document.id)} className="text-gray-500 hover:text-rose-300" title="Remove from library"><Trash2 className="h-4 w-4" /></button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="glass-card rounded-3xl p-6">
            <label className="block text-sm font-semibold">Question</label>
            <div className="mt-2 flex gap-2">
              <input value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && askQuestion()} className="input-field min-w-0 flex-1 rounded-xl px-4 py-3 text-sm text-white" placeholder="What is inheritance in Java?" />
              <button type="button" disabled={loading || !question.trim() || !documents.length} onClick={askQuestion} className="btn-primary flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold disabled:opacity-40"><FileSearch className="h-4 w-4" /> {loading ? 'Retrieving...' : 'Ask'}</button>
            </div>
            {!documents.length ? <p className="mt-2 text-xs text-amber-200">Add at least one document to your library first.</p> : null}
            {error ? <p className="mt-3 rounded-xl border border-rose-300/25 bg-rose-500/10 p-3 text-xs text-rose-100">{error}</p> : null}

            {!result ? (
              <div className="flex min-h-72 flex-col items-center justify-center text-center text-gray-400"><ShieldCheck className="mb-3 h-10 w-10 text-cyan-300" /><p>Grounded answers and page evidence will appear here.</p></div>
            ) : (
              <div className="mt-6">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1 text-sm font-semibold ${result.grounded ? 'text-emerald-200' : 'text-amber-200'}`}><ShieldCheck className="h-5 w-5" /> {result.grounded ? 'Grounded in your material' : 'No supporting evidence found'}</span>
                  <EngineBadge engine={result.engine} />
                  {result.validation?.selfCorrected ? <span className="rounded-full bg-cyan-400/15 px-2.5 py-1 text-[11px] font-semibold text-cyan-100">Self-corrected after validation</span> : null}
                </div>
                <p className="text-lg leading-8 text-white">{renderAnswer(result.answer)}</p>

                {result.validation?.rules?.length ? (
                  <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">Validation rules</p>
                    <ul className="space-y-1">
                      {result.validation.rules.map((rule) => <li key={rule.rule} className="flex items-center gap-2 text-xs text-gray-300">{rule.passed ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" /> : <XCircle className="h-3.5 w-3.5 text-rose-300" />}{rule.rule}{rule.detail ? ` (${rule.detail})` : ''}</li>)}
                    </ul>
                  </div>
                ) : null}

                {result.citations?.length ? (
                  <div className="mt-6 space-y-3">
                    <h3 className="font-bold text-cyan-200">Source evidence</h3>
                    {result.citations.map((citation) => (
                      <div key={citation.chunkId} className="rounded-xl border border-white/10 bg-white/5 p-4">
                        <p className="text-xs font-semibold text-amber-200">[{citation.label}] {citation.documentName}{citation.page ? ` · Page ${citation.page}` : ''} <span className="ml-2 font-normal text-gray-500">relevance {citation.score}</span></p>
                        <p className="mt-2 text-sm leading-6 text-gray-300">{citation.excerpt}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
