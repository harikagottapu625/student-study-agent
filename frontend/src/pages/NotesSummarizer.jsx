import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clipboard,
  FileImage,
  FileText,
  Languages,
  Layers3,
  Link2,
  Library,
  ListTree,
  Lightbulb,
  RotateCcw,
  Sparkles,
  Upload,
} from 'lucide-react';
import EngineBadge from '../components/EngineBadge.jsx';
import { studyApi } from '../utils/studyApi.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const OUTPUT_TABS = [
  { id: 'topics', label: 'Main Topics', icon: ListTree },
  { id: 'summary', label: 'Key Points', icon: Lightbulb },
  { id: 'flashcards', label: 'Flashcards', icon: Layers3 },
  { id: 'qa', label: 'Q&A Pairs', icon: Sparkles },
  { id: 'revision', label: 'Revision Notes', icon: FileText },
  { id: 'fulltext', label: 'Full Text', icon: Languages },
];

// The study pack can be written in any of these, whatever language the notes or video use.
const LANGUAGES = [
  { id: 'english', label: 'English', lang: 'en' },
  { id: 'hindi', label: 'हिन्दी · Hindi', lang: 'hi' },
  { id: 'telugu', label: 'తెలుగు · Telugu', lang: 'te' },
];

// Judged by script, like the backend, for the summary made in the browser.
const scriptLanguage = (text) => {
  const counts = {
    hindi: (text.match(/[ऀ-ॿ]/g) || []).length,
    telugu: (text.match(/[ఀ-౿]/g) || []).length,
    english: (text.match(/[A-Za-z]/g) || []).length,
  };
  return Object.keys(counts).reduce((best, id) => (counts[id] > counts[best] ? id : best), 'english');
};

const OUTLINE_NOTES = {
  'key-terms': 'The headings could not be read clearly (common with handwriting), so these topics were detected from the key terms used on each page. Page numbers show where each topic is discussed most.',
  'key-phrases': 'This document has no clear headings, so these are the phrases it discusses most, with a sentence from the document for each.',
  ai: 'The material has no headings (a spoken lecture, for example), so the AI listed the main topics in the order they are taught.',
};

const STOP_WORDS = new Set(
  'about after again against along also because before being between could does doing during each from further have into more most other over should some such than their there these they those through under very what when where which while with would your'.split(' '),
);

const cleanText = (value) => value.replace(/\s+/g, ' ').trim();

const splitSentences = (value) =>
  value
    .replace(/\n+/g, '. ')
    .split(/(?<=[.!?])\s+/)
    .map(cleanText)
    .filter((sentence) => sentence.length > 35);

const titleFromFile = (fileName) =>
  fileName
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const makeFlashcards = (sentences) =>
  sentences.slice(0, 5).map((sentence, index) => {
    const words = sentence.split(' ');
    const keyword = words.find((word) => word.length > 6) || words[Math.min(index, words.length - 1)];
    return {
      question: `What is the main idea behind ${keyword.replace(/[^a-zA-Z0-9-]/g, '')}?`,
      answer: sentence,
    };
  });

const makeQuestionPairs = (sentences) =>
  sentences.slice(0, 5).map((sentence, index) => ({
    question: ['What should you remember?', 'Why is this important?', 'How does this work?', 'What is the practical takeaway?', 'Which concept connects here?'][index],
    answer: sentence,
  }));

const summarizeText = (value, title) => {
  const sentences = splitSentences(value);
  const words = cleanText(value).toLowerCase().match(/[a-z][a-z-]{3,}/g) || [];
  const counts = words.reduce((result, word) => {
    if (!STOP_WORDS.has(word)) result[word] = (result[word] || 0) + 1;
    return result;
  }, {});
  const keywords = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([word]) => word);
  const points = (sentences.length ? sentences : [cleanText(value)])
    .filter(Boolean)
    .slice(0, 6)
    .map((sentence) => sentence.replace(/^[•*-]\s*/, ''));

  return {
    title: title || 'Study Notes',
    points,
    keywords,
    flashcards: makeFlashcards(points),
    qa: makeQuestionPairs(points),
    revision: [
      `Topic: ${title || 'Study Notes'}`,
      `Core idea: ${points[0] || 'Review the source material and identify its central argument.'}`,
      `Remember: ${keywords.length ? keywords.join(', ') : 'the definitions, examples, and practical applications.'}`,
      'Exam check: Explain the topic in your own words, then solve one example without looking at your notes.',
    ],
  };
};

