# HTR Error Post-Processing: Implementation-Ready Specification

Status: Implemented (feature-flagged, `FEATURE_FLAGS.postprocessPipelineV1`)
Date: 2026-02-11
Implementation: All 22 tickets (PPV1-001 through PPV1-403) completed

## 1. Goal and Scope

This document defines an executable plan for improving HTR output quality through a staged workflow:

1. Vision transcription (image -> raw text)
2. Paleographic review (script-aware correction proposals)
3. Philological review (language/context-aware correction proposals)
4. Human-in-the-loop acceptance in editor Diff View

The target is better correction quality without breaking current app behavior, terminology, or exports.

Out of scope for v1:
- Automatic acceptance without human review
- Coordinate-level token anchoring from OCR geometry
- Full TEI critical apparatus editor

## 2. Must-Match Current App Contracts

The implementation must stay compatible with existing frontend/service contracts:

- Validation and LLM Review terminology (UI and docs)
- Confidence values in code: `confident | likely | uncertain`
- LLM issue types accepted by parser:
  - `spelling`, `accent`, `abbreviation`, `illegible`, `ocr_artifact`, `historical`, `structural`, `plausibility`
- Existing issue shape consumed by UI apply flow:
  - `line`, `text`, `suggestion`, `type`, `explanation`
- Existing markers recognized by rule-based validation:
  - `[?]`, `[illegible]`, `[...]`

Reference modules:
- `docs/js/services/llm.js`
- `docs/js/services/validation.js`
- `docs/js/components/validation.js`
- `docs/js/editor.js`
- `docs/js/components/context.js`
- `docs/js/state.js`

## 3. Canonical Mapping (Draft Terms -> App Terms)

### 3.1 Confidence mapping

| Expert term     | Stored value | UI label recommendation |
| --------------- | ------------ | ----------------------- |
| sure            | confident    | High confidence         |
| check-worthy    | likely       | Medium confidence       |
| problematic     | uncertain    | Low confidence          |

Note: keep storage values exactly as implemented (`confident/likely/uncertain`).

### 3.2 Marker mapping

| Editorial intent              | Canonical marker in app |
| ---------------------------- | ----------------------- |
| uncertain reading            | `[?]` inside/near token |
| illegible short span         | `[...]`                 |
| illegible explicit marker    | `[illegible]`           |

Do not introduce new runtime markers in v1 (for example `<deleted>` or `+corrupt+`) unless parsing and validation are explicitly extended.

## 4. Architecture

## 4.1 Pipeline overview

```
Stage 1: Vision Transcription
  input: image + context
  output: raw + segments

Stage 2: Paleographic Review (LLM Review #1)
  input: stage1 text + script metadata
  output: structured issue proposals

Stage 3: Philological Review (LLM Review #2)
  input: stage1 text + stage2 proposals + linguistic metadata
  output: structured issue proposals

Merge + Display:
  combined proposals -> existing Validation/LLM Review panel
  apply suggestions in editor via existing Apply/Apply All behavior
```

## 4.2 Why staged

- Stage 1 optimizes visual reading.
- Stage 2 handles script-level ambiguities (for example minim-heavy words).
- Stage 3 resolves lexical/morphological plausibility.

This keeps prompts focused and makes failures debuggable.

## 5. Data Contracts (Required)

## 5.1 Context contract (extended)

Use this shape in app state (backward compatible with current context fields):

```json
{
  "documentType": "manuscript",
  "period": "mid-14th century",
  "language": "Latin",
  "description": "optional free text",

  "scriptType": "textura",
  "century": "14",
  "region": "german",
  "languages": ["latin"],
  "textType": "liturgical",
  "knownText": "psalter"
}
```

Compatibility rule:
- Keep existing keys (`documentType`, `period`, `language`, `description`).
- Add new structured keys; do not break persisted sessions with old keys only.

## 5.2 Stage output contract

Stage 2 and Stage 3 must return strict JSON.

```json
{
  "confidence": "confident",
  "reasoning": "short summary",
  "issues": [
    {
      "line": 12,
      "text": "domiuuui",
      "suggestion": "dominum",
      "type": "spelling",
      "explanation": "Minim sequence resolves to a standard accusative form.",
      "alternatives": ["dominuni"],
      "stage": "paleographic",
      "score": 0.82
    }
  ]
}
```

Required fields per issue:
- `line`: integer >= 1
- `text`: source fragment in that line
- `suggestion`: single-line replacement string
- `type`: allowed type enum
- `explanation`: concise reason

Optional fields:
- `alternatives`, `stage`, `score`

### Hard rule for Apply All compatibility

- `suggestion` should be single-line in v1 (no `\n`).
- If multi-line suggestion is unavoidable, it must be emitted, but UI should mark it as manual-only and skip in Apply All.

