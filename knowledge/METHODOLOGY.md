---
type: knowledge
created: 2026-01-16
updated: 2026-02-05
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

**Knowledge Hierarchy (AIL-ML Framework):** Research on Agent-in-the-Loop ML confirms a clear capability ordering: General Users < LLMs < Domain Experts. LLMs possess general knowledge plus their training corpus, but lack the specialized expert knowledge that domain specialists bring. This epistemic asymmetry is why coOCR/HTR positions the expert as final authority - the LLM generates, the expert authors.

## LLM-Judge Bias

Empirical evidence against numerical confidence values:

| Bias Type | Effect | Measurement |
|-----------|--------|-------------|
| Position Bias | Preference for certain input positions | Significant variation; >80% of evaluations affected |
| Verbosity Bias | Longer outputs rated higher | Systematic preference, varies by model |
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

### Direct Manipulation (Shneiderman 1983)

Core principles for interactive editors:

| Principle | coOCR/HTR Implementation |
|-----------|-------------------------|
| Visible objects | Transcription text directly editable in place |
| Rapid, reversible actions | Immediate updates, undo available |
| Incremental feedback | Validation runs on each change |
| Replace command syntax | Click to edit, no markup language required |

**Design goal:** Users work directly with their transcription, not with an abstraction layer.

### Gulfs of Execution & Evaluation (Norman 1986)

Two gaps that interface design must bridge:

| Gulf | Question | coOCR/HTR Solution |
|------|----------|-------------------|
| Execution | "How do I do what I want?" | Clear affordances, minimal UI |
| Evaluation | "What happened? Did it work?" | Visual feedback, validation status |

**Design goal:** Minimize cognitive load. The interface should feel obvious.

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

BJ Fogg's "Functional Triad" from Persuasive Technology (Captology) provides a framework for understanding computer roles. With adaptation for coOCR/HTR, this maps onto established Human-Computer Interaction paradigms:

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

## Sources

### Promptotyping & Expert-in-the-Loop
- Promptotyping methodology: https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin
- Related: Prompt-based Prototyping in Collaborative Teams (CHI 2025): https://dl.acm.org/doi/10.1145/3706598.3713166
- Expert in the Loop: https://link.springer.com/article/10.1007/s10462-025-11255-1

### LLM-Judge Bias Research
- Position Bias (ACL 2025): https://aclanthology.org/2025.ijcnlp-long.18/
- Self-Preference Bias (NeurIPS 2024): https://proceedings.neurips.cc/paper_files/paper/2024/file/7f1f0218e45f5414c79c0679633e47bc-Paper-Conference.pdf
- Self-Preference Bias (arXiv): https://arxiv.org/abs/2410.21819
- Verbosity Bias: https://openreview.net/pdf?id=magEgFpK1y
- Semantic Perturbation: https://www.mdpi.com/2078-2489/16/8/652
- LLM Calibration Survey (ACL 2024): https://aclanthology.org/2024.naacl-long.366/

### Vision-Language Models
- VLM Architecture (IBM): https://www.ibm.com/think/topics/vision-language-models
- VLM Architectures Collection: https://github.com/gokayfem/awesome-vlm-architectures
- FastVLM (Apple): https://machinelearning.apple.com/research/fast-vision-language-models
- Emergent OCR (ChatVLA-2): https://arxiv.org/html/2505.21906v2
- VLMs Explained (Hugging Face): https://huggingface.co/blog/vlms

### Interface Design Theory
- Direct Manipulation (Shneiderman 1983): https://www.cs.umd.edu/~ben/papers/Shneiderman1983Direct.pdf
- Gulfs of Execution/Evaluation (Norman 1986): https://www.nngroup.com/articles/two-ux-gulfs-evaluation-execution/

### Functional Triad
- Fogg, B.J. (2003) Persuasive Technology: https://books.google.com/books/about/Persuasive_Technology.html?id=r9JIkNjjTfEC
- Functional Triad Chapter: https://www.globalspec.com/reference/33525/203279/chapter-2-the-functional-triad-computers-in-persuasive-roles
- Captology in the Age of AI: https://law.stanford.edu/2023/05/21/the-power-of-persuasion-captology-in-the-age-of-ai-and-quantum-computing/
