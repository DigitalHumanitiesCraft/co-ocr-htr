# Security Model

coOCR/HTR is a **purely client-side web application** without a backend. This architecture has specific security characteristics documented here.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Browser                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │  index.html │    │   State     │    │  API Keys   │  │
│  │  (UI)       │───▶│  (Memory)   │◀──▶│  (Memory)   │  │
│  └─────────────┘    └─────────────┘    └──────┬──────┘  │
│                                               │         │
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
| Browser Memory | Used | Volatile, deleted when tab closes |
| localStorage | Not used | Persists across sessions, higher risk |
| sessionStorage | Not used | Similar risk to localStorage |
| Cookies | Not used | Would send keys to server |

**Implementation:** Keys are stored exclusively in JavaScript variables (`LLMService.providers[provider].apiKey`).

### Lifecycle

```
1. User enters key (Settings Dialog)
2. Key is stored in memory
3. Key is sent in header during API calls
4. Close tab → Key gone (no persistence)
5. Reload page → Key gone (must re-enter)
```

### Known Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Browser DevTools (Network Tab) | Medium | User awareness |
| Browser DevTools (Memory/Debugger) | Medium | User awareness |
| Malicious Browser Extensions | High | No technical solution possible |
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
Local File → Browser Memory → LLM API → Response → Browser Memory
     │                                                      │
     └──────────────── Never persisted ─────────────────────┘
```

- Documents are **not** sent to coOCR/HTR servers
- Documents go **directly** to the chosen LLM provider
- After closing tab: No local traces

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
