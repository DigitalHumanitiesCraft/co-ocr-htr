---
type: knowledge
created: 2026-02-03
tags: [coocr-htr, vision, goals]
status: active
---

# Project Vision

## Mission Statement

**coOCR/HTR is a browser-based tool that helps domain experts verify, validate, and correct OCR/HTR results.**

## Core Problem

Standard OCR/HTR pipelines often produce erroneous results on historical documents:
- Unusual script forms (Kurrent, Fraktur, historical handwriting)
- Complex layouts (tables, marginalia, strikethroughs)
- Domain-specific vocabulary (technical terms, historical concepts)

These errors require **human expertise** to correct - but existing tools are often:
- Complex and difficult to use
- Not optimized for the correction workflow
- Without AI support for difficult passages

## Solution

coOCR/HTR positions itself as an **Editor-in-the-Loop tool**:

```
┌─────────────────────────────────────────────────────────────────┐
│                        WORKFLOW                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   [Image/PAGE-XML]  ──►  [coOCR/HTR]  ──►  [Correct OCR/HTR]    │
│                              │                                   │
│                              ▼                                   │
│                     ┌─────────────────┐                         │
│                     │ Expert          │                         │
│                     │ - verifies      │                         │
│                     │ - validates     │                         │
│                     │ - corrects      │                         │
│                     └─────────────────┘                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Two Input Modes

| Mode | Input | Use Case |
|------|-------|----------|
| **Generate OCR** | Upload image | Document has no transcription yet |
| **Correct OCR** | Upload PAGE-XML | Transcription exists (e.g., from Transkribus) |

### AI Support

- **LLM Transcription**: For difficult documents where standard OCR fails
- **Hybrid Validation**: Deterministic rules + AI judge for quality assessment
- **Visual Interface**: Synchronized view of image, text, and validation

## Target Audience

| User | Need |
|------|------|
| Digital Humanists | OCR correction for edition projects |
| Archivists | Fast transcription of holdings |
| Historians | Source access with AI support |
| Citizen Scientists | Accessible transcription work |

## Success Criteria

**The product is complete when:**

1. **Self-explanatory**: Someone unfamiliar with the tool can use it without instructions
2. **Complete Workflow**:
   - Upload own documents (image OR PAGE-XML)
   - Generate OCR or edit existing transcription
   - Validate and correct
   - Export in usable format (PAGE-XML, TXT, JSON)
3. **Workflow Integration**: Output can be used in other processes
4. **Quality Assurance**: "Good, correct OCR/HTR comes out the other side"

## Adoption & Open Development

coOCR/HTR is positioned as an **open-developed, community-driven tool**. The development model follows an Open Development approach: the codebase is public, contributions are welcome, and institutional forks are explicitly encouraged.

### Institutional Adoption

| Institution | Context | Status |
|-------------|---------|--------|
| ZBZ (Zentralbibliothek Zürich) | Jeanne Hersch Edition, 289 documents | Fork planned (GitLab Uni Zürich, Podman) |
| ÖAW (Klugseder) | Medieval music manuscripts | Fork exists (reference implementation) |

The ZBZ plans to fork co-ocr-htr for their OCR/TEI pipeline (see [zbz-ocr-tei](https://github.com/DigitalHumanitiesCraft/zbz-ocr-tei)). Their deployment uses Podman (daemonless Docker alternative) on institutional infrastructure with Azure-based LLM access. This validates the tool's architecture: browser-based, no backend dependencies, configurable API endpoints.

### Community of Experts

The Open Development vision positions domain experts (archivists, philologists, historians) as **peer reviewers of LLM output** — not just users, but co-developers of quality standards. Each institutional fork can contribute validation rules, prompts, and domain knowledge back to the main project.

## Non-Goals

- Not a replacement for specialized HTR models (Transkribus, eScriptorium)
- No training tool for custom models

## Current Status

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1: Core Application | [x] | LLM integration, Viewer, Editor, Validation |
| Phase 2: Multi-Page & Docs | [x] | Page navigation, Help/About Pages |
| Phase 3: Batch Processing | [x] | Transcribe/validate all pages automatically |
| Phase 4: Polish & Release | [x] | Tests, PAGE-XML Export, UI refinements |

**Live Demo:** [dhcraft.org/co-ocr-htr](http://dhcraft.org/co-ocr-htr)

## Design Principles

| Principle | Meaning |
|-----------|---------|
| **Expert-in-the-Loop** | Machine assists, human decides |
| **Categorical Confidence** | confident/uncertain/problematic instead of 0-100% |
| **Constructive UI** | Helps with work, doesn't get in the way |
| **Workflow Tool** | Input in, correct output out |
| **Zero Dependencies** | Runs in browser, no installation |

---

**References:**
- [METHODOLOGY](METHODOLOGY.md) - Scientific foundations
- [IMPLEMENTATION-PLAN](IMPLEMENTATION-PLAN.md) - Technical roadmap
- [ARCHITECTURE](ARCHITECTURE.md) - System architecture

---

*Updated: 2026-02-14*
