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
├── METHODOLOGY.md         ← Scientific foundations
├── DESIGN-SYSTEM.md       ← UI/UX specification (incl. UI mockup analysis)
├── ARCHITECTURE.md        ← Technical architecture (incl. event flows)
├── VALIDATION.md          ← Hybrid validation (incl. panel structure)
├── DATA-SCHEMA.md         ← Data structures (incl. table format)
├── REQUIREMENTS.md        ← Feature status, bugs, requirements (NEW)
├── IMPLEMENTATION-PLAN.md ← Roadmap to completion
└── JOURNAL.md             ← Development log
```

## Document Matrix

| Document | Answers | Audience | Dependencies |
|----------|---------|----------|--------------|
| [METHODOLOGY](METHODOLOGY.md) | Why this approach? | Everyone | - |
| [DESIGN-SYSTEM](DESIGN-SYSTEM.md) | How does it look? | UI/Frontend | METHODOLOGY |
| [ARCHITECTURE](ARCHITECTURE.md) | How is it built? | Development | METHODOLOGY |
| [VALIDATION](VALIDATION.md) | How is it verified? | Development | METHODOLOGY, ARCHITECTURE |
| [DATA-SCHEMA](DATA-SCHEMA.md) | What data? | Development | ARCHITECTURE |
| [REQUIREMENTS](REQUIREMENTS.md) | What is done/open? | Development | ARCHITECTURE |
| [IMPLEMENTATION-PLAN](IMPLEMENTATION-PLAN.md) | What comes next? | Development | ARCHITECTURE |
| [JOURNAL](JOURNAL.md) | What was done? | Everyone | - |

## Core Concepts (Quick Reference)

| Concept | Definition | Document |
|---------|------------|----------|
| Critical Expert in the Loop | Human validates, machine assists | METHODOLOGY |
| Categorical Confidence | confident/uncertain/problematic instead of 0-100% | METHODOLOGY |
| Hybrid Validation | Deterministic + LLM-Judge combined | VALIDATION |
| Perspectives | Paleographic, Linguistic, Structural, Domain | VALIDATION |
| Promptotyping | Iterative development through AI dialogue | METHODOLOGY |
| Triple Synchronization | Viewer ↔ Transcription ↔ Validation | ARCHITECTURE |
| Tabular Transcription | Structured fields instead of free text | DATA-SCHEMA |

## UI Components (Quick Reference)

| Component | Description | Document |
|-----------|-------------|----------|
| Document Viewer | Image + Bounding Boxes + Zoom | DESIGN-SYSTEM |
| Transcription Table | Columns: #, DATE, NAME, DESCRIPTION, AMOUNT | DESIGN-SYSTEM |
| Validation Panel | Rule-Based + AI Assistant sections | VALIDATION |
| Status Bar | Model, Perspective, Status, Timestamp | DESIGN-SYSTEM |
| Inline Markers | [?], [illegible], ... | DESIGN-SYSTEM |

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
