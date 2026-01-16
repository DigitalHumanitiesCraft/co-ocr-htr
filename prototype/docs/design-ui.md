# coOCR/HTR – Design & UI Spezifikation

## Übersicht

Dieses Dokument spezifiziert das User Interface der coOCR/HTR Workbench. Es definiert Layout, Komponenten, Interaktionen und Barrierefreiheits-Anforderungen.

---

## Design-System

### Farbpalette

| Verwendung | Variable | Hex | Beschreibung |
|------------|----------|-----|--------------|
| Hintergrund primär | `--bg-primary` | `#0d1117` | Haupthintergrund |
| Hintergrund sekundär | `--bg-secondary` | `#161b22` | Panels |
| Hintergrund tertiär | `--bg-tertiary` | `#21262d` | Cards, Inputs |
| Text primär | `--text-primary` | `#e6edf3` | Haupttext |
| Text sekundär | `--text-secondary` | `#8b949e` | Labels, Hints |
| Akzent primär | `--accent-primary` | `#58a6ff` | Buttons, Links |
| Erfolg | `--success` | `#3fb950` | Sicher, Bestätigt |
| Warnung | `--warning` | `#d29922` | Prüfenswert |
| Fehler | `--error` | `#f85149` | Problematisch |
| Auswahl | `--selection` | `#ffc107` | Markierte Zeile/Region |

### Typografie

```css
:root {
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
  
  --text-xs: 0.75rem;    /* 12px - Labels */
  --text-sm: 0.875rem;   /* 14px - Sekundär */
  --text-base: 1rem;     /* 16px - Body */
  --text-lg: 1.125rem;   /* 18px - Überschriften */
  --text-xl: 1.25rem;    /* 20px - Panel-Titel */
}
```

### Spacing & Radii

```css
:root {
  --space-1: 0.25rem;  /* 4px */
  --space-2: 0.5rem;   /* 8px */
  --space-3: 0.75rem;  /* 12px */
  --space-4: 1rem;     /* 16px */
  --space-6: 1.5rem;   /* 24px */
  
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
}
```

---

## Layout-Struktur

### Hauptlayout (Grid)

```
┌─────────────────────────────────────────────────────────────────────┐
│ HEADER (56px)                                                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │             │  │             │  │             │                 │
│  │  DOCUMENT   │  │   EDITOR    │  │ VALIDATION  │                 │
│  │   VIEWER    │  │             │  │             │                 │
│  │    (40%)    │  │    (35%)    │  │    (25%)    │                 │
│  │             │  │             │  │             │                 │
│  └─────────────┘  └─────────────┘  └─────────────┘                 │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ STATUS BAR (32px)                                                    │
└─────────────────────────────────────────────────────────────────────┘
```

### CSS Grid Definition

```css
.app-container {
  display: grid;
  grid-template-rows: 56px 1fr 32px;
  grid-template-columns: 40fr 35fr 25fr;
  height: 100vh;
  gap: var(--space-2);
}
```

---

## Komponenten

### 1. Header

**Elemente (links nach rechts):**

| Element | Typ | Funktion |
|---------|-----|----------|
| Logo | Text + Icon | Branding |
| Dokumentname | Text + Save-Indikator | Zeigt aktuelle Datei |
| Seitennavigation | `< Seite X von Y >` | Mehrseitige Dokumente |
| Thumbnails | Horizontale Scroll-Leiste | Schnellnavigation |
| Upload | Button (primär) | Bild-Upload |
| API Keys | Button (icon) | Key-Verwaltung |
| Export | Button (icon) | Export-Dialog |
| Settings | Button (icon) | Einstellungen |
| Help | Button (icon) | Hilfe/Docs |

**Save-Indikator:**
- 🟢 Grüner Punkt = Gespeichert
- 🟡 Gelber Punkt = Ungespeicherte Änderungen
- ⚪ Grauer Punkt = Kein Dokument

---

### 2. Document Viewer

