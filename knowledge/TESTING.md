# Testing Strategy

Status: 2026-02-04

## Überblick

coOCR/HTR verwendet **Vitest** für Unit-Tests. Die Teststrategie priorisiert Logik-Tests über UI-Tests.

## Test-Runner

```bash
cd docs
npm test        # Watch-Modus
npm run test    # Einmalig
npx vitest run  # CI-Modus
```

## Testabdeckung nach Modul

### Getestet (Services & Utils)

| Modul | Tests | Beschreibung |
|-------|-------|--------------|
| `state.js` | 61 | Zentrales State-Management, EventTarget |
| `export.js` | 49 | Export-Formate (TXT, JSON, MD, PAGE-XML, TEI) |
| `validation.js` | 40 | Validierungs-Engine, Regeln, LLM-Judge |
| `llm.js` | 27 | LLM-Provider-Abstraktion, API-Calls |
| `page-xml.js` | 26 | PAGE-XML-Parser |
| `storage.js` | 23 | LocalStorage-Wrapper |
| `dom.js` | 28 | DOM-Utilities |
| `textFormatting.js` | 50 | Marker, HTML-Escaping, Konfidenz |

**Gesamt: 304 Tests**

### Nicht getestet (UI-Komponenten)

| Modul | Zeilen | Begründung |
|-------|--------|------------|
| `dialogs.js` | ~1200 | DOM-intensiv, hoher Aufwand, geringer Nutzen |
| `editor.js` | ~700 | Komplexe DOM-Manipulation |
| `viewer.js` | ~600 | OpenSeadragon-Integration, externes Dependency |
| `upload.js` | ~500 | File API, Drag&Drop |
| `transcription.js` | ~700 | UI + LLM kombiniert |
| `validation.js` (Component) | ~700 | UI-Rendering |

## Teststrategie

### Was wir testen

1. **Pure Functions** - Keine Seiteneffekte, deterministisch
   - `textFormatting.js`: `escapeHtml()`, `applyMarkers()`, etc.
   - `dom.js`: Utility-Funktionen

2. **Business-Logik** - Kernfunktionalität
   - `state.js`: State-Transitions, Event-Dispatching
   - `validation.js`: Regelbasierte Validierung
   - `export.js`: Format-Konvertierung

3. **Parser** - Datenverarbeitung
   - `page-xml.js`: XML-Parsing
   - `llm.js`: Response-Parsing

### Was wir nicht testen

1. **UI-Komponenten** - DOM-Manipulation mit vielen Seiteneffekten
   - Hoher Aufwand für fragile Tests
   - Besser durch manuelle Tests abgedeckt

2. **Externe Abhängigkeiten** - OpenSeadragon, File API
   - Würden Mocks erfordern
   - Integration besser manuell prüfen

3. **Visuelle Aspekte** - CSS, Layout
   - Keine visuelle Regression-Tests

## Testmuster

### Service-Tests

```javascript
// Beispiel: llm.test.js
describe('LLMService', () => {
  let service;

  beforeEach(() => {
    service = new LLMService();
  });

  it('should return default model', () => {
    expect(service.getCurrentModel()).toBe('gemini-3-flash-preview');
  });
});
```

### DOM-Utility-Tests

```javascript
// Beispiel: dom.test.js
describe('toggleVisibility', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('should toggle hidden attribute', () => {
    const el = document.createElement('div');
    container.appendChild(el);
    toggleVisibility(el);
    expect(el.hidden).toBe(true);
  });
});
```

### Pure-Function-Tests

```javascript
// Beispiel: textFormatting.test.js
describe('escapeHtml', () => {
  it('should escape angle brackets', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });

  it('should handle null input', () => {
    expect(escapeHtml(null)).toBe('');
  });
});
```

## Bekannte Einschränkungen

### Globale Regex mit /g Flag

JavaScript Regex mit globalem Flag haben `lastIndex`-State. Bei mehrfachen `test()`-Aufrufen muss `lastIndex` zurückgesetzt werden:

```javascript
// Problem: lastIndex wird nicht zurückgesetzt
const PATTERN = /\[\?\]/g;
PATTERN.test('[?]'); // true
PATTERN.test('[?]'); // false (!)

// Lösung: lastIndex vor test() zurücksetzen
PATTERN.lastIndex = 0;
PATTERN.test('[?]'); // true
```

Dieser Bug wurde in `textFormatting.js` gefunden und behoben.

## CI/CD

Tests laufen bei jedem Push via GitHub Actions (falls konfiguriert):

```yaml
- name: Run tests
  run: |
    cd docs
    npm ci
    npm test
```

## Neue Tests hinzufügen

1. Datei in `docs/tests/` erstellen: `modulname.test.js`
2. Vitest imports:
   ```javascript
   import { describe, it, expect, beforeEach } from 'vitest';
   ```
3. Module importieren:
   ```javascript
   import { functionToTest } from '../js/path/to/module.js';
   ```
4. Tests schreiben mit `describe`/`it`/`expect`

## Verwandte Dokumente

- [ARCHITECTURE.md](ARCHITECTURE.md) - Modulstruktur
- [SECURITY.md](SECURITY.md) - Sicherheitstests (XSS)
