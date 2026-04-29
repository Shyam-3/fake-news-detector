# TruthLens — Fake News Detection on Social Media
### Deep Learning · NLP · Multi-Model Ensemble

---

## Why a Server is Needed (CORS Fix)

Browsers block direct API calls to external servers (like `api.anthropic.com`) when opening HTML files locally — this is called the **CORS policy**. The included `server.js` acts as a local proxy to solve this:

```
Browser → localhost:3000/api/analyze → api.anthropic.com
              (server.js proxy)
```

---

## Setup & Running

### Prerequisites
- [Node.js](https://nodejs.org) v14+ installed

---

### Step 1 — Get an Anthropic API Key
- Visit https://console.anthropic.com
- Sign in → API Keys → Create Key
- Copy the key (starts with `sk-ant-api03-...`)

---

### Step 2 — Start the Server

Open a terminal in this project folder:

```bash
node server.js
```

You should see:
```
╔═══════════════════════════════════════════╗
║   TruthLens — Fake News Detector           ║
╠═══════════════════════════════════════════╣
║   Server running at:                       ║
║   http://localhost:3000                    ║
╚═══════════════════════════════════════════╝
```

Optional — set your API key via environment variable:
```bash
# Windows
set ANTHROPIC_API_KEY=sk-ant-api03-...
node server.js

# Mac / Linux
ANTHROPIC_API_KEY=sk-ant-api03-... node server.js
```

---

### Step 3 — Open the App
- Open **http://localhost:3000** in your browser
- Click the gear icon ⚙ → enter your API key → Save & Continue
- Start analyzing posts!

---

## Features

- 3 Input Modes: Text/Post, URL/Link, Image/Screenshot
- AI-Powered verdict: FAKE / REAL / UNCERTAIN
- Confidence score with animated chart
- 4 NLP metrics: Emotional Language, Source Credibility, Factual Consistency, Clickbait
- Specific signals explaining WHY the verdict was given
- 4 Model ensemble scores: BERT, RoBERTa, LSTM+Attention, XGBoost
- Export analysis as a text report

---

## Project Structure

```
fake-news-detector/
├── index.html      ← Main app UI
├── server.js       ← Node.js proxy server (run this!)
├── package.json    ← Project metadata
├── css/
│   └── style.css   ← Dark theme styles
├── js/
│   └── app.js      ← Frontend logic
└── README.md
```

---

## Disclaimer

For educational and research purposes. Always verify through trusted fact-checking sources.
