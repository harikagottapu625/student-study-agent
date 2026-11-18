import { useEffect, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const USER_KEY = 'study-agent-user';
const GUEST_KEY = 'study-agent-guest-id';
export const ASSIGNMENTS_KEY = 'study-agent-assignments';
// Pre-rename key, read once so existing saved assignments carry over.
const LEGACY_ASSIGNMENTS_KEY = 'skillgap-assignments';

export const STUDY_USER_EVENT = 'study-agent-user-changed';
export const ASSIGNMENTS_EVENT = 'study-agent-assignments-changed';
export const OPEN_QUIZ_EVENT = 'study-agent-open-quiz';

const readStorage = (key) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStorage = (key, value) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable (private mode); the app still works for this session.
  }
};

let sessionGuestId = '';

// Signed-in email, or a stable per-browser guest id so agents can remember the student.
export const getStudyUserId = () => {
  const user = readStorage(USER_KEY);
  if (user) return user;
  let guest = readStorage(GUEST_KEY) || sessionGuestId;
  if (!guest) {
    guest = `guest-${Math.random().toString(36).slice(2, 10)}`;
    sessionGuestId = guest;
    writeStorage(GUEST_KEY, guest);
  }
  return guest;
};

export const setStudyUser = (email) => {
  writeStorage(USER_KEY, String(email || '').trim().toLowerCase());
  window.dispatchEvent(new Event(STUDY_USER_EVENT));
};

export const useStudyUserId = () => {
  const [userId, setUserId] = useState(getStudyUserId);
  useEffect(() => {
    const sync = () => setUserId(getStudyUserId());
    window.addEventListener(STUDY_USER_EVENT, sync);
    return () => window.removeEventListener(STUDY_USER_EVENT, sync);
  }, []);
  return userId;
};

const request = async (path, { method = 'GET', body, form } = {}) => {
  const userId = getStudyUserId();
  let url = `${API_BASE_URL}${path}`;
  const init = { method };

  if (form) {
    form.append('userId', userId);
    init.body = form;
  } else if (method === 'GET' || method === 'DELETE') {
    url += `${url.includes('?') ? '&' : '?'}userId=${encodeURIComponent(userId)}`;
  } else {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify({ userId, ...body });
  }

  const response = await fetch(url, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return data;
};

export const studyApi = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  del: (path) => request(path, { method: 'DELETE' }),
  upload: (path, form) => request(path, { method: 'POST', form }),
};

export const loadTrackedAssignments = () => {
  try {
    const saved = JSON.parse(readStorage(ASSIGNMENTS_KEY) || readStorage(LEGACY_ASSIGNMENTS_KEY) || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
};

export const saveTrackedAssignments = (assignments) => writeStorage(ASSIGNMENTS_KEY, JSON.stringify(assignments));

// Lets other agents (e.g. the Agent Hub) add deadlines to the tracker page.
export const addTrackedAssignments = (items) => {
  const current = loadTrackedAssignments();
  const known = new Set(current.map((item) => `${item.dueDate}|${String(item.title).toLowerCase()}`));
  const fresh = items.filter((item) => !known.has(`${item.dueDate}|${String(item.title).toLowerCase()}`));
  saveTrackedAssignments([...current, ...fresh]);
  window.dispatchEvent(new Event(ASSIGNMENTS_EVENT));
  return fresh.length;
};

export const engineLabel = (engine) => ({
  ai: 'AI agent',
  extractive: 'Extractive (grounded)',
  'rule-based': 'Rule-based fallback',
  'knowledge-base': 'Built-in knowledge base',
  offline: 'Offline fallback',
  retrieval: 'Retrieval only',
}[engine] || engine);
