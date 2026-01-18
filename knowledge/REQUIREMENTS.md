---
type: knowledge
created: 2026-01-16
updated: 2026-01-16
tags: [coocr-htr, requirements, features, bugs]
status: active
---

# Requirements & Feature Status

Vollständige Übersicht aller Anforderungen, implementierter Features und offener Bugs.

---

## 1. Implementierte Features

### 1.1 Core System

| Feature | Status | Datei | Beschreibung |
|---------|--------|-------|--------------|
| 3-Spalten Layout | [x] | `index.html` | Viewer, Editor, Validation nebeneinander |
| Central State (EventTarget) | [x] | `js/state.js` | Native Browser EventTarget für State Management |
| Design System | [x] | `css/*.css` | 8 modulare CSS-Dateien mit Design Tokens |
| Warm Editorial Theme | [x] | `css/variables.css` | Archival-Farbpalette für Manuskript-Ästhetik |

### 1.2 Document Viewer

| Feature | Status | Datei | Beschreibung |
|---------|--------|-------|--------------|
| Image Display | [x] | `js/viewer.js` | Bild-Anzeige mit SVG Overlay |
| SVG Regions | [x] | `js/viewer.js` | Bounding Boxes als SVG-Rechtecke |
| Pan Control | [x] | `js/viewer.js` | Drag zum Verschieben |
| Zoom Controls | [x] | `js/viewer.js` | +/- Buttons, Zoom-Slider |
| Fit-to-Width | [x] | `js/viewer.js` | Auto-Anpassung an Panel-Breite |
| Multi-Page Navigation | [x] | `js/viewer.js` | Prev/Next Buttons, Seitenzähler |
| Drag & Drop Upload | [x] | `js/components/upload.js` | Dateien per Drag & Drop laden |
| Empty State | [x] | `index.html`, `viewer.css` | Drop-Zone Indikator |

### 1.3 Transcription Editor

| Feature | Status | Datei | Beschreibung |
|---------|--------|-------|--------------|
| Flexible Modes | [x] | `js/editor.js` | Lines-Mode (Briefe) + Grid-Mode (Tabellen) |
| Auto-Mode Detection | [x] | `js/editor.js` | Automatische Erkennung des Dokumenttyps |
| Inline Editing | [x] | `js/editor.js` | Doppelklick zum Bearbeiten |
| Undo/Redo Stack | [x] | `js/editor.js` | Ctrl+Z / Ctrl+Shift+Z |
| Keyboard Shortcuts | [x] | `js/editor.js` | Pfeiltasten, Enter, Escape |
| Triple Synchronization | [x] | `js/*.js` | Viewer ↔ Editor ↔ Validation |

### 1.4 LLM Integration

| Feature | Status | Datei | Beschreibung |
|---------|--------|-------|--------------|
| Gemini Provider | [x] | `js/services/llm.js` | Google Gemini 2.0/3.0 Flash |
| OpenAI Provider | [x] | `js/services/llm.js` | GPT-4o-mini |
| Anthropic Provider | [x] | `js/services/llm.js` | Claude 3 Haiku |
| DeepSeek Provider | [x] | `js/services/llm.js` | API + Ollama |
| Ollama Provider | [x] | `js/services/llm.js` | Lokale Modelle |
| Gemini 3 Optimierung | [x] | `js/services/llm.js` | temperature=1.0, media_resolution, thinking_config |
| Transcription Prompt | [x] | `js/services/llm.js` | Historische Handschriften |

### 1.5 Validation

| Feature | Status | Datei | Beschreibung |
|---------|--------|-------|--------------|
| Rule-Based Validation | [x] | `js/services/validation.js` | 8 deterministische Regeln |
| LLM-Judge Validation | [x] | `js/services/llm.js` | 4 Perspektiven |
| Paleographic Perspective | [x] | `js/services/llm.js` | Buchstabenformen, Ligaturen |
| Linguistic Perspective | [x] | `js/services/llm.js` | Grammatik, historische Orthographie |
| Structural Perspective | [x] | `js/services/llm.js` | Tabellen, Summen, Verweise |
| Domain Perspective | [x] | `js/services/llm.js` | Fachbegriffe, Plausibilität |
| Validation Panel UI | [x] | `js/components/validation.js` | Rule-Based + AI Assistant Sections |

