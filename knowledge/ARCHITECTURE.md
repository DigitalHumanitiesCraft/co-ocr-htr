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

### AppState

Central state management using native EventTarget API. Replaces custom EventBus with browser standard.

**Implementation:** [state.js](../docs/js/state.js)

**State Properties:**
| Property | Type | Description |
|----------|------|-------------|
| image | Object | URL, width, height of current document |
| regions | Array | Bounding boxes with line number and coordinates |
| transcription | Array | Transcribed text lines |
| zoom | Number | Current zoom level |
| selectedLine | Number/null | Currently selected line |

**Key Methods:**
- `getState()` returns current state
- `setImage(url)` loads document and fires `imageChanged`
- `setSelection(line)` selects line and fires `selectionChanged`
- `setZoom(level)` updates zoom and fires `zoomChanged`

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

### LLMService

Abstraction layer for multiple LLM providers with unified API.

**Implementation:** [llm.js](../docs/js/services/llm.js)

**Key Methods:**
- `setProvider(name)` switches between Gemini, OpenAI, Anthropic, DeepSeek, Ollama
- `setApiKey(key)` configures authentication
- `transcribe(image, options)` sends image to VLM for OCR/HTR
- `validate(text, perspective)` requests LLM-Judge analysis

**Supported Providers:**
| Provider | Endpoint | Default Model | Vision |
|----------|----------|---------------|--------|
| Gemini | generativelanguage.googleapis.com | gemini-3-flash-preview | Yes |
| OpenAI | api.openai.com | gpt-4o | Yes |
| Anthropic | api.anthropic.com | claude-4.5-haiku | Yes |
| Ollama | localhost:11434 | deepseek-ocr | Yes |

### Document Viewer (OpenSeadragon)

IIIF-compatible image viewer with SVG overlay for region synchronization.

**Implementation:** [viewer.js](../docs/js/viewer.js)

**Dependencies:** OpenSeadragon 4.1 + SVG Overlay Plugin (loaded via CDN)

**Key Features:**
| Feature | Description |
|---------|-------------|
| Pan/Zoom | Built-in mouse and touch support |
| Rotation | 90-degree increments |
| Flip | Horizontal mirroring |
| Local Images | Direct file upload |
| IIIF Images | Manifest URL loading |
| SVG Overlay | Region highlighting with bounding boxes |

**Coordinate System:**
OpenSeadragon uses viewport-normalized coordinates where X ranges 0-1 and Y is scaled by aspect ratio.

**Important:** Y coordinates must be multiplied by aspect ratio (height/width) when converting from PAGE-XML percentages. The formula is: `x = percent/100`, `y = (percent/100) * aspectRatio`. This is a common source of bugs - see viewer.js for the implementation.

**Keyboard Shortcuts:**
| Key | Action |
|-----|--------|
| `+` / `=` | Zoom in |
| `-` | Zoom out |
| `0` | Reset view |
| `f` | Fit to view |
| `r` / `R` | Rotate left/right |
| `h` | Flip horizontal |

### Event System

Components communicate through AppState events. Each component listens for relevant events and updates its UI accordingly.

**Event Flow:**
- **viewer.js** listens for `selectionChanged` to highlight regions and pan
- **editor.js** listens for `selectionChanged` to highlight rows and scroll
- **ui.js** listens for `selectionChanged` to scroll validation cards into view
- **editor.js** listens for `pageChanged` and `pagesLoaded` to re-render content

This creates bidirectional synchronization between all three panels.

### IIIF Integration

**Implementation:** IIIF Dialog in [dialogs.js](../docs/js/components/dialogs.js)

**Features:**
| Feature | Description |
|---------|-------------|
| Manifest URL Input | Text field with validation |
| Example Links | Pre-filled Bodleian, Gallica, BSB URLs |
| Version Detection | Auto-detect IIIF Presentation API v2/v3 |
| Page Navigation | Multi-page documents with prev/next buttons |

**Workflow:** User opens IIIF Dialog, enters manifest URL, system parses manifest, extracts pages, displays first page in viewer, enables navigation for multi-page documents.

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

## API Integration

All provider-specific API calls are implemented in [llm.js](../docs/js/services/llm.js).

**Common Pattern:** Each provider receives the prompt and base64-encoded image, returns structured transcription. Temperature is set low (0.1) for consistent OCR results.

**Provider Specifics:**
| Provider | Auth Method | Image Format | Max Tokens |
|----------|-------------|--------------|------------|
| Gemini | URL parameter | inline_data | 8192 |
| OpenAI | Bearer token | image_url (data URI) | 4096 |
| Anthropic | x-api-key header | base64 in content | 4096 |
| Ollama | None (local) | base64 | Varies |

## Error Handling

| Error Type | Cause | Handling |
|------------|-------|----------|
| NetworkError | No connection | Retry with backoff |
| AuthError | Invalid API Key | Dialog for key entry |
| RateLimitError | Too many requests | Wait, countdown |
| QuotaError | Quota exhausted | Alternative provider |
| StorageError | LocalStorage full | Delete old sessions |

**Retry Strategy:** Exponential backoff (1s, 2s, 4s) with max 3 attempts. Respects `retryAfter` header from rate-limited responses.

## Security

### API Key Handling

Keys are stored in LocalStorage (Base64 obfuscation, not real encryption).

**Warning in UI:** "Do not use this tool on public computers."

### Content Security Policy

CSP restricts connections to known LLM API endpoints (Gemini, OpenAI, Anthropic, DeepSeek) plus localhost for Ollama. Scripts and styles limited to same-origin.

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
