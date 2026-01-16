# Datenstrukturen

JSON-Schemas und Beispieldaten für coOCR/HTR.

**Abhängigkeit:** [ARCHITECTURE](ARCHITECTURE.md) (Storage-Integration)

## Hauptschema: Transcription

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
  raw: string;                   // Rohtext
  segments: Segment[];
  columns?: ColumnDefinition[];  // Für strukturierte Dokumente
}

interface Segment {
  lineNumber: number;            // Zeilennummer (für Synchronisation)
  text: string;
  confidence: 'certain' | 'likely' | 'uncertain';
  bounds?: BoundingBox;
  fields?: Record<string, string>;  // Strukturierte Felder (DATUM, NAME, etc.)
}

interface ColumnDefinition {
  id: string;                    // z.B. 'datum', 'name', 'beschreibung', 'betrag'
  label: string;                 // z.B. 'DATUM', 'NAME', etc.
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

## Beispiel: Rechnungsbuch-Eintrag (aus UI-Mockup)

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
      { "id": "datum", "label": "DATUM", "width": "auto" },
      { "id": "name", "label": "NAME", "width": "auto" },
      { "id": "beschreibung", "label": "BESCHREIBUNG", "width": "flex" },
      { "id": "betrag", "label": "BETRAG", "width": "auto" }
    ],
    "segments": [
      {
        "lineNumber": 3,
        "text": "28. Mai | K. Schmidt | Eisenwaren | 23 Taler",
        "confidence": "certain",
        "bounds": { "x": 28, "y": 255, "width": 482, "height": 35 },
        "fields": {
          "datum": "28. Mai",
          "name": "K. Schmidt",
          "beschreibung": "Eisenwaren",
          "betrag": "23 Taler"
        }
      },
      {
        "lineNumber": 4,
        "text": "28. Mai | [?] Schmidt | Pinsel... | 10 Taler 4 Gr",
        "confidence": "likely",
        "bounds": { "x": 28, "y": 290, "width": 482, "height": 35 },
        "fields": {
          "datum": "28. Mai",
          "name": "[?] Schmidt",
          "beschreibung": "Pinsel...",
          "betrag": "10 Taler 4 Gr"
        }
      },
      {
        "lineNumber": 5,
        "text": "3. Juni | H. Müller | Tuchstoff | 15 Taler 4 Gr",
        "confidence": "certain",
        "bounds": { "x": 28, "y": 325, "width": 482, "height": 35 },
        "fields": {
          "datum": "3. Juni",
          "name": "H. Müller",
          "beschreibung": "Tuchstoff",
          "betrag": "15 Taler 4 Gr"
        }
      },
      {
        "lineNumber": 6,
        "text": "3. Juni | H. Müller | Tuchstoff | 15 Taler 4 Gr",
        "confidence": "certain",
        "bounds": { "x": 28, "y": 360, "width": 482, "height": 35 },
        "fields": {
          "datum": "3. Juni",
          "name": "H. Müller",
          "beschreibung": "Tuchstoff",
          "betrag": "15 Taler 4 Gr"
        }
      },
      {
        "lineNumber": 7,
        "text": "4. Juni | Stadtkasse | ... | 40 Taler",
        "confidence": "likely",
        "bounds": { "x": 28, "y": 395, "width": 482, "height": 35 },
        "fields": {
          "datum": "4. Juni",
          "name": "Stadtkasse",
          "beschreibung": "...",
          "betrag": "40 Taler"
        }
      },
      {
        "lineNumber": 8,
        "text": "5. Juni | Unbekannt | Lieferung | [?] Taler",
        "confidence": "uncertain",
        "bounds": { "x": 28, "y": 430, "width": 482, "height": 35 },
        "fields": {
          "datum": "5. Juni",
          "name": "Unbekannt",
          "beschreibung": "Lieferung",
          "betrag": "[?] Taler"
        }
      },
      {
        "lineNumber": 10,
        "text": "Total | | | 103 Taler 1...",
        "confidence": "likely",
        "bounds": { "x": 28, "y": 500, "width": 482, "height": 35 },
        "fields": {
          "datum": "Total",
          "name": "",
          "beschreibung": "",
          "betrag": "103 Taler 1..."
        }
      }
    ]
  },
  "validation": {
    "status": "uncertain",
    "rules": [
      {
        "id": "date_format",
        "name": "Datumsformat",
        "passed": true,
        "message": "Datumsformat korrekt (DD. Monat)",
        "lines": [3, 4]
      },
      {
        "id": "currency",
        "name": "Währungsformat",
        "passed": true,
        "message": "Währung erkannt (Taler)",
        "lines": [3, 4]
      },
      {
        "id": "uncertain_marker",
        "name": "Unsichere Lesung",
        "passed": false,
        "message": "Unsichere Lesung [?] vorhanden",
        "lines": [4]
      }
    ],
    "llmJudge": {
      "perspective": "paleographic",
      "confidence": "likely",
      "reasoning": "Der Name könnte 'Müller' oder 'Möller' sein. Die Handschrift zeigt eine Ligatur, die beide Lesarten zulässt."
    }
  },
  "corrections": [
    {
      "segmentIndex": 2,
      "original": "L. [?] Müller",
      "corrected": "L. [?] Müller",
      "reason": "Name bleibt unsicher, Marker beibehalten",
      "timestamp": "2026-01-16T17:15:00Z"
    }
  ]
}
```

## Storage-Schemas

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

## Export-Formate

### Markdown

```markdown
# Rechnungsbuch_1842_S15

