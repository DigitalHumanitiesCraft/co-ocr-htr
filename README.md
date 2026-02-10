# coOCR/HTR-rk

> **Forked from [DigitalHumanitiesCraft/co-ocr-htr](https://github.com/DigitalHumanitiesCraft/co-ocr-htr)** by [Christopher Pollin](https://github.com/chpollin) (DH Craft Graz).

## Acknowledgements and License

This project is based on the excellent work of **Christopher Pollin** ([DH Craft](https://dhcraft.org/)), who designed and developed coOCR/HTR as an Editor-in-the-Loop tool for OCR/HTR verification of historical documents. The original architecture, design system, LLM integration, and Promptotyping approach originate from his upstream repository.

We gratefully acknowledge Christopher Pollin for:

- Developing and open-sourcing coOCR/HTR
- The innovative Promptotyping approach (documentation-driven AI development)
- Licensing under CC BY 4.0, enabling forks and further development

### License

This work -- like the original -- is licensed under the [Creative Commons Attribution 4.0 International License (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).

[![CC BY 4.0](https://licensebuttons.net/l/by/4.0/88x31.png)](https://creativecommons.org/licenses/by/4.0/)

**Attribution:** Christopher Pollin / DH Craft -- [github.com/DigitalHumanitiesCraft/co-ocr-htr](https://github.com/DigitalHumanitiesCraft/co-ocr-htr)

---

## About This Fork

This fork is maintained by **Robert Klugseder** (Austrian Academy of Sciences, ACDH) and extends coOCR/HTR with additional features for working with medieval manuscripts, in particular:

- **Persistent project management** with IndexedDB (multiple projects, image storage)
- **Illuminated initials description** via Google Gemini (art-historical analysis)
- **Explicit validation LLM configuration** for OCR-only models
- **Responsive panel layouts** with resize handles and CSS Container Queries
- **Improved UX** with custom dialogs, storage quota display, and tooltips

## Quick Start

### Live Demo

**[Try coOCR/HTR](https://rklugsederoeaw.github.io/co-ocr-htr-rk/)**

1. Click "Upload" > "Load Demo" to try with sample data
2. Click the model indicator to configure your LLM provider
3. Upload a document (image, PAGE-XML, IIIF manifest)
4. Click "Transcribe" for LLM transcription
5. Review results and export

### Local Development

```bash
git clone https://github.com/rklugsederoeaw/co-ocr-htr-rk.git
cd co-ocr-htr-rk
npx serve docs -l 3000
# http://localhost:3000
```

No build step required. Tests:

```bash
cd docs && npm install && npm test
```

---

## Changelog (Milestones)

<!-- CHANGELOG_START -->

> Milestones 1--6 document the work of the original author **Christopher Pollin** (DH Craft  Graz) in the upstream repository. Starting with Milestone 7, the fork-specific development by **Robert Klugseder** begins.

---

### Milestone 1: Project Initialization and Core Architecture (2026-01-16)

**Summary:** Christopher Pollin establishes the project foundation -- knowledge base, modular architecture, state management, and GitHub Pages deployment.

Key changes:

- Project initialization with consolidated knowledge base (`knowledge/`) (db315cf)
- Modular prototype v2 with implementation roadmap (3e7f219)
- Core services for state management, LLM abstraction, storage (0c4ae1c)
- Rename to `docs/` for GitHub Pages deployment (93a2ed8)
- Dialogs, upload manager, PAGE-XML parser, transcription component (8060c3a)
- Validation engine with deterministic rules (130f70b)
- Export service for TXT, JSON, Markdown (4e78d0f)
- Inline editing with undo/redo and keyboard shortcuts (5bd62bc)

---

### Milestone 2: UI Expansion and Demo System (2026-01-16)

**Summary:** Demo loader, viewer improvements, knowledge vault, guided workflow, and extensive CSS refactoring.

Key changes:

- Demo loader with samples dropdown and viewer empty state (785a38d)
- Knowledge vault menu with info states (68bd5b3)
- Flexible editor modes and guided workflow (1823692)
- Design system v2.1 with English knowledge base (4ff9df7)
- Viewer pan/zoom, METS parser for multi-page documents (38b4ae5)
- Help/About pages and multi-page navigation (0d1bb55)
- Critical runtime bugfixes and CSS cleanup (ba43546, b5e55bc)

---

### Milestone 3: PAGE-XML Export, Tests, and IIIF Integration (2026-01-17 -- 2026-01-18)

**Summary:** PAGE-XML export, first automated tests, OpenSeadragon viewer with region synchronization, and IIIF support.

Key changes:

- 4 critical bugs fixed, PAGE-XML export implemented (6645959)
- PAGE-XML export UI and METS-XML upload support (dce0b94)
- First comprehensive tests for export and validation services (11adef4)
- OpenSeadragon viewer with region synchronization (e90d8b3)
- IIIF dialog for loading images from external repositories (d4bcbdb)
- JS utility modules extracted (DOM, text formatting, constants) (e0f1475)
- CSS accessibility and consistency improvements (ca3f10c)

---

### Milestone 4: DeepSeek-OCR, Validation UX, and Vision Documentation (2026-01-19 -- 2026-02-03)

**Summary:** DeepSeek-OCR integration, redesigned validation UI with highlighting, RTL support, batch transcription, and VISION.md.

Key changes:

- API dialog redesign with DeepSeek-OCR integration (3c86323)
- Validation panel UX improved and generalized (ceb2ee4)
- Validation-to-image highlighting with graceful degradation (e275165)
- Unified AI content color system (violet) (4d70411)
- RTL support, batch transcription, IIIF loading screen (a7843ca)
- Batch validation with multi-page persistence (1b1f4cc)
- VISION.md with project goals and success criteria (4425770)
- License change to CC BY 4.0 (80a09e0)

---

### Milestone 5: TEI-XML, PWA, Security, and Batch Processing (2026-02-04)

**Summary:** TEI-XML export, progressive web app, security improvements, Ollama/DeepSeek-OCR bugfixes, and complete batch processing.

Key changes:

- TEI-XML export format for digital editions (038ed25)
- PWA support for offline usage (9209c73)
- API key persistence removed, security notes added (c6d729b)
- Local config file for API keys (`config.local.js`) (0585280)
- Model-centric LLM configuration (4bd80ce)
- Validation fallback for OCR-only models like DeepSeek-OCR (b770877)
- Batch processing for multi-page documents (2ce7db2)
- State and storage tests expanded (ad25ffe)
- Raitbuch sample (15th century) from the DoCTA project (ef92d3a)

---

### Milestone 6: Documentation and Final Bugfixes of the Original (2026-02-04 -- 2026-02-05)

**Summary:** Knowledge vault redesign, functional triad taxonomy, and final stability fixes before the fork.

Key changes:

- Functional triad taxonomy in METHODOLOGY.md (8f763c2)
- Knowledge vault overview with 5 design principles (bee94c1)
- Session restore dialog and multi-page navigation fixed (a8203bb)
- Page navigation arrows and batch arrays corrected (607f3f2)
- Upload dropdown, demo badges, clickable model indicator (8d219d5)
- OpenAI models updated to GPT-5.2 (e3fb2d9)

---

> **-- From here: Fork-specific development (Robert Klugseder) --**

---

### Milestone 7: Comprehensive Code Audit and Stability (2026-02-08)

**Summary:** Two comprehensive code audits (Claude + Codex) with a total of 37 findings resolved -- XSS vulnerabilities, data loss risks, timeout optimization, and connection tests.

Key changes:

- Full codebase audit: 7 HIGH, 12 MEDIUM, 10 LOW findings resolved (67ff594)
- Codex audit: 8 additional findings -- data loss, XSS, runtime errors (74ea53e)
- LLM timeouts optimized: 240s cloud, 480s Ollama (a3bde4d)
- config.local.js only loaded on localhost, 404 errors suppressed (bfcc2e4, 4e6a1af)
- Connection test button with inline status and real API calls (2d33195)
- Automated UI tests via Playwright MCP (c7df936)
- CLAUDE.md completely rewritten with architecture and data flows (2c94ae3)

---

### Milestone 8: IndexedDB Migration and Project Management (2026-02-08 -- 2026-02-09)

**Summary:** Migration from localStorage to IndexedDB with multi-project management, custom dialogs, and storage quota display.

Key changes:

- Migration to IndexedDB with 4 stores (projects, sessions, images, apiKeys) (e2d99c5)
- Multi-project support: create, rename, switch, delete (e2d99c5)
- Custom dialogs replace browser-native prompt()/confirm() (c494152)
- Storage quota display with progress bar in settings (c494152)
- Unified entire application UI language to English (787e9d9)
- Help button now opens dialog instead of separate page (bf96d68)

---

### Milestone 9: Mistral OCR and Validation Provider (2026-02-09)

**Summary:** New Mistral OCR provider, explicit validation LLM configuration for OCR-only models, and extensive audit fixes.

Key changes:

- Mistral OCR integrated as new provider (c005db4)
- Explicit validation provider configuration for OCR-only models (5ddce16)
- 3-tier validation priority: Explicit > Auto-fallback > Active provider (5ddce16)
- 25 audit findings resolved: data integrity, security, robustness (5a6f27f, a128d95, 8bf91a3, e437adc)
- Regression tests for audit fixes (102be34)
- Validate button correctly enabled when transcription exists (38630e2)
- Dialog closure on text selection outside prevented (fca3853)

---

### Milestone 10: Illuminated Initials Description (2026-02-10)

**Summary:** New Describe feature for art-historical analysis of manuscript pages via Gemini API with persistent per-page assignment.

Key changes:

- Describe feature: Gemini-based visual analysis of manuscript pages (22f9e1d)
- Description panel in editor with debounce-backed editing (22f9e1d)
- Per-page descriptions persisted on page switch and session save (88b94a1)
- Panel destruction by editor innerHTML rebuild fixed (159cd21)
- Debounced edits flushed synchronously before page snapshot (f2c0603)
- Description panel correctly displayed on session restore (ade8559)
- Audit findings for description feature resolved (fd91d8d)

---

### Milestone 11: Responsive Design and Panel Resize (2026-02-10)

**Summary:** Responsive panel headers with CSS Container Queries, horizontal and vertical resize between panels, and UI polishing.

Key changes:

- Responsive panel headers with CSS Container Queries (9ca61ee)
- Horizontal resize handles between the 3 columns with drag, keyboard, and persistence (9ca61ee)
- Vertical resize between description and transcription panels (04c29d5)
- Explicit collapse button for description panel (cd1c227)
- LLM model indicator styled as unified primary button (d50339f, a42ff18)
- Pen icon for Transcribe and primary Describe button (9b9d411)
- Responsive header controls and dialog positioning optimized (7cfa5b1)
- Button heights and border radius unified (e952df4, afbfc2f)

<!-- CHANGELOG_END -->

---

## Features (Original + Fork Extensions)

### Inherited from Original

- **Multi-provider LLM integration**: Gemini, OpenAI, Anthropic, Ollama
- **Hybrid validation**: Deterministic rules + LLM-as-Judge
- **Expert-in-the-Loop**: Critical expert validation workflow
- **Document types**: Letters, diaries, account books, inventories
- **IIIF support**: Load documents from IIIF-compatible repositories
- **RTL support**: Arabic, Hebrew, and other RTL scripts
- **Batch processing**: Single pages or entire documents
- **PAGE-XML/METS-XML import**: Compatible with Transkribus
- **Export formats**: TXT, JSON, Markdown, PAGE-XML, TEI-XML, ZIP
- **PWA support**: Offline usage after first load

### Fork Extensions

- **IndexedDB project management**: Persistent storage, image store, quota display
- **Multi-project support**: Create, rename, switch, delete projects
- **Illuminated initials description**: Gemini-based art-historical image analysis
- **Custom analysis prompts**: User-defined focus areas (iconography, style, materials)
- **Validation LLM**: Explicit configuration for OCR-only models (hybrid workflow)
- **Responsive panels**: Container Queries, resizable 3-column layout
- **Vertical pane resize**: Description and transcription panels individually scalable
- **Custom dialogs**: Replace browser-native prompt()/confirm()
- **Persistent API keys**: Optional storage in IndexedDB
- **ESLint + audit**: Complete code audit, 0 errors/warnings

---

## Usage Guides (Fork Features)

### Project Management

coOCR/HTR stores work sessions in the browser's IndexedDB. Each project contains images, transcriptions, validations, and descriptions independently.

**Create a new project:**

1. Click the document name in the header (or the dropdown icon next to it)
2. In the project dialog, click **"New Project"**
3. Enter a project name (max. 100 characters) and confirm with **"Create"**
4. The new project becomes active immediately

**Switch between projects:**

1. Click the document name in the header
2. Select the desired project from the project list
3. Images and transcriptions are loaded automatically

**Rename/delete projects:**

- The project list shows **Rename** and **Delete** icons next to each project
- Deletion requires confirmation in a custom dialog

**Storage quota:**

- Under Settings, the current IndexedDB storage usage is shown as a progress bar
- Green: < 70%, Yellow: 70--90%, Red: > 90%
- Images are stored separately in the IndexedDB `images` store (solves QuotaExceededError for large documents)

---

### Illuminated Initials Description

This feature visually analyzes manuscript pages and generates art-historical descriptions of illuminated initials, manuscript illumination, and decorative elements. It exclusively uses Google Gemini (best vision capabilities for art analysis).

**Prerequisite:** A valid Gemini API key must be configured (click the model indicator > select Gemini > enter API key).

**Describe a single page:**

1. Load a document (image upload, IIIF, or demo)
2. Click the **"Describe"** button in the editor toolbar
3. In the dialog, customize the analysis prompt or keep the default prompt
4. Click **"Describe"** -- Gemini analyzes the image (approx. 10--15 seconds)
5. The description appears in the **"Image Description"** panel below the toolbar

**Customize the analysis prompt:**

- The default prompt focuses on: Historiated initials, decorative elements, iconography, artistic period, technical details
- Use **"Load Default Prompt"** to restore the default prompt at any time
- Custom prompts are saved automatically and reused on the next invocation
- Example for a specific prompt: *"Identify all biblical scenes and iconographic elements. Name the depicted saints and their attributes."*

**Multi-page documents:**

- For multi-page documents (IIIF, METS), a page selection appears in the dialog
- **"Current page only"** describes only the current page
- **"All pages"** starts a batch description with progress display
- Each page receives its own independent description

**Edit descriptions:**

- The description panel is directly editable (textarea)
- Changes are saved automatically (debounce: 500ms)
- The collapse button (chevron on the right) toggles the panel open/closed
- **"Copy"** copies the description to the clipboard

**Export descriptions:**

- JSON export includes `description` with raw text, prompt, model, and timestamp
- Markdown export includes the description as a separate section before the transcription

---

### Validation LLM for OCR-Only Models

OCR-only models like Mistral OCR or DeepSeek OCR are specialized for text recognition and cannot perform content validation. For the hybrid workflow (local transcription + cloud validation), this fork provides explicit validation provider configuration.

**Automatic fallback (default):**

- When an OCR-only model is active and **no** validation provider is configured, the system automatically searches for a configured cloud provider as fallback
- Priority: Gemini > OpenAI > Anthropic > Ollama
- No action required -- works transparently

**Configure an explicit validation provider:**

1. Click the model indicator to open the API dialog
2. Select an OCR-only model (e.g., Mistral OCR) -- a warning banner appears
3. In the **"Validation Configuration"** section, choose a validation model from the dropdown
4. Enter the API key for the validation provider (auto-filled if already stored)
5. Optional: Enable **"Store validation API key permanently"** for persistent storage

**Validation priority (3 tiers):**

1. Explicitly configured validation provider (highest priority)
2. Automatic fallback to a configured cloud provider
3. Active provider (if it supports validation)

**Typical hybrid workflow:**

- **Transcription:** Mistral OCR or DeepSeek OCR (local via Ollama, privacy-compliant)
- **Validation:** Gemini Flash or GPT-5.2 Mini (cloud, affordable and fast)

---

### Responsive Panels and Resize

The 3-column layout (Viewer | Editor | Validation) is freely scalable.

**Horizontal resize (between columns):**

- Vertical resize handles are positioned between the three panels (visible as a thin line)
- **Mouse:** Drag the handle to adjust column widths
- **Keyboard:** Focus the handle (Tab), then use Arrow Left/Right (+/- 10px, with Shift: +/- 50px)
- **Reset:** Double-click the handle to restore the default ratios (40/35/25%)
- Column ratios are saved to localStorage and restored on next load
- Minimum panel width: 200px

**Vertical resize (description/transcription):**

- When the description panel is visible, a horizontal resize handle appears between the description and transcription areas
- Drag to adjust the heights of both areas
- Minimum height per area: 80px

**Responsive button labels:**

- When panels are narrow, button labels are automatically hidden (only icons remain visible)
- Editor panel: below 750px width (common due to many buttons)
- All panels: below 400px width (generic fallback)
- Tooltips and info icons are also hidden below 400px

**Below 1200px screen width:** The layout automatically switches to 2 columns (validation panel is hidden, resize handles deactivated).

**Below 768px:** A mobile warning is displayed (desktop application).

---

## Architecture

See the [original README](https://github.com/DigitalHumanitiesCraft/co-ocr-htr) and `knowledge/ARCHITECTURE.md` for the base architecture.

Fork-specific additions:

```
docs/
+-- js/
|   +-- components/
|   |   +-- description.js     # NEW: Image description (illuminated initials)
|   +-- utils/
|   |   +-- panelResize.js     # NEW: Resizable 3-column grid
|   |   +-- tooltips.js        # NEW: Dynamic tooltip positioning
|   |   +-- constants.js       # Extended: Panel resize constants
+-- tests/
|   +-- description.test.js    # NEW: Description tests
|   +-- llm-validation-provider.test.js  # NEW: Validation provider tests
```

## Documentation

Original knowledge base in `knowledge/`:

- [VISION.md](knowledge/VISION.md) -- Project goals
- [METHODOLOGY.md](knowledge/METHODOLOGY.md) -- Scientific background
- [ARCHITECTURE.md](knowledge/ARCHITECTURE.md) -- Technical architecture
- [VALIDATION.md](knowledge/VALIDATION.md) -- Validation system
- [MODEL-LANDSCAPE.md](knowledge/MODEL-LANDSCAPE.md) -- OCR/HTR model comparison

## Contributors

| Role            | Person                                                       |
| --------------- | ------------------------------------------------------------ |
| Original author | [Christopher Pollin](https://github.com/chpollin) (DH Craft) |
| Fork maintainer | Robert Klugseder (OEAW / ACDH-CH)                            |
| AI assistance   | Claude Code (Anthropic) and Codex CLI (OpenAI)               |

---

*Based on [co-ocr-htr](https://github.com/DigitalHumanitiesCraft/co-ocr-htr) by Christopher Pollin, licensed under CC BY 4.0.*
