# CLAUDE.md

Projektkontext für Claude Code.

## Technologie-Stack

| Komponente | Technologie |
|------------|-------------|
| Runtime | Vanilla JavaScript (ES6+) |
| Dependencies | Keine (Tests: Vitest) |
| Storage | LocalStorage |
| API | Fetch API (Gemini, OpenAI, Anthropic, DeepSeek, Ollama) |
| UI | Plain HTML/CSS, Dark Mode, Glass Morphism |
| Hosting | GitHub Pages (`docs/` folder) |

## Projektstruktur

```
co-ocr-htr/
├── README.md              # Projektübersicht (englisch)
├── CLAUDE.md              # Dieses Dokument
├── knowledge/             # Konsolidierte Wissensbasis (Obsidian Vault)
│   ├── INDEX.md           # Navigation, Dokumentenmatrix
│   ├── METHODOLOGY.md     # Wissenschaftliche Grundlagen
│   ├── DESIGN-SYSTEM.md   # UI/UX-Spezifikation
│   ├── ARCHITECTURE.md    # Technische Architektur
│   ├── VALIDATION.md      # Hybride Validierung
│   ├── DATA-SCHEMA.md     # Datenstrukturen
│   ├── IMPLEMENTATION-PLAN.md # Roadmap (abgeschlossen)
│   └── JOURNAL.md         # Entwicklungslog
├── docs/                  # GitHub Pages Deployment
│   ├── index.html         # Hauptanwendung
│   ├── css/               # Modulare CSS-Dateien
│   │   ├── variables.css  # Design Tokens
│   │   ├── base.css       # Reset, Typography
│   │   ├── layout.css     # Grid, Header
│   │   ├── components.css # Buttons, Cards
│   │   ├── viewer.css     # Document Viewer
│   │   ├── editor.css     # Transcription Editor
│   │   ├── validation.css # Validation Panel
│   │   └── dialogs.css    # Modal Dialogs
│   ├── js/
│   │   ├── main.js        # Entry Point
│   │   ├── state.js       # Central State (EventTarget)
│   │   ├── viewer.js      # Document Viewer
│   │   ├── editor.js      # Transcription Editor
│   │   ├── components/    # UI Components
│   │   └── services/      # LLM, Storage, Validation, Export
│   ├── samples/           # Demo-Dokumente
│   └── tests/             # Vitest Tests
└── data/                  # Entwicklungsdaten (nicht deployed)
    └── ocr-examples/      # Vollständige Datensätze
```

## Wissensbasis (knowledge/)

Alle Designentscheidungen sind in `knowledge/` dokumentiert und begründet.

| Frage | Dokument |
|-------|----------|
| Warum kategorielle Konfidenz? | [METHODOLOGY](knowledge/METHODOLOGY.md) |
| Wie sieht das UI aus? | [DESIGN-SYSTEM](knowledge/DESIGN-SYSTEM.md) |
| Wie ist es gebaut? | [ARCHITECTURE](knowledge/ARCHITECTURE.md) |
| Wie funktioniert Validierung? | [VALIDATION](knowledge/VALIDATION.md) |
| Welche Datenstrukturen? | [DATA-SCHEMA](knowledge/DATA-SCHEMA.md) |

## Entwicklungsmethodik: Promptotyping

1. Dokumentation vor Code
2. Iteration durch Dialog
3. Frühe Validierung
4. Minimaler, lesbarer Code

## Kernkonzepte

| Konzept | Bedeutung |
|---------|-----------|
| Critical Expert in the Loop | Mensch validiert, Maschine unterstützt |
| Kategorielle Konfidenz | sicher/prüfenswert/problematisch (keine %) |
| Hybride Validierung | Deterministische Regeln + LLM-Judge |
| Perspektiven | Paläographisch, Sprachlich, Strukturell, Domäne |

## Konventionen

- Kein Build-Prozess
- ES6 Modules (native)
- CSS Custom Properties für Theming
- Kommentare erklären "warum", Code erklärt "was"
