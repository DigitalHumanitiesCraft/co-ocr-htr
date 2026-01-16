# Entwicklungsjournal

Chronologische Dokumentation der Projektentwicklung.

---

## 2026-01-16 | Session 1: Initialisierung und Wissenskonsolidierung

**Teilnehmer:** User, Claude Opus 4.5

### Phase 1: Projektinitialisierung

**Auftrag:** Promptotyping-Projekt für coOCR/HTR initialisieren.

**Ergebnis:** Erste Struktur erstellt:
- `README.md` (englisch, kompakt)
- `CLAUDE.md` (Projektkontext)
- `docs/` mit REQUIREMENTS, DESIGN, ARCHITECTURE, DATA
- `src/` (leer)

### Phase 2: Knowledge-Analyse

**Auftrag:** `new_knowledge/` Ordner analysieren (Gemini 3 Material).

**Befund:** Material aus Gemini-Session war umfangreicher:

| Quelle | Inhalt | Bewertung |
|--------|--------|-----------|
| `knowledge/coOCR-HTR Methodische Grundlagen.md` | Wissenschaftliche Basis (LLM-Bias, Critical Expert) | Hoch relevant |
| `docs/design-ui.md` | Detailliertes Design-System | Hoch relevant |
| `docs/architecture.md` | Konkrete Modulstruktur, APIs | Hoch relevant |
| `docs/implementation-plan.md` | Phasen-Plan für Prototyp | Mittel relevant |
| `index.html` | Funktionierender Prototyp (1400 LOC) | Hoch relevant |

**Kernerkenntnisse:**
1. Kategorielle statt numerische Konfidenz (LLM-Bias-Forschung)
2. Validierungs-Perspektiven (Paläographisch, Sprachlich, etc.)
3. Event-basierte Text-Bild-Synchronisation

### Phase 3: Wissenskonsolidierung

**Auftrag:** Alles in gemeinsamen `knowledge/` Ordner integrieren.

**Durchgeführte Aktionen:**

| Aktion | Ergebnis |
|--------|----------|
| `knowledge/INDEX.md` erstellt | Zentrale Navigation, Dokumentenmatrix |
| `knowledge/METHODOLOGY.md` erstellt | Promptotyping, LLM-Bias, Critical Expert |
| `knowledge/DESIGN-SYSTEM.md` erstellt | CSS-Variablen, Komponenten, a11y |
| `knowledge/ARCHITECTURE.md` erstellt | Systemdiagramm, Module, APIs |
| `knowledge/VALIDATION.md` erstellt | Regeln, Perspektiven, Kategorien |
| `knowledge/DATA-SCHEMA.md` erstellt | TypeScript-Interfaces, JSON-Beispiele |
| `new_knowledge/index.html` → `src/index.html` | Prototyp verschoben |
| `CLAUDE.md` aktualisiert | Verweise auf knowledge/ |
| `docs/` gelöscht | Redundant |
| `new_knowledge/` gelöscht | Integriert |

### Finale Projektstruktur

```
coocr-htr/
├── README.md
├── CLAUDE.md
├── knowledge/
│   ├── INDEX.md
│   ├── METHODOLOGY.md
│   ├── DESIGN-SYSTEM.md
│   ├── ARCHITECTURE.md
│   ├── VALIDATION.md
│   ├── DATA-SCHEMA.md
│   └── JOURNAL.md
└── src/
    └── index.html
```

### Offene Punkte

- [ ] Prototyp in modulare Struktur aufteilen (js/, css/)
- [ ] Echte LLM-Integration implementieren
- [ ] LocalStorage/IndexedDB-Persistenz
- [ ] Export-Funktionen (Markdown, JSON, TSV)

---

## Dokumentenbeziehungen

```
METHODOLOGY ─────┬──→ DESIGN-SYSTEM (Farbcodierung)
                 ├──→ ARCHITECTURE (Technologieentscheidungen)
                 └──→ VALIDATION (Kategorien, Perspektiven)

ARCHITECTURE ────┬──→ VALIDATION (Engine-Integration)
                 └──→ DATA-SCHEMA (Storage-Formate)

VALIDATION ──────┬──→ DATA-SCHEMA (ValidationResult)
                 └──→ DESIGN-SYSTEM (UI-Darstellung)
```

