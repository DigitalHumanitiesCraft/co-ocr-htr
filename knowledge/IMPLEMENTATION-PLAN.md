---
type: knowledge
created: 2026-01-16
tags: [coocr-htr, roadmap, milestones]
status: complete
---

# Implementation Plan

Roadmap from the current Prototype v2 to the complete application.

**Date:** 2026-01-16
**Base:** `docs/` (Modular Prototype, GitHub Pages ready)

## Current Status

### Implemented (Prototype v2)

| Component | Status | File |
|-----------|--------|------|
| 3-Column Layout | ✅ Done | `index.html` |
| Design System Tokens | ✅ Done | `css/variables.css` |
| Glass Morphism UI | ✅ Done | `css/styles.css` |
| Central State (EventTarget) | ✅ Done | `js/state.js` |
| Document Viewer + SVG Regions | ✅ Done | `js/viewer.js` |
| Transcription Editor Grid | ✅ Done | `js/editor.js` |
| Validation Panel (static) | ✅ Done | `index.html` |
| Triple Synchronization | ✅ Done | `js/*.js` |
| Zoom Controls | ✅ Done | `js/viewer.js` |
| Mobile Warning | ✅ Done | `index.html` |

### Not Yet Implemented

| Feature | Priority | Complexity |
|---------|----------|------------|
| LLM API Integration | High | Medium |
| Image Upload | High | Low |
| API Key Dialog | High | Low |
| Rule-Based Validation | High | Medium |
| LLM-Judge Validation | Medium | High |
| Export (Markdown/JSON/TSV) | Medium | Low |
| LocalStorage Persistence | Medium | Low |
| IndexedDB Document Storage | Low | Medium |
| Inline Editing | Low | Medium |
| Undo/Redo | Low | Medium |

---

## Phase 1: Core Services (Recommended as Next Step)

**Goal:** Basic services for LLM communication and persistence.

### 1.1 Create LLM Service

```
js/services/llm.js
```

```javascript
// Structure
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
    // → Provider-specific API call
    // → Prompt from METHODOLOGY
    // → Parse response to Segment[]
  }

  async validate(text, perspective) {
    // → Perspective prompt from VALIDATION
    // → Return categorical confidence
  }
}
```

**Tasks:**
- [ ] Create LLMService class
- [ ] Implement Gemini provider
- [ ] Implement OpenAI provider
- [ ] Implement Anthropic provider
- [ ] Implement Ollama provider
- [ ] Unified error handling

### 1.2 Create Storage Service

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

  // IndexedDB (later)
  async saveDocument(doc) {}
  async loadDocument(id) {}
  async listDocuments() {}
}
```

**Tasks:**
- [ ] LocalStorage wrapper for settings
- [ ] API key obfuscation (Base64)
- [ ] Auto-save for current session

---

## Phase 2: Dialogs & Upload

**Goal:** Users can upload images and configure API keys.

### 2.1 API Key Dialog

```javascript
// Dialog HTML in index.html
<dialog id="apiKeyDialog">
  <h2>API Keys</h2>
  <label>Gemini API Key
    <input type="password" id="geminiKey">
  </label>
  <!-- other providers -->
  <button>Save</button>
</dialog>
```

**Tasks:**
- [ ] Create dialog HTML
- [ ] Dialog CSS (modal style)
- [ ] JS: Open/Close
- [ ] JS: Save/Load keys

### 2.2 Image Upload

```javascript
// Extend in state.js
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
- [ ] File input in upload button
- [ ] Drag & drop support
- [ ] Preview in Document Viewer
- [ ] Validation (file type, size)

---

## Phase 3: LLM Transcription

**Goal:** Uploaded images can be transcribed via LLM.

### 3.1 Transcription Flow

```
Upload → LLMService.transcribe() → Parser → State.setTranscription() → Editor Update
```

**Tasks:**
- [ ] Add "Transcribe" button
- [ ] Loading state in UI
- [ ] Parse response to Segment[]
- [ ] Extract bounding boxes from LLM response (if available)
- [ ] Fallback: Generic line regions

