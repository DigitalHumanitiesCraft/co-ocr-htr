# Data Directory

Sample data for coOCR/HTR - historical documents with PAGE-XML transcriptions.

## Directory Structure

```
data/
├── docta/                      # Transkribus export (complete)
│   └── Raitbuch 2/             # Tyrolean chamber account book (1462-1464)
│       ├── doc.xml             # Document metadata (123 pages, all status NEW)
│       ├── page/               # PAGE-XML skeletons, no transcribed text
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

**Type:** *Raitbuch* (account book) of the *Oberösterreichische Kammer*, the territorial finance authority of the Habsburg lands seated in Innsbruck. In Habsburg administrative usage *Oberösterreich* denotes the historical unit of Tyrol and the Vorlande. It does not refer to the present-day Austrian province of Upper Austria, and the abbreviation OÖKAM in the filenames resolves accordingly.
**Repository:** Tiroler Landesarchiv, Innsbruck.
**Dating:** 1462–1464, read from the dating clauses on the sample images. Fol. 3v carries *an [S]ontag nach sannd Johanns tag Decollacionis, anno domini etc. lxij* (Sunday after the Decollation of St John, 29 August 1462), fol. 4v carries *am freytag nach Epyphania anno domini etc. lxiiij* (Friday after Epiphany, January 1464).
**Context:** The court of Sigmund of Tyrol (1427–1496). The path metadata in `doc.xml` points to a project source collection named *Sigmundiana*.
**Language and script:** Early New High German, written in a late Gothic business cursive (*Geschäftskursive*) with Roman minuscule numerals for the accounting entries.
**Scope:** 123 pages registered in `doc.xml`, 4 sample images in this repository.
**Transcription status:** None. All 123 PAGE-XML files are empty skeletons of about 650 bytes each, written by the Transkribus LocalDocReader on 2025-11-28. Each file holds a `Metadata` block and a self-closing `Page` element, without `TextRegion`, `TextLine` or `Unicode`. In `doc.xml` every page carries `status NEW` and `nrOfTranscribedLines 0`. The dataset serves as image material and as a PAGE-XML skeleton. It carries no ground truth and is unsuitable for accuracy measurement.

| Metric | Value |
|--------|-------|
| Pages | 123 |
| PAGE-XML files | 123, all empty skeletons (0 with `TextLine`, 0 with `Unicode`) |
| Sample images | 4 |
| Image resolution | 5562x3824 px (fol. 0v-1r, 1v-2r), 5582x3904 px (fol. 3v-4r, 4v-5r) |

**Filename convention:** `OÖKAM Raitbuch 2, fol. XYv-Zr.jpg`
- `OÖKAM` = *Oberösterreichische Kammer*
- `fol.` = folio (leaf)
- `v` = verso (back side)
- `r` = recto (front side)

The JPG files as stored on disk use the ASCII spelling `OOEKAM`, while `doc.xml` and the PAGE-XML filenames use `OÖKAM`. Code that resolves an image path from the metadata has to account for that difference.

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

Example from the Wecker Antidotarium dataset (`ocr-examples/1617-wecker-antidotiarum-001-150_pdf/page/0002_p002.xml`), the only dataset in this repository that was run through an HTR model and closed with status `FINAL`:

```xml
<Metadata>
  <Creator>prov=READ-COOP:name=PyLaia@TranskribusPlatform:version=0.7.5</Creator>
  <Created>2022-09-23T18:01:30.795+02:00</Created>
  <TranskribusMetadata docId="1164174" pageId="47630219" status="FINAL"/>
</Metadata>
```

The Raitbuch 2 files look different. They carry `Creator` `Transkribus` with no model string, no `TranskribusMetadata` element and no text content:

```xml
<Metadata>
  <Creator>Transkribus</Creator>
  <Created>2025-11-28T10:23:58.661+01:00</Created>
  <LastChange>2025-11-28T10:23:58.661+01:00</LastChange>
</Metadata>
<Page imageFilename="OÖKAM Raitbuch 2, fol. 0v-1r.jpg" imageWidth="5562" imageHeight="3824"/>
```

### Transcription Status

| Status | Meaning |
|--------|---------|
| `NEW` | No transcription |
| `IN_PROGRESS` | In progress |
| `FINAL` | Completed |

Across the datasets in `data/`, `FINAL` occurs only in the Wecker Antidotarium. Raitbuch 2 stands at `NEW` throughout.

## Demo Samples for GitHub Pages

Selected examples are copied to `docs/samples/` and accessible via GitHub Pages:

| Sample | Folder | Description | Data |
|--------|--------|-------------|------|
| Wecker Antidotarium | `docs/samples/wecker/` | Latin reference book (1617) | Image + PAGE-XML |
| Raitbuch 2 | `docs/samples/raitbuch/` | Early New High German account book, 15th c. | Image only |
| HSA Letter | `docs/samples/hsa-letter/` | Handwritten letter | Image only |
| Index Card | `docs/samples/karteikarte/` | Handwritten index card | Image only |

**Note:** Only the Wecker sample includes complete PAGE-XML transcription with line coordinates. The other samples are for testing LLM transcription.

## Sources

- **Transkribus:** https://transkribus.eu/
- **PAGE-XML Schema:** https://github.com/PRImA-Research-Lab/PAGE-XML
- **Literaturarchiv Salzburg:** https://www.literaturarchiv.at/
- **Tiroler Landesarchiv:** https://www.tirol.gv.at/kunst-kultur/landesarchiv/ (holding institution of Raitbuch 2)

---

**Reference:** [DATA-SCHEMA.md](../knowledge/DATA-SCHEMA.md) for coOCR/HTR internal data structures
