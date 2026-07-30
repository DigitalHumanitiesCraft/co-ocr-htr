---
name: "Evaluation hook: gold-standard hook"
about: Attach reference transcriptions with a required checking depth per item class
title: "[antrag-eval] Gold-standard hook for <item class>"
labels: antrag-eval
---

## What this issue is for

A transcription the expert has approved is the reference the tool produces. This hook asks for the attachment point that lets a reference reading be bound to a page or a line together with the checking depth that item class requires, fixed in advance rather than chosen per case:

- the reference reading per line or region, with its source (published edition, PAGE-XML from Transkribus, expert transcription)
- the item class it belongs to (prose line, grid cell, marginal addition, uncertain reading, illegible passage, and so on)
- the required checking depth for that class, declared before the checking starts

Criterion-independent: the hook stores reference and required depth, it computes no agreement figure.

## Artefacts this touches

- `docs/samples/` — the sample documents that already pair image and PAGE-XML
- `docs/js/services/parsers/page-xml.js` — the import path a reference transcription arrives through
- `docs/js/services/storage.js` — projects and sessions, where a bound reference would persist
- `knowledge/TESTING.md` — the existing test corpus and what it covers
- `knowledge/VALIDATION.md` — the rule classes the item classes build on

## Open before implementation

- Whether the reference lives with the sample corpus, with the project store, or in its own file
- How line-level and region-level references stay comparable when the layout segmentation of the run differs from the reference's
