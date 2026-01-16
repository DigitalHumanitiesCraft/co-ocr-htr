# CLAUDE.md

Projektkontext für Claude Code.

## Technologie-Stack

| Komponente | Technologie |
|------------|-------------|
| Runtime | Vanilla JavaScript (ES6+) |
| Dependencies | Keine |
| Storage | LocalStorage, IndexedDB |
| API | Fetch API (Gemini, OpenAI, Anthropic) |
| UI | Plain HTML/CSS, Dark Mode |

## Projektstruktur

```
coocr-htr/
├── README.md           # Projekübersicht (englisch)
├── CLAUDE.md           # Dieses Dokument
├── knowledge/          # Konsolidierte Wissensbasis
│   ├── INDEX.md        # Navigation, Dokumentenmatrix
│   ├── METHODOLOGY.md  # Wissenschaftliche Grundlagen
│   ├── DESIGN-SYSTEM.md# UI/UX-Spezifikation
│   ├── ARCHITECTURE.md # Technische Architektur
│   ├── VALIDATION.md   # Hybride Validierung
│   ├── DATA-SCHEMA.md  # Datenstrukturen
│   └── JOURNAL.md      # Entwicklungslog
└── src/
    └── index.html      # Funktionierender Prototyp
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
