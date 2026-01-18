---
type: knowledge
created: 2026-01-16
tags: [coocr-htr, validation, llm-judge]
status: complete
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

Deterministic checks using regex and logic.

### Implemented Rules

```javascript
const VALIDATION_RULES = [
  {
    id: 'date_format',
    name: 'Date Format',
    regex: /\d{1,2}\.\s?(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)/gi,
    type: 'success',
    message: 'Date format correctly recognized'
  },
  {
    id: 'currency',
    name: 'Currency Format',
    regex: /\d+\s?(Taler|Groschen|Pfennig|Gulden|Kreuzer|fl\.?|kr\.?)/gi,
    type: 'success',
    message: 'Currency notation recognized'
  },
  {
    id: 'uncertain_marker',
    name: 'Uncertain Reading',
    regex: /\[\?\]/g,
    type: 'warning',
    message: 'Uncertain reading marked'
  },
  {
    id: 'illegible_marker',
    name: 'Illegible Passage',
    regex: /\[illegible\]/gi,
    type: 'error',
    message: 'Illegible passage'
  },
  {
    id: 'table_consistency',
    name: 'Table Structure',
    validate: (text) => {
      const lines = text.split('\n').filter(l => l.includes('|'));
      const pipeCounts = lines.map(l => (l.match(/\|/g) || []).length);
      return pipeCounts.every(c => c === pipeCounts[0]);
    },
    type: 'warning',
    message: 'Inconsistent column count'
  }
];
```

### Rule Categories

| Category | Examples | Type |
|----------|----------|------|
| Format | Date, Currency, Numbers | Regex |
| Structure | Table logic, Column count | Logic |
| Markers | [?], [illegible], [gap] | Regex |
| Sums | Addition verification | Logic |

## LLM Perspectives

Configurable validation angles for Expert-in-the-Loop.

### Perspective Definitions

```javascript
const PERSPECTIVES = {
  paleographic: {
    id: 'paleographic',
    name: 'Paleographic',
    prompt: `Analyze the text from a paleographic perspective:
      - Letter forms: Consistent with the period?
      - Ligatures: Correctly resolved?
      - Abbreviations: Correctly expanded?
      - Error types: Confusion of similar letters (n/u, c/e)?`
  },
  linguistic: {
    id: 'linguistic',
    name: 'Linguistic',
    prompt: `Analyze the text linguistically:
      - Grammar: Plausible sentences?
      - Orthography: Historical spelling?
      - Lexicon: Period-typical words?`
  },
  structural: {
    id: 'structural',
    name: 'Structural',
    prompt: `Analyze the text structure:
      - Table logic: Do sums match?
      - References: Consistent cross-references?
      - Numbering: Logical sequence?`
  },
  domain: {
    id: 'domain',
    name: 'Domain Knowledge',
    prompt: `Analyze with domain knowledge:
      - Technical terms: Correctly used?
      - Plausibility: Realistic quantities/prices/data?
      - Context: Fits the document type?`
  }
};
```

### Perspective Matrix

| Perspective | Checks | Typical Errors |
|-------------|--------|----------------|
| Paleographic | Letter forms | n↔u, c↔e, Ligatures |
| Linguistic | Grammar, Lexicon | Anachronisms, Syntax |
| Structural | Tables, Sums | Calculation errors, Breaks |
| Domain Knowledge | Technical terms, Plausibility | Unrealistic prices |

## Confidence Categories

No numeric values (→ [METHODOLOGY](METHODOLOGY.md): LLM Bias).

| Category | Internal | UI | Meaning |
|----------|----------|-----|---------|
| `certain` | `success` | Green | High agreement |
| `likely` | `warning` | Orange | Expert should review |
| `uncertain` | `error` | Red | Likely incorrect |

## ValidationResult Format

```typescript
interface ValidationResult {
  id: string;
  source: 'rule' | 'llm';
  type: 'success' | 'warning' | 'error';
  category: string;           // date_format, paleographic, ...
  message: string;
  lines: number[];            // Affected lines
  details?: string;           // Extended explanation
  suggestions?: string[];     // Alternative readings
  confidence?: 'certain' | 'likely' | 'uncertain';
}
```