## 5.3 Merge contract for UI

Merged review result must stay compatible with existing `validation.llmJudge`:

```json
{
  "confidence": "likely",
  "reasoning": "Merged from paleographic and philological review.",
  "issues": ["...existing issue objects..."]
}
```

Conflict rule when both stages propose on same line/span:
1. Prefer identical suggestions (deduplicate)
2. If suggestions differ, keep both as separate issues with explicit stage tags
3. Do not auto-resolve conflicting suggestions silently

## 6. Prompting Specification

## 6.1 Stage 1 (Vision)

Must include:
- script hint (`scriptType`)
- preserve line breaks
- mark uncertain with `[?]`
- do not expand abbreviations

Must not include:
- lexical normalization
- broad philological rewriting

## 6.2 Stage 2 (Paleographic Review)

Objective:
- propose corrections for letterform/script confusions

Allowed operations:
- minim disambiguation proposal
- long-s/f and c/t disambiguation proposal
- abbreviation sign interpretation proposal

Not allowed:
- aggressive modernization
- style rewriting

## 6.3 Stage 3 (Philological Review)

Objective:
- propose linguistically plausible corrections

Allowed operations:
- morphology/syntax plausibility checks
- formula-aware corrections (liturgical/charter/etc.)
- abbreviation expansion mode handling

Not allowed:
- deleting uncertainty markers without reason

## 7. Execution and Fallback Logic

Default execution order:
1. Stage 1 always
2. Stage 2 optional toggle (default on)
3. Stage 3 optional toggle (default on)

Fallback behavior:
- If Stage 2 fails: continue with Stage 3 using Stage 1 text
- If Stage 3 fails: keep Stage 2 output only
- If both fail: keep current single-call LLM Review path

No hard failure should block editor or export.

## 8. Operational Guardrails

For each page:
- max additional review calls: 2
- timeout per review call: 45s
- total review budget per page: 90s

Batch validation:
- inter-call delay for cloud providers (existing pattern)
- clear user feedback for partial failures

Rate-limit behavior:
- exponential backoff for retryable provider errors
- abort batch only on unrecoverable auth/config errors

## 9. UI and HITL Requirements

Mandatory UX behavior:
- all proposals visible in LLM Review section
- each issue supports `Apply`
- optional `Apply All` for safe, single-line suggestions
- changes immediately visible in Diff View
- undo/redo must remain intact

Current implementation already satisfies core apply flow and should be reused.

## 10. Implementation Plan (File-Level)

## Phase 1: Contract hardening [DONE]

Files:
- `docs/js/services/llm.js`
- `docs/js/components/validation.js`

Tasks:
- [x] enforce strict JSON post-parse normalization for issues (`_normalizeIssue()`)
- [x] attach optional `stage` metadata (preserved through normalization)
- [x] reject/flag invalid issue type values to known enum (`ALLOWED_ISSUE_TYPES`)

## Phase 2: Context extension [DONE]

Files:
- `docs/index.html`
- `docs/js/components/context.js`
- `docs/js/state.js`

Tasks:
- [x] add structured fields: `scriptType`, `century`, `region`, `languages`, `textType`, `knownText`
- [x] keep backward compatibility with existing context model
- [x] include structured context in transcription/review prompt builders

## Phase 3: Post-processing orchestration [DONE]

Files:
- `docs/js/services/postprocess.js` (new orchestrator)
- `docs/js/services/validation.js`
- `docs/js/services/llm.js`

Tasks:
- [x] run Stage 2 and Stage 3 sequentially (`runPostprocessing()` in postprocess.js)
- [x] merge issue lists deterministically (`mergeStageIssues()` with signature-based dedup)
- [x] expose one merged `llmJudge` object to existing UI
- [x] stage badge rendering per issue (paleographic/philological)
- [x] stage toggles UI (enable/disable Stage 2 and Stage 3 individually)
- [x] pipeline metadata persistence (stage status + duration in validation state)

## Phase 4: Confidence and marker alignment [DONE]

Files:
- `docs/js/services/llm.js`
- `docs/js/components/validation.js`
- `docs/js/utils/textFormatting.js`

Tasks:
- [x] ensure storage uses `confident/likely/uncertain` (`_normalizeConfidence()` maps expert terms)
- [x] enforce canonical markers (`normalizeMarkers()` in textFormatting.js, 12 variant forms)
- [x] document mapping in this spec (sections 3.1 and 3.2)

## Phase 5: QA and release gating [DONE]

Files:
- `docs/tests/*.test.js`
- `docs/tests/e2e/` (Playwright)

