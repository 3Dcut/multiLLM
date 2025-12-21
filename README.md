# LLM MultiChat

Eine Electron-App zum parallelen Abfragen mehrerer LLM-Dienste.

## Features

- **Dynamische Konfiguration:** Services über `config/config.json` hinzufügen/entfernen
- **Flexible Layouts:** Raster, Horizontal oder Vertikal
- **Persistente Einstellungen:** Aktive Services und Layout werden gespeichert
- **Toggle-Switches:** Services ein-/ausschalten ohne Neustart
- **Persistente Sessions:** Login bleibt erhalten
- **Voting-System:** Automatische Ja/Nein-Abstimmung über mehrere KI-Antworten
- **Vergleichsfunktionen:** KIs können ihre Antworten gegenseitig vergleichen
- **Internationalisierung:** Deutsch, English, Nederlands

## Installation

```bash
cd app
npm install
```

## Starten

- **Mit GUI:** Doppelklick auf `Start.vbs` (ohne CMD-Fenster)
- **Mit CMD:** `cd app && npm start`
- **Debug-Modus:** `scripts/debug-console.bat` oder `cd app && npm start -- --dev`

## Projektstruktur

```
/
├── README.md
├── security-report.pdf
├── Start.vbs
├── app/
│   ├── package.json
│   └── package-lock.json
├── config/
│   ├── config.json.template
│   ├── config.json (wird automatisch erstellt)
│   ├── user-settings.json.template
│   └── user-settings.json (wird automatisch erstellt)
├── src/
│   ├── main/
│   │   └── main.js
│   ├── preload/
│   │   └── preload.js
│   ├── renderer/
│   │   ├── renderer.js
│   │   └── utils/
│   │       ├── i18n.js
│   │       └── vote-patterns.js
│   └── ui/
│       ├── index.html
│       └── styles.css
├── assets/
│   ├── disclaimer.hta
│   ├── status.hta
│   └── Uninstall.hta
└── scripts/
    └── debug-console.bat
```

## Konfiguration

### config/config.json

Enthält alle verfügbaren Services mit Selektoren:

```json
{
  "services": [
    {
      "id": "mein-service",
      "name": "Mein Service",
      "url": "https://example.com/chat",
      "color": "#ff0000",
      "inputSelectors": [
        "textarea#chat-input",
        "[contenteditable=\"true\"]"
      ],
      "submitSelectors": [
        "button[type=\"submit\"]",
        "button.send-btn"
      ],
      "responseSelectors": [
        ".response-container",
        "[data-response]"
      ],
      "editorType": "default"
    }
  ]
}
```

**editorType-Optionen:**
- `default` - Standard (Textarea, generisches contenteditable)
- `quill` - Quill Editor (Gemini)
- `prosemirror` - ProseMirror (Claude, Mistral)
- `lexical` - Lexical Editor (Perplexity)

### config/user-settings.json

Benutzereinstellungen (wird automatisch gespeichert):

```json
{
  "activeServices": ["copilot", "claude", "gemini"],
  "layout": "grid",
  "language": "de"
}
```

**Layout-Optionen:**
- `grid` - Automatisches Raster
- `horizontal` - Nebeneinander
- `vertical` - Untereinander

**Sprachen:**
- `de` - Deutsch
- `en` - English
- `nl` - Nederlands

## Neuen Service hinzufügen

1. Service in `config/config.json` unter `services` ergänzen
2. App neu starten
3. Service in der Statusleiste aktivieren

### Selektoren finden

1. App mit `scripts/debug-console.bat` starten (oder `cd app && npm start -- --dev`)
2. In der Console: `debugSelectors("service-id")`
3. Passende Selektoren in `config/config.json` eintragen

## Features im Detail

### Voting-System

Automatische Auswertung von Ja/Nein-Antworten über mehrere KI-Services:
- Verschiedene Strategien (Pattern, First, Count, Weighted)
- Visuelle Hervorhebung mit Overlays
- Mehrheits-Ergebnis-Anzeige

### Vergleichsfunktionen

- **Kreuzvergleich:** Andere Antworten in einem Service vergleichen lassen
- **Alle vergleichen:** Jeder Service vergleicht alle anderen Antworten
- Antworten können in Zwischenablage kopiert werden

### Session-History

- Navigation zwischen vorherigen Sessions (◀/▶ Buttons)
- Automatisches Speichern von Session-URLs
- Max. 50 gespeicherte Sessions

### Prompt-History

- Navigation mit Pfeiltasten (↑/↓)
- Automatisches Speichern der letzten Prompts
- Max. 100 gespeicherte Prompts

## Troubleshooting

### Selektoren funktionieren nicht
Die Chat-UIs ändern sich gelegentlich. Nutze `debugSelectors()` um aktuelle Selektoren zu finden.

### "Trusted Types" Fehler
Einige Services (z.B. Gemini) blockieren innerHTML. Der `editorType: "quill"` umgeht das.

### Login-Probleme
Sessions sind pro Service isoliert. Reload-Button (↻) oder App neu starten.

### Config-Dateien nicht gefunden
Stelle sicher, dass die Template-Dateien in `config/` vorhanden sind. Beim ersten Start werden die eigentlichen Config-Dateien automatisch erstellt.

## Entwickler-Hinweise

### Debug-Funktionen

Im Debug-Modus verfügbar:
- `debugSelectors(serviceId)` - Zeigt verfügbare Input-Elemente
- `window.webviews` - Zugriff auf alle WebView-Instanzen
- `window.config` - Zugriff auf Konfiguration
- `window.userSettings` - Zugriff auf Einstellungen

### Code-Struktur

- **src/main/main.js** - Electron Main-Process (Window-Management, IPC, File-IO)
- **src/renderer/renderer.js** - Renderer-Process (UI-Logik, WebView-Management)
- **src/preload/preload.js** - Context-Bridge für sichere IPC-Kommunikation
- **src/renderer/utils/** - Utility-Module (i18n, vote-patterns)

## Lizenz

MIT - Für den privaten Gebrauch.
