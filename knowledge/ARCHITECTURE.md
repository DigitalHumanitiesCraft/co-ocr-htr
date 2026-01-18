---
type: knowledge
created: 2026-01-16
tags: [coocr-htr, architecture, javascript]
status: complete
---

# Technical Architecture

System design for coOCR/HTR. Client-only, no backend.

**Dependency:** [METHODOLOGY](METHODOLOGY.md) (Rationale for technology decisions)

## System Overview

```
+-------------------------------------------------------------+
|                         BROWSER                             |
+-------------------------------------------------------------+
|  UI LAYER                                                   |
|  +----------+ +----------+ +----------+ +----------+        |
|  | Header   | | Document | | Editor   | |Validation|        |
|  |          | | Viewer   | |          | | Panel    |        |
|  +----------+ +----------+ +----------+ +----------+        |
+-------------------------------------------------------------+
|  APPLICATION LAYER                                          |
|  +----------+ +----------+ +----------+ +----------+        |
|  |   App    | | Document | |Validation| |  Export  |        |
|  |Controller| | Manager  | |  Engine  | |  Service |        |
|  +----------+ +----------+ +----------+ +----------+        |
+-------------------------------------------------------------+
|  SERVICE LAYER                                              |
|  +----------+ +----------+ +----------+ +----------+        |
|  |  LLM API | | Storage  | |  Image   | |  Event   |        |
|  |          | |          | | Processor| |   Bus    |        |
|  +----------+ +----------+ +----------+ +----------+        |
+-------------------------------------------------------------+
|  PERSISTENCE                                                |
|  +----------------+ +----------------------------+          |
|  |  LocalStorage  | |       IndexedDB            |          |
|  |  (Settings,    | |  (Documents, Sessions)     |          |
|  |   API Keys)    | |                            |          |
|  +----------------+ +----------------------------+          |
+-------------------------------------------------------------+
                              |
                              v HTTPS
+-------------------------------------------------------------+
|  EXTERNAL APIs                                              |
|  +----------+ +----------+ +----------+ +----------+        |
|  |  Gemini  | |  OpenAI  | | Anthropic| |  Ollama  |        |
|  +----------+ +----------+ +----------+ +----------+        |
+-------------------------------------------------------------+
```

## File Structure

### Current Implementation

```
docs/
├── index.html              # Entry Point + OpenSeadragon CDN
├── favicon.png
├── css/
│   ├── variables.css       # Design System Tokens (60+ vars)
│   ├── styles.css          # Entry point with @imports
│   ├── base.css            # Reset, typography
│   ├── layout.css          # Grid, panels, header
│   ├── components.css      # Buttons, inputs
│   ├── dialogs.css         # Dialog system
│   ├── editor.css          # Transcription editor
│   ├── viewer.css          # OpenSeadragon viewer styles
│   └── validation.css      # Validation panel
├── js/
│   ├── main.js             # Initialization, Workflow (~300 LOC)
│   ├── state.js            # Central State with EventTarget (~450 LOC)
│   ├── viewer.js           # OpenSeadragon Viewer (~520 LOC)
│   ├── editor.js           # Flexible Editor (lines/grid)
│   ├── ui.js               # UI Interactions
│   ├── components/
│   │   ├── dialogs.js      # Dialog Manager
│   │   ├── upload.js       # Upload Component
│   │   ├── transcription.js# Transcription UI
│   │   └── validation.js   # Validation Panel
│   └── services/
│       ├── llm.js          # Multi-Provider LLM Service
│       ├── storage.js      # LocalStorage Wrapper
│       ├── validation.js   # Validation Engine
│       ├── export.js       # Export Service (incl. PAGE-XML)
│       ├── samples.js      # Demo Loader
│       └── parsers/
│           ├── page-xml.js # PAGE-XML Parser
│           └── mets-xml.js # METS-XML Parser
├── samples/
│   ├── index.json          # Sample Manifest
│   └── raitbuch/           # Demo Data
└── tests/
    ├── llm.test.js
    ├── page-xml.test.js
    ├── export.test.js
    └── validation.test.js
```

## Core Modules

### AppState (Implemented)

Central state using native EventTarget API. Replaces custom EventBus with browser standard.

