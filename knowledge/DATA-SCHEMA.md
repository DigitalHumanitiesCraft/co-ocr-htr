---
type: knowledge
created: 2026-01-16
tags: [coocr-htr, data-schema, page-xml]
status: complete
---

# Data Structures

JSON schemas and example data for coOCR/HTR.

**Dependency:** [ARCHITECTURE](ARCHITECTURE.md) (Storage Integration)

## Source Types

coOCR/HTR supports various historical document types with flexible editor rendering.

### Supported Source Types

| Type | Structure | Editor Mode | Example |
|------|-----------|-------------|---------|
| **Prose** | Lines without columns | `lines` | Letters, diaries, manuscripts |
| **Tabular** | Lines with columns | `grid` | Account books, inventories, registers |
| **Structured** | Key-value pairs | `structured` | Index cards, forms |
| **Mixed** | Varying | `auto` | Books with tables and text |

### Editor Modes

```typescript
type EditorMode = 'lines' | 'grid' | 'structured' | 'auto';

interface EditorConfig {
  mode: EditorMode;
  columns?: ColumnDefinition[];  // Only for 'grid'
  fields?: FieldDefinition[];    // Only for 'structured'
}
```

### Automatic Mode Detection

The editor automatically selects the mode based on:

1. **PAGE-XML Structure:** If `TextRegion` contains multiple `TextLine` without explicit columns → `lines`
2. **Pipe Separator:** If text contains `|` → `grid` with automatic column count
3. **Explicit Configuration:** `columns[]` in schema → `grid`
4. **Fallback:** `lines` (simplest mode)

## Main Schema: Transcription

```typescript
interface Transcription {
  id: string;                    // UUID
  timestamp: string;             // ISO 8601
  document: Document;
  transcription: TranscriptionData;
  validation: ValidationData;
  corrections: Correction[];
}

interface Document {
  filename: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/tiff' | 'application/pdf';
  pages: number;
  currentPage: number;
  dataUrl?: string;              // Base64 (optional)
}

interface TranscriptionData {
  provider: 'gemini' | 'claude' | 'openai' | 'ollama';
  model: string;
  raw: string;                   // Raw text
  segments: Segment[];
  columns?: ColumnDefinition[];  // For structured documents
}

interface Segment {
  lineNumber: number;            // Line number (for synchronization)
  text: string;
  confidence: 'certain' | 'likely' | 'uncertain';
  bounds?: BoundingBox;
  fields?: Record<string, string>;  // Structured fields (DATE, NAME, etc.)
}

interface ColumnDefinition {
  id: string;                    // e.g., 'date', 'name', 'description', 'amount'
  label: string;                 // e.g., 'DATE', 'NAME', etc.
  width: 'auto' | 'flex' | number;
}

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ValidationData {
  status: 'valid' | 'uncertain' | 'invalid';
  rules: RuleResult[];
  llmJudge?: LLMJudgeResult;
}

interface RuleResult {
  id: string;
  name: string;
  passed: boolean;
  message: string;
  lines?: number[];
}

interface LLMJudgeResult {
  perspective: string;
  confidence: 'certain' | 'likely' | 'uncertain';
  reasoning: string;
}

interface Correction {
  segmentIndex: number;
  original: string;
  corrected: string;
  reason: string;
  timestamp: string;
}
```