**Funktionen:**

| Feature | Interaktion | Tastenkürzel |
|---------|-------------|--------------|
| Zoom In | Button / Scroll | `+` / `Ctrl+Scroll` |
| Zoom Out | Button / Scroll | `-` / `Ctrl+Scroll` |
| Fit Width | Button | `W` |
| Fit Page | Button | `F` |
| Pan | Drag mit Maus | – |
| Region auswählen | Draw Region Tool | `R` |

**Bounding Boxes:**

```
Farbe:
- Blau (#58a6ff): Automatisch erkannte Regionen
- Gelb (#ffc107): Aktuell ausgewählte Region
- Rot (#f85149): Problematische Region

Stil:
- Stroke: 2px solid
- Fill: rgba mit 10% Opacity
- Hover: Opacity auf 30%
```

**Minimap:**
- Position: Rechts unten (padding 8px)
- Größe: 120px × 80px
- Zeigt Viewport als weißes Rechteck

---

### 3. Transcription Editor

**Layout:**

```
┌──────────────────────────────────────┐
│ [Editing ○ View]    [↩ Undo] [↪ Redo]│
├──────────────────────────────────────┤
│ 1 │ | Datum | Beschreibung | Betrag |│
│ 2 │ |-------|--------------|--------|│
│ 3 │ | 28. Mai | K. Schmidt | 23 Taler│
│ 4*│ | 28. Mai | [?] Müller | 12 Taler│  ← Gelb markiert
│ 5 │ | 29. Mai | Lieferung Holz | 41 T│
└──────────────────────────────────────┘
          Zeilennummern │ Inhalt
```

**Inline-Marker:**

| Marker | Bedeutung | Darstellung |
|--------|-----------|-------------|
| `[?]` | Unsichere Lesung | Gelber Hintergrund |
| `[illegible]` | Unleserlich | Roter Hintergrund, kursiv |
| `[gap]` | Fehlende Stelle | Grauer Hintergrund |

**Zeilensynchronisation:**
- Klick auf Zeile → Entsprechende Bildregion wird hervorgehoben
- Hover zeigt Vorschau der Bildregion als Tooltip

---

### 4. Validation Panel

**Zwei Sektionen:**

#### 4.1 Regelbasiert (Deterministisch)

```
┌─────────────────────────────────────┐
│ ⚙️ Regelbasiert                      │
├─────────────────────────────────────┤
│ ┃ ✅ Datumsformat korrekt (DD. MM.) │
│ ┃    Zeile 3-7                      │
├─────────────────────────────────────┤
│ ┃ ⚠️ Betragssumme prüfen            │
│ ┃    Zeile 12 – Differenz: 3 Taler  │
│ ┃    ▾ Details                       │
└─────────────────────────────────────┘
```

**Prüfungen:**

| Regel | Beschreibung | Regex/Logik |
|-------|--------------|-------------|
| Datum | DD. Monat Format | `/\d{1,2}\.\s?(Jan\|Feb\|...\|Dez)/` |
| Währung | Taler/Groschen/Pfennig | `/\d+\s?(Taler\|Gr\|Pf)/` |
| Tabelle | Konsistente Spaltenanzahl | Pipe-Count pro Zeile |
| Summen | Additionsprüfung | Spalten-Summenvergleich |

#### 4.2 KI-Einschätzung

```
┌─────────────────────────────────────┐
│ 🤖 KI-Einschätzung                   │
├─────────────────────────────────────┤
│ ┃ ✅ Text-zu-Bild-Konsistenz hoch   │
│ ┃    Konfidenz: Sicher              │
├─────────────────────────────────────┤
│ ┃ ⚠️ Möglicher Lesefehler           │
│ ┃    Zeile 4 – "Müller" oder        │
│ ┃    "Möller"?                      │
│ ┃    ▾ Details                       │
└─────────────────────────────────────┘
```

**Kategorien (keine numerischen Werte!):**

