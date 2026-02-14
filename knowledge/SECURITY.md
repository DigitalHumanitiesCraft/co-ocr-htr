# Security Model

coOCR/HTR is a **purely client-side web application** without a backend. This architecture has specific security characteristics documented here.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Browser                              │
│  ┌─────────────┐    ┌─────────────┐    ┌──────────────┐ │
│  │  index.html │    │   State     │    │  API Keys    │ │
│  │  (UI)       │───▶│  (Memory)   │◀──▶│ Memory + IDB │ │
│  └─────────────┘    └─────────────┘    └──────┬───────┘ │
│                                                │         │
└───────────────────────────────────────────────┼─────────┘
                                                │
                    HTTPS                       ▼
        ┌───────────────────────────────────────────────┐
        │              LLM Provider APIs                 │
        │  (Gemini, OpenAI, Anthropic, Ollama local)    │
        └───────────────────────────────────────────────┘
```

## API Key Handling

### Storage

| Method | Status | Rationale |
|--------|--------|-----------|
| Browser Memory | Used (default) | Immediate runtime usage without disk persistence |
| IndexedDB (`apiKeys`) | Optional | Used only when user explicitly enables key persistence |
| localStorage | Not used for API keys | Used only for non-sensitive settings and prompt fallbacks |
| sessionStorage | Not used | Similar risk profile, no benefit over current model |
| Cookies | Not used | Would send keys to server |

**Implementation:** Runtime keys live in `LLMService.providers[provider].apiKey`; validation keys can be separated in `LLMService.validationApiKeys`. Optional long-term persistence is stored in IndexedDB (`apiKeys` object store).

### Lifecycle

```
1. User enters key (Settings Dialog)
2. Key is stored in memory for immediate use
3. Optional: user enables persistence checkbox -> key is also written to IndexedDB
4. Key is sent in request headers during API calls
5. Close tab -> memory copy gone; IndexedDB copy remains only if persistence was enabled
6. Reload page -> persisted keys are restored into memory if present
```

### Known Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Browser DevTools (Network Tab) | Medium | User awareness |
| Browser DevTools (Memory/Debugger) | Medium | User awareness |
| Malicious Browser Extensions | High | No technical solution possible |
| Persistent local key storage on shared devices | High | Keep persistence disabled on untrusted devices |
| XSS Attacks | High | Controlled data sources, no user-generated content |
| Physical Device Access | High | User responsibility |

### Recommendations for Users

1. **Use dedicated API keys** with spending limits
2. **Use Ollama locally** for sensitive documents (no API key needed)
3. **Private/Incognito mode** for additional isolation
4. **Review browser extensions** - keep minimal, trusted extensions only

## Browser Access to LLM APIs

### The Risk (applies to all providers)

With direct browser access to LLM APIs, the API key is **always visible**:
- In the Network tab of DevTools
- In JavaScript memory
- To browser extensions

**The risk is identical for Gemini, OpenAI, and Anthropic.**

### Provider Differences

| Provider | Browser Access | Header Required |
|----------|----------------|-----------------|
| Gemini | Allowed | No |
| OpenAI | Allowed | No |
| Anthropic | Blocked by Default | `anthropic-dangerous-direct-browser-access: true` |

Anthropic is the only provider that blocks browser requests by default and requires an explicit opt-in header. The name "dangerous" is an intentional warning - but the risk exists equally for all providers.

### Why Direct Browser Access Anyway?

- coOCR/HTR has **no backend** (design decision for simplicity)
- A backend would add hosting complexity and costs
- Target audience is technically savvy Digital Humanists
- Alternative: Ollama local (no API key, no cloud)

### Recommendations (for all cloud providers)

1. **Create dedicated API keys** with usage limits
2. **Rotate keys regularly** (create new, delete old)
3. **Use Ollama locally** for sensitive documents
4. **Enable spending alerts** at the provider

## Data Flow

### Document Data

```
Local File -> Browser Memory -> LLM API -> Response -> Browser Memory
     |                                                      |
     +--------- Optional local persistence (IndexedDB) -----+
```

- Documents are **not** sent to coOCR/HTR servers
- Documents go **directly** to the chosen LLM provider
- Sessions/images can be persisted locally in IndexedDB for project resume

### What Is Sent to LLM Provider

| Data | Purpose |
|------|---------|
| Image (base64) | OCR/Transcription |
| Transcription text | Validation |
| Context metadata | Better results |
| Custom validation prompt | User-defined validation |

**Not sent:** Filenames, local paths, user identity

## XSS Prevention

### Controlled Data Sources

The app uses `innerHTML` in several places, but only with controlled data:

| Source | Risk | Rationale |
|--------|------|-----------|
| `samples/index.json` | Low | Local, versioned file |
| LLM Responses | Low | Structured JSON responses |
| PAGE-XML Import | Low | Validated XML format |

### Utility Function

For dynamic content, `escapeHtml()` exists in `utils/dom.js`:

```javascript
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
```

## Local Development

### config.local.js

For local development, `config.local.js` can be used:

```javascript
// This file is in .gitignore!
export const LOCAL_CONFIG = {
  apiKeys: {
    gemini: 'your-key-here',
    openai: '',
    anthropic: ''
  }
};
```

**Important:**
- File is listed in `.gitignore`
- Never commit real keys
- Only for local development

## Responsible Disclosure

Please report security issues to:
- GitHub Issues: [github.com/DigitalHumanitiesCraft/co-ocr-htr/issues](https://github.com/DigitalHumanitiesCraft/co-ocr-htr/issues)
- Label: `security`
