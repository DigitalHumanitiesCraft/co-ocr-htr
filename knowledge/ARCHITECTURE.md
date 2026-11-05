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
|  |  (Settings,    | |  (Projects, Sessions,      |          |
|  |   Prompts)     | |   Images, optional keys)   |          |
|  +----------------+ +----------------------------+          |
+-------------------------------------------------------------+
                              |
                              v HTTPS
+-------------------------------------------------------------+
|  EXTERNAL APIs                                              |
|  +----------+ +----------+ +----------+ +----------+        |
|  |  Gemini  | |  OpenAI  | | Anthropic| |  Ollama  |        |
|  +----------+ +----------+ +----------+ +----------+        |
|  +----------+ +------------------+                          |
|  |  Mistral | | Azure Mistral    |                          |
|  +----------+ +------------------+                          |
+-------------------------------------------------------------+
```

## File Structure

### Current Implementation

```
docs/
├── index.html              # Application entry point
├── help.html, about.html   # Help and about pages; the about page links the knowledge folder on GitHub
├── favicon.svg, manifest.json, sw.js  # Icon, PWA manifest, network-first service worker
├── config.local.example.js # Template for the gitignored local key file
├── assets/                 # Logo and mock document image
├── css/
│   ├── variables.css       # Design system tokens
│   ├── styles.css          # Entry point with @imports
│   ├── base.css            # Reset, typography
│   ├── layout.css          # Grid, panels, header, container queries
│   ├── components.css      # Buttons, inputs
│   ├── dialogs.css         # Dialog system
│   ├── editor.css          # Transcription editor
│   ├── viewer.css          # OpenSeadragon viewer styles
│   ├── validation.css      # Validation panel
│   └── pages.css           # Help and about pages
├── js/
│   ├── main.js             # Initialization, workflow, welcome overlay, project rules dialog
│   ├── state.js            # Central state with EventTarget, auto-save
│   ├── viewer.js           # OpenSeadragon viewer
│   ├── editor.js           # Flexible editor (lines/grid), diff view, undo
│   ├── ui.js               # UI interactions
│   ├── pwa.js              # Service worker registration, offline indicator
│   ├── components/
│   │   ├── dialogs.js      # Dialog manager
│   │   ├── upload.js       # Upload component (JPG, PNG, WebP, PAGE-XML)
│   │   ├── transcription.js# Transcription UI
│   │   ├── validation.js   # Validation panel
│   │   ├── description.js  # Image description (Gemini)
│   │   ├── context.js      # Context manager (structured document context)
│   │   ├── thinking.js     # LLM reasoning/thinking panel
│   │   └── batch-progress.js # Batch progress panel
│   ├── utils/
│   │   ├── constants.js    # Feature flags, magic numbers
│   │   ├── dom.js          # DOM utilities (getById, show, hide)
│   │   ├── textFormatting.js # Markers, HTML escaping, confidence
│   │   ├── lineAlign.js    # Line alignment for diff view and PAGE-XML geometry
│   │   ├── iiifLabel.js    # IIIF Presentation 2 and 3 labels as display text
│   │   ├── osdSvgOverlay.js # SVG layer on the OpenSeadragon viewport
│   │   ├── panelResize.js  # Panel resize with drag handles
│   │   ├── validationResize.js # Validation panel resize
│   │   └── tooltips.js     # Tooltip positioning system
│   └── services/
│       ├── llm.js          # Multi-provider LLM service
│       ├── i18n.js         # Internationalization service (DE/EN)
│       ├── storage.js      # localStorage + IndexedDB v2 storage service
│       ├── validation.js   # Validation engine
│       ├── export.js       # Export service (TXT, JSON, MD, PAGE-XML, TEI, ZIP)
│       ├── postprocess.js  # Post-processing pipeline (Stage 2/3)
│       ├── samples.js      # Demo loader
│       └── parsers/
│           ├── page-xml.js # PAGE-XML parser
│           └── mets-xml.js # METS-XML parser
├── vendor/                 # OpenSeadragon and JSZip from npm, VERSIONS.txt with licences and SHA-256
├── i18n/
│   ├── en.json             # English translation dictionary
│   └── de.json             # German translation dictionary
├── samples/
│   ├── index.json          # Sample manifest
│   └── <sample>/           # Demo data, one folder per sample
└── tests/                  # Vitest unit tests, e2e/ Playwright specs (see TESTING.md)
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
| `batchStarted` | `{ operation, total }` | Batch operation begins |
| `batchProgress` | `{ currentIndex, total, ... }` | Batch progress update |
| `batchComplete` | `{ successCount, errorCount, ... }` | Batch operation finished |

**Batch State:**

For multi-page batch operations (transcription/validation), additional state tracks progress:

