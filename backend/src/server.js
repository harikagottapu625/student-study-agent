import 'dotenv/config';
import { promisify } from 'node:util';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import multer from 'multer';
import { PDFParse } from 'pdf-parse';
import { getRoleCatalog, getStudentCatalog, seedDatasets } from './datasetStore.js';
import { countTopics, findTopic, listTopics, seedKnowledgeBase } from './knowledgeBase.js';
import { analyzeSkillGap } from './analysisService.js';
import { generateRoadmap } from './roadmapService.js';
import {
  generateAiAdvisor,
  generateRoadmapLearningModules,
} from './mistralService.js';
import { AnalysisRecord } from './analysisRecordModel.js';
import { ProfileRecord } from './profileRecordModel.js';
import { User } from './userModel.js';
import { createLocalUser, findLocalUser } from './localUserStore.js';
import { recognizeImageText, recognizePdfText } from './notesOcrService.js';
import { dropNoiseLines, textQuality } from './textQuality.js';
import { topicTermLines } from './topicSpotter.js';
import { extractSlideText } from './slideTextService.js';
import { extractLinkText } from './linkTextService.js';
import { storageMode } from './studyStore.js';
import { aiStatus } from './agents/aiClient.js';
import { AGENTS, handleMessage } from './agents/coordinatorAgent.js';
import { extractDeadlines } from './agents/deadlineAgent.js';
import { getMemory, updateMemory } from './agents/memoryAgent.js';
import { planStudy } from './agents/plannerAgent.js';
import { generateQuiz, getPerformance, getRetention, submitQuiz } from './agents/quizAgent.js';
import { addDocument, answerQuestion, deleteDocument, listDocuments } from './agents/ragAgent.js';
import { summarizeStudyMaterial, translateStudyPack } from './agents/summarizerAgent.js';
import { translateFullText } from './translateService.js';
import { tutorConcept } from './agents/tutorAgent.js';

const app = express();
const port = Number(process.env.PORT || 4000);

// Express 4 does not catch errors from async route handlers, so a database
// hiccup (e.g. Atlas dropping the connection mid-request) would crash the
// whole server. Route every handler's rejection to the error middleware.
for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
  const register = app[method].bind(app);
  app[method] = (path, ...handlers) => {
    if (!handlers.length) return register(path); // app.get('setting')
    return register(path, ...handlers.map((handler) => (typeof handler === 'function' && handler.length < 4
      ? (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
      : handler)));
  };
}

// Last line of defence: log stray rejections instead of exiting.
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error?.message || error);
});
const scryptAsync = promisify(scrypt);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const configuredOrigins = (process.env.FRONTEND_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = new Set([
  ...configuredOrigins,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
]);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
  }),
);
// Full lecture transcripts are sent for translation, so allow more than the 100 KB default.
app.use(express.json({ limit: '2mb' }));

let mongoConnectionState = 'disconnected';

mongoose.connection.on('connected', () => {
  mongoConnectionState = 'connected';
});

mongoose.connection.on('disconnected', () => {
  mongoConnectionState = 'disconnected';
});

mongoose.connection.on('error', () => {
  mongoConnectionState = 'failed';
});

const saveAnalysisRecord = async (record) => {
  if (mongoConnectionState !== 'connected') return;
  try {
    await AnalysisRecord.create(record);
  } catch (error) {
    console.error('Failed to persist analysis record:', error.message);
  }
};

// Keeps retrying a failed first connection (for example while the Atlas IP
// whitelist is being updated), so the backend switches to MongoDB without a restart.
const MONGO_RETRY_MS = 30 * 1000;

const connectMongo = () =>
  mongoose
    .connect(process.env.MONGODB_URI, {
      dbName: process.env.MONGODB_DB_NAME || undefined,
      serverSelectionTimeoutMS: 15000,
    })
    .then(() => {
      mongoConnectionState = 'connected';
      console.log('MongoDB Atlas connected');
      return Promise.all([seedDatasets(), seedKnowledgeBase()])
        .then(([datasets, knowledge]) => console.log(
          `Seeded MongoDB: ${datasets.roles} role(s), ${datasets.students} student(s), ${knowledge.inserted} new and ${knowledge.updated} updated knowledge topic(s)`,
        ))
        .catch((error) => console.error('Seeding MongoDB failed:', error.message));
    })
    .catch((error) => {
      mongoConnectionState = 'failed';
      console.error(`MongoDB connection failed. Continuing with CSV mode and retrying in ${MONGO_RETRY_MS / 1000}s.`, error.message);
      setTimeout(connectMongo, MONGO_RETRY_MS);
    });