## Example: Account Book Entry (from UI Mockup)

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "timestamp": "2026-01-16T17:28:00Z",
  "document": {
    "filename": "Rechnungsbuch_1842_S15.jpg",
    "mimeType": "image/jpeg",
    "pages": 47,
    "currentPage": 15
  },
  "transcription": {
    "provider": "gemini",
    "model": "gemini-2.0-flash",
    "raw": "...",
    "columns": [
      { "id": "date", "label": "DATE", "width": "auto" },
      { "id": "name", "label": "NAME", "width": "auto" },
      { "id": "description", "label": "DESCRIPTION", "width": "flex" },
      { "id": "amount", "label": "AMOUNT", "width": "auto" }
    ],
    "segments": [
      {
        "lineNumber": 3,
        "text": "28. Mai | K. Schmidt | Eisenwaren | 23 Taler",
        "confidence": "certain",
        "bounds": { "x": 28, "y": 255, "width": 482, "height": 35 },
        "fields": {
          "date": "28. Mai",
          "name": "K. Schmidt",
          "description": "Eisenwaren",
          "amount": "23 Taler"
        }
      },
      {
        "lineNumber": 4,
        "text": "28. Mai | [?] Schmidt | Pinsel... | 10 Taler 4 Gr",
        "confidence": "likely",
        "bounds": { "x": 28, "y": 290, "width": 482, "height": 35 },
        "fields": {
          "date": "28. Mai",
          "name": "[?] Schmidt",
          "description": "Pinsel...",
          "amount": "10 Taler 4 Gr"
        }
      },
      {
        "lineNumber": 5,
        "text": "3. Juni | H. Müller | Tuchstoff | 15 Taler 4 Gr",
        "confidence": "certain",
        "bounds": { "x": 28, "y": 325, "width": 482, "height": 35 },
        "fields": {
          "date": "3. Juni",
          "name": "H. Müller",
          "description": "Tuchstoff",
          "amount": "15 Taler 4 Gr"
        }
      },
      {
        "lineNumber": 6,
        "text": "3. Juni | H. Müller | Tuchstoff | 15 Taler 4 Gr",
        "confidence": "certain",
        "bounds": { "x": 28, "y": 360, "width": 482, "height": 35 },
        "fields": {
          "date": "3. Juni",
          "name": "H. Müller",
          "description": "Tuchstoff",
          "amount": "15 Taler 4 Gr"
        }
      },
      {
        "lineNumber": 7,
        "text": "4. Juni | Stadtkasse | ... | 40 Taler",
        "confidence": "likely",
        "bounds": { "x": 28, "y": 395, "width": 482, "height": 35 },
        "fields": {
          "date": "4. Juni",
          "name": "Stadtkasse",
          "description": "...",
          "amount": "40 Taler"
        }
      },
      {
        "lineNumber": 8,
        "text": "5. Juni | Unbekannt | Lieferung | [?] Taler",
        "confidence": "uncertain",
        "bounds": { "x": 28, "y": 430, "width": 482, "height": 35 },
        "fields": {
          "date": "5. Juni",
          "name": "Unknown",
          "description": "Delivery",
          "amount": "[?] Taler"
        }
      },
      {
        "lineNumber": 10,
        "text": "Total | | | 103 Taler 1...",
        "confidence": "likely",
        "bounds": { "x": 28, "y": 500, "width": 482, "height": 35 },
        "fields": {
          "date": "Total",
          "name": "",
          "description": "",
          "amount": "103 Taler 1..."
        }
      }
    ]
  },
  "validation": {
    "status": "uncertain",
    "rules": [
      {
        "id": "date_format",
        "name": "Date Format",
        "passed": true,
        "message": "Date format correct (DD. Month)",
        "lines": [3, 4]
      },
      {
        "id": "currency",
        "name": "Currency Format",
        "passed": true,
        "message": "Currency recognized (Taler)",
        "lines": [3, 4]
      },
      {
        "id": "uncertain_marker",
        "name": "Uncertain Reading",
        "passed": false,
        "message": "Uncertain reading [?] present",
        "lines": [4]
      }
    ],
    "llmJudge": {
      "perspective": "paleographic",
      "confidence": "likely",
      "reasoning": "The name could be 'Müller' or 'Möller'. The handwriting shows a ligature that allows both readings."
    }
  },
  "corrections": [
    {
      "segmentIndex": 2,
      "original": "L. [?] Müller",
      "corrected": "L. [?] Müller",
      "reason": "Name remains uncertain, marker retained",
      "timestamp": "2026-01-16T17:15:00Z"
    }
  ]
}
```

## Storage Schemas

### LocalStorage

```javascript
// coocr:settings
{
  "theme": "dark",
  "defaultModel": "gemini",
  "defaultPerspective": "paleographic",
  "autoSave": true,
  "autoValidate": true
}

// coocr:apikeys
{
  "gemini": "base64-obfuscated-key",
  "openai": null,
  "anthropic": null,
  "ollama": "http://localhost:11434"
}
```

### IndexedDB

```javascript
const DB_SCHEMA = {
  database: 'coocr-htr',
  version: 1,
  stores: {
    documents: {
      keyPath: 'id',
      indexes: ['filename', 'createdAt', 'updatedAt']
    },
    transcriptions: {
      keyPath: 'id',
      indexes: ['documentId', 'pageNumber', 'version']
    },
    sessions: {
      keyPath: 'id',
      indexes: ['lastAccessed']
    }
  }
};
```

## Export Formats

### Markdown

```markdown
# Rechnungsbuch_1842_S15

| Date | Description | Amount |
|------|-------------|--------|
| 28. Mai | K. Schmidt, Eisenwaren | 23 Taler |
| 28. Mai | L. [?] Müller, Kornkauf | 12 Taler |

