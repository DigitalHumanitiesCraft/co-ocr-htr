# coOCR/HTR – Technische Architektur

## Übersicht

Dieses Dokument beschreibt die technische Architektur der coOCR/HTR Workbench. Die Anwendung ist vollständig client-seitig implementiert und benötigt keinen Backend-Server.

---

## Systemarchitektur

### High-Level Architektur

```
┌─────────────────────────────────────────────────────────────────────┐
│                           BROWSER                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      UI LAYER                                │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │   │
│  │  │ Header   │  │ Document │  │ Editor   │  │Validation│    │   │
│  │  │Component │  │ Viewer   │  │Component │  │ Panel    │    │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    APPLICATION LAYER                         │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │   │
│  │  │   App    │  │ Document │  │Validation│  │  Export  │    │   │
│  │  │Controller│  │ Manager  │  │  Engine  │  │  Service │    │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      SERVICE LAYER                           │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │   │
│  │  │  LLM     │  │ Storage  │  │  Image   │  │  Event   │    │   │
│  │  │  API     │  │ Service  │  │ Processor│  │   Bus    │    │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
├──────────────────────────────┼──────────────────────────────────────┤
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    PERSISTENCE LAYER                         │   │
│  │  ┌──────────────────┐  ┌──────────────────────────────────┐ │   │
│  │  │   LocalStorage   │  │          IndexedDB               │ │   │
│  │  │   (Settings,     │  │   (Dokumente, Transkriptionen,   │ │   │
│  │  │    API Keys)     │  │    Sessions, History)            │ │   │
│  │  └──────────────────┘  └──────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        EXTERNE APIs                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │  Gemini  │  │  OpenAI  │  │ Anthropic│  │  Local   │           │
│  │   API    │  │   API    │  │   API    │  │  Ollama  │           │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Dateistruktur

```
coocr-htr/
├── index.html                 # Hauptseite
├── css/
│   ├── styles.css             # Haupt-Stylesheet
│   ├── variables.css          # CSS Custom Properties
│   └── components/
│       ├── header.css
│       ├── document-viewer.css
│       ├── editor.css
│       ├── validation.css
│       └── dialogs.css
├── js/
│   ├── app.js                 # Entry Point, Initialisierung
│   ├── config.js              # Konfiguration, Konstanten
│   ├── components/
│   │   ├── Header.js
│   │   ├── DocumentViewer.js
│   │   ├── Editor.js
│   │   ├── ValidationPanel.js
│   │   └── Dialogs.js
│   ├── services/
│   │   ├── LLMService.js      # LLM-API-Abstraktion
│   │   ├── StorageService.js  # LocalStorage/IndexedDB
│   │   ├── ImageService.js    # Bildverarbeitung
│   │   └── ExportService.js   # Export-Funktionen
│   ├── core/
│   │   ├── EventBus.js        # Pub/Sub für Komponenten
│   │   ├── State.js           # Globaler State
│   │   └── Router.js          # URL-Handling (optional)
│   └── utils/
│       ├── validators.js      # Regex-Validierungen
│       ├── parsers.js         # Markdown/TSV-Parser
│       └── helpers.js         # Utility-Funktionen
├── assets/
│   ├── icons/                 # SVG Icons
│   └── fonts/                 # Web Fonts (Inter, JetBrains Mono)
├── docs/
│   ├── design-ui.md
│   └── architecture.md
└── knowledge/
    └── coOCR-HTR Methodische Grundlagen.md
```

---

## Kernmodule

### 1. App Controller (`app.js`)

Initialisiert die Anwendung und koordiniert die Module.

```javascript
// Pseudocode
class App {
  constructor() {
    this.state = new State();
    this.eventBus = new EventBus();
    this.services = {
      llm: new LLMService(),
      storage: new StorageService(),
      image: new ImageService(),
      export: new ExportService()
    };
  }
  
