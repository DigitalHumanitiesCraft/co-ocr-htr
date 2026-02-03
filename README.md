# coOCR/HTR

> **Work in Progress** - This tool is under active development using the [Promptotyping methodology](https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin). Core features are functional, but expect rough edges. Feedback welcome via [GitHub Issues](https://github.com/DigitalHumanitiesCraft/co-ocr-htr/issues).

**Editor-in-the-Loop tool for OCR/HTR verification, validation, and correction.**

A browser-based application that helps domain experts verify and correct OCR/HTR results for historical documents. Upload an image to generate transcriptions via LLM, or import existing PAGE-XML from tools like Transkribus for correction. The goal: quality-assured transcriptions ready for downstream workflows.

## Development Approach

This project is developed using **[Promptotyping](https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin)** - an iterative methodology combining AI-assisted development with structured documentation:

1. **Documentation before code** - All design decisions documented in [knowledge/](knowledge/)
2. **Iteration through dialogue** - Requirements refined through conversation
3. **Early validation** - Continuous user feedback integration
4. **Minimal, readable code** - Vanilla JavaScript, no build process

The [knowledge/](knowledge/) folder contains a complete knowledge base (Obsidian-compatible) documenting the project's methodology, architecture, and development history. See also [METHODOLOGY.md](knowledge/METHODOLOGY.md) for the scientific background.

**Built with:** [Claude Code](https://claude.ai/code) powered by Claude Opus 4.5 (Anthropic)

## Why coOCR/HTR?

Standard OCR/HTR pipelines often fail on historical documents due to unusual scripts, complex layouts, and domain-specific vocabulary. These errors require **human expertise** to correct - but existing tools are often complex and not optimized for the correction workflow.

coOCR/HTR provides:
- **Two input modes**: Generate OCR from images OR correct existing PAGE-XML
- **AI assistance**: LLM-powered transcription and validation for difficult passages
- **Expert-focused UI**: Synchronized view of document, transcription, and validation
- **Workflow integration**: Export corrected results in standard formats

## Features

- **Multi-provider LLM Integration**: Gemini 3, OpenAI, Anthropic, Ollama (local with DeepSeek-OCR)
- **Hybrid Validation**: Deterministic rules + LLM-as-judge (with optional custom prompt)
- **Expert-in-the-Loop**: Critical expert validation workflow
- **Flexible Document Types**: Letters, diaries, account books, inventories (lines/grid modes)
- **Document Viewer**: Pan, zoom, fit controls with keyboard shortcuts
- **IIIF Support**: Load documents from IIIF-compatible repositories (Internet Archive, Bodleian, etc.)
- **RTL Script Support**: Automatic detection and display for Arabic, Hebrew, and other RTL scripts
- **Batch Processing**: Transcribe and validate single pages or entire multi-page documents
- **PAGE-XML Import**: Compatible with Transkribus exports
- **METS-XML Support**: Parse multi-page documents from METS metadata
- **Guided Workflow**: Step-by-step hints and progress tracking
- **Export Formats**: Plain text, JSON, Markdown, PAGE-XML (2019-07-15)
- **No Dependencies**: Vanilla JavaScript, runs in any modern browser

## Quick Start

### Live Demo

**[Try coOCR/HTR](http://dhcraft.org/co-ocr-htr)**

1. Click "Load Demo" to try with sample data
2. Or click the key icon to configure your own API key
3. Upload a document image or PAGE-XML file
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
│   ├── editor.css          # Transcription table
│   ├── validation.css      # Validation panel
│   └── dialogs.css         # Modal dialogs
├── js/
│   ├── main.js             # Entry point
│   ├── state.js            # Central state (EventTarget)
│   ├── viewer.js           # Document viewer
│   ├── editor.js           # Transcription editor
│   ├── components/
│   │   ├── dialogs.js      # Modal dialogs
│   │   ├── upload.js       # File upload
│   │   ├── transcription.js# LLM transcription
│   │   └── validation.js   # Validation panel
│   └── services/
│       ├── llm.js          # LLM provider abstraction
│       ├── storage.js      # LocalStorage wrapper
│       ├── validation.js   # Validation engine
│       └── parsers/
│           ├── page-xml.js # PAGE-XML import
│           └── mets-xml.js # METS-XML import
└── tests/                  # Vitest tests
```

## Supported Providers

| Provider | Models | Vision Support |
|----------|--------|----------------|
| Gemini | gemini-3-flash-preview, gemini-3-pro-preview | Yes |
| OpenAI | gpt-4o, gpt-4o-mini | Yes |
| Anthropic | claude-4.5-haiku, claude-4.5-sonnet, claude-4.5-opus | Yes |
| Ollama (local) | deepseek-ocr (recommended), llava, llama3.2-vision | Yes |

### Local OCR with DeepSeek-OCR

For best local OCR results, install [DeepSeek-OCR](https://ollama.com/library/deepseek-ocr) via Ollama:

```bash
ollama pull deepseek-ocr
```

Requires Ollama v0.13.0+. Model size: ~6.7GB.

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
- LLM Integration (4 cloud + 1 local provider), Gemini 3 optimization
- Document Viewer (OpenSeadragon), Transcription Editor, Hybrid Validation
- PAGE-XML/METS-XML Import & Export
- Multi-page navigation, IIIF support, Help & About pages

**Phase 4: Polish & Release** - Complete
- 125 unit tests passing (export, validation, llm, page-xml)
- Simplified API configuration dialog
- Document context for enhanced transcription
- Undo/Redo, Diff view, Line numbers

See [IMPLEMENTATION-PLAN.md](knowledge/IMPLEMENTATION-PLAN.md) for details.

## License

This work is licensed under a [Creative Commons Attribution 4.0 International License (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).

[![CC BY 4.0](https://licensebuttons.net/l/by/4.0/88x31.png)](https://creativecommons.org/licenses/by/4.0/)
