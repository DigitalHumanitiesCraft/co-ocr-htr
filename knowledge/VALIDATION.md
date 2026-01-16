# Hybride Validierung

Kombination aus deterministischen Regeln und LLM-Einschätzungen.

**Abhängigkeiten:**
- [METHODOLOGY](METHODOLOGY.md) (Begründung: LLM-Bias, Expert-in-the-Loop)
- [ARCHITECTURE](ARCHITECTURE.md) (ValidationEngine-Integration)

## Architektur

```
              ┌─────────────────┐
              │ ValidationEngine│
              └────────┬────────┘
                       │
         ┌─────────────┼─────────────┐
         ▼             ▼             ▼
  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
  │ RuleValidator│ │ LLMValidator │ │ ResultMerger │
  └──────────────┘ └──────────────┘ └──────────────┘
         │               │               │
         └───────────────┴───────────────┘
                         ▼
              ┌─────────────────┐
              │ValidationResult[]│
              └─────────────────┘
```

## Regelbasierte Validierung

Deterministische Prüfungen mit Regex und Logik.

### Implementierte Regeln

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
      return pipeCounts.every(c => c === pipeCounts[0]);
    },
    type: 'warning',
    message: 'Inkonsistente Spaltenanzahl'
  }
];
```

### Regel-Kategorien

| Kategorie | Beispiele | Typ |
|-----------|-----------|-----|
| Format | Datum, Währung, Zahlen | Regex |
| Struktur | Tabellenlogik, Spaltenanzahl | Logik |
| Marker | [?], [illegible], [gap] | Regex |
| Summen | Additionsprüfung | Logik |

## LLM-Perspektiven

Konfigurierbare Prüfwinkel für Expert-in-the-Loop.

### Perspektiven-Definition

```javascript
const PERSPECTIVES = {
  paleographic: {
    id: 'paleographic',
    name: 'Paläographisch',
    prompt: `Analysiere den Text aus paläographischer Sicht:
      - Buchstabenformen: Konsistent mit Epoche?
      - Ligaturen: Korrekt aufgelöst?
      - Abkürzungen: Korrekt expandiert?
      - Fehlertypen: Verwechslung ähnlicher Buchstaben (n/u, c/e)?`
  },
  linguistic: {
    id: 'linguistic',
    name: 'Sprachlich',
    prompt: `Analysiere den Text sprachlich:
      - Grammatik: Plausible Sätze?
      - Orthographie: Historische Schreibweise?
      - Lexik: Epochentypische Wörter?`
  },
  structural: {
    id: 'structural',
    name: 'Strukturell',
    prompt: `Analysiere die Textstruktur:
      - Tabellenlogik: Stimmen Summen?
      - Verweise: Konsistente Referenzen?
      - Nummerierung: Logische Reihenfolge?`
  },
  domain: {
    id: 'domain',
    name: 'Domänenwissen',
    prompt: `Analysiere mit Domänenwissen:
      - Fachtermini: Korrekt verwendet?
      - Plausibilität: Realistische Mengen/Preise/Daten?
      - Kontext: Passt zum Dokumenttyp?`
  }
};
```

### Perspektiven-Matrix

| Perspektive | Prüft | Typische Fehler |
|-------------|-------|-----------------|
| Paläographisch | Buchstabenformen | n↔u, c↔e, Ligaturen |
| Sprachlich | Grammatik, Lexik | Anachronismen, Syntax |
| Strukturell | Tabellen, Summen | Rechenfehler, Brüche |
| Domänenwissen | Fachtermini, Plausibilität | Unrealistische Preise |

## Konfidenz-Kategorien

Keine numerischen Werte (→ [METHODOLOGY](METHODOLOGY.md): LLM-Bias).

| Kategorie | Intern | UI | Bedeutung |
|-----------|--------|-----|-----------|
| `certain` | `success` | ✅ Grün | Hohe Übereinstimmung |
| `likely` | `warning` | ⚠️ Orange | Experte sollte prüfen |
| `uncertain` | `error` | ❌ Rot | Wahrscheinlich fehlerhaft |

## ValidationResult-Format

```typescript
interface ValidationResult {
  id: string;
  source: 'rule' | 'llm';
  type: 'success' | 'warning' | 'error';
  category: string;           // date_format, paleographic, ...
  message: string;
  lines: number[];            // Betroffene Zeilen
  details?: string;           // Erweiterte Erklärung
  suggestions?: string[];     // Alternative Lesungen
  confidence?: 'certain' | 'likely' | 'uncertain';
}
```

## UI-Darstellung

### Panel-Struktur (aus UI-Mockup)

```
┌─────────────────────────────────────────┐
│ Validation                    5 Issues  │
├─────────────────────────────────────────┤
│                                         │
│ ⚙️ RULE-BASED                            │
│ ┌─────────────────────────────────────┐ │
│ │ 🟢 Date Format Correct              │ │
│ │    Lines 3-7 (DD. Month)            │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ 🟡 Sum Check Mismatch               │ │
│ │    Line 12 • Diff: 3 Taler          │ │
│ │    ▸ Show Details                   │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ✨ AI ASSISTANT                          │
│ ┌─────────────────────────────────────┐ │
│ │ 🟢 High Confidence                  │ │
│ │    Overall Document Match           │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ 🟡 Ambiguous Reading                │ │
│ │    Line 4 • Confidence: Low         │ │
│ │    ▸ Show Details                   │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ 🔴 Missing Column                   │ │
│ │    Line 9                           │ │
│ │    ▸ Show Details                   │ │
│ └─────────────────────────────────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

