---
type: actionplan
created: 2026-01-17
updated: 2026-01-17
tags: [coocr-htr, roadmap, bugs, features]
status: active
---

# Aktionsplan: Offene Punkte

Priorisierter Umsetzungsplan basierend auf Repository-Analyse.

---

## Sprint 1: Kritische Bugs (Blocker)

### 1.1 Bug: Transkriptionstext nicht sichtbar 🔴 KRITISCH

**Problem:** LLM-generierte Segmente haben keine `bounds`, werden in `state.js:406` herausgefiltert.

**Dateien:**
- `docs/js/state.js` (Zeile 405-415)

**Lösung:**
```javascript
// state.js - setTranscription()
if (data.segments?.length > 0) {
  // Für Segmente OHNE bounds: Pseudo-Regionen generieren
  const totalSegments = data.segments.length;
  this.data.regions = data.segments.map((s, index) => {
    if (s.bounds) {
      return {
        line: s.lineNumber,
        x: s.bounds.x,
        y: s.bounds.y,
        w: s.bounds.width,
        h: s.bounds.height
      };
    }
    // Pseudo-Region: Gleichmäßig verteilt über Bildbreite
    const heightPercent = 100 / totalSegments;
    return {
      line: s.lineNumber,
      x: 2,
      y: index * heightPercent,
      w: 96,
      h: heightPercent - 1,
      synthetic: true  // Marker für generierte Region
    };
  });
}
```

**Tests hinzufügen:**
- `docs/tests/state.test.js` (neu)
- Test: Segmente ohne bounds erzeugen Pseudo-Regionen
- Test: Segmente mit bounds verwenden echte Koordinaten

---

### 1.2 Bug: PAGE-XML zeigt nur Wortfragmente 🟠 HOCH

**Problem:** `findElement(line, 'TextEquiv')` findet erstes TextEquiv in Hierarchie (oft Word-Ebene).

**Dateien:**
- `docs/js/services/parsers/page-xml.js` (Zeile 143-145)

**Lösung:**
```javascript
// page-xml.js - extractSegments()
// VORHER:
const textEquiv = this.findElement(line, 'TextEquiv');
const unicode = this.findElement(textEquiv, 'Unicode');
const text = unicode?.textContent || '';

// NACHHER:
let text = '';

// 1. Versuche direktes TextEquiv der TextLine
const directTextEquiv = Array.from(line.children)
  .find(el => el.localName === 'TextEquiv' || el.tagName === 'TextEquiv');

if (directTextEquiv) {
  const unicode = this.findElement(directTextEquiv, 'Unicode');
  text = unicode?.textContent || '';
}

// 2. Fallback: Wörter konkatenieren
if (!text) {
  const words = this.findElements(line, 'Word');
  text = words.map(word => {
    const te = this.findElement(word, 'TextEquiv');
    const uni = this.findElement(te, 'Unicode');
    return uni?.textContent || '';
  }).join(' ').trim();
}
```

**Tests anpassen:**
- `docs/tests/page-xml.test.js`
- Test: TextLine mit direktem TextEquiv
- Test: TextLine ohne direktes TextEquiv → Word-Konkatenation
- Test: Gemischte Struktur

---

### 1.3 Bug: Tabellen-Prompt für alle Dokumenttypen 🟡 MITTEL

**Problem:** `TRANSCRIPTION_PROMPT` ist für Tabellen optimiert, passt nicht für Briefe/Manuskripte.

**Dateien:**
- `docs/js/services/llm.js` (Zeile 12-27)
- `docs/js/components/transcription.js`
- `docs/index.html`

**Lösung:**

**A) Zwei Prompts definieren:**
```javascript
// llm.js
const TRANSCRIPTION_PROMPT_TABLE = `Du bist ein Experte für historische Handschriften...
[bestehender Tabellen-Prompt]`;

const TRANSCRIPTION_PROMPT_TEXT = `Du bist ein Experte für historische Handschriften des 16.-19. Jahrhunderts.

Aufgabe: Transkribiere das Bild zeilenweise.

Regeln:
- Eine Zeile pro Dokumentzeile
- Zeilenwechsel des Originals beibehalten
- Unsichere Lesungen mit [?] markieren
- Unleserliche Stellen mit [illegible] markieren
- Abkürzungen beibehalten oder mit {expansion} auflösen
- Keine Tabellen, nur Fließtext mit Zeilenumbrüchen

Ausgabeformat: Nur der transkribierte Text, keine Erklärungen.`;

// Prompt-Auswahl basierend auf documentType
function getPromptForType(documentType) {
  return documentType === 'table'
    ? TRANSCRIPTION_PROMPT_TABLE
    : TRANSCRIPTION_PROMPT_TEXT;
}
```

**B) UI: Dokumenttyp-Auswahl hinzufügen:**
```html
<!-- index.html - im Transcription-Bereich -->
<div class="document-type-selector">
  <label>Dokumenttyp:</label>
  <select id="document-type">
    <option value="auto">Automatisch erkennen</option>
    <option value="table">Tabelle / Rechnungsbuch</option>
    <option value="text">Brief / Manuskript</option>
  </select>
</div>
```

