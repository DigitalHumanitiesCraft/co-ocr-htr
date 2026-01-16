# Technische Architektur

Systemdesign für coOCR/HTR. Client-only, kein Backend.

**Abhängigkeit:** [METHODOLOGY](METHODOLOGY.md) (Begründung für Technologieentscheidungen)

## Systemübersicht

```
┌─────────────────────────────────────────────────────────────┐
│                         BROWSER                             │
├─────────────────────────────────────────────────────────────┤
│  UI LAYER                                                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ Header   │ │ Document │ │ Editor   │ │Validation│       │
│  │          │ │ Viewer   │ │          │ │ Panel    │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
├─────────────────────────────────────────────────────────────┤
│  APPLICATION LAYER                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │   App    │ │ Document │ │Validation│ │  Export  │       │
│  │Controller│ │ Manager  │ │  Engine  │ │  Service │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
├─────────────────────────────────────────────────────────────┤
│  SERVICE LAYER                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │  LLM API │ │ Storage  │ │  Image   │ │  Event   │       │
│  │          │ │          │ │ Processor│ │   Bus    │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
├─────────────────────────────────────────────────────────────┤
│  PERSISTENCE                                                │
│  ┌────────────────┐ ┌────────────────────────────┐         │
│  │  LocalStorage  │ │       IndexedDB            │         │
│  │  (Settings,    │ │  (Dokumente, Sessions)     │         │
│  │   API Keys)    │ │                            │         │
│  └────────────────┘ └────────────────────────────┘         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ HTTPS
┌─────────────────────────────────────────────────────────────┐
│  EXTERNE APIs                                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │  Gemini  │ │  OpenAI  │ │ Anthropic│ │  Ollama  │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
└─────────────────────────────────────────────────────────────┘
```

## Dateistruktur

```
src/
├── index.html              # Entry Point
├── css/
│   ├── variables.css       # Design System Tokens
│   └── styles.css          # Komponenten-Styles
├── js/
│   ├── app.js              # Initialisierung, Koordination
│   ├── config.js           # Konstanten, Konfiguration
│   ├── components/
│   │   ├── Header.js
│   │   ├── DocumentViewer.js
│   │   ├── Editor.js
│   │   ├── ValidationPanel.js
│   │   └── Dialogs.js
│   ├── services/
│   │   ├── LLMService.js   # Provider-Abstraktion
│   │   ├── StorageService.js
│   │   ├── ImageService.js
│   │   └── ExportService.js
│   ├── core/
│   │   ├── EventBus.js     # Pub/Sub
│   │   └── State.js        # Globaler Zustand
│   └── utils/
│       ├── validators.js   # Regex-Regeln
│       └── parsers.js      # Markdown/TSV
└── assets/
    └── icons/              # SVG Icons
```

## Kernmodule

### LLMService

Abstraktion für verschiedene Provider.

```javascript
class LLMService {
  setProvider(provider: 'gemini' | 'openai' | 'anthropic' | 'ollama');
  setApiKey(key: string);
  async transcribe(image: Blob, options): Promise<TranscriptionResult>;
  async validate(text: string, perspective: Perspective): Promise<ValidationResult>;
}
```

| Provider | Endpoint | Modell | Vision |
|----------|----------|--------|--------|
| Gemini | `generativelanguage.googleapis.com` | gemini-2.0-flash | ✅ |
| OpenAI | `api.openai.com` | gpt-4o | ✅ |
| Anthropic | `api.anthropic.com` | claude-3-5-sonnet | ✅ |
| Ollama | `localhost:11434` | llava | ✅ |

### EventBus

Lose Kopplung zwischen Komponenten.

```javascript
const EVENTS = {
  'document:loaded': null,
  'document:pageChanged': { page: number },
  'editor:lineSelected': { lineNumber: number },
  'editor:contentChanged': { content: string },
  'viewer:regionSelected': { regionId: string },
  'validation:completed': { results: ValidationResult[] },
  'llm:error': { error: LLMError }
};
```

### StorageService

| Speicher | Typ | Inhalt | Limit |
|----------|-----|--------|-------|
| LocalStorage | Synchron | Settings, API Keys | 5MB |
| IndexedDB | Asynchron | Dokumente, Sessions, History | Unbegrenzt |

## Datenflüsse

### Upload → Transkription

```
Image Upload → Base64 Encode → LLM Request → Parse Response
                                                    │
                                                    ▼
    Export ← Corrections ← Expert Review ← Validation
```

### Text-Bild-Synchronisation

```
User klickt Zeile
       ↓
   Editor.onClick(line)
       ↓
   EventBus.emit('editor:lineSelected')
       ↓
   ┌───┴───┐
   ↓       ↓
Viewer  Validation
.highlightRegion()  .scrollToRelated()
```

## API-Aufrufe

### Gemini

```javascript
fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: 'image/jpeg', data: base64 } }
      ]
    }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 8192 }
  })
});
```

### OpenAI

```javascript
fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`
  },
  body: JSON.stringify({
    model: 'gpt-4o',
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } }
      ]
    }],
    max_tokens: 4096,
    temperature: 0.1
  })
});
```

## Fehlerbehandlung

| Fehlertyp | Ursache | Handling |
|-----------|---------|----------|
| NetworkError | Keine Verbindung | Retry mit Backoff |
| AuthError | Ungültiger API Key | Dialog zur Key-Eingabe |
| RateLimitError | Zu viele Requests | Warten, Countdown |
| QuotaError | Kontingent erschöpft | Alternative Provider |
| StorageError | LocalStorage voll | Alte Sessions löschen |

```javascript
async function withRetry(fn, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (error.retryAfter) await sleep(error.retryAfter * 1000);
      else await sleep(1000 * Math.pow(2, attempt));
    }
  }
}
```

## Sicherheit

### API-Key-Handling

Keys werden im LocalStorage gespeichert (Base64-Obfuskation, keine echte Verschlüsselung).

**Warnung im UI:** "Verwenden Sie dieses Tool nicht auf öffentlichen Computern."

### Content Security Policy

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self';
  connect-src 'self'
    https://generativelanguage.googleapis.com
    https://api.openai.com
    https://api.anthropic.com
    http://localhost:11434;
">
```

## Technologieentscheidungen

| Entscheidung | Begründung |
|--------------|------------|
| Kein Framework | Reduziert Komplexität, verbessert Langlebigkeit |
| LocalStorage | Kein Backend nötig, sofortige Persistenz |
| Fetch API | Nativ, ausreichend für REST |
| ES6 Modules | Native Browser-Unterstützung, kein Bundler |
| CSS Custom Properties | Theming ohne Präprozessor |

## Performance-Ziele

| Metrik | Ziel |
|--------|------|
| HTML | <5 KB gzip |
| CSS | <15 KB gzip |
| JavaScript | <50 KB gzip |
| Fonts | ~100 KB |
| **Gesamt** | **<170 KB** |

---

**Verweise:**
- [VALIDATION](VALIDATION.md) für ValidationEngine-Details
- [DATA-SCHEMA](DATA-SCHEMA.md) für Datenstrukturen
