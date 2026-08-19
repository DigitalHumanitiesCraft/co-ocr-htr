---
type: knowledge
created: 2026-01-16
updated: 2026-01-18
tags: [coocr-htr, data-schema, page-xml, utilities]
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

### Editor Modes

| Mode | Configuration | Use Case |
|------|---------------|----------|
| lines | None | Prose text without columns (default) |
| grid | columns array | Tabular data with defined columns |

## Main Schema: Transcription

The central data structure contains document metadata, transcription content, validation results, and correction history.

### Top-Level Structure

| Field | Type | Description |
|-------|------|-------------|
| project | Object | Active project metadata (`id`, `name`) |
| document | Object | Source file metadata |
| pages | Array | Multi-page document metadata |
| currentPageIndex | Number | Active page index (0-based) |
| transcription | Object | OCR/HTR results |
| description | Object | Image description data (current page) |
| validation | Object | Quality assessment |
| corrections | Array | Edit history |
| batch | Object | Batch operation state (operation/status/progress) |
| batchTranscriptions | Array | Batch transcription results per page |
| batchValidations | Array | Batch validation results per page |
| batchDescriptions | Array | Batch description results per page |
| meta | Object | Session metadata (`createdAt`, `updatedAt`) |

### Document Object

| Field | Type | Description |
|-------|------|-------------|
| id | String | Internal document/page identifier |
| filename | String | Original file name |
| mimeType | String | image/jpeg, image/png, image/tiff, application/pdf |
| dataUrl | String (optional) | Base64 encoded image |
| width | Number | Image width in pixels |
| height | Number | Image height in pixels |

### Transcription Segment

Each line of transcribed text is stored as a segment:

| Field | Type | Description |
|-------|------|-------------|
| lineNumber | Number | Position in document (for synchronization) |
| text | String | Transcribed content |
| confidence | Enum | certain, likely, or uncertain |
| bounds | Object (optional) | x, y, width, height for region highlighting |
| fields | Object (optional) | Structured data (DATE, NAME, etc.) |

### Validation Result

| Field | Type | Description |
|-------|------|-------------|
| status | Enum | idle, running, complete, or error |
| rules | Array | Results from rule-based validation |
| llmJudge | Object (optional) | LLM Review analysis |
| summary | Object/null | Aggregated issue counts |
| timestamp | ISO 8601/null | Validation timestamp |
| customPrompt | String | User-defined expert prompt |

### Correction Entry

| Field | Type | Description |
|-------|------|-------------|
| lineNumber | Number | Which line was corrected |
| original | String | Text before edit |
| corrected | String | Text after edit |
| timestamp | ISO 8601 | When the edit occurred |

## Example: Account Book Entry

A typical tabular document (Rechnungsbuch 1842, page 15) demonstrates the data structure:

**Document:** 47-page account book, JPEG image, processed with Gemini

**Columns:** DATE, NAME, DESCRIPTION, AMOUNT (typical for account books)

**Sample Segments:**
| Line | Text | Confidence | Notes |
|------|------|------------|-------|
| 3 | 28. Mai, K. Schmidt, Eisenwaren, 23 Taler | certain | All fields clear |
| 4 | 28. Mai, [?] Schmidt, Pinsel..., 10 Taler 4 Gr | likely | Name unclear |
| 8 | 5. Juni, Unbekannt, Lieferung, [?] Taler | uncertain | Name and amount unclear |
| 10 | Total, 103 Taler 1... | likely | Sum line, amount truncated |

**Validation Results:**
- Date format check: passed (DD. Month pattern)
- Currency format check: passed (Taler recognized)
- Uncertain marker check: failed (line 4 has [?])
- LLM Review: "The name could be Mueller or Moeller. The handwriting shows a ligature that allows both readings."

**Correction History:** Line 2 was reviewed but marker retained as reading remains uncertain.

## Storage Schemas

**Implementation:** [storage.js](../docs/js/services/storage.js)

### LocalStorage

Used for synchronous settings and prompt fallbacks:

| Key | Content |
|-----|---------|
| coocr:settings | Theme, model preferences, workflow/UI settings |
| coocr:descriptionPrompt | Last custom description prompt |
| coocr:validationPrompt | Last custom validation prompt |
| coocr:activeProjectId | Active project ID for startup restore |

### IndexedDB

Four object stores for persistent data:

| Store | Key | Indexes | Content |
|-------|-----|---------|---------|
| projects | id | name, updatedAt | Project metadata |
| sessions | projectId | (primary key) | Serialized project session |
| images | id (`projectId_pageId`) | projectId | Page/document image data |
| apiKeys | provider | (primary key) | Optional persisted API keys |

