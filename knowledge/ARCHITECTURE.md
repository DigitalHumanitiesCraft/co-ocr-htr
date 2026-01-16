# Technische Architektur

Systemdesign für coOCR/HTR. Client-only, kein Backend.

**Abhängigkeit:** [METHODOLOGY](METHODOLOGY.md) (Begründung für Technologieentscheidungen)

## Systemübersicht

```
┌─────────────────────────────────────────────────────────────┐
│                         BROWSER                             │
├─────────────────────────────────────────────────────────────┤
│  UI LAYER                                                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ Header   │ │ Document │ │ Editor   │ │Validation│       │
│  │          │ │ Viewer   │ │          │ │ Panel    │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
├─────────────────────────────────────────────────────────────┤
│  APPLICATION LAYER                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │   App    │ │ Document │ │Validation│ │  Export  │       │
│  │Controller│ │ Manager  │ │  Engine  │ │  Service │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
├─────────────────────────────────────────────────────────────┤
│  SERVICE LAYER                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │  LLM API │ │ Storage  │ │  Image   │ │  Event   │       │
│  │          │ │          │ │ Processor│ │   Bus    │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
├─────────────────────────────────────────────────────────────┤
│  PERSISTENCE                                                │
│  ┌────────────────┐ ┌────────────────────────────┐         │
│  │  LocalStorage  │ │       IndexedDB            │         │
│  │  (Settings,    │ │  (Dokumente, Sessions)     │         │
│  │   API Keys)    │ │                            │         │
│  └────────────────┘ └────────────────────────────┘         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ HTTPS
┌─────────────────────────────────────────────────────────────┐
│  EXTERNE APIs                                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │  Gemini  │ │  OpenAI  │ │ Anthropic│ │  Ollama  │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
└─────────────────────────────────────────────────────────────┘
```

## Dateistruktur

### Aktuelle Implementierung (Prototyp v2)

```
newer prototpye/
├── index.html              # Entry Point (322 LOC)
├── css/
│   ├── variables.css       # Design System Tokens (52 LOC)
│   └── styles.css          # Komponenten-Styles (~400 LOC)
├── js/
│   ├── main.js             # Initialisierung (15 LOC)
│   ├── state.js            # Zentraler State mit EventTarget (61 LOC)
│   ├── viewer.js           # Document Viewer Logik (67 LOC)
│   ├── editor.js           # Transcription Editor (77 LOC)
│   └── ui.js               # UI Interaktionen (40 LOC)
├── assets/
│   └── mock-document.jpg   # Test-Dokument
└── docs/                   # Projektdokumentation
```

### Zielstruktur (Vollständig)

```
src/
├── index.html              # Entry Point
├── css/
│   ├── variables.css       # Design System Tokens
│   └── styles.css          # Komponenten-Styles
├── js/
│   ├── main.js             # Initialisierung, Koordination
│   ├── state.js            # Zentraler Zustand (EventTarget)
│   ├── components/
│   │   ├── viewer.js       # Document Viewer
│   │   ├── editor.js       # Transcription Editor
│   │   ├── validation.js   # Validation Panel
│   │   └── dialogs.js      # Modal Dialoge
│   ├── services/
│   │   ├── llm.js          # Provider-Abstraktion
│   │   ├── storage.js      # LocalStorage/IndexedDB
│   │   └── export.js       # Markdown/JSON/TSV Export
│   └── utils/
│       ├── validators.js   # Regex-Regeln
│       └── parsers.js      # Markdown/Table Parsing
└── assets/
    └── icons/              # SVG Icons (inline im HTML)
```

## Kernmodule

### AppState (Implementiert)

Zentraler State mit nativer EventTarget-API. Ersetzt den ursprünglichen EventBus durch den Browser-Standard.

