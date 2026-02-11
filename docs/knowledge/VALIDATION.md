---
type: knowledge
created: 2026-01-16
updated: 2026-02-03
tags: [coocr-htr, validation, llm-review, navigation]
status: complete
version: 2.1
---

# Hybrid Validation

Combination of deterministic rules and LLM assessments.

**Dependencies:**
- [METHODOLOGY](METHODOLOGY.md) (Rationale: LLM Bias, Expert-in-the-Loop)
- [ARCHITECTURE](ARCHITECTURE.md) (ValidationEngine Integration)

## Architecture

```
              ┌─────────────────┐
              │ ValidationEngine│
              └────────┬────────┘
                       │
         ┌─────────────┼─────────────┐
         ▼             ▼             ▼
  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
  │ RuleValidator│ │ LLMValidator │ │ ResultMerger │
  └──────────────┘ └──────────────┘ └──────────────┘
         │               │               │
         └───────────────┴───────────────┘
                         ▼
              ┌─────────────────┐
              │ValidationResult[]│
              └─────────────────┘
```

## Validation

Generic rules applicable to all document types (letters, diaries, account books, etc.).

### Implemented Rules (v2.0)

**Implementation:** [validation.js](../docs/js/services/validation.js)

| Rule ID | Name | Pattern | Type | Description |
|---------|------|---------|------|-------------|
| uncertain_marker | Uncertain Readings | [?] | warning | Marks passages with uncertain readings |
| illegible_marker | Illegible Passages | [illegible], [...] | warning | Marks unreadable passages |
| abbreviations | Abbreviations | word[expansion] | info | Expanded abbreviations like admi[nistrateurs] |
| line_breaks | Line Count | (custom logic) | info | Counts transcribed lines |
| special_chars | Special Characters | Non-standard chars | info | Potential OCR artifacts |

### Design Rationale (v2.0)

**Removed document-type-specific rules:**
- Currency formats (Taler, Groschen, Gulden) - only relevant for account books
- Date formats (DD. Month) - only relevant for dated documents
- Table consistency checks - only relevant for tabular data

**Why generic rules?**
- Work for all document types: letters, diaries, account books, manuscripts
- Avoid false positives ("No currency found" on a letter)
- Future: Document-type selection could enable specific rule sets

### Rule Categories

| Category | Rules | Type |
|----------|-------|------|
| Markers | Uncertain [?], Illegible [...] | Warning |
| Structure | Abbreviations [expanded] | Info |
| Statistics | Line count, Special characters | Info |

## LLM Review (v2.1)

Generic validation prompt covering all relevant aspects:

### Default Prompt Covers

| Aspect | Checks | Typical Errors |
|--------|--------|----------------|
| Paleographic | Letter forms | n/u confusion, c/e, Ligatures |
| Spelling/Accents | Orthography, Diacritics | Missing accents, typos |
| Structural | Tables, Layout | Broken lines, column errors |
| Plausibility | Context, Values | Unrealistic prices, anachronisms |

### Custom Prompt Option

Advanced users can provide their own validation prompt via the "Use custom prompt" option in the validate dialog. Use `{text}` as placeholder for the transcription text.

### Issue Types (v2.0)

| Type | Name | Color | Description |
|------|------|-------|-------------|
| spelling | Spelling | warning | Spelling errors |
| accent | Accent Error | warning | Missing/wrong diacritics |
| abbreviation | Abbreviation | info | Abbreviation expansion needed |
| illegible | Illegible | error | Unreadable passage |
| ocr_artifact | OCR Artifact | error | OCR recognition error |
| historical | Historical | info | Historical spelling variant |
| structural | Structural | warning | Layout/structure issue |
| plausibility | Plausibility | warning | Implausible content |

## Confidence Categories

No numeric values (see [METHODOLOGY](METHODOLOGY.md): LLM Bias).

| Category | Label | UI Color | Meaning |
|----------|-------|----------|---------|
| `certain` | High Confidence | Green | High agreement |
| `likely` | Medium Confidence | Orange | Expert should review |
| `uncertain` | Low Confidence | Red | Likely incorrect |

