# CLAUDE.md

Project context for Claude Code.

## Project Goal

**coOCR/HTR is an Editor-in-the-Loop tool for OCR/HTR verification and correction.**

- **Input**: Image (generate OCR) OR PAGE-XML (correct existing transcription)
- **Output**: Correct OCR/HTR in exportable format (PAGE-XML, TXT, JSON)
- **Target audience**: Domain experts (Digital Humanists, archivists, historians)

**Success Criteria:**
1. Self-explanatory (usable without instructions)
2. Complete workflow (Upload → Edit → Export)
3. Workflow integration (output usable in downstream processes)

See [VISION.md](knowledge/VISION.md) for details.

## Technology Stack

| Component | Technology |
|-----------|------------|
| Runtime | Vanilla JavaScript (ES6+) |
| Runtime libraries | OpenSeadragon and JSZip, vendored in `docs/vendor/` (see `VERSIONS.txt`), no CDN |
| Dev dependencies | Vitest, Playwright, ESLint (`docs/package.json`) |
| Storage | LocalStorage + IndexedDB (v2) |
| API | Fetch API (Gemini, OpenAI, Anthropic, Mistral, Azure Mistral, Ollama) |
| i18n | JSON dictionaries (DE/EN switchable) |
| UI | Plain HTML/CSS, Dark Mode, Glass Morphism |
| Hosting | GitHub Pages (`docs/` folder) |

## Project Structure

```
co-ocr-htr/
├── README.md              # Project overview (English)
├── CLAUDE.md              # This document
├── knowledge/             # Knowledge base, never part of the Pages build
│   ├── INDEX.md           # Navigation, document matrix (lists every document)
│   ├── VISION.md, METHODOLOGY.md, MODEL-LANDSCAPE.md, DESIGN-SYSTEM.md
│   ├── ARCHITECTURE.md, VALIDATION.md, DATA-SCHEMA.md, HTR-POSTPROCESSING.md
│   ├── IMPROVEMENTS.md    # Open work and operator points
│   ├── SECURITY.md, TESTING.md
│   ├── IMPLEMENTATION-PLAN.md # Closed phase record of the original roadmap
│   ├── JOURNAL.md         # Development log
│   └── archive/           # Unabridged journal as of 2026-02-05
├── docs/                  # GitHub Pages deployment (main, /docs)
│   ├── index.html         # Main application
│   ├── about.html, help.html # Static pages (css/pages.css)
│   ├── sw.js, manifest.json  # PWA service worker and manifest
│   ├── config.local.example.js # Template for the ignored config.local.js with local API keys
│   ├── css/               # styles.css imports variables, base, layout, components,
│   │                      # viewer, editor, validation, dialogs
│   ├── js/
│   │   ├── main.js, state.js, viewer.js, editor.js, ui.js, pwa.js
│   │   ├── components/    # UI components
│   │   ├── utils/         # Shared utilities
│   │   └── services/      # LLM, i18n, storage, validation, export, post-processing, parsers/
│   ├── vendor/            # OpenSeadragon, JSZip (VERSIONS.txt)
│   ├── i18n/              # Translation dictionaries (en.json, de.json)
│   ├── samples/           # Demo documents
│   └── tests/             # Vitest unit tests, e2e/ Playwright specs
└── data/                  # Development data (not deployed), see data/README.md
```

`knowledge/INDEX.md` routes to the full document set, including IMPROVEMENTS, HTR-POSTPROCESSING, SECURITY and TESTING.

## Knowledge Base (knowledge/)

All design decisions are documented and justified in `knowledge/`.

| Question | Document |
|----------|----------|
| What is the goal? | [VISION](knowledge/VISION.md) |
| Why categorical confidence? | [METHODOLOGY](knowledge/METHODOLOGY.md) |
| Which models? | [MODEL-LANDSCAPE](knowledge/MODEL-LANDSCAPE.md) |
| What does the UI look like? | [DESIGN-SYSTEM](knowledge/DESIGN-SYSTEM.md) |
| How is it built? | [ARCHITECTURE](knowledge/ARCHITECTURE.md) |
| How does validation work? | [VALIDATION](knowledge/VALIDATION.md) |
| Which data structures? | [DATA-SCHEMA](knowledge/DATA-SCHEMA.md) |

## Development Methodology: Promptotyping

1. Documentation before code
2. Iteration through dialogue
3. Early validation
4. Minimal, readable code

## Core Concepts

| Concept | Meaning |
|---------|---------|
| Critical Expert in the Loop | Human validates, machine assists |
| Categorical Confidence | confident / uncertain / problematic (no percentages) |
| Hybrid Validation | Deterministic rules + LLM-Judge |
| Custom Validation Prompt | Optional user-defined validation prompt |

## Conventions

- No build process
- ES6 Modules (native)
- CSS Custom Properties for theming
- Comments explain "why", code explains "what"
- **No emojis** - Use instead:
  - `[x]` for completed
  - `[~]` for in progress
  - `[ ]` for planned
  - `(green)`, `(yellow)`, `(red)` for status colors in documentation
