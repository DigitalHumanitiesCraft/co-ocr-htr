---
type: knowledge
created: 2026-01-16
tags: [coocr-htr, navigation, moc]
status: complete
---

# coOCR/HTR Knowledge Base

Central knowledge repository for the coOCR/HTR project. Each document has a defined scope and references related documents.

## Document Structure

```
knowledge/
├── INDEX.md               ← Navigation (this document)
├── VISION.md              ← Project goals & success criteria
├── METHODOLOGY.md         ← Scientific foundations
├── MODEL-LANDSCAPE.md     ← OCR/HTR model comparison
├── DESIGN-SYSTEM.md       ← UI/UX specification
├── ARCHITECTURE.md        ← Technical architecture
├── VALIDATION.md          ← Hybrid validation
├── DATA-SCHEMA.md         ← Data structures
├── HTR-POSTPROCESSING.md   ← Post-processing pipeline
├── IMPROVEMENTS.md        ← Planned improvements
├── SECURITY.md            ← Security considerations
├── TESTING.md             ← Testing strategy (unit and e2e)
├── IMPLEMENTATION-PLAN.md ← Phase record of the original roadmap (complete)
├── JOURNAL.md             ← Development log, opens with `## Open`
└── archive/
    └── JOURNAL-full-2026-02-05.md ← Unabridged journal as of 2026-02-05
```

`knowledge/` is the only place to edit. `docs/` holds no copy of it, which `docs/tests/publication.test.js` checks, so the Pages build contains no knowledge documents. Readers reach the folder in the repository on GitHub, which the about page links.

## Document Matrix

| Document | Answers | Audience | Dependencies |
|----------|---------|----------|--------------|
| [VISION](VISION.md) | What is the goal? | Everyone | - |
| [METHODOLOGY](METHODOLOGY.md) | Why this approach? | Everyone | - |
| [MODEL-LANDSCAPE](MODEL-LANDSCAPE.md) | Which models? | Development | METHODOLOGY |
| [DESIGN-SYSTEM](DESIGN-SYSTEM.md) | How does it look? | UI/Frontend | METHODOLOGY |
| [ARCHITECTURE](ARCHITECTURE.md) | How is it built? | Development | METHODOLOGY |
| [VALIDATION](VALIDATION.md) | How is it verified? | Development | METHODOLOGY, ARCHITECTURE |
| [DATA-SCHEMA](DATA-SCHEMA.md) | What data? | Development | ARCHITECTURE |
| [HTR-POSTPROCESSING](HTR-POSTPROCESSING.md) | How do the paleographic and philological review stages work? | Development | VALIDATION, MODEL-LANDSCAPE |
| [IMPROVEMENTS](IMPROVEMENTS.md) | What is open, and what waits for the operator? | Development | ARCHITECTURE |
| [IMPLEMENTATION-PLAN](IMPLEMENTATION-PLAN.md) | Which roadmap phases were built? | Development | ARCHITECTURE |
| [JOURNAL](JOURNAL.md) | What was done, and what is open? | Everyone | - |
| [SECURITY](SECURITY.md) | How is it secured? | Everyone | ARCHITECTURE |
| [TESTING](TESTING.md) | How is it tested? | Development | ARCHITECTURE |


## Core Concepts (Quick Reference)

| Concept | Definition | Document |
|---------|------------|----------|
| Critical Expert in the Loop | Human validates, machine assists | METHODOLOGY |
| Functional Triad (Fogg) | Tool / Medium / Social Actor → CA* / CS* / GenAI | METHODOLOGY |
| Computer-Aided Paradigm | Human steers, AI assists (CAD, CAT, CALL) | METHODOLOGY |
| Categorical Confidence | confident/uncertain/problematic instead of 0-100% | METHODOLOGY |
| Hybrid Validation | Deterministic validation + LLM Review combined | VALIDATION |
| Custom Validation Prompt | Optional user-defined validation prompt | VALIDATION |
| Promptotyping | Iterative development through AI dialogue | METHODOLOGY |
| Triple Synchronization | Viewer ↔ Transcription ↔ Validation | ARCHITECTURE |
| Tabular Transcription | Structured fields instead of free text | DATA-SCHEMA |
| IIIF Integration | Load images from external repositories | ARCHITECTURE |
| Model Selection | Choose model based on document type | MODEL-LANDSCAPE |
| Agentic Vision | AI investigates images step-by-step | MODEL-LANDSCAPE |
| Validation Fallback | Auto-switch to cloud for OCR-only models | ARCHITECTURE |
| Hybrid OCR Workflow | Local OCR + Cloud validation combined | ARCHITECTURE |
| Batch Processing | Transcribe/validate all pages with abort control | ARCHITECTURE |
| Page Status Indicators | Visual dots showing per-page status | DESIGN-SYSTEM |
| ZIP Export | Export all pages as ZIP archive | ARCHITECTURE |
| Internationalization (i18n) | German/English UI with runtime switching | ARCHITECTURE |
| Project Rules | Per-project transcription/validation rules with Markdown editor | ARCHITECTURE |
| Post-Processing Pipeline | Stage 2 (paleographic) + Stage 3 (philological) review | HTR-POSTPROCESSING |
| Thinking Panel | Display LLM reasoning tokens during operations | ARCHITECTURE |
| Welcome Overlay | First-visit onboarding with workflow overview | ARCHITECTURE |

## UI Components (Quick Reference)

| Component | Description | Document |
|-----------|-------------|----------|
| Document Viewer | OpenSeadragon + SVG Overlay + Zoom | DESIGN-SYSTEM |
| Transcription Editor | Lines/grid editor with undo/redo | DESIGN-SYSTEM |
| Validation Panel | Validation + LLM Review sections | VALIDATION |
| Status Bar | Model, Status, Timestamp | DESIGN-SYSTEM |
| Inline Markers | [?], [illegible], ... | DESIGN-SYSTEM |
| IIIF Dialog | Load manifests from external repositories | ARCHITECTURE |
| Page Strip | Clickable dots for page navigation with status | DESIGN-SYSTEM |
| Batch Progress Panel | Floating panel with progress bar and abort | DESIGN-SYSTEM |
| Thinking Panel | LLM reasoning display during operations | ARCHITECTURE |
| Welcome Overlay | First-visit onboarding dialog | ARCHITECTURE |
| Language Switch | DE/EN toggle in header | ARCHITECTURE |

## Relationships

```
METHODOLOGY ──────────────────────────────────────┐
    │                                             │
    ├──→ DESIGN-SYSTEM                            │
    │        │                                    │
    │        └──→ Color coding for confidence     │
    │                                             │
    ├──→ ARCHITECTURE                             │
    │        │                                    │
    │        ├──→ VALIDATION (ValidationEngine)   │
    │        │                                    │
    │        └──→ DATA-SCHEMA (Transcription)     │
    │                                             │
    └──→ All design decisions justified ←─────────┘
```