---

## 2026-01-16 | Session 2: UI-Mockup-Analyse und Integration

**Teilnehmer:** User, Claude Opus 4.5

### Phase 1: Promptotyping-Prototyp-Analyse

**Auftrag:** `Promptotyping/prototype/` Ordner analysieren für übertragbare Patterns.

**Befund:** Anderes Projekt (Living Paper), aber nützliche Muster:

| Pattern | Beschreibung | Übertragbar? |
|---------|--------------|--------------|
| Intersection Observer | Scroll-basierte Navigation | Ja |
| Slide-Panel | Seitliches Panel mit Overlay | Ja |
| CSS Variables | Strukturierte Farbpalette | Ja |
| Terminal-UI | Monospace-Ästhetik | Teilweise |
| TESTING.md | Manuelle Test-Checkliste | Ja |

### Phase 2: UI-Mockup-Detailanalyse

**Auftrag:** Screenshot des coOCR/HTR UI-Mockups analysieren.

**Extrahierte Informationen:**

#### Layout-Struktur
```
┌─────────────────────────────────────────────────────────────────────┐
│ HEADER: Logo | Filename | Pagination | Upload | Settings | User    │
├──────────────────┬────────────────────┬─────────────────────────────┤
│ Document Viewer  │ Transcription      │ Validation                  │
│ (40%)           │ (35%)              │ (25%)                       │
│                 │                    │                             │
│ Bounding Boxes  │ Structured Table   │ Rule-Based + AI Assistant   │
│ Zoom Controls   │ Inline Markers     │ Expandable Cards            │
└──────────────────┴────────────────────┴─────────────────────────────┘
│ STATUS BAR: Model | Perspective | Status | Timestamp               │
└─────────────────────────────────────────────────────────────────────┘
```

#### Erkannte Komponenten

| Komponente | Details |
|------------|---------|
| **Document Viewer** | Bild mit farbigen Bounding Boxes, Zoom-Controls (+/-/Reset) |
| **Transcription Table** | Spalten: #, DATUM, NAME, BESCHREIBUNG, BETRAG |
| **Validation Panel** | Zwei Sektionen: ⚙️ RULE-BASED, ✨ AI ASSISTANT |
| **Status Bar** | Model-Dropdown, Perspective-Dropdown, Status-Badge, Timestamp |

#### Farbpalette (aus Mockup extrahiert)
- Background: `#0d1117` (GitHub Dark)
- Surface: `#161b22`
- Border: `#30363d`
- Success: `#3fb950`
- Warning: `#d29922`
- Error: `#f85149`

### Phase 3: Knowledge-Base-Integration

**Auftrag:** UI-Mockup-Erkenntnisse in Knowledge Base einarbeiten.

**Aktualisierte Dokumente:**

| Dokument | Änderungen |
|----------|------------|
| **DESIGN-SYSTEM.md** | Layout-Diagramm, Header-Elemente, Status Bar, Document Viewer CSS, Transcription Table CSS, Validation Panel, Card-Anatomie, Interaktions-Patterns |
| **ARCHITECTURE.md** | Erweiterte EventBus-Events, Drei Synchronisations-Flows (Transcription→All, Viewer→All, Validation→All) |
| **VALIDATION.md** | Panel-Struktur ASCII-Diagramm, Card-Anatomie, Card-Interaktion, Expandierter Zustand |
| **DATA-SCHEMA.md** | `lineNumber` und `fields` zu Segment hinzugefügt, `ColumnDefinition` Interface, Beispiel mit strukturierten Feldern |
| **INDEX.md** | UI-Komponenten Schnellreferenz, Version 1.1 Eintrag |

### Kernerkenntnisse