```javascript
// state.js - Actual Implementation
class AppState extends EventTarget {
  constructor() {
    super();
    this.data = {
      image: { url: string, width: number, height: number },
      regions: [{ line: number, x: number, y: number, w: number, h: number }],
      transcription: string[],  // Markdown table lines
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

**Advantages over Custom EventBus:**
- Native Browser API (no dependencies)
- DevTools integration (event debugging)
- Memory management by browser

### Event Types

| Event | Payload | Trigger |
|-------|---------|---------|
| `imageChanged` | `{ url }` | Image loaded |
| `selectionChanged` | `{ line }` | Line selected |
| `zoomChanged` | `{ zoom }` | Zoom changed |
| `transcriptionComplete` | `{ segments }` | LLM response parsed |
| `validationComplete` | `{ results }` | Validation finished |
| `segmentUpdated` | `{ index, text }` | Inline edit |

### LLMService (Implemented)

Abstraction for different providers.

```javascript
class LLMService {
  setProvider(provider: 'gemini' | 'openai' | 'anthropic' | 'deepseek' | 'ollama');
  setApiKey(key: string);
  async transcribe(image: Blob, options): Promise<TranscriptionResult>;
  async validate(text: string, perspective: Perspective): Promise<ValidationResult>;
}
```

| Provider | Endpoint | Model | Vision |
|----------|----------|-------|--------|
| Gemini | `generativelanguage.googleapis.com` | gemini-3-flash-preview | Yes |
| OpenAI | `api.openai.com` | gpt-5.2 | Yes |
| Anthropic | `api.anthropic.com` | claude-sonnet-4.5 | Yes |
| Ollama | `localhost:11434` | deepseek-ocr | Yes |

### Document Viewer (OpenSeadragon)

IIIF-compatible image viewer with SVG overlay for region synchronization.

**Dependencies (CDN):**
```html
<script src="https://cdn.jsdelivr.net/npm/openseadragon@4.1/build/openseadragon/openseadragon.min.js"></script>
<script src="https://openseadragon.github.io/svg-overlay/openseadragon-svg-overlay.js"></script>
```

**Key Features:**
| Feature | Implementation |
|---------|----------------|
| Pan/Zoom | Built-in (wheel, drag, double-click) |
| Rotation | `viewer.viewport.setRotation(degrees)` |
| Flip | `viewer.viewport.setFlip(boolean)` |
| Local Images | `viewer.open({ type: 'image', url })` |
| IIIF Images | `viewer.open(infoJsonUrl)` |
| SVG Overlay | `viewer.svgOverlay()` for regions |

**Coordinate System:**
OpenSeadragon SVG Overlay uses viewport coordinates:
- X: 0-1 (normalized to image width)
- Y: 0-aspectRatio (normalized to image width, NOT height)

```javascript
const aspectRatio = imgHeight / imgWidth;
const x = reg.x / 100;                    // PAGE-XML percent to 0-1
const y = (reg.y / 100) * aspectRatio;    // Must multiply by aspect ratio
```

**Keyboard Shortcuts:**
| Key | Action |
|-----|--------|
| `+` / `=` | Zoom in |
| `-` | Zoom out |
| `0` | Reset view (incl. rotation) |
| `f` | Fit to view |
| `r` | Rotate left |
| `R` | Rotate right |
| `h` | Flip horizontal |

### Event Listener Registration (Implemented)

```javascript
// In viewer.js (OpenSeadragon)
appState.addEventListener('selectionChanged', (e) => {
  highlightRegion(e.detail.line);
  panToRegion(e.detail.line);
});