if (process.env.MONGODB_URI) {
  connectMongo();
} else {
  mongoConnectionState = 'missing-uri';
}

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    mode: mongoConnectionState === 'connected' ? 'mongo+csv' : 'csv',
    mongoConnectionState,
    message: 'Student Study Agent API is running',
  });
});

const normalizeAuthEmail = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

const hashPassword = async (password, salt = randomBytes(16).toString('hex')) => {
  const derivedKey = await scryptAsync(password, salt, 64);
  return { passwordHash: derivedKey.toString('hex'), passwordSalt: salt };
};

const isPasswordValid = async (password, user) => {
  const derivedKey = await scryptAsync(password, user.passwordSalt, 64);
  const storedKey = Buffer.from(user.passwordHash, 'hex');
  return storedKey.length === derivedKey.length && timingSafeEqual(storedKey, derivedKey);
};

app.post('/api/auth/register', async (req, res) => {
  const email = normalizeAuthEmail(req.body?.email);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  const existingUser = mongoConnectionState === 'connected'
    ? await User.findOne({ email }).lean()
    : await findLocalUser(email);
  if (existingUser) {
    return res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
  }

  const { passwordHash, passwordSalt } = await hashPassword(password);
  if (mongoConnectionState === 'connected') {
    const user = await User.create({ email, passwordHash, passwordSalt });
    return res.status(201).json({ user: { id: user._id, email: user.email }, storage: 'mongodb' });
  }

  const user = await createLocalUser({
    id: randomBytes(12).toString('hex'),
    email,
    passwordHash,
    passwordSalt,
  });
  if (!user) {
    return res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
  }
  return res.status(201).json({ user: { id: user.id, email: user.email }, storage: 'local' });
});

app.post('/api/auth/login', async (req, res) => {
  const email = normalizeAuthEmail(req.body?.email);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const user = mongoConnectionState === 'connected'
    ? await User.findOne({ email })
    : await findLocalUser(email);

  if (!user || !(await isPasswordValid(password, user))) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  return res.json({
    user: { id: user._id || user.id, email: user.email },
    storage: mongoConnectionState === 'connected' ? 'mongodb' : 'local',
  });
});

app.get('/api/roles', async (_req, res) => {
  try {
    return res.json(await getRoleCatalog());
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unable to load roles.' });
  }
});

app.get('/api/students', async (_req, res) => {
  try {
    return res.json(await getStudentCatalog());
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unable to load students.' });
  }
});

app.get('/api/knowledge/topics', async (_req, res) => {
  try {
    return res.json({ topics: await listTopics() });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unable to load knowledge topics.' });
  }
});

app.get('/api/knowledge/search', async (req, res) => {
  try {
    return res.json(await findTopic(String(req.query?.q || '')));
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unable to search knowledge topics.' });
  }
});

// Study agents identify the student by the userId the client sends (signed-in
// email or a per-browser guest id).
const studyUserId = (req) => {
  const raw = req.body?.userId ?? req.query?.userId ?? '';
  const value = String(raw).trim().toLowerCase().slice(0, 120);
  return /^[a-z0-9@._+-]+$/.test(value) ? value : 'guest';
};

const sendAgentError = (res, error, fallbackMessage) =>
  res.status(error.status || 500).json({ error: error.message || fallbackMessage });

app.get('/api/agents', async (req, res) => {
  const userId = studyUserId(req);
  const documents = await listDocuments(userId).catch(() => []);
  return res.json({ agents: AGENTS, ai: aiStatus(), storage: storageMode(), libraryDocuments: documents.length, knowledgeTopics: await countTopics().catch(() => 0) });
});

app.post('/api/agent/chat', upload.single('material'), async (req, res) => {
  try {
    const attachmentText = req.file ? await extractStudyMaterialText(req.file) : '';
    return res.json(await handleMessage({
      userId: studyUserId(req),
      message: req.body?.message,
      attachmentText,
      today: req.body?.today,
      mood: req.body?.mood,
    }));
  } catch (error) {
    return sendAgentError(res, error, 'The study agent could not answer.');
  }
});

