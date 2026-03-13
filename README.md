# coOCR/HTR

> **Research Preview (Beta)** - This tool is under active development using the [Promptotyping methodology](https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin). Core features are functional, but expect rough edges. Feedback welcome via [GitHub Issues](https://github.com/DigitalHumanitiesCraft/co-ocr-htr/issues).

**Editor-in-the-Loop tool for OCR/HTR verification, validation, and correction.**

A browser-based application that helps domain experts verify and correct OCR/HTR results for historical documents. Upload an image to generate transcriptions via LLM, or import existing PAGE-XML from tools like Transkribus for correction. The goal: quality-assured transcriptions ready for downstream workflows.

## Development Approach

This project is developed using **[Promptotyping](https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin)** - an iterative methodology combining AI-assisted development with structured documentation:

1. **Documentation before code** - All design decisions documented in [knowledge/](knowledge/)
2. **Iteration through dialogue** - Requirements refined through conversation
3. **Early validation** - Continuous user feedback integration
4. **Minimal, readable code** - Vanilla JavaScript, no build process

The [knowledge/](knowledge/) folder contains a complete knowledge base (Obsidian-compatible) documenting the project's methodology, architecture, and development history. See also [METHODOLOGY.md](knowledge/METHODOLOGY.md) for the scientific background.

**Built with:** [Claude Code](https://claude.ai/code) powered by Claude Opus 4.6 (Anthropic)

## Why coOCR/HTR?

Standard OCR/HTR pipelines often fail on historical documents due to unusual scripts, complex layouts, and domain-specific vocabulary. These errors require **human expertise** to correct - but existing tools are often complex and not optimized for the correction workflow.

coOCR/HTR provides:
- **Two input modes**: Generate OCR from images OR correct existing PAGE-XML
- **AI assistance**: LLM-powered transcription and validation for difficult passages
- **Expert-focused UI**: Synchronized view of document, transcription, and validation
- **Workflow integration**: Export corrected results in standard formats

## Features

- **Multi-provider LLM Integration**: Gemini 3, OpenAI, Anthropic, Mistral OCR, Azure Mistral OCR, Ollama (local with DeepSeek-OCR)
- **Hybrid Validation**: Deterministic rules + LLM-as-judge (with optional custom prompt)
- **Validation Fallback**: Automatic cloud fallback for OCR-only models (local transcription + cloud validation)
- **Expert-in-the-Loop**: Critical expert validation workflow
- **Flexible Document Types**: Letters, diaries, account books, inventories (lines/grid modes)
- **Document Context**: 10 metadata fields (script type, period, language, region, etc.) for prompt enrichment
- **Project Rules**: Markdown-based transcription rules applied to all pages in a project
- **Document Viewer**: Pan, zoom, fit controls with keyboard shortcuts
- **IIIF Support**: Load documents from IIIF-compatible repositories (Internet Archive, Bodleian, etc.)
- **RTL Script Support**: Automatic detection and display for Arabic, Hebrew, and other RTL scripts
- **Batch Processing**: Transcribe and validate single pages or entire multi-page documents
- **PAGE-XML Import**: Compatible with Transkribus exports
- **METS-XML Support**: Parse multi-page documents from METS metadata
- **Internationalization**: German/English UI with runtime language switching
- **Welcome Overlay**: First-visit onboarding with workflow overview
- **Guided Workflow**: Step-by-step hints and progress tracking
- **Export Formats**: Plain text, JSON, Markdown, PAGE-XML (2019-07-15), TEI-XML, ZIP (multi-page)
- **PWA Support**: Works offline after first load
- **No npm Dependencies**: Vanilla JavaScript (OpenSeadragon via CDN), runs in any modern browser

## Quick Start

### Live Demo

**[Try coOCR/HTR](http://dhcraft.org/co-ocr-htr)**

1. Click "Upload" > "Demo laden" to try with sample data
2. Or click the model indicator (e.g., "Gemini Flash") to configure your LLM
3. Upload a document image or PAGE-XML file via the Upload menu
4. Click "Transcribe" to run LLM transcription
5. Review validation results in the right panel
6. Export your results

### Local Development

```bash
# Clone the repository
git clone https://github.com/DigitalHumanitiesCraft/co-ocr-htr.git

# Serve locally (any static server works)
npx serve docs -l 3000

# Open http://localhost:3000
```

No build step required.

## Architecture

```
docs/
├── index.html              # Main application
├── css/                    # Modular CSS (8 files)
│   ├── variables.css       # Design tokens
│   ├── base.css            # Reset, typography
│   ├── layout.css          # Grid, header
│   ├── components.css      # Buttons, cards
│   ├── viewer.css          # Document viewer
│   ├── editor.css          # Transcription editor
│   ├── validation.css      # Validation panel
│   └── dialogs.css         # Modal dialogs
├── i18n/                   # Internationalization
│   ├── en.json             # English translations
│   └── de.json             # German translations
├── js/
│   ├── main.js             # Entry point
│   ├── state.js            # Central state (EventTarget)
│   ├── viewer.js           # Document viewer
│   ├── editor.js           # Transcription editor
│   ├── ui.js               # UI utilities
│   ├── pwa.js              # Service worker registration
│   ├── components/
│   │   ├── dialogs.js      # Modal dialogs
│   │   ├── upload.js       # File upload
│   │   ├── transcription.js# LLM transcription
│   │   ├── validation.js   # Validation panel
│   │   ├── context.js      # Document context form
│   │   ├── description.js  # Document description
│   │   ├── thinking.js     # LLM thinking panel
│   │   └── batch-progress.js # Batch progress panel
│   ├── services/
│   │   ├── llm.js          # LLM provider abstraction
│   │   ├── storage.js      # LocalStorage wrapper
│   │   ├── validation.js   # Validation engine
│   │   ├── export.js       # Multi-format export
│   │   ├── i18n.js         # Internationalization service
│   │   ├── postprocess.js  # LLM review pipeline
│   │   ├── samples.js      # Demo data loader
│   │   └── parsers/
│   │       ├── page-xml.js # PAGE-XML import
│   │       └── mets-xml.js # METS-XML import
│   └── utils/              # Shared utilities
│       ├── constants.js    # App constants
│       ├── dom.js          # DOM helpers
│       ├── textFormatting.js # Text normalization
│       ├── tooltips.js     # Tooltip system
│       ├── panelResize.js  # Panel resize handles
│       └── validationResize.js # Validation panel resize
└── tests/                  # Vitest tests (567 tests)
```

## Supported Providers

| Provider | Default Models | Vision |
|----------|----------------|--------|
| Gemini | gemini-3-flash, gemini-3-pro | Yes |
| OpenAI | gpt-5.2, gpt-5.2-mini | Yes |
| Anthropic | claude-sonnet-4-5, claude-haiku-4-5, claude-opus-4-5 | Yes |
| Mistral | mistral-ocr-latest | Yes (OCR-only) |
| Mistral OCR (Azure) | mistral-ocr-latest | Yes (OCR-only) |
| Ollama (local) | deepseek-ocr, llava, llama3.2-vision | Yes |

> **Note:** Model lists change frequently. Use "Custom model..." in the UI to enter any model ID. Check provider docs for current models.

### Local OCR with DeepSeek-OCR

For best local OCR results, install [DeepSeek-OCR](https://ollama.com/library/deepseek-ocr) via Ollama:

```bash
ollama pull deepseek-ocr
```

Requires Ollama v0.13.0+. Model size: ~6.7GB.

**Hybrid Workflow**: DeepSeek-OCR is an OCR-only model optimized for text extraction but cannot perform text validation. When you use DeepSeek-OCR for transcription, validation automatically falls back to a cloud provider (Gemini, OpenAI, or Anthropic) if configured. This enables a privacy-conscious hybrid workflow: local transcription + cloud validation.

### API Key Security

API keys are stored in browser memory only (not localStorage) and cleared when you close the tab. This is **not fully secure** - browser extensions or physical access could expose them. Recommendations:
- Use a dedicated API key with spending limits
- For sensitive documents, use Ollama locally (no API key needed)

See [SECURITY.md](knowledge/SECURITY.md) for the complete security model.

## Documentation

See the [knowledge/](knowledge/) folder for detailed documentation:
- [VISION.md](knowledge/VISION.md) - Project goals and success criteria
- [INDEX.md](knowledge/INDEX.md) - Navigation and document matrix
- [METHODOLOGY.md](knowledge/METHODOLOGY.md) - Scientific background
- [MODEL-LANDSCAPE.md](knowledge/MODEL-LANDSCAPE.md) - OCR/HTR model comparison
- [ARCHITECTURE.md](knowledge/ARCHITECTURE.md) - Technical architecture
- [VALIDATION.md](knowledge/VALIDATION.md) - Validation system
- [JOURNAL.md](knowledge/JOURNAL.md) - Development log

## Development

### Run Tests
```bash
cd docs
npm install
npm test
```

### Project Status

**Phase 1-2: Core Application** - Complete
- LLM Integration (5 cloud + 1 local provider), Gemini 3 optimization
- Document Viewer (OpenSeadragon), Transcription Editor, Hybrid Validation
- PAGE-XML/METS-XML Import & Export
- Multi-page navigation, IIIF support, Help & About pages

**Phase 3: Batch Processing** - Complete
- Batch transcription/validation for all pages with abort control
- Page status indicators (dots showing idle/transcribed/validated/error)
- Floating progress panel with progress bar
- ZIP export for multi-page documents

**Phase 4: Polish & Release** - Complete
- 567 unit tests passing across 18 test files
- Simplified API configuration dialog with clickable model indicator
- Document context for enhanced transcription
- Undo/Redo, Diff view, Line numbers
- Upload dropdown with demo badges (OCR/HTR, IIIF, XML, page count)
- Validation fallback for OCR-only models (hybrid local+cloud workflow)

**Phase 5: Internationalization** - Complete
- German/English UI with runtime language switching (250+ i18n keys)
- Language switcher in header, persisted in localStorage

**Phase 6: Community Integration & Stabilization** - Complete
- Fork integration (Robert Klugseder, 67 commits) with full attribution
- Azure Mistral OCR provider with configurable endpoint
- Markdown-based project rules (transcription guidelines)
- Welcome overlay with first-visit onboarding
- Two-layer prompt enrichment: Transcription Rules (project) + Document Context (page)

See [IMPLEMENTATION-PLAN.md](knowledge/IMPLEMENTATION-PLAN.md) for details.

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to get involved.

## Contributors

- **[Robert Klugseder](https://github.com/rklugsederoeaw)** (OeAW) -- IndexedDB multi-project management, LLM Thinking Panel, LLM Review Apply, Mistral OCR integration, postprocessing pipeline, validation persistence, description feature, codebase audit fixes, responsive UI improvements, and extensive test coverage. [Fork](https://github.com/rklugsederoeaw/co-ocr-htr-rk)

## License

This work is licensed under a [Creative Commons Attribution 4.0 International License (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).

[![CC BY 4.0](https://licensebuttons.net/l/by/4.0/88x31.png)](https://creativecommons.org/licenses/by/4.0/)
