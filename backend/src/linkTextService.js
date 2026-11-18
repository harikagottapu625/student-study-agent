import { lookup } from 'node:dns/promises';
import net from 'node:net';
import { PDFParse } from 'pdf-parse';
import { callGeminiVideo, isGeminiConfigured } from './mistralService.js';

// Study material from a link: a YouTube lecture (its captions, or Gemini
// watching the video when there are no usable captions), a web article, or
// a PDF on the web.

const linkError = (message, status = 422) => Object.assign(new Error(message), { status });

const FETCH_TIMEOUT_MS = 20000;
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 45 * 60;

export const parseLink = (value) => {
  let url;
  try {
    url = new URL(String(value || '').trim());
  } catch {
    throw linkError('Paste a full link starting with https://', 400);
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw linkError('Only http and https links are supported.', 400);
  return url;
};

export const youtubeVideoId = (url) => {
  const host = url.hostname.replace(/^(www|m|music)\./, '');
  if (host === 'youtu.be') return url.pathname.slice(1, 12) || null;
  if (!['youtube.com', 'youtube-nocookie.com'].includes(host)) return null;
  const id = url.searchParams.get('v') || url.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]{11})/)?.[1];
  return /^[\w-]{11}$/.test(id || '') ? id : null;
};

// Links must not reach this server's own network (localhost, LAN, cloud metadata).
const isPrivateAddress = (address) => {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }
  const value = address.toLowerCase();
  if (value.startsWith('::ffff:')) return isPrivateAddress(value.slice(7));
  return value === '::' || value === '::1' || /^f[cd]/.test(value) || /^fe[89ab]/.test(value);
};

const assertPublicHost = async (hostname) => {
  const records = await lookup(hostname, { all: true }).catch(() => []);
  if (!records.length) throw linkError(`Could not find the website ${hostname}. Check the link.`, 400);
  if (records.some((record) => isPrivateAddress(record.address))) throw linkError('Links to private or local network addresses are not allowed.', 400);
};