## UI Representation

### Panel Structure (from UI Mockup)

```
┌─────────────────────────────────────────┐
│ Validation                    5 Issues  │
├─────────────────────────────────────────┤
│                                         │
│ RULE-BASED                               │
│ ┌─────────────────────────────────────┐ │
│ │ [OK] Date Format Correct            │ │
│ │    Lines 3-7 (DD. Month)            │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ [!] Sum Check Mismatch              │ │
│ │    Line 12 - Diff: 3 Taler          │ │
│ │    > Show Details                   │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ AI ASSISTANT                            │
│ ┌─────────────────────────────────────┐ │
│ │ [OK] High Confidence                │ │
│ │    Overall Document Match           │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ [!] Ambiguous Reading               │ │
│ │    Line 4 - Confidence: Low         │ │
│ │    > Show Details                   │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ [X] Missing Column                  │ │
│ │    Line 9                           │ │
│ │    > Show Details                   │ │
│ └─────────────────────────────────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

### Panel Header

| Element | Position | Description |
|---------|----------|-------------|
| Title | Left | "Validation" |
| Badge | Right | "5 Issues" (count of all Warnings + Errors) |

### Section Headers

| Section | Icon | Color |
|---------|------|-------|
| RULE-BASED | (gear) | `--text-secondary` |
| AI ASSISTANT | (sparkle) | `--text-secondary` |

### Card Anatomy

```
┌─ Border-Left (3px, Status color) ────────────────────┐
│                                                      │
│  [OK] Title                                          │
│     Meta-Info (Line X - Additional Info)             │
│     > Show Details (clickable, blue)                 │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Card Interaction

| Action | Reaction |
|--------|----------|
| Hover on Card | Background becomes `--bg-hover` |
| Click on Card | Card expands with details |
| Click on "Show Details" | Details section appears |
| Click on Line Reference | Jump to line in all panels |

### Expanded State

```
┌─────────────────────────────────────┐
│ [!] Sum Check Mismatch              │
│    Line 12 - Diff: 3 Taler          │
│    v Hide Details                   │
│ ┌─────────────────────────────────┐ │
│ │ Expected sum: 106 Taler         │ │
│ │ Found sum: 103 Taler            │ │
│ │ Difference: 3 Taler             │ │
│ │                                 │ │
│ │ Affected lines: 3, 4, 5, 12     │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### Visual Distinction

| Section | Characteristic | Description |
|---------|----------------|-------------|
| RULE-BASED | Deterministic | Always same result, Regex/Logic |
| AI ASSISTANT | Probabilistic | May vary, context-dependent |

### Status Indicators

| Status | Color | Dot | Description |
|--------|-------|-----|-------------|
| Success | `--success` (#3fb950) | (green) | Check passed |
| Warning | `--warning` (#d29922) | (yellow) | Expert should review |
| Error | `--error` (#f85149) | (red) | Error detected |

**Note:** In the UI, filled circles (●) are used instead of emojis.

## Validation Flow

```
Transcription loaded
       │
       ▼
┌──────────────┐
│ RuleValidator│ (immediate, synchronous)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ LLMValidator │ (async, optional)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ ResultMerger │
└──────┬───────┘
       │
       ▼
  UI-Update via EventBus
```

## Extensibility

### Adding a New Rule

```javascript
VALIDATION_RULES.push({
  id: 'custom_rule',
  name: 'My Rule',
  regex: /pattern/gi,
  type: 'warning',
  message: 'Description'
});
```

### Adding a New Perspective

```javascript
PERSPECTIVES.custom = {
  id: 'custom',
  name: 'My Perspective',
  prompt: 'Analyze...'
};
```

---

**References:**
- [DATA-SCHEMA](DATA-SCHEMA.md) for ValidationResult integration
- [DESIGN-SYSTEM](DESIGN-SYSTEM.md) for UI representation
