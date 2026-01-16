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

### Zwei Sektionen

```
┌─────────────────────────────────────┐
│ ⚙️ Regelbasiert                      │
├─────────────────────────────────────┤
│ ✅ Datumsformat korrekt             │
│    Zeile 3-8                        │
├─────────────────────────────────────┤
│ ⚠️ Unsichere Lesung [?]             │
│    Zeile 5 – "Müller" oder "Möller"?│
│    ▾ Details                         │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 🤖 KI-Einschätzung                   │
├─────────────────────────────────────┤
│ ✅ Text-zu-Bild-Konsistenz hoch     │
├─────────────────────────────────────┤
│ ⚠️ Möglicher Lesefehler             │
│    Zeile 4 – Alternative: "75 Taler"│
│    ▾ Details                         │
└─────────────────────────────────────┘
```

### Visuelle Unterscheidung

- **⚙️ Regelbasiert:** Deterministisch, reproduzierbar
- **🤖 KI-Einschätzung:** Probabilistisch, kontextabhängig

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
