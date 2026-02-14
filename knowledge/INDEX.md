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
├── TESTING.md             ← Testing strategy (574 tests)
├── IMPLEMENTATION-PLAN.md ← Roadmap (Phase 1-6 complete)
└── JOURNAL.md             ← Development log
```

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
| [IMPLEMENTATION-PLAN](IMPLEMENTATION-PLAN.md) | Project roadmap | Development | ARCHITECTURE |
| [JOURNAL](JOURNAL.md) | What was done? | Everyone | - |
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
| Prompt Profiles | 3-stage prompt profiles for document scenarios | ARCHITECTURE |
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

## Version History

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-01-16 | Initial consolidation from docs/ and new_knowledge/ |
| 1.1 | 2026-01-16 | UI mockup analysis integrated: triple sync, table structure, panel layout |
| 1.2 | 2026-01-16 | Prototype v2 analysis: AppState with EventTarget, modular JS architecture, IMPLEMENTATION-PLAN.md |
| 1.3 | 2026-01-16 | Translated to English |
| 1.4 | 2026-01-16 | Added REQUIREMENTS.md with feature status, bugs, and requirements |
| 1.5 | 2026-01-18 | Added IIIF Integration, OpenSeadragon viewer, IIIF Dialog |
| 1.6 | 2026-02-03 | Added VISION.md with project goals and success criteria |
| 1.7 | 2026-02-03 | Added MODEL-LANDSCAPE.md with OCR/HTR model comparison and external validation |
| 1.8 | 2026-02-03 | Simplified validation: removed perspectives, added custom prompt option |
| 1.9 | 2026-02-04 | Added validation fallback for OCR-only models, hybrid OCR workflow |
| 2.0 | 2026-02-04 | Phase 3 complete: Batch processing, page status indicators, ZIP export |
| 2.1 | 2026-02-04 | Phase 5 planned: i18n (German/English UI) with ~400 strings |
| 2.2 | 2026-02-14 | Adoption context: ZBZ as institutional fork, Open Development, Mistral OCR 3 |
| 2.3 | 2026-02-14 | Phase 5-6 complete: i18n, Project Rules, Azure Mistral, Welcome Overlay, Markdown Rules Editor. 574 tests. |
