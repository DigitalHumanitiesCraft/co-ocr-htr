---
name: "Evaluation hook: four-tuple protocol export"
about: Export correction episodes as the four-tuple the verification proposal evaluates on
title: "[antrag-eval] Four-tuple protocol export for <scope>"
labels: antrag-eval
---

## What this issue is for

The correction history already records per line what the machine produced and what the transcriber left standing (`original`, `corrected`, `timestamp`). This hook asks for an export that turns those episodes into the four-tuple the evaluation reads:

1. initial expert judgment (what the transcriber held before seeing the machine reading, where the surface can capture it)
2. AI suggestion (the machine reading with the production provenance of the run that produced it)
3. final decision (the text the line carries after the episode)
4. reference answer, where one exists for the line

Criterion-independent: the export carries the tuple, no score, no rate, no ranking derived from it.

The hybrid validation enters the tuple as machine evidence attached to the suggestion. A rule hit or an LLM Review verdict is a pre-check subordinated to the human check; the final decision stays the transcriber's.

## Artefacts this touches

- `docs/js/state.js` — `corrections` entries and the transcription segments they revise
- `docs/js/services/export.js` — the export surface a protocol format attaches to (TXT, JSON, MD, PAGE-XML, TEI-XML)
- `docs/js/services/llm.js` — provider, model and prompt identity of the producing run
- `knowledge/DATA-SCHEMA.md` — Correction Entry and the Transcription schema around it
- `knowledge/METHODOLOGY.md` — Expert-in-the-Loop, the machine assists and the human decides

## Open before implementation

- Whether an initial expert judgment can be captured without turning the correction surface into an experiment
- Where a tuple with no reference answer is marked as such rather than left empty
- How a line accepted unchanged is distinguished from a line never looked at, given that neither writes a correction entry
