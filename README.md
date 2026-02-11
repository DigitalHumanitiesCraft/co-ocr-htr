# coOCR/HTR-rk

> **Forked from [DigitalHumanitiesCraft/co-ocr-htr](https://github.com/DigitalHumanitiesCraft/co-ocr-htr)** by [Christopher Pollin](https://github.com/chpollin) (DH Craft Graz).

## Acknowledgements and License

This project is based on the excellent work of **Christopher Pollin** ([DH Craft](https://dhcraft.org/)), who designed and developed coOCR/HTR as an Editor-in-the-Loop tool for OCR/HTR verification of historical documents. The original architecture, design system, LLM integration, and Promptotyping approach originate from his upstream repository.

We gratefully acknowledge Christopher Pollin for:

- Developing and open-sourcing coOCR/HTR
- The innovative Promptotyping approach (documentation-driven AI development)
- Licensing under CC BY 4.0, enabling forks and further development

### License

This work, like the original, is licensed under the [Creative Commons Attribution 4.0 International License (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).

[![CC BY 4.0](https://licensebuttons.net/l/by/4.0/88x31.png)](https://creativecommons.org/licenses/by/4.0/)

**Attribution:** Christopher Pollin / DH Craft - [github.com/DigitalHumanitiesCraft/co-ocr-htr](https://github.com/DigitalHumanitiesCraft/co-ocr-htr)

---

## About This Fork

This fork is maintained by **Robert Klugseder** (Austrian Academy of Sciences, ACDH) and extends coOCR/HTR with features for medieval manuscript workflows:

- **Persistent project management** with IndexedDB (multiple projects, image storage)
- **Illuminated initials description** via Google Gemini (art-historical analysis)
- **Explicit validation provider configuration** for OCR-only models
- **Responsive panel layouts** with resize handles and CSS Container Queries
- **Improved UX** with custom dialogs, storage quota display, and tooltips

## Quick Start

### Live Demo

**[Try coOCR/HTR](https://rklugsederoeaw.github.io/co-ocr-htr-rk/)**

1. Click "Upload" > "Load Demo" to try with sample data
2. Click the model indicator to configure your LLM provider
3. Upload a document (image, PAGE-XML, METS-XML, IIIF manifest)
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

## Fork Changelog

<!-- CHANGELOG_START -->

For the complete development history before this fork, see the original repository: [DigitalHumanitiesCraft/co-ocr-htr](https://github.com/DigitalHumanitiesCraft/co-ocr-htr).

---

### Fork Milestone 1: Audit and Stability Foundation (2026-02-08)

Key changes:

- Security, robustness, and data-integrity audit fixes across core modules (67ff594, 74ea53e)
- LLM timeout tuning for cloud and local inference paths (a3bde4d)
- Local config loading hardened for localhost-only development usage (bfcc2e4, 4e6a1af)
- API connection test flow in configuration dialog (2d33195)

---

### Fork Milestone 2: IndexedDB Project Persistence (2026-02-08 to 2026-02-09)

Key changes:

- Project/session persistence model moved to IndexedDB stores (`projects`, `sessions`, `images`, `apiKeys`) (e2d99c5)
- Multi-project workflow (create, rename, switch, delete) (e2d99c5)
- Custom dialog flows replacing browser-native confirm/prompt interactions (c494152)
- Storage quota visualization in Settings (c494152)

---

### Fork Milestone 3: OCR-Only Validation and Mistral OCR (2026-02-09)

Key changes:

- Mistral OCR provider added (c005db4)
- Explicit validation provider configuration for OCR-only models (5ddce16)
- Validation priority model: explicit provider > automatic fallback > active provider (5ddce16)
- Regression hardening for dialog and validation edge cases (102be34, 38630e2, fca3853)

---

### Fork Milestone 4: Describe Workflow (2026-02-10)

Key changes:

- Gemini-based image description workflow for illuminated initials (22f9e1d)
- Description panel editing and per-page persistence on navigation/session save (88b94a1, f2c0603)
- Session restore fixes for description state and panel rendering (159cd21, ade8559, fd91d8d)

---

### Fork Milestone 5: Responsive and Resizable Workspace (2026-02-10)

Key changes:

- Responsive panel headers using container queries (9ca61ee)
- Horizontal 3-column resize with keyboard/mouse support and persistence (9ca61ee)
- Vertical resize for description vs. transcription panes (04c29d5)
- UI refinements for controls, indicators, and dialog positioning (cd1c227, d50339f, a42ff18, 7cfa5b1, e952df4, afbfc2f)

<!-- CHANGELOG_END -->

---

## Features

Baseline methodology and early system design come from the upstream project ([DigitalHumanitiesCraft/co-ocr-htr](https://github.com/DigitalHumanitiesCraft/co-ocr-htr)).  
This fork extends that base with additional persistence, workflow, and UX capabilities.

- **LLM providers**: Gemini, OpenAI, Anthropic, Ollama, Mistral OCR
- **Hybrid validation**: deterministic Validation + LLM Review
- **Import paths**: image upload, PAGE-XML, METS-XML, IIIF manifests
- **Export formats**: TXT, JSON, Markdown, PAGE-XML, TEI-XML, ZIP (multi-page)
- **Project persistence**: IndexedDB-backed projects/sessions/images with quota display
- **Multi-project workflow**: create, rename, switch, delete
- **Optional API key persistence**: user-controlled storage in IndexedDB
- **Describe feature**: Gemini-based image description for illuminated initials
- **Batch operations**: transcription, validation, and description across multi-page documents
- **Responsive workspace**: 3-column resize + vertical editor split
- **PWA support**: installable app with offline asset caching

---

## Usage Guides

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
- Green: < 70%, Yellow: 70-90%, Red: > 90%
- Images are stored separately in the IndexedDB `images` store (solves QuotaExceededError for large documents)

---

### Illuminated Initials Description

This feature visually analyzes manuscript pages and generates art-historical descriptions of illuminated initials, manuscript illumination, and decorative elements. It exclusively uses Google Gemini (best vision capabilities for art analysis).

**Prerequisite:** A valid Gemini API key must be configured (click the model indicator > select Gemini > enter API key).

**Describe a single page:**

1. Load a document (image upload, IIIF, or demo)
2. Click the **"Describe"** button in the editor toolbar
3. In the dialog, customize the analysis prompt or keep the default prompt
4. Click **"Describe"** - Gemini analyzes the image (approx. 10-15 seconds)
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

### Validation Provider for OCR-Only Models

OCR-only models like Mistral OCR or DeepSeek OCR are specialized for text recognition and cannot perform content validation. For hybrid workflows (OCR transcription + LLM validation), coOCR/HTR-rk supports explicit validation provider configuration.

**Automatic fallback (default):**

- When an OCR-only model is active and **no** validation provider is configured, the system first searches for a configured cloud validation provider
- Cloud fallback priority: Gemini > OpenAI > Anthropic
- For Ollama-based OCR workflows (e.g., DeepSeek-OCR), a local text-model fallback can be attempted (e.g., `llama3.2`) if no cloud key is configured
- Fallback selection is automatic when a suitable provider is available; otherwise, the UI prompts you to configure one explicitly

**Configure an explicit validation provider:**

1. Click the model indicator to open the API dialog
2. Select an OCR-only model (e.g., Mistral OCR) - a warning banner appears
3. In the **"Validation Configuration"** section, choose a validation model from the dropdown
4. Enter the API key for the validation provider (auto-filled if already stored)
5. Optional: Enable **"Store validation API key permanently"** for persistent storage

**Validation priority (three tiers):**

1. Explicitly configured validation provider (highest priority)
2. Automatic fallback to a configured cloud provider
3. Active provider (if it supports validation)

**Typical hybrid workflow:**

- **Transcription:** DeepSeek-OCR via Ollama (local) or Mistral OCR (cloud)
- **Validation:** Gemini Flash or GPT-5.2 Mini (cloud, affordable and fast)

---

### Responsive and Resizable Panels

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

**Below 1200px viewport width:** The layout automatically switches to 2 columns (validation panel hidden, resize handles deactivated).

**Below 768px viewport width:** A desktop-use warning is displayed.

---

## Architecture

coOCR/HTR-rk is a **browser-only SPA** served from `docs/`.  
There is no backend application layer; state and persistence live in the browser.  
Primary runtime network traffic is LLM API calls and optional IIIF resources.

### Runtime Layers (Current)

| Layer | Modules | Responsibility |
| --- | --- | --- |
| UI | `docs/index.html`, `docs/js/viewer.js`, `docs/js/editor.js`, `docs/js/ui.js`, `docs/js/components/*` | Viewer/editor/dialog UX, upload flows, panel interactions |
| State/Event | `docs/js/state.js` | Central `AppState` (`EventTarget`) with domain state + app events |
| Services | `docs/js/services/llm.js`, `docs/js/services/validation.js`, `docs/js/services/export.js`, `docs/js/services/storage.js`, `docs/js/services/parsers/*` | LLM abstraction, hybrid validation, export, persistence, XML parsing |
| PWA | `docs/js/pwa.js`, `docs/sw.js`, `docs/manifest.json` | Service worker caching, offline indicator, installability |

### State and Event Model

- `appState` in `docs/js/state.js` is the single source of truth for:
  - Project/session context
  - Current document/page + multi-page collections
  - Transcription, validation, and description data
  - Batch operation status
  - UI state (selection, loading, active dialog)
- UI modules communicate via `CustomEvent`s on `appState` (e.g. `transcriptionComplete`, `validationComplete`, `selectionChanged`, `pageChanged`).

### Persistence Model (Current)

- `localStorage` stores lightweight synchronous settings:
  - `coocr:settings`
  - `coocr:descriptionPrompt`
  - `coocr:validationPrompt`
  - `coocr:activeProjectId`
- `IndexedDB` (`coocr-htr`) stores structured project data:
  - `projects`
  - `sessions`
  - `images`
  - `apiKeys` (optional, only when user enables persistence)

### LLM and Validation Flow

- Active provider handles transcription (`Gemini`, `OpenAI`, `Anthropic`, `Mistral OCR`, `Ollama`).
- Validation provider resolution is:
  1. Explicit validation provider/model (if configured)
  2. Automatic fallback when OCR-only model is active
  3. Active provider (standard case)
- API keys are always used in runtime memory; optional persistence can restore keys from IndexedDB on startup.

### Import/Export and Viewer

- Import: image upload, PAGE-XML, METS-XML, IIIF manifests.
- Viewer: OpenSeadragon + SVG overlay for region/line synchronization.
- Export: TXT, JSON, Markdown, PAGE-XML, TEI-XML, plus ZIP export for multi-page batches.

For deeper technical details, see `knowledge/ARCHITECTURE.md`.

## Documentation

Knowledge base in `knowledge/`:

- [VISION.md](knowledge/VISION.md) - Project goals
- [METHODOLOGY.md](knowledge/METHODOLOGY.md) - Scientific background
- [ARCHITECTURE.md](knowledge/ARCHITECTURE.md) - Technical architecture
- [VALIDATION.md](knowledge/VALIDATION.md) - Validation system
- [MODEL-LANDSCAPE.md](knowledge/MODEL-LANDSCAPE.md) - OCR/HTR model comparison

## Contributors

| Role            | Person                                                       |
| --------------- | ------------------------------------------------------------ |
| Original author | [Christopher Pollin](https://github.com/chpollin) (DH Craft) |
| Fork maintainer | Robert Klugseder (OEAW / ACDH-CH)                            |
| AI assistance   | Claude Code (Anthropic) and Codex CLI (OpenAI)               |

---

*Based on [co-ocr-htr](https://github.com/DigitalHumanitiesCraft/co-ocr-htr) by Christopher Pollin, licensed under CC BY 4.0.*