Tasks:
- [x] unit tests for schema normalization and merge rules (48 new tests: llm.test.js, state.test.js, postprocess.test.js)
- [x] integration tests: stage outputs -> issue rendering -> apply -> export
- [x] Playwright E2E for Apply, Diff View, Undo, Export
- [x] rollout checklist and go/no-go criteria (section 15 below)

## 11. Acceptance Criteria

Functional:
- Stage 2/3 outputs are always parseable and rendered as issues
- Apply works with line-accurate replacements
- Apply All skips unsafe multiline suggestions and reports counts

Data integrity:
- `raw` and `segments` remain in sync after edits
- exports include corrected text (txt/json/md/xml/tei)

Stability:
- no regression in existing validation-only mode
- no blocking failures when review stages fail

## 12. Test Matrix

Unit:
- parser normalization for malformed stage JSON
- allowed issue type enforcement
- confidence mapping enforcement

Integration:
- Stage 2 + Stage 3 merge conflict handling
- Apply then export content verification

E2E (Playwright):
1. Transcribe -> Validate (with review)
2. Apply one suggestion -> Diff visible
3. Undo/redo behavior
4. Apply All summary and multiline skip behavior
5. Export contains corrected text

## 13. Metrics and Rollout

Primary metrics:
- Human acceptance rate of suggestions
- Correction precision (accepted suggestions / applied suggestions)
- Reduction in unresolved uncertain markers
- Processing time per page

Rollout:
1. feature flag (`postprocessPipelineV1`)
2. internal audit corpus
3. limited user pilot
4. full release after quality threshold

## 14. Risks and Mitigations

Risk: Over-correction of valid medieval variants
- Mitigation: conservative suggestion policy + human apply decision

Risk: prompt drift across providers
- Mitigation: strict JSON contract + normalization layer

Risk: increased latency/cost
- Mitigation: optional stages + timeouts + fallback path

Risk: conflicting stage suggestions
- Mitigation: deterministic merge and no silent auto-merge

---

## 15. Rollout Checklist

### Pre-release (before setting `postprocessPipelineV1 = true`)

| # | Check | Status |
|---|-------|--------|
| 1 | All unit tests pass (`cd docs && npx vitest run`) | [ ] |
| 2 | All E2E tests pass (`cd docs && npx playwright test`) | [ ] |
| 3 | ESLint clean (`cd docs && npm run lint`) | [ ] |
| 4 | Manual test: single-page Validate with pipeline (Gemini + custom prompt) | [ ] |
| 5 | Manual test: multi-page batch Validate with pipeline | [ ] |
| 6 | Manual test: Apply, Apply All, Undo, Redo work after pipeline | [ ] |
| 7 | Manual test: Diff View shows correct changes | [ ] |
| 8 | Manual test: Export (JSON, Markdown, TXT, PAGE-XML, TEI-XML) contains corrected text + pipeline metadata | [ ] |
| 9 | Manual test: Stage toggles (disable Stage 2, disable Stage 3, disable both) | [ ] |
| 10 | Manual test: Fallback when Stage 2/3 fails (network error, timeout) | [ ] |
| 11 | Manual test: Session save/restore preserves pipeline results | [ ] |
| 12 | Manual test: Project switch preserves pipeline results per project | [ ] |
| 13 | Service worker cache cleared/updated for new JS files | [ ] |
| 14 | No regressions in existing validation-only mode (pipeline disabled) | [ ] |

### Go/No-Go Criteria

**Go** (all must be true):
- All automated tests green (unit + E2E)
- No regression in validation-only mode
- Apply/Apply All/Undo/Redo verified on 3+ real manuscript pages
- Export formats contain correct corrected text
- Fallback path works when stages fail
- Session persistence roundtrip verified

**No-Go** (any blocks release):
- Test failures in merge logic or confidence mapping
- Apply produces incorrect replacements
- Pipeline failure blocks editor or export
- Silent data loss on session save/restore
- Conflicting stage suggestions auto-merged without both being visible

### Rollout Sequence

1. **Internal testing**: Enable flag in `config.local.js`, test with audit corpus
2. **Limited pilot**: Enable flag in production, announce to 2-3 test users
3. **Monitor**: Track acceptance rate, correction precision, processing time
4. **Full release**: Set `postprocessPipelineV1: true` in `constants.js` after quality threshold met

### Post-release Monitoring

- Human acceptance rate of suggestions (target: >70%)
- Correction precision (target: >85%)
- Reduction in unresolved `[?]` markers
- Processing time per page (target: <60s for 2 extra LLM calls)
- User feedback on suggestion quality

---

Appendix A (Expert rationale retained):
- minim-heavy script ambiguity must be solved contextually, not by naive stroke counting
- script-specific prompting has high leverage
- abbreviation expansion should be context-aware and review-driven