| Property | Type | Description |
|----------|------|-------------|
| batch.operation | string/null | 'transcription' \| 'validation' \| null |
| batch.status | string | 'idle' \| 'running' \| 'complete' \| 'aborted' |
| batch.currentIndex | number | Current page being processed |
| batch.total | number | Total pages in batch |
| batch.successCount | number | Successfully processed pages |
| batch.errorCount | number | Failed pages |
| batch.abortRequested | boolean | User requested abort |

**Batch Methods:**
- `startBatch(operation, total)` initializes batch and fires `batchStarted`
- `updateBatchProgress(index, success)` updates counters and fires `batchProgress`
- `requestBatchAbort()` sets abort flag for loop termination
- `completeBatch()` finalizes batch and fires `batchComplete`
- `getPageStatus(pageIndex)` returns transcription/validation status for page

### LLMService

Abstraction layer for multiple LLM providers with unified API.

**Implementation:** [llm.js](../docs/js/services/llm.js)

**Key Methods:**
- `setProvider(name)` switches between Gemini, OpenAI, Anthropic, Ollama
- `setApiKey(key)` configures authentication
- `transcribe(image, options)` sends image to VLM for OCR/HTR
- `validate(text, options)` requests LLM Review (options: `{ customPrompt }`)
- `isOcrOnlyModel()` detects OCR-specific models (e.g., DeepSeek-OCR)
- `getValidationFallback()` finds alternative provider for validation
- `cancelRequests()` aborts every request in flight; each request carries a signal (`_signal()`) that combines the provider timeout with a shared `AbortController`, and the cancel button of a single-page transcription or validation calls it

**Supported Providers:**
| Provider | Endpoint | Default Model | Vision | Auth |
|----------|----------|---------------|--------|------|
| Gemini | generativelanguage.googleapis.com | gemini-3-flash-preview | Yes | `x-goog-api-key` header |
| OpenAI | api.openai.com | gpt-5.2 | Yes | Bearer token |
| Anthropic | api.anthropic.com | claude-sonnet-4-5-20250514 | Yes | x-api-key |
| Mistral | api.mistral.ai | mistral-ocr-latest | Yes | Bearer token |
| Azure Mistral | User-configured | mistral-ocr-latest | Yes | api-key header |
| Ollama | localhost:11434 | deepseek-ocr | Yes | None (local) |

**Validation Fallback (OCR-only Models):**

OCR-only models like DeepSeek-OCR cannot perform text validation (they require images). When such a model is active, validation automatically falls back to an alternative provider:

```
User selects: DeepSeek-OCR (Ollama)
                    │
    ┌───────────────┴───────────────┐
    │                               │
Transcription                   Validation
    │                               │
DeepSeek-OCR                   Fallback to:
(local, /api/chat)             1. Cloud provider with API key
                               2. Other Ollama model (llama3.2)
```

**Ollama Vision Models:**

Vision models require `/api/chat` endpoint (not `/api/generate`) and work best with simple prompts:
- DeepSeek-OCR: "Extract the text in the image."
- LLaVA, llama3.2-vision: Standard vision prompts

### Document Viewer (OpenSeadragon)

IIIF-compatible image viewer with SVG overlay for region synchronization.

**Implementation:** [viewer.js](../docs/js/viewer.js)

**Dependencies:** OpenSeadragon 4.1.1, vendored in `docs/vendor/` (versions and checksums in `docs/vendor/VERSIONS.txt`); the SVG layer for regions is `js/utils/osdSvgOverlay.js`

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
| LocalStorage | Synchronous | Settings, prompt fallbacks, active project ID | ~5MB |
| IndexedDB | Asynchronous | Projects, sessions, images, optional API keys | Browser quota |

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
| Gemini | `x-goog-api-key` header | inline_data | 8192 |
| OpenAI | Bearer token | image_url (data URI) | 4096 |
| Anthropic | x-api-key header | base64 in content | 4096 |
| Ollama | None (local) | base64 | Varies |

## Error Handling

Provider failures become an `LLMError` with a `type` (`_handleError()` in `llm.js`). The HTTP status decides first, the message text only where no status is available.