```javascript
// state.js - Tatsächliche Implementierung
class AppState extends EventTarget {
  constructor() {
    super();
    this.data = {
      image: { url: string, width: number, height: number },
      regions: [{ line: number, x: number, y: number, w: number, h: number }],
      transcription: string[],  // Markdown-Tabellenzeilen
      zoom: number,
      selectedLine: number | null
    };
  }

  getState() { return this.data; }

  setImage(url) {
    this.data.image.url = url;
    this.dispatchEvent(new CustomEvent('imageChanged', { detail: { url } }));
  }

  setSelection(lineNum) {
    this.data.selectedLine = lineNum;
    this.dispatchEvent(new CustomEvent('selectionChanged', { detail: { line: lineNum } }));
  }

  setZoom(level) {
    this.data.zoom = level;
    this.dispatchEvent(new CustomEvent('zoomChanged', { detail: { zoom: level } }));
  }
}

export const appState = new AppState();
```

**Vorteile gegenüber Custom EventBus:**
- Native Browser-API (keine Abhängigkeiten)
- DevTools-Integration (Event-Debugging)
- Memory-Management durch Browser

### Event-Typen (Implementiert)

| Event | Payload | Auslöser |
|-------|---------|----------|
| `imageChanged` | `{ url }` | Bild geladen |
| `selectionChanged` | `{ line }` | Zeile ausgewählt |
| `zoomChanged` | `{ zoom }` | Zoom geändert |

### LLMService (Geplant)

Abstraktion für verschiedene Provider.

```javascript
class LLMService {
  setProvider(provider: 'gemini' | 'openai' | 'anthropic' | 'ollama');
  setApiKey(key: string);
  async transcribe(image: Blob, options): Promise<TranscriptionResult>;
  async validate(text: string, perspective: Perspective): Promise<ValidationResult>;
}
```

| Provider | Endpoint | Modell | Vision |
|----------|----------|--------|--------|
| Gemini | `generativelanguage.googleapis.com` | gemini-2.0-flash | ✅ |
| OpenAI | `api.openai.com` | gpt-4o | ✅ |
| Anthropic | `api.anthropic.com` | claude-3-5-sonnet | ✅ |
| Ollama | `localhost:11434` | llava | ✅ |

### Event-Listener Registrierung (Implementiert)

```javascript
// In viewer.js
appState.addEventListener('selectionChanged', (e) => {
  document.querySelectorAll('.region-box.selected').forEach(el => el.classList.remove('selected'));
  const regionEl = document.querySelector(`.region-box[data-line="${e.detail.line}"]`);
  if (regionEl) regionEl.classList.add('selected');
});

appState.addEventListener('zoomChanged', (e) => {
  img.style.transform = `scale(${e.detail.zoom / 100})`;
  zoomLabel.textContent = `${e.detail.zoom}%`;
});

// In editor.js
appState.addEventListener('selectionChanged', (e) => {
  document.querySelectorAll('.editor-grid-row.active').forEach(el => el.classList.remove('active'));
  const lineEl = document.querySelector(`.editor-grid-row[data-line="${e.detail.line}"]`);
  if (lineEl) {
    lineEl.classList.add('active');
    lineEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
});

// In ui.js
appState.addEventListener('selectionChanged', (e) => {
  const valCard = document.querySelector(`.validation-card[data-line="${e.detail.line}"]`);
  if (valCard) {
    valCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    // Flash effect
  }
});
```

### StorageService

| Speicher | Typ | Inhalt | Limit |
|----------|-----|--------|-------|
| LocalStorage | Synchron | Settings, API Keys | 5MB |
| IndexedDB | Asynchron | Dokumente, Sessions, History | Unbegrenzt |

## Datenflüsse

### Upload → Transkription

```
Image Upload → Base64 Encode → LLM Request → Parse Response
                                                    │
                                                    ▼
    Export ← Corrections ← Expert Review ← Validation
```

### Text-Bild-Synchronisation (Dreifach-Verknüpfung)

Alle drei Hauptpanels sind bidirektional verknüpft:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   DOCUMENT VIEWER ◄──────────────► TRANSCRIPTION            │
│         │                               │                   │
│         │                               │                   │
│         ▼                               ▼                   │
│   ┌─────────────────────────────────────────────┐          │
│   │            VALIDATION PANEL                  │          │
│   └─────────────────────────────────────────────┘          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Synchronisation Flow

