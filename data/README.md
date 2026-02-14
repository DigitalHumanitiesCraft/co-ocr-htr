# Data Directory

Sample data for coOCR/HTR - historical documents with PAGE-XML transcriptions.

## Directory Structure

```
data/
├── docta/                      # Transkribus export (complete)
│   └── Raitbuch 2/             # Upper Austrian account book
│       ├── doc.xml             # Document metadata (123 pages)
│       ├── page/               # PAGE-XML transcriptions
│       └── *.jpg               # Sample images
├── ocr-examples/               # Various OCR test data
│   ├── 1617-wecker-*/          # Antidotarium (16th c.)
│   ├── o_szd.*/                # Stefan Zweig Archive
│   ├── konvolute/              # Convolute transcriptions
│   └── ...
└── schliemann/                 # Archive images (no transcription)
```

## Data Formats

### PAGE-XML (Primary Format)

All transcriptions use the **PAGE-XML standard** (PcGts - Page Content Ground Truth Schema).

**Namespace:** `http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15`

**Hierarchy:**
```
PcGts
└── Page (imageFilename, dimensions)
    ├── PrintSpace (text area)
    ├── ReadingOrder (reading sequence)
    ├── TextRegion (paragraph/block)
    │   └── TextLine (line)
    │       ├── Word (word with Unicode)
    │       └── Baseline (baseline)
    ├── GraphicRegion (graphics)
    └── SeparatorRegion (separator lines)
```

**Coordinate system:** Polygon-based (not rectangular)
```xml
<Coords points="x1,y1 x2,y2 x3,y3 x4,y4"/>
```

### doc.xml (Transkribus Format)

Document metadata with page list.

```xml
<trpDoc>
  <md>
    <title>Raitbuch 2</title>
    <nrOfPages>123</nrOfPages>
  </md>
  <pageList>
    <pages>
      <pageNr>1</pageNr>
      <imgFileName>OÖKAM Raitbuch 2, fol. 0v-1r.jpg</imgFileName>
      <width>5562</width>
      <height>3824</height>
    </pages>
  </pageList>
</trpDoc>
```

## Datasets

### 1. Raitbuch 2 (docta/)

**Type:** Upper Austrian church office account book
**Scope:** 123 pages, fully transcribed
**Language:** Early New High German (16th/17th c.)
**Status:** FINAL (via PyLaia/Transkribus)

| Metric | Value |
|--------|-------|
| Pages | 123 |
| XML files | 123 |
| Sample images | 4 |
| Image resolution | 5562x3824 px |

**Filename convention:** `OÖKAM Raitbuch 2, fol. XYv-Zr.jpg`
- `fol.` = folio (leaf)
- `v` = verso (back side)
- `r` = recto (front side)

### 2. 1617-wecker (ocr-examples/)

**Type:** Medical reference book "Antidotarium" (1617)
**Scope:** 83 PAGE-XML files
**Language:** Latin
**Status:** Partially transcribed

### 3. Stefan Zweig Archive (o_szd.*)

**Type:** Handwritten correspondence
**Format:** METS-XML + metadata JSON
**Source:** Literaturarchiv Salzburg

### 4. Schliemann (schliemann/)

**Type:** Archive images
**Scope:** 21 images
**Status:** Images only, no transcriptions

## Usage in coOCR/HTR

### Import

The PAGE-XML files can be loaded directly into coOCR/HTR:

1. **Load image** → `*.jpg`
2. **Import transcription** → `page/*.xml`
3. **Extract bounding boxes** from `Coords points`
4. **Extract text** from `TextEquiv/Unicode`

### Mapping PAGE-XML → coOCR/HTR

| PAGE-XML Element | coOCR/HTR Segment |
|------------------|-------------------|
| `TextLine/Coords` | `bounds: { x, y, width, height }` |
| `TextLine/TextEquiv/Unicode` | `text` |
| `Metadata/TranskribusMetadata@status` | `confidence` |
| `ReadingOrder` | `lineNumber` |

### Coordinate Conversion

PAGE-XML uses polygons (4+ points), coOCR/HTR uses rectangles:

```javascript
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

## Metadata

### PAGE-XML Metadata

```xml
<Metadata>
  <Creator>prov=READ-COOP:name=PyLaia@TranskribusPlatform:version=0.7.5</Creator>
  <Created>2022-09-23T18:01:30.795+02:00</Created>
  <TranskribusMetadata docId="1164174" pageId="47630219" status="FINAL"/>
</Metadata>
```

### Transcription Status

| Status | Meaning |
|--------|---------|
| `NEW` | No transcription |
| `IN_PROGRESS` | In progress |
| `FINAL` | Completed |

## Demo Samples for GitHub Pages

Selected examples are copied to `docs/samples/` and accessible via GitHub Pages:

| Sample | Folder | Description | Data |
|--------|--------|-------------|------|
| Wecker Antidotarium | `docs/samples/wecker/` | Latin reference book (1617) | Image + PAGE-XML |
| Raitbuch 2 | `docs/samples/raitbuch/` | Early New High German account book | Image only |
| HSA Letter | `docs/samples/hsa-letter/` | Handwritten letter | Image only |
| Index Card | `docs/samples/karteikarte/` | Handwritten index card | Image only |

**Note:** Only the Wecker sample includes complete PAGE-XML transcription with line coordinates. The other samples are for testing LLM transcription.

## Sources

- **Transkribus:** https://transkribus.eu/
- **PAGE-XML Schema:** https://github.com/PRImA-Research-Lab/PAGE-XML
- **Literaturarchiv Salzburg:** https://www.literaturarchiv.at/

---

**Reference:** [DATA-SCHEMA.md](../knowledge/DATA-SCHEMA.md) for coOCR/HTR internal data structures
