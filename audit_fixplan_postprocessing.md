# Audit Fix Plan: Postprocessing v1 (Current Findings)

Status: DONE (implemented and validated)  
Source: latest audit (2 MEDIUM, 2 LOW)

## Objective

Close all current findings with minimal regression risk while preserving behavior behind `FEATURE_FLAGS.postprocessPipelineV1`.

## Findings Covered

- F1 (MEDIUM): `contextDescription` is not forwarded through Validation UI flow.
- F2 (MEDIUM): Pipeline metadata schema mismatch (`stage2/stage3` string vs object) causes UI/export drift.
- F3 (LOW): `MAX_POSTPROCESS_CALLS` constant is defined but not enforced.
- F4 (LOW): Runtime-path test coverage for `runPostprocessing()` is incomplete.

## Scope

- `docs/js/components/validation.js`
- `docs/js/services/validation.js`
- `docs/js/services/postprocess.js`
- `docs/js/services/export.js`
- `docs/js/state.js` (compat handling if needed)
- `docs/js/utils/constants.js`
- `docs/tests/postprocess.test.js`
- `docs/tests/validation.test.js`
- `docs/tests/state.test.js`
- `docs/tests/export.test.js`

---

## Fix Order (Critical Path)

1. F1 Context forwarding
2. F2 Pipeline schema unification + backward compatibility
3. F3 Guardrail enforcement (`MAX_POSTPROCESS_CALLS`)
4. F4 Runtime-path tests

Reason for order:
- First ensure prompt quality (context arrives in Stage 2/3).
- Then remove schema ambiguity in UI/export/persisted state.
- Then enforce guardrail policy.
- Finally lock behavior with tests.

---

## F1 (MEDIUM): Forward `contextDescription` end-to-end

### Root Cause
- `getValidationOptions()` does not attach context for validation pipeline calls.

### Code Changes
1. `docs/js/components/validation.js`
- Import `contextManager` from `./context.js`.
- In `getValidationOptions()`, add:
  - `contextDescription: contextManager.buildPromptContext() || ''`.
- Keep this in both single-page and batch flow (already both use `getValidationOptions()`).

2. `docs/js/services/validation.js`
- Keep existing pass-through to `runPostprocessing()`:
  - `contextDescription: options.contextDescription || ''`.
- Add inline comment that UI provides context via options.

### Tests
1. `docs/tests/validation.test.js`
- New test: with feature flag ON and no custom prompt, `validate()` forwards non-empty `contextDescription` into postprocessing path.
- New test: batch options object contains same `contextDescription` source (unit-level option extraction or integration around panel if available).

### Acceptance
- Stage 2/3 prompts receive non-empty context when context exists in UI state.

---

## F2 (MEDIUM): Unify pipeline schema and keep compatibility

### Decision
Use a canonical object schema:
- `pipeline.stage2 = { status, duration?, reason? }`
- `pipeline.stage3 = { status, duration?, reason? }`
- `pipeline.duration = number`

### Code Changes
1. `docs/js/services/postprocess.js`
- Return canonical object schema from `runPostprocessing()` instead of plain strings.
- Ensure all outcomes (`success/error/skipped`) are represented in `stageX.status`.

2. `docs/js/components/validation.js`
- In `renderLLMCards()`, read stage status compatibly:
  - `const s2 = llmResult.pipeline?.stage2;`
  - `const stage2Status = typeof s2 === 'string' ? s2 : s2?.status;`
  - same for stage 3.
- Render pipeline notice based on resolved status.

3. `docs/js/services/export.js`
- Apply same compatibility resolver when rendering Markdown pipeline line.

4. `docs/js/state.js` (optional normalization hook)
- On `setValidationResults()`, optionally normalize incoming legacy string schema into canonical object schema.
- Keep stored data consistent for new sessions.

### Tests
1. `docs/tests/state.test.js`
- Keep existing object-schema tests.
- Add one legacy-schema test (string stage fields) and assert normalization/compat behavior.

2. `docs/tests/export.test.js`
- Add tests for both schema variants to ensure pipeline line appears.

3. `docs/tests/validation.test.js`
- Add UI-side resolver test (if component-level test harness exists); otherwise validate helper output string.

### Acceptance
- Pipeline notice and export work for both old (string) and new (object) data.
- New writes use canonical object schema.

---

## F3 (LOW): Enforce `MAX_POSTPROCESS_CALLS`

### Root Cause
- Constant exists but no runtime check in orchestrator.

### Code Changes
1. `docs/js/services/postprocess.js`
- Import `MAX_POSTPROCESS_CALLS`.
- Add per-page call counter in `runPostprocessing()` / `callWithGuardrails()`.
- Abort further stage calls when cap is reached.
- Document policy explicitly:
  - Recommended: cap counts stage calls (not retries), max 2 stage invocations/page.

2. `docs/js/utils/constants.js`
- Keep constant; clarify comment if policy is stage-calls only.

### Tests
1. `docs/tests/postprocess.test.js`
- Add test: when call cap reached, additional stage call is skipped and pipeline marks skipped/error with reason.
- Add test: normal case still runs both stages.

### Acceptance
- Runtime never exceeds configured max stage calls per page.

---

## F4 (LOW): Add runtime-path tests for orchestrator

### Root Cause
- Current tests cover merge helpers and prompt exports, but not full execution paths.

### Code Changes (Tests Only)
1. `docs/tests/postprocess.test.js`
- Add mocked runtime tests for `runPostprocessing()`:
  - Stage2 success + Stage3 success.
  - Stage2 fail + Stage3 success.
  - Stage2 success + Stage3 fail.
  - Both fail -> fallback marker path.
  - Timeout/retry path hits guardrail logic.
  - Stage tagging and merged output integrity.

2. `docs/tests/validation.test.js`
- Add routing tests:
  - Feature flag OFF -> single-call `validateWithLLM`.
  - Feature flag ON + no custom prompt -> postprocessing route.
  - Postprocessing fallback -> single-call result returned.

### Acceptance
- Core postprocessing runtime behavior is test-covered, not only helper-level logic.

---

## Execution Waves

### Wave 1 (Correctness)
- F1, F2
- Commands:
  - `npm run lint` (in `docs/`)
  - `TMPDIR=/tmp TEMP=/tmp TMP=/tmp npx vitest --run tests/validation.test.js tests/state.test.js tests/export.test.js`

### Wave 2 (Guardrails + Tests)
- F3, F4
- Commands:
  - `TMPDIR=/tmp TEMP=/tmp TMP=/tmp npx vitest --run tests/postprocess.test.js tests/validation.test.js`
  - `TMPDIR=/tmp TEMP=/tmp TMP=/tmp npx vitest --run`

---

## Done Criteria

- [x] All 4 findings closed.
- [x] `npm run lint` is clean.
- [x] Full test suite is green.
- [x] No regression in Apply/Diff/Undo flow.
- [x] `postprocessPipelineV1` remains the switch for pipeline route.
