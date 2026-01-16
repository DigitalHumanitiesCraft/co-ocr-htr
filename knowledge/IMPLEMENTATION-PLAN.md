---
type: knowledge
created: 2026-01-16
updated: 2026-01-16
tags: [coocr-htr, roadmap, milestones]
status: active
---

# Implementation Plan

**Status:** Phase 2 in progress
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

### 2.1 Unterseiten (Help & About) ⏳

| Task | Status | File |
|------|--------|------|
| `help.html` erstellen | ⏳ | `docs/help.html` |
| `about.html` erstellen | ⏳ | `docs/about.html` |
| `pages.css` Shared Styles | ⏳ | `docs/css/pages.css` |
| Header-Links aktualisieren | ⏳ | `docs/index.html` |

**Help-Seite Inhalt:**
- Quick Start (3 Schritte)
- Workflow-Erklärung
- Keyboard Shortcuts
- API Key Anleitung
- Troubleshooting/FAQ

**About-Seite Inhalt:**
- Projekt-Beschreibung
- Methodologie (Critical Expert in the Loop)
- Technologie-Stack
- Credits/Team
- Lizenz
- Links (GitHub, Knowledge Base)

### 2.2 Multi-Page Navigation ⏳

| Task | Status | File |
|------|--------|------|
| State erweitern (pages[], currentPageIndex) | ⏳ | `js/state.js` |
| Page Navigation UI | ⏳ | `index.html`, `js/viewer.js` |
| Page Navigation CSS | ⏳ | `css/viewer.css` |
| Samples Service Multi-Page | ⏳ | `js/services/samples.js` |
| Upload Multi-File (Ordner) | ⏳ | `js/components/upload.js` |
| METS-XML Integration | ⏳ | `js/services/samples.js` |
| Editor pro Seite | ⏳ | `js/editor.js` |
| Keyboard: ←/→ Navigation | ⏳ | `js/viewer.js` |

**UI-Element:**
```
◀ Prev │ Page 3 / 83 │ Next ▶
```

**Datenquellen:**
1. Ordner mit Bildern (alphabetisch sortiert)
2. METS-XML (strukturiert mit Metadaten)

### 2.3 Demo-Daten erweitern ⏳

| Sample | Typ | Seiten | Status |
|--------|-----|--------|--------|
| Wecker Antidotarium | Multi-Page | 83 | ⏳ |
| Stefan Zweig (METS) | Multi-Page | 3 | ⏳ |
| Raitbuch (bestehend) | Single | 1 | ✅ |
| HSA Brief (bestehend) | Single | 1 | ✅ |

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
├── help.html               # NEU: Hilfe-Seite
├── about.html              # NEU: About-Seite
├── css/
│   ├── variables.css       # Design Tokens
│   ├── base.css            # Reset, Typography
│   ├── layout.css          # Grid, Panels
│   ├── components.css      # Buttons, Inputs
│   ├── dialogs.css         # Modal Dialogs
│   ├── editor.css          # Transcription Editor
│   ├── viewer.css          # Document Viewer
│   ├── validation.css      # Validation Panel
│   └── pages.css           # NEU: Shared für Unterseiten
├── js/
│   ├── main.js             # Entry Point
│   ├── state.js            # Central State
│   ├── viewer.js           # Pan/Zoom/Fit/Regions
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
│       ├── samples.js
│       └── parsers/
│           ├── page-xml.js
│           └── mets-xml.js # NEU
├── samples/
│   ├── index.json
│   ├── raitbuch/
│   ├── wecker/             # NEU: Multi-Page
│   └── hsa-letter/
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
