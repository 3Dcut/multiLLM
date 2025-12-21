# LLM MultiChat - Projekt-Überblick

## Projektbeschreibung

**LLM MultiChat** ist eine Electron-basierte Desktop-Anwendung, die es ermöglicht, mehrere LLM-Dienste (Large Language Models) parallel abzufragen und deren Antworten zu vergleichen.

## Technologie-Stack

- **Framework**: Electron (v33.0.0)
- **Sprache**: JavaScript/Node.js
- **Architektur**: 
  - Main-Process (`main.js`)
  - Renderer-Process (`renderer.js`)
  - Preload-Script (`preload.js`)
  - WebViews für jeden LLM-Service

## Hauptfunktionen

### 1. Multi-LLM-Unterstützung
- **Unterstützte Services**:
  - Microsoft Copilot
  - Claude (Anthropic)
  - Google Gemini
  - ChatGPT (OpenAI)
  - Perplexity
  - Mistral Le Chat

### 2. Service-Management
- Dynamische Konfiguration über `config.json`
- Service-Toggle (ein-/ausschalten)
- Persistente Sessions pro Service (isolierte Cookies/Storage)
- Mute-Funktion (Service für nächste Nachricht überspringen)
- Focus-Modus (nur ein Service sichtbar)

### 3. Layout-Optionen
- **Grid**: Automatisches Raster (flexibel)
- **Horizontal**: Alle Services nebeneinander
- **Vertical**: Alle Services untereinander
- Layout-Präferenz wird in `user-settings.json` gespeichert

### 4. Eingabe-Funktionen
- **Text-Prompts**: Parallele Versendung an alle aktiven Services
- **Bild-Upload**: Unterstützung für Bilder aus Zwischenablage (Strg+Shift+V)
- **Editor-Typen**: 
  - `default`: Standard (Textarea, contenteditable)
  - `quill`: Quill Editor (Gemini)
  - `prosemirror`: ProseMirror (Claude, Mistral)
  - `lexical`: Lexical Editor (Perplexity)

### 5. Response-Management
- Antworten auslesen via CSS-Selektoren (`responseSelectors`)
- Kopieren von Antworten in Zwischenablage
- Kreuzvergleich (andere Antworten in einem Service vergleichen lassen)
- Alle-Antworten-Vergleich (jeder Service vergleicht alle anderen)

### 6. Voting-System
- **Ja/Nein-Abstimmung**: Automatische Auswertung von Antworten
- **Vote-Strategien**:
  - `pattern`: Feste Muster (Kurzantwort: Ja, etc.)
  - `first`: Erstes Ja/Nein gewinnt
  - `count`: Zählen - Mehrheit gewinnt
  - `weighted`: Gewichtet nach Position (Standard)
- **Vote-Patterns**: Erweiterte Regex-Patterns in `vote-patterns.js`
- **Overlay-System**: Visuelle Hervorhebung der Vote-Ergebnisse

### 7. Session-History
- Navigation zwischen vorherigen Sessions (◀/▶ Buttons)
- Automatisches Speichern von Session-URLs
- Max. 50 gespeicherte Sessions
- Session-Navigation in `session-history.json`

### 8. Prompt-History
- Navigation mit Pfeiltasten (↑/↓)
- Automatisches Speichern der letzten Prompts
- Max. 100 gespeicherte Prompts
- Speicherung in `prompt-history.json`

### 9. Internationalisierung (i18n)
- **Unterstützte Sprachen**:
  - Deutsch (de) 🇩🇪
  - English (en) 🇬🇧
  - Nederlands (nl) 🇳🇱
- Accept-Language Header wird für WebViews gesetzt
- Sprache-Wechsel via Button in Toolbar

### 10. WebView-Management
- Isolierte Partitions pro Service (`persist:serviceId`)
- Header-Manipulation (X-Frame-Options, CSP entfernen)
- User-Agent-Spoofing (Chrome 131.0.0.0)
- Custom Accept-Language Header

## Dateistruktur (REFACTORIERT)

### Root-Level
- `README.md`: Dokumentation
- `security-report.pdf`: Sicherheitsbericht
- `Start.vbs`: Start-Script ohne CMD-Fenster
- `package.json`: NPM-Konfiguration

### config/
- `config.json.template`: Template für Service-Konfiguration
- `config.json`: Aktuelle Service-Konfiguration (wird automatisch erstellt)
- `user-settings.json.template`: Template für Benutzer-Einstellungen
- `user-settings.json`: Aktuelle Benutzer-Einstellungen (wird automatisch erstellt)

### src/main/
- `main.js`: Electron Main-Process (Window-Management, IPC, File-IO)

### src/preload/
- `preload.js`: Context-Bridge für sichere IPC-Kommunikation

### src/renderer/
- `renderer.js`: Renderer-Process (UI-Logik, WebView-Management, Voting)

### src/renderer/utils/
- `i18n.js`: Internationalisierung (Übersetzungen, Sprachverwaltung)
- `vote-patterns.js`: Vote-Erkennungs-Patterns (Regex, Strategien)

### src/ui/
- `index.html`: Haupt-HTML-Struktur
- `styles.css`: Styling

### assets/
- `disclaimer.hta`: Disclaimer-Dialog
- `status.hta`: Status-Dialog
- `Uninstall.hta`: Deinstallations-Dialog

### scripts/
- `debug-console.bat`: Debug-Modus

## Konfiguration