**C) State erweitern:**
```javascript
// state.js - data.meta
meta: {
  documentType: 'auto', // 'auto' | 'table' | 'text'
  // ...
}
```

---

### 1.4 Bug: Validation Panel initial sichtbar 🟢 NIEDRIG

**Problem:** Panel erscheint ohne Transkription.

**Dateien:**
- `docs/js/components/validation.js`
- `docs/css/validation.css`

**Lösung:**
```javascript
// validation.js - init() oder update()
updateVisibility() {
  const hasDocument = state.data.pages?.length > 0;
  const hasTranscription = state.data.transcription?.segments?.length > 0;

  const panel = document.getElementById('validation-panel');
  if (hasDocument && hasTranscription) {
    panel.classList.remove('hidden');
  } else {
    panel.classList.add('hidden');
  }
}
```

```css
/* validation.css */
#validation-panel.hidden {
  display: none;
}
```

---

## Sprint 2: Fehlende Features

### 2.1 METS-XML Upload Integration

**Problem:** Parser existiert, aber nicht in Upload-UI integriert.

**Dateien:**
- `docs/js/components/upload.js`
- `docs/index.html`

**Tasks:**
1. Dateiendung `.mets` / `.mets.xml` erkennen in `handleFiles()`
2. METS-Parser aufrufen statt Einzelbild-Handler
3. Multi-Page State setzen aus METS-Struktur
4. Optional: URL-Input für Remote-METS (IIIF-ähnlich)

**Implementation:**
```javascript
// upload.js - handleFiles()
async handleFiles(files) {
  for (const file of files) {
    const ext = file.name.toLowerCase();

    if (ext.endsWith('.xml')) {
      const content = await file.text();

      // METS oder PAGE-XML?
      if (content.includes('mets:mets') || content.includes('<mets')) {
        await this.handleMetsUpload(file, content);
      } else if (content.includes('PcGts') || content.includes('PAGE')) {
        await this.handlePageXmlUpload(file, content);
      }
    } else if (file.type.startsWith('image/')) {
      await this.handleImageUpload(file);
    }
  }
}

async handleMetsUpload(file, content) {
  const { MetsParser } = await import('../services/parsers/mets-xml.js');
  const parser = new MetsParser();
  const result = parser.parse(content);

  // Multi-Page State setzen
  state.setPages(result.pages);
  state.setMetadata(result.metadata);
}
```

---

### 2.2 PAGE-XML Export

**Problem:** Nur TXT/JSON/MD Export verfügbar.

**Dateien:**
- `docs/js/services/export.js`
- `docs/js/components/dialogs.js` (Export-Dialog)

**Tasks:**
1. `exportPageXml()` Funktion implementieren
2. PAGE-XML 2019 Schema verwenden
3. Koordinaten aus regions übernehmen (falls vorhanden)
4. Export-Dialog um PAGE-XML Option erweitern