1. **Dreifach-Synchronisation:** Document Viewer ↔ Transcription ↔ Validation müssen bidirektional synchron bleiben
2. **Tabellarische Transkription:** Strukturierte Spalten statt Freitext für Rechnungsbücher
3. **Validation-Trennung:** RULE-BASED (deterministisch) vs. AI ASSISTANT (probabilistisch)
4. **Card-Pattern:** Expandierbare Karten mit Status-Indikator (Border-Left)

### Offene Punkte

- [x] Git Commit für Knowledge-Base-Updates
- [x] Prototyp an neue Erkenntnisse anpassen → Erledigt durch neuen modularen Prototyp v2
- [x] EventBus-Implementation für Synchronisation → AppState mit EventTarget
- [x] Transcription Table Komponente implementieren → editor.js mit CSS Grid

---

## 2026-01-16 | Session 3: Prototyp v2 Analyse und Implementierungsplan

**Teilnehmer:** User, Claude Opus 4.5

### Phase 1: Neuer Prototyp Analyse

**Auftrag:** `newer prototpye/` Ordner analysieren und mit Knowledge Base abgleichen.

**Befund:** Signifikante Verbesserungen gegenüber Prototyp v1:

| Aspekt | Prototyp v1 | Prototyp v2 |
|--------|-------------|-------------|
| Architektur | Monolithisch (1413 LOC) | Modular (322 HTML + 260 JS) |
| State | DOM-basiert | AppState mit EventTarget |
| CSS | Inline `<style>` | Externe Dateien mit Tokens |
| JS | Inline `<script>` | ES6 Module |
| Bounding Boxes | CSS-basiert | SVG-Overlay |

### Phase 2: Modulstruktur dokumentiert

**Analysierte Dateien:**

| Datei | LOC | Funktion |
|-------|-----|----------|
| `js/main.js` | 15 | Entry Point, Module laden |
| `js/state.js` | 61 | Zentraler State mit EventTarget |
| `js/viewer.js` | 67 | Document Viewer, SVG Regions, Zoom |
| `js/editor.js` | 77 | Grid-basierter Editor, Marker-Rendering |
| `js/ui.js` | 40 | Validation-Interaktionen, Flash-Effekte |
| `css/variables.css` | 52 | Design System Tokens |

**Kernimplementierung - AppState:**

```javascript
class AppState extends EventTarget {
  setSelection(lineNum) {
    this.data.selectedLine = lineNum;
    this.dispatchEvent(new CustomEvent('selectionChanged', { detail: { line: lineNum } }));
  }
}
```

→ Ersetzt den geplanten EventBus durch native Browser-API.

### Phase 3: Knowledge Base Update

**Aktualisierte Dokumente:**

| Dokument | Änderungen |
|----------|------------|
| **ARCHITECTURE.md** | Aktuelle vs. Zielstruktur, AppState-Implementierung, Event-Listener-Code |
| **DESIGN-SYSTEM.md** | Z-Index Layers, erweiterte Spacing/Transitions, Glass Morphism, Mobile Warning, Editor Grid, SVG Regions |
| **INDEX.md** | IMPLEMENTATION-PLAN.md hinzugefügt, Version 1.2 |

### Phase 4: Implementierungsplan erstellt

**Neues Dokument:** `IMPLEMENTATION-PLAN.md`

**7 Phasen definiert:**

1. **Core Services** - LLM Service, Storage Service
2. **Dialoge & Upload** - API Key Dialog, Bild-Upload
3. **LLM Transkription** - Flow: Upload → LLM → Parser → State
4. **Regelbasierte Validierung** - Deterministische Prüfungen
5. **LLM-Judge Validierung** - Perspektiven-System
6. **Export & Persistenz** - JSON/Markdown/TSV, Auto-Save
7. **Polish & UX** - Inline-Editing, Undo/Redo, Shortcuts

**Empfohlener nächster Schritt:** Phase 1.1 - LLM Service erstellen

### Aktuelle Projektstruktur