  async init() {
    await this.loadSettings();
    this.initComponents();
    this.bindEvents();
    this.restoreSession();
  }
}
```

---

### 2. LLM Service (`LLMService.js`)

Abstraktionsschicht für verschiedene LLM-Provider.

#### Interface

```javascript
class LLMService {
  // Provider-Konfiguration
  setProvider(provider: 'gemini' | 'openai' | 'anthropic' | 'ollama');
  setApiKey(key: string);
  
  // Texterkennung
  async transcribe(image: Blob, options: TranscribeOptions): Promise<TranscriptionResult>;
  
  // Validierung
  async validate(text: string, perspective: Perspective): Promise<ValidationResult>;
  
  // Status
  getStatus(): ProviderStatus;
}
```

#### Provider-Implementierung

| Provider | Endpoint | Modell | Vision |
|----------|----------|--------|--------|
| Gemini | `generativelanguage.googleapis.com` | `gemini-2.0-flash` | ✅ |
| OpenAI | `api.openai.com` | `gpt-4o` | ✅ |
| Anthropic | `api.anthropic.com` | `claude-3-5-sonnet` | ✅ |
| Ollama | `localhost:11434` | `llava` | ✅ |

#### Fehlerbehandlung

```javascript
class LLMError extends Error {
  constructor(type, message, retryAfter = null) {
    super(message);
    this.type = type;          // 'auth' | 'rate_limit' | 'network' | 'invalid_response'
    this.retryAfter = retryAfter;
  }
}
```

---

### 3. Validation Engine (`ValidationEngine.js`)

Hybride Validierung mit deterministischen Regeln und LLM-Einschätzungen.

#### Architektur

```
                    ┌─────────────────┐
                    │ ValidationEngine│
                    └────────┬────────┘
                             │
           ┌─────────────────┼─────────────────┐
           ▼                 ▼                 ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │ RuleValidator│  │ LLMValidator │  │ ResultMerger │
    └──────────────┘  └──────────────┘  └──────────────┘
           │                 │                 │
           ▼                 ▼                 ▼
    ┌──────────────────────────────────────────────┐
    │             ValidationResult[]               │
    └──────────────────────────────────────────────┘