// Fetches a public URL, checking every redirect hop and capping the size.
const fetchPublic = async (startUrl) => {
  let url = startUrl;
  for (let hop = 0; hop < 5; hop += 1) {
    await assertPublicHost(url.hostname);
    const response = await fetch(url, {
      redirect: 'manual',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) StudentStudyAgent/1.0', Accept: 'text/html,application/pdf,text/plain;q=0.9,*/*;q=0.5' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    }).catch((error) => {
      throw linkError(error.name === 'TimeoutError' ? 'The website took too long to respond.' : `Could not open the link (${error.message}).`, 502);
    });
    if ([301, 302, 303, 307, 308].includes(response.status) && response.headers.get('location')) {
      url = parseLink(new URL(response.headers.get('location'), url).href);
      continue;
    }
    if (!response.ok) throw linkError(`The website answered with an error (${response.status}). The page may need a login.`, 502);
    if (Number(response.headers.get('content-length') || 0) > MAX_BYTES) throw linkError('That file is too large to read from a link. Download it and upload it instead.', 413);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_BYTES) throw linkError('That file is too large to read from a link. Download it and upload it instead.', 413);
    return { buffer, contentType: response.headers.get('content-type') || '', finalUrl: url };
  }
  throw linkError('The link redirected too many times.', 502);
};

const decodeEntities = (value) =>
  value
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, '&');

const words = (text) => text.split(/\s+/).filter(Boolean).length;

// ---------------------------------------------------------------- YouTube

// YouTube's Android app client returns caption tracks that can be downloaded
// without the extra tokens the web player now requires.
const ANDROID_CLIENT = { clientName: 'ANDROID', clientVersion: '20.10.38', androidSdkVersion: 30, hl: 'en' };

// YouTube sometimes drops a request or answers without the video details; a
// retry a moment later almost always works.
const withRetries = async (attempt, isGood, tries = 3) => {
  let result = null;
  for (let index = 0; index < tries; index += 1) {
    if (index) await new Promise((resolve) => setTimeout(resolve, 1500 * index));
    result = await attempt().catch(() => null);
    if (isGood(result)) return result;
  }
  return result;
};

const playerInfo = (videoId) => withRetries(async () => {
  const response = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip' },
    body: JSON.stringify({ context: { client: ANDROID_CLIENT }, videoId }),
    // YouTube can take 10-20 s to answer on a slow connection.
    signal: AbortSignal.timeout(30000),
  }).catch((error) => {
    console.warn(`YouTube player request for ${videoId} failed: ${error.name} ${error.message}`);
    throw error;
  });
  const info = response.ok ? await response.json() : null;
  if (!info?.videoDetails) console.warn(`YouTube player answer for ${videoId}: HTTP ${response.status}, ${info?.playabilityStatus?.status || 'no status'} ${info?.playabilityStatus?.reason || ''}`);
  return info;
}, (info) => Boolean(info?.videoDetails));

// Captions of a 3-hour lecture are about 4.5 MB, which took anywhere from 7 to
// 45 s to download in testing, so they get plenty of time.
const CAPTION_TIMEOUT_MS = 90000;

const LANGUAGE_NAMES = { en: 'English', hi: 'Hindi', te: 'Telugu', ta: 'Tamil', kn: 'Kannada', ml: 'Malayalam', mr: 'Marathi', bn: 'Bengali', ur: 'Urdu', gu: 'Gujarati' };
const languageName = (code = '') => LANGUAGE_NAMES[code.split('-')[0]] || code;

// Videos taught in an Indian language usually say so in the title, or use the script.
const INDIAN_LANGUAGE = /\b(telugu|hindi|tamil|kannada|malayalam|marathi|bengali|urdu|gujarati|punjabi|odia)\b|[ऀ-ൿ]/i;

// Real captions beat auto-generated ones; English first since every engine reads it.
const pickTrack = (tracks) => {
  const rank = (track) => (track.kind === 'asr' ? 2 : 0) + (track.languageCode?.startsWith('en') ? 0 : 1);
  return [...tracks].sort((left, right) => rank(left) - rank(right))[0] || null;
};

// Caption events joined into readable paragraphs, breaking at pauses in speech.
const captionText = async (track) => {
  const url = `${track.baseUrl.replace(/&fmt=[^&]*/g, '')}&fmt=json3`;
  const data = await withRetries(
    () => fetch(url, { signal: AbortSignal.timeout(CAPTION_TIMEOUT_MS) }).then((response) => response.json()),
    (result) => Array.isArray(result?.events),
    2,
  );
  const paragraphs = [];
  let current = '';
  let lastEnd = 0;
  for (const event of data?.events || []) {
    const text = (event.segs || []).map((segment) => segment.utf8 || '').join('').replace(/\[(music|applause|laughter)\]/gi, ' ').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const pause = event.tStartMs - lastEnd;
    if (current && (pause > 2500 || (words(current) > 70 && /[.!?]$/.test(current)) || words(current) > 140)) {
      paragraphs.push(current);
      current = '';
    }
    current = current ? `${current} ${text}` : text;
    lastEnd = event.tStartMs + (event.dDurationMs || 0);
  }
  if (current) paragraphs.push(current);
  return decodeEntities(paragraphs.join('\n\n'));
};

// Auto captions of a lecture spoken in Telugu or Hindi come out as English
// guesses with "[Foreign]" wherever the speech was not English.
const captionsUsable = (track, text, title) => {
  const count = words(text);
  if (count < 80) return false;
  if (track.kind !== 'asr') return true;
  const foreign = (text.match(/\bforeign\b/gi) || []).length;
  if (foreign / count > 0.004) return false;
  return !(INDIAN_LANGUAGE.test(title) && track.languageCode?.startsWith('en'));
};

const VIDEO_NOTES_PROMPT = [
  'This is an educational video. The teacher may speak English, Hindi, Telugu or another language.',
  'In English, write detailed study notes of everything the teacher explains, in the order it is taught.',
  'Start each topic with a heading line like "## Topic name", then explain it in clear sentences: definitions, steps, examples and anything written on the board or slides.',
  'Be thorough, like a good student\'s lecture notes: about 100 words for every 2 minutes of teaching.',
  'Include only what is in the video. Do not add an introduction about the notes themselves.',
].join('\n');

const formatMinutes = (seconds) => `${Math.max(1, Math.round(seconds / 60))} min`;

const youtubeNotes = async (videoId, onStage) => {
  onStage?.('Reading the video captions...');
  const info = await playerInfo(videoId);
  // Without the details the length is unknown, so a 3-hour lecture would be
  // sent to the AI to watch and fail; asking again later is the real fix.
  if (!info) throw linkError('YouTube did not answer just now. Please click "Get notes" again in a moment.', 502);
  const details = info?.videoDetails || {};
  const title = details.title || 'YouTube video';
  const seconds = Number(details.lengthSeconds || 0);
  if (info?.playabilityStatus?.status && info.playabilityStatus.status !== 'OK' && !details.title) {
    throw linkError(`YouTube would not open this video (${info.playabilityStatus.reason || info.playabilityStatus.status}). It may be private or removed.`);
  }

  const tracks = info?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  const track = pickTrack(tracks);
  if (track) {
    if (seconds > 60 * 60) onStage?.(`Downloading the captions of this ${formatMinutes(seconds)} video. Long lectures can take up to a minute...`);
    const text = await captionText(track);
    // A video with captions that would not download this time is not a video
    // without captions: ask the student to retry rather than send it to the AI.
    if (!text.trim() && seconds > MAX_VIDEO_SECONDS) {
      throw linkError('YouTube did not send the captions just now. Please click "Get notes" again in a moment.', 502);
    }
    if (captionsUsable(track, text, title)) {
      return {
        title, author: details.author || '', text, method: 'youtube-captions', durationSeconds: seconds,
        detail: `${track.kind === 'asr' ? 'Auto-generated' : ''} ${languageName(track.languageCode)} captions · ${formatMinutes(seconds)} video`.trim(),
      };
    }
  }

  // No usable captions: Gemini watches the video, which also understands Hindi and Telugu speech.
  if (!isGeminiConfigured()) {
    throw linkError('This video has no usable captions, and reading the video itself needs a Gemini API key.');
  }
  if (seconds > MAX_VIDEO_SECONDS) {
    throw linkError(`This ${formatMinutes(seconds)} video has no usable captions, and it is too long for AI to watch (limit ${MAX_VIDEO_SECONDS / 60} min). Try a shorter video or one with captions.`);
  }
  onStage?.(`No usable captions, so AI is watching the ${formatMinutes(seconds || 600)} video. This takes about a minute...`);
  try {
    const { text } = await callGeminiVideo(`https://www.youtube.com/watch?v=${videoId}`, VIDEO_NOTES_PROMPT);
    return {
      title, author: details.author || '', text: text.replace(/^(sure|okay|here (are|is))[^\n]*\n+/i, ''), method: 'youtube-video', durationSeconds: seconds,
      detail: `AI watched the ${formatMinutes(seconds)} video (it had no usable captions)`,
    };
  } catch (error) {
    console.error(`Video notes failed for ${videoId}:`, error.message.slice(0, 600));
    const reason = /\(429\)|cooling down/.test(error.message)
      ? 'the free AI quota for watching videos is used up for now. Try again later'
      : /\(503\)|timed out/.test(error.message)
        ? "Google's AI is busy right now. Please try again in a minute"
        : /\(400\)/.test(error.message) && !seconds
          ? 'AI could not watch it (it may be live, private, age-restricted or longer than 45 minutes)'
          : 'AI could not watch it (it may be private or age-restricted)';
    throw linkError(`This video has no usable captions, and ${reason}. A video with captions works instantly.`, 502);
  }
};

