const AI_PROVIDER = (process.env.AI_PROVIDER || 'auto').toLowerCase();

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || '';
const NVIDIA_MODEL = process.env.NVIDIA_MODEL || 'opengpt-x/teuken-7b-instruct-commercial-v0.4';
const NVIDIA_CHAT_TEMPLATE = process.env.NVIDIA_CHAT_TEMPLATE || '';
const NVIDIA_API_URL = process.env.NVIDIA_API_URL || 'https://integrate.api.nvidia.com/v1/chat/completions';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_API_URL = process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
// Tried in order: a busy (503), rate-limited (429) or retired (404) model falls
// through to the next one. Override with GEMINI_MODEL, e.g. "gemini-3.5-flash,gemini-3.5-flash-lite".
// flash-lite first: fastest, and the free tier gives it the most daily requests.
const GEMINI_MODELS = (process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite,gemini-3.5-flash,gemini-3.8-flash').split(',').map((model) => model.trim()).filter(Boolean);
const GEMINI_API_URL = process.env.GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta/models';

// A slow provider must not hang a request; the next provider (or the agent's
// offline engine) takes over instead.
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 20000);

const API_KEYS = { gemini: GEMINI_API_KEY, nvidia: NVIDIA_API_KEY, openai: OPENAI_API_KEY };

const cleanJsonString = (raw) =>
  String(raw)
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .replace(/,\s*([}\]])/g, '$1')
    .trim();

const normalizeStringList = (value) =>
  Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim()) : [];

const normalizeProjectIdeas = (value) => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === 'string') {
        return { name: item.trim(), description: '', skills: [] };
      }

      if (!item || typeof item !== 'object') return null;

      return {
        name: typeof item.name === 'string' ? item.name.trim() : '',
        description: typeof item.description === 'string' ? item.description.trim() : '',
        skills: normalizeStringList(item.skills),
      };
    })
    .filter((item) => item?.name);
};

const normalizeLearningVideos = (value) => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;

      const url = typeof item.url === 'string' ? item.url.trim() : '';
      if (!/^https?:\/\//i.test(url)) return null;

      return {
        title: typeof item.title === 'string' ? item.title.trim() : 'Recommended Video',
        url,
        reason: typeof item.reason === 'string' ? item.reason.trim() : '',
      };
    })
    .filter(Boolean);
};

const toPrompt = ({ analysis, role, student }) => {
  const resumeSnippet = typeof student.resumeText === 'string' ? student.resumeText.slice(0, 6000) : '';

  return [
    'You are an expert career advisor.',
    'Return ONLY valid JSON with keys: summary, strengths, risks, roadmapEnhancements, nextActions, projectIdeas, learningVideos.',
    'summary: short paragraph',
    'strengths: array of strings, max 4 items',
    'risks: array of strings, max 4 items',
    'roadmapEnhancements: array of strings, max 4 items',
    'nextActions: array of strings with concrete next steps for the next 30 days, max 4 items',
    'projectIdeas: array of objects with keys name, description, skills, max 3 items',
    'learningVideos: array of objects with keys title, url, reason, max 3 items',
    'Use real public URLs for learningVideos, prefer YouTube or official course/video pages.',
    'Keep every string concise and avoid extra commentary outside the JSON.',
    '',
    `Student: ${student.name}`,
    `Target role: ${role.roleName}`,
    `Readiness score: ${analysis.readinessScore}`,
    `Matched skills: ${analysis.matchedSkills.join(', ') || 'None'}`,
    `Missing skills: ${analysis.missingSkills.map((item) => item.skill).join(', ') || 'None'}`,
    `Weak skills: ${analysis.weakSkills.map((item) => item.skill).join(', ') || 'None'}`,
    `Preferred skills to add: ${analysis.recommendedSkills.join(', ') || 'None'}`,
    `Current roadmap steps: ${analysis.roadmap.map((step) => step.title).join(' | ') || 'None'}`,
    `Completed courses: ${student.completedCourses?.join(', ') || 'None'}`,
    `Projects: ${student.projects?.join(', ') || 'None'}`,
    `Career interests: ${student.careerInterests?.join(', ') || 'None'}`,
    `Resume file name: ${student.resumeFileName || 'None'}`,
    `Resume text: ${resumeSnippet || 'None provided'}`,
  ].join('\n');
};

