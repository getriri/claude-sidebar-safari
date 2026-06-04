# TODO / Notizen

Ideen, offene Punkte und bekannte Grenzen für das Claude-Sidebar-Userscript.

## Offene Aufgaben
- [ ] **Filter setzen** zuverlässiger machen (Dropdowns/JS-Menüs ohne festen Linktext, z. B. Größe/Farbe auf Shop-Seiten)
- [ ] **Markdown-Formatierung** der Antworten (Fett, Listen, Code-Blöcke, klickbare Links statt rohem Text)
- [ ] **Mehrstufige Agenten-Aufgaben** stabiler (mehr als 4 Schritte ohne Abdriften/Schleifen)
- [ ] `MAX_STEPS` per UI einstellbar machen (statt nur im Code)
- [ ] **Verlauf**: einzelne Chats löschen / umbenennen / durchsuchen
- [ ] **Screenshots / GIF** der Sidebar in die README aufnehmen
- [ ] **LICENSE**-Datei ergänzen (z. B. MIT)
- [ ] Cursor-Animation auch bei `@@TYPE`/`@@NAVIGATE` sinnvoll andeuten
- [ ] Touch-Support für den Resize-Griff (aktuell nur Maus)
- [ ] „Stopp"-Button während eines laufenden Agenten-Laufs deutlicher machen

## Ideen / Nice-to-have
- [ ] Schnell-Aktionen (Buttons: „Seite zusammenfassen", „Übersetzen", „Erklären")
- [ ] Pro-Modell-Verbrauch getrennt zählen (Groq vs. Gemini)
- [ ] Warnung/rote Anzeige, wenn Tageslimit fast erreicht
- [ ] Weitere kostenlose Anbieter/Modelle ins Dropdown (z. B. weitere Groq-Modelle)
- [ ] Akzentfarbe / Blur-Stärke über ein kleines Einstellungsmenü anpassbar
- [ ] Optionales automatisches Mitschicken von markiertem Text als Kontext

## Bekannte Grenzen (kein Bug)
- Komplexe Shop-Interaktionen (Warenkorb, Größe wählen, Checkout, Login) sind unzuverlässig.
- Google als Navigationsziel ist der schwierigste Fall (Cookie-Banner, wechselnde Struktur).
- Live-Streaming kann auf Seiten mit strenger CSP ausfallen → Antwort kommt dann komplett am Ende.
- Kein echter Claude/Anthropic-Zugang möglich – nur eigene Provider-Keys (Groq/Gemini).

## Erledigt
- [x] Sidebar mit Chat, Seite lesen, Agent (navigate/click), Streaming
- [x] Modellwechsel (Groq / Gemini) mit eigenem Key pro Anbieter
- [x] Verbrauchszähler („X heute")
- [x] Dark Mode + Liquid-Glass-Look
- [x] Chat-Verlauf
- [x] Breite ziehbar + links/rechts andockbar
- [x] `@@TYPE`-Aktion (in seiteneigenes Suchfeld tippen)
- [x] Anti-Schleifen-Schutz (besuchte URLs / geklickte Ziele / getippte Eingaben)