### 3.2 Prompt Engineering

Transcription prompt from [METHODOLOGY](METHODOLOGY.md):

```
You are an expert in historical handwriting from the 19th century...
- Recognize tabular structure
- Date formats: DD. Month
- Currencies: Taler, Groschen
- Uncertain readings: [?]
- Illegible: [illegible]
```

---

## Phase 4: Rule-Based Validation

**Goal:** Automatically execute deterministic checks.

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
    message: 'Date format correct'
  },
  {
    id: 'currency',
    regex: /\d+\s?(Taler|Groschen|Gulden)/gi,
    type: 'success',
    message: 'Currency recognized'
  },
  {
    id: 'uncertain_marker',
    regex: /\[\?\]/g,
    type: 'warning',
    message: 'Uncertain reading marked'
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
- [ ] Define validation rules
- [ ] Implement validation engine
- [ ] Dynamically render validation panel
- [ ] Link line numbers to rules

---

## Phase 5: LLM-Judge Validation

**Goal:** AI-assisted validation from different perspectives.

### 5.1 Perspective System

From [VALIDATION](VALIDATION.md):

| Perspective | Prompt Focus |
|-------------|--------------|
| Paleographic | Letter forms, ligatures |
| Linguistic | Grammar, historical orthography |
| Structural | Tables, sums, references |
| Domain Knowledge | Technical terms, plausibility |

**Tasks:**
- [ ] Activate perspective dropdown in status bar
- [ ] LLMService.validate() with perspective prompts
- [ ] Dynamically render AI Assistant section
- [ ] Display categorical confidence

---

## Phase 6: Export & Persistence

**Goal:** Save and export work.

### 6.1 Export Formats

```
js/services/export.js
```

| Format | Function |
|--------|----------|
| JSON | Complete Transcription object |
| Markdown | Table with validation notes |
| TSV | Data only (tab-separated) |

**Tasks:**
- [ ] Export dialog
- [ ] JSON export
- [ ] Markdown export
- [ ] TSV export
- [ ] Download trigger

### 6.2 Session Persistence

**Tasks:**
- [ ] Auto-save every 30s
- [ ] Session recovery on load
- [ ] "Resume last session" dialog

---

## Phase 7: Polish & UX

**Goal:** Fine-tuning for production-ready application.

### 7.1 Inline Editing

**Tasks:**
- [ ] Double-click on cell → Edit mode
- [ ] Enter → Save
- [ ] Escape → Cancel
- [ ] Tab → Next cell

### 7.2 Undo/Redo

**Tasks:**
- [ ] History stack in state
- [ ] Ctrl+Z / Ctrl+Shift+Z
- [ ] Undo/Redo buttons in editor header

### 7.3 Keyboard Shortcuts

**Tasks:**
- [ ] Implement shortcut system
- [ ] Help overlay (?)
- [ ] Shortcuts from [DESIGN-SYSTEM](DESIGN-SYSTEM.md)

---

## Prioritized Roadmap

| Phase | Description | Dependencies | Estimate |
|-------|-------------|--------------|----------|
| **1** | Core Services | - | Base |
| **2** | Dialogs & Upload | Phase 1 | Low |
| **3** | LLM Transcription | Phase 1, 2 | Medium |
| **4** | Rule-Based Validation | Phase 3 | Low |
| **5** | LLM-Judge | Phase 3, 4 | Medium |
| **6** | Export & Persistence | Phase 3 | Low |
| **7** | Polish & UX | All | Medium |

---

## Next Step

**Recommendation:** Start with Phase 1.1 (LLM Service).

1. Create `js/services/llm.js`
2. Implement Gemini provider
3. Test with mock image

---

**References:**
- [ARCHITECTURE](ARCHITECTURE.md) for system design
- [VALIDATION](VALIDATION.md) for validation rules
- [DATA-SCHEMA](DATA-SCHEMA.md) for data structures