```

#### Regelbasierte Validierung

```javascript
const VALIDATION_RULES = [
  {
    id: 'date_format',
    name: 'Datumsformat',
    regex: /\d{1,2}\.\s?(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)/gi,
    type: 'success',
    message: 'Datumsformat korrekt erkannt'
  },
  {
    id: 'currency',
    name: 'Währungsformat',
    regex: /\d+\s?(Taler|Groschen|Pfennig|Gulden|Kreuzer|fl\.?|kr\.?)/gi,
    type: 'success',
    message: 'Währungsangabe erkannt'
  },
  {
    id: 'uncertain_marker',
    name: 'Unsichere Lesung',
    regex: /\[\?\]/g,
    type: 'warning',
    message: 'Unsichere Lesung markiert'
  },
  {
    id: 'illegible_marker',
    name: 'Unleserliche Stelle',
    regex: /\[illegible\]/gi,
    type: 'error',
    message: 'Unleserliche Stelle'
  },
  {
    id: 'table_consistency',
    name: 'Tabellenstruktur',
    validate: (text) => {
      const lines = text.split('\n').filter(l => l.includes('|'));
      const pipeCounts = lines.map(l => (l.match(/\|/g) || []).length);
      const isConsistent = pipeCounts.every(c => c === pipeCounts[0]);
      return {
        valid: isConsistent,
        message: isConsistent 
          ? 'Tabellenstruktur konsistent' 
          : 'Inkonsistente Spaltenanzahl'
      };
    },
    type: 'warning'
  }
];
```

#### LLM-Perspektiven

```javascript
const PERSPECTIVES = {
  paleographic: {
    id: 'paleographic',
    name: 'Paläographisch',
    prompt: `Analysiere den Text aus paläographischer Sicht:
      - Buchstabenformen: Sind sie konsistent mit der angegebenen Epoche?
      - Ligaturen: Wurden sie korrekt aufgelöst?
      - Abkürzungen: Wurden sie korrekt expandiert?
      - Fehlertypen: Verwechslung ähnlicher Buchstaben (n/u, c/e, etc.)?`
  },
  linguistic: {
    id: 'linguistic',
    name: 'Sprachlich',
    prompt: `Analysiere den Text sprachlich:
      - Grammatik: Sind die Sätze grammatikalisch plausibel?
      - Orthographie: Entspricht sie der historischen Schreibweise?
      - Lexik: Sind die Wörter für die Epoche typisch?`
  },
  structural: {
    id: 'structural',
    name: 'Strukturell',
    prompt: `Analysiere die Textstruktur:
      - Tabellenlogik: Stimmen Summen und Berechnungen?
      - Verweise: Sind interne Referenzen konsistent?
      - Nummerierung: Ist die Reihenfolge logisch?`
  },
  domain: {
    id: 'domain',
    name: 'Domänenwissen',
    prompt: `Analysiere den Text mit Domänenwissen:
      - Fachtermini: Werden sie korrekt verwendet?
      - Plausibilität: Sind Mengen, Preise, Daten realistisch?
      - Kontext: Passt der Inhalt zum Dokumenttyp?`
  }
};
```

#### Validation Result Format

```typescript
interface ValidationResult {
  id: string;
  source: 'rule' | 'llm';
  type: 'success' | 'warning' | 'error';
  category: string;           // z.B. 'date_format', 'paleographic'
  message: string;
  lines: number[];            // Betroffene Zeilen
  details?: string;           // Erweiterte Erklärung
  suggestions?: string[];     // Alternative Lesungen
  confidence?: 'certain' | 'likely' | 'uncertain';  // Nur für LLM
}
```

---

### 4. Storage Service (`StorageService.js`)

Verwaltet Persistenz im Browser.

#### Speicherstruktur

```javascript
// LocalStorage (synchron, max 5MB)
const LOCALSTORAGE_KEYS = {
  'coocr:settings': {
    theme: 'dark',
    defaultModel: 'gemini',
    perspective: 'paleographic',
    autoSave: true
  },
  'coocr:apikeys': {
    gemini: '***encrypted***',
    openai: null,
    anthropic: null
  }
};

// IndexedDB (asynchron, unbegrenzt)
const INDEXEDDB_SCHEMA = {
  database: 'coocr-htr',
  version: 1,
  stores: {
    documents: {
      keyPath: 'id',
      indexes: ['name', 'createdAt', 'updatedAt']
    },
    transcriptions: {
      keyPath: 'id',
      indexes: ['documentId', 'version']
    },
    sessions: {
      keyPath: 'id',
      indexes: ['lastAccessed']
    }
  }
};
```

#### Document Schema

```typescript
interface Document {
  id: string;                    // UUID
  name: string;                  // Dateiname
  type: 'jpeg' | 'png' | 'tiff' | 'pdf';
  pages: number;                 // Seitenanzahl
  currentPage: number;
  images: Blob[];                // Bildrohdaten
  createdAt: Date;
  updatedAt: Date;
}

interface Transcription {
  id: string;
  documentId: string;
  pageNumber: number;
  version: number;               // Versionierung
  content: string;               // Markdown
  regions: Region[];             // Bild-Text-Verknüpfung
  validations: ValidationResult[];
  modelUsed: string;
  createdAt: Date;
}

interface Region {
  id: string;
  lineNumbers: number[];         // Verknüpfte Zeilen
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: 'certain' | 'likely' | 'uncertain';
}
```

---

### 5. Event Bus (`EventBus.js`)

Ermöglicht lose Kopplung zwischen Komponenten.

```javascript
class EventBus {
  constructor() {
    this.listeners = new Map();
  }
  
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }
  
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => cb(data));
    }
  }
  
  off(event, callback) {
    // Remove listener
  }
}