| Kategorie | Icon | Farbe | Bedeutung |
|-----------|------|-------|-----------|
| Sicher | ✅ | Grün | Hohe Übereinstimmung |
| Prüfenswert | ⚠️ | Orange | Experte sollte prüfen |
| Problematisch | ❌ | Rot | Wahrscheinlich fehlerhaft |

**Detail-Expansion:**
- Klick auf "Details" expandiert Karte
- Zeigt: Begründung, Alternative Lesungen, Bildausschnitt

---

### 5. Status Bar

**Elemente (links nach rechts):**

| Element | Inhalt |
|---------|--------|
| Modell-Dropdown | "Gemini 2.0 Flash ▾" |
| Perspektive-Dropdown | "Paläographisch ▾" (siehe unten) |
| Status | "Bereit" / "Analysiere..." / Spinner |
| Letzte Änderung | "16:55" |
| API Status | 🟢 Verbunden / 🔴 Fehler |
| Keyboard Hint | "Ctrl+S speichern" |

**Perspektiven (Dropdown):**

| Perspektive | Prüft |
|-------------|-------|
| Paläographisch | Buchstabenformen, Ligaturen, Abkürzungen |
| Sprachlich | Grammatik, historische Orthographie |
| Strukturell | Tabellenlogik, Verweise, Nummerierung |
| Domänenwissen | Fachtermini, Plausibilität (z.B. Rechnungswesen) |

---

## Interaktionen

### Text-Bild-Synchronisation

```
Aktion                    → Reaktion
─────────────────────────────────────
Klick auf Editor-Zeile    → Bildregion wird gelb markiert
Klick auf Bildregion      → Editor scrollt zur Zeile, Zeile wird gelb
Hover auf Editor-Zeile    → Sanftes Highlight (30% opacity) im Bild
Hover auf Bildregion      → Sanftes Highlight der Zeile
Klick auf Validierung     → Beide: Bild + Editor springen zur Stelle
```

### Keyboard Shortcuts

| Shortcut | Aktion |
|----------|--------|
| `Ctrl + S` | Speichern |
| `Ctrl + Z` | Undo |
| `Ctrl + Shift + Z` | Redo |
| `Ctrl + O` | Dokument öffnen |
| `Ctrl + E` | Export-Dialog |
| `+` / `-` | Zoom In/Out |
| `W` | Fit Width |
| `F` | Fit Page |
| `R` | Region-Tool aktivieren |
| `Esc` | Tool/Dialog abbrechen |

---

## Dialoge & Modals

### Upload-Dialog

```
┌─────────────────────────────────────────┐
│ Dokument hochladen                   ✕ │
├─────────────────────────────────────────┤
│                                         │
│   ┌─────────────────────────────────┐   │
│   │                                 │   │
│   │     📄 Datei hierher ziehen     │   │
│   │     oder klicken zum Auswählen  │   │
│   │                                 │   │
│   └─────────────────────────────────┘   │
│                                         │
│   Unterstützte Formate:                 │
│   JPEG, PNG, TIFF, PDF (max. 20 MB)     │
│                                         │
│   ☐ Bestehende Transkription laden      │
│     [Datei wählen...]                   │
│                                         │
├─────────────────────────────────────────┤
│                    [Abbrechen] [Öffnen] │
└─────────────────────────────────────────┘
```

### API Keys Dialog

```
┌─────────────────────────────────────────┐
│ API Keys verwalten                   ✕ │
├─────────────────────────────────────────┤
│                                         │
│   Google Gemini                         │
│   [••••••••••••••••••••••••] 🟢        │
│                                         │
│   OpenAI                                │
│   [API Key eingeben...        ] ⚪      │
│                                         │
│   Anthropic                             │
│   [API Key eingeben...        ] ⚪      │
│                                         │
│   ℹ️ Keys werden nur lokal im Browser   │
│      gespeichert (LocalStorage).        │
│                                         │
├─────────────────────────────────────────┤
│                    [Abbrechen] [Speichern]│
└─────────────────────────────────────────┘
```

