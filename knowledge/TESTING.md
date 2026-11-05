# Testing Strategy

coOCR/HTR has two test layers. Vitest unit tests under `docs/tests/` cover services, parsers, state and selected component logic in jsdom. Playwright specs under `docs/tests/e2e/` drive the real page in Chromium for flows that depend on layout, focus or the interplay of components. The test files themselves are the source of truth for what is covered; `npx vitest run` reports the current count.

## Running the tests

```bash
cd docs
npx vitest run        # unit tests, single run
npm test              # unit tests, watch mode
npm run lint          # ESLint over js/, tests/ and sw.js
npm run test:e2e      # Playwright specs
```

The Playwright configuration in `docs/playwright.config.js` serves `docs/` itself. On a developer machine that folder may hold a gitignored `config.local.js` with real API keys, which the app loads on start. The specs mock every LLM call, so no key leaves the browser, but a run against a copy of `docs/` without that file is the safer default. No CI workflow is configured, so both layers run locally before a commit.

## Unit tests

Unit tests target pure functions, business logic and parsers, where a test is cheap and stable:

- LLM provider abstraction, prompt building, streaming parsers and error classification (`llm.test.js`, `llm-streaming.test.js`, `llm-validation-provider.test.js`)
- central state, page handling and auto-save (`state.test.js`)
- export formats, BOM and XML escaping, PAGE-XML round trip (`export.test.js`, `page-xml.test.js`, `page-xml-roundtrip.test.js`, `apply-export-integration.test.js`)
- validation rules, LLM review and applying suggestions (`validation.test.js`, `validation-apply.test.js`, `postprocess.test.js`)
- storage, i18n, text formatting, line alignment, samples loading and the service worker fetch strategy
- regression tests for single component behaviours that can run in jsdom with mocked dependencies, such as key persistence in the settings dialog and the overwrite confirmation before a new transcription
- the projection of `knowledge/` into `docs/knowledge/` (`knowledge-projection.test.js`)

Every defect fix adds a test that fails without the fix.

## End-to-end tests

The Playwright specs load a demo sample or inject state into `appState`, then check the human-in-the-loop flow (validate, apply, diff, undo, export), the thinking panel, the narrow-screen layout and keyboard selection of the export format. LLM responses are mocked or injected, never requested from a provider.

Still without automated coverage are the upload paths (file picker, drag and drop, IIIF dialog), the viewer with OpenSeadragon, batch operations over all pages, offline behaviour and an accessibility audit. A useful next set of specs walks the five steps of the status bar with mocked providers, including the error responses 401, 429 and 500 and an empty answer.

## Known pitfall: global regex state

A regular expression with the `g` flag keeps `lastIndex` between `test()` calls, so a second call on the same pattern can fail. Reset `lastIndex` before reuse or build a fresh pattern. This bug occurred once in `textFormatting.js`.

## Related Documents

- [ARCHITECTURE.md](ARCHITECTURE.md) for the module structure
- [SECURITY.md](SECURITY.md) for escaping and key handling