viewer.addHandler('zoom', (e) => {
  const zoomPercent = Math.round(e.zoom * 100);
  zoomLabel.textContent = `${zoomPercent}%`;
  appState.setZoom(zoomPercent);
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

// Editor reacts to page changes (IIIF, multi-page)
appState.addEventListener('pageChanged', () => {
  renderEditor(appState.getState().transcription);
});

appState.addEventListener('pagesLoaded', () => {
  renderEditor(appState.getState().transcription);
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

### IIIF Integration

**Dialog Features:**
| Feature | Implementation |
|---------|----------------|
| Manifest URL Input | Text input with URL validation |
| Example Links | Pre-filled URLs (Bodleian, Gallica, BSB) |
| Preview | Optional - fetch and display metadata |
| Direct Load | Enter key or Load button loads immediately |
| Version Detection | Auto-detect IIIF Presentation API v2/v3 |

**Workflow:**
```
1. Open IIIF Dialog (header button or empty state)
2. Enter manifest URL or click example
3. Click Load (or press Enter)
4. Manifest parsed, pages extracted
5. First page displayed in viewer
6. Navigation buttons enable page switching
```

### StorageService

| Storage | Type | Content | Limit |
|---------|------|---------|-------|
| LocalStorage | Synchronous | Settings, API Keys | 5MB |
| IndexedDB | Asynchronous | Documents, Sessions, History | Unlimited |

## Data Flows

### Upload → Transcription

```
Image Upload → Base64 Encode → LLM Request → Parse Response
                                                    |
                                                    v
    Export ← Corrections ← Expert Review ← Validation
```

### Text-Image Synchronization (Triple Linking)

All three main panels are bidirectionally linked:

```
+-------------------------------------------------------------+
|                                                             |
|   DOCUMENT VIEWER <----------------> TRANSCRIPTION          |
|         |                               |                   |
|         |                               |                   |
|         v                               v                   |
|   +---------------------------------------------+           |
|   |            VALIDATION PANEL                  |           |
|   +---------------------------------------------+           |
|                                                             |
+-------------------------------------------------------------+
```

### Synchronization Flow

```
User clicks Transcription Line #4
       |
   TranscriptionTable.onClick(lineNumber: 4)
       |
   appState.setSelection(4)
       |
   dispatchEvent('selectionChanged', { line: 4 })
       |
   +-------------------+------------------------+
   |                   |                        |
   v                   v                        v
DocumentViewer    ValidationPanel           Editor
.highlightBox(4)  .scrollToRelated(4)      .highlightRow(4)
.scrollToRegion() .expandCard(4)
```

### Reverse Flow (Viewer → Transcription)

```
User clicks Bounding Box in Viewer
       |
   DocumentViewer.onBoxClick(boxId)
       |
   appState.setSelection(lineNumber)
       |
   dispatchEvent('selectionChanged', { line: 4 })
       |
   +-------------------+------------------------+
   |                   |                        |
   v                   v                        v
Transcription     ValidationPanel           State
.scrollToLine(4)  .scrollToRelated(4)      (updated)
.highlightRow(4)
```

### Validation → All Panels

```
User clicks "Line 4" in Validation Card
       |
   ValidationPanel.onLineRefClick(4)
       |
   appState.setSelection(4)
       |
   dispatchEvent('selectionChanged', { line: 4 })
       |
   +-------------------+------------------------+
   |                   |                        |
   v                   v                        v
DocumentViewer    Transcription             State
.highlightBox(4)  .scrollToLine(4)         (updated)
.scrollToRegion() .highlightRow(4)
```

## API Calls

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
    model: 'gpt-5.2',
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

## Error Handling

| Error Type | Cause | Handling |
|------------|-------|----------|
| NetworkError | No connection | Retry with backoff |
| AuthError | Invalid API Key | Dialog for key entry |
| RateLimitError | Too many requests | Wait, countdown |
| QuotaError | Quota exhausted | Alternative provider |
| StorageError | LocalStorage full | Delete old sessions |

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

## Security

### API Key Handling

Keys are stored in LocalStorage (Base64 obfuscation, not real encryption).

**Warning in UI:** "Do not use this tool on public computers."

### Content Security Policy

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self';
  connect-src 'self'
    https://generativelanguage.googleapis.com
    https://api.openai.com
    https://api.anthropic.com
    https://api.deepseek.com
    http://localhost:11434;
">
```

## Technology Decisions

| Decision | Rationale |
|----------|-----------|
| No Framework | Reduces complexity, improves longevity |
| LocalStorage | No backend needed, instant persistence |
| Fetch API | Native, sufficient for REST |
| ES6 Modules | Native browser support, no bundler |
| CSS Custom Properties | Theming without preprocessor |

## Performance Goals

| Metric | Target |
|--------|--------|
| HTML | <5 KB gzip |
| CSS | <15 KB gzip |
| JavaScript | <50 KB gzip |
| Fonts | ~100 KB |
| **Total** | **<170 KB** |

---

**References:**
- [VALIDATION](VALIDATION.md) for ValidationEngine details
- [DATA-SCHEMA](DATA-SCHEMA.md) for data structures