```
coocr-htr/
├── README.md
├── CLAUDE.md
├── knowledge/
│   ├── INDEX.md
│   ├── METHODOLOGY.md
│   ├── DESIGN-SYSTEM.md
│   ├── ARCHITECTURE.md
│   ├── VALIDATION.md
│   ├── DATA-SCHEMA.md
│   ├── IMPLEMENTATION-PLAN.md  ← NEU
│   └── JOURNAL.md
├── src/
│   └── index.html              # Prototyp v1 (monolithisch)
├── newer prototpye/            # Prototyp v2 (modular)
│   ├── index.html
│   ├── css/
│   │   ├── variables.css
│   │   └── styles.css
│   ├── js/
│   │   ├── main.js
│   │   ├── state.js
│   │   ├── viewer.js
│   │   ├── editor.js
│   │   └── ui.js
│   └── assets/
│       └── mock-document.jpg
└── data/                       # Beispieldaten (User erstellt)
```

### Offene Punkte

- [x] Git Commit für Session 3 Updates → Commit `3e7f219`
- [x] Data-Ordner mit Beispieldaten befüllen → Raitbuch 2 mit 340 Dateien
- [ ] Phase 1: LLM Service implementieren
- [ ] Prototyp v2 nach `src/` migrieren

---

## 2026-01-16 | Session 3b: Data-Ordner Analyse und Dokumentation

**Teilnehmer:** User, Claude Opus 4.5

### Analyse der Beispieldaten

**Auftrag:** Data-Ordner im Detail analysieren und dokumentieren.

**Befund:** Drei Hauptdatensätze mit PAGE-XML Standard:

| Datensatz | Typ | Seiten | Format | Status |
|-----------|-----|--------|--------|--------|
| **Raitbuch 2** | Rechnungsbuch (16./17. Jh.) | 123 | PAGE-XML + doc.xml | FINAL |
| **1617-wecker** | Medizinbuch (Latein) | 83 | PAGE-XML | Teilweise |
| **o_szd** | Stefan Zweig Briefe | 12 | METS-XML + JSON | Metadaten |
| **Schliemann** | Archivbilder | 21 | Nur JPG | - |

### PAGE-XML Format dokumentiert

**Erkenntnisse:**
- Standardformat von Transkribus/PyLaia
- Polygon-basierte Koordinaten (nicht rechteckig)
- Hierarchie: Page → TextRegion → TextLine → Word
- Transkriptionsstatus: NEW, IN_PROGRESS, FINAL

**Mapping zu coOCR/HTR:**
```
TextLine/Coords@points → bounds (Polygon→BoundingBox)
TextLine/TextEquiv/Unicode → text
TranskribusMetadata@status → confidence
```

### Dokumentation erstellt

| Aktion | Ergebnis |
|--------|----------|
| `data/README.md` erstellt | Datenformate, Struktur, Verwendung |
| `DATA-SCHEMA.md` erweitert | PAGE-XML Import-Schema, Konvertierung |

### Commit

Commit `40a6d9c` - Data-Dokumentation hinzugefügt

### Offene Punkte

- [ ] PAGE-XML Import-Service implementieren
- [ ] Koordinaten-Konvertierung testen
- [ ] Beispiel-Import mit Raitbuch 2

---

---

## 2026-01-16 | Session 4: Vollständige Implementierung gestartet

**Teilnehmer:** User, Claude Opus 4.5

### Phase 1: Anforderungsklärung

**Auftrag:** Vollständigen Implementierungsplan erstellen mit Milestones.

**Benutzerentscheidungen:**

| Frage | Antwort |
|-------|---------|
| LLM-Provider | Gemini 2.5 Flash, GPT-4.5 Mini, Haiku 4.5, DeepSeek (lokal+API) |
| API-Key Speicherung | LocalStorage (einfach) |
| Datenformate | Bilder + PAGE-XML |
| Export-Formate | .txt, .json, .md (PAGE-XML als Ausbaustufe) |
| Validierung | Regelbasiert + LLM-Judge parallel |
| Tests | Vitest für kritische Services |
| Ordner-Umbenennung | `newer prototpye` → `prototype` |
| Test-Framework | Vitest (Entscheidung Claude) |
| DeepSeek | Beide Optionen (API + Ollama lokal) |
| Deployment | GitHub Pages + lokale file:// Nutzung |

### Phase 2: Milestone 0 - Vorbereitung

