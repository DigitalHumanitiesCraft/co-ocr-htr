---
type: knowledge
created: 2026-01-16
tags: [coocr-htr, journal, development-log]
status: complete
---

# Development Journal

Chronological record of design decisions, problem analyses, and architectural changes. File lists, commit tables, and checklists are omitted (reconstructable from Git history).

**Participants:** Christopher Pollin, Claude Opus 4.5 (Claude Code)

---

## 2026-01-16 | Sessions 1–3: Bootstrapping and Knowledge Consolidation

### Initialization

Promptotyping project for coOCR/HTR set up. Initial structure: README.md (EN), CLAUDE.md, docs/, src/ (empty).

### Knowledge Analysis

Material from prior Gemini 3 session analyzed. More extensive than expected:

| Source | Assessment |
|--------|------------|
| Methodological foundations (LLM bias, Critical Expert) | Highly relevant |
| Design system (detailed) | Highly relevant |
| Architecture (modules, APIs) | Highly relevant |
| Implementation plan (phases) | Moderate |
| Working prototype (1400 LOC) | Highly relevant |

**Key findings:** Categorical instead of numeric confidence (based on LLM bias research), validation perspectives (paleographic, linguistic, etc.), event-based text-image synchronization.

### Knowledge Consolidation

Everything integrated into shared `knowledge/` folder: INDEX.md (navigation, document matrix), METHODOLOGY.md, DESIGN-SYSTEM.md, ARCHITECTURE.md, VALIDATION.md, DATA-SCHEMA.md. Prototype moved to `src/index.html`.

**Document relationships:**
```
METHODOLOGY → DESIGN-SYSTEM (color coding)
            → ARCHITECTURE (technology decisions)
            → VALIDATION (categories, perspectives)
ARCHITECTURE → VALIDATION (engine integration)
             → DATA-SCHEMA (storage formats)
VALIDATION → DATA-SCHEMA (ValidationResult)
           → DESIGN-SYSTEM (UI representation)
```

### UI Mockup Analysis (Session 2)

Transferable patterns identified from Promptotyping prototype: Intersection Observer, Slide Panel, CSS Variables, Terminal UI (partially), TESTING.md.

Screenshot of coOCR/HTR UI mockup analyzed. Three-column layout: Document Viewer (40%), Transcription (35%), Validation (25%). Header with logo, filename, pagination, upload, settings, user. Status bar with model/perspective/status/timestamp. Color palette extracted (GitHub Dark basis: `#0d1117` background, `#3fb950` success, `#d29922` warning, `#f85149` error).

