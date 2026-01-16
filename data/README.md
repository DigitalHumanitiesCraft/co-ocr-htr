# Data Directory

Beispieldaten für coOCR/HTR - historische Dokumente mit PAGE-XML Transkriptionen.

## Verzeichnisstruktur

```
data/
├── docta/                      # Transkribus-Export (vollständig)
│   └── Raitbuch 2/             # Oberösterreichisches Rechnungsbuch
│       ├── doc.xml             # Dokument-Metadaten (123 Seiten)
│       ├── page/               # PAGE-XML Transkriptionen
│       └── *.jpg               # Beispielbilder
├── ocr-examples/               # Verschiedene OCR-Testdaten
│   ├── 1617-wecker-*/          # Antidotarium (16. Jh.)
│   ├── o_szd.*/                # Stefan Zweig Archiv
│   ├── konvolute/              # Konvolut-Transkriptionen
│   └── ...
└── schliemann/                 # Archivbilder (ohne Transkription)
```

## Datenformate

### PAGE-XML (Primärformat)

Alle Transkriptionen verwenden den **PAGE-XML Standard** (PcGts - Page Content Ground Truth Schema).

**Namespace:** `http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15`

**Hierarchie:**
```
PcGts
└── Page (imageFilename, dimensions)
    ├── PrintSpace (Textbereich)
    ├── ReadingOrder (Lesereihenfolge)
    ├── TextRegion (Absatz/Block)
    │   └── TextLine (Zeile)
    │       ├── Word (Wort mit Unicode)
    │       └── Baseline (Grundlinie)
    ├── GraphicRegion (Grafiken)
    └── SeparatorRegion (Trennlinien)
```

**Koordinatensystem:** Polygon-basiert (nicht rechteckig)
```xml
<Coords points="x1,y1 x2,y2 x3,y3 x4,y4"/>
```

### doc.xml (Transkribus-Format)

Dokument-Metadaten mit Seitenliste.

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

## Datensätze

### 1. Raitbuch 2 (docta/)

**Typ:** Oberösterreichisches Kirchenamt-Rechnungsbuch
**Umfang:** 123 Seiten, vollständig transkribiert
**Sprache:** Frühneuhochdeutsch (16./17. Jh.)
**Status:** FINAL (via PyLaia/Transkribus)

| Metrik | Wert |
|--------|------|
| Seiten | 123 |
| XML-Dateien | 123 |
| Beispielbilder | 4 |
| Bildauflösung | 5562×3824 px |

**Dateinamen-Konvention:** `OÖKAM Raitbuch 2, fol. XYv-Zr.jpg`
- `fol.` = Folio (Blatt)
- `v` = verso (Rückseite)
- `r` = recto (Vorderseite)

### 2. 1617-wecker (ocr-examples/)

**Typ:** Medizinisches Fachbuch "Antidotarium" (1617)
**Umfang:** 83 PAGE-XML Dateien
**Sprache:** Lateinisch
**Status:** Teilweise transkribiert

### 3. Stefan Zweig Archiv (o_szd.*)

**Typ:** Handschriftliche Korrespondenz
**Format:** METS-XML + Metadaten-JSON
**Quelle:** Literaturarchiv Salzburg

### 4. Schliemann (schliemann/)

**Typ:** Archivbilder
**Umfang:** 21 Bilder
**Status:** Nur Bilder, keine Transkriptionen

## Verwendung in coOCR/HTR

### Import

Die PAGE-XML Dateien können direkt in coOCR/HTR geladen werden:

1. **Bild laden** → `*.jpg`
2. **Transkription importieren** → `page/*.xml`
3. **Bounding Boxes** aus `Coords points` extrahieren
4. **Text** aus `TextEquiv/Unicode` extrahieren

### Mapping PAGE-XML → coOCR/HTR

| PAGE-XML Element | coOCR/HTR Segment |
|------------------|-------------------|
| `TextLine/Coords` | `bounds: { x, y, width, height }` |
| `TextLine/TextEquiv/Unicode` | `text` |
| `Metadata/TranskribusMetadata@status` | `confidence` |
| `ReadingOrder` | `lineNumber` |

### Koordinaten-Konvertierung

PAGE-XML verwendet Polygone (4+ Punkte), coOCR/HTR verwendet Rechtecke:

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

## Metadaten

### PAGE-XML Metadaten

```xml
<Metadata>
  <Creator>prov=READ-COOP:name=PyLaia@TranskribusPlatform:version=0.7.5</Creator>
  <Created>2022-09-23T18:01:30.795+02:00</Created>
  <TranskribusMetadata docId="1164174" pageId="47630219" status="FINAL"/>
</Metadata>
```

### Transkriptionsstatus

| Status | Bedeutung |
|--------|-----------|
| `NEW` | Keine Transkription |
| `IN_PROGRESS` | In Bearbeitung |
| `FINAL` | Abgeschlossen |

## Quellen

- **Transkribus:** https://transkribus.eu/
- **PAGE-XML Schema:** https://github.com/PRImA-Research-Lab/PAGE-XML
- **Literaturarchiv Salzburg:** https://www.literaturarchiv.at/

---

**Verweis:** [DATA-SCHEMA.md](../knowledge/DATA-SCHEMA.md) für coOCR/HTR interne Datenstrukturen