app.get('/api/memory', async (req, res) => {
  try {
    return res.json(await getMemory(studyUserId(req)));
  } catch (error) {
    return sendAgentError(res, error, 'Unable to load study memory.');
  }
});

app.put('/api/memory', async (req, res) => {
  try {
    return res.json(await updateMemory(studyUserId(req), req.body || {}));
  } catch (error) {
    return sendAgentError(res, error, 'Unable to update study memory.');
  }
});

app.post('/api/study-planner', async (req, res) => {
  try {
    return res.json(await planStudy({ ...req.body, userId: studyUserId(req) }));
  } catch (error) {
    return sendAgentError(res, error, 'Unable to create study plan.');
  }
});

app.post('/api/assignments/extract', async (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!text) return res.status(400).json({ error: 'Message or document text is required.' });
  try {
    return res.json(await extractDeadlines({ text, today: req.body.today }));
  } catch (error) {
    return sendAgentError(res, error, 'Unable to extract assignments.');
  }
});

// meta (optional) receives how the text was obtained: method 'text-layer' | 'ocr' | ...
// Handwriting OCR reads margins, ruling and scribbles as junk lines; drop the
// lines with no recognisable words (keeping any that name a topic) so the text
// students see and edit is readable. Printed scans are left untouched.
const tidyOcrText = (text) =>
  textQuality(text).realWordRatio < 0.75 ? dropNoiseLines(text, { keep: topicTermLines(text) }) : text;

const extractStudyMaterialText = async (file, providedText = '', { onProgress, meta = {} } = {}) => {
  let text = providedText;
  if (!file) return text;

  const lowerName = String(file.originalname || '').toLowerCase();
  const isPdf = file.mimetype === 'application/pdf' || lowerName.endsWith('.pdf');
  const isText = file.mimetype.startsWith('text/') || /\.(txt|md|csv)$/i.test(lowerName);

  if (isPdf) {
    const parser = new PDFParse({ data: file.buffer });
    const parsed = await parser.getText();
    text = parsed.text || text;
    await parser.destroy();
    meta.method = 'text-layer';
    // Scanned PDFs have no text layer, and scanner apps often embed a garbage
    // one for handwritten notes; in both cases read the pages with our own OCR.
    if (!textQuality(text.replace(/--\s*\d+\s+of\s+\d+\s*--/gi, ' ')).readable) {
      text = tidyOcrText(await recognizePdfText(file.buffer, { onProgress }));
      meta.method = 'ocr';
    }
  } else if (isText) {
    text = file.buffer.toString('utf8');
    meta.method = 'text';
  } else if (file.mimetype.startsWith('image/') || /\.(png|jpe?g|webp|bmp)$/i.test(lowerName)) {
    text = tidyOcrText(await recognizeImageText(file.buffer));
    meta.method = 'ocr';
  } else if (/\.(pptx|odp)$/i.test(lowerName)) {
    text = await extractSlideText(file.buffer, lowerName.slice(lowerName.lastIndexOf('.')));
  } else if (!text.trim()) {
    const error = new Error('Unsupported study material format. Upload a PDF, image, PPTX, ODP, TXT, MD, or CSV file.');
    error.status = 415;
    throw error;
  }

  return text;
};

app.post('/api/notes/extract', upload.single('material'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Study material file is required.' });

  try {
    const text = await extractStudyMaterialText(req.file);
    if (!text.trim()) {
      return res.status(422).json({ error: 'No readable text was found in this study material.' });
    }
    return res.json({ fileName: req.file.originalname, text: text.trim() });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || 'Failed to extract study material.' });
  }
});

// Background extraction jobs: OCR of long scanned or handwritten PDFs takes
// minutes, so the client starts a job and polls it for page-by-page progress.
const extractJobs = new Map();
const JOB_TTL_MS = 15 * 60 * 1000;

