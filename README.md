# Student Study Agent

**Agentic AI-based Personal Study Assistant**

Student Study Agent helps students plan what to study, keep track of deadlines, understand their course material, and see how close they are to the career they want. An AI agent sits on top of these tools. It knows which page you are on and what you have done so far, and it suggests what to do next.

## The agents

| Agent | What the student gets |
|---|---|
| **Coordinator Agent** (Hub) | One chat for everything. It routes each message to the right specialist agents, passes results between them (for example, extracted deadlines go into the study plan), and shows every step it took |
| **Study Planner Agent** | Daily, weekly or monthly schedules. Time per subject is weighted by priority, missed tasks are rescheduled, tracked deadlines and weak quiz topics are added, and the week before an exam becomes a revision plan. Session length follows the student's mood |
| **Notes Summarizer Agent** | Key points, flashcards, Q&A pairs and exam revision notes from PDFs, images (OCR), slides, pasted notes, YouTube lectures or web articles. The study pack can be written in English, Hindi or Telugu, whatever language the source uses, and a finished pack or the full text can be translated into any language the student types. Very long material is summarized in parts at the same time |
| **Assignment & Deadline Tracker Agent** | Finds deadlines in messages and documents (including relative dates like "next Friday"), keeps the assignment list, sends browser reminders, and flags urgent or overdue work |
| **Retrieval (RAG) Study Helper Agent** | A personal document library. Answers are generated only from the retrieved passages, with page references, and validation rules reject unsupported sentences |
| **Concept Tutor Agent** | Simple explanations, analogies, step-by-step solutions for numeric problems and formulas, worked examples and practice exercises. A reviewer step re-checks problem solutions and corrects them |
| **Revision & Quiz Agent** | MCQ, short and long-answer quizzes from a topic, pasted notes or the RAG library. It grades answers, tracks accuracy per topic and reports weak areas |
| **Forgetting-aware revision** | A memory model predicts recall for each quiz topic with a forgetting curve. The planner adds a revision session just before recall falls below 70%, fitting it around mood, exams and assignment days. The rules are in `backend/src/retentionService.js`; run `npm test` in `backend` to check them |
| **Memory Agent** | Remembers each student's subjects, mood, recently studied topics and weak areas, so every agent can personalize its output |

Optional features from the project document that are included:
- **Voice:** speak questions in the Hub, and have replies read aloud. Uses the browser's Web Speech API, so it works best in Chrome or Edge.
- **Mood-based study recommendations**
- **Memory agent**
- **Multi-agent reasoning with reflection and self-correction:** the RAG retry after a failed validation, and the tutor's reviewer step.

### Notes from YouTube and web links

Paste a link into the Notes Summarizer:
- **YouTube:** the video's captions are read (real captions first, then auto-generated ones). When a video has no usable captions, for example a Telugu or Hindi lecture whose auto-captions are English guesses, Gemini watches the video instead. That takes about a minute, works for videos up to 45 minutes, and uses a lot of the free Gemini quota.
- **Web pages:** the main article text is read, keeping its headings as topics. PDF links are read too; scanned PDFs need to be downloaded and uploaded for OCR.
- Links to private or local network addresses are refused.

Career tools (profile, role analysis, roadmap, dashboard) remain available under the **Career** menu.

### Working without AI

Every agent tries the AI provider first and falls back to a built-in rule-based engine when no key is set or the provider fails (for example, when it has no credits):
- the planner still builds the schedule
- RAG returns verbatim sentences from the retrieved passages
- quizzes are built from the student's notes

Each result shows which engine produced it. When a Gemini model runs out of its daily free quota or times out, it is skipped until it resets and the next model answers. After an authentication error, AI calls pause for 5 minutes so the fallbacks respond immediately.

The Hub routes clear requests ("explain…", "quiz me…", "plan…") with rules, so they need only one AI call, and it runs independent agents at the same time.

## Built-in knowledge base

