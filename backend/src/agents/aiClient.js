import { callAiJson } from '../mistralService.js';

// Shared AI access for every agent. When a provider rejects us for billing or
// auth reasons, pause AI calls for a few minutes so agents fall back to their
// rule-based engines immediately instead of waiting on a failing request.
const PAUSE_MS = 5 * 60 * 1000;
const SHORT_PAUSE_MS = 30 * 1000;

let pausedUntil = 0;
let lastError = '';

const isConfigured = () => Boolean(process.env.GEMINI_API_KEY || process.env.NVIDIA_API_KEY || process.env.OPENAI_API_KEY);

export const aiStatus = () => ({
  configured: isConfigured(),
  available: isConfigured() && Date.now() >= pausedUntil,
  lastError,
});

export const askAi = async (prompt, { maxTokens = 1400, timeoutMs } = {}) => {
  if (!isConfigured() || Date.now() < pausedUntil) return null;

  try {
    const result = await callAiJson(prompt, { maxTokens, timeoutMs });
    lastError = '';
    return result?.parsed && typeof result.parsed === 'object' ? result : null;
  } catch (error) {
    lastError = String(error.message || error).slice(0, 400);
    // Every provider failed. A bad key will not fix itself soon; a busy model,
    // a network blip or a used-up model quota (429, whose message also mentions
    // "billing") usually will, and the Gemini client skips exhausted models.
    const lasting = /\((401|402|403)\)|api key not valid/i.test(lastError)
      && !/\((429|500|503)\)|timed out|cooling down/i.test(lastError);
    pausedUntil = Date.now() + (lasting ? PAUSE_MS : SHORT_PAUSE_MS);
    return null;
  }
};

export const asText = (value, fallback = '') => (typeof value === 'string' && value.trim() ? value.trim() : fallback);

export const asList = (value, limit = 10) =>
  (Array.isArray(value) ? value : [])
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .slice(0, limit);