app.post('/api/notes/extract-jobs', upload.single('material'), (req, res) => {
  const link = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
  if (!req.file && !link) return res.status(400).json({ error: 'Upload a study material file or paste a link.' });

  const id = `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const job = { id, fileName: req.file?.originalname || link, status: 'running', method: null, stage: '', pagesDone: 0, totalPages: null, text: '', error: '', createdAt: Date.now() };
  extractJobs.set(id, job);
  for (const [jobId, oldJob] of extractJobs) {
    if (Date.now() - oldJob.createdAt > JOB_TTL_MS) extractJobs.delete(jobId);
  }

  // A YouTube video or web page: captions, or AI watching the video, or the article text.
  if (link) {
    extractLinkText(link, { onStage: (stage) => { job.stage = stage; } })
      .then((result) => {
        job.text = result.text.trim();
        job.method = result.method;
        job.title = result.title;
        job.detail = [result.detail, result.author].filter(Boolean).join(' · ');
        job.status = job.text ? 'done' : 'failed';
        job.error = job.text ? '' : 'No readable text was found at that link.';
      })
      .catch((error) => {
        job.status = 'failed';
        job.error = error.message || 'Could not read that link.';
      });
    return res.status(202).json({ jobId: id });
  }

  const meta = {};
  extractStudyMaterialText(req.file, '', {
    meta,
    onProgress: (done, total) => {
      job.method = 'ocr';
      job.pagesDone = done;
      job.totalPages = total;
    },
  })
    .then((text) => {
      const quality = textQuality(text);
      job.text = text.trim();
      job.method = meta.method || job.method;
      job.status = job.text ? 'done' : 'failed';
      job.error = job.text ? '' : 'No readable text was found in this study material.';
      // Handwriting OCR is imperfect; tell the student when the text is noisy.
      job.warning = meta.method === 'ocr' && quality.realWordRatio < 0.75
        ? 'Parts of this document (likely handwriting) could not be read clearly. Check the extracted text and fix important words before generating.'
        : '';
    })
    .catch((error) => {
      job.status = 'failed';
      job.error = error.message || 'Failed to extract study material.';
    });

  return res.status(202).json({ jobId: id });
});

app.get('/api/notes/extract-jobs/:id', (req, res) => {
  const job = extractJobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Extraction job not found. Please upload the file again.' });
  const { createdAt, ...publicJob } = job;
  return res.json(job.status === 'done' ? publicJob : { ...publicJob, text: '' });
});

app.post('/api/notes/summarize', upload.single('material'), async (req, res) => {
  const file = req.file;
  const providedText = typeof req.body?.text === 'string' ? req.body.text : '';
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const language = typeof req.body?.language === 'string' ? req.body.language.toLowerCase() : 'english';
  const sourceKind = req.body?.sourceKind === 'transcript' ? 'transcript' : 'notes';

  try {
    const text = await extractStudyMaterialText(file, providedText);
    const fileTitle = title || (file?.originalname || '').replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ');
    return res.json({
      sourceType: file ? file.mimetype || 'file' : 'text',
      studyPack: await summarizeStudyMaterial({ userId: studyUserId(req), text, title: fileTitle || 'Class Notes', language, sourceKind }),
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.message || 'Failed to summarize study material.',
    });
  }
});

app.post('/api/notes/translate', async (req, res) => {
  const language = typeof req.body?.language === 'string' ? req.body.language.toLowerCase() : '';
  try {
    return res.json({ studyPack: await translateStudyPack({ pack: req.body?.pack, language }) });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || 'Failed to translate the study pack.' });
  }
});

// Full-text translation runs as a job too: a long transcript is many parts.
const translateJobs = new Map();

app.post('/api/notes/translate-jobs', (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text : '';
  const language = typeof req.body?.language === 'string' ? req.body.language.toLowerCase() : '';
  if (!text.trim()) return res.status(400).json({ error: 'There is no text to translate. Add notes or a link first.' });

  const id = `translate-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const job = { id, status: 'running', language, partsDone: 0, totalParts: null, text: '', error: '', createdAt: Date.now() };
  translateJobs.set(id, job);
  for (const [jobId, oldJob] of translateJobs) {
    if (Date.now() - oldJob.createdAt > JOB_TTL_MS) translateJobs.delete(jobId);
  }

  translateFullText(text, language, {
    onProgress: (done, total) => {
      job.partsDone = done;
      job.totalParts = total;
    },
  })
    .then((result) => Object.assign(job, result, { status: 'done' }))
    .catch((error) => {
      job.status = 'failed';
      job.error = error.message || 'Failed to translate the text.';
    });
  return res.status(202).json({ jobId: id });
});

app.get('/api/notes/translate-jobs/:id', (req, res) => {
  const job = translateJobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Translation job not found. Please translate again.' });
  const { createdAt, ...publicJob } = job;
  return res.json(publicJob);
});