**Recognized components:** Document Viewer (image with colored bounding boxes, zoom controls +/-/Reset), Transcription Table (columns: #, DATE, NAME, DESCRIPTION, AMOUNT), Validation Panel (two sections: RULE-BASED, AI ASSISTANT), Status Bar (model dropdown, perspective dropdown, status badge, timestamp).

**Key insights:** Triple synchronization (Viewer ↔ Transcription ↔ Validation bidirectional), tabular transcription (structured columns instead of free text for account books), validation separation into RULE-BASED (deterministic) vs. AI ASSISTANT (probabilistic), expandable card pattern with status indicator (border-left).

### Prototype v2 Analysis (Session 3)

Significant improvement over v1: Modular (322 HTML + 260 JS) instead of monolithic (1413 LOC), AppState with EventTarget instead of DOM-based state, external CSS files instead of inline, ES6 modules, SVG overlay instead of CSS-based bounding boxes.

**AppState core concept:** `class AppState extends EventTarget` with `dispatchEvent(new CustomEvent(...))` replaces planned EventBus with native browser API.

7-phase implementation plan created (Core Services → Dialogs → Transcription → Validation → Export → UX → Polish).

### Data Analysis (Session 3b)

Three datasets with PAGE-XML standard: Raitbuch 2 (account book 16th/17th c., 123 pages, FINAL), 1617-wecker (medical book Latin, 83 pages, partial), o_szd (Stefan Zweig letters, 12 pages, METS-XML). Plus Schliemann archive images (21 JPG).

**PAGE-XML mapping to coOCR/HTR:** TextLine/Coords@points → bounds (Polygon→BoundingBox), TextLine/TextEquiv/Unicode → text, TranskribusMetadata@status → confidence.

---

## 2026-01-16 | Session 4: Full Implementation Started

### Design Decisions

| Question | Decision |
|----------|----------|
| LLM providers | Gemini 2.5 Flash, GPT-4.5 Mini, Haiku 4.5, DeepSeek (local+API) |
| API key storage | LocalStorage (simple) |
| Data formats | Images + PAGE-XML |
| Export formats | .txt, .json, .md (PAGE-XML as expansion stage) |
| Validation | Rule-based Validation + LLM Review parallel |
| Tests | Vitest (Claude's recommendation) |
| DeepSeek | Both (API + Ollama local) |
| Deployment | GitHub Pages + local file:// |

### Milestone 0: Preparation

Folder `newer prototpye` → `prototype` renamed. Project structure with `js/services/`, `js/components/`, `tests/` created. package.json with Vitest, vitest.config.js.

### Milestone 1: Core Services

**Storage Service (~230 LOC):** Settings CRUD with defaults, API key storage (Base64-obfuscated), session auto-save/restore.

**State.js extended (~440 LOC):** Document management, transcription state, validation state, UI state, session auto-save with storage service, backward compatibility with old API.

**LLM Service (~500 LOC):** 5 providers (Gemini, OpenAI, Anthropic, DeepSeek, Ollama), transcription prompt (historical handwriting), validation prompts (4 perspectives), response parsing (Markdown tables, JSON), error handling with categorization.

### Rename to docs/

`prototype/` → `docs/` for GitHub Pages compatibility. `src/index.html` (Prototype v1) deleted.

---

## 2026-01-16 | Session 5: Milestones 2–4

### Milestone 2: Dialogs & Upload

Native `<dialog>` with glass morphism backdrop. Tab-based provider configuration (5 providers). Password toggle for API keys. File input + drag & drop upload zone. PAGE-XML import with coordinate conversion. Toast notification system.

### Milestone 3: LLM Transcription

Transcription flow: Upload → Transcribe Click → Loading State → LLM API Call → Response Parse → State Update → Editor/Viewer Update. Image-to-Base64 conversion. Error handling with retry.

### Milestone 4: Validation

**8 rule-based rules:** Date format, currency (Taler, Groschen, Gulden/Kreuzer), uncertain readings [?], illegible passages [illegible], column count consistency, empty cells.

**4 LLM Review perspectives:** Paleographic (letter forms, ligatures), linguistic (grammar, historical orthography), structural (tables, sums, references), domain knowledge (technical terms, plausibility).

---

## 2026-01-16 | Session 5b: Milestones 5–6

### Milestone 5: Export

Plain text (tab-separated), JSON (with metadata option), Markdown (with validation notes). Download via Blob + createObjectURL.

### Milestone 6: UX

**Inline editing:** Double-click starts editing, Enter saves, Escape cancels, Tab navigates to next cell.

**Keyboard shortcuts:** Ctrl+Z/Cmd+Z undo, Ctrl+Shift+Z/Ctrl+Y redo, arrow keys line navigation, Enter starts editing.

---

## 2026-01-16 | Session 6: Demo Loader

### Problem

`data/` lies outside `docs/` and is therefore not accessible via the browser. GitHub Pages only serves from `docs/`.

### Solution

Selected example data copied to `docs/samples/`. Manifest `samples/index.json` with metadata per sample (schema: id, name, description, image path, pageXml path). Sample loader service. Three samples: Raitbuch, letter, index card.

### UI Extensions

Samples dropdown in header ("Demo" button), viewer empty state with icon/title/description and buttons for "Load Demo" and "Upload Image".

---

## 2026-01-16 | Session 6b: Bugfixes and Deployment

### Bugs Fixed

| Bug | Cause | Solution |
|-----|-------|----------|
| `appState.setUI is not a function` | Method does not exist | Replaced with `setLoading()`, `openDialog()`, `closeDialog()` |
| `validationPanel.init is not a function` | Init call missing | Added `validationPanel.init()` in main.js |
| `rgba(var(--bg-rgb))` broken | `--bg-rgb` variable missing | Added RGB variants in variables.css |
| Zoom not working | Stale state reference | Used `appState.zoom` getter |
| Export dialog backdrop missing | `.dialog-container` wrapper missing | Corrected HTML structure |

### Deployment

Local test with `npx serve docs -l 3000`. All features functional. Live URL: http://dhcraft.org/co-ocr-htr

---

## 2026-01-16 | Session 7: Flexible Editor & Guided Workflow

### Problem

Editor was hardcoded for account book structure (4 columns: Date/Name/Description/Amount). DATA-SCHEMA.md already supported flexible structures, but the editor code did not.

### Solution: Two Editor Modes

Automatic mode detection: `grid` when columns[] defined, segments with fields, or text contains `|`. Otherwise `lines` for prose (letters, diaries, manuscripts).

### Guided Workflow

Workflow stepper in status bar (6 steps: Load → Configure → Transcribe → Edit → Validate → Export). Panel hints (contextual hints per panel, dismissable, persistent). Info tooltips (methodology explanations in panel headers). Onboarding toast for first-time visitors.

### CSS/HTML Cleanup

Duplicate `.editor-grid-row` merged. Hardcoded colors (`#30363d`) replaced with CSS variables. Missing border variables added (`--border-subtle`, `--border-muted`). Orphaned modal styles removed (now using `<dialog>`). Empty `<style>` tag and inline styles cleaned up.

---

## 2026-01-16 | Session 8: CSS Refactoring & Warm Editorial Theme

### CSS Modularization

Monolithic 1530-line `styles.css` split into: variables.css (~110), base.css (~120), layout.css (~280), components.css (~340), dialogs.css (~280), editor.css (~200), viewer.css (~250), validation.css (~150), styles.css (~10, imports only).

### Theme Evolution

Three stages: Dark (#0d1117, GitHub Dark) → Cold Light (#f5f5f5, user request) → Warm Editorial (final).

**Warm Editorial palette:**
- Backgrounds: `#faf8f5` (cream), `#ffffff` (panels), `#f0ebe3` (viewer, paper-like)
- Text: `#3d3229` (dark warm brown), `#8a7e72` (medium gray-brown)
- Status: `#5a8a5a` (muted forest green), `#c4973a` (warm amber/gold), `#b85c4a` (muted terracotta)

**Rationale:** Archival/manuscript aesthetic, reduced eye strain for extended editing sessions, colors evoke historical documents.

### Demo Auto-Load

`autoLoadDemo()` loads first sample when no user session exists. Demo indicator in header (yellow dot + "DEMO"). Hidden when user uploads own file.

### UI Analysis: 6 Problems Identified and Fixed

| Problem | Severity | Cause | Solution |
|---------|----------|-------|----------|
| Transcription not displayed | Critical | `transcriptionComplete` event not handled after demo load | `documentLoaded` listener checks existing transcription |
| Panel hints don't disappear | Medium | Timing issue with `appState.hasDocument` | New `documentLoaded` handler checks segments |
| Viewer background too dark | Medium | Already using `var(--bg-viewer)`, no inline override | No fix needed |
| Toolbar barely visible | Medium | Insufficient contrast | White background, primary text color, larger shadow |
| Bounding box colors too cold | Low | Not matching warm theme | New variables: `--region-stroke: #8b7355` (sienna) |
| Tooltip clipped | Low | CSS overflow | Fixed |

### Settings & Help Dialogs

Settings: editor settings (auto-save, line numbers, highlight uncertain), validation (auto-validate, default perspective), display (hints, workflow stepper), data management (clear session, reset defaults). Help: quick start (4 steps), keyboard shortcuts grid, confidence legend, resource links.

---

## 2026-01-16 | Session 9: Logo Integration

Two logo candidates analyzed: Logo 1 (horizontal, eye/wave, elegant flowing) and Logo 2 (compact circle, "Co"/Yin-Yang). Logo 1 selected as primary.

**Placement:** Compact circular logo (`logo-icon.png`) in header, wide eye/wave logo (`logo.png`) in help dialog about section.

**Favicon:** Redesigned with warm background (`#faf8f5`), golden circle (`#c4973a`), cream-colored inner curves.

---

## 2026-01-16 | Session 10: Color System Refinement

### Problem

Logo gold (`#b89850`) was conflated with status color `--uncertain` (`#c4973a`). No dedicated brand color category.

### Solution: Brand Color Category

New variables: `--brand-gold: #b89850`, `--brand-brown: #3d3229`, plus overlays (`--brand-bg`, `--brand-border`, `--brand-glow`).

**Color function matrix (clear separation):**

| Category | Purpose | Colors |
|----------|---------|--------|
| Brand | Identity | Gold `#b89850`, Brown `#3d3229` |
| Accent | Interactive | Steel Blue `#4a7c9b` |
| Status | Confidence | Green/Amber/Terracotta |
| Neutral | Layout | Cream/White/Brown |
| Region | Annotations | Sienna `#8b7355` |

---

## 2026-01-16 | Session 11: Gemini 3 API Optimization

### Model Name Correction

`gemini-3.0-flash-preview` → `gemini-3-flash-preview` (404 error fixed).

### Gemini 3 Developer Guide Findings

`thinking_level` (high/low) controls reasoning depth. `media_resolution: 'high'` improves OCR quality. **temperature=1.0 is mandatory for Gemini 3** — lower values cause unexpected behavior.

**Application:** Transcription gets `media_resolution: 'high'`, validation gets `thinking_config: { thinking_level: 'high' }`, both temperature=1.0.

---

## 2026-01-16 | Session 12: Bug Analysis & Requirements

### Empty State Fix

Empty state not visible on fresh start (Incognito). Fix: z-index and click handler corrected, auto-load demo disabled.

### Critical Bug: Transcription Not Displayed in Editor

**Symptom:** HSA letter → Transcribe → Console shows 41 segments, but editor cells empty, 0 regions.

**Root cause (state.js:405-415):** `data.segments.filter(s => s.bounds)` filters out all LLM segments because LLM transcriptions have no coordinates (`bounds`). All segments removed → 0 regions → editor shows nothing.

### Further Bugs Identified

| Bug | Cause |
|-----|-------|
| PAGE-XML word fragments | Wrong TextEquiv in page-xml.js |
| Table prompt used for letters | Single prompt for all document types |
| Validation initially visible | Missing conditional display |

### Requirements Document

`knowledge/REQUIREMENTS.md` created: 26 implemented features, 9 open, 4 known bugs.

---

## 2026-01-17 | Session 13: Bug Fixes, Features & Tests

### Bug Fixes

**Pseudo-regions for LLM segments:** Evenly distributed regions generated when no bounds available (`synthetic: true`). Height per region = 100% / total segments.

**PAGE-XML text extraction:** New `extractLineText()` prefers direct TextEquiv of TextLine, then falls back to Word children. Solves word fragment problem.

**Dual prompt system:** `TRANSCRIPTION_PROMPT_TABLE` for account books, `TRANSCRIPTION_PROMPT_TEXT` for letters/prose. UI dropdown for document type.

**Validation conditional display:** `updateVisibility()` shows validation only after transcription.

### New Features

**PAGE-XML export:** PAGE 2019-07-15 schema, metadata, TextRegion with TextLine, Coords points, TextEquiv, confidence mapping (certain→0.95, likely→0.75, uncertain→0.5).

**METS-XML upload:** Parser integration in upload.js.

### Tests

118 unit tests (100% passing): llm.test.js (28), page-xml.test.js (26), export.test.js (32), validation.test.js (32).

**Test fixes required:** jsdom as dev dependency, pagexml alias (filename extension instead of format checked), Markdown table field keys adapted to header conversion, summary calculation corrected property path (`summary.counts.success`).

---

## 2026-01-18 | Session 14: OpenSeadragon Viewer Rewrite

### Problem

Region overlay synchronization broken. Regions appeared mispositioned because SVG viewBox="0 0 100 100" with preserveAspectRatio="none" failed for non-square images. Custom pan/zoom via CSS transform had to be manually synchronized with SVG overlay, creating multiple interacting failure points in organically grown code.

### Decision

Complete rewrite with OpenSeadragon + IIIF instead of incremental fixes. Advantages: automatic SVG transformation, native IIIF support, proven pan/zoom (touch-capable), significantly reduced code complexity.

### Architecture Change

Old: `imageWrapper` with CSS transform + separate SVG (viewBox 0 0 100 100). New: OpenSeadragon container with Canvas + SVG Overlay plugin, coordinates in viewport space.

### Coordinate Conversion (Core Problem)

OSD SVG Overlay normalizes X to 0–1 (image width), but Y to 0 through aspectRatio (not image height). PAGE-XML stores percentages (0–100). Conversion: `x = reg.x/100`, `y = (reg.y/100) * (imgHeight/imgWidth)`, same for w/h.

### Details

Dependencies: OpenSeadragon 4.1 + SVG Overlay plugin via CDN. New controls: Rotate Left/Right (`r`/`R`), Flip Horizontal (`h`), Reset View (`0`). IIIF: `loadIIIFManifest()` implemented, multi-page via manifest supported. CSS: `vector-effect: non-scaling-stroke` for regions, toolbar icons at 20px.

---

## 2026-01-18 | Session 15: IIIF Dialog

### Implementation

Dialog with URL input, example links (Bodleian, Gallica, BSB), preview mode (fetch manifest, show metadata), automatic IIIF v2/v3 detection, page count, error handling (timeout, HTTP, invalid manifest).

### Bug Fixes

**Editor not clearing on IIIF load:** Editor only listened to `documentLoaded`, not `pageChanged`/`pagesLoaded`. Event listeners added.

**Preview required before Load:** Unintuitive UX. Load button now calls `loadIIIFDirectly()`, Enter in URL input loads directly.

**No IIIF option in empty state:** "Load IIIF" button added next to "Load Demo".

### Known Issue

Slight delay when navigating pages in large IIIF manifests (1000+ pages). Expected behavior due to image loading.

---

## 2026-01-18 | Session 16: CSS & HTML Refactoring

### Accessibility

Focus-visible tokens (`--focus-ring-color`, `--focus-ring-width`, `--focus-ring-offset`). Mouse focus removal (`:focus:not(:focus-visible)`). Reduced motion support (`@media (prefers-reduced-motion: reduce)`).

### Design Tokens

Selection colors (`--selection-bg`, `--selection-bg-hover`, `--selection-bg-active`). Hardcoded RGBA replaced with token references. Z-index system expanded (dropdown, sticky, overlay, modal, tooltip, toast).

### HTML Semantics

`<div class="app-container">` → `<main>`. ~30 inline styles moved to CSS classes. `style="display:none"` → `hidden` attribute. SVG icon sprite with `<symbol>` definitions for reusable icons (`<use href="#icon-close">`).

### Utility Classes

Flexbox (`.flex`, `.flex-center`, `.flex-between`), gap spacing, margin utilities, panel grid columns, viewer panel content, various component classes.

---

## 2026-01-18 | Session 17: JavaScript Refactoring & Utilities

### New Utility Modules in docs/js/utils/

**constants.js:** Timing (toast, autosave, dialog focus), file limits, API endpoints (Gemini, OpenAI, Anthropic, Ollama default), IIIF constants (context v3, version enum), storage keys, events, CSS classes, PAGE-XML namespace, confidence levels and thresholds, toast types, document types, JPEG quality.

**dom.js:** Safe DOM manipulation: `getById()`, `select()`, `selectAll()`, `withElement()`, event listener helpers (`onById`, `on`, `onAll`), visibility toggle (`show`/`hide`), class manipulation, content setters, `createSVGElement()`, `focusDelayed()`.

**textFormatting.js:** Marker utilities: `applyMarkers()` (replaces `[?]` and `[illegible]` with spans), confidence classes/labels, `escapeHtml()`, `safeApplyMarkers()`. Deduplicated 4 instances of marker regex replacement.

### Code Quality Improvements

Unified visibility control via `hidden` attribute. `onclick = handler` → `addEventListener('click', handler)`. DOM queries through helpers instead of direct API calls. Magic numbers extracted to constants.

---

## 2026-01-18 | Session 18: Deployment Status

Project feature-complete and deployed. Live URL: https://digitalhumanitiecraft.github.io/co-ocr-htr/

All 7 original milestones plus 5 additional completed (Milestones 0–7 + Flexible Editor, OpenSeadragon, IIIF Dialog, CSS/HTML Refactoring, JS Utilities). 118 unit tests. Open optional features: PDF multi-page, auto-save, E2E tests, performance audit.

---

## 2026-01-19 | Session 19: Editor Simplification

Grid editor replaced with textarea. New features: synced line numbers, visible undo/redo buttons, diff view (word-level changes vs. original), structured/normalized view toggle, change counter. Document context fields (document type, historical period, languages, description) moved into collapsible section within transcription dialog.

---

## 2026-02-03 | Session 20: API Dialog Redesign

### API Dialog Redesign

**Problem:** Separate tabs per provider (unnecessary), no clear model selector, local models not visible.

**Solution:** Unified form with provider dropdown (cloud vs. local groups), dynamic model dropdown per provider, custom model input ("Custom model..."), Ollama-specific server URL field and model refresh button.

**Provider-model mapping:**

| Provider | Models | Notes |
|----------|--------|-------|
| Google Gemini | gemini-3-flash-preview, gemini-3-pro-preview | Cloud, API key required |
| OpenAI | gpt-4o, gpt-4o-mini | Cloud, API key required |
| Anthropic | claude-4.5-sonnet, claude-4.5-haiku, claude-4.5-opus | Cloud, API key required |
| Ollama | deepseek-ocr (recommended), llava, llama3.2-vision | Local, no API key |

### DeepSeek-OCR Correction

**Finding:** DeepSeek-OCR is NOT a cloud API service. It is a local vision model available via Ollama. Removed from cloud providers, added as recommended Ollama model.

### Bug Fix

"Test connection" button not working: selector `select('#testApiConnection', dialog)` → `getById('testApiConnection')`.

---

## 2026-02-03 | Session 21: AI Styling & Validation-to-Image Highlighting

### AI Content Identification

Violet/purple color family introduced for AI-generated content: `--ai-primary: #7c5cbf`, `--ai-bg`, `--ai-border`. AI section header with "LLM" badge and violet left border. Clear visual separation from rule-based (deterministic) results.

### Loading Overlay

Dark overlay made text unreadable. Changed to light blur effect: `rgba(250, 248, 245, 0.7)` with `blur(8px)`, white content box with shadow.

### Validation-to-Image Highlighting

**Graceful degradation:** PAGE-XML (with coordinates) → image region highlighted + pan. Plain image (without coordinates) → editor line highlighted + info toast.

**Click handler fix:** Selector expanded from only `.validation-card` to `.validation-card[data-line], .validation-item[data-line]`.

### Sample Cleanup

Raitbuch sample removed (blank pages not useful for demo).

---

## 2026-02-03 | Session 22: Refactoring Iteration

### Dead Code Removal

`autoLoadDemo()` (~30 lines, never called) and `showOnboardingToast()` (~15 lines, commented out) removed from main.js. -79 lines.

### Circular Dependency Resolution

viewer.js used dynamic `import()` to avoid circular dependency with dialogs.js.

**Solution:** Event-based decoupling via state.js: `showToast()` method emits `toastRequested` event, main.js forwards to dialogManager. Clean unidirectional data flow architecture, no dynamic imports, reusable pattern.

### CSS Extraction

~340 lines inline CSS extracted from validation.js to `validation.css`. Benefits: IDE support, browser caching, no duplicate style definitions.

### VISION.md

New document with project goal: editor-in-the-loop tool for OCR/HTR verification and correction. Two input modes (image for OCR generation, PAGE-XML for correction). Success criteria: self-explanatory (usable without instructions), complete workflow (upload → edit → export), workflow integration (output usable in other processes), quality assurance ("correct OCR/HTR comes out"). Integrated into README.md, CLAUDE.md, and INDEX.md.

---

## 2026-02-03 | Session 23: Model Landscape & Community Validation

### Community Feedback (DH Discussion)

Gemini 3 Pro leads significantly among closed models. LightOnOCR-2 is state-of-the-art for open source. DeepSeek OCR 2 "works okay for simple layouts". Layout analysis as a separate step improves accuracy. Agentic Vision Mode relevant for complex layouts. HTR remains more challenging than OCR.

### Web Research Results

| Model | Details |
|-------|---------|
| LightOnOCR-2 | 1B parameters, SotA on OlmOCR-Bench (83.2), Apache 2.0 |
| Gemini 3 Pro | "Solves" English HTR (18th–19th c.), error rate comparable to best humans |
| Gemini 3 Flash Agentic Vision | Think-Act-Observe loop, 5–10% quality improvement |
| dots.ocr | 1.7B, 100+ languages, MIT license, best layout recognition |
| DeepSeek OCR 2 | 3B, good for simple layouts, handwriting limitations |

**Sources:**
- LightOnOCR-2: https://huggingface.co/lightonai/LightOnOCR-2-1B
- Gemini 3 Pro Vision: https://blog.google/technology/developers/gemini-3-pro-vision/
- Gemini 3 HTR Analysis: https://generativehistory.substack.com/p/gemini-3-solves-handwriting-recognition
- Agentic Vision: https://blog.google/innovation-and-ai/technology/developers-tools/agentic-vision-gemini-3-flash/
- dots.ocr: https://github.com/rednote-hilab/dots.ocr

### Knowledge Base

New document `knowledge/MODEL-LANDSCAPE.md` with model comparison, recommendations, selection guide. Implementation: Gemini 3 Pro as model option with hint "best quality for HTR", model selection guide as collapsible info box in API key dialog, Ollama models (DeepSeek OCR 2, LightOnOCR-2).

---

## 2026-02-03 | Session 23b: Arabic IIIF Sample

Arabic test document integrated for non-Latin script systems. Source: Internet Archive IIIF, Historical Arabic Magazines (1937), 82 pages, IIIF 3.0. Samples service extended with IIIF support (`iiifManifest` property). METHODOLOGY.md: Arabic moved from "Untested" to "Testing".

---

## 2026-02-03 | Session 23c: Batch Transcription

### Implementation

Radio buttons for page selection ("Current page only" / "All pages"). Warning with token estimate (~1000 tokens/page). `transcribeAllPages()` with rate-limit handling (500ms delay, 30s on rate limit), progress display, auth errors abort batch, summary at end. `setBatchTranscriptions()` in state.js.

### Design Decisions

| Decision | Rationale |
|----------|-----------|
| 500ms delay between pages | Rate limit prevention |
| 30s pause on rate limit | Automatic recovery instead of abort |
| Auth error aborts batch | No pointless processing without API key |
| Default "current page" | Encourages testing before batch |
| ~1000 tokens/page estimate | Conservative average for warning |

---

## 2026-02-03 | Session 23d: RTL Support and UI Improvements

### IIIF Loading Screen

Visual loading state during IIIF manifest loading with progress ("Processing X pages...").

### Load Demo Button Fix

Event propagation issue: `e.stopPropagation()` prevents immediate menu close.

### RTL Support

Automatic detection of RTL scripts (Arabic, Hebrew, Persian). Threshold: >30% RTL characters. Line numbers move to right side, text aligned right-to-left. Works in both structured and diff view.

### Test

Arabic OCR/HTR with Gemini 3 Flash: 82 pages from Internet Archive IIIF, RTL rendering correct, validation shows "high confidence", historical Arabic (1937) correctly recognized.

---

## 2026-02-03 | Session 23e: Batch Test Antidotarium

Antidotarium Nicolai (1574, medical text, Heidelberg), 6 pages via IIIF, Gemini 3 Flash. All 6 pages successfully batch-transcribed. Rate limit handling worked. Latin abbreviations and 16th-century typography handled well. Two-column layout on page 6 correctly recognized.

User feedback: "For me this actually looks very good. It worked well."

---

## 2026-02-03 | Session 23f: Batch Validation and Persistence

### Batch Validation

Dialog with page selection (analogous to transcription). Batch logic iterates all pages with progress bar, 500ms delay, rate limit handling. Results per page in `batchValidations[]`.

### Validation Persistence Bug

**Problem:** Validation results disappeared when navigating pages.

**User report:** "When I go to the next page after running 'Validate', the results for page 2 are gone."

**Solution:** `_saveCurrentPageValidation()` in state.js, `loadPageValidation()` in ValidationPanel restores results. `pageChanged` event loads saved validation instead of clearing.

### LocalStorage Persistence

`_saveSession()` extended to include: pages, currentPageIndex, pageTranscriptions, batchTranscriptions, batchValidations. Automatic save after batch operations with user notification.

---

## 2026-02-03 | Session 24: Validation Simplification and Refactoring

### English Prompts

All LLM prompts converted from German to English for better model performance.

### Generic Validation Prompt

**Decision:** 4 specialized perspectives (paleographic, linguistic, structural, domain) replaced with one generic default prompt. Optional custom prompt field for advanced users (collapsed by default). Perspective dropdown removed from UI.

### Dead Code Removal (~280 lines)

After perspective removal: `renderRuleSection()`, `renderLLMSection()` (~95), `getPerspectives()` (~10), `VALIDATION_PROMPTS` (~12), perspective CSS (~110), validation mode info CSS (~55).

### Tests Updated

Old tests for `deepseek` provider and `perspective` parameter removed. New tests for category filtering, `customPrompt`, new rules. Final result: 125 tests (llm 27, export 32, validation 40, page-xml 26), all passing.

### Documentation Cleanup

`REQUIREMENTS.md`, `VIEWER-REWRITE-PLAN.md`, `ACTIONPLAN.md` deleted (outdated, purpose fulfilled). References in CLAUDE.md, INDEX.md, IMPLEMENTATION-PLAN.md, help.html, about.html, README.md updated. Export fix: raw text support for transcriptions without segments/lines.

---

## 2026-02-04 | Session 25: TEI-XML, Tests, PWA

### TEI-XML Export

TEI P5 minimal schema. Marker conversion: `[word]?` → `<unclear>`, `[?]`/`[illegible]`/`[...]` → `<gap reason="illegible"/>`, `[abbr:expansion]` → `<choice><abbr>/<expan>`. Line breaks with `<lb/>`, provider info in `<revisionDesc>`. 18 new tests.

### Test Coverage Expansion

**state.test.js (61 tests):** Initialization, document management, multi-page, transcription, selection/zoom, regions, validation, UI state, document context, batch, session, segment updates.

**storage.test.js (23 tests):** Settings CRUD, API key security (deprecated methods return safe values), session management, utilities.

**Final result:** 226 tests, all passing.

### PWA/Offline Support

**manifest.json:** App name, icons (192/512px), standalone display, theme color (#4a7c9b).

**Service Worker (sw.js):** Cache version management (coocr-v1), static asset caching, cache-first for static assets, network-first for API calls (Gemini, OpenAI, Anthropic, Ollama), automatic cache cleanup on version change.

**PWA module (pwa.js):** SW registration, offline/online detection, visual indicator with pulse animation, toast notifications for connectivity changes, update notification.

---

## 2026-02-04 | Session 26: Upload Dropdown & Model Indicator

### Upload Dropdown

All load options unified in one dropdown: upload image, import PAGE-XML, load demo (submenu), load IIIF (dialog).

### Demo Sample Badge System

Visual badges: OCR (blue, printed text), HTR (orange, handwriting), IIIF (green, external), XML (purple, has PAGE-XML), nS (gray, multi-page with n pages). Tooltips with details (language, script type, document type, source).

### Model Indicator

Clickable model indicator next to Transcribe button. Provider-specific color coding: Ollama green, Gemini blue, OpenAI purple, Anthropic orange. Click opens LLM config dialog. Display name shortening, local models show "(local)".

### Header Cleanup

API Keys button removed, model indicator serves as entry point to LLM configuration.

### Bug Fixes

"Load models" button: `select()` → `getById()`. Upload button conflict: duplicate event handler removed. Dropdown overflow: `left: 0` → `right: 0`. Demo selection: `e.stopPropagation()` added.

---

## 2026-02-04 | Session 27: DeepSeek-OCR Integration & Validation Fallback

### DeepSeek-OCR Fix

**Problem:** Empty responses despite correct provider detection.

**Root cause:** DeepSeek-OCR requires `/api/chat` endpoint (not `/api/generate`) and works best with simple prompts.

**Solution:** Detect vision models (deepseek-ocr, llava, *vision*) and route to `/api/chat` with messages format. Simplified prompt "Extract the text in the image." `/api/generate` remains for text-only.

### Validation Fallback

**Problem:** DeepSeek-OCR is OCR-only, cannot perform text validation (without an image).

**Solution:** Automatic fallback: transcription with DeepSeek-OCR (local) → validation with cloud provider (Gemini/OpenAI/Anthropic). `isOcrOnlyModel()` detects OCR-specific models. `getValidationFallback()` finds alternative (1. cloud with API key, 2. other Ollama models). UI shows "Fallback: Google Gemini".

### Export Button Fix

Selector `[title="Export"]` did not match `title="Export transcription"`. Fix: `getById('btnExport')`.

### Test Validation

DeepSeek-OCR transcribed historical document (Lichenes flora), Gemini validated. Validation correctly identified OCR error: "Lichtenes" instead of "Lichenes".

---

## 2026-02-04 | Session 28: Batch Processing Implementation

### Batch State Management

New state area: operation (transcription/validation/null), status (idle/running/complete/aborted), currentIndex, total, successCount, errorCount, abortRequested. Methods: `startBatch()`, `updateBatchProgress()`, `requestBatchAbort()`, `completeBatch()`, `getPageStatus()`.

### Page Status Indicators

Visual page strip with clickable dots: idle (gray), transcribed (yellow), validated (green), error (red), processing (pulsing).

### Batch Progress Panel

Floating panel (bottom right): operation title, counter (3/6), progress bar, abort button. Abort checks `abortRequested` flag in each iteration.

### ZIP Export

`exportAllPagesZip()`: JSZip loaded dynamically via CDN, folder with document name, each page in selected format, manifest.json with metadata. Export dialog shows scope selector for multi-page ("Current page" / "All pages ZIP").

**Scope:** ~610 LOC. 276 unit tests passing.

---

## 2026-02-04 | Session 29: i18n Planning

### String Inventory

~400 user-visible strings: index.html (~185 static), JS components (~100 dynamic), services (~50 rules/errors), core JS (~65 labels/status). Currently mixed: German ~60%, English ~40%.

### Planned Architecture

`i18n.js` (core with `t()` function, ~150 LOC) + `translations.js` (DE/EN data, ~800 LOC). `t(key, params)` with interpolation, `setLanguage(locale)` for runtime switch, `translateDOM()` with `data-i18n` attributes, browser language detection, LocalStorage persistence.

### Implementation Plan (Phase 5, ~14h)

7 steps: Core Infrastructure (2h) → HTML Migration (3h) → JS Priority 1 (3h, dialogs/transcription/validation) → JS Priority 2 (2h, batch/editor) → JS Priority 3 (1h, main/llm/export) → Language Switcher (1h) → Testing (2h).

**Note:** LLM prompts will NOT be translated (English prompts perform better). Fallback: show key if translation missing. Pluralization with `{one, other}` pattern.

---

## 2026-02-05 | Session 30: Knowledge Base Overview Redesign

### knowledge.html Overview Page

Complete restructuring of the Knowledge Vault overview page.

**Design Principles (5 items, 3+2 grid layout):**
1. Critical Expert in the Loop - explicit mention of hallucination and sycophancy, LLM literacy required
2. Hybrid Validation - deterministic Validation + LLM Review, categorical confidence integrated
3. Workflow-Agnostic - PAGE-XML import/export, multiple formats, pipeline integration
4. Open Browser Tool - no backend, vanilla JS, open source (CC BY 4.0)
5. Cloud & Local Models (new) - provider choice between cloud LLMs and local Ollama

**Development Methodology:**
- Promptotyping with agentic coding using Claude Code + Opus 4.5
- Link to L.I.S.A. (Gerda Henkel Stiftung) blog

**CSS Changes:**
- New `.five-items` grid class for 3+2 layout (6-column grid, first row spans 2 each, second row centered)
- Responsive fallback to single column on mobile

**Content improvements:**
- Removed product references (Transkribus) from workflow description
- Removed empty marketing phrases ("robust quality assurance")
- Added concrete examples (dates, currency, historical spelling)
- Explicit LLM limitations (sycophancy, hallucination)

### Repository Analysis

Systematic verification of design principles against codebase. All 5 principles confirmed with evidence in code and documentation (METHODOLOGY.md, VALIDATION.md, SECURITY.md, llm.js, validation.js).

---

## 2026-02-05 | Session 31: Bugfixes, Session Restore Dialog, Methodology Updates

### Methodology Documentation

**Interface Design Theory updated:**
- Removed Shneiderman "Overview first" (not applicable to workbench UI)
- Removed Coordinated Multiple Views reference (too academic)
- Added Direct Manipulation (Shneiderman 1983) - fits editor paradigm
- Added Gulfs of Execution & Evaluation (Norman 1986) - explains minimal UI goal

**Knowledge Hierarchy (AIL-ML Framework):**
- Integrated from Agent-in-the-Loop ML paper (Gao et al. 2025)
- Key insight: General Users < LLMs < Domain Experts
- Epistemic asymmetry justifies Expert-in-the-Loop approach
- Phrase: "the LLM generates, the expert authors"

### Session Restore Dialog

New feature: App asks before restoring saved session on startup.

**Components:**
- `appState.hasSavedSession()` - checks if session exists
- `appState.restoreSession()` - restores on user confirmation
- `dialogManager.showConfirm()` - new reusable confirm dialog with icon support
- Structured display: timestamp, filename, transcription status

**Design:**
- Icon support (restore, warning, info, question)
- Relative time for recent sessions (<7 days), absolute date for older
- Session info with label-value pairs, filename in mono font

### Multi-Page Navigation Bugfixes

**Issues fixed:**
1. Page navigation visible after switching from multi-page to single-page document
2. Old regions (bounding boxes) persisted when loading new document
3. Page strip too narrow for many pages (82+ in IIIF samples)

**Solutions:**
- `updatePageNavigation()` called on `documentLoaded` event
- `regionsChanged` event emitted when clearing regions in `setDocument()`
- Multi-page data reset in `setDocument()`: pages, currentPageIndex, pageTranscriptions, batchTranscriptions, batchValidations
- Page strip max-width increased to `min(400px, 50vw)` with visible scrollbar
- Current page auto-scrolls into view

### Export Encoding Fix

TEI-XML export had UTF-8 encoding issues (Umlauts displayed as `Ã¼`).

**Fix:** Added charset declaration to Blob creation:
```javascript
const charset = mimeType.includes('xml') ? '; charset=utf-8' : '';
const blob = new Blob([content], { type: mimeType + charset });
```


---

## 2026-02-14 | First Institutional Adoption: ZBZ

### Context

The Zentralbibliothek Zürich (ZBZ) has confirmed their commission for the Jeanne Hersch digital edition project (289 documents, 7,200 pages). coOCR/HTR is positioned as the generic open-source component within the broader zbz-ocr-tei pipeline.

### Relevance for coOCR/HTR

| Aspect | Implication |
|--------|-------------|
| Institutional fork | ZBZ will fork co-ocr-htr to GitLab Uni Zürich |
| Deployment | Podman (daemonless Docker alternative), OCI-compatible |
| LLM access | Azure-based (Mistral OCR 3, Claude, Gemini) |
| Team | Anouschka (editions and informatics background) as primary user |
| Community reference | Klugseder (ÖAW) fork for medieval music manuscripts |

### Open Development Vision

coOCR/HTR explicitly communicated to ZBZ as a community project:

- **Community of Experts**: Domain experts as peer reviewers of LLM output
- **LLM-assisted code review**: Contributors get AI-assisted review of their contributions
- **Institutional forks**: Each institution adapts to their needs, contributes back
- **Promptotyping methodology**: Iterative development through AI dialogue

### Architecture Implications

The ZBZ deployment validates key architectural decisions:

1. **No backend**: Browser-only works for institutional deployment (Podman serves static files)
2. **Configurable API endpoints**: Essential for Azure vs. direct API switching
3. **PAGE-XML export**: Required for integration with TEI transformation pipeline
4. **IIIF support**: Relevant for ZBZ's digital library infrastructure

### No Code Changes

This entry documents the adoption context only. No code changes required — the existing architecture already supports institutional deployment.

---

## Session 33 (2026-02-14): Community Integration + Major Extensions

### Context

Integration of Robert Klugseder's substantial fork (67 commits, +15,819 lines, 90 files) plus three major extensions: i18n system, project rules, and Azure Mistral OCR.

### What Was Done

**Phase 0: Merge + Attribution**
- Merged Robert's fork via `--no-ff` into `integration/robert-merge` branch
- Created `CONTRIBUTING.md` with contribution guidelines
- Added Contributors section to `README.md`
- Cleaned fork-specific files

**Phase 1: i18n System (DE/EN switchable)**
- Created `I18nService` (`docs/js/services/i18n.js`) with EventTarget pattern
- Built ~250 translation keys across 14 namespaces in `en.json` and `de.json`
- Annotated ~150 HTML elements with `data-i18n` attributes
- Replaced ~100 hardcoded strings across 8 JS files with `t()` calls
- Added language switcher toggle (DE/EN) in header
- All 574 tests passing

**Phase 2: Project Rules**
- IndexedDB schema migration v1 -> v2 with versioned upgrade handler
- Project rules schema: editionModel, xmlSchema, transcription details, validation config
- Rules dialog with full CRUD (create, edit, export/import as JSON)
- Auto-populate context from project rules on session restore
- Prompt profile mapping from project rules

**Phase 3: Azure Mistral OCR**
- Added `azure-mistral` provider with `api-key` header authentication
- User-configurable endpoint URL for institutional Azure deployments
- OCR-only detection for validation fallback
- Endpoint field visibility toggle in LLM config dialog

**Phase 4: Integration and Stabilization**
- Replaced remaining hardcoded error strings with i18n `t()` calls
- Fixed test expectations for i18n key returns
- Updated ARCHITECTURE.md, DATA-SCHEMA.md, JOURNAL.md

### Key Decisions

1. **`--no-ff` merge**: Preserves Robert's contribution history as a visible block in `git log --first-parent`
2. **Lazy IDB migration**: Existing projects get `rules: null` on read rather than forcing schema update
3. **i18n fallback chain**: current lang -> EN -> key string itself (graceful degradation)
4. **Azure auth**: Uses `api-key` header (Azure convention) vs `Authorization: Bearer` (native Mistral)

---

## Session 34 (2026-02-14)

UX improvements and documentation update.

### What Was Done

**Welcome Overlay**
- Added first-visit onboarding dialog with logo, tagline, 5-step workflow overview, and action cards (New Project, Try Demo, Upload File, Open Project)
- "Don't show again" checkbox saving `welcome_dismissed` to localStorage settings
- Startup flow routing: active project -> restore dialog, first visit -> welcome overlay, dismissed + projects -> project list

**Umlaut Fix**
- Replaced 164 ASCII Umlaut substitutions (ae/oe/ue/ss) with real Unicode characters (ae->a, oe->o, ue->u, ss->ss) in de.json

**Editor Panel Title Fix**
- Shortened "Beschreibung / Transkription" to "Editor" (was wrapping on multiple lines)
- Added CSS `white-space: nowrap` safeguard to panel headers

**Markdown Transcription Rules Editor**
- Replaced 5 structured form fields (scriptType, language, period, paleographicHints, specialCharacters) with single Markdown textarea
- Added .md file upload button and preview toggle
- Backward compatibility migration: old structured format auto-converts to Markdown headings
- Markdown passed directly to LLM prompts as context (stored as `transcriptionRulesMarkdown` in state)

**Knowledge Vault Update**
- Updated 8 of 15 knowledge files to reflect current codebase state
- IMPLEMENTATION-PLAN.md: Phase 5 (i18n) marked complete, Phase 6 added and completed
- TESTING.md: Test count updated from 363 to 574
- ARCHITECTURE.md: File tree, providers, new sections (Post-Processing, Thinking Panel, Welcome Overlay, Prompt Profiles)
- DATA-SCHEMA.md: Transcription rules schema updated to Markdown format
- INDEX.md: New features added, version 2.3
- DESIGN-SYSTEM.md: v2.4 changelog
- IMPROVEMENTS.md: Completed items marked
- JOURNAL.md: Session 34 entry

### Key Decisions

1. **Markdown over structured fields**: Free-form Markdown gives experts full flexibility for transcription rules; LLMs understand Markdown natively
2. **Dual context injection**: Project Markdown rules are concatenated with per-session ContextManager output, keeping both systems independent
3. **Welcome overlay pattern**: Reuses existing `<dialog>` + glass-panel pattern, dismissal via localStorage settings