const safeParseJson = (raw) => {
  try {
    return JSON.parse(cleanJsonString(raw));
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(cleanJsonString(raw.slice(start, end + 1)));
    }
    throw new Error('Mistral response was not valid JSON.');
  }
};

// Google Gemini (generateContent API) in JSON mode.
const callGeminiModel = async (model, prompt, maxTokens, timeoutMs = AI_TIMEOUT_MS) => {
  const response = await fetch(`${GEMINI_API_URL}/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      // Thinking tokens count towards the output limit, so leave room for them.
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: maxTokens + 2048, temperature: 0.15 },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`GEMINI ${model} request failed (${response.status}): ${body.slice(0, 300)}`);
    error.status = response.status;
    // A used-up quota says when it resets, e.g. "retryDelay": "1842s".
    const retrySeconds = Number(body.match(/"retryDelay":\s*"(\d+(?:\.\d+)?)s"/)?.[1]);
    if (retrySeconds) error.retryMs = retrySeconds * 1000;
    throw error;
  }
  const data = await response.json();
  const rawContent = (data?.candidates?.[0]?.content?.parts || []).filter((part) => !part.thought).map((part) => part.text || '').join('') || '{}';
  return { parsed: safeParseJson(rawContent), provider: 'gemini', model };
};

// Models that ran out of quota or timed out are skipped until this time, so
// each request goes straight to a model that can answer.
const geminiCooldownUntil = new Map();
// Used-up quotas only: a model that timed out while thinking can still answer
// fast with thinking off, but a model out of quota cannot answer at all.
const geminiQuotaUntil = new Map();
const setQuotaCooldown = (model, retryMs) => {
  const until = Date.now() + Math.min(retryMs || 60_000, 60 * 60_000);
  geminiCooldownUntil.set(model, until);
  geminiQuotaUntil.set(model, until);
};

const callGeminiJson = async (prompt, maxTokens, timeoutMs = AI_TIMEOUT_MS) => {
  const failures = [];
  const ready = GEMINI_MODELS.filter((model) => Date.now() >= (geminiCooldownUntil.get(model) || 0));
  for (const model of ready) {
    try {
      return await callGeminiModel(model, prompt, maxTokens, timeoutMs);
    } catch (error) {
      const timedOut = error.name === 'TimeoutError';
      failures.push(timedOut ? `GEMINI ${model} timed out after ${timeoutMs} ms` : error.message);
      if (error.status === 429) setQuotaCooldown(model, error.retryMs);
      else if (timedOut || error.status === 503) geminiCooldownUntil.set(model, Date.now() + 2 * 60_000);
      // Bad key or bad request: another model will not help.
      if ([400, 401, 403].includes(error.status)) break;
    }
  }
  if (!ready.length) failures.push('GEMINI all models are cooling down after quota or timeout errors');
  throw new Error(failures.join(' | '));
};

export const isGeminiConfigured = () => Boolean(GEMINI_API_KEY);

// Translation and study packs need no long reasoning, so models that allow it
// answer with thinking switched off, several times faster (flash: about 5 s
// instead of 30 s for a paragraph). Models that reject that setting are
// remembered and asked without it.
const FAST_MODELS = (process.env.GEMINI_FAST_MODEL || 'gemini-3.5-flash,gemini-3.5-flash-lite,gemini-3.8-flash').split(',').map((model) => model.trim()).filter(Boolean);
const thinkingRequired = new Set();

const requestFast = async (model, prompt, { maxTokens, timeoutMs, json, noThinking }) => {
  const response = await fetch(`${GEMINI_API_URL}/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: noThinking ? maxTokens : maxTokens + 2048,
        temperature: 0.1,
        ...(json ? { responseMimeType: 'application/json' } : {}),
        ...(noThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`GEMINI ${model} request failed (${response.status}): ${body.slice(0, 300)}`);
    error.status = response.status;
    const retrySeconds = Number(body.match(/"retryDelay":\s*"(\d+(?:\.\d+)?)s"/)?.[1]);
    if (retrySeconds) error.retryMs = retrySeconds * 1000;
    throw error;
  }
  const data = await response.json();
  const text = (data?.candidates?.[0]?.content?.parts || []).filter((part) => !part.thought).map((part) => part.text || '').join('').trim();
  if (!text) throw new Error(`GEMINI ${model} returned an empty answer`);
  return text;
};