// ---------------------------------------------------------------- Web pages

const pageTitle = (html) =>
  decodeEntities(
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i)?.[1]
    || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
    || '',
  ).replace(/\s+/g, ' ').trim();

// Main article text, with h1-h3 kept as "## " headings so topics are detected.
const htmlToText = (html) => {
  let body = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|nav|footer|header|aside|form|iframe|button|select)\b[\s\S]*?<\/\1>/gi, ' ');
  const main = body.match(/<article\b[\s\S]*?<\/article>/i)?.[0] || body.match(/<main\b[\s\S]*?<\/main>/i)?.[0];
  if (main && words(main.replace(/<[^>]+>/g, ' ')) > 150) body = main;
  const text = decodeEntities(
    body
      .replace(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/gi, (_, heading) => `\n## ${heading.replace(/<[^>]+>/g, ' ')}\n`)
      .replace(/<li\b[^>]*>/gi, '\n• ')
      .replace(/<(br|\/p|\/div|\/tr|\/h[4-6]|\/section|\/blockquote|\/pre)\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  );
  const seen = new Set();
  return text
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter((line) => line.replace(/^(##|•)\s*/, '').length > 2 && !seen.has(line) && seen.add(line))
    .join('\n');
};

const webNotes = async (url, onStage) => {
  onStage?.('Opening the page...');
  const { buffer, contentType, finalUrl } = await fetchPublic(url);
  if (/application\/pdf/i.test(contentType) || /\.pdf$/i.test(finalUrl.pathname)) {
    const parser = new PDFParse({ data: buffer });
    const text = (await parser.getText()).text || '';
    await parser.destroy();
    if (words(text) < 80) throw linkError('This PDF link has no readable text (it may be scanned). Download it and upload the file instead, so it can be read with OCR.');
    return { title: decodeURIComponent(finalUrl.pathname.split('/').pop() || 'PDF').replace(/\.pdf$/i, ''), text, method: 'web-pdf', detail: `PDF from ${finalUrl.hostname}` };
  }
  const raw = buffer.toString('utf8');
  if (/text\/plain/i.test(contentType)) return { title: finalUrl.hostname, text: raw, method: 'web', detail: `Text from ${finalUrl.hostname}` };
  const text = htmlToText(raw);
  if (words(text) < 80) throw linkError('Could not find readable article text on that page. It may need a login or JavaScript. Copy the text and paste it instead.');
  return { title: pageTitle(raw) || finalUrl.hostname, text, method: 'web', detail: `Article from ${finalUrl.hostname}` };
};

export const extractLinkText = async (value, { onStage } = {}) => {
  const url = parseLink(value);
  const videoId = youtubeVideoId(url);
  return videoId ? youtubeNotes(videoId, onStage) : webNotes(url, onStage);
};
