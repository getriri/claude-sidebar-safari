// ==UserScript==
// @name         Claude Sidebar
// @namespace    irene.claude.safari
// @version      0.13.0
// @description  Angedockte Chat-Seitenleiste mit Browser-Agent & Modellwechsel (Groq / Gemini) – ohne Xcode
// @author       Irene
// @match        *://*/*
// @downloadURL  https://raw.githubusercontent.com/getriri/claude-sidebar-safari/main/userscripts/ask-claude.user.js
// @updateURL    https://raw.githubusercontent.com/getriri/claude-sidebar-safari/main/userscripts/ask-claude.user.js
// @grant        GM.xmlHttpRequest
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.deleteValue
// @connect      generativelanguage.googleapis.com
// @connect      api.groq.com
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";
  if (window.top !== window.self) return; // nicht in iframes laufen

  const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
  const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
  const ACCENT = "#d97757";
  const MAX_STEPS = 4;

  const MODELS = [
    { id: "groq-llama-70b", label: "Groq · Llama 3.3 70B", provider: "groq", model: "llama-3.3-70b-versatile" },
    { id: "groq-llama-8b", label: "Groq · Llama 3.1 8B (schnell)", provider: "groq", model: "llama-3.1-8b-instant" },
    { id: "gemini-flash-lite", label: "Gemini · 2.5 Flash-Lite", provider: "gemini", model: "gemini-2.5-flash-lite" },
    { id: "gemini-flash", label: "Gemini · 2.5 Flash", provider: "gemini", model: "gemini-2.5-flash" },
  ];

  let selectedModelId = "groq-llama-70b";
  let layoutWidth = 400, layoutSide = "right";
  let theme = "auto"; // "light" | "dark" | "auto"
  let history = []; // [{id, title, ts, transcript}]
  let state = { transcript: [], task: null };
  let usage = { date: "", count: 0 };
  let busy = false;
  let _force = false; // erzwingt finale Antwort (keine Aktion mehr)
  let elsReady = false;
  let panelEl, listEl, inputEl, launcherEl, sendBtn;

  function currentModel() {
    return MODELS.find((m) => m.id === selectedModelId) || MODELS[0];
  }
  function providerName(p) { return p === "groq" ? "Groq" : "Google Gemini"; }
  function keyStore(p) { return `${p}_api_key`; }
  function keyWhere(p) { return p === "groq" ? "console.groq.com/keys" : "aistudio.google.com/apikey"; }

  // ---------- Styles ----------
  function injectStyles() {
    const css = `
      #cl-launcher {
        position: fixed; right: 22px; bottom: 22px; z-index: 2147483647;
        width: 54px; height: 54px; border-radius: 50%; border: none;
        background: ${ACCENT}; color: #fff; font-size: 24px; cursor: pointer;
        box-shadow: 0 6px 20px rgba(0,0,0,.32); display: flex;
        align-items: center; justify-content: center; transition: transform .15s;
        -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px);
      }
      #cl-launcher:hover { transform: scale(1.06); }
      #cl-panel {
        --bg: rgba(245,244,239,.68);
        --surface: rgba(255,255,255,.60);
        --text: #1d1d1f;
        --muted: #8c877e;
        --border: rgba(0,0,0,.08);
        --input: rgba(255,255,255,.55);
        position: fixed; top: 0; right: 0; height: 100vh; width: 400px;
        max-width: 92vw; z-index: 2147483647; background: var(--bg);
        -webkit-backdrop-filter: blur(26px) saturate(1.7); backdrop-filter: blur(26px) saturate(1.7);
        box-shadow: -10px 0 44px rgba(0,0,0,.24); display: flex; flex-direction: column;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: var(--text); transform: translateX(100%);
        transition: transform .28s cubic-bezier(.4,0,.2,1);
        border-left: 1px solid var(--border);
      }
      #cl-panel.dark {
        --bg: rgba(28,28,30,.60);
        --surface: rgba(78,78,82,.48);
        --text: #f3f2ef;
        --muted: #a6a199;
        --border: rgba(255,255,255,.13);
        --input: rgba(255,255,255,.09);
      }
      #cl-panel.left { left: 0; right: auto; transform: translateX(-100%);
        border-left: none; border-right: 1px solid var(--border);
        box-shadow: 10px 0 44px rgba(0,0,0,.24); }
      #cl-resize { position: absolute; top: 0; bottom: 0; left: 0; width: 8px;
        cursor: ew-resize; z-index: 6; }
      #cl-resize:hover { background: linear-gradient(90deg, ${ACCENT}55, transparent); }
      #cl-panel.left #cl-resize { left: auto; right: 0;
        background-image: linear-gradient(270deg, ${ACCENT}00, transparent); }
      #cl-panel.left #cl-resize:hover { background: linear-gradient(270deg, ${ACCENT}55, transparent); }
      #cl-panel.open { transform: translateX(0); }
      #cl-header {
        display: flex; align-items: center; gap: 5px; padding: 11px 12px;
        border-bottom: 1px solid var(--border); background: var(--surface);
        -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
      }
      #cl-model { flex: 1; min-width: 0; font-size: 12px; font-family: inherit;
        border: 1px solid var(--border); border-radius: 9px; padding: 5px 6px;
        background: var(--input); color: var(--text); cursor: pointer; }
      #cl-usage { font-size: 10px; color: var(--muted); white-space: nowrap; }
      #cl-header button {
        border: none; background: transparent; cursor: pointer; font-size: 15px;
        color: var(--muted); padding: 3px; line-height: 1;
      }
      #cl-header button:hover { color: var(--text); }
      #cl-list { flex: 1; overflow-y: auto; padding: 16px; display: flex;
        flex-direction: column; gap: 10px; }
      .cl-msg { max-width: 85%; padding: 10px 13px; border-radius: 16px;
        font-size: 14px; line-height: 1.5; white-space: pre-wrap; word-wrap: break-word;
        -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); }
      .cl-msg.user { align-self: flex-end; background: ${ACCENT}; color: #fff;
        border-bottom-right-radius: 5px; }
      .cl-msg.assistant { align-self: flex-start; background: var(--surface); color: var(--text);
        border: 1px solid var(--border); border-bottom-left-radius: 5px; }
      .cl-msg.thinking { color: var(--muted); font-style: italic; }
      .cl-status { align-self: center; font-size: 12px; color: var(--muted);
        font-style: italic; text-align: center; }
      .cl-empty { color: var(--muted); font-size: 13px; text-align: center; margin-top: 40px; }
      #cl-input-area { border-top: 1px solid var(--border); padding: 12px; background: var(--surface);
        -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
        display: flex; gap: 8px; align-items: flex-end; }
      #cl-input { flex: 1; resize: none; border: 1px solid var(--border); border-radius: 12px;
        padding: 9px 11px; font-size: 14px; font-family: inherit; max-height: 140px;
        outline: none; background: var(--input);
        color: var(--text) !important; -webkit-text-fill-color: var(--text); }
      #cl-input::placeholder { color: var(--muted); -webkit-text-fill-color: var(--muted); }
      #cl-input:focus { border-color: ${ACCENT}; }
      #cl-send { border: none; background: ${ACCENT}; color: #fff; border-radius: 12px;
        width: 40px; height: 40px; cursor: pointer; font-size: 17px; flex-shrink: 0; }
      #cl-send:disabled { opacity: .5; cursor: default; }
      #cl-history { position: absolute; left: 0; right: 0; top: 47px; bottom: 0;
        background: var(--bg); -webkit-backdrop-filter: blur(26px); backdrop-filter: blur(26px);
        z-index: 5; display: none; flex-direction: column; overflow-y: auto; padding: 12px; }
      #cl-history.show { display: flex; }
      .cl-hist-head { font-size: 12px; color: var(--muted); margin: 2px 2px 10px; }
      .cl-hist-item { padding: 10px 12px; border-radius: 11px; background: var(--surface);
        border: 1px solid var(--border); margin-bottom: 8px; cursor: pointer; }
      .cl-hist-item:hover { border-color: ${ACCENT}; }
      .cl-hist-title { font-size: 13px; color: var(--text); font-weight: 500;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .cl-hist-time { font-size: 11px; color: var(--muted); margin-top: 2px; }
      .cl-hist-empty { color: var(--muted); font-size: 13px; text-align: center; margin-top: 30px; line-height: 1.6; }
      #cl-cursor { position: fixed; left: 50%; top: 50%; z-index: 2147483646;
        width: 24px; height: 24px; margin: -12px 0 0 -12px; border-radius: 50%;
        pointer-events: none; background: rgba(217,119,87,.30);
        border: 2px solid ${ACCENT}; box-shadow: 0 0 0 5px rgba(217,119,87,.12);
        opacity: 0; transition: left .55s cubic-bezier(.4,0,.2,1),
        top .55s cubic-bezier(.4,0,.2,1), opacity .2s, transform .15s; }
      #cl-cursor.show { opacity: 1; }
      #cl-cursor.click { transform: scale(.5); }
      .cl-highlight { outline: 3px solid ${ACCENT} !important; outline-offset: 2px !important;
        box-shadow: 0 0 0 6px rgba(217,119,87,.18) !important; }
    `;
    const s = document.createElement("style");
    s.textContent = css;
    document.head.appendChild(s);
  }

  // ---------- DOM ----------
  function build() {
    if (elsReady) return;
    injectStyles();

    launcherEl = document.createElement("button");
    launcherEl.id = "cl-launcher";
    launcherEl.textContent = "✦";
    launcherEl.title = "Claude öffnen";
    launcherEl.addEventListener("click", openPanel);
    document.body.appendChild(launcherEl);

    panelEl = document.createElement("div");
    panelEl.id = "cl-panel";
    panelEl.innerHTML = `
      <div id="cl-resize" title="Breite ziehen"></div>
      <div id="cl-header">
        <span style="color:${ACCENT};font-size:18px;">✦</span>
        <select id="cl-model" title="Modell wählen"></select>
        <span id="cl-usage" title="Anfragen heute (Gratis-Limit setzt sich täglich zurück)">0 heute</span>
        <button id="cl-hist-btn" title="Chat-Verlauf">🕘</button>
        <button id="cl-theme" title="Hell / Dunkel">🌙</button>
        <button id="cl-dock" title="Seite wechseln (links/rechts)">⇆</button>
        <button id="cl-key" title="API-Key des Modells ändern">🔑</button>
        <button id="cl-clear" title="Neuer Chat / Stopp">⟳</button>
        <button id="cl-close" title="Schließen">✕</button>
      </div>
      <div id="cl-list"></div>
      <div id="cl-history"></div>
      <div id="cl-input-area">
        <textarea id="cl-input" rows="1" placeholder="Nachricht an Claude…"></textarea>
        <button id="cl-send" title="Senden">➤</button>
      </div>`;
    document.body.appendChild(panelEl);

    listEl = panelEl.querySelector("#cl-list");
    inputEl = panelEl.querySelector("#cl-input");
    sendBtn = panelEl.querySelector("#cl-send");

    const sel = panelEl.querySelector("#cl-model");
    sel.innerHTML = MODELS.map((m) => `<option value="${m.id}">${m.label}</option>`).join("");
    sel.value = selectedModelId;
    sel.addEventListener("change", async () => {
      selectedModelId = sel.value;
      await GM.setValue("cl_model", selectedModelId);
    });

    panelEl.querySelector("#cl-close").addEventListener("click", closePanel);
    panelEl.querySelector("#cl-clear").addEventListener("click", clearChat);
    panelEl.querySelector("#cl-key").addEventListener("click", changeKey);
    panelEl.querySelector("#cl-theme").addEventListener("click", toggleTheme);
    panelEl.querySelector("#cl-hist-btn").addEventListener("click", toggleHistory);
    panelEl.querySelector("#cl-dock").addEventListener("click", toggleDock);
    panelEl.querySelector("#cl-resize").addEventListener("mousedown", startResize);
    sendBtn.addEventListener("click", onSend);
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); }
    });
    inputEl.addEventListener("input", autoGrow);

    elsReady = true;
  }

  function autoGrow() {
    inputEl.style.height = "auto";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 140) + "px";
  }

  function openPanel() {
    build();
    panelEl.classList.add("open");
    launcherEl.style.display = "none";
    const sel = (window.getSelection()?.toString() || "").trim();
    if (sel && !inputEl.value) inputEl.value = `Zu diesem Textabschnitt:\n"${sel}"\n\n`;
    autoGrow();
    inputEl.focus();
  }
  function closePanel() {
    panelEl.classList.remove("open");
    launcherEl.style.display = "flex";
  }
  function clearChat() {
    archiveCurrent();
    state = { transcript: [], task: null };
    saveState();
    renderAll();
    const box = panelEl.querySelector("#cl-history");
    if (box) box.classList.remove("show");
  }

  // ---------- Layout (Breite / Seite) ----------
  function saveLayout() { return GM.setValue("cl_layout", JSON.stringify({ width: layoutWidth, side: layoutSide })); }
  async function loadLayout() {
    try {
      const o = JSON.parse(await GM.getValue("cl_layout", "")) || {};
      layoutWidth = o.width || 400;
      layoutSide = o.side === "left" ? "left" : "right";
    } catch { layoutWidth = 400; layoutSide = "right"; }
  }
  function clampWidth(w) { return Math.max(300, Math.min(Math.round(window.innerWidth * 0.92), w)); }
  function applyLayout() {
    if (!panelEl) return;
    layoutWidth = clampWidth(layoutWidth);
    panelEl.classList.toggle("left", layoutSide === "left");
    panelEl.style.width = layoutWidth + "px";
    panelEl.style.maxWidth = "95vw";
  }
  function toggleDock() {
    layoutSide = layoutSide === "left" ? "right" : "left";
    saveLayout();
    applyLayout();
  }
  function startResize(e) {
    e.preventDefault();
    const prevTransition = panelEl.style.transition;
    panelEl.style.transition = "none";
    document.body.style.userSelect = "none";
    const onMove = (ev) => {
      const x = ev.clientX;
      layoutWidth = clampWidth(layoutSide === "left" ? x : window.innerWidth - x);
      panelEl.style.width = layoutWidth + "px";
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
      panelEl.style.transition = prevTransition;
      saveLayout();
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  // ---------- Theme (Hell/Dunkel) ----------
  function systemDark() {
    try { return window.matchMedia("(prefers-color-scheme: dark)").matches; } catch { return false; }
  }
  function effectiveDark() { return theme === "dark" || (theme === "auto" && systemDark()); }
  function applyTheme() {
    if (!panelEl) return;
    const d = effectiveDark();
    panelEl.classList.toggle("dark", d);
    const b = panelEl.querySelector("#cl-theme");
    if (b) b.textContent = d ? "☀️" : "🌙";
  }
  async function loadTheme() {
    try { theme = (await GM.getValue("cl_theme", "")) || "auto"; } catch { theme = "auto"; }
  }
  async function toggleTheme() {
    theme = effectiveDark() ? "light" : "dark";
    await GM.setValue("cl_theme", theme);
    applyTheme();
  }

  // ---------- Chat-Verlauf ----------
  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }
  function timeAgo(ts) {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return "gerade eben";
    const m = Math.floor(s / 60); if (m < 60) return `vor ${m} Min`;
    const h = Math.floor(m / 60); if (h < 24) return `vor ${h} Std`;
    const d = Math.floor(h / 24); return `vor ${d} Tag${d > 1 ? "en" : ""}`;
  }
  function saveHistory() { return GM.setValue("cl_history", JSON.stringify(history)); }
  async function loadHistory() {
    try { const r = await GM.getValue("cl_history", ""); history = r ? JSON.parse(r) : []; } catch { history = []; }
    if (!Array.isArray(history)) history = [];
  }
  function firstUserText() {
    const e = state.transcript.find((x) => x.role === "user");
    return e ? e.content : "";
  }
  function archiveCurrent() {
    if (!state.transcript.some((e) => e.role === "user")) return;
    const title = (firstUserText() || "Chat").replace(/\s+/g, " ").slice(0, 50);
    history.unshift({ id: `${Date.now()}-${history.length}`, title, ts: Date.now(), transcript: state.transcript });
    history = history.slice(0, 40);
    saveHistory();
  }
  function renderHistory() {
    const box = panelEl.querySelector("#cl-history");
    if (!box) return;
    if (!history.length) {
      box.innerHTML = `<div class="cl-hist-empty">Noch keine gespeicherten Chats.<br>Mit ⟳ startest du einen neuen –<br>der alte landet dann hier.</div>`;
      return;
    }
    box.innerHTML = `<div class="cl-hist-head">Frühere Chats</div>` +
      history.map((h, i) => `<div class="cl-hist-item" data-i="${i}"><div class="cl-hist-title">${escapeHtml(h.title)}</div><div class="cl-hist-time">${timeAgo(h.ts)}</div></div>`).join("");
    box.querySelectorAll(".cl-hist-item").forEach((el) => el.addEventListener("click", () => loadChat(+el.dataset.i)));
  }
  function toggleHistory() {
    const box = panelEl.querySelector("#cl-history");
    if (box.classList.toggle("show")) renderHistory();
  }
  function loadChat(i) {
    const item = history[i];
    if (!item) return;
    archiveCurrent();
    state = { transcript: item.transcript.slice(), task: null };
    saveState();
    renderAll();
    panelEl.querySelector("#cl-history").classList.remove("show");
  }

  // ---------- Rendern ----------
  function makeEl(entry) {
    if (entry.role === "status") {
      const d = document.createElement("div");
      d.className = "cl-status";
      d.textContent = entry.content;
      return d;
    }
    const div = document.createElement("div");
    div.className = `cl-msg ${entry.role}`;
    div.textContent = entry.content;
    return div;
  }
  function renderAll() {
    listEl.innerHTML = "";
    if (!state.transcript.length) {
      listEl.innerHTML = `<div class="cl-empty">Frag mich etwas zu dieser Seite – ich kann auch navigieren und klicken.</div>`;
      return;
    }
    for (const e of state.transcript) listEl.appendChild(makeEl(e));
    listEl.scrollTop = listEl.scrollHeight;
  }
  function addEntry(role, content) {
    const empty = listEl.querySelector(".cl-empty");
    if (empty) empty.remove();
    const e = { role, content };
    state.transcript.push(e);
    listEl.appendChild(makeEl(e));
    listEl.scrollTop = listEl.scrollHeight;
    saveState();
    return e;
  }
  function addTransient(role, text, extraClass = "") {
    const empty = listEl.querySelector(".cl-empty");
    if (empty) empty.remove();
    const div = document.createElement("div");
    div.className = `cl-msg ${role} ${extraClass}`.trim();
    div.textContent = text;
    listEl.appendChild(div);
    listEl.scrollTop = listEl.scrollHeight;
    return div;
  }

  // ---------- State ----------
  function saveState() { return GM.setValue("cl_state", JSON.stringify(state)); }
  async function loadState() {
    try {
      const raw = await GM.getValue("cl_state", "");
      state = raw ? JSON.parse(raw) : { transcript: [], task: null };
    } catch { state = { transcript: [], task: null }; }
    if (!state.transcript) state.transcript = [];
    if (!("task" in state)) state.task = null;
  }

  // ---------- Verbrauchszähler ----------
  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }
  async function loadUsage() {
    try {
      const raw = await GM.getValue("cl_usage", "");
      usage = raw ? JSON.parse(raw) : { date: "", count: 0 };
    } catch { usage = { date: "", count: 0 }; }
    if (usage.date !== todayStr()) usage = { date: todayStr(), count: 0 };
  }
  function updateUsageEl() {
    const el = panelEl && panelEl.querySelector("#cl-usage");
    if (el) el.textContent = `${usage.count} heute`;
  }
  async function bumpUsage() {
    if (usage.date !== todayStr()) usage = { date: todayStr(), count: 0 };
    usage.count++;
    updateUsageEl();
    await GM.setValue("cl_usage", JSON.stringify(usage));
  }

  // ---------- API-Keys (pro Anbieter) ----------
  async function getApiKey(provider) {
    let key = await GM.getValue(keyStore(provider), "");
    if (!key) {
      key = window.prompt(`API-Key für ${providerName(provider)} (von ${keyWhere(provider)}). Wird nur lokal gespeichert.`);
      if (key) await GM.setValue(keyStore(provider), key.trim());
    }
    return key;
  }
  async function changeKey() {
    const p = currentModel().provider;
    const current = await GM.getValue(keyStore(p), "");
    const key = window.prompt(`Neuer ${providerName(p)}-Key (von ${keyWhere(p)}):`, current);
    if (key !== null) {
      await GM.setValue(keyStore(p), key.trim());
      alert(key.trim() ? "Key gespeichert." : "Key gelöscht.");
    }
  }

  // ---------- Seiten-Kontext ----------
  function hostOf(u) { try { return new URL(u).host; } catch { return ""; } }
  function pageContext() {
    const host = location.host;
    const all = Array.from(document.querySelectorAll("a[href]"))
      .map((a) => ({ t: (a.innerText || a.textContent || "").replace(/\s+/g, " ").trim(), h: a.href }))
      .filter((l) => l.t && /^https?:/.test(l.h));
    const ext = all.filter((l) => hostOf(l.h) && hostOf(l.h) !== host);
    const int = all.filter((l) => hostOf(l.h) === host);
    const links = ext.concat(int).slice(0, 15)
      .map((l) => `- ${l.t.slice(0, 60)} → ${l.h}`).join("\n");
    const text = (document.body?.innerText || "").replace(/\n{3,}/g, "\n\n").trim().slice(0, 1500);
    return { url: location.href, title: document.title, links: links || "(keine)", text: text || "(kein Text)" };
  }
  function sameUrl(a, b) {
    const n = (u) => { try { const x = new URL(u); return (x.host + x.pathname + x.search).replace(/\/+$/, "").toLowerCase(); } catch { return String(u).toLowerCase(); } };
    return n(a) === n(b);
  }
  function isSearchPage(u) { return /google\.[^/]+\/search/i.test(u) || (/google\./i.test(u) && /[?&]q=/.test(u)); }

  function systemText() {
    const c = pageContext();
    const goal = lastUserText();
    const visited = (state.task?.visited || []).map((u) => `- ${u}`).join("\n") || "(noch keine)";
    const step = state.task ? state.task.count : 0;
    const actionRules = _force
      ? `Du darfst KEINE Aktion mehr ausführen. Gib JETZT die finale Antwort in Prosa – basierend auf dem, was du unten siehst und weißt.`
      : `Du kannst pro Schritt EINE Steueraktion ausgeben – AUSSCHLIESSLICH eine einzige Zeile, exakt beginnend mit:
@@NAVIGATE: <vollständige https-URL>
@@CLICK: <exakter sichtbarer Linktext/Button aus der Liste unten>
@@TYPE: <Text, der in das Suchfeld der AKTUELLEN Seite getippt und abgeschickt wird>
Oder antworte NORMAL in Prosa = finale Antwort.

REGELN (wichtig):
- Du bist BEREITS auf einer Webseite. Bevorzuge IMMER Aktionen auf der AKTUELLEN Seite: Suchfeld via @@TYPE, Links/Buttons via @@CLICK.
- Wenn der Nutzer „diese Seite", „hier", „Suchleiste/Suchfeld" oder „auf <Seitenname>" sagt: BLEIBE auf der aktuellen Seite und nutze @@TYPE für die seiteneigene Suche – NICHT Google.
- Nutze @@NAVIGATE zu Google NUR, wenn die aktuelle Seite ungeeignet ist oder der Nutzer ausdrücklich eine Websuche will.
- Geht die Antwort schon aus Textauszug/Links unten hervor: ANTWORTE direkt, KEINE Aktion.
- Auf einer Suchergebnis-Seite: NICHT erneut dieselbe Suche; klicke ein Ergebnis oder antworte.
- Wiederhole keine bereits erledigte Aktion (siehe besuchte Seiten unten).
- Bei einer Aktion: NUR die @@-Zeile, KEINEN erklärenden Text davor. Kurze Werte, keine ganzen Sätze.
- Höchstens ${MAX_STEPS} Aktionen. Aktueller Schritt: ${step}/${MAX_STEPS}.`;
    return `Du bist ein Browser-Assistent in einer Seitenleiste und erfüllst EINE Aufgabe, indem du die AKTUELLE Seite liest und dich bei Bedarf bewegst.

AUFGABE DES NUTZERS:
${goal}

${actionRules}

Antworte auf Deutsch.

BEREITS BESUCHTE SEITEN:
${visited}

[AKTUELLE SEITE]
URL: ${c.url}
Titel: ${c.title}
Links:
${c.links}
Textauszug:
${c.text}
[/AKTUELLE SEITE]`;
  }

  function lastUserText() {
    for (let i = state.transcript.length - 1; i >= 0; i--) {
      if (state.transcript[i].role === "user") return state.transcript[i].content;
    }
    return "";
  }

  // ---------- Senden / Agent ----------
  async function onSend() {
    const text = inputEl.value.trim();
    if (!text || busy) return;
    inputEl.value = "";
    autoGrow();
    state.task = null;
    addEntry("user", text);
    await agentStep();
  }

  async function agentStep(forceAnswer = false) {
    if (busy) return;
    busy = true;
    _force = forceAnswer;
    sendBtn.disabled = true;
    const bubble = addTransient("assistant", "…", "thinking");
    let acting = false;

    try {
      const m = currentModel();
      const key = await getApiKey(m.provider);
      if (!key) { bubble.remove(); addEntry("assistant", `Kein ${providerName(m.provider)}-Key eingegeben.`); return; }

      const full = await streamLLM(m, key, (partial) => {
        if (!_force && /@@(NAVIGATE|CLICK|TYPE):/i.test(partial)) {
          if (!acting) { bubble.classList.remove("thinking"); acting = true; }
          bubble.textContent = "↻ Aktion…";
        } else {
          bubble.classList.remove("thinking");
          bubble.textContent = partial;
        }
        listEl.scrollTop = listEl.scrollHeight;
      });

      const trimmed = full.trim();
      // Aktion irgendwo im Text erkennen (Modell stellt oft Prosa voran)
      const nav = !_force && trimmed.match(/@@NAVIGATE:\s*(\S+)/i);
      const typ = !_force && trimmed.match(/@@TYPE:\s*(.+?)\s*$/im);
      const clk = !_force && trimmed.match(/@@CLICK:\s*(.+?)\s*$/im);

      if (nav) { bubble.remove(); await doAction("navigate", nav[1]); return; }
      if (typ) { bubble.remove(); await doAction("type", typ[1].trim()); return; }
      if (clk) { bubble.remove(); await doAction("click", clk[1].trim()); return; }

      const answer = trimmed.replace(/^@@\w+:\s*/i, "").trim() || "(leere Antwort)";
      bubble.classList.remove("thinking");
      bubble.textContent = answer;
      state.transcript.push({ role: "assistant", content: answer });
      if (state.task) state.task.active = false;
      await saveState();
    } catch (e) {
      bubble.classList.remove("thinking");
      bubble.textContent = "Fehler: " + e.message;
    } finally {
      busy = false;
      _force = false;
      sendBtn.disabled = false;
      inputEl.focus();
    }
  }

  async function doAction(type, arg) {
    if (!state.task || !state.task.active) state.task = { active: true, goal: lastUserText(), count: 0, visited: [], clicked: [] };
    if (!state.task.visited) state.task.visited = [];
    if (!state.task.clicked) state.task.clicked = [];
    state.task.count++;
    if (state.task.count > MAX_STEPS) {
      addEntry("status", "Genug Schritte – ich beantworte es jetzt direkt.");
      await saveState();
      busy = false;
      await agentStep(true);
      return;
    }

    if (type === "navigate") {
      const repeat = state.task.visited.some((v) => sameUrl(v, arg));
      const reSearch = isSearchPage(location.href) && isSearchPage(arg);
      if (repeat || reSearch) {
        addEntry("status", "(schon gesucht – ich beantworte direkt)");
        await saveState();
        busy = false;
        await agentStep(true);
        return;
      }
      state.task.visited.push(arg);
      addEntry("status", `→ Öffne ${arg}`);
      await saveState();
      location.href = arg;
      return;
    }

    if (type === "type") {
      const tkey = "type:" + arg.toLowerCase().slice(0, 40);
      if (state.task.clicked.includes(tkey)) {
        addEntry("status", "(schon eingegeben – ich beantworte direkt)");
        await saveState(); busy = false; await agentStep(true); return;
      }
      const input = findSearchInput();
      if (!input) {
        addEntry("status", "Kein Suchfeld gefunden – ich beantworte direkt.");
        await saveState(); busy = false; await agentStep(true); return;
      }
      state.task.clicked.push(tkey);
      addEntry("status", `→ Tippe „${arg}" ins Suchfeld`);
      await saveState();
      await showClick(input);
      doType(input, arg); // tippt + schickt ab (kann Seitenwechsel auslösen)
      setTimeout(() => { busy = false; agentStep(); }, 1300); // ohne Navigation inline weiter
      return;
    }

    if (type === "click") {
      const ckey = arg.toLowerCase().replace(/\s+/g, " ").trim();
      if (state.task.clicked.includes(ckey)) {
        addEntry("status", "(schon geklickt – ich beantworte direkt)");
        await saveState();
        busy = false;
        await agentStep(true);
        return;
      }
      const target = findClickable(arg);
      if (!target) {
        addEntry("status", `„${arg}" nicht gefunden – ich beantworte direkt.`);
        await saveState();
        busy = false;
        await agentStep(true);
        return;
      }
      state.task.clicked.push(ckey);
      addEntry("status", `→ Klicke „${arg}"`);
      if (target.tagName === "A" && target.href) state.task.visited.push(target.href);
      await saveState();
      await showClick(target); // sichtbare Cursor-Bewegung + Markierung
      if (target.tagName === "A" && target.href) {
        location.href = target.href;
      } else {
        target.click();
        setTimeout(() => { busy = false; agentStep(); }, 900);
      }
    }
  }

  // ---------- Visueller Cursor (zeigt, was der Agent tut) ----------
  let cursorEl = null;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  function moveCursor(x, y) {
    if (!cursorEl) { cursorEl = document.createElement("div"); cursorEl.id = "cl-cursor"; document.body.appendChild(cursorEl); }
    cursorEl.classList.add("show");
    cursorEl.style.left = x + "px";
    cursorEl.style.top = y + "px";
  }
  function pulseCursor() {
    if (!cursorEl) return;
    cursorEl.classList.add("click");
    setTimeout(() => cursorEl && cursorEl.classList.remove("click"), 280);
  }
  async function showClick(el) {
    try {
      el.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
      await sleep(380);
      const r = el.getBoundingClientRect();
      moveCursor(r.left + r.width / 2, r.top + r.height / 2);
      el.classList.add("cl-highlight");
      await sleep(650);
      pulseCursor();
      await sleep(260);
      el.classList.remove("cl-highlight");
      if (cursorEl) cursorEl.classList.remove("show");
    } catch { /* egal */ }
  }

  function isVisible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 4 && r.height > 4 && getComputedStyle(el).visibility !== "hidden";
  }
  function findSearchInput() {
    const selectors = [
      'input[type=search]',
      'input[name*=search i]', 'input[id*=search i]', 'input[placeholder*=search i]', 'input[aria-label*=search i]',
      'input[name*=such i]', 'input[id*=such i]', 'input[placeholder*=such i]', 'input[aria-label*=such i]',
      'input[name=q]', 'input[name*=query i]',
      '[role=search] input', 'form[role=search] input',
    ];
    for (const s of selectors) {
      for (const el of document.querySelectorAll(s)) if (isVisible(el)) return el;
    }
    const inputs = Array.from(document.querySelectorAll('input[type=text], input:not([type]), textarea'));
    return inputs.find(isVisible) || null;
  }
  function setNativeValue(el, value) {
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(el, value); else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function doType(el, text) {
    try {
      el.focus();
      setNativeValue(el, text);
      for (const t of ["keydown", "keypress", "keyup"]) {
        el.dispatchEvent(new KeyboardEvent(t, { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
      }
      const form = el.closest("form");
      if (form) { form.requestSubmit ? form.requestSubmit() : form.submit(); }
    } catch { /* egal */ }
  }

  function findClickable(text) {
    const els = Array.from(document.querySelectorAll('a[href], button, [role=button], input[type=submit]'));
    const txt = (el) => (el.innerText || el.textContent || el.value || "").replace(/\s+/g, " ").trim();
    const clean = text.replace(/[“”„]/g, '"');
    const quoted = clean.match(/"([^"]{3,})"/);
    const targets = [];
    if (quoted) targets.push(quoted[1].toLowerCase());
    targets.push(clean.toLowerCase());

    // 1) direkter Teilstring-Treffer
    for (const t of targets) {
      const hit = els.find((el) => txt(el).toLowerCase().includes(t));
      if (hit) return hit;
    }
    // 2) Wort-Überlappung (für lange/ungenaue Klicktexte)
    const words = (quoted ? quoted[1] : clean).toLowerCase().split(/\W+/).filter((w) => w.length > 3);
    if (!words.length) return null;
    let best = null, bestScore = 0;
    for (const el of els) {
      const et = txt(el).toLowerCase();
      if (!et) continue;

      let score = 0;
      for (const w of words) if (et.includes(w)) score++;
      if (score > bestScore) { bestScore = score; best = el; }
    }
    return bestScore >= Math.max(1, Math.ceil(words.length / 2)) ? best : null;
  }

  // ---------- LLM-Aufruf (anbieterabhängig) ----------
  function buildRequest(m, key) {
    const sys = systemText();
    const goal = lastUserText() || "Hilf mir mit dieser Seite.";
    if (m.provider === "groq") {
      return {
        url: GROQ_URL,
        headers: { "content-type": "application/json", "authorization": "Bearer " + key },
        body: JSON.stringify({
          model: m.model, stream: true, max_tokens: 1024,
          messages: [{ role: "system", content: sys }, { role: "user", content: goal }],
        }),
      };
    }
    return {
      url: `${GEMINI_BASE}/${m.model}:streamGenerateContent?alt=sse`,
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: sys }] },
        generationConfig: { maxOutputTokens: 1024 },
        contents: [{ role: "user", parts: [{ text: goal }] }],
      }),
    };
  }

  function extractorFor(provider) {
    if (provider === "groq") return (ev) => ev?.choices?.[0]?.delta?.content || "";
    return (ev) => {
      const parts = ev?.candidates?.[0]?.content?.parts;
      let t = "";
      if (Array.isArray(parts)) for (const p of parts) if (typeof p.text === "string") t += p.text;
      return t;
    };
  }

  async function streamLLM(m, key, onUpdate) {
    await bumpUsage();
    const req = buildRequest(m, key);
    const extract = extractorFor(m.provider);
    try {
      return await fetchStream(req, extract, onUpdate);
    } catch (e) {
      if (e && e.__apiError) throw e;
      return await gmxhrStream(req, extract, onUpdate);
    }
  }

  function apiErr(raw, status) {
    let msg = `HTTP ${status}`;
    try { const b = JSON.parse(raw); const err = Array.isArray(b) ? b[0]?.error : b?.error; if (err?.message) msg = err.message; } catch {}
    const e = new Error(msg); e.__apiError = true; return e;
  }

  async function fetchStream(req, extract, onUpdate) {
    const res = await fetch(req.url, { method: "POST", headers: req.headers, body: req.body });
    if (res.status >= 400) throw apiErr(await res.text().catch(() => ""), res.status);
    if (!res.body || !res.body.getReader) throw new Error("kein Stream");
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "", full = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        const d = line.slice(5).trim();
        if (!d || d === "[DONE]") continue;
        try { const ev = JSON.parse(d); full += extract(ev) || ""; } catch { /* unvollständig */ }
        if (full) onUpdate(full);
      }
    }
    return full || "(leere Antwort)";
  }

  function parseSSE(sse, extract) {
    let text = "", error = null;
    for (const line of String(sse).split("\n")) {
      const l = line.trim();
      if (!l.startsWith("data:")) continue;
      const d = l.slice(5).trim();
      if (!d || d === "[DONE]") continue;
      let ev; try { ev = JSON.parse(d); } catch { continue; }
      text += extract(ev) || "";
      if (ev?.error) error = ev.error.message || "Stream-Fehler";
    }
    return { text, error };
  }

  function gmxhrStream(req, extract, onUpdate) {
    return new Promise((resolve, reject) => {
      let last = "";
      GM.xmlHttpRequest({
        method: "POST",
        url: req.url,
        headers: req.headers,
        data: req.body,
        onprogress: (res) => {
          const { text } = parseSSE(res.responseText || "", extract);
          if (text && text !== last) { last = text; onUpdate(text); }
        },
        onload: (res) => {
          const raw = res.responseText || "";
          if (res.status >= 400) return reject(apiErr(raw, res.status));
          const { text, error } = parseSSE(raw, extract);
          if (error) return reject(new Error(error));
          resolve(text || last || "(leere Antwort)");
        },
        onerror: () => reject(new Error("Netzwerkfehler")),
      });
    });
  }

  // ---------- Start ----------
  async function init() {
    build();
    try { selectedModelId = (await GM.getValue("cl_model", "")) || "groq-llama-70b"; } catch {}
    const sel = panelEl.querySelector("#cl-model");
    if (sel) sel.value = selectedModelId;
    await loadState();
    await loadUsage();
    await loadHistory();
    await loadTheme();
    await loadLayout();
    applyTheme();
    applyLayout();
    updateUsageEl();
    renderAll();
    if (state.task && state.task.active && state.task.count <= MAX_STEPS) {
      if (!state.task.visited) state.task.visited = [];
      if (!state.task.visited.some((v) => sameUrl(v, location.href))) state.task.visited.push(location.href);
      await saveState();
      openPanel();
      setTimeout(() => agentStep(), 700);
    }
  }
  init();
})();