app.post('/api/retrieval/query', upload.single('material'), async (req, res) => {
  const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
  const providedText = typeof req.body?.text === 'string' ? req.body.text : '';
  try {
    const text = await extractStudyMaterialText(req.file, providedText);
    if (!text.trim()) return res.status(422).json({ error: 'Upload or paste readable study material first.' });
    return res.json(await answerQuestion({
      userId: studyUserId(req),
      text,
      question,
      sourceName: req.file?.originalname || 'Pasted study material',
    }));
  } catch (error) {
    return sendAgentError(res, error, 'Failed to search study material.');
  }
});

app.get('/api/rag/documents', async (req, res) => {
  try {
    return res.json({ documents: await listDocuments(studyUserId(req)) });
  } catch (error) {
    return sendAgentError(res, error, 'Unable to load the study library.');
  }
});

app.post('/api/rag/documents', upload.single('material'), async (req, res) => {
  const providedText = typeof req.body?.text === 'string' ? req.body.text : '';
  try {
    const text = await extractStudyMaterialText(req.file, providedText);
    if (!text.trim()) return res.status(422).json({ error: 'Upload a file or paste text to add to the library.' });
    const name = (typeof req.body?.name === 'string' && req.body.name.trim()) || req.file?.originalname || 'Pasted notes';
    const document = await addDocument({ userId: studyUserId(req), name, text, sourceType: req.file?.mimetype || 'text' });
    return res.status(201).json({ document });
  } catch (error) {
    return sendAgentError(res, error, 'Unable to add the document to the library.');
  }
});

app.delete('/api/rag/documents/:id', async (req, res) => {
  try {
    const removed = await deleteDocument(studyUserId(req), req.params.id);
    return removed ? res.json({ removed: true }) : res.status(404).json({ error: 'Document not found.' });
  } catch (error) {
    return sendAgentError(res, error, 'Unable to delete the document.');
  }
});

app.post('/api/rag/query', async (req, res) => {
  try {
    return res.json(await answerQuestion({
      userId: studyUserId(req),
      question: req.body?.question,
      documentIds: Array.isArray(req.body?.documentIds) ? req.body.documentIds : undefined,
    }));
  } catch (error) {
    return sendAgentError(res, error, 'Unable to answer from the study library.');
  }
});

app.post('/api/tutor/explain', async (req, res) => {
  try {
    return res.json(await tutorConcept({ ...req.body, userId: studyUserId(req) }));
  } catch (error) {
    return sendAgentError(res, error, 'The tutor could not explain this topic.');
  }
});

app.post('/api/quiz/generate', async (req, res) => {
  try {
    return res.json(await generateQuiz({ ...req.body, userId: studyUserId(req) }));
  } catch (error) {
    return sendAgentError(res, error, 'Unable to generate a quiz.');
  }
});

app.post('/api/quiz/submit', async (req, res) => {
  try {
    return res.json(await submitQuiz({ userId: studyUserId(req), quizId: req.body?.quizId, answers: req.body?.answers || {} }));
  } catch (error) {
    return sendAgentError(res, error, 'Unable to grade the quiz.');
  }
});

app.get('/api/quiz/performance', async (req, res) => {
  try {
    return res.json(await getPerformance(studyUserId(req)));
  } catch (error) {
    return sendAgentError(res, error, 'Unable to load quiz performance.');
  }
});

app.get('/api/retention', async (req, res) => {
  try {
    const date = typeof req.query?.date === 'string' && !Number.isNaN(new Date(req.query.date).getTime()) ? req.query.date : '';
    return res.json(await getRetention(studyUserId(req), date));
  } catch (error) {
    return sendAgentError(res, error, 'Unable to load memory strength.');
  }
});

app.post('/api/resume/parse', upload.single('resume'), async (req, res) => {
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: 'Resume file is required.' });
  }

  try {
    const lowerName = String(file.originalname || '').toLowerCase();
    const isPdf = file.mimetype === 'application/pdf' || lowerName.endsWith('.pdf');
    const isText =
      file.mimetype.startsWith('text/') ||
      lowerName.endsWith('.txt') ||
      lowerName.endsWith('.md');

    let text = '';

    if (isPdf) {
      const parser = new PDFParse({ data: file.buffer });
      const parsed = await parser.getText();
      text = parsed.text || '';
      await parser.destroy();
    } else if (isText) {
      text = file.buffer.toString('utf8');
    } else {
      return res.status(415).json({
        error: 'Unsupported resume format. Upload a PDF, TXT, or MD file.',
      });
    }

    const normalizedText = text.replace(/\s+/g, ' ').trim();

    if (!normalizedText) {
      return res.status(422).json({ error: 'Could not extract readable text from the uploaded resume.' });
    }

    return res.json({
      fileName: file.originalname,
      text: normalizedText,
      preview: normalizedText.slice(0, 3000),
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Failed to parse resume.',
    });
  }
});

