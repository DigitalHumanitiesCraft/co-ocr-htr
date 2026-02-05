# Testing Strategy

Status: 2026-02-04

## Overview

coOCR/HTR uses **Vitest** for unit tests. The testing strategy prioritizes logic tests over UI tests.

## Test Runner

```bash
cd docs
npm test        # Watch mode
npm run test    # Single run
npx vitest run  # CI mode
```

## Test Coverage by Module

### Tested (Services & Utils)

| Module | Tests | Description |
|--------|-------|-------------|
| `state.js` | 61 | Central state management, EventTarget |
| `export.js` | 49 | Export formats (TXT, JSON, MD, PAGE-XML, TEI) |
| `validation.js` | 40 | Validation engine, rules, LLM-Judge |
| `llm.js` | 27 | LLM provider abstraction, API calls |
| `page-xml.js` | 26 | PAGE-XML parser |
| `storage.js` | 23 | LocalStorage wrapper |
| `textFormatting.js` | 50 | Markers, HTML escaping, confidence |

**Total: 276 Tests**

### Not Tested (UI Components)

| Module | Lines | Rationale |
|--------|-------|-----------|
| `dialogs.js` | ~1200 | DOM-intensive, high effort, low value |
| `editor.js` | ~700 | Complex DOM manipulation |
| `viewer.js` | ~600 | OpenSeadragon integration, external dependency |
| `upload.js` | ~500 | File API, Drag & Drop |
| `transcription.js` | ~700 | UI + LLM combined |
| `validation.js` (Component) | ~700 | UI rendering |

## Testing Strategy

### What We Test

1. **Pure Functions** - No side effects, deterministic
   - `textFormatting.js`: `escapeHtml()`, `applyMarkers()`, etc.

2. **Business Logic** - Core functionality
   - `state.js`: State transitions, event dispatching
   - `validation.js`: Rule-based validation
   - `export.js`: Format conversion

3. **Parsers** - Data processing
   - `page-xml.js`: XML parsing
   - `llm.js`: Response parsing

### What We Don't Test

1. **UI Components** - DOM manipulation with many side effects
   - High effort for fragile tests
   - Better covered by manual testing

2. **External Dependencies** - OpenSeadragon, File API
   - Would require mocks
   - Integration better tested manually

3. **Visual Aspects** - CSS, Layout
   - No visual regression tests

4. **Trivial Wrappers** - DOM utilities like `getById()`, `show()`, `hide()`
   - Only test browser APIs, not our own logic
   - No value over manual testing

## Test Patterns

### Service Tests

```javascript
// Example: llm.test.js
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

### Pure Function Tests

```javascript
// Example: textFormatting.test.js
describe('escapeHtml', () => {
  it('should escape angle brackets', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });

  it('should handle null input', () => {
    expect(escapeHtml(null)).toBe('');
  });
});
```

## Known Limitations

### Global Regex with /g Flag

JavaScript regex with global flag have `lastIndex` state. With multiple `test()` calls, `lastIndex` must be reset:

```javascript
// Problem: lastIndex not reset
const PATTERN = /\[\?\]/g;
PATTERN.test('[?]'); // true
PATTERN.test('[?]'); // false (!)

// Solution: reset lastIndex before test()
PATTERN.lastIndex = 0;
PATTERN.test('[?]'); // true
```

This bug was found and fixed in `textFormatting.js`.

## CI/CD

Tests run on every push via GitHub Actions (if configured):

```yaml
- name: Run tests
  run: |
    cd docs
    npm ci
    npm test
```

## Adding New Tests

1. Create file in `docs/tests/`: `modulename.test.js`
2. Vitest imports:
   ```javascript
   import { describe, it, expect, beforeEach } from 'vitest';
   ```
3. Import modules:
   ```javascript
   import { functionToTest } from '../js/path/to/module.js';
   ```
4. Write tests with `describe`/`it`/`expect`

## Related Documents

- [ARCHITECTURE.md](ARCHITECTURE.md) - Module structure
- [SECURITY.md](SECURITY.md) - Security tests (XSS)
