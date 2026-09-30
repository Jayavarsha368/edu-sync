# Edu-Sync — AI Study Planner

An AI-powered study planning app for students. Set exam goals, get an auto-generated study schedule, chat with an AI study assistant, and practice with AI-generated questions.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, React Router 6, Recharts, Axios |
| Backend | Node.js, Express 5 |
| Database | MongoDB (Mongoose) |
| AI | Ollama (local) or OpenAI GPT-4o-mini |
| Auth | JWT (7-day tokens) + bcrypt |

---

## Prerequisites

- **Node.js** v18+ and **npm** v9+
- **MongoDB** running locally on port `27017`
- **AI**: either [Ollama](https://ollama.com/) with `llama3.2:3b` **or** an OpenAI API key

---

## Quick Start

### 1. Clone and install dependencies

```bash
# Install root + all workspace deps in one go
npm run install-all
```

### 2. Configure environment variables

```bash
cd server
copy .env.example .env   # Windows
# Edit .env and fill in your values
```

The key settings in `server/.env`:

```env
MONGO_URI=mongodb://127.0.0.1:27017/edu-sync
JWT_SECRET=<generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">

# AI — pick one:
AI_PROVIDER=ollama          # use local Ollama
LOCAL_AI_MODEL=llama3.2:3b
OLLAMA_URL=http://127.0.0.1:11434/api/chat

# OR
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_CHAT_MODEL=gpt-4o-mini
```

### 3. Start MongoDB

```bash
mongod
```

### 4. (If using Ollama) Pull the model

```bash
ollama pull llama3.2:3b
```

### 5. Start the app

```bash
# From the root directory — starts both server and client
npm run dev
```

| Service | URL |
|---------|-----|
| React app | http://localhost:3000 |
| API server | http://localhost:5000 |

---

## Features

- **Goal Setup** — set exam name, subjects, dates, and upload your syllabus (PDF, image, or text)
- **AI Study Plan** — the AI orders topics intelligently (weak subjects get more spacing)
- **Study Planner** — day-by-day task list; mark tasks done, spread missed work, mark days complete
- **Auto-Reschedule** — missed days are automatically redistributed on login
- **AI Chat Assistant** — ask questions about your syllabus, reduce workload, or mark topics done via chat
- **Practice Questions** — AI generates MCQs, 1/2/7/14-mark questions from your syllabus
- **Progress Dashboard** — calendar heatmap, per-subject bar chart, overall completion ring

---

## Project Structure

```
Edu-Sync/
├── server/
│   ├── config/db.js          — MongoDB connection
│   ├── controllers/          — Route handlers (auth, goal, schedule, chat, questions)
│   ├── middleware/            — JWT auth guard
│   ├── models/               — Mongoose schemas (User, Goal, Schedule, ChatMessage, QuestionSet)
│   ├── routes/               — Express routers
│   ├── utils/
│   │   ├── aiScheduler.js    — AI topic ordering (Ollama + OpenAI)
│   │   ├── aiQuestionGenerator.js — AI question generation
│   │   └── scheduler.js      — Rule-based fallback scheduler
│   ├── .env                  — Your local secrets (not committed)
│   ├── .env.example          — Template
│   └── server.js             — Entry point
└── client/
    ├── src/
    │   ├── api/axios.js       — Axios instance + interceptors
    │   ├── context/           — AuthContext (JWT + user state)
    │   ├── components/        — Sidebar, ChatWidget, ProtectedRoute
    │   └── pages/             — Dashboard, GoalSetup, StudyPlan, Progress, PracticeQuestions, Profile, MyGoals
    └── package.json
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/profile` | Get profile (auth) |
| PUT | `/api/auth/profile` | Update name/password (auth) |
| POST | `/api/goals` | Create goal + generate schedule (auth) |
| GET | `/api/goals` | List all goals (auth) |
| GET | `/api/goals/:id` | Get single goal (auth) |
| PUT | `/api/goals/:id` | Update + regenerate schedule (auth) |
| DELETE | `/api/goals/:id` | Delete goal + schedule (auth) |
| DELETE | `/api/goals/:id/subject` | Remove a subject from plan (auth) |
| GET | `/api/schedule/:goalId` | Get full schedule (auth) |
| PATCH | `/api/schedule/:goalId/task` | Toggle task completion (auth) |
| POST | `/api/schedule/:goalId/reallocate` | Spread a day's tasks to future (auth) |
| POST | `/api/schedule/:goalId/auto-reschedule` | Move past missed tasks forward (auth) |
| POST | `/api/schedule/:goalId/complete-day` | Mark day done, move pending (auth) |
| GET | `/api/chat/:goalId` | Chat history (auth) |
| POST | `/api/chat/:goalId` | Send message, get AI reply + action (auth) |
| POST | `/api/questions/:goalId` | Generate question set (auth) |
| GET | `/api/questions/:goalId` | List past question sets (auth) |
| DELETE | `/api/questions/:goalId/:setId` | Delete a question set (auth) |
