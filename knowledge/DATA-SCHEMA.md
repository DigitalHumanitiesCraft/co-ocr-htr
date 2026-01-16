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
}

interface Segment {
  text: string;
  confidence: 'certain' | 'likely' | 'uncertain';
  bounds?: BoundingBox;
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

## Beispiel: Rechnungsbuch-Eintrag

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "timestamp": "2026-01-16T17:08:00Z",
  "document": {
    "filename": "Rechnungsbuch_1842_S15.jpg",
    "mimeType": "image/jpeg",
    "pages": 47,
    "currentPage": 15
  },
  "transcription": {
    "provider": "gemini",
    "model": "gemini-2.0-flash",
    "raw": "| Datum | Beschreibung | Betrag |\n|-------|--------------|--------|\n| 28. Mai | K. Schmidt, Eisenwaren | 23 Taler |\n| 28. Mai | L. [?] Müller, Kornkauf | 12 Taler |",
    "segments": [
      {
        "text": "| Datum | Beschreibung | Betrag |",
        "confidence": "certain",
        "bounds": { "x": 50, "y": 70, "width": 350, "height": 25 }
      },
      {
        "text": "| 28. Mai | K. Schmidt, Eisenwaren | 23 Taler |",
        "confidence": "certain",
        "bounds": { "x": 50, "y": 100, "width": 350, "height": 25 }
      },
      {
        "text": "| 28. Mai | L. [?] Müller, Kornkauf | 12 Taler |",
        "confidence": "likely",
        "bounds": { "x": 50, "y": 130, "width": 350, "height": 25 }
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

**Verweise:**
- [VALIDATION](VALIDATION.md) für Regel-Implementierung
- [ARCHITECTURE](ARCHITECTURE.md) für Storage-Integration