```
User klickt Transcription-Zeile #4
       ↓
   TranscriptionTable.onClick(lineNumber: 4)
       ↓
   EventBus.emit('transcription:lineSelected', { line: 4, bounds: {...} })
       ↓
   ┌───────────────────┬────────────────────────┐
   ↓                   ↓                        ↓
DocumentViewer    ValidationPanel           State
.highlightBox(4)  .scrollToRelated(4)      .setSelectedLine(4)
.scrollToRegion() .expandCard(4)
```

### Umgekehrter Flow (Viewer → Transcription)

```
User klickt Bounding Box im Viewer
       ↓
   DocumentViewer.onBoxClick(boxId)
       ↓
   EventBus.emit('viewer:regionSelected', { boxId, lineNumber: 4 })
       ↓
   ┌───────────────────┬────────────────────────┐
   ↓                   ↓                        ↓
Transcription     ValidationPanel           State
.scrollToLine(4)  .scrollToRelated(4)      .setSelectedLine(4)
.highlightRow(4)
```

### Validation → All Panels

```
User klickt "Line 4" in Validation Card
       ↓
   ValidationPanel.onLineRefClick(4)
       ↓
   EventBus.emit('validation:lineJump', { line: 4 })
       ↓
   ┌───────────────────┬────────────────────────┐
   ↓                   ↓                        ↓
DocumentViewer    Transcription             State
.highlightBox(4)  .scrollToLine(4)         .setSelectedLine(4)
.scrollToRegion() .highlightRow(4)
```

## API-Aufrufe

### Gemini

```javascript
fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: 'image/jpeg', data: base64 } }
      ]
    }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 8192 }
  })
});
```

### OpenAI

```javascript
fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`
  },
  body: JSON.stringify({
    model: 'gpt-4o',
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } }
      ]
    }],
    max_tokens: 4096,
    temperature: 0.1
  })
});
```

## Fehlerbehandlung

| Fehlertyp | Ursache | Handling |
|-----------|---------|----------|
| NetworkError | Keine Verbindung | Retry mit Backoff |
| AuthError | Ungültiger API Key | Dialog zur Key-Eingabe |
| RateLimitError | Zu viele Requests | Warten, Countdown |
| QuotaError | Kontingent erschöpft | Alternative Provider |
| StorageError | LocalStorage voll | Alte Sessions löschen |

```javascript
async function withRetry(fn, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (error.retryAfter) await sleep(error.retryAfter * 1000);
      else await sleep(1000 * Math.pow(2, attempt));
    }
  }
}
```

## Sicherheit

### API-Key-Handling

Keys werden im LocalStorage gespeichert (Base64-Obfuskation, keine echte Verschlüsselung).

**Warnung im UI:** "Verwenden Sie dieses Tool nicht auf öffentlichen Computern."

### Content Security Policy

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self';
  connect-src 'self'
    https://generativelanguage.googleapis.com
    https://api.openai.com
    https://api.anthropic.com
    http://localhost:11434;
">
```

## Technologieentscheidungen

| Entscheidung | Begründung |
|--------------|------------|
| Kein Framework | Reduziert Komplexität, verbessert Langlebigkeit |
| LocalStorage | Kein Backend nötig, sofortige Persistenz |
| Fetch API | Nativ, ausreichend für REST |
| ES6 Modules | Native Browser-Unterstützung, kein Bundler |
| CSS Custom Properties | Theming ohne Präprozessor |

## Performance-Ziele

| Metrik | Ziel |
|--------|------|
| HTML | <5 KB gzip |
| CSS | <15 KB gzip |
| JavaScript | <50 KB gzip |
| Fonts | ~100 KB |
| **Gesamt** | **<170 KB** |

---

**Verweise:**
- [VALIDATION](VALIDATION.md) für ValidationEngine-Details
- [DATA-SCHEMA](DATA-SCHEMA.md) für Datenstrukturen
