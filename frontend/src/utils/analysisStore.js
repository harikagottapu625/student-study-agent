const ANALYSIS_KEY = 'sgd.latest.analysis';
const PAYLOAD_KEY = 'sgd.latest.payload';

export function saveAnalysisPayload(payload) {
  sessionStorage.setItem(PAYLOAD_KEY, JSON.stringify(payload));
}

export function getAnalysisPayload() {
  const raw = sessionStorage.getItem(PAYLOAD_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveAnalysisResult(analysis) {
  sessionStorage.setItem(ANALYSIS_KEY, JSON.stringify(analysis));
}

export function getAnalysisResult() {
  const raw = sessionStorage.getItem(ANALYSIS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