## Validation Notes

- WARNING: Line 4: Uncertain reading [?] - Name could be "Moeller"
```

### JSON (complete)

Complete Transcription object (see above).

### TSV (Tabular Data)

```
Date	Description	Amount
28. Mai	K. Schmidt, Eisenwaren	23 Taler
28. Mai	L. [?] Müller, Kornkauf	12 Taler
```

## Validation Rules Reference

| Rule ID | Regex/Logic | Type |
|---------|-------------|------|
| `date_format` | `/\d{1,2}\.\s?(Januar\|...\|Dezember)/gi` | success |
| `currency` | `/\d+\s?(Taler\|Groschen\|...)/gi` | success |
| `uncertain_marker` | `/\[\?\]/g` | warning |
| `illegible_marker` | `/\[illegible\]/gi` | error |
| `table_consistency` | Pipe count per line equal | warning |

---

## Import Formats

### PAGE-XML (Transkribus/PyLaia)

External format for importing existing transcriptions. See [data/README.md](../data/README.md).

**Namespace:** `http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15`

```typescript
// PAGE-XML Structure (simplified)
interface PageXML {
  PcGts: {
    Metadata: {
      Creator: string;           // "prov=READ-COOP:name=PyLaia..."
      Created: string;           // ISO 8601
      TranskribusMetadata?: {
        docId: string;
        pageId: string;
        status: 'NEW' | 'IN_PROGRESS' | 'FINAL';
      };
    };
    Page: {
      imageFilename: string;
      imageWidth: number;
      imageHeight: number;
      TextRegion: TextRegion[];
    };
  };
}

interface TextRegion {
  id: string;
  Coords: { points: string };    // "x1,y1 x2,y2 x3,y3 x4,y4"
  TextLine: TextLine[];
}

interface TextLine {
  id: string;
  Coords: { points: string };
  Baseline?: { points: string };
  Word?: Word[];
  TextEquiv: { Unicode: string };
}

interface Word {
  id: string;
  Coords: { points: string };
  TextEquiv: { Unicode: string };
}
```

### Mapping PAGE-XML → coOCR/HTR

| PAGE-XML | coOCR/HTR Segment | Conversion |
|----------|-------------------|------------|
| `TextLine/Coords@points` | `bounds` | Polygon → BoundingBox |
| `TextLine/TextEquiv/Unicode` | `text` | Direct |
| `TranskribusMetadata@status` | `confidence` | FINAL→certain, IN_PROGRESS→likely, NEW→uncertain |
| `ReadingOrder/index` | `lineNumber` | Sequence number |

### Coordinate Conversion

```javascript
/**
 * Converts PAGE-XML Polygon to coOCR/HTR BoundingBox
 * @param points "x1,y1 x2,y2 x3,y3 x4,y4"
 * @returns BoundingBox
 */
function polygonToBounds(points) {
  const coords = points.split(' ').map(p => {
    const [x, y] = p.split(',').map(Number);
    return { x, y };
  });
  const xs = coords.map(c => c.x);
  const ys = coords.map(c => c.y);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys)
  };
}
```

### Example: PAGE-XML Import

**Input (PAGE-XML):**
```xml
<TextLine id="line_1">
  <Coords points="100,200 500,200 500,240 100,240"/>
  <TextEquiv>
    <Unicode>28. Mai | K. Schmidt | Eisenwaren | 23 Taler</Unicode>
  </TextEquiv>
</TextLine>
```

**Output (coOCR/HTR Segment):**
```json
{
  "lineNumber": 1,
  "text": "28. Mai | K. Schmidt | Eisenwaren | 23 Taler",
  "confidence": "certain",
  "bounds": { "x": 100, "y": 200, "width": 400, "height": 40 },
  "fields": {
    "date": "28. Mai",
    "name": "K. Schmidt",
    "description": "Eisenwaren",
    "amount": "23 Taler"
  }
}
```

---

## Example Data

Available in `data/`:

| Dataset | Pages | Status | Format |
|---------|-------|--------|--------|
| Raitbuch 2 | 123 | FINAL | PAGE-XML |
| 1617-wecker | 83 | Partial | PAGE-XML |
| o_szd.* | 12 | Metadata | METS-XML |
| Schliemann | 21 | Images only | JPG |

See [data/README.md](../data/README.md) for details.

---

**References:**
- [VALIDATION](VALIDATION.md) for rule implementation
- [ARCHITECTURE](ARCHITECTURE.md) for storage integration
- [data/README.md](../data/README.md) for example data
