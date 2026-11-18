import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import mongoose from 'mongoose';

// One generic store for every agent (RAG documents, quizzes, attempts, memory).
// Uses MongoDB when connected and falls back to a local JSON file otherwise.

const StudyRecordSchema = new mongoose.Schema(
  {
    kind: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    recordId: { type: String, required: true },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    minimize: false,
  },
);

StudyRecordSchema.index({ kind: 1, userId: 1, recordId: 1 }, { unique: true });

export const StudyRecord = mongoose.models.StudyRecord || mongoose.model('StudyRecord', StudyRecordSchema);

const storeFile = resolve(process.cwd(), 'data', 'study_store.json');
const isMongoReady = () => mongoose.connection.readyState === 1;

let localCache = null;
let writeQueue = Promise.resolve();

const loadLocal = async () => {
  if (localCache) return localCache;
  try {
    const parsed = JSON.parse(await readFile(storeFile, 'utf8'));
    localCache = Array.isArray(parsed?.records) ? parsed.records : [];
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('Unable to read local study store:', error.message);
    localCache = [];
  }
  return localCache;
};

const persistLocal = () => {
  writeQueue = writeQueue
    .then(async () => {
      await mkdir(dirname(storeFile), { recursive: true });
      await writeFile(storeFile, JSON.stringify({ records: localCache }), 'utf8');
    })
    .catch((error) => console.error('Unable to write local study store:', error.message));
  return writeQueue;
};

const matches = (record, kind, userId, recordId) =>
  record.kind === kind && record.userId === userId && (recordId === undefined || record.recordId === recordId);

export const saveRecord = async ({ kind, userId, recordId, data }) => {
  if (isMongoReady()) {
    await StudyRecord.updateOne({ kind, userId, recordId }, { $set: { data } }, { upsert: true });
    return data;
  }

  const records = await loadLocal();
  const now = new Date().toISOString();
  const existing = records.find((record) => matches(record, kind, userId, recordId));
  if (existing) {
    existing.data = data;
    existing.updatedAt = now;
  } else {
    records.push({ kind, userId, recordId, data, createdAt: now, updatedAt: now });
  }
  await persistLocal();
  return data;
};

export const getRecord = async (kind, userId, recordId) => {
  if (isMongoReady()) {
    const record = await StudyRecord.findOne({ kind, userId, recordId }).lean();
    return record?.data || null;
  }
  const records = await loadLocal();
  return records.find((record) => matches(record, kind, userId, recordId))?.data || null;
};

export const listRecords = async (kind, userId, { limit = 200 } = {}) => {
  if (isMongoReady()) {
    const records = await StudyRecord.find({ kind, userId }).sort({ createdAt: -1 }).limit(limit).lean();
    return records.map((record) => record.data);
  }
  const records = await loadLocal();
  return records
    .filter((record) => matches(record, kind, userId))
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
    .slice(0, limit)
    .map((record) => record.data);
};

export const deleteRecord = async (kind, userId, recordId) => {
  if (isMongoReady()) {
    const result = await StudyRecord.deleteOne({ kind, userId, recordId });
    return result.deletedCount > 0;
  }
  const records = await loadLocal();
  const index = records.findIndex((record) => matches(record, kind, userId, recordId));
  if (index === -1) return false;
  records.splice(index, 1);
  await persistLocal();
  return true;
};

export const storageMode = () => (isMongoReady() ? 'mongodb' : 'local');