app.post('/api/profiles', async (req, res) => {
  if (mongoConnectionState !== 'connected') {
    return res.status(503).json({
      error: 'MongoDB is not connected. Profile cannot be saved right now.',
      mongoConnectionState,
    });
  }

  const {
    studentId,
    studentName,
    email,
    targetRole,
    studentSkills,
    careerInterests,
    completedCourses,
    projects,
    resumeFileName,
    resumeText,
  } = req.body || {};

  const saved = await ProfileRecord.create({
    studentId: studentId || 'FORM-SUBMITTED',
    studentName: studentName || 'Custom Student',
    email: email || '',
    targetRole: targetRole || '',
    studentSkills: studentSkills && typeof studentSkills === 'object' ? studentSkills : {},
    careerInterests: Array.isArray(careerInterests) ? careerInterests : [],
    completedCourses: Array.isArray(completedCourses) ? completedCourses : [],
    projects: Array.isArray(projects) ? projects : [],
    resumeFileName: resumeFileName || '',
    resumeText: typeof resumeText === 'string' ? resumeText : '',
  });

  return res.status(201).json({ id: saved._id, message: 'Profile saved' });
});

app.get('/api/profiles', async (_req, res) => {
  if (mongoConnectionState !== 'connected') {
    return res.status(503).json({
      error: 'MongoDB is not connected.',
      mongoConnectionState,
    });
  }

  const records = await ProfileRecord.find({}).sort({ createdAt: -1 }).limit(100).lean();
  return res.json(records);
});

const normalizeRoleKey = (value = '') =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const roleAliases = {
  'full stack developer': 'software developer',
  'fullstack developer': 'software developer',
  'software engineer': 'software developer',
};

const buildAnalysisPayload = async (input) => {
  const {
    studentId,
    studentName,
    educationLevel,
    completedCourses,
    projects,
    careerInterests,
    targetRole,
    studentSkills,
    resumeFileName,
    resumeText,
  } = input;

  const [roles, students] = await Promise.all([getRoleCatalog(), getStudentCatalog()]);

  const requestedRoleKey = normalizeRoleKey(targetRole);
  const canonicalRequestedRole = roleAliases[requestedRoleKey] || requestedRoleKey;

  const role = roles.find((item) => {
    const roleNameKey = normalizeRoleKey(item.roleName);
    const roleIdKey = normalizeRoleKey(item.id);
    return roleNameKey === canonicalRequestedRole || roleIdKey === canonicalRequestedRole;
  });
  if (!role) {
    return { error: `Role not found: ${targetRole}`, status: 404 };
  }

  const hasDynamicSkills =
    studentSkills && typeof studentSkills === 'object' && Object.keys(studentSkills).length > 0;

  let student = students.find((item) => item.studentId === studentId);
  if (!student) {
    student = {
      studentId: studentId || 'MANUAL',
      name: studentName || 'Custom Student',
      educationLevel: educationLevel || '',
      skills: hasDynamicSkills ? studentSkills : {},
      completedCourses: Array.isArray(completedCourses) ? completedCourses : [],
      projects: Array.isArray(projects) ? projects : [],
      careerInterests: Array.isArray(careerInterests) ? careerInterests : [],
      resumeFileName: resumeFileName || '',
      resumeText: typeof resumeText === 'string' ? resumeText : '',
    };
  } else {
    student = {
      ...student,
      name: studentName || student.name,
      educationLevel: educationLevel || student.educationLevel,
      skills: hasDynamicSkills ? studentSkills : student.skills,
      completedCourses: Array.isArray(completedCourses) ? completedCourses : student.completedCourses,
      projects: Array.isArray(projects) ? projects : student.projects,
      careerInterests: Array.isArray(careerInterests) ? careerInterests : student.careerInterests,
      resumeFileName: resumeFileName || student.resumeFileName || '',
      resumeText: typeof resumeText === 'string' ? resumeText : student.resumeText || '',
    };
  }

  const analysis = analyzeSkillGap({ role, student });
  const roadmap = generateRoadmap(analysis);

  return {
    role,
    student,
    payload: {
      ...analysis,
      recommendedTools: role.recommendedTools,
      roleDescription: role.roleDescription,
      roadmap,
    },
  };
};

