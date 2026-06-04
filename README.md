# Claude Sidebar for Safari

A docked **chat sidebar with a browser agent** for Safari — styled after "Claude for Chrome", but **without Xcode** and without a native app. Built as a **userscript** running in the free [Userscripts](https://apps.apple.com/app/userscripts/id1463298887) app.

The sidebar can **read** the current page, **answer** questions, and act as a simple **agent** that **navigates** and **clicks** on its own — with a visible cursor animation. The AI backend uses **free models** from Groq (Llama) or Google Gemini, switchable at any time.

> ⚠️ **About the name:** The tool looks like Claude and is internally called "Claude Sidebar", but it does **not** use the real Claude/Anthropic. There is no official way to connect a custom tool to a claude.ai subscription — any self-built tool needs its own provider API key. Here those are Groq and Google Gemini (both with a free tier).

---

## Contents
- [Features](#features)
- [Installation](#installation)
- [Getting an API key](#getting-an-api-key)
- [Usage](#usage)
- [Models](#models)
- [Cost & limits](#cost--limits)
- [How the agent works](#how-the-agent-works)
- [Configuration](#configuration)
- [Limitations (honest)](#limitations-honest)
- [Troubleshooting](#troubleshooting)
- [Project structure](#project-structure)

---

## Features

| Feature | Description |
|---|---|
| 💬 **Chat sidebar** | Docked on the right, full height, Claude-style look. Toggle with the ✦ button. |
| 📄 **Page reading** | For every question the model receives the URL, title, the most relevant links and a text excerpt of the current page — it does not guess content. |
| 🤖 **Browser agent** | Can perform `@@NAVIGATE` (open a page/search) and `@@CLICK` (click a link/button) on its own, and continue automatically after page changes. |
| 🖱️ **Cursor animation** | Before a click, the page scrolls to the element, a cursor dot moves to it, highlights it and "clicks" — visible like in Claude for Chrome. |
| ⚡ **Live streaming** | Answers type in token by token (with an automatic fallback). |
| 🔀 **Model switching** | Dropdown at the top: switch between Groq and Gemini models — useful when one free limit is exhausted. |
| 📊 **Usage counter** | "X today" shows the number of API requests for the day (resets daily). |
| 💾 **Persistence** | Chat history, selected model and API keys are stored locally (via `GM` storage) and survive page changes. |

---

## Installation

1. **Install the Userscripts app** (free, from the Mac App Store):
   [Userscripts by Justin Wasack](https://apps.apple.com/app/userscripts/id1463298887)
2. In **Safari → Settings → Extensions**, enable the **Userscripts** extension.
3. Set the extension's website access to **"Allow on Every Website"**.
4. Userscripts toolbar icon → **gear ⚙️** → set the **Userscripts Directory** to this repo's [`userscripts/`](userscripts/) folder (via the file dialog — required for the sandbox permission).
5. The script [`ask-claude.user.js`](userscripts/ask-claude.user.js) now appears in the list. Make sure it is **enabled**.
6. Reload any web page with `Cmd+R` → the **✦ button** appears in the bottom-right corner.

---

## Getting an API key

Both providers are free and usable **without a credit card**. The key is requested on first send and stored **locally only**.

### Groq (default, recommended)
1. [console.groq.com/keys](https://console.groq.com/keys) → sign in with a Google account.
2. **Create API Key** → copy it (starts with `gsk_…`).

### Google Gemini
1. [aistudio.google.com/apikey](https://aistudio.google.com/apikey) → sign in with a Google account.
2. **Create API key** → ideally **in a new project** → copy it (starts with `AIza…`).

> Change a key anytime via the **🔑 button** in the sidebar (changes the key of the currently selected provider).

---

## Usage

- **Normal chat / summarize page:** open the sidebar, ask a question. The model sees the current page. (= 1 request)
- **Select text → ask:** select some text, then open the sidebar — the selection is quoted automatically.
- **Agent task:** e.g. "Open reutlingen-university.de and find the Human Centered Computing program." The agent navigates/clicks on its own (multiple requests).
- **⟳** = new chat / stop agent · **✕** = close · **🔑** = change key.

**Tip:** for reliable results, target a known site directly instead of "hopping" through Google.

---

## Models

Selectable in the dropdown at the top:

| Model | Provider | Character |
|---|---|---|
| **Llama 3.3 70B** | Groq | **Best all-rounder** — smart, free, fast. Default & recommendation. |
| **Llama 3.1 8B (fast)** | Groq | Very fast & cheap on usage, simpler. Good for plain summaries. |
| **Gemini 2.5 Flash-Lite** | Google | Generous free daily limit, solid. |
| **Gemini 2.5 Flash** | Google | A bit smarter than Lite, tighter free limit. |

**Recommendation for "smart + cheap": Groq Llama 3.3 70B.** If its daily limit runs out, switch to another provider in the dropdown.

---

## Cost & limits

- All bundled models have a **free tier** — usually enough for personal use.
- The **agent consumes more**: every navigate/click step is a separate API request. One agent task = several requests.
- The **usage counter** ("X today") helps you keep track.
- **Hit the limit?** Switch providers in the dropdown **or** wait until the next day (Gemini's free tier resets at Pacific midnight).
- Save quota: press **⟳** often (trims the context), prefer simple questions over agent tasks, keep `MAX_STEPS` low.

---

## How the agent works

The agent uses a simple **ReAct text protocol**: the system prompt gives the model the current page plus the task, and it may output **one** control line per step:

```
@@NAVIGATE: <full https URL>
@@CLICK: <visible link text>
```

…or it answers normally in prose (= final answer). Flow:

1. The user gives a task → the model decides: answer, navigate or click.
2. On an action, the state (`cl_state`) is saved and the page is changed/clicked.
3. After reloading, the script detects the running task and continues **automatically**.
4. Safeguards prevent infinite loops:
   - **`MAX_STEPS`** (default 4) limits actions per task.
   - Already **visited URLs** and already **clicked targets** are not repeated.
   - Instead of aborting, a **final answer is forced** at the end.

Technical: streaming primarily via native `fetch`; on strict page CSP it automatically falls back to `GM.xmlHttpRequest`. Provider-specific request/response formats (Gemini vs. OpenAI-compatible Groq) are encapsulated.

---

## Configuration

At the top of [`userscripts/ask-claude.user.js`](userscripts/ask-claude.user.js):

```js
const MAX_STEPS = 4;            // max. agent steps per task
const MODELS = [ … ];           // available models/providers
let selectedModelId = "groq-llama-70b"; // default model
```

Other knobs in the code:
- `max_tokens` / `maxOutputTokens` (answer length, in `buildRequest`)
- Context size: `.slice(0, 15)` (links) and `.slice(0, 1500)` (text excerpt) in `pageContext`
- Cursor look: `#cl-cursor` and `.cl-highlight` in the CSS
- Accent color: `const ACCENT`

---

## Limitations (honest)

This is a **userscript with free models**, not a product like the official agentic "Claude for Chrome". Reliably works:

✅ Reading, summarizing, translating pages, answering questions
✅ Searching, opening pages, clicking simple links

Hard / unreliable:

⚠️ Complex shop interactions (cart, size selection, checkout, login)
⚠️ JavaScript buttons, cookie banners, pages with very strict security policies
⚠️ Multi-step tasks across many pages

The cursor animation is a **visual reproduction** — it shows *where* a click happens; the click itself is performed in code.

---

## Troubleshooting

| Problem | Cause / fix |
|---|---|
| Script does not appear | Set the Userscripts Directory to `userscripts/`, then 🔄 Refresh. |
| ✦ button missing | The extension needs access to "all websites"; reload the page. |
| `limit: 0` (Gemini) | Create the key in a **new** project; possibly switch to `gemini-2.5-flash-lite`. |
| "quota exceeded" | Daily limit reached → switch models or wait. |
| No live streaming | The page blocks `fetch` (CSP) → the fallback delivers the full answer at the end. With Groq it depends on CORS. |
| Agent does nothing | Older versions failed to detect actions preceded by prose — use the current version (≥ 0.9.1). |

---

## Project structure

```
.
├── README.md
├── .gitignore
└── userscripts/
    └── ask-claude.user.js   # the entire userscript (UI, agent, LLM integration)
```

The script is **self-contained** (vanilla JS, no build step, no dependencies). Everything — UI, styles, agent logic, API calls — lives in this single file.

---

## License

Personal project. Use at your own risk; the respective API terms of service of Groq and Google apply.
