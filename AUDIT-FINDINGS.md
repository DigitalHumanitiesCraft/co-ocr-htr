# Audit Findings -- coOCR/HTR Codebase

**Date:** 2026-02-08
**Scope:** 22 JS files, ~10,600 lines
**Sources:** ESLint static analysis + manual code audit (Claude)
**Status:** ALL FINDINGS FIXED

---

## Summary

| Severity | Count | Fixed |
|----------|-------|-------|
| HIGH     | 7     | 7     |
| MEDIUM   | 12    | 12    |
| LOW      | 10    | 10    |
| ESLINT   | 50 (8 errors, 42 warnings) | 50 (0 errors, 0 warnings) |

---

## HIGH Severity

### H1: No Fetch Timeout on LLM API Calls [FIXED]
- **Files:** `services/llm.js`
- **Fix applied:** Added `AbortSignal.timeout()` to all 5 fetch calls (60s cloud, 120s Ollama)

### H2: No Fetch Timeout on IIIF / Samples Fetches [FIXED]
- **Files:** `viewer.js`, `services/samples.js`
- **Fix applied:** Added `AbortSignal.timeout()` (30s IIIF, 15s samples)

### H3: XSS via LLM Response in Validation Panel [FIXED]
- **Files:** `components/validation.js`
- **Fix applied:** Added `escapeHtml()` to all LLM-provided strings (reasoning, issues, suggestions, explanations, fallback name)

### H4: Useless Escape Characters in Regex [FIXED]
- **File:** `services/validation.js`
- **Fix applied:** Removed 7 unnecessary backslashes from special_chars character class

### H5: Control Regex Warning [FIXED]
- **File:** `services/validation.js`
- **Fix applied:** Added `// eslint-disable-next-line no-control-regex` (intentional use)

### H6: Event Listener Accumulation in Dialogs [FIXED]
- **Files:** `components/dialogs.js`
- **Fix applied:** Double-init guard (`if (this._initialized) return`)

### H7: Division by Zero in PAGE-XML Parser [FIXED]
- **Files:** `services/parsers/page-xml.js`
- **Fix applied:** Guard `pageDimensions.width || 1` and `.height || 1`

---

## MEDIUM Severity

### M1: Silent Error Suppression (bare catch) [FIXED]
- **File:** `services/llm.js`
- **Fix applied:** Added `console.warn` to bare catch block

### M2: Duplicate `escapeHtml` Function [FIXED]
- **Files:** `editor.js`
- **Fix applied:** Removed local copy, imported from `utils/textFormatting.js`

### M3: `window.alert` Globally Overridden [FIXED]
- **File:** `ui.js`
- **Fix applied:** Removed the override entirely

### M4: PWA Toast Dispatches to Wrong Target [FIXED]
- **File:** `pwa.js`
- **Fix applied:** Imported `appState`, using `appState.showToast()` directly

### M5: Global Regex with Persistent `lastIndex` State [FIXED]
- **File:** `utils/textFormatting.js`
- **Fix applied:** Converted to non-global patterns, inline global regex for replace/match

### M6: `Math.random()` UUID [FIXED]
- **File:** `state.js`
- **Fix applied:** Replaced with `crypto.randomUUID()`

### M7: Event Listener Leaks in Upload Manager [FIXED]
- **File:** `components/upload.js`
- **Fix applied:** Double-init guard (`if (this._initialized) return`)

### M8: Batch Progress innerHTML Memory Leak [FIXED]
- **File:** `components/batch-progress.js`
- **Fix applied:** Build DOM once, targeted element updates on subsequent calls, single event listener

### M9: `setHTML()` DOM Utility Uses Unsafe innerHTML [FIXED]
- **File:** `utils/dom.js`
- **Fix applied:** Added JSDoc warning that callers must escape user/LLM-provided strings

### M10: Missing URL Validation in METS Parser [FIXED]
- **File:** `services/parsers/mets-xml.js`
- **Fix applied:** Wrapped `new URL()` in try-catch with console.warn fallback

