# LLM MultiChat

Eine Electron-App zum parallelen Abfragen mehrerer LLM-Dienste.

## Features

- **Dynamische Konfiguration:** Services über `config.json` hinzufügen/entfernen
- **Flexible Layouts:** Raster, Horizontal oder Vertikal
- **Persistente Einstellungen:** Aktive Services und Layout werden gespeichert
- **Toggle-Switches:** Services ein-/ausschalten ohne Neustart
- **Persistente Sessions:** Login bleibt erhalten

## Installation

```bash
npm install
```

## Starten

- **Mit GUI:** Doppelklick auf `Start.vbs` (ohne CMD-Fenster)
- **Mit CMD:** `npm start` oder Doppelklick auf `Start.bat`
- **Debug-Modus:** `Start-Debug.bat` oder `npm start -- --dev`

## Konfiguration

### config.json

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
      "editorType": "default"
    }
  ]
}
```

**editorType-Optionen:**
- `default` - Standard (Textarea, generisches contenteditable)
- `quill` - Quill Editor (Gemini)
- `prosemirror` - ProseMirror (Claude)

### user-settings.json

Benutzereinstellungen (wird automatisch gespeichert):

```json
{
  "activeServices": ["copilot", "claude", "gemini"],
  "layout": "grid"
}
```

**Layout-Optionen:**
- `grid` - Automatisches Raster
- `horizontal` - Nebeneinander
- `vertical` - Untereinander

## Neuen Service hinzufügen

1. Service in `config.json` unter `services` ergänzen
2. App neu starten
3. Service in der Statusleiste aktivieren

### Selektoren finden

1. App mit `Start-Debug.bat` starten
2. In der Console: `debugSelectors("service-id")`
3. Passende Selektoren in `config.json` eintragen

## Troubleshooting

### Selektoren funktionieren nicht
Die Chat-UIs ändern sich gelegentlich. Nutze `debugSelectors()` um aktuelle Selektoren zu finden.

### "Trusted Types" Fehler
Einige Services (z.B. Gemini) blockieren innerHTML. Der `editorType: "quill"` umgeht das.

### Login-Probleme
Sessions sind pro Service isoliert. Reload-Button (↻) oder App neu starten.

## Lizenz

MIT - Für den privaten Gebrauch.
