---
name: "Evaluation hook: provenance export"
about: Export the production, decision and verification layers per transcription run
title: "[antrag-eval] Provenance export for <scope>"
labels: antrag-eval
---

## What this issue is for

Provenance in this tool is spread across a run: the transcription carries the model that produced it, the validation carries rule results and LLM Review, the correction history carries the human edit. This hook asks for one export that carries all three layers, held per run and resolvable per line:

- **production** — how the reading was produced (which provider and model, which prompt and its identity, which settings, local or cloud, and whether the OCR-only path fell back to cloud validation)
- **decision** — which step selected the text that shipped (post-processing stage, applied validation suggestion, transcriber edit)
- **verification** — what checked it and how (deterministic rules, LLM Review, human confirmation), keeping machine and human checks distinguishable

Criterion-independent: the export describes the layers, it derives no quality measure from them.

The instrument level is the point here. What must be reconstructable is the run, so that a transcription can be traced back to the exact configuration that produced it.

## Artefacts this touches

- `docs/js/services/llm.js` — provider and model selection, prompt building, the streaming path
- `docs/js/services/postprocess.js` — the post-processing stages, retries and fallbacks
- `docs/js/services/validation.js` — RuleValidator, LLMValidator, ResultMerger
- `docs/js/services/export.js` — validation metadata already travels with the export
- `knowledge/VALIDATION.md` — the hybrid validation architecture
- `knowledge/DATA-SCHEMA.md` — Validation Result and Correction Entry

## Open before implementation

- Whether provenance is a sidecar record per run or per-segment fields inside the transcription
- Which terms come from PROV-O and EARL before anything new is minted
- How the validation fallback (local transcription, cloud validation) appears as two production facts rather than one