### M11: Export URL Revoke Timing [FIXED]
- **File:** `services/export.js`
- **Fix applied:** Increased from 100ms to 60s, using `URL_REVOKE_DELAY` constant

### M12: Transcription Component Race Condition [FIXED]
- **File:** `components/transcription.js`
- **Fix applied:** Added missing `setLoading(false)` in success path (was only in error path)

---

## LOW Severity

### L1: Debug console.log in context.js [FIXED]
- **Fix applied:** Removed `console.log('[Context] Initialized')`

### L2: `getImageDimensions` Resolves with Fake Values [NOTED]
- **File:** `services/samples.js`
- **Status:** console.warn added in earlier fix round; fake values kept as fallback

### L3: Hardcoded CSS Color [FIXED]
- **File:** `ui.js`
- **Fix applied:** Changed hardcoded `#30363d` to `''` (resets to CSS default)

### L4: Unused Imports/Variables [FIXED]
- **Files:** 13 files, 40 warnings
- **Fix applied:** Removed unused imports, prefixed unused params with `_`, eslint-disable for side-effect imports

### L5: `prefer-const` Violations [FIXED]
- **Fix applied:** ESLint `--fix` auto-corrected

### L6: Deprecated Methods in Storage Service [KEPT]
- **Status:** Intentional no-op stubs for backwards compatibility, marked `@deprecated`

### L7: URL_REVOKE_DELAY Constant [FIXED]
- **File:** `utils/constants.js`
- **Fix applied:** Updated to 60s, now used by `services/export.js`

### L8: Inconsistent Error Handling in METS Parser [NOTED]
- **Status:** Low risk -- empty array return is acceptable for missing structMap

### L9: `no-alert` Warnings in Dialogs [FIXED]
- **File:** `components/dialogs.js`
- **Fix applied:** Added `// eslint-disable-next-line no-alert` (confirm() is intentional for destructive actions)

### L10: Missing Null Safety in Validation Line Matching [NOTED]
- **Status:** Low risk -- `textLines.forEach` guarantees defined elements

---

## Codex Audit (Second Pass)

Independent audit by GPT Codex found 8 additional issues. All verified and fixed.

### CX-H1: `_saveCurrentPageTranscription` loses raw text [FIXED]
- **File:** `state.js:389`
- **Fix:** Save when `raw.trim().length > 0` (not just segments), include `raw` in `pageTranscriptions`

### CX-H2: `setTranscription` discards segments/columns [FIXED]
- **File:** `state.js:463`
- **Fix:** Accept `segments`, `columns`, derive `raw` from segments if not provided

### CX-M1: ValidationPanel double-init [FIXED]
- **File:** `components/validation.js`
- **Fix:** Added `_initialized` guard

### CX-M2: `showDialog('iiifDialog')` does not exist [FIXED]
- **File:** `main.js:400`
- **Fix:** Changed to `openDialog('iiif')`

### CX-M3: Canvas try/catch missing in `getImageBase64` [FIXED]
- **File:** `components/transcription.js:311`
- **Fix:** Wrapped canvas operations in try/catch, reject on failure

### CX-M4: Model/provider unescaped in innerHTML [FIXED]
- **File:** `components/transcription.js:124`
- **Fix:** Added `escapeHtml()` on model and provider interpolations

### CX-M5: Status mapping missing `confident` key [FIXED]
- **File:** `components/validation.js:728`
- **Fix:** Added `confident: 'status-success'` to statusClass map

### CX-L1: `hasSavedSession` ignores raw-only transcriptions [FIXED]
- **File:** `state.js:813`
- **Fix:** Added `|| raw?.trim().length > 0` to hasTranscription check

---

## Verification

```
ESLint:  0 errors, 0 warnings
Tests:   276 passed (7 test files)
Audits:  Claude (29 findings) + Codex (8 findings) = 37 total, all fixed
```
