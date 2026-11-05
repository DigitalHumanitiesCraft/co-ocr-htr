# Improvement Plan coOCR/HTR

Open work in two parts. The technical backlog can be implemented without a policy or design decision. The points waiting for the operator need an action or decision only the operator can take. Completed items leave this document; their history is in [JOURNAL.md](JOURNAL.md) and Git.

## Technical backlog

- [ ] PAGE-XML export writes all lines into one `TextRegion` and drops region geometry, region types and reading order of the source (`exportPageXml` in `docs/js/services/export.js`). Re-emit lines into their original regions; the parser already reads regions (`extractRegions`).
- [ ] Editor undo history is cleared when a new transcription arrives (`renderEditor` and `clearHistory` in `docs/js/editor.js`). The overwrite confirmation protects corrections, but undo should cover the replacement too.
- [ ] Transcribe, Describe and Export are enabled before any document is loaded.
- [ ] Hard-coded English strings remain in JavaScript: model info in `components/transcription.js`, the thinking panel title in `components/thinking.js`, provider error texts in `services/llm.js` and the messages of the validation rules.
- [ ] `tests/i18n.test.js` tests a copy of the i18n class defined inside the test file instead of `js/services/i18n.js`. `tests/i18n-dom.test.js` tests the real module; the copy should be replaced by tests of the real module.
- [ ] Containerfile for static serving (Podman/Docker) and a short deployment note covering GitHub Pages, container and local use, for the planned institutional fork.

## Waiting for the operator

These points need an action or decision only the operator can take. Each carries its evidence and a recommendation.

### Anthropic model list

The model list in `docs/index.html` offers `claude-sonnet-4-5-20250514` and `claude-haiku-4-5-20250514`; these dated identifiers do not match the published Claude 4.5 releases, and the current family is Claude 5 (`claude-sonnet-5-5`, `claude-haiku-5-5`). The OpenAI and Gemini entries were not checked against current provider lists. Recommendation: replace the two entries with current identifiers after a test call with a real key, which only the operator can make.

### Local API key

The gitignored `docs/config.local.js` holds a real Gemini key that the app loads on every local start. The e2e fixture blocks the file, so tests do not use it. Recommendation: replace it with a key that has a spending limit.

### File `nul` in the repository root

It contains the output of a ping command and is ignored by Git. Recommendation: delete it with `del \?\<repository path>\nul`, since `nul` is a reserved name on Windows.

### Licence field in `docs/package.json`

The field says `MIT`, which matches the global rule for code. The repository licence was changed to CC BY 4.0 after an external contribution under CC BY. Whether code stays MIT, moves to CC BY 4.0, or the contribution is separated is the operator's decision; the field then follows it.

## Not Implementing

| Item | Rationale |
|------|-----------|
| Backend for API calls | Would add hosting complexity; Ollama covers sensitive documents |
| TypeScript migration | Contradicts the no-build vanilla JavaScript approach |
| Phone layout | Below 768 px the app shows "Desktop recommended"; the three-panel workflow is not usable on a phone (decided November 2026) |
| Replacing every `innerHTML` | Escaping through `escapeHtml()` is applied consistently; a full rewrite costs more than it protects |
