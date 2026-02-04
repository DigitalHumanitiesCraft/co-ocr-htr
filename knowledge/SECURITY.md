# Security Model

coOCR/HTR ist eine **rein client-seitige Webanwendung** ohne Backend. Diese Architektur hat spezifische Sicherheitseigenschaften, die hier dokumentiert sind.

## Architektur-Überblick

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
        │  (Gemini, OpenAI, Anthropic, Ollama lokal)    │
        └───────────────────────────────────────────────┘
```

## API-Key-Handling

### Speicherung

| Methode | Status | Begründung |
|---------|--------|------------|
| Browser Memory | Verwendet | Flüchtig, wird bei Tab-Schließung gelöscht |
| localStorage | Nicht verwendet | Persistiert über Sessions, höheres Risiko |
| sessionStorage | Nicht verwendet | Ähnliches Risiko wie localStorage |
| Cookies | Nicht verwendet | Würde Keys an Server senden |

**Implementierung:** Keys werden ausschließlich in JavaScript-Variablen gehalten (`LLMService.providers[provider].apiKey`).

### Lebenszyklus

```
1. Nutzer gibt Key ein (Settings Dialog)
2. Key wird in Memory gespeichert
3. Key wird bei API-Calls im Header gesendet
4. Tab schließen → Key weg (kein Persist)
5. Seite neu laden → Key weg (muss neu eingegeben werden)
```

### Bekannte Risiken

| Risiko | Schwere | Mitigation |
|--------|---------|------------|
| Browser DevTools (Network Tab) | Mittel | Nutzer-Awareness |
| Browser DevTools (Memory/Debugger) | Mittel | Nutzer-Awareness |
| Malicious Browser Extensions | Hoch | Keine technische Lösung möglich |
| XSS-Angriffe | Hoch | Kontrollierte Datenquellen, kein User-Generated Content |
| Physischer Zugang zum Gerät | Hoch | Nutzer-Verantwortung |

### Empfehlungen für Nutzer

1. **Dedizierte API-Keys verwenden** mit Spending-Limits
2. **Ollama lokal nutzen** für sensible Dokumente (kein API-Key nötig)
3. **Private/Incognito-Modus** für zusätzliche Isolation
4. **Browser-Extensions prüfen** - minimale, vertrauenswürdige Extensions

## Browser-Zugriff auf LLM-APIs

### Das Risiko (gilt für alle Provider)

Bei direktem Browser-Zugriff auf LLM-APIs ist der API-Key **immer sichtbar**:
- Im Network Tab der DevTools
- Im JavaScript-Memory
- Für Browser-Extensions

**Das Risiko ist identisch für Gemini, OpenAI und Anthropic.**

### Provider-Unterschiede

| Provider | Browser-Zugriff | Header erforderlich |
|----------|-----------------|---------------------|
| Gemini | Erlaubt | Nein |
| OpenAI | Erlaubt | Nein |
| Anthropic | Blockiert by Default | `anthropic-dangerous-direct-browser-access: true` |

Anthropic ist der einzige Provider, der Browser-Requests standardmäßig blockiert und einen expliziten Opt-in-Header verlangt. Der Name "dangerous" ist eine bewusste Warnung - aber das Risiko besteht bei allen Providern gleichermaßen.

### Warum trotzdem direkt vom Browser?

- coOCR/HTR hat **kein Backend** (Design-Entscheidung für Einfachheit)
- Ein Backend würde Hosting-Komplexität und Kosten verursachen
- Zielgruppe sind technisch versierte Digital Humanists
- Alternative: Ollama lokal (kein API-Key, keine Cloud)

### Empfehlungen (für alle Cloud-Provider)

1. **Dedizierte API-Keys** mit Usage Limits erstellen
2. **Keys regelmäßig rotieren** (neuen erstellen, alten löschen)
3. **Ollama lokal** für sensible Dokumente verwenden
4. **Spending Alerts** beim Provider aktivieren

## Datenfluss

### Dokument-Daten

```
Lokale Datei → Browser Memory → LLM API → Response → Browser Memory
     │                                                      │
     └──────────────── Niemals persistiert ─────────────────┘
```

- Dokumente werden **nicht** an coOCR/HTR-Server gesendet
- Dokumente gehen **direkt** an den gewählten LLM-Provider
- Nach Tab-Schließung: Keine Spuren lokal

### Was an LLM-Provider gesendet wird

| Daten | Zweck |
|-------|-------|
| Bild (base64) | OCR/Transkription |
| Transkriptions-Text | Validierung |
| Kontext-Metadaten | Bessere Ergebnisse |
| Custom Validation Prompt | Benutzerdefinierte Validierung |

**Nicht gesendet:** Dateinamen, lokale Pfade, Nutzer-Identität

## XSS-Prävention

### Kontrollierte Datenquellen

Die App verwendet `innerHTML` an mehreren Stellen, aber nur mit kontrollierten Daten:

| Quelle | Risiko | Begründung |
|--------|--------|------------|
| `samples/index.json` | Niedrig | Lokale, versionierte Datei |
| LLM-Responses | Niedrig | Strukturierte JSON-Responses |
| PAGE-XML Import | Niedrig | Validiertes XML-Format |

### Utility-Funktion

Für dynamische Inhalte existiert `escapeHtml()` in `utils/dom.js`:

```javascript
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
```

## Lokale Entwicklung

### config.local.js

Für lokale Entwicklung kann `config.local.js` verwendet werden:

```javascript
// Diese Datei ist in .gitignore!
export const LOCAL_CONFIG = {
  apiKeys: {
    gemini: 'your-key-here',
    openai: '',
    anthropic: ''
  }
};
```

**Wichtig:**
- Datei ist in `.gitignore` gelistet
- Niemals echte Keys committen
- Nur für lokale Entwicklung gedacht

## Responsible Disclosure

Sicherheitsprobleme bitte melden an:
- GitHub Issues: [github.com/DigitalHumanitiesCraft/co-ocr-htr/issues](https://github.com/DigitalHumanitiesCraft/co-ocr-htr/issues)
- Label: `security`