**Tasks erledigt:**

| Task | Status |
|------|--------|
| Ordner `newer prototpye` → `prototype` umbenennen | ✅ |
| Projektstruktur erstellen (`js/services/`, `js/components/`, `tests/`) | ✅ |
| `package.json` mit Vitest erstellen | ✅ |
| `vitest.config.js` erstellen | ✅ |
| IMPLEMENTATION-PLAN.md Pfade aktualisieren | ✅ |
| ARCHITECTURE.md Pfade aktualisieren | ✅ |

### Phase 3: Milestone 1 - Core Services

**Tasks erledigt:**

| Task | Status | Datei |
|------|--------|-------|
| Storage Service | Fertig | `js/services/storage.js` |
| State.js erweitert | Fertig | `js/state.js` |
| LLM Service Basis | Fertig | `js/services/llm.js` |
| Gemini Provider | Fertig | in llm.js |
| OpenAI Provider | Fertig | in llm.js |
| Anthropic Provider | Fertig | in llm.js |
| DeepSeek Provider (API + Ollama) | Fertig | in llm.js |
| LLM Service Tests | Fertig | `tests/llm.test.js` |

**Implementierte Features:**

1. **Storage Service** (~230 LOC)
   - Settings CRUD mit Defaults
   - API Key Speicherung (Base64-obfuskiert)
   - Session Auto-Save/Restore
   - Storage-Info Utility

2. **State.js erweitert** (~440 LOC)
   - Document Management (Upload, Dimensions)
   - Transcription State (Provider, Segments, Lines)
   - Validation State (Rules, LLM-Judge, Perspective)
   - UI State (Loading, Dialogs, Errors)
   - Session Auto-Save mit Storage Service
   - Backward-Compatibility mit altem API

3. **LLM Service** (~500 LOC)
   - 5 Provider: Gemini, OpenAI, Anthropic, DeepSeek, Ollama
   - Transkriptions-Prompt (historische Handschriften)
   - Validierungs-Prompts (4 Perspektiven)
   - Response-Parsing (Markdown-Tabellen, JSON)
   - Error Handling mit Kategorisierung

### Phase 4: Umbenennung zu docs/

**Auftrag:** Ordner umbenennen für GitHub Pages Kompatibilität.

| Aktion | Status |
|--------|--------|
| `src/index.html` geloescht | Fertig |
| `prototype/` -> `docs/` | Fertig |
| Dokumentation aktualisiert | Fertig |

### Aktuelle Projektstruktur

```
coocr-htr/
├── README.md
├── CLAUDE.md
├── knowledge/
│   ├── INDEX.md
│   ├── METHODOLOGY.md
│   ├── DESIGN-SYSTEM.md
│   ├── ARCHITECTURE.md
│   ├── VALIDATION.md
│   ├── DATA-SCHEMA.md
│   ├── IMPLEMENTATION-PLAN.md
│   └── JOURNAL.md
├── docs/                       # GitHub Pages ready
│   ├── index.html
│   ├── css/
│   │   ├── variables.css
│   │   └── styles.css
│   ├── js/
│   │   ├── main.js
│   │   ├── state.js            # Erweitert
│   │   ├── viewer.js
│   │   ├── editor.js
│   │   ├── ui.js
│   │   ├── components/
│   │   ├── services/
│   │   │   ├── llm.js          # NEU
│   │   │   ├── storage.js      # NEU
│   │   │   └── parsers/
│   │   └── utils/
│   ├── tests/
│   │   └── llm.test.js         # NEU
│   ├── assets/
│   │   └── mock-document.jpg
│   ├── package.json
│   └── vitest.config.js
└── data/
```

### Commits

| Commit | Beschreibung |
|--------|--------------|
| `3cfb93c` | Milestone 0: Vorbereitung |
| `0c4ae1c` | Milestone 1: Core Services |

### Naechste Schritte

- [ ] Milestone 2: Dialoge & Upload
- [ ] Milestone 3: LLM-Transkription
- [ ] Milestone 4: Validierung

---

*Format: YYYY-MM-DD | Session N: Titel*
