---
type: knowledge
created: 2026-01-16
tags: [coocr-htr, methodology, llm-bias]
status: complete
---

# Methodological Foundations

Scientific basis for design decisions in coOCR/HTR.

## Promptotyping

Development methodology in four phases:

| Phase | Activity | coOCR/HTR Application |
|-------|----------|----------------------|
| Preparation | Source analysis, contextualization | Analysis of existing OCR/HTR workflows |
| Exploration | Iterative testing of models/prompts | VLM comparison, prompt optimization |
| Distillation | Consolidation into documentation | This knowledge/ folder |
| Implementation | Translation into code | docs/ implementation |

**Principle:** Documentation before code. Iteration through dialogue. Early validation.

## Critical Expert in the Loop

Three expertise components for OCR/HTR validation:

| Component | Description | Example |
|-----------|-------------|---------|
| Domain Knowledge | Factual correctness from source familiarity | Historical script forms, terminology |
| Technical Model Understanding | LLM characteristics (context, temperature) | Strengths/weaknesses of different VLMs |
| Metacognitive Vigilance | Reflection on blind spots | Alternative readings that nobody noticed |

**Core statement:** Expert knowledge is irreplaceable. The machine assists, the human decides.

## LLM-Judge Bias

Empirical evidence against numerical confidence values:

| Bias Type | Effect | Measurement |
|-----------|--------|-------------|
| Position Bias | Preference for certain input positions | 56-83% variation with position swaps |
| Verbosity Bias | Longer outputs rated higher | +5.5 to +8.2 percentage points |
| Self-Enhancement | Own outputs preferred | GPT-4: 70.5% self-preference |
| Semantic Perturbation | Equivalent variations → different scores | 3-77% performance degradation |

**Calibration limit:** Even optimized methods achieve at most 47% error reduction.

### Consequences for coOCR/HTR

| Decision | Rationale |
|----------|-----------|
| No numerical confidence values | Suggest precision that doesn't exist |
| Categorical gradations | confident / uncertain / problematic |
| Hybrid validation | LLM-Judge + deterministic rules |
| Visual distinction | Rule-based vs. AI-based recognizable |
| Multi-judge option | Ensemble for critical documents |

## Vision-Language Models

### Architecture

```
Vision Encoder (CLIP/SigLIP/ViT)
         ↓
    Projector (Linear/MLP/Q-Former)
         ↓
    LLM Backbone
```

### Emergent OCR/HTR Capability

OCR/HTR was not an explicit training objective. The capability emerges from visual reasoning.

**Consequence:** Table structures are well recognized (visual patterns), unfamiliar letter forms are problematic.

### Document-Specific Limitations

| Problem | Description | Severity |
|---------|-------------|----------|
| Complex Layouts | Column reconstruction, empty cells | Medium |
| Handwriting | Letter-number confusion | High |
| Historical Scripts | Unfamiliar letter forms | High |
| Tables without Lines | Implicit structure | Medium |

**Source dependency:** Modern handwriting (19th c.) works well. Medieval scripts require specialized HTR models.

## Interface Design Theory

### Visual Information Seeking Mantra (Shneiderman)

> "Overview first, zoom and filter, then details on demand."

**coOCR/HTR implementation:** Page overview → Single page → Detail view of an entry

### Coordinated Multiple Views

Image, text, and validation are linked:
- Click on text passage → Image region highlighted
- Click on validation hint → Jump to location

### Progressive Disclosure

- Basic interface for simple corrections
- Advanced options (model comparison, batch, export configuration) on demand

### Analytic Provenance

Traceability of all steps: model, corrections, timestamp.

## Summary: Design Principles

| Principle | Rationale | Reference |
|-----------|-----------|-----------|
| Hybrid Validation | LLM bias, epistemic asymmetry | → [VALIDATION](VALIDATION.md) |
| Categorical Confidence | Position/Verbosity/Self-Enhancement bias | → [DESIGN-SYSTEM](DESIGN-SYSTEM.md) |
| Expert-in-the-Loop | Domain knowledge irreplaceable | → [VALIDATION](VALIDATION.md) |
| Model Diversity | Source-dependent recognition quality | → [ARCHITECTURE](ARCHITECTURE.md) |
| Local Control | Privacy, cost management | → [ARCHITECTURE](ARCHITECTURE.md) |

---

**Sources:** Promptotyping methodology, Critical Expert in the Loop, LLM-Judge bias research, Vision-Language Models, Document AI, Shneiderman (Visual Information Seeking).
