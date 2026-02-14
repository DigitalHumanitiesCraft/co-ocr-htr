# CLAUDE.md

Projektkontext fuer Claude Code.

## Projektziel

**coOCR/HTR ist ein Editor-in-the-Loop Werkzeug zur OCR/HTR-Verifikation und -Korrektur.**

- **Input**: Bild (OCR erzeugen) ODER PAGE-XML (vorhandene Transkription korrigieren)
- **Output**: Korrektes OCR/HTR in exportierbarem Format (PAGE-XML, TXT, JSON)
- **Zielgruppe**: Fachexpert*innen (Digital Humanists, Archivar*innen, Historiker*innen)

**Erfolgskriterien:**
1. Selbsterklaerend (ohne Anleitung nutzbar)
2. Vollstaendiger Workflow (Upload → Bearbeiten → Export)
3. Workflow-Integration (Output in anderen Prozessen nutzbar)

Siehe [VISION.md](knowledge/VISION.md) fuer Details.

## Technologie-Stack

| Komponente | Technologie |
|------------|-------------|
| Runtime | Vanilla JavaScript (ES6+) |
| Dependencies | Keine (Tests: Vitest) |
| Storage | LocalStorage |
| API | Fetch API (Gemini, OpenAI, Anthropic, Ollama) |
| UI | Plain HTML/CSS, Dark Mode, Glass Morphism |
| Hosting | GitHub Pages (`docs/` folder) |

## Projektstruktur

```
co-ocr-htr/
├── README.md              # Projektübersicht (englisch)
├── CLAUDE.md              # Dieses Dokument
├── knowledge/             # Konsolidierte Wissensbasis (Obsidian Vault)
│   ├── INDEX.md           # Navigation, Dokumentenmatrix
│   ├── VISION.md          # Projektziel, Erfolgskriterien
│   ├── METHODOLOGY.md     # Wissenschaftliche Grundlagen
│   ├── MODEL-LANDSCAPE.md # OCR/HTR-Modellvergleich
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

Alle Designentscheidungen sind in `knowledge/` dokumentiert und begruendet.

| Frage | Dokument |
|-------|----------|
| Was ist das Ziel? | [VISION](knowledge/VISION.md) |
| Warum kategorielle Konfidenz? | [METHODOLOGY](knowledge/METHODOLOGY.md) |
| Welche Modelle? | [MODEL-LANDSCAPE](knowledge/MODEL-LANDSCAPE.md) |
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
| Custom Validation Prompt | Optionaler benutzerdefinierter Validierungsprompt |

## Konventionen

- Kein Build-Prozess
- ES6 Modules (native)
- CSS Custom Properties für Theming
- Kommentare erklären "warum", Code erklärt "was"
- **Keine Emojis** - Verwende stattdessen:
  - `[x]` fuer abgeschlossen
  - `[~]` fuer in Arbeit
  - `[ ]` fuer geplant
  - `(green)`, `(yellow)`, `(red)` fuer Statusfarben in Dokumentation
