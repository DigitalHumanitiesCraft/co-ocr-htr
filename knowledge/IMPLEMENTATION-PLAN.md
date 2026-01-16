# Implementierungsplan

Roadmap vom aktuellen Prototyp v2 zur vollständigen Anwendung.

**Stand:** 2026-01-16
**Basis:** `newer prototpye/` (Modularer Prototyp)

## Aktueller Status

### Implementiert (Prototyp v2)

| Komponente | Status | Datei |
|------------|--------|-------|
| 3-Spalten-Layout | ✅ Fertig | `index.html` |
| Design System Tokens | ✅ Fertig | `css/variables.css` |
| Glass Morphism UI | ✅ Fertig | `css/styles.css` |
| Zentraler State (EventTarget) | ✅ Fertig | `js/state.js` |
| Document Viewer + SVG Regions | ✅ Fertig | `js/viewer.js` |
| Transcription Editor Grid | ✅ Fertig | `js/editor.js` |
| Validation Panel (statisch) | ✅ Fertig | `index.html` |
| Dreifach-Synchronisation | ✅ Fertig | `js/*.js` |
| Zoom Controls | ✅ Fertig | `js/viewer.js` |
| Mobile Warning | ✅ Fertig | `index.html` |

### Noch nicht implementiert

| Feature | Priorität | Komplexität |
|---------|-----------|-------------|
| LLM API Integration | Hoch | Mittel |
| Bild-Upload | Hoch | Niedrig |
| API Key Dialog | Hoch | Niedrig |
| Regelbasierte Validierung | Hoch | Mittel |
| LLM-Judge Validierung | Mittel | Hoch |
| Export (Markdown/JSON/TSV) | Mittel | Niedrig |
| LocalStorage Persistenz | Mittel | Niedrig |
| IndexedDB Dokument-Storage | Niedrig | Mittel |
| Inline-Editing | Niedrig | Mittel |
| Undo/Redo | Niedrig | Mittel |

---

## Phase 1: Core Services (Empfohlen als nächstes)

**Ziel:** Grundlegende Services für LLM-Kommunikation und Persistenz.

### 1.1 LLM Service erstellen

```
js/services/llm.js
```

```javascript
// Struktur
class LLMService {
  constructor() {
    this.providers = {
      gemini: { endpoint, apiKey, model },
      openai: { endpoint, apiKey, model },
      anthropic: { endpoint, apiKey, model },
      ollama: { endpoint, model }
    };
    this.activeProvider = 'gemini';
  }

  async transcribe(imageBase64, options) {
    // → Provider-spezifischer API-Call
    // → Prompt aus METHODOLOGY
    // → Response parsen zu Segment[]
  }

  async validate(text, perspective) {
    // → Perspektiven-Prompt aus VALIDATION
    // → Kategorielle Konfidenz zurückgeben
  }
}
```

**Tasks:**
- [ ] LLMService Klasse erstellen
- [ ] Gemini Provider implementieren
- [ ] OpenAI Provider implementieren
- [ ] Anthropic Provider implementieren
- [ ] Ollama Provider implementieren
- [ ] Unified Error Handling

### 1.2 Storage Service erstellen

```
js/services/storage.js
```

```javascript
class StorageService {
  // LocalStorage
  saveSettings(settings) {}
  loadSettings() {}
  saveApiKey(provider, key) {}
  loadApiKey(provider) {}

  // IndexedDB (später)
  async saveDocument(doc) {}
  async loadDocument(id) {}
  async listDocuments() {}
}
```

**Tasks:**
- [ ] LocalStorage Wrapper für Settings
- [ ] API Key Obfuskation (Base64)
- [ ] Auto-Save für aktuelle Session

---

## Phase 2: Dialoge & Upload

**Ziel:** Benutzer können Bilder hochladen und API Keys konfigurieren.

### 2.1 API Key Dialog

```javascript
// Dialog HTML in index.html
<dialog id="apiKeyDialog">
  <h2>API Keys</h2>
  <label>Gemini API Key
    <input type="password" id="geminiKey">
  </label>
  <!-- weitere Provider -->
  <button>Save</button>
</dialog>
```

**Tasks:**
- [ ] Dialog HTML erstellen
- [ ] Dialog CSS (Modal-Style)
- [ ] JS: Öffnen/Schließen
- [ ] JS: Keys speichern/laden

### 2.2 Bild-Upload

```javascript
// In state.js erweitern
setDocument(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    this.data.image.url = e.target.result; // Base64
    this.data.image.filename = file.name;
    this.dispatchEvent(new CustomEvent('documentLoaded', { detail: { file } }));
  };
  reader.readAsDataURL(file);
}
```

**Tasks:**
- [ ] File Input im Upload-Button
- [ ] Drag & Drop Support
- [ ] Preview im Document Viewer
- [ ] Validierung (Dateityp, Größe)

---

## Phase 3: LLM Transkription

**Ziel:** Hochgeladene Bilder können durch LLM transkribiert werden.

### 3.1 Transkriptions-Flow

```
Upload → LLMService.transcribe() → Parser → State.setTranscription() → Editor Update
```