| Type | Cause | Handling |
|------|-------|----------|
| `auth` | HTTP 401 or 403, or 400 with "API key" (Gemini's invalid-key answer) | Error message naming the configuration |
| `rate_limit` | HTTP 429, or a rate-limit or quota message | Error message asking to wait |
| `timeout` | Provider timeout of the request signal | Error message |
| `cancelled` | User pressed cancel | Message "Operation cancelled. Nothing was changed." |
| `network` | Failed fetch, CORS | Error message |
| `unknown` | Anything else | Provider message shown |

An empty or blocked answer counts as an error and keeps the existing transcription. A streaming request is repeated once without streaming only when streaming itself failed (`isStreamSpecificFailure()`); an HTTP error, a timeout or a network failure is not retried. Retries with exponential backoff exist only in the post-processing pipeline (`postprocess.js`). A failed auto-save to IndexedDB shows an error toast.

## Security

### API Key Handling

Keys are always used in memory during runtime.
Optional persistence (trusted devices only) stores keys in IndexedDB `apiKeys`.
localStorage is not used for API key material.

The persistence checkbox in the settings dialog reads "Store API key persistently (only on trusted devices)". Unticking it and saving deletes a stored key.

### Content Security Policy

No Content Security Policy is set. `index.html` carries no CSP `meta` element, and GitHub Pages sends no custom headers. All scripts load from the same origin, including the vendored libraries under `docs/vendor/`.

## Internationalization (i18n)

**Implementation:** [i18n.js](../docs/js/services/i18n.js), [en.json](../docs/i18n/en.json), [de.json](../docs/i18n/de.json)

The i18n system provides switchable DE/EN translations for all UI text.

**Architecture:**
- `I18nService extends EventTarget` (same pattern as other services)
- JSON dictionaries loaded via `fetch()` at startup
- Translation function `t(key, params)` with `{paramName}` interpolation
- Fallback chain: current language -> EN -> key string itself
- Language stored in `localStorage` (`coocr:lang`), default: `en`
- DOM elements annotated with `data-i18n`, `data-i18n-title`, `data-i18n-placeholder`
- Language switch fires `languageChanged` event, all `[data-i18n]` elements updated

**Key Namespaces:** `app`, `header`, `viewer`, `editor`, `validation`, `dialog`, `toast`, `batch`, `confirm`, `dynamic`, `language`

## Project Rules

Projects can define transcription and validation rules that are persisted in IndexedDB.

**Schema (IndexedDB v2):**
```
rules: {
  editionModel: 'diplomatic' | 'normalized' | 'critical',
  xmlSchema: 'page-xml-2019' | 'tei-p5',
  transcription: {
    markdown: string   // Free-form Markdown transcription rules
  },
  validation: {
    autoValidate, customPrompt
  }
}
```

**Transcription Rules (Markdown Editor):**
- Free-form Markdown textarea replaces the former 5 structured fields (scriptType, language, period, paleographicHints, specialCharacters)
- Users can upload `.md` files with their transcription rules
- Preview toggle renders basic Markdown (h2, h3, bold, italic, lists, code)
- Markdown is passed directly to LLM prompts as context (LLMs understand Markdown natively)
- Backward compatibility: old structured format auto-migrated to Markdown on first read

**Effect:** Only the Markdown transcription rules reach the prompts. Edition model, XML schema, auto-validate and the custom validation prompt of the rules are stored and exported, but no code path reads them (open item in [IMPROVEMENTS](IMPROVEMENTS.md)).

**Integration:**
- Rules dialog accessible from project list (gear icon)
- Markdown rules stored as `state.data.transcriptionRulesMarkdown` on session restore
- Markdown rules injected into LLM prompts alongside per-session context from ContextManager
- Rules exportable/importable as JSON for institutional sharing

**IDB Migration:** Version-based upgrade handler. Existing v1 projects get `rules: null` (lazy migration on read).

## Post-Processing Pipeline

Feature-flagged 3-stage post-processing for transcription quality improvement.

**Implementation:** [postprocess.js](../docs/js/services/postprocess.js)

**Feature Flag:** `FEATURE_FLAGS.postprocessPipelineV1` (default: `false`)

| Stage | Purpose | Provider |
|-------|---------|----------|
| Stage 1 | Vision transcription | Active LLM provider |
| Stage 2 | Paleographic review (letterform analysis) | Text-only LLM |
| Stage 3 | Philological review (linguistic plausibility) | Text-only LLM |

**Details:** See [HTR-POSTPROCESSING.md](HTR-POSTPROCESSING.md) for full specification.

## Thinking Panel

Displays LLM reasoning tokens (extended thinking) during transcription and description.

**Implementation:** [thinking.js](../docs/js/components/thinking.js)

**Feature Flag:** `FEATURE_FLAGS.thinkingPanel` (default: `true`)

Shows real-time thinking chunks from Gemini and Anthropic models that support extended thinking. Collapsible panel appears below the editor during LLM operations.

## Welcome Overlay

First-visit onboarding dialog shown when no projects exist and welcome has not been dismissed.

**Implementation:** `showWelcomeOverlay()` in [main.js](../docs/js/main.js)

**Startup Flow (`handleStartup()`):**
1. Active project ID exists -> restore dialog (existing behavior)
2. `welcome_dismissed` is false -> show welcome overlay
3. `welcome_dismissed` is true + projects exist -> show project list
4. Otherwise -> empty app

**Content:** Logo, tagline, 5-step workflow overview, action cards (New Project, Try Demo, Upload File, Open Project), "Don't show again" checkbox.

## Technology Decisions

| Decision | Rationale |
|----------|-----------|
| No Framework | Reduces complexity, improves longevity |
| IndexedDB + localStorage split | Fast settings access + robust project persistence |
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
