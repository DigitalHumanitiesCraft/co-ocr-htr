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

## Non-Goals

- Not a replacement for specialized HTR models (Transkribus, eScriptorium)
- No batch processing of large corpora (focus: single document correction)
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
