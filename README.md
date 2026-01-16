# coOCR/HTR

Browser-based experimentation environment for integrating domain experts into OCR/HTR pipelines for historical documents.

## Features

- **Multi-provider LLM Integration**: Gemini, OpenAI, Anthropic, DeepSeek, Ollama (local)
- **Hybrid Validation**: Deterministic rules + LLM-as-judge with multiple perspectives
- **Expert-in-the-Loop**: Critical expert validation workflow
- **PAGE-XML Import**: Compatible with Transkribus exports
- **Export Formats**: Plain text, JSON, Markdown
- **No Dependencies**: Vanilla JavaScript, runs in any modern browser

## Quick Start

### Live Demo

**[Try coOCR/HTR](https://digitalhumanitiecraft.github.io/co-ocr-htr/)**

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
├── css/
│   ├── variables.css       # Design tokens
│   └── styles.css          # Glass morphism UI
├── js/
│   ├── main.js             # Entry point
│   ├── state.js            # Central state (EventTarget)
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
│           └── page-xml.js # PAGE-XML import
└── tests/                  # Vitest tests
```

## Supported Providers

| Provider | Model | Vision Support |
|----------|-------|----------------|
| Gemini | gemini-2.0-flash | Yes |
| OpenAI | gpt-4o-mini | Yes |
| Anthropic | claude-3-5-haiku | Yes |
| DeepSeek | deepseek-chat | No |
| Ollama | llava, bakllava | Yes |

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

- [x] Milestone 0: Repository setup
- [x] Milestone 1: Core services (Storage, LLM, State)
- [x] Milestone 2: Dialogs & Upload
- [x] Milestone 3: LLM Transcription
- [x] Milestone 4: Validation (Rules + LLM-Judge)
- [x] Milestone 5: Export (TXT, JSON, Markdown)
- [x] Milestone 6: UX (Inline-edit, Undo/Redo, Shortcuts)
- [x] Milestone 6.5: Bugfixes & Demo-Loader
- [x] Milestone 7: GitHub Pages Deployment

## License

MIT