The tutor and quiz agents use a curated knowledge base of 138 syllabus topics:
- **Artificial intelligence (15):** agents, search and A*, minimax, logic, expert systems, NLP, computer vision, fuzzy logic, genetic algorithms, Bayesian networks, generative AI, transformers and LLMs, AI ethics.
- **Machine learning (21):** supervised, unsupervised and reinforcement learning, regression, decision trees, ensembles, SVM, KNN, Naive Bayes, clustering, PCA, gradient descent, evaluation metrics, preprocessing, CNNs, RNNs and LSTMs.
- **Cloud computing (18):** service and deployment models, virtualization, Docker, Kubernetes, serverless, storage, security, scaling, AWS/Azure/GCP, networking, microservices, DevOps, edge computing, disaster recovery and pricing.
- **Role skills (16):** Python, Java, JavaScript, HTML/CSS, React, Node.js and Express, REST APIs, full stack development, C/C++, embedded systems and Embedded C, IoT, MQTT, data visualization, NumPy and Pandas, Excel and system design.
- **Careers (11):** Data Scientist, AI Engineer, Machine Learning Engineer, Full Stack Developer, Python Developer, Java Developer, Cloud Engineer, SQL Developer, IoT Engineer, Software Developer and Data Analyst (skills, roadmap, responsibilities, salary, certifications), matching the roles in `data/industry_skill_matrix.csv`.
- **Other computer science:** DBMS, operating systems, data structures and algorithms, networks and OOP.
- **Maths and sciences:** maths, physics, chemistry and biology.

Each topic has:
- an explanation and an analogy
- key points and steps
- formulas and a worked example
- practice questions and common mistakes
- question-and-answer pairs for common exam questions (advantages, types, "X vs Y", how it works)

Questions like "what is dbms?" or "explain normalization with example" are matched to the right topic. Specific questions such as "advantages of cloud computing" or "bagging vs boosting" also get a direct answer at the top. This means the tutor still gives a full explanation, and the quiz agent can still build a quiz, when AI is offline. When AI is online, the matching topic is passed to the AI as reference material so its answers stay accurate.

- The seed files are in `backend/data/knowledge/*.json`. To add a topic, add an entry with a new `id`.
- To change a built-in topic, edit it and increase its `version` number.
- On startup the topics are loaded into the MongoDB `knowledgetopics` collection. Topics you edit directly in MongoDB are kept.
- Endpoints: `GET /api/knowledge/topics` and `GET /api/knowledge/search?q=...`.

## Data stored in MongoDB

| Collection | Contents | Seeded from |
|---|---|---|
| `knowledgetopics` | Built-in tutor knowledge base | `backend/data/knowledge/*.json` |
| `industryroles` | Industry roles and required skills | `data/industry_skill_matrix.csv` |
| `samplestudents` | Sample student profiles | `data/student_skill_profiles.csv` |
| `studyrecords` | Per-student RAG documents, quizzes, quiz attempts and memory | Created by the agents |
| `users`, `profilerecords`, `analysisrecords` | Accounts, saved profiles, analyses | Created by the app |

The CSV and JSON files seed MongoDB on startup, and only records that are missing are added. After that, MongoDB is the source of truth. If MongoDB is not connected, the app reads the same files directly, so it keeps working.

## How RAG works

1. **Ingest:** text is extracted from the upload (PDF, PPTX, image OCR or text) and split into overlapping chunks of about 140 words. Each chunk keeps its page number.
2. **Store:** chunks are saved per student in MongoDB, or in `backend/data/study_store.json` without MongoDB.
3. **Retrieve:** the question is ranked against the chunks with BM25, plus a bonus for exact phrase matches. If the best chunk covers less than 30% of the question's terms, the agent declines to answer.
4. **Generate:** the AI answers using only the numbered sources and cites them like `[S1]`.
5. **Validate:** the answer must cite at least one retrieved source, must cite only retrieved sources, and every sentence must share at least 50% of its words with the cited text.
6. **Self-correct:** if validation fails, the agent sends the unsupported sentences back to the AI for one rewrite. If that fails too, it falls back to an extractive answer.

## Project structure

```
backend/src/agents/   Coordinator, planner, summarizer, deadline, RAG, tutor, quiz and memory agents
backend/src/          Express API, RAG engine (ragEngine.js), shared storage (studyStore.js), career services
frontend/src/pages/   AgentHub, StudyPlanner, NotesSummarizer, AssignmentTracker, RetrievalHelper, ConceptTutor, QuizAgent, career pages
data/                 CSV datasets: industry roles and sample student profiles
analytics/            Optional Python script for offline roadmap generation
```

## Tech stack