### config.json
Enthält alle Service-Definitionen mit:
- `id`: Eindeutige Service-ID
- `name`: Anzeigename
- `url`: Start-URL des Services
- `color`: Farbe für UI-Hervorhebung
- `inputSelectors`: CSS-Selektoren für Eingabefeld
- `submitSelectors`: CSS-Selektoren für Submit-Button
- `responseSelectors`: CSS-Selektoren für Antworten
- `editorType`: Editor-Typ (default/quill/prosemirror/lexical)

### user-settings.json
Benutzer-Präferenzen:
- `activeServices`: Array der aktiven Service-IDs
- `layout`: Layout-Präferenz (grid/horizontal/vertical)
- `language`: UI-Sprache (de/en/nl)

## Technische Besonderheiten

### Injection-Scripts
- JavaScript-Injection in WebViews für:
  - Text-Eingabe in verschiedene Editor-Typen
  - Submit-Button-Klicks
  - Bild-Upload (verschiedene Methoden pro Service)
- Service-spezifische Anpassungen erforderlich

### Bild-Upload-Methoden
1. **File-Input** (ChatGPT, Claude): Versteckten File-Input nutzen
2. **Paste-Event** (Copilot, Gemini, Perplexity): Clipboard-Event dispatchen
3. **Native Paste** (Mistral): webview.paste() verwenden
4. **Drop-Event** (Fallback): Drag-Drop-Event simulieren

### Vote-Erkennung
- Mehrschichtige Strategie:
  1. Meta-Aussagen erkennen (Rankings, Vergleiche) → "unklar"
  2. Rückfragen erkennen → "unklar"
  3. Strategie-spezifische Erkennung:
     - Pattern-basiert
     - Erstes Wort
     - Zählen
     - Gewichtet (Position im Text)

### Session-Management
- Jeder Service hat isolierte Partition → persistente Cookies/Storage
- Session-URLs werden gespeichert für Navigation
- Automatisches Speichern bei Änderungen

## Entwickler-Hilfen

### Debug-Funktionen
- `debugSelectors(serviceId)`: Zeigt verfügbare Input-Elemente
- `window.webviews`: Zugriff auf alle WebView-Instanzen
- `window.config`: Zugriff auf Konfiguration
- `window.userSettings`: Zugriff auf Einstellungen

### Globale Funktionen (exposed)
- `getLastResponse(serviceId)`: Antwort eines Services lesen
- `getAllResponses()`: Alle Antworten sammeln
- `copyResponse(serviceId)`: Antwort kopieren
- `crossCompare(serviceId)`: Kreuzvergleich
- `compareAll()`: Alle vergleichen
- `evaluateYesNo()`: Voting auswerten
- `toggleFocus(serviceId)`: Focus-Modus
- `exitFocus()`: Focus beenden

## Bekannte Probleme / Edge Cases

1. **Trusted Types**: Einige Services blockieren innerHTML → Editor-Typ "quill" nutzen
2. **Selektor-Änderungen**: Chat-UIs ändern sich → `debugSelectors()` nutzen
3. **Bild-Upload**: Verschiedene Methoden je Service (spezifische Implementierung)
4. **ProseMirror Focus**: Mistral benötigt native Paste-Methode

## Erweiterungsmöglichkeiten

### Neue Services hinzufügen
1. Service-Definition in `config.json` ergänzen
2. Passende Selektoren finden (`debugSelectors()`)
3. Editor-Typ bestimmen
4. App neu starten

### Neue Editor-Typen
- In `createInjectionScript()` erweitern
- Service-spezifische Logik implementieren

### Neue Sprachen
- Übersetzungen in `i18n.js` hinzufügen
- Accept-Language Header in `main.js` erweitern

## Sicherheits-Hinweise

- CSP ist sehr permissiv (`unsafe-inline`, `unsafe-eval`) → notwendig für WebView-Injection
- X-Frame-Options werden entfernt → ermöglicht WebView-Einbettung
- Isolierte Partitions pro Service → verhindert Cookie-Leaks

## Performance-Überlegungen

- Parallele Requests an alle Services
- WebView-Loading kann langsam sein (abhängig von Service)
- Session-History begrenzt auf 50 Einträge
- Prompt-History begrenzt auf 100 Einträge

## UI/UX-Features

- Dunkles Theme (dunkler Hintergrund, helle Schrift)
- Farbcodierung pro Service
- Visuelles Feedback bei Aktionen
- Keyboard-Shortcuts (Strg+Enter, Strg+Shift+V, Pfeiltasten)
- Tooltips für alle Buttons
- Hover-Effekte für Vote-Overlays

## Notizen für Agenten

### Häufige Aufgaben
- **Service hinzufügen**: Config erweitern, Selektoren testen
- **Selektoren aktualisieren**: `debugSelectors()` nutzen, neue Selektoren eintragen
- **Bild-Upload fixen**: Service-spezifische Methode implementieren
- **Vote-Patterns anpassen**: `vote-patterns.js` erweitern

### Code-Struktur
- `renderer.js`: Sehr groß (~1800 Zeilen) → könnte modularisiert werden
- Injection-Scripts: Inline generiert → schwer zu debuggen
- Global State: Mehrere globale Variablen → könnte State-Management nutzen

### Verbesserungspotenzial
- TypeScript für bessere Typsicherheit
- Modularisierung der großen Dateien
- Unit-Tests für Vote-Erkennung
- Error-Handling verbessern
- Loading-States verbessern

