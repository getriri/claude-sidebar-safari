# Claude Sidebar für Safari

Eine angedockte **Chat-Seitenleiste mit Browser-Agent** für Safari – optisch an „Claude für Chrome" angelehnt, aber **ohne Xcode** und ohne native App. Realisiert als **Userscript** über die kostenlose [Userscripts](https://apps.apple.com/app/userscripts/id1463298887)-App.

Die Sidebar kann den Inhalt der aktuellen Seite **lesen**, Fragen **beantworten**, und als einfacher **Agent** selbstständig **navigieren** und **klicken** – mit sichtbarer Cursor-Animation. Als KI-Backend dienen **kostenlose Modelle** von Groq (Llama) oder Google Gemini, frei umschaltbar.

> ⚠️ **Hinweis zum Namen:** Das Tool sieht aus wie Claude und heißt intern „Claude Sidebar", nutzt aber **nicht** das echte Claude/Anthropic. Es gibt keine offizielle Möglichkeit, ein eigenes Tool mit dem claude.ai-Abo zu verbinden – jedes selbstgebaute Tool braucht einen eigenen API-Key eines Anbieters. Hier sind das Groq und Google Gemini (beide mit kostenlosem Kontingent).

---

## Inhalt
- [Funktionen](#funktionen)
- [Installation](#installation)
- [API-Key holen](#api-key-holen)
- [Benutzung](#benutzung)
- [Modelle](#modelle)
- [Kosten & Limits](#kosten--limits)
- [Wie der Agent funktioniert](#wie-der-agent-funktioniert)
- [Konfiguration](#konfiguration)
- [Grenzen](#grenzen-ehrlich)
- [Fehlerbehebung](#fehlerbehebung)
- [Projektstruktur](#projektstruktur)

---

## Funktionen

| Funktion | Beschreibung |
|---|---|
| 💬 **Chat-Seitenleiste** | Rechts angedockt, volle Höhe, Claude-Optik. Per ✦-Button auf-/zuklappbar. |
| 📄 **Seite lesen** | Bei jeder Frage bekommt das Modell URL, Titel, die wichtigsten Links und einen Textauszug der aktuellen Seite – es rät keine Inhalte. |
| 🤖 **Browser-Agent** | Kann selbst `@@NAVIGATE` (Seite/Suche öffnen) und `@@CLICK` (Link/Button anklicken) ausführen und nach Seitenwechseln automatisch weitermachen. |
| 🖱️ **Cursor-Animation** | Vor einem Klick scrollt die Seite zum Element, ein Cursor-Punkt fährt hin, hebt es hervor und „klickt" – sichtbar wie bei Claude für Chrome. |
| ⚡ **Live-Streaming** | Antworten tippen sich Token für Token ein (mit automatischem Fallback). |
| 🔀 **Modellwechsel** | Dropdown oben: zwischen Groq- und Gemini-Modellen umschalten – nützlich, wenn ein Gratis-Limit erschöpft ist. |
| 📊 **Verbrauchszähler** | „X heute" zeigt die Anzahl der API-Anfragen des Tages (setzt sich täglich zurück). |
| 💾 **Persistenz** | Chatverlauf, gewähltes Modell und API-Keys werden lokal gespeichert (über `GM`-Storage) und überstehen Seitenwechsel. |

---

## Installation

1. **Userscripts-App installieren** (kostenlos, aus dem Mac App Store):
   [Userscripts von Justin Wasack](https://apps.apple.com/app/userscripts/id1463298887)
2. In **Safari → Einstellungen → Erweiterungen** die **Userscripts**-Erweiterung aktivieren.
3. Den Website-Zugriff der Erweiterung auf **„Für alle Websites erlauben"** stellen.
4. Userscripts-Symbol in der Toolbar → **Zahnrad ⚙️** → **Userscripts Directory** auf den Ordner [`userscripts/`](userscripts/) dieses Repos setzen (über den Datei-Dialog – wegen Sandbox-Berechtigung).
5. Das Script [`ask-claude.user.js`](userscripts/ask-claude.user.js) erscheint nun in der Liste. Sicherstellen, dass es **aktiviert** ist.
6. Eine beliebige Webseite mit `Cmd+R` neu laden → unten rechts erscheint der **✦-Button**.

---

## API-Key holen

Beide Anbieter sind kostenlos und **ohne Kreditkarte** nutzbar. Der Key wird beim ersten Senden abgefragt und nur **lokal** gespeichert.

### Groq (Standard, empfohlen)
1. [console.groq.com/keys](https://console.groq.com/keys) → mit Google-Konto einloggen.
2. **Create API Key** → kopieren (beginnt mit `gsk_…`).

### Google Gemini
1. [aistudio.google.com/apikey](https://aistudio.google.com/apikey) → mit Google-Konto einloggen.
2. **Create API key** → am besten **in einem neuen Projekt** → kopieren (beginnt mit `AIza…`).

> Key ändern: jederzeit über den **🔑-Button** in der Sidebar (ändert den Key des aktuell gewählten Anbieters).

---

## Benutzung

- **Normaler Chat / Seite zusammenfassen:** Sidebar öffnen, Frage stellen. Das Modell sieht die aktuelle Seite. (= 1 Anfrage)
- **Text markieren → fragen:** Markierten Text auswählen, dann Sidebar öffnen – die Markierung wird automatisch zitiert.
- **Agenten-Aufgabe:** z. B. „Öffne reutlingen-university.de und finde den Studiengang Human Centered Computing". Der Agent navigiert/klickt selbst (mehrere Anfragen).
- **⟳** = neuer Chat / Agent stoppen · **✕** = schließen · **🔑** = Key ändern.

**Tipp:** Für zuverlässige Ergebnisse direkt auf eine bekannte Seite zielen, statt über Google zu „hüpfen".

---

## Modelle

Im Dropdown oben wählbar:

| Modell | Anbieter | Charakter |
|---|---|---|
| **Llama 3.3 70B** | Groq | **Bester Allrounder** – klug, kostenlos, schnell. Standard & Empfehlung. |
| **Llama 3.1 8B (schnell)** | Groq | Sehr schnell & günstig im Verbrauch, einfacher. Gut für simple Zusammenfassungen. |
| **Gemini 2.5 Flash-Lite** | Google | Großzügiges Gratis-Tageslimit, solide. |
| **Gemini 2.5 Flash** | Google | Etwas klüger als Lite, knapperes Gratis-Limit. |

**Empfehlung „klug + günstig": Groq Llama 3.3 70B.** Reicht das Tageslimit nicht, im Dropdown auf einen anderen Anbieter wechseln.

---

## Kosten & Limits

- Alle hinterlegten Modelle haben ein **kostenloses Kontingent** – für persönliche Nutzung i. d. R. ausreichend.
- Der **Agent verbraucht mehr**: Jeder Navigations-/Klick-Schritt ist eine eigene API-Anfrage. Eine Agenten-Aufgabe = mehrere Anfragen.
- Der **Verbrauchszähler** („X heute") hilft, den Überblick zu behalten.
- **Limit erreicht?** Anbieter im Dropdown wechseln **oder** bis zum nächsten Tag warten (Gemini-Gratis-Tier setzt sich nach Pacific Time zurück, ~9 Uhr MESZ).
- Sparen: oft **⟳** drücken (kürzt den Kontext), einfache Fragen statt Agenten-Aufgaben, `MAX_STEPS` niedrig halten.

---

## Wie der Agent funktioniert

Der Agent nutzt ein einfaches **ReAct-Textprotokoll**: In der Systemanweisung bekommt das Modell die aktuelle Seite plus die Aufgabe und darf pro Schritt **eine** Steuerzeile ausgeben:

```
@@NAVIGATE: <vollständige https-URL>
@@CLICK: <sichtbarer Linktext>
```

…oder es antwortet normal in Prosa (= finale Antwort). Ablauf:

1. Nutzer stellt eine Aufgabe → Modell entscheidet: antworten, navigieren oder klicken.
2. Bei einer Aktion wird der Zustand (`cl_state`) gespeichert und die Seite gewechselt/geklickt.
3. Nach dem Neuladen erkennt das Script die laufende Aufgabe und macht **automatisch** weiter.
4. Schutzmechanismen verhindern Endlosschleifen:
   - **`MAX_STEPS`** (Standard 4) begrenzt die Aktionen pro Aufgabe.
   - Bereits **besuchte URLs** und bereits **geklickte Ziele** werden nicht wiederholt.
   - Statt Abbruch wird am Ende eine **finale Antwort erzwungen**.

Technisch: Streaming primär per nativem `fetch`; bei strenger Seiten-CSP automatischer Fallback auf `GM.xmlHttpRequest`. Anbieterabhängige Anfrage-/Antwortformate (Gemini vs. OpenAI-kompatibles Groq) sind gekapselt.

---

## Konfiguration

Im Kopf von [`userscripts/ask-claude.user.js`](userscripts/ask-claude.user.js):

```js
const MAX_STEPS = 4;            // max. Agenten-Schritte pro Aufgabe
const MODELS = [ … ];           // verfügbare Modelle/Anbieter
let selectedModelId = "groq-llama-70b"; // Standardmodell
```

Weitere Stellschrauben im Code:
- `max_tokens` / `maxOutputTokens` (Antwortlänge, in `buildRequest`)
- Kontextgröße: `.slice(0, 15)` (Links) und `.slice(0, 1500)` (Textauszug) in `pageContext`
- Cursor-Optik: `#cl-cursor` und `.cl-highlight` im CSS
- Akzentfarbe: `const ACCENT`

---

## Grenzen (ehrlich)

Dies ist ein **Userscript mit kostenlosen Modellen**, kein Produkt wie das offizielle agentische „Claude für Chrome". Realistisch zuverlässig:

✅ Seiten lesen, zusammenfassen, übersetzen, Fragen beantworten
✅ Suchen, Seiten öffnen, einfache Links anklicken

Schwierig / unzuverlässig:

⚠️ Komplexe Shop-Interaktionen (Warenkorb, Größe wählen, Checkout, Login)
⚠️ JavaScript-Buttons, Cookie-Banner, Seiten mit sehr strenger Sicherheitsrichtlinie
⚠️ Mehrschritt-Aufgaben über viele Seiten hinweg

Die Cursor-Animation ist eine **visuelle Nachbildung** – sie zeigt, *wohin* geklickt wird; der Klick erfolgt per Code.

---

## Fehlerbehebung

| Problem | Ursache / Lösung |
|---|---|
| Script erscheint nicht | Userscripts Directory auf `userscripts/` setzen, dann 🔄 Refresh. |
| ✦-Button fehlt | Erweiterung muss Zugriff auf „alle Websites" haben; Seite neu laden. |
| `limit: 0` (Gemini) | Key in einem **neuen** Projekt erstellen; ggf. auf `gemini-2.5-flash-lite` wechseln. |
| „quota exceeded" | Tageslimit erreicht → Modell wechseln oder warten. |
| Kein Live-Streaming | Seite blockt `fetch` (CSP) → Fallback liefert die Antwort komplett am Ende. Bei Groq je nach CORS möglich. |
| Agent tut nichts | Auf älteren Versionen wurden Aktionen mit Prosa davor nicht erkannt – aktuelle Version nutzen (≥ 0.9.1). |

---

## Projektstruktur

```
.
├── README.md
├── .gitignore
└── userscripts/
    └── ask-claude.user.js   # das gesamte Userscript (UI, Agent, LLM-Anbindung)
```

Das Script ist **eigenständig** (Vanilla JS, keine Build-Schritte, keine Abhängigkeiten). Alles – UI, Styles, Agent-Logik, API-Aufrufe – steckt in dieser einen Datei.

---

## Lizenz

Privates Projekt. Nutzung auf eigene Verantwortung; die jeweiligen API-Nutzungsbedingungen von Groq und Google gelten.