### Panel-Header

| Element | Position | Beschreibung |
|---------|----------|--------------|
| Titel | Links | "Validation" |
| Badge | Rechts | "5 Issues" (Anzahl aller Warnings + Errors) |

### Sektion-Header

| Sektion | Icon | Farbe |
|---------|------|-------|
| RULE-BASED | ⚙️ | `--text-secondary` |
| AI ASSISTANT | ✨ | `--text-secondary` |

### Card-Anatomie

```
┌─ Border-Left (3px, Statusfarbe) ─────────────────────┐
│                                                      │
│  🟢 Title                                            │
│     Meta-Info (Line X • Additional Info)             │
│     ▸ Show Details (klickbar, blau)                  │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Card-Interaktion

| Aktion | Reaktion |
|--------|----------|
| Hover auf Card | Background wird `--bg-hover` |
| Klick auf Card | Card expandiert mit Details |
| Klick auf "Show Details" | Details-Bereich erscheint |
| Klick auf Zeilenreferenz | Sprung zu Zeile in allen Panels |

### Expandierter Zustand

```
┌─────────────────────────────────────┐
│ 🟡 Sum Check Mismatch               │
│    Line 12 • Diff: 3 Taler          │
│    ▾ Hide Details                   │
│ ┌─────────────────────────────────┐ │
│ │ Erwartete Summe: 106 Taler      │ │
│ │ Gefundene Summe: 103 Taler      │ │
│ │ Differenz: 3 Taler              │ │
│ │                                 │ │
│ │ Betroffene Zeilen: 3, 4, 5, 12  │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### Visuelle Unterscheidung

| Sektion | Charakteristik | Beschreibung |
|---------|----------------|--------------|
| ⚙️ RULE-BASED | Deterministisch | Immer gleiches Ergebnis, Regex/Logik |
| ✨ AI ASSISTANT | Probabilistisch | Kann variieren, kontextabhängig |

### Status-Indikatoren

| Status | Farbe | Dot | Beschreibung |
|--------|-------|-----|--------------|
| Success | `--success` (#3fb950) | 🟢 | Prüfung bestanden |
| Warning | `--warning` (#d29922) | 🟡 | Experte sollte prüfen |
| Error | `--error` (#f85149) | 🔴 | Fehler erkannt |

**Hinweis:** Im UI werden ausgefüllte Kreise (●) statt Emojis verwendet.

## Validierungs-Flow

```
Transkription geladen
       │
       ▼
┌──────────────┐
│ RuleValidator│ (sofort, synchron)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ LLMValidator │ (async, optional)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ ResultMerger │
└──────┬───────┘
       │
       ▼
  UI-Update via EventBus
```

## Erweiterbarkeit

### Neue Regel hinzufügen

```javascript
VALIDATION_RULES.push({
  id: 'custom_rule',
  name: 'Meine Regel',
  regex: /muster/gi,
  type: 'warning',
  message: 'Beschreibung'
});
```

### Neue Perspektive hinzufügen

```javascript
PERSPECTIVES.custom = {
  id: 'custom',
  name: 'Meine Perspektive',
  prompt: 'Analysiere...'
};
```

---

**Verweise:**
- [DATA-SCHEMA](DATA-SCHEMA.md) für ValidationResult-Integration
- [DESIGN-SYSTEM](DESIGN-SYSTEM.md) für UI-Darstellung