### 1.6 Import/Export

| Feature | Status | Datei | Beschreibung |
|---------|--------|-------|--------------|
| Image Upload | [x] | `js/components/upload.js` | JPG, PNG, TIFF, WebP |
| PAGE-XML Import | [x] | `js/services/parsers/page-xml.js` | Transkribus-Format |
| METS-XML Parser | [x] | `js/services/parsers/mets-xml.js` | Parser existiert |
| TXT Export | [x] | `js/services/export.js` | Tab-separiert |
| JSON Export | [x] | `js/services/export.js` | Mit Metadaten |
| Markdown Export | [x] | `js/services/export.js` | Mit Validation Notes |

### 1.7 UI Components

| Feature | Status | Datei | Beschreibung |
|---------|--------|-------|--------------|
| Settings Dialog | [x] | `js/components/dialogs.js` | Editor, Validation, Display Settings |
| Help Dialog | [x] | `js/components/dialogs.js` | Quick Start, Shortcuts, Legend |
| API Key Dialog | [x] | `js/components/dialogs.js` | Provider-Tabs, Passwort-Toggle |
| Export Dialog | [x] | `js/components/dialogs.js` | Format-Auswahl, Optionen |
| Demo Loader | [x] | `js/services/samples.js` | 5 Demo-Dokumente |
| Toast Notifications | [x] | `js/components/dialogs.js` | Success, Warning, Error |
| Workflow Stepper | [x] | `index.html` | 6-Schritt-Anzeige |
| Panel Hints | [x] | `index.html` | Kontextuelle Hilfe |

### 1.8 Persistenz

| Feature | Status | Datei | Beschreibung |
|---------|--------|-------|--------------|
| LocalStorage Settings | [x] | `js/services/storage.js` | API Keys, Preferences |
| Session Auto-Save | [x] | `js/state.js` | Dokument, Transkription, UI State |

---

## 2. Offene Features

### 2.1 Hohe Priorität

| Feature | Priorität | Beschreibung | Abhängigkeiten |
|---------|-----------|--------------|----------------|
| Dokumenttyp-Erkennung | HOCH | Auto-Detect Tabelle vs. Brief | Bug 3 Fix |
| Text-Mode Prompt | HOCH | Separater Prompt für Briefe/Manuskripte | Bug 3 Fix |

### 2.2 Mittlere Priorität

| Feature | Priorität | Beschreibung | Abhängigkeiten |
|---------|-----------|--------------|----------------|
| METS-XML Upload Integration | MITTEL | Parser in upload.js integrieren | - |
| URL-Input für Online-METS | MITTEL | IIIF/METS von URL laden | METS Integration |

### 2.3 Niedrige Priorität

| Feature | Priorität | Beschreibung | Abhängigkeiten |
|---------|-----------|--------------|----------------|
| PAGE-XML Export | NIEDRIG | Koordinaten + Text exportieren | - |
| Batch-Transkription | NIEDRIG | Alle Seiten automatisch transkribieren | Multi-Page |
| Batch-Export als ZIP | NIEDRIG | Alle Seiten exportieren | Batch-Transkription |
| Vitest Unit Tests | NIEDRIG | Kritische Services testen | - |
| E2E Test | NIEDRIG | Vollständiger Workflow-Test | Unit Tests |

---

## 3. Bekannte Bugs

### Bug 1: Transkribierter Text nicht sichtbar (KRITISCH)

**Status:** Identifiziert, nicht gefixt

**Symptom:** Nach LLM-Transkription (z.B. HSA Brief):
- Console zeigt `segments=41`
- Editor-Zellen bleiben leer
- Viewer zeigt 0 Regions

