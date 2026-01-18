# coOCR/HTR

Browser-based experimentation environment for integrating domain experts into OCR/HTR pipelines for historical documents.

## Features

- **Multi-provider LLM Integration**: Gemini 3, OpenAI, Anthropic, DeepSeek, Ollama (local)
- **Hybrid Validation**: Deterministic rules + LLM-as-judge with multiple perspectives
- **Expert-in-the-Loop**: Critical expert validation workflow
- **Flexible Document Types**: Letters, diaries, account books, inventories (lines/grid modes)
- **Document Viewer**: Pan, zoom, fit controls with keyboard shortcuts
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
| OpenAI | gpt-5.2, gpt-5.2-pro | Yes |
| Anthropic | claude-haiku-4.5, claude-sonnet-4.5, claude-opus-4.5 | Yes |
| Ollama | deepseek-ocr, llava, llama3.2-vision | Yes |

## Documentation

See the [knowledge/](knowledge/) folder for detailed documentation:
- [INDEX.md](knowledge/INDEX.md) - Navigation
- [METHODOLOGY.md](knowledge/METHODOLOGY.md) - Scientific background
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
- LLM Integration (5 providers), Gemini 3 optimization
- Document Viewer, Transcription Editor, Hybrid Validation
- PAGE-XML/METS-XML Import & Export
- Multi-page navigation, Help & About pages

**Phase 4: Polish & Release** - In Progress
- 118 unit tests passing (export, validation, llm, page-xml)
- E2E tests, performance audit planned

See [IMPLEMENTATION-PLAN.md](knowledge/IMPLEMENTATION-PLAN.md) for details.

## License

MIT