**Template:**
```javascript
// export.js
exportPageXml(data) {
  const timestamp = new Date().toISOString();
  const segments = data.transcription.segments || [];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<PcGts xmlns="http://schema.primaresearch.org/PAGE/gts/pagecontent/2019-07-15">
  <Metadata>
    <Creator>CO-OCR-HTR</Creator>
    <Created>${timestamp}</Created>
  </Metadata>
  <Page imageFilename="${data.meta.filename || 'unknown'}">
    <TextRegion id="region_1">
`;

  segments.forEach((seg, i) => {
    const bounds = data.regions?.[i];
    const points = bounds
      ? `${bounds.x},${bounds.y} ${bounds.x+bounds.w},${bounds.y} ${bounds.x+bounds.w},${bounds.y+bounds.h} ${bounds.x},${bounds.y+bounds.h}`
      : '0,0 100,0 100,100 0,100';

    xml += `      <TextLine id="line_${i+1}">
        <Coords points="${points}"/>
        <TextEquiv>
          <Unicode>${this.escapeXml(seg.text)}</Unicode>
        </TextEquiv>
      </TextLine>
`;
  });

  xml += `    </TextRegion>
  </Page>
</PcGts>`;

  return xml;
}
```

---

### 2.3 Batch-Transkription

**Problem:** Nur Einzelseiten-Transkription möglich.

**Dateien:**
- `docs/js/components/transcription.js`
- `docs/index.html`
- `docs/css/components.css`

**Tasks:**
1. "Alle Seiten transkribieren" Button
2. Progress-Anzeige (Page X/Y)
3. Fehlerbehandlung pro Seite
4. Abbruch-Möglichkeit

**UI-Mockup:**
```
┌─────────────────────────────────────┐
│ [▶ Transkribieren] [▶▶ Alle Seiten] │
├─────────────────────────────────────┤
│ ████████░░░░░░░░░░░ 4/12 Seiten     │
│ [Abbrechen]                         │
└─────────────────────────────────────┘
```

**Implementation:**
```javascript
// transcription.js
async transcribeAllPages() {
  const totalPages = state.data.pages.length;

  this.showProgress(0, totalPages);

  for (let i = 0; i < totalPages; i++) {
    if (this.aborted) break;

    state.setCurrentPage(i);
    this.showProgress(i, totalPages, `Seite ${i+1}...`);

    try {
      await this.transcribeCurrentPage();
    } catch (error) {
      console.error(`Fehler bei Seite ${i+1}:`, error);
      // Weiter mit nächster Seite
    }
  }

  this.hideProgress();
}
```

---

### 2.4 Batch-Export als ZIP

**Problem:** Export nur für Einzelseiten.

**Dateien:**
- `docs/js/services/export.js`
- `docs/js/components/dialogs.js`

**Tasks:**
1. JSZip als ES-Modul einbinden (CDN)
2. Alle Seiten in gewähltem Format exportieren
3. ZIP-Datei generieren und downloaden

**Implementation:**
```javascript
// export.js
async exportAllAsZip(format) {
  const JSZip = await import('https://cdn.jsdelivr.net/npm/jszip@3/+esm');
  const zip = new JSZip.default();

  const pages = state.data.pages;
  const transcriptions = state.data.pageTranscriptions;

  for (let i = 0; i < pages.length; i++) {
    const pageData = transcriptions[i];
    if (!pageData) continue;

    const filename = `page_${String(i+1).padStart(3,'0')}.${format}`;
    const content = this.exportAs(format, pageData);
    zip.file(filename, content);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  this.download(blob, `transcription_${Date.now()}.zip`);
}
```

---

## Sprint 3: Tests & Qualität

### 3.1 Unit Tests für kritische Services

**Priorität nach Risiko:**

| Service | LOC | Priorität | Tests |
|---------|-----|-----------|-------|
| `validation.js` | 334 | HOCH | Regel-Validierung, Kategorisierung |
| `export.js` | 307 | HOCH | Alle Formate, Encoding |
| `storage.js` | 243 | MITTEL | Save/Load, Migration |
| `mets-xml.js` | 246 | MITTEL | Parser-Edge-Cases |
| `state.js` | 500+ | HOCH | State-Transitions |

**Test-Dateien erstellen:**
```
docs/tests/
├── llm.test.js         ✅ existiert
├── page-xml.test.js    ✅ existiert
├── validation.test.js  📋 neu
├── export.test.js      📋 neu
├── storage.test.js     📋 neu
├── mets-xml.test.js    📋 neu
└── state.test.js       📋 neu
```

### 3.2 Integration Tests

**Szenarien:**
1. Upload → Transkription → Export (Happy Path)
2. PAGE-XML Import → Edit → Validate → Export
3. Multi-Page Navigation + Per-Page Transcription
4. Error Recovery (API-Fehler, ungültige Dateien)

---

## Sprint 4: Polish

### 4.1 Performance Audit

**Tasks:**
- Lighthouse-Audit durchführen
- Große Dokumente testen (100+ Seiten)
- Lazy Loading für Bilder
- Virtual Scrolling für lange Transkriptionen

### 4.2 Dokumentation

**Tasks:**
- README mit Screenshots aktualisieren
- GIF-Demo erstellen
- API-Dokumentation für Services

---

## Abhängigkeiten-Matrix

```
Sprint 1.1 (Pseudo-Regions)
    └── Sprint 2.3 (Batch-Transkription)

Sprint 1.3 (Dual-Prompts)
    └── Dokumenttyp-Erkennung

Sprint 2.1 (METS Integration)
    └── Sprint 2.3 (Batch-Transkription)
    └── Sprint 2.4 (Batch-Export)

Sprint 2.2 (PAGE-XML Export)
    └── Sprint 2.4 (Batch-Export)
```

---

## Checkliste

### Sprint 1 (Kritische Bugs)
- [ ] 1.1 Pseudo-Regionen für LLM-Segmente
- [ ] 1.2 PAGE-XML Textextraktion fix
- [ ] 1.3 Dual-Prompt-System + UI
- [ ] 1.4 Validation Panel Visibility

### Sprint 2 (Features)
- [ ] 2.1 METS-XML Upload Integration
- [ ] 2.2 PAGE-XML Export
- [ ] 2.3 Batch-Transkription
- [ ] 2.4 Batch-Export ZIP

### Sprint 3 (Tests)
- [ ] 3.1 validation.test.js
- [ ] 3.1 export.test.js
- [ ] 3.1 storage.test.js
- [ ] 3.1 state.test.js
- [ ] 3.2 Integration Tests

### Sprint 4 (Polish)
- [ ] 4.1 Performance Audit
- [ ] 4.2 Dokumentation

---

## Quick Wins (sofort umsetzbar)

1. **Bug 1.4** (Validation Visibility) - 5 Zeilen Code
2. **Bug 1.2** (PAGE-XML) - Lokale Änderung, Tests vorhanden
3. **Feature 2.2** (PAGE-XML Export) - Unabhängig, gut definiert

---

*Erstellt: 2026-01-17*
*Status: Aktiv*
