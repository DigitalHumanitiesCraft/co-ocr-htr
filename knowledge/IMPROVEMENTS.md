# Improvement Plan coOCR/HTR

Open improvements, grouped by area. Completed items leave this list; their history is in [JOURNAL.md](JOURNAL.md) and Git.

## Correctness

- [ ] A hung provider blocks transcription and validation until the request times out, with no way to cancel. Add an abort control to the single-page operations, as batch operations already have.
- [ ] The PAGE-XML export writes all lines into one `TextRegion` and drops region geometry, region types and reading order of the source. Re-emit lines into their original regions.
- [ ] Lines inserted in the editor have no geometry and are exported without `Coords`, which the PAGE schema requires. Decide between a placeholder and a warning.
- [ ] PAGE-XML confidence round trip: imported `conf` values are mapped to categories and exported as fixed numbers, and lines without `conf` get an invented value.
- [ ] TEI export maps the uncertainty marker `[?]` to `<gap reason="illegible"/>`, which merges uncertain and illegible readings.
- [ ] Editor undo history is cleared when a new transcription arrives. The overwrite confirmation protects corrections, but undo should cover the replacement as well.
- [ ] The diff view compares lines by position. Align lines with `utils/lineAlign.js` first so an inserted line does not mark all later lines as changed.
- [ ] Ctrl+Z is handled for the whole page and undoes editor changes while typing in other fields. Scope the handler to the editor.
- [ ] The IIIF Presentation 3 sample shows `[object Object]` as document name because language-map labels are not resolved in `viewer.js`.
- [ ] The settings "Show line numbers", "Highlight uncertain readings" and "Auto-validate" are stored but have no effect.
- [ ] TIFF is listed as an accepted format but does not load.

## Security

- [ ] The Gemini API key is sent as URL query parameter. Send it in the `x-goog-api-key` header.
- [ ] OpenSeadragon, its SVG overlay and JSZip load from CDNs at runtime without integrity attributes. Vendor them into `docs/` or pin exact versions with SRI.
- [ ] The latent `filename` interpolation in `showBatchProgress` (transcription and validation components) is unescaped. Both methods are currently unused; remove or escape them.

## Accessibility

- [ ] `<html lang>` stays `en` after switching to German.
- [ ] Secondary text (`--text-secondary`) and the amber status colour fall below 4.5:1 contrast on the light backgrounds.
- [ ] The resize separators lack `aria-valuenow`, `#enableLLM` has no label, the model indicator is a clickable `span`, and the skip link does not become visible on focus.
- [ ] Hard-coded English strings remain in JavaScript (model info, thinking panel title, provider error texts, rule result messages).

## Usability

- [ ] Toasts disappear after three seconds, error toasts included.
- [ ] The status bar shows a green model indicator before any key is configured.
- [ ] Malformed PAGE-XML produces both an error toast with the raw parser message and a success toast.
- [ ] A PAGE-XML file is attached to an unrelated image without checking `imageFilename` or dimensions.

## Institutional deployment

- [ ] Containerfile for static serving (Podman/Docker) and a short deployment note covering GitHub Pages, container and local use.
- [ ] Document the institutional fork pattern and how upstream changes are merged.

## Not Implementing

| Item | Rationale |
|------|-----------|
| Backend for API calls | Would add hosting complexity; Ollama covers sensitive documents |
| TypeScript migration | Contradicts the no-build vanilla JavaScript approach |
| Replacing every `innerHTML` | Escaping through `escapeHtml()` is applied consistently; a full rewrite costs more than it protects |