- **Frontend:** React 19, Vite, Tailwind CSS, Framer Motion, Recharts, Axios
- **Backend:** Node.js 20, Express, Multer, pdf-parse, JSZip, Tesseract.js (OCR)
- **AI:** NVIDIA NIM or OpenAI-compatible chat completion APIs, with automatic fallback between them
- **Storage:** MongoDB Atlas (optional). Without it, the app runs on the CSV data and stores users in a local JSON file

## Getting started

### Backend

```powershell
cd backend
copy .env.example .env   # then fill in your values
npm install
npm run dev
```

The API runs at `http://localhost:4000`. Visit `/health` to confirm it is running and to see whether MongoDB is connected.

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

The app runs at `http://127.0.0.1:5173`. When the frontend is deployed somewhere else, set `VITE_API_BASE_URL` to the backend URL.

## Configuration (`backend/.env`)

| Variable | Purpose |
|---|---|
| `PORT` | API port (default `4000`) |
| `MONGODB_URI`, `MONGODB_DB_NAME` | MongoDB Atlas connection (optional) |
| `FRONTEND_ORIGIN` | Comma-separated list of origins allowed by CORS |
| `AI_PROVIDER` | `auto` (Gemini, then NVIDIA, then OpenAI), `gemini`, `nvidia` or `openai` |
| `GEMINI_API_KEY` | Google Gemini API key (from Google AI Studio); the main AI provider |
| `GEMINI_MODEL` | Comma-separated models tried in order (default `gemini-3.5-flash-lite,gemini-3.5-flash,gemini-3.8-flash`) |
| `AI_TIMEOUT_MS` | Time limit per AI request before falling back (default `20000`; study packs allow 30 s, or 60 s in Hindi or Telugu) |
| `AI_VIDEO_TIMEOUT_MS` | Time limit for Gemini to watch a YouTube video without captions (default `150000`) |
| `NVIDIA_API_KEY`, `NVIDIA_MODEL`, `NVIDIA_API_URL` | NVIDIA NIM settings |
| `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_API_URL` | OpenAI settings |

Never commit `.env`. It is already listed in `.gitignore`.

## API endpoints

Study endpoints identify the student with a `userId` field (in the JSON body, the form data, or the query string). The frontend sends the signed-in email, or a per-browser guest id.

| Area | Endpoints |
|---|---|
| Health | `GET /health` |
| Auth | `POST /api/auth/register`, `POST /api/auth/login` |
| Agents | `GET /api/agents`, `POST /api/agent/chat` (coordinator; accepts an optional `material` file) |
| Memory | `GET /api/memory`, `PUT /api/memory` |
| Study planner | `POST /api/study-planner` |
| Notes | `POST /api/notes/extract`, `POST /api/notes/extract-jobs` (a file, or a `url` for YouTube or a web page), `GET /api/notes/extract-jobs/:id`, `POST /api/notes/summarize` (`language`: `english`, `hindi` or `telugu`) |
| Assignments | `POST /api/assignments/extract` |
| RAG library | `GET /api/rag/documents`, `POST /api/rag/documents`, `DELETE /api/rag/documents/:id`, `POST /api/rag/query` |
| One-off retrieval | `POST /api/retrieval/query` (asks a single uploaded file without saving it) |
| Tutor | `POST /api/tutor/explain` (`mode`: `explain` or `problem`) |
| Quiz | `POST /api/quiz/generate`, `POST /api/quiz/submit`, `GET /api/quiz/performance` |
| Memory strength | `GET /api/retention` (add `?date=YYYY-MM-DD` to see the forecast for a later day) |
| Profile | `POST /api/resume/parse`, `POST /api/profiles`, `GET /api/profiles` |
| Career analysis | `GET /api/roles`, `GET /api/students`, `POST /api/analyze`, `POST /api/analyze/ai-advisor`, `GET /api/analyses` |
| Roadmap | `POST /api/roadmap/modules` |

### Example: career readiness analysis

```json
POST /api/analyze
{
  "studentId": "STU001",
  "targetRole": "Data Scientist",
  "studentSkills": { "Python": 3, "SQL": 3 }
}
```

The readiness score gives partial credit for each required skill:

`readiness = average over required skills of (min(student level, required level) / required level) × 100`

## Deployment

- **Backend:** Render, using [`render.yaml`](render.yaml)
- **Frontend:** Vercel ([`vercel.json`](vercel.json)) or Netlify ([`frontend/netlify.toml`](frontend/netlify.toml))
- **CI:** a GitHub Actions workflow builds the frontend on every push to `master`