| Datum | Beschreibung | Betrag |
|-------|--------------|--------|
| 28. Mai | K. Schmidt, Eisenwaren | 23 Taler |
| 28. Mai | L. [?] Müller, Kornkauf | 12 Taler |

## Validierungshinweise

- ⚠️ Zeile 4: Unsichere Lesung [?] – Name könnte "Möller" sein
```

### JSON (vollständig)

Komplettes Transcription-Objekt (siehe oben).

### TSV (Tabellendaten)

```
Datum	Beschreibung	Betrag
28. Mai	K. Schmidt, Eisenwaren	23 Taler
28. Mai	L. [?] Müller, Kornkauf	12 Taler
```

## Validierungsregeln-Referenz

| Regel-ID | Regex/Logik | Typ |
|----------|-------------|-----|
| `date_format` | `/\d{1,2}\.\s?(Januar\|...\|Dezember)/gi` | success |
| `currency` | `/\d+\s?(Taler\|Groschen\|...)/gi` | success |
| `uncertain_marker` | `/\[\?\]/g` | warning |
| `illegible_marker` | `/\[illegible\]/gi` | error |
| `table_consistency` | Pipe-Count pro Zeile gleich | warning |

---

## Import-Formate

### PAGE-XML (Transkribus/PyLaia)

Externes Format für den Import bestehender Transkriptionen. Siehe [data/README.md](../data/README.md).

**Namespace:** `http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15`

```typescript
// PAGE-XML Struktur (vereinfacht)
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

| PAGE-XML | coOCR/HTR Segment | Konvertierung |
|----------|-------------------|---------------|
| `TextLine/Coords@points` | `bounds` | Polygon → BoundingBox |
| `TextLine/TextEquiv/Unicode` | `text` | Direkt |
| `TranskribusMetadata@status` | `confidence` | FINAL→certain, IN_PROGRESS→likely, NEW→uncertain |
| `ReadingOrder/index` | `lineNumber` | Sequenznummer |

### Koordinaten-Konvertierung

```javascript
/**
 * Konvertiert PAGE-XML Polygon zu coOCR/HTR BoundingBox
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

### Beispiel: PAGE-XML Import

**Eingabe (PAGE-XML):**
```xml
<TextLine id="line_1">
  <Coords points="100,200 500,200 500,240 100,240"/>
  <TextEquiv>
    <Unicode>28. Mai | K. Schmidt | Eisenwaren | 23 Taler</Unicode>
  </TextEquiv>
</TextLine>
```

**Ausgabe (coOCR/HTR Segment):**
```json
{
  "lineNumber": 1,
  "text": "28. Mai | K. Schmidt | Eisenwaren | 23 Taler",
  "confidence": "certain",
  "bounds": { "x": 100, "y": 200, "width": 400, "height": 40 },
  "fields": {
    "datum": "28. Mai",
    "name": "K. Schmidt",
    "beschreibung": "Eisenwaren",
    "betrag": "23 Taler"
  }
}
```

---

## Beispieldaten

Verfügbar in `data/`:

| Datensatz | Seiten | Status | Format |
|-----------|--------|--------|--------|
| Raitbuch 2 | 123 | FINAL | PAGE-XML |
| 1617-wecker | 83 | Teilweise | PAGE-XML |
| o_szd.* | 12 | Metadaten | METS-XML |
| Schliemann | 21 | Nur Bilder | JPG |

Siehe [data/README.md](../data/README.md) für Details.

---

**Verweise:**
- [VALIDATION](VALIDATION.md) für Regel-Implementierung
- [ARCHITECTURE](ARCHITECTURE.md) für Storage-Integration
- [data/README.md](../data/README.md) für Beispieldaten
