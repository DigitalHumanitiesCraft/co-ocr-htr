# Improvement Plan coOCR/HTR

Open work in two parts. The technical backlog can be implemented without a policy or design decision. The operator decisions need an answer first; each names two options, a recommendation and the evidence. Completed items leave this document; their history is in [JOURNAL.md](JOURNAL.md) and Git.

## Technical backlog

- [ ] PAGE-XML export writes all lines into one `TextRegion` and drops region geometry, region types and reading order of the source (`exportPageXml` in `docs/js/services/export.js`). Re-emit lines into their original regions; the parser already reads regions (`extractRegions`).
- [ ] Editor undo history is cleared when a new transcription arrives (`renderEditor` and `clearHistory` in `docs/js/editor.js`). The overwrite confirmation protects corrections, but undo should cover the replacement too.
- [ ] Transcribe, Describe and Export are enabled before any document is loaded.
- [ ] Hard-coded English strings remain in JavaScript: model info in `components/transcription.js`, the thinking panel title in `components/thinking.js`, provider error texts in `services/llm.js` and the messages of the validation rules.
- [ ] `tests/i18n.test.js` tests a copy of the i18n class defined inside the test file instead of `js/services/i18n.js`. `tests/i18n-dom.test.js` tests the real module; the copy should be replaced by tests of the real module.
- [ ] Containerfile for static serving (Podman/Docker) and a short deployment note covering GitHub Pages, container and local use, for the planned institutional fork.

## Operator decisions

### Public knowledge page

`docs/knowledge.html` loads `knowledge/*.md`, but GitHub Pages runs Jekyll on `docs/` (no `.nojekyll`) and serves those files as `.html`, so the page is broken on the live site (`/co-ocr-htr/knowledge/VISION.md` returns 404, `VISION.html` returns 200). The projection also publishes `JOURNAL.md` and `IMPLEMENTATION-PLAN.md`.

- Option A: remove `knowledge.html`, `docs/knowledge/` and `scripts/sync-knowledge.js`, and link the knowledge folder on GitHub from the about page.
- Option B: add `docs/.nojekyll` and keep the page, limited to reader-facing documents (VISION, METHODOLOGY, MODEL-LANDSCAPE, DESIGN-SYSTEM, ARCHITECTURE, VALIDATION, DATA-SCHEMA) by dropping JOURNAL and IMPLEMENTATION-PLAN from its `data-doc` list.
- Recommendation: A. The global publication rule keeps `knowledge/` off served pages even in public repositories, the repository already shows the documents rendered, and A removes a sync script and its test.

### Third-party scripts from CDNs

OpenSeadragon (`openseadragon@4.1`, floating minor version) and its SVG overlay (unversioned, from `openseadragon.github.io`) load in `docs/index.html`, JSZip 3.10.1 loads at export time in `docs/js/services/export.js`. None carries an integrity attribute, in a page that holds API keys, and ZIP export fails offline.

- Option A: vendor the three files into `docs/vendor/` with their licences and load them locally.
- Option B: keep the CDNs, pin exact versions and add `integrity` and `crossorigin` attributes.
- Recommendation: A. The house rule for static DH applications asks for vendored libraries and no runtime CDN, and it also fixes offline ZIP export. It needs the authorisation to download the three files from npm.

### Settings without effect

The settings dialog stores options that no code reads. A code search finds no reader outside `docs/js/components/dialogs.js` for "Show line numbers", "Highlight uncertain readings" and "Default perspective"; the perspectives feature was removed in February 2026. "Auto-validate after transcription" is stored but never triggers a validation.

- Option A: remove the four controls and their storage keys.
- Option B: implement them.
- Recommendation: A. None is part of the five-step workflow, and controls without effect mislead users in a workshop.

### Contrast of secondary text and the amber status colour

`--text-secondary` (#8a7e72) reaches 3.5 to 4.0:1 on the light backgrounds and `--uncertain` (#c4973a) 2.5 to 2.7:1, below the 4.5:1 that WCAG 2.2 AA requires for normal text. axe-core counted these as the largest group of violations.

- Option A: darken the tokens in `docs/css/variables.css`, for example `--text-secondary: #6f6459` (5.2 to 5.8:1) and, for amber text, `#7d5f17` (5.3 to 6.0:1), keeping the lighter amber for dots and borders.
- Option B: keep the palette and accept the AA violations.
- Recommendation: A. It is a two-token change; the visual impression changes slightly, which is a design call.

### Inserted lines without geometry

Lines added in the editor have no coordinates and are exported without `Coords`, which the PAGE 2019 schema requires for `TextLine`. Tools such as Transkribus may reject the file.

- Option A: export them with a degenerate placeholder polygon and mark them in a `custom` attribute.
- Option B: keep omitting `Coords` and show a warning in the export dialog naming the affected lines.
- Recommendation: B. It invents no geometry, which the project ruled out in October 2026, and makes the schema gap visible before the file is used downstream.

### Cancel for single-page operations

A hung provider blocks single-page transcription and validation until the request times out (240 s, `CLOUD_TIMEOUT_MS` in `docs/js/services/llm.js`). Batch operations already have an abort control.

- Option A: add a cancel button to the loading overlay, wired to an `AbortController`.
- Option B: shorten the timeout instead.
- Recommendation: A. Large documents legitimately need long requests, so a shorter timeout would break real work.

### Anthropic model list

The model list in `docs/index.html` offers `claude-sonnet-4-5-20250514` and `claude-haiku-4-5-20250514`; these dated identifiers do not match the published Claude 4.5 releases, and the current family is Claude 5 (`claude-sonnet-5-5`, `claude-haiku-5-5`). The OpenAI and Gemini entries were not checked against current provider lists.

- Option A: replace the two entries with current identifiers after a test call with a real key.
- Option B: remove the Anthropic entries until someone verifies them.
- Recommendation: A, with the test call made by the operator, since only a real key shows availability.

### Phone screens

Below 768 px the app shows only "Desktop recommended" with no way to continue.

- Option A: keep the block.
- Option B: add a "Continue anyway" link.
- Recommendation: A for the workshop, which runs on laptops; the three-panel layout is not usable on a phone.

### Repository housekeeping

- The local `docs/config.local.js` holds a real Gemini key. It is gitignored and the e2e fixture now blocks it, but a key with a spending limit or a test project key is safer. Recommendation: replace it with a restricted key.
- The file `nul` in the repository root contains the output of a ping command; it is ignored by Git. Recommendation: delete it (`del \\?\C:\...\co-ocr-htr\nul`, since `nul` is a reserved name on Windows).
- `docs/package.json` declares `"license": "MIT"` while the code is published under CC BY 4.0 after an external contribution under CC BY. Recommendation: set the field to `CC-BY-4.0` so that package metadata matches the licence decision.

## Not Implementing

| Item | Rationale |
|------|-----------|
| Backend for API calls | Would add hosting complexity; Ollama covers sensitive documents |
| TypeScript migration | Contradicts the no-build vanilla JavaScript approach |
| Replacing every `innerHTML` | Escaping through `escapeHtml()` is applied consistently; a full rewrite costs more than it protects |