**Tasks:**
- [ ] "Transcribe" Button hinzufügen
- [ ] Loading State im UI
- [ ] Response zu Segment[] parsen
- [ ] Bounding Boxes aus LLM-Response extrahieren (wenn verfügbar)
- [ ] Fallback: Generische Zeilen-Regionen

### 3.2 Prompt Engineering

Transkriptions-Prompt aus [METHODOLOGY](METHODOLOGY.md):

```
Du bist ein Experte für historische Handschriften des 19. Jahrhunderts...
- Tabellarische Struktur erkennen
- Datumsformate: DD. Monat
- Währungen: Taler, Groschen
- Unsichere Lesungen: [?]
- Unleserlich: [illegible]
```

---

## Phase 4: Regelbasierte Validierung

**Ziel:** Deterministische Prüfungen automatisch ausführen.

### 4.1 Validation Engine

```
js/services/validation.js
```

```javascript
const RULES = [
  {
    id: 'date_format',
    regex: /\d{1,2}\.\s?(Januar|Februar|...|Dezember)/gi,
    type: 'success',
    message: 'Datumsformat korrekt'
  },
  {
    id: 'currency',
    regex: /\d+\s?(Taler|Groschen|Gulden)/gi,
    type: 'success',
    message: 'Währung erkannt'
  },
  {
    id: 'uncertain_marker',
    regex: /\[\?\]/g,
    type: 'warning',
    message: 'Unsichere Lesung markiert'
  },
  // ...
];

function validate(text) {
  return RULES.map(rule => ({
    ...rule,
    passed: rule.regex.test(text),
    lines: findMatchingLines(text, rule.regex)
  }));
}
```

**Tasks:**
- [ ] Validation Rules definieren
- [ ] Validation Engine implementieren
- [ ] Validation Panel dynamisch rendern
- [ ] Zeilennummern zu Regeln verknüpfen

---

## Phase 5: LLM-Judge Validierung

**Ziel:** KI-gestützte Validierung aus verschiedenen Perspektiven.

### 5.1 Perspektiven-System

Aus [VALIDATION](VALIDATION.md):

| Perspektive | Prompt-Fokus |
|-------------|--------------|
| Paläographisch | Buchstabenformen, Ligaturen |
| Sprachlich | Grammatik, historische Orthographie |
| Strukturell | Tabellen, Summen, Verweise |
| Domänenwissen | Fachtermini, Plausibilität |

**Tasks:**
- [ ] Perspektiven-Dropdown im Status Bar aktivieren
- [ ] LLMService.validate() mit Perspektiven-Prompts
- [ ] AI Assistant Sektion dynamisch rendern
- [ ] Kategorielle Konfidenz anzeigen

---

## Phase 6: Export & Persistenz

**Ziel:** Arbeit speichern und exportieren.

### 6.1 Export Formate

```
js/services/export.js
```

| Format | Funktion |
|--------|----------|
| JSON | Vollständiges Transcription-Objekt |
| Markdown | Tabelle mit Validierungshinweisen |
| TSV | Nur Daten (Tab-separiert) |

**Tasks:**
- [ ] Export-Dialog
- [ ] JSON Export
- [ ] Markdown Export
- [ ] TSV Export
- [ ] Download-Trigger

### 6.2 Session-Persistenz

**Tasks:**
- [ ] Auto-Save alle 30s
- [ ] Session-Recovery beim Laden
- [ ] "Letzte Sitzung fortsetzen" Dialog

---

## Phase 7: Polish & UX

**Ziel:** Feinschliff für produktionsreife Anwendung.

### 7.1 Inline-Editing

**Tasks:**
- [ ] Doppelklick auf Zelle → Edit Mode
- [ ] Enter → Speichern
- [ ] Escape → Abbrechen
- [ ] Tab → Nächste Zelle

### 7.2 Undo/Redo

**Tasks:**
- [ ] History Stack in State
- [ ] Ctrl+Z / Ctrl+Shift+Z
- [ ] Undo/Redo Buttons im Editor-Header

### 7.3 Keyboard Shortcuts

**Tasks:**
- [ ] Shortcut-System implementieren
- [ ] Help-Overlay (?)
- [ ] Shortcuts aus [DESIGN-SYSTEM](DESIGN-SYSTEM.md)

---

## Priorisierte Roadmap

| Phase | Beschreibung | Abhängigkeiten | Schätzung |
|-------|--------------|----------------|-----------|
| **1** | Core Services | - | Basis |
| **2** | Dialoge & Upload | Phase 1 | Niedrig |
| **3** | LLM Transkription | Phase 1, 2 | Mittel |
| **4** | Regelbasierte Validierung | Phase 3 | Niedrig |
| **5** | LLM-Judge | Phase 3, 4 | Mittel |
| **6** | Export & Persistenz | Phase 3 | Niedrig |
| **7** | Polish & UX | Alle | Mittel |

---

## Nächster Schritt

**Empfehlung:** Mit Phase 1.1 (LLM Service) beginnen.

1. `js/services/llm.js` erstellen
2. Gemini Provider implementieren
3. Test mit Mock-Bild

---

**Verweise:**
- [ARCHITECTURE](ARCHITECTURE.md) für Systemdesign
- [VALIDATION](VALIDATION.md) für Validierungsregeln
- [DATA-SCHEMA](DATA-SCHEMA.md) für Datenstrukturen