// Timeouts and "high demand" on this route only pause this route.
const fastCooldownUntil = new Map();

// json: true returns { parsed }, otherwise { text }.
export const callGeminiFast = async (prompt, { maxTokens = 4000, timeoutMs = 45000, json = false } = {}) => {
  if (!GEMINI_API_KEY) throw new Error('Set GEMINI_API_KEY to use AI for study material.');
  const failures = [];
  const ready = FAST_MODELS.filter((model) => Date.now() >= Math.max(geminiQuotaUntil.get(model) || 0, fastCooldownUntil.get(model) || 0));
  for (const model of ready) {
    const noThinking = !thinkingRequired.has(model);
    try {
      let text;
      try {
        text = await requestFast(model, prompt, { maxTokens, timeoutMs, json, noThinking });
      } catch (error) {
        if (!(noThinking && error.status === 400)) throw error;
        thinkingRequired.add(model);
        text = await requestFast(model, prompt, { maxTokens, timeoutMs, json, noThinking: false });
      }
      return json ? { parsed: safeParseJson(text), provider: 'gemini', model } : { text, provider: 'gemini', model };
    } catch (error) {
      const timedOut = error.name === 'TimeoutError';
      failures.push(timedOut ? `GEMINI ${model} timed out after ${timeoutMs} ms` : error.message);
      if (error.status === 429) setQuotaCooldown(model, error.retryMs);
      else if (timedOut) fastCooldownUntil.set(model, Date.now() + 30_000);
      else if (error.status === 503) fastCooldownUntil.set(model, Date.now() + 8_000);
      if ([401, 403].includes(error.status)) break;
    }
  }
  if (!ready.length) failures.push('GEMINI all models are cooling down after quota or timeout errors');
  throw new Error(failures.join(' | '));
};

// Gemini watches a public YouTube video and answers the prompt about it in
// plain text. A video takes far longer than a text prompt, so it gets its own
// time limit; low media resolution keeps a 20-minute lecture near 100K tokens.
const VIDEO_TIMEOUT_MS = Number(process.env.AI_VIDEO_TIMEOUT_MS || 150000);