**Ursache:** `state.js:405-415`
```javascript
this.data.regions = data.segments
    .filter(s => s.bounds)  // ← LLM-Segments haben KEIN bounds!
```

**Lösung:** Pseudo-Regions für LLM-Transkriptionen ohne Koordinaten generieren.

---

### Bug 2: PAGE-XML zeigt nur Wortfragmente (HOCH)

**Status:** Identifiziert, nicht gefixt

**Symptom:** PAGE-XML-Import zeigt "Gebu" statt "Geburts-Ordnung".

**Ursache:** `page-xml.js:143` - Parser findet erstes TextEquiv im Baum (oft innerhalb Word).

**Lösung:** Nur direkte TextEquiv-Kinder der TextLine verwenden, Fallback: Words konkatenieren.

---

### Bug 3: Tabellen-Prompt für alle Dokumenttypen (MITTEL)

**Status:** Identifiziert, nicht gefixt

**Symptom:** LLM erzeugt "Links | Mitte | Rechts" Tabelle auch für Briefe.

**Ursache:** Ein einziger TRANSCRIPTION_PROMPT für alle Dokumente.

**Lösung:** Zwei Prompts (table/text) + Mode-Selector UI.

---

### Problem 4: Validation Panel initial sichtbar (NIEDRIG)

**Status:** Identifiziert, nicht gefixt

**Symptom:** Validation Panel erscheint auch ohne Transkription.

**Lösung:** Conditional Display basierend auf hasDocument && hasTranscription.

---

## 4. Demo-Samples

| Sample ID | Name | Typ | Seiten | PAGE-XML |
|-----------|------|-----|--------|----------|
| wecker-multipage | Antidotarium (1617) - 6 Seiten | print | 6 | [x] |
| wecker-p015 | Antidotarium (1617), S. 15 | print | 1 | [x] |
| raitbuch-0v1r | Raitbuch 2, fol. 0v-1r | table | 1 | [x] |
| hsa-letter-2261 | HSA Brief 2261 | letter | 1 | - |
| karteikarte-1 | Karteikarte | card | 1 | - |

---

## 5. Validation Rules (8 implementiert)

| # | Regel | Beschreibung | Kategorie |
|---|-------|--------------|-----------|
| 1 | Date Format | DD. Month YYYY Format | Structural |
| 2 | Currency Taler | Taler-Währungsformat | Domain |
| 3 | Currency Groschen | Groschen-Währungsformat | Domain |
| 4 | Currency Gulden/Kreuzer | Gulden/Kreuzer-Format | Domain |
| 5 | Uncertain Readings | [?] Markierungen | Paleographic |
| 6 | Illegible Passages | [illegible] Markierungen | Paleographic |
| 7 | Column Count | Konsistente Spaltenanzahl | Structural |
| 8 | Empty Cells | Leere Zellen erkennen | Structural |

---

## 6. LLM Provider Konfiguration

| Provider | Endpoint | Model | Vision | Besonderheiten |
|----------|----------|-------|--------|----------------|
| Gemini | generativelanguage.googleapis.com | gemini-3-flash-preview | [x] | temperature=1.0 |
| OpenAI | api.openai.com | gpt-5.2 | [x] | Standard |
| Anthropic | api.anthropic.com | claude-sonnet-4.5 | [x] | Standard |
| Ollama | localhost:11434 | deepseek-ocr | [x] | Lokal, OCR-optimiert (erfordert Ollama v0.13.0+) |

---

**Referenzen:**
- [ARCHITECTURE](ARCHITECTURE.md) - Technische Details
- [VALIDATION](VALIDATION.md) - Validierungsregeln
- [DATA-SCHEMA](DATA-SCHEMA.md) - Datenstrukturen
- [IMPLEMENTATION-PLAN](IMPLEMENTATION-PLAN.md) - Roadmap
