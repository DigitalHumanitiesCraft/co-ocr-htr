---
type: knowledge
created: 2026-01-16
updated: 2026-02-03
tags: [coocr-htr, methodology, llm-bias, script-coverage]
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

For detailed model comparison and current recommendations, see [MODEL-LANDSCAPE](MODEL-LANDSCAPE.md).

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

**External validation (2026-02):** Community feedback from Digital Humanities practitioners confirms:
- Gemini 3 Pro leads closed models significantly for HTR
- DeepSeek OCR 2 "works okay for simple layouts" but struggles with complex documents
- Layout analysis as a separate step improves accuracy substantially
- LightOnOCR-2 currently state-of-the-art for open source OCR

See [MODEL-LANDSCAPE](MODEL-LANDSCAPE.md) for detailed comparison.

### Language and Script Coverage

| Status | Scripts | Notes |
|--------|---------|-------|
| Tested | Latin (German, English) | 16th-20th century historical documents |
| Tested | Arabic (RTL) | Historical magazines via IIIF, RTL support implemented |
| Untested | Hebrew, CJK, Cyrillic, Greek | Community testing welcome |

**Arabic Test Corpus (2026-02):**
- Source: Internet Archive IIIF
- Document: Historical Arabic Magazines (1937)
- Manifest: `https://iiif.archive.org/iiif/Historical-magazines/manifest.json`
- Available as demo in coOCR/HTR sample menu
- **Test Result:** RTL rendering works, Gemini 3 Flash achieves high confidence on printed Arabic

**Training bias:** Current VLMs are trained primarily on Western/Latin texts. Recognition quality for non-Latin scripts is expected to vary significantly. This reflects broader biases in AI training data ("linguistic imperialism").

**Mitigation options:**
- Ollama integration allows connecting specialized models trained on specific scripts
- Multi-model comparison can reveal script-specific weaknesses
- Community contributions of test material for diverse scripts are encouraged

**Testing approach:** Arabic documents serve as first non-Latin test case. Results will inform expectations for other RTL and non-Latin scripts.

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

## Terminology: Human-AI Collaboration

**Central principle:** The expert leads, the AI assists.

| Term | Meaning | Usage |
|------|---------|-------|
| Expert-in-the-Loop | The human expert is at the center of the workflow | Preferred term for coOCR/HTR |
| Editor-in-the-Loop | Synonym emphasizing the editing/correction task | README tagline |
| Human-in-the-Loop | System-centered framing (human validates system output) | Avoid - implies AI leads |
| AI-assisted | Broad term, can be ambiguous about who leads | Use with care |

**Why this matters:** The framing of human-AI collaboration affects how users perceive their role. "Integrating experts into AI pipelines" positions the human as a component of the system. "Expert-led workflow with AI assistance" positions the human as the decision-maker using AI as a tool.

### The Functional Triad: A Taxonomy

BJ Fogg's "Functional Triad" from Persuasive Technology (Captology) provides a useful framework for understanding computer roles. With some adaptation, this maps onto established Human-Computer Interaction paradigms:

| Fogg's Triad | Computer as... | HCI Paradigm | Established Acronyms |
|--------------|----------------|--------------|----------------------|
| **Tool** | Amplifier of human capability | Computer-**Aided** | CAD, CAM, CAT, CALL |
| **Medium** | Facilitator of human collaboration | Computer-**Supported** | CSCW, CSCL |
| **Social Actor** | Autonomous agent | Computer-**Generated** | GenAI, CGI |

**Paradigm definitions:**

| Paradigm | Human-Computer Relationship | Examples |
|----------|----------------------------|----------|
| Computer-Aided/Assisted (CA*) | Human steers, computer assists | CAD (Design), CAM (Manufacturing), CAT (Translation), CALL (Language Learning) |
| Computer-Supported (CS*) | Human collaborates, computer mediates | CSCW (Cooperative Work), CSCL (Collaborative Learning) |
| Computer-Generated (CG/GenAI) | Computer generates, human curates | GenAI (text, images), CGI (visual effects) |

### coOCR/HTR: Positioning in the Triad

coOCR/HTR deliberately positions itself in the **Computer-Aided** paradigm while using GenAI technology:

```
┌─────────────────────────────────────────────────────────────┐
│              Computer-Generated (GenAI)                      │
│              "Computer produces content"                     │
│                           │                                  │
│                           ▼                                  │
│    ┌─────────────────────────────────────────────┐          │
│    │         coOCR/HTR: Hybrid Approach          │          │
│    │                                             │          │
│    │   GenAI produces draft (transcription) ──┐  │          │
│    │                                          │  │          │
│    │   Expert validates, corrects, decides ◄──┘  │          │
│    │              │                              │          │
│    │              ▼                              │          │
│    │   Final result = human responsibility      │          │
│    └─────────────────────────────────────────────┘          │
│                           │                                  │
│                           ▼                                  │
│              Computer-Aided (Tool)                           │
│              "Human steers"                                  │
└─────────────────────────────────────────────────────────────┘
```

**Key insight:** We deliberately "downgrade" GenAI to the Tool role - not because it is less capable, but because the human bears responsibility for the result. The AI generates, but the expert authors.

### Design Implications

| Principle | Implementation in coOCR/HTR |
|-----------|----------------------------|
| Human as author | Expert corrects and approves every transcription |
| AI as tool | LLM provides draft, validation hints - never final output |
| Transparency | Clear distinction between AI-generated and human-edited |
| Control | Abort, undo, override at every step |
| Accountability | Export includes provenance (model, corrections, timestamp) |

**Reference:** Fogg, B.J. (2003). *Persuasive Technology: Using Computers to Change What We Think and Do*. Chapter 2: The Functional Triad.

---

**Sources:** Promptotyping methodology, Critical Expert in the Loop, LLM-Judge bias research, Vision-Language Models, Document AI, Shneiderman (Visual Information Seeking).