export const callGeminiVideo = async (videoUrl, prompt, { maxTokens = 8000 } = {}) => {
  if (!GEMINI_API_KEY) throw new Error('Set GEMINI_API_KEY to read videos without captions.');
  const failures = [];
  const attempts = GEMINI_MODELS
    .filter((name) => Date.now() >= (geminiCooldownUntil.get(name) || 0))
    .flatMap((model, index) => (index === 0 ? [model, model] : [model]));
  for (const [attempt, model] of attempts.entries()) {
    // The first model gets a second try: "high demand" (503) usually passes in seconds.
    if (attempt === 1 && model === attempts[0] && !/\(503\)/.test(failures.at(-1) || '')) continue;
    if (attempt === 1 && model === attempts[0]) await new Promise((resolve) => setTimeout(resolve, 4000));
    try {
      const response = await fetch(`${GEMINI_API_URL}/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ fileData: { fileUri: videoUrl } }, { text: prompt }] }],
          generationConfig: { maxOutputTokens: maxTokens, temperature: 0.2, mediaResolution: 'MEDIA_RESOLUTION_LOW' },
        }),
        signal: AbortSignal.timeout(VIDEO_TIMEOUT_MS),
      });
      if (!response.ok) {
        const body = await response.text();
        const error = new Error(`GEMINI ${model} video request failed (${response.status}): ${body.slice(0, 300)}`);
        error.status = response.status;
        const retrySeconds = Number(body.match(/"retryDelay":\s*"(\d+(?:\.\d+)?)s"/)?.[1]);
        if (retrySeconds) error.retryMs = retrySeconds * 1000;
        throw error;
      }
      const data = await response.json();
      const text = (data?.candidates?.[0]?.content?.parts || []).filter((part) => !part.thought).map((part) => part.text || '').join('').trim();
      if (text) return { text, model };
      failures.push(`GEMINI ${model} returned no text for the video`);
    } catch (error) {
      failures.push(error.name === 'TimeoutError' ? `GEMINI ${model} timed out after ${VIDEO_TIMEOUT_MS} ms` : error.message);
      if (error.status === 429) setQuotaCooldown(model, error.retryMs);
      // A bad key, or a video Gemini cannot open (private, age-restricted): another model will not help.
      if ([400, 401, 403].includes(error.status)) break;
    }
  }
  throw new Error(failures.join(' | ') || 'GEMINI all models are cooling down after quota or timeout errors');
};

// timeoutMs: long outputs (a study pack in Hindi or Telugu) need more than the default.
export const callAiJson = async (prompt, { maxTokens = 1200, providerPreference = AI_PROVIDER, timeoutMs = AI_TIMEOUT_MS } = {}) => {
  if (!GEMINI_API_KEY && !NVIDIA_API_KEY && !OPENAI_API_KEY) {
    throw new Error('Set GEMINI_API_KEY, NVIDIA_API_KEY or OPENAI_API_KEY in your .env file.');
  }

  // The preferred provider goes first; every other configured provider is a fallback.
  const defaultOrder = ['gemini', 'nvidia', 'openai'];
  const providerOrder = defaultOrder.includes(providerPreference)
    ? [providerPreference, ...defaultOrder.filter((name) => name !== providerPreference)]
    : defaultOrder;
  const errors = [];

  for (const provider of providerOrder) {
    const apiKey = API_KEYS[provider];
    if (!apiKey) {
      continue;
    }

    if (provider === 'gemini') {
      try {
        return await callGeminiJson(prompt, maxTokens, timeoutMs);
      } catch (error) {
        errors.push(error.message || String(error));
        continue;
      }
    }

    const isNvidia = provider === 'nvidia';

    const requestBody = {
      model: isNvidia ? NVIDIA_MODEL : OPENAI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: maxTokens,
      temperature: 0.15,
      top_p: 1.0,
      stream: false,
    };

    if (isNvidia && NVIDIA_CHAT_TEMPLATE) {
      requestBody.chat_template = NVIDIA_CHAT_TEMPLATE;
    }

    const apiUrl = isNvidia ? NVIDIA_API_URL : OPENAI_API_URL;

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${provider.toUpperCase()} API request failed (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const rawContent = data?.choices?.[0]?.message?.content || '{}';
      const parsed = safeParseJson(rawContent);

      return {
        parsed,
        provider,
        model: requestBody.model,
      };
    } catch (error) {
      errors.push(error.message || String(error));
    }
  }

  throw new Error(`Unable to reach configured AI providers. ${errors.join(' | ')}`);
};

export const generateAiAdvisor = async ({ analysis, role, student }) => {
  const prompt = toPrompt({ analysis, role, student });
  const { parsed, provider, model } = await callAiJson(prompt, { maxTokens: 1400 });

  return {
    summary: parsed.summary || 'No summary generated.',
    strengths: normalizeStringList(parsed.strengths),
    risks: normalizeStringList(parsed.risks),
    roadmapEnhancements: normalizeStringList(parsed.roadmapEnhancements),
    nextActions: normalizeStringList(parsed.nextActions),
    projectIdeas: normalizeProjectIdeas(parsed.projectIdeas),
    learningVideos: normalizeLearningVideos(parsed.learningVideos),
    model,
    provider,
  };
};

const normalizeRoadmapModules = (value) => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;

      const title = typeof item.title === 'string' ? item.title.trim() : '';
      if (!title) return null;

      const objective = typeof item.objective === 'string' ? item.objective.trim() : '';
      const tasks = normalizeStringList(item.tasks);
      const videos = normalizeLearningVideos(item.videos);

      return {
        title,
        objective,
        tasks,
        videos,
      };
    })
    .filter(Boolean);
};

const fallbackVideoCatalog = [
  {
    keywords: ['python', 'data science', 'pandas', 'numpy'],
    videos: [
      {
        title: 'Python for Data Science - Full Course',
        url: 'https://www.youtube.com/watch?v=LHBE6Q9XlzI',
        reason: 'Direct full-course lesson for data analysis fundamentals.',
      },
      {
        title: 'Pandas Full Tutorial',
        url: 'https://www.youtube.com/watch?v=vmEHCJofslg',
        reason: 'Hands-on walkthrough for practical data work.',
      },
      {
        title: 'NumPy Full Course',
        url: 'https://www.youtube.com/watch?v=QUT1VHiLmmI',
        reason: 'Numerical computing foundation for analytics workflows.',
      },
      {
        title: 'Data Analysis Project Tutorial',
        url: 'https://www.youtube.com/watch?v=vmEHCJofslg',
        reason: 'Project-oriented practice for data science learners.',
      },
    ],
  },
  {
    keywords: ['sql', 'database'],
    videos: [
      {
        title: 'SQL Full Course for Beginners',
        url: 'https://www.youtube.com/watch?v=HXV3zeQKqGY',
        reason: 'Covers SQL from basics to practical querying.',
      },
      {
        title: 'Advanced SQL Concepts',
        url: 'https://www.youtube.com/watch?v=7S_tz1z_5bA',
        reason: 'Improves real-world querying and optimization skills.',
      },
      {
        title: 'SQL Practice Project',
        url: 'https://www.youtube.com/watch?v=7S_tz1z_5bA',
        reason: 'Helps convert SQL theory into project execution.',
      },
    ],
  },
  {
    keywords: [
      'machine learning', 'ml', 'deep learning', 'ai', 'ai engineer',
      'neural', 'nlp', 'transformers', 'computer vision', 'cv', 'pytorch',
      'tensorflow', 'keras', 'mlops', 'deployment', 'genai', 'generative',
      'llm', 'rag', 'dsa', 'algorithms', 'oop', 'python oop',
    ],
    videos: [
      {
        title: 'Machine Learning Full Course',
        url: 'https://www.youtube.com/watch?v=NWONeJKn6kc',
        reason: 'Practical ML foundations from freeCodeCamp.',
      },
      {
        title: 'Neural Networks Explained',
        url: 'https://www.youtube.com/watch?v=aircAruvnKk',
        reason: 'Builds intuition for deep learning fundamentals.',
      },
      {
        title: 'Scikit-learn Crash Course',
        url: 'https://www.youtube.com/watch?v=0Lt9w-BxKFQ',
        reason: 'Practical ML implementation with a popular library.',
      },
      {
        title: 'Machine Learning for Beginners',
        url: 'https://www.youtube.com/watch?v=NWONeJKn6kc',
        reason: 'Guided project to reinforce modeling skills.',
      },
    ],
  },
  {
    keywords: ['react', 'javascript', 'node', 'web'],
    videos: [
      {
        title: 'JavaScript Full Course',
        url: 'https://www.youtube.com/watch?v=PkZNo7MFNFg',
        reason: 'Core language foundations for web development.',
      },
      {
        title: 'React Course for Beginners',
        url: 'https://www.youtube.com/watch?v=bMknfKXIFA8',
        reason: 'Practical component-based UI development training.',
      },
      {
        title: 'Node.js Full Course',
        url: 'https://www.youtube.com/watch?v=Oe421EPjeBE',
        reason: 'Backend development fundamentals for full-stack practice.',
      },
      {
        title: 'Node.js Full Course',
        url: 'https://www.youtube.com/watch?v=Oe421EPjeBE',
        reason: 'Shows how to connect frontend and backend in a real app.',
      },
    ],
  },
  {
    keywords: [
      'iot', 'embedded', 'arduino', 'Electronics', 'electronics',
      'raspberry', 'firmware', 'mqtt', 'microcontroller', 'sensor',
      'sensors', 'esp32', 'hardware', 'protocols', 'iot security',
      'aws iot', 'azure iot', 'smart home', 'telemetry', 'node-red',
    ],
    videos: [
      {
        title: 'Embedded Systems Essentials Basics',
        url: 'https://www.youtube.com/watch?v=D7L1SmjQ3fo',
        reason: 'Core embedded systems foundation for IoT hardware and firmware learning.',
      },
      {
        title: 'Node.js Full Course',
        url: 'https://www.youtube.com/watch?v=Oe421EPjeBE',
        reason: 'Server-side scripting used in IoT cloud integrations.',
      },
      {
        title: 'Pandas Full Tutorial',
        url: 'https://www.youtube.com/watch?v=vmEHCJofslg',
        reason: 'Data handling skills for analyzing IoT sensor data.',
      },
    ],
  },
];

const defaultFallbackVideos = [
  {
    title: 'JavaScript Full Course for Beginners',
    url: 'https://www.youtube.com/watch?v=PkZNo7MFNFg',
    reason: 'Solid baseline for structured technical learning.',
  },
  {
    title: 'React Course for Beginners',
    url: 'https://www.youtube.com/watch?v=bMknfKXIFA8',
    reason: 'Project execution strategy and implementation approach.',
  },
];

const pickFallbackVideos = ({ selectedCourse, moduleTitle, roleName }) => {
  const text = `${selectedCourse || ''} ${moduleTitle || ''}`.toLowerCase();
  const matched = fallbackVideoCatalog.find((entry) => entry.keywords.some((keyword) => text.includes(keyword)));
  if (matched) return matched.videos;

  // Role-name fallback: if course name didn't match, try matching on the role name
  if (roleName) {
    const roleText = roleName.toLowerCase();
    const roleMatched = fallbackVideoCatalog.find((entry) => entry.keywords.some((keyword) => roleText.includes(keyword)));
    if (roleMatched) return roleMatched.videos;
  }

  return defaultFallbackVideos;
};

const buildFallbackVideos = ({ selectedCourse, moduleTitle, roleName }) => {
  const moduleText = moduleTitle || selectedCourse || 'learning module';
  const roleText = roleName || 'target role';

  return pickFallbackVideos({ selectedCourse, moduleTitle }).map((video) => ({
    ...video,
    reason: `${video.reason} Recommended for ${moduleText} toward ${roleText}.`,
  }));
};

const rotateVideos = (videos, offset) => {
  if (!Array.isArray(videos) || !videos.length) return [];
  const safeOffset = Math.max(0, Number(offset || 0)) % videos.length;
  return videos.slice(safeOffset).concat(videos.slice(0, safeOffset));
};

const ensureRoadmapModulesHaveVideos = ({ modules, selectedCourse, roleName }) => {
  if (!Array.isArray(modules) || !modules.length) {
    return [
      {
        title: selectedCourse || 'Learning Module',
        objective: `Build practical understanding of ${selectedCourse || 'core concepts'}.`,
        tasks: [
          `Watch one full tutorial on ${selectedCourse || 'this topic'}.`,
          'Take notes and summarize 5 key learnings.',
          'Create one mini project to apply what you learned.',
        ],
        videos: buildFallbackVideos({
          selectedCourse,
          moduleTitle: selectedCourse,
          roleName,
        }),
      },
    ];
  }

  return modules.map((moduleItem) => {
    if (Array.isArray(moduleItem.videos) && moduleItem.videos.length) {
      return moduleItem;
    }

    return {
      ...moduleItem,
      videos: buildFallbackVideos({
        selectedCourse,
        moduleTitle: moduleItem.title,
        roleName,
      }),
    };
  });
};

const buildQuickRoadmapModules = ({ selectedCourse, phaseName, roleName }) => {
  const baseVideos = buildFallbackVideos({
    selectedCourse,
    moduleTitle: selectedCourse,
    roleName,
  });

  return [
    {
      phaseLabel: phaseName || 'Phase 1: Foundation',
      title: `${selectedCourse} Basics`,
      objective: `Learn core concepts for ${selectedCourse} in ${phaseName || 'this phase'}.`,
      tasks: [
        `Watch the first direct lesson for ${selectedCourse}.`,
        'Write 5 concise notes from the lesson.',
        'Build a tiny practice example from what you watched.',
      ],
      videos: rotateVideos(baseVideos, 0).slice(0, 2),
    },
    {
      phaseLabel: 'Phase 2: Guided Practice',
      title: `${selectedCourse} Guided Practice`,
      objective: `Apply ${selectedCourse} concepts toward ${roleName || 'your target role'} use cases.`,
      tasks: [
        'Follow one guided coding exercise.',
        'Repeat the implementation without looking at the video.',
        'Write one short summary of the mistakes you corrected.',
      ],
      videos: rotateVideos(baseVideos, 1).slice(0, 2),
    },
    {
      phaseLabel: 'Phase 3: Mini Project',
      title: `${selectedCourse} Mini Project`,
      objective: `Apply ${selectedCourse} toward ${roleName || 'your target role'} use cases.`,
      tasks: [
        'Build one mini project based on the course concepts.',
        'Push your code and notes to GitHub.',
        'Record one key challenge and how you solved it.',
      ],
      videos: rotateVideos(baseVideos, 2).slice(0, 2),
    },
    {
      phaseLabel: 'Phase 4: Review and Interview Prep',
      title: `${selectedCourse} Review and Interview Prep`,
      objective: `Consolidate ${selectedCourse} understanding and prepare to explain your work clearly.`,
      tasks: [
        'Revise your notes and explain each concept aloud.',
        'Prepare 5 interview questions based on the module.',
        'Refactor your mini project for clarity and better structure.',
      ],
      videos: rotateVideos(baseVideos, 3).slice(0, 2),
    },
  ];
};

const toRoadmapModulesPrompt = ({ roleName, phaseName, selectedCourse, student }) => {
  const resumeSnippet = typeof student.resumeText === 'string' ? student.resumeText.slice(0, 2500) : '';

  return [
    'You are a learning planner. Build practical modules for one selected course.',
    'Return ONLY valid JSON with keys: summary, modules.',
    'summary: short paragraph for this course learning plan',
    'modules: array (3-5 items) of objects with keys: title, objective, tasks, videos',
    'tasks: array of short action bullets',
    'videos: array of objects with keys title, url, reason (1-3 videos per module)',
    'All video URLs must be direct playable video page links, not search URLs and not playlist URLs.',
    'Prefer YouTube or Vimeo direct video links that can be embedded in iframes.',
    'Keep modules ordered from beginner to advanced for the selected course.',
    '',
    `Target role: ${roleName || 'Data Scientist'}`,
    `Roadmap phase: ${phaseName || 'Not specified'}`,
    `Selected course: ${selectedCourse}`,
    `Student interests: ${student.careerInterests?.join(', ') || 'None'}`,
    `Completed courses: ${student.completedCourses?.join(', ') || 'None'}`,
    `Projects: ${student.projects?.join(', ') || 'None'}`,
    `Resume text: ${resumeSnippet || 'None provided'}`,
  ].join('\n');
};

export const generateRoadmapLearningModules = async ({ roleName, phaseName, selectedCourse, student, quickMode = false }) => {
  if (quickMode) {
    return {
      summary: `Quick learning plan generated instantly for ${selectedCourse}.`,
      modules: buildQuickRoadmapModules({
        selectedCourse,
        phaseName,
        roleName,
      }),
      model: 'quick-fallback',
      provider: 'quick-fallback',
    };
  }

  const prompt = toRoadmapModulesPrompt({ roleName, phaseName, selectedCourse, student });

  try {
    const { parsed, provider, model } = await callAiJson(prompt, {
      maxTokens: 1300,
      providerPreference: 'openai',
    });

    const normalizedModules = normalizeRoadmapModules(parsed.modules);
    const modulesWithVideos = ensureRoadmapModulesHaveVideos({
      modules: normalizedModules,
      selectedCourse,
      roleName,
    });

    return {
      summary:
        typeof parsed.summary === 'string' && parsed.summary.trim()
          ? parsed.summary.trim()
          : `Learning modules generated for ${selectedCourse}.`,
      modules: modulesWithVideos,
      model,
      provider,
    };
  } catch (error) {
    const fallbackModules = ensureRoadmapModulesHaveVideos({
      modules: [],
      selectedCourse,
      roleName,
    });

    return {
      summary: `Generated a fallback learning plan for ${selectedCourse}.`,
      modules: fallbackModules,
      model: 'fallback-plan',
      provider: 'fallback',
      warning: error.message || 'AI generation failed. Served fallback roadmap modules.',
    };
  }
};
