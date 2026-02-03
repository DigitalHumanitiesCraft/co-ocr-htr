---
type: knowledge
created: 2026-01-16
updated: 2026-02-03
tags: [coocr-htr, validation, llm-judge, navigation]
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

## Rule-Based Validation

Generic rules applicable to all document types (letters, diaries, account books, etc.).

### Implemented Rules (v2.0 - February 2026)

```javascript
const VALIDATION_RULES = [
  {
    id: 'uncertain_marker',
    name: 'Unsichere Lesungen',
    description: 'Stellen, die mit [?] markiert wurden',
    regex: /\[\?\]/g,
    type: 'warning',
    messagePass: (count) => `${count} unsichere Stelle(n) markiert`,
    messageFail: 'Keine unsicheren Markierungen'
  },
  {
    id: 'illegible_marker',
    name: 'Unleserliche Stellen',
    description: 'Stellen, die als [illegible] oder [...] markiert wurden',
    regex: /\[(illegible|\.\.\.)\]/gi,
    type: 'warning',
    messagePass: (count) => `${count} unleserliche Stelle(n)`,
    messageFail: 'Keine unleserlichen Stellen'
  },
  {
    id: 'abbreviations',
    name: 'Abkuerzungen',
    description: 'Erkannte Abkuerzungsmarkierungen wie admi[nistrateurs]',
    regex: /\w+\[[\w]+\]/g,
    type: 'info',
    messagePass: (count) => `${count} aufgeloeste Abkuerzung(en)`,
    messageFail: 'Keine Abkuerzungen erkannt'
  },
  {
    id: 'line_breaks',
    name: 'Zeilenanzahl',
    description: 'Anzahl der transkribierten Zeilen',
    validate: validateLineCount,
    type: 'info',
    messagePass: (count) => `${count} Zeilen transkribiert`,
    messageFail: 'Keine Zeilen gefunden'
  },
  {
    id: 'special_chars',
    name: 'Sonderzeichen',
    description: 'Ungewoehnliche Zeichen (moegl. OCR-Artefakte)',
    regex: /[^\w\s\.,;:!?\-\'\"\(\)\[\]...]/g,
    type: 'info',
    messagePass: (count) => `${count} Sonderzeichen gefunden`,
    messageFail: 'Keine ungewoehnlichen Zeichen'
  }
];
```

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

## LLM Perspectives

Configurable validation angles for Expert-in-the-Loop.

### Perspective Definitions

```javascript
const PERSPECTIVES = [
  {
    id: 'paleographic',
    name: 'Palaeographisch',
    description: 'Buchstabenformen, Ligaturen, Abkuerzungen'
  },
  {
    id: 'linguistic',
    name: 'Sprachlich',
    description: 'Grammatik, historische Orthographie'
  },
  {
    id: 'structural',
    name: 'Strukturell',
    description: 'Tabellen, Summen, Verweise'
  },
  {
    id: 'domain',
    name: 'Domaenenwissen',
    description: 'Fachtermini, Plausibilitaet'
  }
];
```

### Perspective Matrix

| Perspective | Checks | Typical Errors |
|-------------|--------|----------------|
| Paleographic | Letter forms | n/u confusion, c/e, Ligatures |
| Linguistic | Grammar, Lexicon | Anachronisms, Syntax |
| Structural | Tables, Sums | Calculation errors, Breaks |
| Domain Knowledge | Technical terms, Plausibility | Unrealistic prices |

## Confidence Categories

No numeric values (see [METHODOLOGY](METHODOLOGY.md): LLM Bias).

| Category | German | UI Color | Meaning |
|----------|--------|----------|---------|
| `certain` | Hohe Konfidenz | Green | High agreement |
| `likely` | Mittlere Konfidenz | Orange | Expert should review |
| `uncertain` | Niedrige Konfidenz | Red | Likely incorrect |

## ValidationResult Format

```typescript
interface ValidationResult {
  id: string;
  name: string;
  description: string;
  type: 'success' | 'warning' | 'error' | 'info';
  passed: boolean;
  message: string;
  lines: number[];            // Affected lines
  matches: any[];             // Matched patterns
  matchCount: number;         // Count for display
  details?: string;           // Extended explanation
}
```

## UI Representation (v2.0 - Compact Layout)

### Panel Layout

```
┌─────────────────────────────────────────────────┐
│ VALIDATION            [Validate]    1 Issue     │
├─────────────────────────────────────────────────┤
│ RULE-BASED                                      │
│ ● Unsichere Lesungen     Keine Markierungen     │
│ ● Unleserliche Stellen   1 unleserliche Stelle  │
│ ● Abkuerzungen           1 aufgeloest           │
│ ● Zeilenanzahl           36 Zeilen transkribiert│
│ ● Sonderzeichen          Keine ungewoehnlichen  │
├─────────────────────────────────────────────────┤
│ AI ASSISTANT                                    │
│ ● Konfidenz              Mittlere Konfidenz     │
│ ● Perspektive            Palaeographisch        │
│ ● Zeile 5                Le prix lorem ipsum    │
│ ● Zeile 16               admi[illegible]trateurs│
│ > Analyse anzeigen                              │
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

```javascript
// state.js - Check for coordinates
hasRegionCoordinates() {
    return this.data.regions?.length > 0 &&
           this.data.regions.some(r => r.x !== undefined);
}

// viewer.js - Selection handler with fallback
appState.addEventListener('selectionChanged', (e) => {
    if (appState.hasRegionCoordinates()) {
        highlightRegion(lineNumber);
        panToRegion(lineNumber);
    } else {
        // Show info toast for documents without coordinates
        dialogManager.showToast(
            `Zeile ${lineNumber} - Keine Bildkoordinaten verfügbar`,
            'info', 2000
        );
    }
});

// editor.js - Always highlight in editor
appState.addEventListener('selectionChanged', (e) => {
    highlightEditorLine(e.detail.line);
});
```

### Click Handlers

Both legacy `.validation-card` and compact `.validation-item` elements with `data-line` attribute trigger navigation:

```javascript
const selector = '.validation-card[data-line], .validation-item[data-line]';
```

## Validation Flow

```
User clicks "Validate" button
       │
       ▼
┌──────────────────┐
│ Show Loading     │ (Overlay on validation panel)
│ "Validierung..." │
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
  Toast: "Validierung abgeschlossen"
```

**Key changes in v2.0:**
- Validation is **user-triggered** (not automatic after transcription)
- Validate button is in the **Validation panel header** (not Transcription panel)
- Loading overlay **preserves panel structure** (not innerHTML replacement)

## Extensibility

### Adding a New Rule

```javascript
VALIDATION_RULES.push({
  id: 'custom_rule',
  name: 'My Rule',
  description: 'What this rule checks',
  regex: /pattern/gi,
  type: 'warning',  // or 'info', 'error'
  messagePass: (count) => `${count} matches found`,
  messageFail: 'No matches found'
});
```

### Adding a Custom Validator

```javascript
VALIDATION_RULES.push({
  id: 'custom_validator',
  name: 'My Custom Check',
  description: 'Complex validation logic',
  validate: (text, segments) => {
    // Your logic here
    const count = /* calculate something */;
    return {
      passed: count > 0,
      lines: [],           // Affected line numbers
      matches: [count],    // For custom validators, first element is the count
      details: null
    };
  },
  type: 'info',
  messagePass: (count) => `Result: ${count}`,
  messageFail: 'No results'
});
```

---

**References:**
- [DATA-SCHEMA](DATA-SCHEMA.md) for ValidationResult integration
- [DESIGN-SYSTEM](DESIGN-SYSTEM.md) for UI representation