## Export Formats

**Implementation:** [export.js](../docs/js/services/export.js)

| Format | Extension | Content | Use Case |
|--------|-----------|---------|----------|
| Markdown | .md | Table with validation notes | Human-readable documentation |
| JSON | .json | Complete transcription object | Data interchange, backup |
| TEI-XML | .tei.xml | TEI P5 minimal schema | Digital editions |
| PAGE-XML | .xml | 2019-07-15 schema | Transkribus compatibility |
| Plain Text | .txt | Lines only | Simple export |
| ZIP (batch) | .zip | Per-page exports + manifest | Multi-page package export |

## Validation Rules Reference

Current generic rules (v2.0) - see [VALIDATION.md](VALIDATION.md) for details:

| Rule ID | Pattern | Type |
|---------|---------|------|
| `uncertain_marker` | `[?]` | warning |
| `illegible_marker` | `[illegible]`, `[...]` | warning |
| `abbreviations` | `word[expansion]` | info |
| `line_count` | Line count | info |
| `char_count` | Character count | info |
| `special_chars` | Unusual characters | warning |
| `double_spaces` | Multiple spaces | info |
| `control_chars` | Non-printable characters | error |

**Note:** Document-type-specific rules (date_format, currency, table_consistency) were removed in v2.0 to avoid false positives on different document types.

---

## Import Formats

### PAGE-XML (Transkribus/PyLaia)

**Implementation:** [page-xml.js](../docs/js/services/parsers/page-xml.js)

**Namespace:** `http://schema.primaresearch.org/PAGE/gts/pagecontent/2019-07-15`

PAGE-XML is the standard format from tools like Transkribus and PyLaia. The parser extracts:
- Page metadata (image filename, dimensions)
- Text regions and lines with polygon coordinates
- Transkribus-specific metadata (docId, pageId, status)

### Mapping PAGE-XML to coOCR/HTR

| PAGE-XML Element | coOCR/HTR Field | Conversion |
|------------------|-----------------|------------|
| TextLine/Coords@points | bounds | Polygon to bounding box (min/max) |
| TextLine/TextEquiv/Unicode | text | Direct copy |
| TranskribusMetadata@status | confidence | FINAL→certain, IN_PROGRESS→likely, NEW→uncertain |
| ReadingOrder/index | lineNumber | Sequence number |

### Coordinate Conversion

PAGE-XML uses polygon coordinates (four corner points). These are converted to bounding boxes by calculating min/max X and Y values. The conversion is implemented in the page-xml parser.

---

## Example Data

Available in `data/`:

| Dataset | Pages | Status | Format |
|---------|-------|--------|--------|
| Raitbuch 2 | 123 | None (empty PAGE-XML skeletons, `status NEW`) | PAGE-XML |
| 1617-wecker | 83 | Partial | PAGE-XML |
| o_szd.* | 12 | Metadata | METS-XML |
| Schliemann | 21 | Images only | JPG |

See [data/README.md](../data/README.md) for details.

---

## JavaScript Utility Modules

Centralized utilities in [docs/js/utils/](../docs/js/utils/) to reduce code duplication.

### constants.js

Configuration values organized by category:
- **Timing:** Toast durations, auto-save delays, menu close delays
- **File Limits:** Maximum file size (50MB), supported MIME types
- **IIIF:** Context strings, version constants
- **Storage Keys:** LocalStorage key names
- **Events:** Standard event name strings
- **CSS Classes:** Common class names (hidden, active, selected, etc.)

### dom.js

Null-safe DOM manipulation functions:
- **Selection:** getById, select, selectAll
- **Visibility:** show, hide, toggleVisibility (using hidden attribute)
- **Classes:** addClass, removeClass, toggleClass
- **Content:** setText, setHTML, clearChildren
- **State:** setDisabled
- **Utilities:** createSVGElement, focusDelayed

### textFormatting.js

Text marker utilities for confidence indicators:
- **Detection:** hasUncertainMarker ([?]), hasIllegibleMarker ([illegible])
- **Counting:** countUncertainMarkers, countIllegibleMarkers
- **Rendering:** applyMarkers (returns styled HTML), stripMarkers
- **Confidence:** getConfidenceClass, determineConfidence
- **Safety:** escapeHtml, safeApplyMarkers

---

**References:**
- [VALIDATION](VALIDATION.md) for rule implementation
- [ARCHITECTURE](ARCHITECTURE.md) for storage integration
- [data/README.md](../data/README.md) for example data