const fileKind = (file) => {
  if (!file) return null;
  if (file.type.startsWith('image/')) return 'Image';
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) return 'PDF';
  if (/\.(ppt|pptx|odp)$/i.test(file.name)) return 'Lecture slides';
  return 'Text notes';
};

export default function NotesSummarizer() {
  const [source, setSource] = useState('');
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState('summary');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState('');
  const [libraryMessage, setLibraryMessage] = useState('');
  const [extractSeconds, setExtractSeconds] = useState(0);
  const [extractProgress, setExtractProgress] = useState(null);
  const [extractWarning, setExtractWarning] = useState('');
  const [extractStage, setExtractStage] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkInfo, setLinkInfo] = useState(null);
  const [language, setLanguage] = useState('english');
  // The generated pack plus its translations, keyed by language; the first entry is the original.
  const [packs, setPacks] = useState({});
  const [translating, setTranslating] = useState('');
  const [translateError, setTranslateError] = useState('');
  const [customLanguage, setCustomLanguage] = useState('');
  // Whole-material translations, kept only for the text they were made from.
  const [fullTexts, setFullTexts] = useState({ source: '', byLanguage: {} });
  const [fullJob, setFullJob] = useState(null);
  const [fullError, setFullError] = useState('');
  const [copiedFull, setCopiedFull] = useState(false);

  useEffect(() => {
    if (!extracting) return undefined;
    setExtractSeconds(0);
    const timer = setInterval(() => setExtractSeconds((seconds) => seconds + 1), 1000);
    return () => clearInterval(timer);
  }, [extracting]);

  const sourceWordCount = useMemo(() => source.trim().split(/\s+/).filter(Boolean).length, [source]);

  // Starts a background extraction (a scanned PDF read page by page, or a
  // video or web page behind a link) and polls it for progress.
  const runExtractJob = async (formData) => {
    setSource('');
    setExtractWarning('');
    setExtractProgress(null);
    setExtractStage('');
    setExtracting(true);
    try {
      const started = await fetch(`${API_BASE_URL}/api/notes/extract-jobs`, { method: 'POST', body: formData });
      const startData = await started.json().catch(() => ({}));
      if (!started.ok) throw new Error(startData.error || 'Unable to extract text.');

      let job = null;
      while (!job || job.status === 'running') {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const response = await fetch(`${API_BASE_URL}/api/notes/extract-jobs/${startData.jobId}`);
        job = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(job.error || 'Lost track of the extraction. Please try again.');
        if (job.totalPages) setExtractProgress({ done: job.pagesDone, total: job.totalPages });
        if (job.stage) setExtractStage(job.stage);
      }
      if (job.status !== 'done') throw new Error(job.error || 'Unable to extract text.');
      setSource(job.text || '');
      setExtractWarning(job.warning || '');
      return job;
    } catch (requestError) {
      setError(requestError.message);
      return null;
    } finally {
      setExtracting(false);
    }
  };

  const readFile = async (selectedFile) => {
    setFile(selectedFile);
    setLinkInfo(null);
    setResult(null);
    setPacks({});
    setTranslateError('');
    setCopied(false);
    setError('');
    setPreviewUrl(selectedFile.type.startsWith('image/') ? URL.createObjectURL(selectedFile) : '');

    if (selectedFile.type.startsWith('text/') || /\.(txt|md|csv)$/i.test(selectedFile.name)) {
      setSource(await selectedFile.text());
    } else {
      const formData = new FormData();
      formData.append('material', selectedFile);
      await runExtractJob(formData);
    }
  };

  const readLink = async () => {
    const url = linkUrl.trim();
    if (!url || extracting) return;
    setFile(null);
    setPreviewUrl('');
    setLinkInfo({ url, title: '', detail: '' });
    setResult(null);
    setPacks({});
    setTranslateError('');
    setCopied(false);
    setError('');
    const formData = new FormData();
    formData.append('url', url);
    const job = await runExtractJob(formData);
    setLinkInfo(job ? { url, title: job.title || url, detail: job.detail || '', method: job.method } : null);
  };

  const sourceTitle = linkInfo?.title || (file ? titleFromFile(file.name) : 'Class Notes');

  const generate = async () => {
    if (!source.trim() && !file) return;
    setLoading(true);
    setError('');
    setExtracting(false);
    try {
      const formData = new FormData();
      // Text already extracted from the file is sent as-is, so scanned PDFs are not OCR'd twice.
      if (file && !source.trim()) formData.append('material', file);
      formData.append('text', source);
      formData.append('title', sourceTitle);
      formData.append('language', language);
      // Spoken captions have no headings, so the AI names the topics.
      if (linkInfo?.method === 'youtube-captions') formData.append('sourceKind', 'transcript');
      const data = await studyApi.upload('/api/notes/summarize', formData);
      setResult(data.studyPack);
      setPacks({ [data.studyPack?.language || 'english']: data.studyPack });
      setTranslateError('');
      setLibraryMessage('');
      setActiveTab(data.studyPack?.outline?.length ? 'topics' : 'summary');
    } catch (requestError) {
      // The basic in-browser summarizer is only a stand-in for when the backend
      // cannot be reached; a real answer from it (e.g. "too little readable
      // text") is shown as-is rather than papered over with a weaker summary.
      const unreachable = !requestError.status || requestError.status >= 502;
      if (source.trim() && unreachable) {
        setError(`${requestError.message} The backend could not be reached, so this is a basic summary made in your browser.`);
        const basicPack = { ...summarizeText(source, sourceTitle), language: scriptLanguage(source) };
        setResult(basicPack);
        setPacks({ [basicPack.language]: basicPack });
        setActiveTab('summary');
      } else {
        setError(requestError.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const saveToLibrary = async () => {
    if (!source.trim()) return;
    try {
      const formData = new FormData();
      formData.append('text', source);
      formData.append('name', result?.title || sourceTitle);
      const { document } = await studyApi.upload('/api/rag/documents', formData);
      setLibraryMessage(`Added to your RAG library (${document.chunkCount} chunks). Ask questions about it in the Helper.`);
    } catch (requestError) {
      setLibraryMessage(requestError.message);
    }
  };

  const reset = () => {
    setExtractWarning('');
    setSource('');
    setFile(null);
    setLinkUrl('');
    setLinkInfo(null);
    setPreviewUrl('');
    setResult(null);
    setPacks({});
    setTranslateError('');
    setCopied(false);
    setError('');
  };

  const viewLanguage = result?.language || 'english';

  // Shows the same study pack in another language, translating it once and
  // always from the original so meaning does not drift between languages.
  const showLanguage = async (target) => {
    if (target === viewLanguage || translating) return;
    setFullError('');
    const isSummaryChoice = LANGUAGES.some((option) => option.id === target);
    if (packs[target]) {
      setResult(packs[target]);
      if (isSummaryChoice) setLanguage(target);
      return;
    }
    const original = Object.values(packs)[0] || result;
    setTranslating(target);
    setTranslateError('');
    try {
      const data = await studyApi.post('/api/notes/translate', { pack: original, language: target });
      setPacks((current) => ({ ...current, [target]: data.studyPack }));
      setResult(data.studyPack);
      if (isSummaryChoice) setLanguage(target);
    } catch (requestError) {
      setTranslateError(requestError.message);
    } finally {
      setTranslating('');
    }
  };

  // Any language can be asked for by name, as with a chatbot ("Tamil", "French").
  const translateToTyped = (event) => {
    event.preventDefault();
    const target = customLanguage.trim().replace(/\s+/g, ' ').toLowerCase();
    if (!target) return;
    setCustomLanguage('');
    showLanguage(target);
  };

  const languageOption = (id) => LANGUAGES.find((option) => option.id === id)
    || { id, label: packs[id]?.languageName || id.replace(/(^|\s)\p{Ll}/gu, (letter) => letter.toUpperCase()), lang: undefined };
  const originalLanguage = Object.keys(packs)[0] || viewLanguage;
  // The three quick choices, then every other language this pack was translated into.
  const translateOptions = [...LANGUAGES, ...Object.keys(packs).filter((id) => !LANGUAGES.some((option) => option.id === id)).map(languageOption)];
  const fullForSource = fullTexts.source === source ? fullTexts.byLanguage : {};
  const viewOption = languageOption(viewLanguage);

  // The whole notes or transcript in another language, translated part by part on the server.
  const translateWholeText = async (target) => {
    const text = source;
    setFullError('');
    setFullJob({ language: target, done: 0, total: null });
    try {
      const started = await studyApi.post('/api/notes/translate-jobs', { text, language: target });
      let job = null;
      while (!job || job.status === 'running') {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        job = await studyApi.get(`/api/notes/translate-jobs/${started.jobId}`);
        setFullJob({ language: target, done: job.partsDone, total: job.totalParts });
      }
      if (job.status !== 'done') throw new Error(job.error || 'The text could not be translated.');
      setFullTexts((current) => ({ source: text, byLanguage: { ...(current.source === text ? current.byLanguage : {}), [target]: job } }));
    } catch (requestError) {
      setFullError(requestError.message);
    } finally {
      setFullJob(null);
    }
  };

  // Opening the Full Text tab, or switching language on it, starts the translation.
  useEffect(() => {
    if (activeTab !== 'fulltext' || !source.trim() || fullJob || fullError || fullForSource[viewLanguage]) return;
    translateWholeText(viewLanguage);
  }, [activeTab, viewLanguage, source, fullJob, fullError, fullForSource]);

  const copyFullText = async () => {
    const full = fullForSource[viewLanguage];
    if (!full) return;
    await navigator.clipboard?.writeText(full.text);
    setCopiedFull(true);
    setTimeout(() => setCopiedFull(false), 1600);
  };

  const copyOutput = async () => {
    if (!result) return;
    const text = [
      result.title,
      ...result.points.map((point) => `- ${point}`),
      ...result.revision,
    ].join('\n');
    await navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-7xl">
        <div className="page-header mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">
              <Sparkles className="h-3.5 w-3.5" /> Study workspace
            </div>
            <h2 className="glow-text text-4xl font-black md:text-5xl">Notes Summarizer</h2>
            <p className="mt-3 max-w-2xl text-gray-300">Turn dense class material into a focused study pack with key points, flashcards, Q&A, and exam-ready revision notes.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400"><CheckCircle2 className="h-4 w-4 text-emerald-300" /> Frontend and backend study pack generation</div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
          <section className="glass-card rounded-3xl p-5 md:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div><h3 className="text-lg font-bold">Add your material</h3><p className="mt-1 text-xs text-gray-400">Choose a file, paste a YouTube or article link, or paste notes.</p></div>
              <button type="button" onClick={reset} className="rounded-lg border border-white/15 p-2 text-gray-300 transition hover:border-cyan-300/40 hover:text-cyan-200" title="Clear workspace"><RotateCcw className="h-4 w-4" /></button>
            </div>

            <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-cyan-300/35 bg-cyan-500/5 px-5 py-8 text-center transition hover:border-cyan-200/70 hover:bg-cyan-500/10">
              <Upload className="mb-3 h-7 w-7 text-cyan-200" />
              <span className="text-sm font-semibold text-cyan-100">Drop PDF, image, slides, or notes here</span>
              <span className="mt-1 text-xs text-gray-400">PDF, PNG, JPG, PPTX, TXT, MD, CSV</span>
              <input type="file" accept=".pdf,.png,.jpg,.jpeg,.ppt,.pptx,.odp,.txt,.md,.csv" className="sr-only" onChange={(event) => event.target.files?.[0] && readFile(event.target.files[0])} />
            </label>

            <div className="mt-4">
              <label htmlFor="notes-link" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-gray-300"><Link2 className="h-3.5 w-3.5 text-cyan-300" /> Or paste a YouTube video or article link</label>
              <div className="flex gap-2">
                <input
                  id="notes-link"
                  type="url"
                  value={linkUrl}
                  onChange={(event) => setLinkUrl(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); readLink(); } }}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="input-field min-w-0 flex-1 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-gray-500"
                />
                <button type="button" onClick={readLink} disabled={!linkUrl.trim() || extracting || loading} className="shrink-0 rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40">Get notes</button>
              </div>
              <p className="mt-1.5 text-[11px] text-gray-500">Works with English, Hindi and Telugu videos. Videos without captions are watched by AI (up to 45 minutes).</p>
            </div>

            {linkInfo?.title ? (
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                <Link2 className="h-5 w-5 shrink-0 text-cyan-300" />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white">{linkInfo.title}</p><p className="truncate text-xs text-gray-400">{linkInfo.detail}</p></div>
              </div>
            ) : null}

            {file ? (
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                {file.type.startsWith('image/') ? <FileImage className="h-5 w-5 text-pink-300" /> : <FileText className="h-5 w-5 text-cyan-300" />}
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white">{file.name}</p><p className="text-xs text-gray-400">{fileKind(file)} · {(file.size / 1024).toFixed(0)} KB</p></div>
              </div>
            ) : null}

            {previewUrl ? <img src={previewUrl} alt="Selected study material" className="mt-4 max-h-48 w-full rounded-xl border border-white/10 object-contain" /> : null}
            {extracting ? (
              <p className="mt-4 rounded-xl border border-cyan-300/25 bg-cyan-400/10 p-3 text-xs leading-relaxed text-cyan-100">
                {extractProgress
                  ? `Reading page ${extractProgress.done} of ${extractProgress.total} with OCR... ${extractSeconds}s`
                  : linkInfo
                    ? `${extractStage || 'Opening the link...'} ${extractSeconds}s`
                    : `Extracting text from ${fileKind(file)?.toLowerCase() || 'file'}... ${extractSeconds}s`}
                {extractProgress ? (
                  <span className="mt-2 block h-1.5 rounded-full bg-white/10"><span className="block h-1.5 rounded-full bg-cyan-300" style={{ width: `${Math.round((extractProgress.done / extractProgress.total) * 100)}%` }} /></span>
                ) : null}
                {!linkInfo && (extractProgress || extractSeconds >= 4) ? <span className="mt-2 block text-cyan-200/80">This is a scanned or handwritten document, so each page is read with OCR. Large files can take a few minutes. Please keep this page open.</span> : null}
              </p>
            ) : null}
            {extractWarning && !extracting ? <p className="mt-4 rounded-xl border border-amber-300/25 bg-amber-400/10 p-3 text-xs leading-relaxed text-amber-100">{extractWarning}</p> : null}
            {file && !source && !extracting && !file.type.startsWith('text/') ? <p className="mt-4 rounded-xl border border-amber-300/25 bg-amber-400/10 p-3 text-xs leading-relaxed text-amber-100">No text was extracted. Try a clearer file or paste the material below.</p> : null}

            <textarea value={source} onChange={(event) => setSource(event.target.value)} placeholder="Paste class notes, a lecture transcript, or extracted slide text..." className="input-field mt-4 min-h-64 w-full resize-y rounded-2xl p-4 text-sm leading-relaxed text-white placeholder:text-gray-500" />
            <div className="mt-2 flex items-center justify-between text-xs text-gray-500"><span>{sourceWordCount} words</span><span>Best with 100+ words</span></div>
            {error ? <p className="mt-4 rounded-xl border border-amber-300/25 bg-amber-400/10 p-3 text-xs leading-relaxed text-amber-100">{error}</p> : null}
            <div className="mt-5">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-gray-300"><Languages className="h-3.5 w-3.5 text-cyan-300" /> Summary language</p>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Summary language">
                {LANGUAGES.map((option) => {
                  // Once notes exist this shows, and changes, the language they are in.
                  const selected = (result ? viewLanguage : language) === option.id;
                  return (
                    <button
                      type="button"
                      key={option.id}
                      role="radio"
                      aria-checked={selected}
                      lang={option.lang}
                      onClick={() => (result ? showLanguage(option.id) : setLanguage(option.id))}
                      disabled={Boolean(translating)}
                      className={`rounded-lg px-2 py-2 text-xs font-semibold transition disabled:cursor-wait ${selected ? 'bg-cyan-500/20 text-cyan-100' : 'border border-white/10 text-gray-400 hover:text-white'}`}
                    >
                      {translating === option.id ? 'Translating…' : option.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[11px] text-gray-500">{result ? 'Click a language to translate the generated notes into it.' : 'Whatever language the material is in, the notes are written in this one.'}</p>
            </div>
            <button type="button" onClick={generate} disabled={(!source.trim() && !file) || loading || extracting} className="btn-primary mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-40"><Sparkles className="h-4 w-4" /> {loading ? 'Generating study pack...' : extracting ? 'Extracting text...' : 'Generate study pack'}</button>
          </section>

          <section className="glass-card rounded-3xl p-5 md:p-6">
            <div className="mb-5 flex flex-col gap-4 border-b border-white/10 pb-4 md:flex-row md:items-center md:justify-between">
              <div><p className="text-xs uppercase tracking-[0.16em] text-cyan-300">Generated output</p><h3 className="mt-1 text-2xl font-bold">{result?.title || 'Your study pack is waiting'}</h3>{result ? <div className="mt-2"><EngineBadge engine={result.engine || 'rule-based'} /></div> : null}</div>
              {result ? (
                <div className="flex flex-wrap gap-2 self-start">
                  <button type="button" onClick={saveToLibrary} disabled={!source.trim()} className="flex items-center gap-2 whitespace-nowrap rounded-lg border border-white/15 px-3 py-2 text-xs text-gray-200 transition hover:border-cyan-300/40 hover:text-cyan-100 disabled:opacity-40"><Library className="h-3.5 w-3.5" /> Save to RAG library</button>
                  <button type="button" onClick={copyOutput} className="flex items-center gap-2 whitespace-nowrap rounded-lg border border-white/15 px-3 py-2 text-xs text-gray-200 transition hover:border-cyan-300/40 hover:text-cyan-100"><Clipboard className="h-3.5 w-3.5" /> {copied ? 'Copied' : 'Copy notes'}</button>
                </div>
              ) : null}
            </div>
            {libraryMessage ? <p className="mb-4 rounded-xl border border-cyan-300/25 bg-cyan-400/10 p-3 text-xs text-cyan-100">{libraryMessage}</p> : null}
            {result?.languageNote ? <p className="mb-4 rounded-xl border border-amber-300/25 bg-amber-400/10 p-3 text-xs text-amber-100">{result.languageNote}</p> : null}
            {result ? (
              <div className="mb-4 rounded-xl border border-cyan-300/15 bg-cyan-500/5 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-300"><Languages className="h-3.5 w-3.5 text-cyan-300" /> Translate notes to</span>
                  {translateOptions.map((option) => (
                    <button
                      type="button"
                      key={option.id}
                      lang={option.lang}
                      onClick={() => showLanguage(option.id)}
                      disabled={Boolean(translating)}
                      aria-pressed={viewLanguage === option.id}
                      className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:cursor-wait ${viewLanguage === option.id ? 'bg-cyan-500/20 text-cyan-100' : 'border border-white/10 text-gray-400 hover:text-white'}`}
                    >
                      {translating === option.id ? 'Translating…' : option.label}
                      {option.id === originalLanguage ? <span className="ml-1 font-normal opacity-70">(original)</span> : null}
                    </button>
                  ))}
                </div>
                <form onSubmit={translateToTyped} className="mt-2 flex gap-2">
                  <input
                    value={customLanguage}
                    onChange={(event) => setCustomLanguage(event.target.value)}
                    maxLength={30}
                    placeholder="Or type any language, e.g. Tamil, Kannada, Marathi, French"
                    aria-label="Translate notes to another language"
                    className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-100 placeholder:text-gray-500 focus:border-cyan-300/40 focus:outline-none"
                  />
                  <button type="submit" disabled={Boolean(translating) || !customLanguage.trim()} className="whitespace-nowrap rounded-lg bg-cyan-500/20 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/30 disabled:opacity-40">
                    {translating && !LANGUAGES.some((option) => option.id === translating) && !packs[translating] ? 'Translating…' : 'Translate'}
                  </button>
                </form>
                <p className="mt-2 text-[11px] text-gray-500">The whole pack (topics, key points, flashcards, Q&A, revision notes) and the Full Text tab switch to the language you pick.</p>
              </div>
            ) : null}
            {translateError ? <p className="mb-4 rounded-xl border border-amber-300/25 bg-amber-400/10 p-3 text-xs text-amber-100">{translateError}</p> : null}

            {!result ? <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-8 text-center"><Lightbulb className="mb-4 h-10 w-10 text-amber-200/70" /><p className="max-w-sm text-sm text-gray-300">Add notes on the left and generate a compact study pack in seconds.</p><p className="mt-2 text-xs text-gray-500">Every output stays editable and easy to copy into your revision workflow.</p></div> : (
              <>
                <div className="mb-5 flex flex-wrap gap-2">{OUTPUT_TABS.filter(({ id }) => (id !== 'topics' || result.outline?.length) && (id !== 'fulltext' || source.trim())).map(({ id, label, icon: Icon }) => <button type="button" key={id} onClick={() => setActiveTab(id)} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${activeTab === id ? 'bg-cyan-500/20 text-cyan-100' : 'border border-white/10 text-gray-400 hover:text-white'}`}><Icon className="h-3.5 w-3.5" />{label}</button>)}</div>
                {activeTab === 'topics' && result.outline?.length ? (
                  <div>
                    <p className="mb-1 text-sm text-gray-300">This document covers <span className="font-semibold text-white">{result.outline.length} main topics</span>.</p>
                    <p className="mb-4 text-xs text-gray-500">{OUTLINE_NOTES[result.outlineSource] || 'Detected from the document\'s headings.'}</p>
                    <ol className="space-y-3">
                      {result.outline.map((topic, index) => (
                        <li key={`${index}-${topic.title}`} className="rounded-xl border border-cyan-300/15 bg-cyan-500/5 p-4">
                          <div className="flex items-start gap-3">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 text-xs font-bold text-cyan-200">{index + 1}</span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <h4 className="font-semibold text-white">{topic.title}</h4>
                                {topic.page ? <span className="text-[11px] text-gray-500">page {topic.page}{topic.mentions ? ` · ${topic.mentions} mentions` : ''}</span> : null}
                              </div>
                              {topic.summary ? <p className="mt-1 text-sm leading-relaxed text-gray-300">{topic.summary}</p> : null}
                              {topic.summaryFromReference ? <p className="mt-1 text-[11px] text-amber-200/80">Your handwriting here could not be read clearly, so this is the standard explanation from the study knowledge base.</p> : null}
                              {topic.subtopics?.length ? <div className="mt-2 flex flex-wrap gap-1.5">{topic.subtopics.map((sub) => <span key={sub.name} title={sub.detail || ''} className="rounded-full bg-purple-400/10 px-2.5 py-0.5 text-[11px] text-purple-100">{sub.name}</span>)}</div> : null}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}
                {activeTab === 'summary' ?<div className="space-y-3">{result.points.map((point, index) => <div key={point} className="flex gap-3 rounded-xl border border-cyan-300/15 bg-cyan-500/5 p-4"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 text-xs font-bold text-cyan-200">{index + 1}</span><p className="text-sm leading-relaxed text-gray-200">{point}</p></div>)}<div className="mt-5 rounded-xl border border-amber-300/15 bg-amber-400/5 p-4"><p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-amber-200">Key terms</p><div className="flex flex-wrap gap-2">{result.keywords.map((keyword) => <span key={keyword} className="rounded-full bg-amber-300/10 px-3 py-1 text-xs text-amber-100">{keyword}</span>)}</div></div><div className="mt-5 rounded-xl border border-purple-300/15 bg-purple-500/5 p-4"><p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-purple-200">Topics to read</p><div className="space-y-2">{(result.readingGuide || result.topics || []).map((topic) => <p key={topic} className="text-sm text-purple-100">• {topic}</p>)}</div></div></div> : null}
                {activeTab === 'flashcards' ? <div className="grid gap-3 md:grid-cols-2">{result.flashcards.map((card) => <article key={card.question} className="rounded-xl border border-violet-300/15 bg-violet-500/5 p-4"><p className="text-sm font-semibold text-violet-100">{card.question}</p><p className="mt-3 border-t border-white/10 pt-3 text-xs leading-relaxed text-gray-300">{card.answer}</p></article>)}</div> : null}
                {activeTab === 'qa' ? <div className="space-y-3">{result.qa.map((pair) => <article key={pair.question} className="rounded-xl border border-emerald-300/15 bg-emerald-500/5 p-4"><p className="text-sm font-semibold text-emerald-100">{pair.question}</p><p className="mt-2 text-sm leading-relaxed text-gray-300">{pair.answer}</p></article>)}</div> : null}
                {activeTab === 'fulltext' ? (
                  <div>
                    {fullForSource[viewLanguage] ? (
                      <>
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs text-gray-400">
                            {fullForSource[viewLanguage].sameLanguage
                              ? `Your material is already in ${viewOption.label}, so this is the original text.`
                              : `Your whole material, translated into ${viewOption.label}. Pick another language above to read it in that language.`}
                          </p>
                          <button type="button" onClick={copyFullText} className="flex items-center gap-2 whitespace-nowrap rounded-lg border border-white/15 px-3 py-1.5 text-xs text-gray-200 transition hover:border-cyan-300/40 hover:text-cyan-100"><Clipboard className="h-3.5 w-3.5" /> {copiedFull ? 'Copied' : 'Copy text'}</button>
                        </div>
                        {fullForSource[viewLanguage].failedParts ? <p className="mb-3 rounded-xl border border-amber-300/25 bg-amber-400/10 p-3 text-xs text-amber-100">AI was busy for {fullForSource[viewLanguage].failedParts} of {fullForSource[viewLanguage].parts} parts, so those parts are still in the original language. <button type="button" onClick={() => translateWholeText(viewLanguage)} disabled={Boolean(fullJob)} className="ml-1 font-semibold underline disabled:opacity-50">Retry</button></p> : null}
                        {fullForSource[viewLanguage].truncated ? <p className="mb-3 rounded-xl border border-amber-300/25 bg-amber-400/10 p-3 text-xs text-amber-100">The material is very long, so only the first 120,000 characters were translated.</p> : null}
                        <div lang={viewOption.lang} className="max-h-[560px] overflow-y-auto whitespace-pre-wrap rounded-xl border border-cyan-300/15 bg-cyan-500/5 p-4 text-sm leading-relaxed text-gray-200">{fullForSource[viewLanguage].text}</div>
                      </>
                    ) : fullError ? (
                      <div className="rounded-xl border border-amber-300/25 bg-amber-400/10 p-4 text-xs text-amber-100">
                        <p>{fullError}</p>
                        <button type="button" onClick={() => translateWholeText(viewLanguage)} className="mt-3 rounded-lg border border-amber-200/30 px-3 py-1.5 font-semibold transition hover:bg-amber-300/10">Try again</button>
                      </div>
                    ) : (
                      <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 p-6 text-center">
                        <RotateCcw className="h-6 w-6 animate-spin text-cyan-300" />
                        <p className="text-sm text-gray-200">Translating your whole material into {viewOption.label}…</p>
                        <p className="text-xs text-gray-500">{fullJob?.total ? `Part ${fullJob.done} of ${fullJob.total} done` : 'Starting'} · a one-hour lecture takes a few minutes. If the AI is busy it waits and carries on, so keep this page open.</p>
                      </div>
                    )}
                  </div>
                ) : null}
                {activeTab === 'revision' ? <div className="rounded-xl border border-rose-300/15 bg-rose-500/5 p-5"><ul className="space-y-4">{result.revision.map((note) => <li key={note} className="flex gap-3 text-sm leading-relaxed text-gray-200"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-rose-300" />{note}</li>)}</ul></div> : null}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
