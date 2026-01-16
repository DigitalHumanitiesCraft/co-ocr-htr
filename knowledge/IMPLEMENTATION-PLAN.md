---
type: knowledge
created: 2026-01-16
updated: 2026-01-16
tags: [coocr-htr, roadmap, milestones]
status: active
---

# Implementation Plan

**Status:** Phase 2.3 - UI State Management
**Live Demo:** [dhcraft.org/co-ocr-htr](http://dhcraft.org/co-ocr-htr)

---

## Phase 1: Core Application ✅ COMPLETE

| Feature | Status | Location |
|---------|--------|----------|
| 3-Column Layout | ✅ | `index.html` |
| Design System (8 CSS files) | ✅ | `css/*.css` |
| Central State (EventTarget) | ✅ | `js/state.js` |
| Document Viewer + SVG Regions | ✅ | `js/viewer.js` |
| Pan/Zoom/Fit Controls | ✅ | `js/viewer.js` |
| Transcription Editor (lines/grid) | ✅ | `js/editor.js` |
| Triple Synchronization | ✅ | `js/*.js` |
| LLM Integration (5 providers) | ✅ | `js/services/llm.js` |
| Gemini 3 Optimization | ✅ | `js/services/llm.js` |
| Rule-Based Validation | ✅ | `js/services/validation.js` |
| LLM-Judge Validation | ✅ | `js/services/llm.js` |
| Export (TXT/JSON/MD) | ✅ | `js/services/export.js` |
| PAGE-XML Import | ✅ | `js/services/parsers/page-xml.js` |
| METS-XML Parser | ✅ | `js/services/parsers/mets-xml.js` |
| Demo Loader | ✅ | `js/services/samples.js` |
| Guided Workflow | ✅ | `js/main.js` |
| Inline Editing + Undo/Redo | ✅ | `js/editor.js` |
| Settings + Help Dialogs | ✅ | `js/components/dialogs.js` |
| Logo Integration | ✅ | `assets/logo*.png` |
| GitHub Pages Deployment | ✅ | dhcraft.org/co-ocr-htr |

---

## Phase 2: Multi-Page & Documentation 🔄 IN PROGRESS

### 2.1 Unterseiten ✅ COMPLETE

| Task | Status | File |
|------|--------|------|
| `help.html` erstellen | ✅ | `docs/help.html` |
| `about.html` erstellen | ✅ | `docs/about.html` |
| `knowledge.html` erstellen | ✅ | `docs/knowledge.html` |
| `pages.css` Shared Styles | ✅ | `docs/css/pages.css` |
| Header-Links (Help/About/Knowledge) | ✅ | `docs/index.html` |
| Scroll-Fix für Unterseiten | ✅ | `docs/css/pages.css` |

### 2.2 Multi-Page Navigation ✅ COMPLETE

| Task | Status | File |
|------|--------|------|
| State erweitern (pages[], currentPageIndex) | ✅ | `js/state.js` |
| Per-Page Transcriptions (pageTranscriptions) | ✅ | `js/state.js` |
| Page Navigation UI | ✅ | `index.html`, `js/viewer.js` |
| Samples Service Multi-Page | ✅ | `js/services/samples.js` |
| Keyboard: ←/→ Navigation | ✅ | `js/viewer.js` |
| Multi-Page Demo (Wecker 6 Seiten) | ✅ | `samples/wecker/` |

**UI-Element:**
```
◀ Prev │ Page 3 / 6 │ Next ▶
```

### 2.3 UI State Management ⏳ IN PROGRESS

**Problem:** Initial State zeigt falsches UI
- Editor zeigt leere Tabelle statt Empty State ✅ FIXED
- Viewer zeigt nicht den Empty State ✅ FIXED
- Validation wird immer angezeigt ⏳

| Task | Status | File |
|------|--------|------|
| Editor: Empty State bei leerer Transkription | ✅ | `js/editor.js` |
| Viewer: Initial Empty State | ✅ | `js/viewer.js` |
| Validation: Conditional Display | ⏳ | `js/components/validation.js` |
| Validation: Kompakteres Layout | ⏳ | `css/validation.css` |
| Validation: Gruppierte, ausklappbare Items | ⏳ | `js/components/validation.js` |

**Idealer Zustand beim Start:**

| Panel | Ohne Dokument | Mit Dokument | Mit Transkription |
|-------|---------------|--------------|-------------------|
| Viewer | Empty: "Drop files" | Bild angezeigt | Bild + Regions |
| Editor | Empty: "Keine Transkription" | Empty State | Tabelle mit Text |
| Validation | Collapsed/Hidden | Hidden | Visible mit Ergebnissen |

**Validation Panel Anforderungen:**
1. Nur sichtbar wenn Dokument UND Transkription vorhanden
2. Rule-Based + AI Assistant immer beide sichtbar (kompakt)
3. Innerer Scroll für lange Listen
4. Gruppierte Validierungen nach Kategorie
5. Ausklappbare Detail-Ansicht

### 2.4 Demo-Daten ✅ COMPLETE

| Sample | Typ | Seiten | Status |
|--------|-----|--------|--------|
| Wecker Antidotarium | Multi-Page | 6 | ✅ |
| Wecker Single Page | Single | 1 | ✅ |
| Raitbuch | Single | 1 | ✅ |
| HSA Brief | Single | 1 | ✅ |
| Karteikarte | Single | 1 | ✅ |

---

## Phase 3: Batch-Processing 📋 PLANNED

| Task | Status | Beschreibung |
|------|--------|--------------|
| Batch-Transkription | 📋 | Alle Seiten automatisch transkribieren |
| Progress-Anzeige | 📋 | "Page 5/83 transcribed..." |
| Batch-Export | 📋 | Alle Seiten als ZIP exportieren |
| Validierung pro Seite | 📋 | Validierungsstatus pro Seite anzeigen |

---

## Phase 4: Polish & Release 📋 PLANNED

| Task | Status | Beschreibung |
|------|--------|--------------|
| PAGE-XML Export | 📋 | Koordinaten + Text exportieren |
| Vitest Unit Tests | 📋 | Kritische Services testen |
| E2E Test | 📋 | Vollständiger Workflow-Test |
| Performance Audit | 📋 | Lighthouse, große Dokumente |
| README vervollständigen | 📋 | Screenshots, GIF-Demo |

---

## Architektur (aktuell)

```
docs/
├── index.html              # Haupt-App
├── help.html               # ✅ Hilfe-Seite
├── about.html              # ✅ About-Seite
├── knowledge.html          # ✅ Knowledge Base Seite
├── css/
│   ├── variables.css       # Design Tokens
│   ├── base.css            # Reset, Typography
│   ├── layout.css          # Grid, Panels
│   ├── components.css      # Buttons, Inputs
│   ├── dialogs.css         # Modal Dialogs
│   ├── editor.css          # Transcription Editor
│   ├── viewer.css          # Document Viewer
│   ├── validation.css      # Validation Panel
│   └── pages.css           # ✅ Shared für Unterseiten
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
│   ├── wecker/             # ✅ 6 Seiten + PAGE-XML
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
| ✅ | Abgeschlossen |
| ⏳ | In Arbeit |
| 📋 | Geplant |

---

**Referenzen:**
- [ARCHITECTURE](ARCHITECTURE.md) - Technische Details
- [VALIDATION](VALIDATION.md) - Validierungsregeln
- [DATA-SCHEMA](DATA-SCHEMA.md) - Datenstrukturen
- [JOURNAL](JOURNAL.md) - Entwicklungshistorie