## ValidationResult Format

Each validation result contains:

| Field | Type | Description |
|-------|------|-------------|
| id | String | Unique rule identifier |
| name | String | Display name |
| description | String | What this rule checks |
| type | Enum | success, warning, error, or info |
| passed | Boolean | Whether the check passed |
| message | String | Human-readable result |
| lines | Array | Affected line numbers |
| matches | Array | Matched patterns for highlighting |
| matchCount | Number | Count for display |
| details | String (optional) | Extended explanation |

## UI Representation (v2.0 - Compact Layout)

### Panel Layout

```
┌─────────────────────────────────────────────────┐
│ VALIDATION            [Validate]    1 Issue     │
├─────────────────────────────────────────────────┤
│ VALIDATION                                      │
│ ● Uncertain Readings   No markers found         │
│ ● Illegible Passages   1 illegible passage      │
│ ● Abbreviations        1 expanded               │
│ ● Line Count           36 lines transcribed     │
│ ● Special Characters   None unusual             │
├─────────────────────────────────────────────────┤
│ LLM REVIEW                                      │
│ ● Confidence           Medium Confidence        │
│ ● Line 5               Le prix lorem ipsum      │
│ ● Line 16              admi[illegible]trateurs  │
│ > Show LLM Review                               │
└─────────────────────────────────────────────────┘
```

### Status Indicators

| Status | Color Variable | Dot | Description |
|--------|----------------|-----|-------------|
| Success | `--confident` | Green | Check passed |
| Warning | `--uncertain` | Orange | Expert should review |
| Error | `--problematic` | Red | Error detected |
| Info | `--accent-primary` | Blue | Informational |

## Issue Navigation (v2.1)

Clicking on a validation issue navigates to the affected location.

### Graceful Degradation

| Document Type | Coordinates | Behavior |
|---------------|-------------|----------|
| PAGE-XML | Yes | Image region highlighted + pan to region |
| Plain Image | No | Editor line highlighted + info toast |
| IIIF | Variable | Depends on available annotation data |

### Implementation

**Coordinate Check:** `state.js` provides `hasRegionCoordinates()` to detect if bounding boxes are available.

**Viewer Behavior:** On selection, viewer.js either highlights the image region (if coordinates exist) or shows an info toast explaining that no coordinates are available.

**Editor Behavior:** editor.js always highlights the selected line via `highlightEditorLine()`, regardless of coordinate availability.

### Click Handlers

Both validation card layouts (`.validation-card` and `.validation-item`) with `data-line` attribute trigger navigation when clicked.

## Validation Flow

```
User clicks "Validate" button
       │
       ▼
┌──────────────────┐
│ Show Loading     │ (Overlay on validation panel)
│ "Validating..."  │
└──────┬───────────┘
       │
       ▼
┌──────────────┐
│ RuleValidator│ (synchronous)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ LLMValidator │ (async, if API key configured)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ ResultMerger │
└──────┬───────┘
       │
       ▼
  Hide Loading
  Update UI
  Toast: "Validation complete"
```

**Key changes in v2.0:**
- Validation is **user-triggered** (not automatic after transcription)
- Validate button is in the **Validation panel header** (not Transcription panel)
- Loading overlay **preserves panel structure** (not innerHTML replacement)

## Extensibility

Rules can be added to the VALIDATION_RULES array in [validation.js](../docs/js/services/validation.js).

### Adding a Regex Rule

Provide id, name, description, regex pattern, type (warning/info/error), and message functions for pass/fail states.

### Adding a Custom Validator

For complex logic, provide a `validate` function instead of regex. The function receives the full text and segments array, returns an object with passed (boolean), lines (affected line numbers), matches (for counting), and optional details.

---

**References:**
- [DATA-SCHEMA](DATA-SCHEMA.md) for ValidationResult integration
- [DESIGN-SYSTEM](DESIGN-SYSTEM.md) for UI representation
