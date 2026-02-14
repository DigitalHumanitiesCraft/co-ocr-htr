# Improvement Plan coOCR/HTR

Status: Created 2026-02-04

## Priority 1: Extend Test Coverage

### 1.1 Test Critical Components
| Module | Lines | Risk | Effort |
|--------|-------|------|--------|
| `dialogs.js` | ~1200 | High | Medium |
| `editor.js` | ~600 | High | Medium |
| `viewer.js` | ~400 | Medium | Low |
| `upload.js` | ~300 | Medium | Low |

**Specific Tests:**
- [ ] `dialogs.test.js`: Modal open/close, form validation, save settings
- [ ] `editor.test.js`: Line rendering, confidence styling, diff display
- [ ] `viewer.test.js`: OpenSeadragon integration, zoom, pan
- [ ] `upload.test.js`: Drag & drop, file validation, PAGE-XML parsing

### 1.2 Test Utils
- [ ] `dom.js`: All 8 utility functions
- [ ] `textFormatting.js`: Unicode normalization, whitespace handling

---

## Priority 2: Security Documentation

### 2.1 Expand Security Note in README
**Current:** Brief note about API keys in memory

**Add:**
```markdown
## Security Model

### API Key Handling
- Keys are stored **only in browser memory** (not localStorage)
- Keys are visible in browser DevTools (Network Tab, Memory)
- For sensitive work: Use Ollama locally (no cloud API)

### Anthropic Direct Browser Access
This app uses the `anthropic-dangerous-direct-browser-access` header.
This is required for client-side apps without a backend.
Risk: API key visible in browser. Recommendation: Use rate-limited keys.
```

### 2.2 Create SECURITY.md
- [x] Responsible Disclosure Policy
- [x] Document known limitations
- [x] Recommendations for production use

---

## Priority 3: Code Quality

### 3.1 Centralize Constants
**File:** Extend `docs/js/utils/constants.js`

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

### 3.2 Standardize HTML Escaping
**File:** Add to `docs/js/utils/dom.js`

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

**Apply in:**
- `main.js:204-208` (samples menu)
- `dialogs.js` (error messages)
- `components/transcription.js` (model info)

### 3.3 Split transcription.js
Current responsibilities:
1. UI rendering
2. LLM calls
3. State updates

**Refactoring:**
- [ ] `transcription-ui.js` - DOM manipulation only
- [ ] `transcription-service.js` - LLM logic (or integrate into `llm.js`)

---

## Priority 4: Clarify Documentation

### 4.1 README.md
**Change:**
```diff
- No Dependencies: Vanilla JavaScript
+ No npm Dependencies: Vanilla JavaScript (uses OpenSeadragon via CDN)
```

### 4.2 CLAUDE.md
**Change:**
```diff
- | Dependencies | None (Tests: Vitest) |
+ | Runtime Dependencies | None (CDN: OpenSeadragon) |
+ | Dev Dependencies | Vitest, jsdom |
```

---

## Priority 5: Accessibility

### 5.1 Add Text to Color Indicators
**Current:** Color only (green/yellow/red)
**Better:** Color + icon or text

```css
.confidence-certain::before { content: "✓ "; }
.confidence-uncertain::before { content: "? "; }
.confidence-unknown::before { content: "! "; }
```

### 5.2 Add Skip Link
```html
<a href="#main-content" class="skip-link">Skip to main content</a>
```

---

## Implementation Order

```
Phase 1 (Immediate)
├── 2.1 Security note in README
└── 3.2 escapeHtml() utility

Phase 2 (Short-term)
├── 1.1 dialogs.test.js
├── 1.1 editor.test.js
├── 3.1 Centralize constants
└── 4.1 + 4.2 Documentation

Phase 3 (Medium-term)
├── 1.1 viewer.test.js + upload.test.js
├── 1.2 Test utils
├── 2.2 SECURITY.md
└── 5.1 + 5.2 Accessibility

Phase 4 (When opportunity arises)
└── 3.3 transcription.js refactoring
```

---

## Priority 6: Institutional Deployment Support

Context: ZBZ (Zentralbibliothek Zürich) plans to fork co-ocr-htr for their Jeanne Hersch Edition project. Deployment on GitLab Uni Zürich with Podman.

### 6.1 Containerfile for Podman/Docker
- [ ] Create OCI-compatible Containerfile (static file serving, e.g. nginx/caddy)
- [ ] Document deployment options (GitHub Pages, Podman/Docker, local file://)

### 6.2 Azure Provider Support in LLMService
- [ ] Azure-compatible API endpoint configuration (different auth, endpoint URLs, model naming)
- [ ] Mistral OCR 3 as provider option (quality comparison pending, part of zbz-ocr-tei)

### 6.3 Fork Documentation
- [ ] Document institutional fork pattern and merge strategy for upstream changes

---

## Not Implementing

These items were deliberately classified as "not a real problem":

| Item | Rationale |
|------|-----------|
| Backend for Anthropic | Would increase hosting complexity, target audience is technical users |
| TypeScript migration | Contradicts the vanilla JS philosophy of the project |
| localStorage for keys | Deliberately avoided for security reasons |
| Completely replace innerHTML | Poor effort/benefit ratio since data is controlled |