// Event-Typen
const EVENTS = {
  // Dokument
  'document:loaded': null,
  'document:pageChanged': null,
  'document:saved': null,
  
  // Editor
  'editor:lineSelected': { lineNumber: 5 },
  'editor:contentChanged': { content: '...' },
  
  // Viewer
  'viewer:regionSelected': { regionId: '...' },
  'viewer:zoomChanged': { zoom: 1.5 },
  
  // Validation
  'validation:started': null,
  'validation:completed': { results: [] },
  'validation:itemClicked': { resultId: '...' },
  
  // LLM
  'llm:requestStarted': null,
  'llm:requestCompleted': null,
  'llm:error': { error: '...' }
};
```

---

## Datenflüsse

### 1. Dokument-Upload-Flow

```
User wählt Datei
       │
       ▼
┌──────────────┐
│ File Input   │
│ (Drop Zone)  │
└──────┬───────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐
│ ImageService │────▶│ Validierung  │
│ .load()      │     │ (Format,     │
└──────────────┘     │  Größe)      │
       │             └──────────────┘
       ▼
┌──────────────┐
│ StorageServ. │
│ .saveDoc()   │
└──────┬───────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐
│ EventBus     │────▶│ DocumentView │
│ 'doc:loaded' │     │ .render()    │
└──────────────┘     └──────────────┘
```

### 2. Transkriptions-Flow

```
User klickt "Analysieren"
       │
       ▼
┌──────────────┐
│ App          │
│ .transcribe()│
└──────┬───────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐
│ ImageService │────▶│ Bild zu      │
│ .toBase64()  │     │ Base64       │
└──────────────┘     └──────────────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐
│ LLMService   │────▶│ API Request  │
│ .transcribe()│     │ (Gemini etc.)│
└──────────────┘     └──────────────┘
       │
       ▼
┌──────────────┐
│ Response     │
│ Parsing      │
└──────┬───────┘
       │
       ├────────────────────────────────┐
       ▼                                ▼
┌──────────────┐                ┌──────────────┐
│ Editor       │                │ Validation   │
│ .setContent()│                │ Engine.run() │
└──────────────┘                └──────────────┘
```

### 3. Text-Bild-Synchronisation

```
User klickt Zeile im Editor
       │
       ▼
┌──────────────┐
│ Editor       │
│ onClick(line)│
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ EventBus     │
│ 'editor:     │
│  lineSelected│
└──────┬───────┘
       │
       ├─────────────────────┐
       ▼                     ▼
┌──────────────┐     ┌──────────────┐
│ DocumentView │     │ Validation   │
│ .highlight   │     │ .scrollTo    │
│  Region()    │     │  Related()   │
└──────────────┘     └──────────────┘
```

---

## API-Spezifikationen

### Gemini API Call

```javascript
async function transcribeWithGemini(imageBase64, prompt) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { 
              inline_data: { 
                mime_type: 'image/jpeg',
                data: imageBase64 
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.1,  // Niedrig für konsistente Erkennung
          maxOutputTokens: 8192
        }
      })
    }
  );
  
  return response.json();
}
```

### OpenAI API Call

```javascript
async function transcribeWithOpenAI(imageBase64, prompt) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
          { 
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
          }
        ]
      }],
      max_tokens: 4096,
      temperature: 0.1
    })
  });
  
  return response.json();
}
```

---

## Fehlerbehandlung

### Error Types

| Fehlertyp | Ursache | Handling |
|-----------|---------|----------|
| `NetworkError` | Keine Verbindung | Retry mit Backoff |
| `AuthError` | Ungültiger API Key | Dialog zur Key-Eingabe |
| `RateLimitError` | Zu viele Requests | Warten, Countdown anzeigen |
| `QuotaError` | Kontingent erschöpft | Alternativen Provider vorschlagen |
| `InvalidResponseError` | Unerwartetes Format | Fallback, Log für Debugging |
| `StorageError` | LocalStorage/IDB voll | Alte Sessions löschen |

### Retry-Strategie

```javascript
async function withRetry(fn, maxRetries = 3, baseDelay = 1000) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof RateLimitError && error.retryAfter) {
        await sleep(error.retryAfter * 1000);
        continue;
      }
      if (attempt === maxRetries - 1) throw error;
      await sleep(baseDelay * Math.pow(2, attempt));
    }
  }
}
```

---

## Sicherheit

### API-Key-Handling

```javascript
// Verschlüsselung im LocalStorage (einfache Obfuskation)
// HINWEIS: Keine echte Sicherheit, da Client-seitig!
const STORAGE_KEY = 'coocr:apikeys';

