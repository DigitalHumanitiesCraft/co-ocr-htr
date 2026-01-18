---
type: knowledge
created: 2026-01-16
updated: 2026-01-16
tags: [coocr-htr, roadmap, milestones]
status: active
---

# Implementation Plan

**Status:** Phase 4 - Polish & Release (Bug Fixes [x] Complete)
**Live Demo:** [dhcraft.org/co-ocr-htr](http://dhcraft.org/co-ocr-htr)

---

## Phase 1: Core Application [x] COMPLETE

| Feature | Status | Location |
|---------|--------|----------|
| 3-Column Layout | [x] | `index.html` |
| Design System (8 CSS files) | [x] | `css/*.css` |
| Central State (EventTarget) | [x] | `js/state.js` |
| Document Viewer + SVG Regions | [x] | `js/viewer.js` |
| Pan/Zoom/Fit Controls | [x] | `js/viewer.js` |
| Transcription Editor (lines/grid) | [x] | `js/editor.js` |
| Triple Synchronization | [x] | `js/*.js` |
| LLM Integration (5 providers) | [x] | `js/services/llm.js` |
| Gemini 3 Optimization | [x] | `js/services/llm.js` |
| Rule-Based Validation | [x] | `js/services/validation.js` |
| LLM-Judge Validation | [x] | `js/services/llm.js` |
| Export (TXT/JSON/MD) | [x] | `js/services/export.js` |
| PAGE-XML Import | [x] | `js/services/parsers/page-xml.js` |
| METS-XML Parser | [x] | `js/services/parsers/mets-xml.js` |
| Demo Loader | [x] | `js/services/samples.js` |
| Guided Workflow | [x] | `js/main.js` |
| Inline Editing + Undo/Redo | [x] | `js/editor.js` |
| Settings + Help Dialogs | [x] | `js/components/dialogs.js` |
| Logo Integration | [x] | `assets/logo*.png` |
| GitHub Pages Deployment | [x] | dhcraft.org/co-ocr-htr |

---

## Phase 2: Multi-Page & Documentation [x] COMPLETE

### 2.1 Unterseiten [x] COMPLETE

| Task | Status | File |
|------|--------|------|
| `help.html` erstellen | [x] | `docs/help.html` |
| `about.html` erstellen | [x] | `docs/about.html` |
| `knowledge.html` erstellen | [x] | `docs/knowledge.html` |
| `pages.css` Shared Styles | [x] | `docs/css/pages.css` |
| Header-Links (Help/About/Knowledge) | [x] | `docs/index.html` |
| Scroll-Fix für Unterseiten | [x] | `docs/css/pages.css` |

### 2.2 Multi-Page Navigation [x] COMPLETE

| Task | Status | File |
|------|--------|------|
| State erweitern (pages[], currentPageIndex) | [x] | `js/state.js` |
| Per-Page Transcriptions (pageTranscriptions) | [x] | `js/state.js` |
| Page Navigation UI | [x] | `index.html`, `js/viewer.js` |
| Samples Service Multi-Page | [x] | `js/services/samples.js` |
| Keyboard: ←/→ Navigation | [x] | `js/viewer.js` |
| Multi-Page Demo (Wecker 6 Seiten) | [x] | `samples/wecker/` |

**UI-Element:**
```
◀ Prev │ Page 3 / 6 │ Next ▶
```

### 2.3 UI State Management [x] COMPLETE

**Problem:** Initial State zeigt falsches UI
- Editor zeigt leere Tabelle statt Empty State [x] FIXED
- Viewer zeigt nicht den Empty State [x] FIXED
- Drag & Drop Empty State [x] FIXED (z-index)

| Task | Status | File |
|------|--------|------|
| Editor: Empty State bei leerer Transkription | [x] | `js/editor.js` |
| Viewer: Initial Empty State | [x] | `js/viewer.js` |
| Drag & Drop Visibility | [x] | `css/viewer.css` (z-index fix) |

### 2.4 Bug Fixes [x] COMPLETE

| Bug | Lösung | Status |
|-----|--------|--------|
| Transkription nicht sichtbar | Pseudo-Regionen in `state.js` | [x] |
| PAGE-XML Wortfragmente | `extractLineText()` + Word-Fallback | [x] |
| Tabellen-Prompt für Briefe | Dual-Prompts + UI-Selector | [x] |
| Validation initial sichtbar | Conditional display | [x] |

### 2.4 Demo-Daten [x] COMPLETE

| Sample | Typ | Seiten | Status |
|--------|-----|--------|--------|
| Wecker Antidotarium | Multi-Page | 6 | [x] |
| Wecker Single Page | Single | 1 | [x] |
| Raitbuch | Single | 1 | [x] |
| HSA Brief | Single | 1 | [x] |
| Karteikarte | Single | 1 | [x] |

---

## Phase 3: Batch-Processing [ ] PLANNED

| Task | Status | Beschreibung |
|------|--------|--------------|
| Batch-Transkription | [ ] | Alle Seiten automatisch transkribieren |
| Progress-Anzeige | [ ] | "Page 5/83 transcribed..." |
| Batch-Export | [ ] | Alle Seiten als ZIP exportieren |
| Validierung pro Seite | [ ] | Validierungsstatus pro Seite anzeigen |

---

## Phase 4: Polish & Release [~] IN PROGRESS

| Task | Status | Beschreibung |
|------|--------|--------------|
| PAGE-XML Export | [x] | PAGE 2019-07-15 Schema |
| Vitest Unit Tests | [x] | 118 Tests (export, validation, llm, page-xml) |
| E2E Test | [ ] | Vollständiger Workflow-Test |
| Performance Audit | [ ] | Lighthouse, große Dokumente |
| README vervollständigen | [ ] | Screenshots, GIF-Demo |

---

## Architektur (aktuell)

```
docs/
├── index.html              # Haupt-App
├── help.html               # [x] Hilfe-Seite
├── about.html              # [x] About-Seite
├── knowledge.html          # [x] Knowledge Base Seite
├── css/
│   ├── variables.css       # Design Tokens
│   ├── base.css            # Reset, Typography
│   ├── layout.css          # Grid, Panels
│   ├── components.css      # Buttons, Inputs
│   ├── dialogs.css         # Modal Dialogs
│   ├── editor.css          # Transcription Editor
│   ├── viewer.css          # Document Viewer
│   ├── validation.css      # Validation Panel
│   └── pages.css           # [x] Shared für Unterseiten
├── js/
│   ├── main.js             # Entry Point
│   ├── state.js            # Central State + Multi-Page
│   ├── viewer.js           # Pan/Zoom/Fit/Regions + Page Nav
│   ├── editor.js           # Lines/Grid Editor
│   ├── ui.js               # UI Interactions
│   ├── components/
│   │   ├── dialogs.js
│   │   ├── upload.js
│   │   ├── transcription.js
│   │   └── validation.js
│   └── services/
│       ├── llm.js          # 5 Provider + Gemini 3
│       ├── storage.js
│       ├── validation.js
│       ├── export.js
│       ├── samples.js      # Multi-Page Support
│       └── parsers/
│           ├── page-xml.js
│           └── mets-xml.js
├── samples/
│   ├── index.json          # 5 Samples (1 Multi-Page)
│   ├── raitbuch/
│   ├── wecker/             # [x] 6 Seiten + PAGE-XML
│   ├── hsa-letter/
│   └── karteikarte/
└── assets/
    ├── logo.png
    └── logo-icon.png
```

---

## Legende

| Symbol | Bedeutung |
|--------|-----------|
| [x] | Abgeschlossen |
| [~] | In Arbeit |
| [ ] | Geplant |

---

**Referenzen:**
- [ARCHITECTURE](ARCHITECTURE.md) - Technische Details
- [VALIDATION](VALIDATION.md) - Validierungsregeln
- [DATA-SCHEMA](DATA-SCHEMA.md) - Datenstrukturen
- [JOURNAL](JOURNAL.md) - Entwicklungshistorie
