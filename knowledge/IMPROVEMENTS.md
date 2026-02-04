# Verbesserungsplan coOCR/HTR

Status: Erstellt 2026-02-04

## Priorität 1: Testabdeckung erweitern

### 1.1 Kritische Komponenten testen
| Modul | Zeilen | Risiko | Aufwand |
|-------|--------|--------|---------|
| `dialogs.js` | ~1200 | Hoch | Mittel |
| `editor.js` | ~600 | Hoch | Mittel |
| `viewer.js` | ~400 | Mittel | Niedrig |
| `upload.js` | ~300 | Mittel | Niedrig |

**Konkrete Tests:**
- [ ] `dialogs.test.js`: Modal öffnen/schließen, Form-Validierung, Settings speichern
- [ ] `editor.test.js`: Zeilen-Rendering, Konfidenz-Styling, Diff-Anzeige
- [ ] `viewer.test.js`: OpenSeadragon-Integration, Zoom, Pan
- [ ] `upload.test.js`: Drag&Drop, Datei-Validierung, PAGE-XML-Parsing

### 1.2 Utils testen
- [ ] `dom.js`: Alle 8 Utility-Funktionen
- [ ] `textFormatting.js`: Unicode-Normalisierung, Whitespace-Handling

---

## Priorität 2: Sicherheitsdokumentation

### 2.1 Security-Hinweis in README erweitern
**Aktuell:** Kurzer Hinweis zu API-Keys in Memory

**Ergänzen:**
```markdown
## Security Model

### API Key Handling
- Keys werden **nur im Browser-Memory** gehalten (nicht localStorage)
- Keys sind im Browser DevTools sichtbar (Network Tab, Memory)
- Für sensible Arbeit: Ollama lokal verwenden (keine Cloud-API)

### Anthropic Direct Browser Access
Diese App nutzt `anthropic-dangerous-direct-browser-access` Header.
Das ist notwendig für client-seitige Apps ohne Backend.
Risiko: API-Key im Browser sichtbar. Empfehlung: Rate-limited Keys verwenden.
```

### 2.2 SECURITY.md erstellen
- [ ] Responsible Disclosure Policy
- [ ] Bekannte Einschränkungen dokumentieren
- [ ] Empfehlungen für Produktiv-Einsatz

---

## Priorität 3: Code-Qualität

### 3.1 Konstanten zentralisieren
**Datei:** `docs/js/utils/constants.js` erweitern

```javascript
// Validation Status
export const VALIDATION_STATUS = {
  IDLE: 'idle',
  RUNNING: 'running',
  COMPLETE: 'complete',
  ERROR: 'error'
};

// Confidence Levels
export const CONFIDENCE = {
  CERTAIN: 'certain',
  UNCERTAIN: 'uncertain',
  UNKNOWN: 'unknown'
};

// Editor Modes
export const EDITOR_MODE = {
  VIEW: 'view',
  EDIT: 'edit',
  DIFF: 'diff'
};
```

### 3.2 HTML-Escaping standardisieren
**Datei:** `docs/js/utils/dom.js` ergänzen

```javascript
/**
 * Escapes HTML to prevent XSS when inserting user data
 * @param {string} text - Raw text to escape
 * @returns {string} HTML-safe string
 */
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
```

**Anwenden in:**
- `main.js:204-208` (samples menu)
- `dialogs.js` (error messages)
- `components/transcription.js` (model info)

### 3.3 transcription.js aufteilen
Aktuelle Verantwortlichkeiten:
1. UI-Rendering
2. LLM-Aufrufe
3. State-Updates

**Refactoring:**
- [ ] `transcription-ui.js` - Nur DOM-Manipulation
- [ ] `transcription-service.js` - LLM-Logik (oder in `llm.js` integrieren)

---

## Priorität 4: Dokumentation präzisieren

### 4.1 README.md
**Ändern:**
```diff
- No Dependencies: Vanilla JavaScript
+ No npm Dependencies: Vanilla JavaScript (uses OpenSeadragon via CDN)
```

### 4.2 CLAUDE.md
**Ändern:**
```diff
- | Dependencies | Keine (Tests: Vitest) |
+ | Runtime Dependencies | Keine (CDN: OpenSeadragon) |
+ | Dev Dependencies | Vitest, jsdom |
```

---

## Priorität 5: Accessibility

### 5.1 Farb-Indikatoren mit Text ergänzen
**Aktuell:** Nur Farbe (grün/gelb/rot)
**Besser:** Farbe + Icon oder Text

```css
.confidence-certain::before { content: "✓ "; }
.confidence-uncertain::before { content: "? "; }
.confidence-unknown::before { content: "! "; }
```

### 5.2 Skip-Link hinzufügen
```html
<a href="#main-content" class="skip-link">Zum Hauptinhalt springen</a>
```

---

## Umsetzungsreihenfolge

```
Phase 1 (Sofort)
├── 2.1 Security-Hinweis in README
└── 3.2 escapeHtml() Utility

Phase 2 (Kurzfristig)
├── 1.1 dialogs.test.js
├── 1.1 editor.test.js
├── 3.1 Konstanten zentralisieren
└── 4.1 + 4.2 Dokumentation

Phase 3 (Mittelfristig)
├── 1.1 viewer.test.js + upload.test.js
├── 1.2 Utils testen
├── 2.2 SECURITY.md
└── 5.1 + 5.2 Accessibility

Phase 4 (Bei Gelegenheit)
└── 3.3 transcription.js Refactoring
```

---

## Nicht umsetzen

Diese Punkte wurden bewusst als "kein echtes Problem" eingestuft:

| Punkt | Begründung |
|-------|------------|
| Backend für Anthropic | Würde Hosting-Komplexität erhöhen, Zielgruppe sind technische Nutzer |
| TypeScript Migration | Widerspricht Vanilla-JS-Philosophie des Projekts |
| localStorage für Keys | Bewusst vermieden aus Sicherheitsgründen |
| innerHTML komplett ersetzen | Aufwand/Nutzen-Verhältnis schlecht, da Daten kontrolliert |