app.post('/api/analyze', async (req, res) => {
  const result = await buildAnalysisPayload(req.body);
  if (result.error) {
    return res.status(result.status).json({ error: result.error });
  }

  const { role, student, payload } = result;
  const includeAiAdvisor = Boolean(req.body.includeAiAdvisor);

  if (includeAiAdvisor) {
    try {
      const aiAdvisor = await generateAiAdvisor({
        analysis: payload,
        role,
        student,
      });

      await saveAnalysisRecord({
        studentId: student.studentId,
        studentName: student.name,
        roleId: role.id,
        roleName: role.roleName,
        includeAiAdvisor,
        requestPayload: req.body,
        analysisPayload: payload,
        aiAdvisor,
      });

      return res.json({ ...payload, aiAdvisor });
    } catch (error) {
      return res.json({
        ...payload,
        aiAdvisorError: error.message,
      });
    }
  }

  await saveAnalysisRecord({
    studentId: student.studentId,
    studentName: student.name,
    roleId: role.id,
    roleName: role.roleName,
    includeAiAdvisor,
    requestPayload: req.body,
    analysisPayload: payload,
    aiAdvisor: null,
  });

  return res.json(payload);
});

app.post('/api/analyze/ai-advisor', async (req, res) => {
  const result = await buildAnalysisPayload(req.body);
  if (result.error) {
    return res.status(result.status).json({ error: result.error });
  }

  try {
    const aiAdvisor = await generateAiAdvisor({
      analysis: result.payload,
      role: result.role,
      student: result.student,
    });

    await saveAnalysisRecord({
      studentId: result.student.studentId,
      studentName: result.student.name,
      roleId: result.role.id,
      roleName: result.role.roleName,
      includeAiAdvisor: true,
      requestPayload: req.body,
      analysisPayload: result.payload,
      aiAdvisor,
    });

    return res.json({ aiAdvisor });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/roadmap/modules', async (req, res) => {
  const {
    targetRole,
    phaseName,
    selectedCourse,
    quickMode,
    studentName,
    careerInterests,
    completedCourses,
    projects,
    resumeText,
  } = req.body || {};

  const safeCourse = typeof selectedCourse === 'string' ? selectedCourse.trim() : '';
  if (!safeCourse) {
    return res.status(400).json({ error: 'selectedCourse is required.' });
  }

  try {
    const roadmapModules = await generateRoadmapLearningModules({
      roleName: targetRole || '',
      phaseName: typeof phaseName === 'string' ? phaseName : '',
      selectedCourse: safeCourse,
      quickMode: Boolean(quickMode),
      student: {
        name: studentName || 'Custom Student',
        careerInterests: Array.isArray(careerInterests) ? careerInterests : [],
        completedCourses: Array.isArray(completedCourses) ? completedCourses : [],
        projects: Array.isArray(projects) ? projects : [],
        resumeText: typeof resumeText === 'string' ? resumeText : '',
      },
    });

    return res.json({ roadmapModules });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unable to generate roadmap modules.' });
  }
});

app.get('/api/analyses', async (_req, res) => {
  if (mongoConnectionState !== 'connected') {
    return res.status(503).json({
      error: 'MongoDB is not connected. Set MONGODB_URI for Atlas and restart backend.',
      mongoConnectionState,
    });
  }

  const records = await AnalysisRecord.find({}).sort({ createdAt: -1 }).limit(100).lean();
  return res.json(records);
});

app.use((err, req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Study material is too large. Please upload a file smaller than 50 MB.' });
    }
    return res.status(400).json({ error: `Study material upload failed: ${err.message}` });
  }

  if (err?.message?.includes('Origin not allowed by CORS')) {
    return res.status(403).json({ error: err.message });
  }

  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON request body.' });
  }

  // MongoServerSelectionError, MongoNetworkError, etc.
  if (/^Mongo/.test(err?.name || '')) {
    console.error('Database request failed:', err.message);
    return res.status(503).json({ error: 'The database is temporarily unreachable. Please try again in a moment.' });
  }

  const statusCode = Number(err?.statusCode || err?.status || 500);
  return res.status(statusCode).json({
    error: err?.message || 'Unexpected server error.',
  });
});

app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});
