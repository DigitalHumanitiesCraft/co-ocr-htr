# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**coOCR/HTR** is an Editor-in-the-Loop tool for OCR/HTR verification and correction of historical documents. Browser-based, zero-dependency (vanilla JS), deployed via GitHub Pages from `docs/`.

- **Input**: Image (generate OCR via LLM) OR PAGE-XML (correct existing transcription)
- **Output**: Corrected OCR/HTR in exportable formats (PAGE-XML, TEI-XML, TXT, JSON, Markdown, ZIP)
- **Users**: Digital Humanists, archivists, historians

## Commands

All commands run from `docs/`:

```bash
# Serve locally (any static server works)
npx serve docs -l 3000

# Run all tests
cd docs && npm test

# Run a single test file
cd docs && npx vitest run tests/state.test.js

# Run tests in watch mode
cd docs && npx vitest

# Run tests with UI
cd docs && npm run test:ui

# Run E2E tests (Playwright)
cd docs && npx playwright test

# Run E2E tests with headed browser
cd docs && npx playwright test --headed
```

Tests use Vitest with jsdom environment. Test files live in `docs/tests/`. E2E tests use Playwright in `docs/tests/e2e/`. No build step exists -- the app runs directly from `docs/` as ES6 modules.

## Architecture

### State Management (Event-Driven)

`state.js` exports a singleton `appState` (extends `EventTarget`). All state mutations go through `appState` methods which dispatch custom events. Components subscribe via `addEventListener`:

```
appState.setTranscription(data)      --> dispatches 'transcriptionComplete'
appState.setValidationResults(data)  --> dispatches 'validationComplete'
appState.setSelection(line)          --> dispatches 'selectionChanged'
```

Multi-page documents store per-page transcriptions in `appState.data.pageTranscriptions[pageId]`. The `document` and `transcription` fields always reflect the **current page**.

### Module Roles

| Module | Singleton | Role |
|--------|-----------|------|
| `main.js` | -- | Entry point, wires everything together |
| `state.js` | `appState` | Central state, event dispatch, auto-save |
| `viewer.js` | `initViewer()` | OpenSeadragon document viewer, region overlays |
| `editor.js` | `initEditor()` | Transcription table with inline editing, undo/redo, diff |
| `ui.js` | `initUI()` | Header controls, keyboard shortcuts, guided workflow |

### Components (`js/components/`)

| Component | Singleton | Manages |
|-----------|-----------|---------|
| `upload.js` | `uploadManager` | File upload, IIIF import, demo loading |
| `transcription.js` | `transcriptionManager` | LLM transcription calls, response parsing |
| `validation.js` | `validationPanel` | Hybrid validation display, re-validation |
| `dialogs.js` | `dialogManager` | Modal dialogs (API config, export, help) |
| `context.js` | `contextManager` | Document context for enhanced transcription |
| `description.js` | `descriptionPanel` | Illuminated initials visual description |
| `batch-progress.js` | `batchProgress` | Batch operation progress panel |

### Services (`js/services/`)

| Service | Singleton | Provides |
|---------|-----------|----------|
| `llm.js` | `llmService` | Multi-provider LLM abstraction (Gemini, OpenAI, Anthropic, Ollama) |
| `validation.js` | `validationEngine` | Deterministic rules + LLM-as-judge hybrid validation |
| `storage.js` | `storage` | localStorage (settings/prompts) + IndexedDB (projects/sessions/images/apiKeys) |
| `export.js` | `exportService` | Export to PAGE-XML, TEI-XML, TXT, JSON, Markdown, ZIP |
| `postprocess.js` | `postprocessService` | HTR post-processing orchestrator (Stage 2 + 3 pipeline) |
| `samples.js` | `samplesService` | Demo document loading |
| `parsers/page-xml.js` | `pageXMLParser` | PAGE-XML import/export |
| `parsers/mets-xml.js` | `metsXMLParser` | METS-XML multi-page import |

### Data Flow

```
Upload/IIIF/Demo --> appState.setDocument() --> viewer renders image
                                             --> editor shows empty table

Transcribe btn --> llmService.transcribe(image, provider)
               --> appState.setTranscription(segments)
               --> editor renders editable table
               --> viewer shows region overlays (if coordinates present)

Validate btn --> validationEngine.validate(text, segments, options)
             --> deterministic rules + optional LLM judge
             --> appState.setValidationResults(results)
             --> validation panel renders issues

Export btn --> exportService.export(format)
           --> downloads file
```

## Local Development Config

Copy `docs/config.local.example.js` to `docs/config.local.js` (gitignored) to auto-load API keys during local development. The app will auto-detect and load this file on startup.

## Knowledge Base

Design decisions are documented in `knowledge/`:

| Question | Document |
|----------|----------|
| Project goals | [VISION.md](knowledge/VISION.md) |
| Why categorical confidence? | [METHODOLOGY.md](knowledge/METHODOLOGY.md) |
| Which models? | [MODEL-LANDSCAPE.md](knowledge/MODEL-LANDSCAPE.md) |
| UI/UX spec | [DESIGN-SYSTEM.md](knowledge/DESIGN-SYSTEM.md) |
| Technical architecture | [ARCHITECTURE.md](knowledge/ARCHITECTURE.md) |
| Validation system | [VALIDATION.md](knowledge/VALIDATION.md) |
| Data structures | [DATA-SCHEMA.md](knowledge/DATA-SCHEMA.md) |
| HTR post-processing | [HTR-POSTPROCESSING.md](knowledge/HTR-POSTPROCESSING.md) |

## Key Concepts

| Concept | Meaning |
|---------|---------|
| Critical Expert in the Loop | Human validates, machine assists |
| Categorical Confidence | sure/check-worthy/problematic (no percentages) |
| Hybrid Validation | Deterministic rules + LLM-Judge |
| Custom Validation Prompt | Optional user-defined validation prompt |

## Conventions

- No build process, no npm dependencies at runtime (Vitest is dev-only)
- ES6 Modules (native `import`/`export`)
- CSS Custom Properties for theming (`css/variables.css`)
- Comments explain "why", code explains "what"
- **No emojis** in code or docs -- use `[x]`/`[~]`/`[ ]` for status, `(green)`/`(yellow)`/`(red)` for colors
- Deployed from `docs/` folder to GitHub Pages