### Export-Dialog

```
┌─────────────────────────────────────────┐
│ Exportieren                          ✕ │
├─────────────────────────────────────────┤
│                                         │
│   Format:                               │
│   ○ Markdown (.md)                      │
│   ○ JSON (.json) – mit Metadaten        │
│   ○ TSV (.tsv) – nur Tabellendaten      │
│                                         │
│   Optionen:                             │
│   ☑ Validierungshinweise einschließen   │
│   ☑ Bildregionen-Koordinaten            │
│   ☐ Originalbild einbetten (Base64)     │
│                                         │
├─────────────────────────────────────────┤
│                  [Abbrechen] [Exportieren]│
└─────────────────────────────────────────┘
```

---

## Fehlerzustände

### Leerer Zustand (Empty State)

```
┌─────────────────────────────────────────┐
│                                         │
│           📄                            │
│                                         │
│     Kein Dokument geladen               │
│                                         │
│     Laden Sie ein Bild hoch, um         │
│     mit der Transkription zu beginnen.  │
│                                         │
│         [Dokument hochladen]            │
│                                         │
└─────────────────────────────────────────┘
```

### Fehler-Toast

```
Position: Oben rechts
Duration: 5 Sekunden (Error), 3 Sekunden (Warning)

┌─────────────────────────────────────┐
│ ❌ API-Fehler                      ✕ │
│    Rate Limit erreicht. Bitte      │
│    warten Sie 60 Sekunden.         │
└─────────────────────────────────────┘
```

### Ladeindikator

```
Position: Über dem betroffenen Panel

┌─────────────────────────────────────┐
│                                     │
│          ⟳ Analysiere...           │
│          Seite 1 von 3             │
│          [████████░░] 80%          │
│                                     │
│          [Abbrechen]                │
│                                     │
└─────────────────────────────────────┘
```

---

## Barrierefreiheit (a11y)

### Kontrastverhältnisse

| Element | Vordergrund | Hintergrund | Ratio | WCAG |
|---------|-------------|-------------|-------|------|
| Body Text | #e6edf3 | #0d1117 | 13.7:1 | AAA |
| Secondary Text | #8b949e | #0d1117 | 6.2:1 | AA |
| Success on Dark | #3fb950 | #161b22 | 5.8:1 | AA |
| Warning on Dark | #d29922 | #161b22 | 5.1:1 | AA |
| Error on Dark | #f85149 | #161b22 | 5.4:1 | AA |

### Triple-Coding für Status

Jeder Validierungsstatus verwendet **drei redundante Signale**:

1. **Farbe** (Grün/Orange/Rot)
2. **Icon** (✅/⚠️/❌)
3. **Position** (Gruppiert in Sektionen)

### Focus States

```css
:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
}
```

### ARIA Labels

```html
<button aria-label="Dokument hochladen">
  <span class="icon-upload"></span>
</button>

<div role="region" aria-label="Dokumentenansicht">
  ...
</div>

<div role="log" aria-live="polite" aria-label="Validierungshinweise">
  ...
</div>
```

---

## Responsive Verhalten

### Breakpoints

| Breakpoint | Layout |
|------------|--------|
| ≥1400px | Drei Spalten (40/35/25) |
| 1024–1399px | Zwei Spalten (Viewer + Editor), Validation als Tab |
| 768–1023px | Tabs: Viewer / Editor / Validation |
| <768px | Mobile: Nicht unterstützt (Hinweis anzeigen) |

### Mobile Hinweis

```
Diese Anwendung ist für Desktop-Browser optimiert.
Bitte verwenden Sie einen Bildschirm mit mindestens 768px Breite.
```

---

## Versionierung

| Version | Datum | Änderungen |
|---------|-------|------------|
| 0.1 | 2026-01-16 | Initiale Spezifikation |