function encryptKey(key) {
  // Base64 + reversal als minimale Obfuskation
  return btoa(key.split('').reverse().join(''));
}

function decryptKey(encrypted) {
  return atob(encrypted).split('').reverse().join('');
}

// Warnung im UI anzeigen:
// "API-Keys werden lokal im Browser gespeichert. 
//  Verwenden Sie dieses Tool nicht auf öffentlichen Computern."
```

### Content Security Policy

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: blob:;
  connect-src 'self' 
    https://generativelanguage.googleapis.com 
    https://api.openai.com 
    https://api.anthropic.com
    http://localhost:11434;
">
```

---

## Performance

### Optimierungen

| Bereich | Strategie |
|---------|-----------|
| Bilder | Lazy Loading, Canvas statt `<img>` für Zoom |
| Editor | Virtualisierung für große Dokumente (>1000 Zeilen) |
| Validierung | Debounce bei Texteingabe (300ms) |
| API-Calls | Request-Batching für Mehrseiten-Dokumente |
| Storage | IndexedDB für Blobs, LocalStorage nur für Settings |

### Bundle-Größe (Ziel)

| Komponente | Größe (gzip) |
|------------|--------------|
| HTML | <5 KB |
| CSS | <15 KB |
| JavaScript | <50 KB |
| Fonts | ~100 KB |
| **Gesamt** | **<170 KB** |

---

## Testing-Strategie

### Unit Tests

```javascript
// Beispiel: Validierungsregeln
describe('ValidationRules', () => {
  test('date_format erkennt deutsches Datum', () => {
    const text = '28. Mai 1842';
    const result = VALIDATION_RULES.find(r => r.id === 'date_format').regex.test(text);
    expect(result).toBe(true);
  });
  
  test('currency erkennt Taler-Beträge', () => {
    const text = '23 Taler 15 Groschen';
    const matches = text.match(VALIDATION_RULES.find(r => r.id === 'currency').regex);
    expect(matches.length).toBe(2);
  });
});
```

### E2E Tests (Playwright)

```javascript
test('Upload und Transkription', async ({ page }) => {
  await page.goto('/');
  
  // Datei hochladen
  await page.setInputFiles('#file-input', 'test-fixtures/sample.jpg');
  await expect(page.locator('.document-viewer img')).toBeVisible();
  
  // API Key eingeben (Test-Mock)
  await page.click('[data-testid="api-keys-button"]');
  await page.fill('#gemini-key', 'TEST_KEY');
  await page.click('[data-testid="save-keys"]');
  
  // Transkription starten
  await page.click('[data-testid="analyze-button"]');
  await expect(page.locator('.editor-content')).not.toBeEmpty({ timeout: 30000 });
});
```

---

## Deployment

### GitHub Pages

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./
```

### Lokale Entwicklung

```bash
# Option 1: Python
python -m http.server 8080

# Option 2: Node.js
npx serve .

# Option 3: VS Code Live Server Extension
```

---

## Versionierung

| Version | Datum | Änderungen |
|---------|-------|------------|
| 0.1 | 2026-01-16 | Initiale Architektur-Dokumentation |
