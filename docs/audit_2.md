# Audit Report: Mistral OCR & Validation Provider Features

## Executive Summary

- Total Findings: **8** (HIGH: **1**, MEDIUM: **5**, LOW: **2**)
- Overall Assessment: **Conditional Pass**
- Critical Issues: API-key isolation is not actually isolated at runtime for same-provider transcription/validation; validation key restore path can break when `_validation` keys exist.

## HIGH Severity Findings

### H1: Runtime API-Key Isolation Broken for Same Provider

**File:** `docs/js/components/dialogs.js:1269` (also `docs/js/components/dialogs.js:1231`, `docs/js/services/llm.js:283`)  
**Issue:** Validation and transcription keys are stored separately in IndexedDB, but both are written into the same in-memory slot via `llmService.setApiKey(provider, ...)`. If both use the same provider (e.g., Gemini), the validation key overwrites the transcription key.  
**Risk:** Security / credential-boundary violation.  
**Impact:** Requests can run under the wrong account/key (billing, quotas, access policy mismatch).  
**Recommendation:** Add separate in-memory key storage for validation (e.g., `setValidationApiKey/getValidationApiKey`) and use that in explicit validation paths.

## MEDIUM Severity Findings

### M1: Persistent Key Restore Breaks on `*_validation` Entries

**File:** `docs/js/components/dialogs.js:1154` (also `docs/js/services/storage.js:400`)  
**Issue:** `loadAllApiKeys()` returns keys like `gemini_validation`; `loadSavedApiKeys()` blindly calls `llmService.setApiKey(provider, ...)`, which throws for unknown provider IDs.  
**Risk:** Robustness / state restore failure.  
**Impact:** Persistent key loading can partially fail after first validation-key record; users lose expected restored config until manual re-entry.  
**Recommendation:** Filter/split `_validation` keys before calling `setApiKey`, and restore validation keys via dedicated path.

### M2: Explicit Validation Path Bypasses Standard Error Normalization

**File:** `docs/js/services/llm.js:517` and `docs/js/services/llm.js:585`  
**Issue:** `validate()` returns early to `_validateWithExplicitProvider()` without wrapping errors in `_handleError()`.  
**Risk:** Robustness / inconsistent error handling.  
**Impact:** Raw provider errors leak to UI, unlike fallback/standard paths that return typed `LLMError`.  
**Recommendation:** Wrap explicit-provider execution in `try/catch` and rethrow `this._handleError(error)`.

### M3: Custom OCR-Only Models Not Detected in Dialog

**File:** `docs/js/components/dialogs.js:209` and `docs/js/components/dialogs.js:405`  
**Issue:** OCR-only check uses `modelSelect.value` (`"custom"`) instead of the resolved custom model string.  
**Risk:** Logic bug / state inconsistency.  
**Impact:** Validation section stays hidden for custom OCR models; saving can clear validation config unexpectedly (`docs/js/components/dialogs.js:1279`).  
**Recommendation:** Resolve effective model first (custom input if selected), then run OCR-only detection/UI toggling.

### M4: Validation Key “Persist” Checkbox Does Not Revoke Existing Stored Key

**File:** `docs/js/components/dialogs.js:1271`  
**Issue:** When unchecked, code just skips saving; it never deletes an already persisted validation key.  
**Risk:** Security / consent mismatch.  
**Impact:** User may believe key is not persisted while old persisted key remains in IndexedDB.  
**Recommendation:** On unchecked state, call delete for validation key (`provider_validation`) explicitly.

### M5: Mistral Not Supported in “Test Connection”

**File:** `docs/js/components/dialogs.js:1368`  
**Issue:** `_testCloudConnection()` has no `mistral` branch and falls into `Unknown provider`.  
**Risk:** UX/operational robustness.  
**Impact:** Users cannot validate Mistral key/connectivity from UI.  
**Recommendation:** Add Mistral test branch (same auth style as runtime provider, with timeout + friendly error mapping).

## LOW Severity Findings

### L1: Saved Explicit Validation Model Not Restored in Dialog; Auto-Fill May Override

**File:** `docs/js/components/dialogs.js:1164` and `docs/js/components/dialogs.js:436`  
**Issue:** Explicit validation config is loaded into service state, but dialog select is not initialized from that config; auto-fill may pick a different provider on open/save.  
**Risk:** Data integrity (configuration drift).  
**Impact:** Saved validation provider/model can be silently replaced after opening and re-saving settings.  
**Recommendation:** On dialog init, set `#validationModel` from loaded config before auto-fill, and skip auto-fill when explicit config exists.

### L2: Model Indicator Uses Provider Display Name Instead of Provider ID

**File:** `docs/js/components/dialogs.js:1346`  
**Issue:** `updateModelIndicatorWithValidation()` passes `currentProvider.name` into `updateModelIndicator()` which expects IDs (`gemini`, `ollama`, ...).  
**Risk:** UI consistency.  
**Impact:** `data-provider` styling rules and local-label logic can break.  
**Recommendation:** Pass provider ID (`llmService.activeProvider`) rather than display name.

## Overall Assessment

Mistral OCR endpoint integration itself is close to spec, but the new validation-provider/key-management layer is not fully production-safe yet. The key isolation model is currently inconsistent between storage and runtime, and restore/explicit-path handling has correctness gaps.

## Answers to Your Questions

1. **Is Mistral OCR integration production-ready?**  
   Not fully, mainly due to surrounding provider/key handling and missing connection-test support, not the core endpoint call.

2. **Does the 3-tier validation priority system have edge cases that could fail?**  
   Yes: explicit path error propagation inconsistency, custom OCR model UI detection failure, and dialog restore/auto-fill drift.

3. **Are API keys handled securely (especially separate validation keys)?**  
   Partially. IndexedDB keys are separated, but runtime memory is not separated for same-provider keys (critical).

4. **Could validation provider auto-cleanup cause data loss?**  
   Yes in edge cases: custom-model OCR misdetection can trigger unintended clearing of validation config.

5. **Is UI conditional rendering logic bulletproof?**  
   No. Custom-model OCR detection and saved-validation restore behavior are not robust.

## Validation Run

- Executed: `TMPDIR=/tmp TEMP=/tmp TMP=/tmp npx vitest run tests/llm-validation-provider.test.js tests/llm.test.js`
- Result: **40 passed / 0 failed**

## External References Used

- Mistral OCR capability docs: https://docs.mistral.ai/capabilities/document_ai/basic_ocr/
- Mistral OCR API endpoint docs: https://docs.mistral.ai/api/
