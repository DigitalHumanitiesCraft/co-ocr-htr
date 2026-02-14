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
| Dependencies | None (Tests: Vitest) |
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
├── knowledge/             # Consolidated knowledge base (Obsidian Vault)
│   ├── INDEX.md           # Navigation, document matrix
│   ├── VISION.md          # Project goal, success criteria
│   ├── METHODOLOGY.md     # Scientific foundations
│   ├── MODEL-LANDSCAPE.md # OCR/HTR model comparison
│   ├── DESIGN-SYSTEM.md   # UI/UX specification
│   ├── ARCHITECTURE.md    # Technical architecture
│   ├── VALIDATION.md      # Hybrid validation
│   ├── DATA-SCHEMA.md     # Data structures
│   ├── IMPLEMENTATION-PLAN.md # Roadmap (completed)
│   └── JOURNAL.md         # Development log
├── docs/                  # GitHub Pages deployment
│   ├── index.html         # Main application
│   ├── css/               # Modular CSS files
│   │   ├── variables.css  # Design tokens
│   │   ├── base.css       # Reset, typography
│   │   ├── layout.css     # Grid, header
│   │   ├── components.css # Buttons, cards
│   │   ├── viewer.css     # Document viewer
│   │   ├── editor.css     # Transcription editor
│   │   ├── validation.css # Validation panel
│   │   └── dialogs.css    # Modal dialogs
│   ├── js/
│   │   ├── main.js        # Entry point
│   │   ├── state.js       # Central state (EventTarget)
│   │   ├── viewer.js      # Document viewer
│   │   ├── editor.js      # Transcription editor
│   │   ├── components/    # UI components
│   │   ├── config/        # Prompt profiles
│   │   └── services/      # LLM, i18n, Storage, Validation, Export
│   ├── i18n/              # Translation dictionaries (en.json, de.json)
│   ├── samples/           # Demo documents
│   └── tests/             # Vitest tests (~574 tests)
└── data/                  # Development data (not deployed)
    └── ocr-examples/      # Complete datasets
```

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
