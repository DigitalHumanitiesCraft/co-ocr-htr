---
type: knowledge
created: 2026-01-16
tags: [coocr-htr, design-system, css]
status: complete
---

# Design System

UI/UX-Spezifikation fuer coOCR/HTR. Alle Werte sind verbindlich.

**Abhängigkeit:** [METHODOLOGY](METHODOLOGY.md) (Begründung für Farbcodierung, Kategorien)

**Referenz:**
- UI-Mockup analysiert am 2026-01-16
- Prototyp v2 implementiert in `newer prototpye/`

## Farbpalette

### Hintergründe

| Variable | Hex | Verwendung |
|----------|-----|------------|
| `--bg-primary` | `#0d1117` | Haupthintergrund (Body) |
| `--bg-secondary` | `#161b22` | Panels, Sidebar |
| `--bg-tertiary` | `#21262d` | Cards, Inputs, Table Rows |
| `--bg-hover` | `#30363d` | Hover-States |

### Text

| Variable | Hex | Verwendung |
|----------|-----|------------|
| `--text-primary` | `#e6edf3` | Haupttext, Tabellendaten |
| `--text-secondary` | `#8b949e` | Labels, Panel-Titel, Hints |
| `--text-muted` | `#6e7681` | Deaktiviert, Zeilennummern, Timestamps |

### Status (→ kategorielle Konfidenz)

| Variable | Hex | Kategorie | Icon | Verwendung |
|----------|-----|-----------|------|------------|
| `--success` | `#3fb950` | sicher | 🟢 | Validation passed |
| `--warning` | `#d29922` | prüfenswert | 🟡 | Needs review |
| `--error` | `#f85149` | problematisch | 🔴 | Failed/Missing |
| `--selection` | `#ffc107` | ausgewählt | - | Aktive Bounding Box |

**Hinweis:** Im UI werden ausgefüllte Kreise (●) statt Emojis verwendet.

### Akzent

| Variable | Hex | Verwendung |
|----------|-----|------------|
| `--accent-primary` | `#58a6ff` | Links, Fokus, Bounding Boxes |
| `--accent-secondary` | `#1f6feb` | Dunkleres Blau für Interaktionen |
| `--accent-hover` | `#79b8ff` | Hover auf Links |
| `--accent-action` | `#f97316` | Upload-Button, primäre CTAs |

### Z-Index Layers (Neu in v2)

| Variable | Wert | Verwendung |
|----------|------|------------|
| `--z-overlay` | `100` | Overlays, Dropdowns |
| `--z-modal` | `200` | Modal-Dialoge |
| `--z-toast` | `300` | Benachrichtigungen |

## Typografie

```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;

--text-xs: 0.75rem;   /* 12px - Labels */
--text-sm: 0.875rem;  /* 14px - Sekundär */
--text-base: 1rem;    /* 16px - Body */
--text-lg: 1.125rem;  /* 18px - Überschriften */
--text-xl: 1.25rem;   /* 20px - Panel-Titel */
```

**Regel:** Transkriptionstext immer in `--font-mono`.

## Spacing & Radii

```css
/* Spacing - 8er-System */
--space-1: 0.25rem;  /* 4px */
--space-2: 0.5rem;   /* 8px */
--space-3: 0.75rem;  /* 12px */
--space-4: 1rem;     /* 16px */
--space-5: 1.25rem;  /* 20px */
--space-6: 1.5rem;   /* 24px */
--space-8: 2rem;     /* 32px */

/* Border Radii */
--radius-sm: 4px;
--radius-md: 8px;
--radius-lg: 12px;

/* Transitions */
--transition-fast: 150ms ease;
--transition-medium: 300ms ease;
```

## Layout

### Hauptstruktur

```
┌─────────────────────────────────────────────────────────────────────────┐
│ HEADER (56px)                                                           │
│ Logo │ 🟢 Filename │ ◄ 15/47 ► │                    [Upload] │ Icons   │
├─────────────────────┬─────────────────────┬─────────────────────────────┤
│ DOCUMENT VIEWER     │ TRANSCRIPTION       │ VALIDATION                  │
│ (~40%)              │ (~35%)              │ (~25%)                      │
│                     │                     │ ┌─────────────────────────┐ │
│ ┌─────────────────┐ │ # │DATUM│NAME│...│  │ │ ⚙️ RULE-BASED          │ │
│ │                 │ │ 3 │28.Mai│K.Schmidt│ │ │ 🟢 Date Format Correct │ │
│ │  [Bounding      │ │ 4 │28.Mai│[?]Smith │ │ │ 🟡 Sum Check Mismatch  │ │
│ │   Boxes]        │ │ 5 │3.Juni│H.Müller │ │ ├─────────────────────────┤ │
│ │                 │ │ ...                 │ │ │ ✨ AI ASSISTANT        │ │
│ └─────────────────┘ │                     │ │ 🟢 High Confidence      │ │
│     [100%] [+][-]   │                     │ │ 🟡 Ambiguous Reading    │ │
│                     │                     │ │ 🔴 Missing Column       │ │
│                     │                     │ └─────────────────────────┘ │
├─────────────────────┴─────────────────────┴─────────────────────────────┤
│ STATUS BAR (36px)                                                       │
│ Model: Gemini 2.0 Flash ▾ │ Perspective: Paleographic ▾ │ Ready │17:28 │
└─────────────────────────────────────────────────────────────────────────┘
```

### Header-Elemente

| Position | Element | Beschreibung |
|----------|---------|--------------|
| Links | Logo + "coOCR/HTR" | Branding, 16px semibold |
| Mitte-Links | 🟢 + Filename | Dokumentstatus + Name |
| Mitte | ◄ 15/47 ► | Seitennavigation |
| Rechts | [Upload] | Primärer CTA, `--accent-action` |
| Ganz rechts | Icons (4x) | Export, Settings, Help, Profile |

### Status Bar Elemente

| Element | Typ | Beschreibung |
|---------|-----|--------------|
| Model | Dropdown | "Gemini 2.0 Flash", "Claude 3.5", "GPT-4o" |
| Perspective | Dropdown | "Paleographic", "Linguistic", "Structural", "Domain" |
| Status | Text | "Ready", "Processing...", "Error" |
| Last Change | Timestamp | "17:28" |

### CSS Grid

```css
.app {
  display: grid;
  grid-template-rows: 56px 1fr 36px;
  height: 100vh;
}

.main-content {
  display: grid;
  grid-template-columns: 40fr 35fr 25fr;
  gap: var(--space-2);
  padding: var(--space-2);
}
```

### Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| ≥1400px | Drei Spalten (40/35/25) |
| 1024–1399px | Zwei Spalten, Validation als Tab |
| 768–1023px | Tabs: Viewer / Editor / Validation |
| <768px | Mobile-Warnung mit Desktop-Empfehlung |

### Mobile Warning (Implementiert in v2)

```html
<div class="mobile-warning">
  <svg><!-- Monitor Icon --></svg>
  <h2>Desktop Recommended</h2>
  <p>coOCR/HTR is optimized for large screens...</p>
</div>
```

### Glass Morphism (Neu in v2)

```css
.glass {
  background: rgba(22, 27, 34, 0.8);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.glass-panel {
  background: rgba(22, 27, 34, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.05);
}
```

**Verwendung:** Header, Status Bar, Floating Toolbar

## Komponenten

### Panel

```css
.panel {
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
}

.panel-header {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--bg-tertiary);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel-title {
  font-weight: 600;
  font-size: 13px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.panel-badge {
  font-size: 12px;
  color: var(--text-muted);
}
```

### Document Viewer

```css
.document-viewer {
  position: relative;
  overflow: hidden;
  background: var(--bg-tertiary);
}

.document-image {
  max-width: 100%;
  height: auto;
}

.zoom-controls {
  position: absolute;
  bottom: var(--space-4);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: var(--space-2);
  background: var(--bg-secondary);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
}

.zoom-level {
  font-size: 14px;
  color: var(--text-primary);
  min-width: 48px;
  text-align: center;
}
```

### Transcription Table

```css
.transcription-table {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--font-mono);
  font-size: 14px;
}

.transcription-table th {
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  color: var(--text-secondary);
  text-align: left;
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--bg-hover);
}

.transcription-table td {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--bg-tertiary);
  color: var(--text-primary);
}

.transcription-table tr:hover {
  background: var(--bg-hover);
}

.transcription-table .row-number {
  color: var(--text-muted);
  font-size: 12px;
  width: 32px;
}
```

**Spalten für strukturierte Dokumente:**

| Spalte | Breite | Beschreibung |
|--------|--------|--------------|
| # | 32px | Zeilennummer |
| DATUM | auto | Datumsfeld |
| NAME | auto | Personenname |
| BESCHREIBUNG | flex | Hauptinhalt |
| BETRAG | auto | Währung/Wert |

### Validation Panel

Zwei Sektionen mit visueller Trennung:

```css
.validation-section {
  margin-bottom: var(--space-4);
}

.validation-section-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  margin-bottom: var(--space-3);
}

.validation-section-icon {
  font-size: 14px;
}
```

| Sektion | Icon | Inhalt |
|---------|------|--------|
| RULE-BASED | ⚙️ | Deterministische Prüfungen |
| AI ASSISTANT | ✨ | LLM-Einschätzungen |

### Validation Card

```css
.validation-card {
  padding: var(--space-3);
  background: var(--bg-tertiary);
  border-radius: var(--radius-md);
  border-left: 3px solid transparent;
  cursor: pointer;
  margin-bottom: var(--space-2);
}

.validation-card:hover {
  background: var(--bg-hover);
}

.validation-card.success { border-left-color: var(--success); }
.validation-card.warning { border-left-color: var(--warning); }
.validation-card.error   { border-left-color: var(--error); }

.validation-card-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.validation-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.validation-card-title {
  font-weight: 500;
  font-size: 14px;
  color: var(--text-primary);
}

.validation-card-meta {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: var(--space-1);
}

.validation-card-link {
  font-size: 12px;
  color: var(--accent-primary);
  cursor: pointer;
  margin-top: var(--space-2);
}

.validation-card-link:hover {
  text-decoration: underline;
}
```

### Bounding Box / SVG Regions (Implementiert in v2)

```css
/* SVG-basierte Regionen im Document Viewer */
.region-box {
  fill: rgba(88, 166, 255, 0.1);
  stroke: var(--accent-primary);
  stroke-width: 2;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.region-box:hover {
  fill: rgba(88, 166, 255, 0.25);
}

.region-box.selected {
  stroke: var(--selection);
  fill: rgba(255, 193, 7, 0.2);
  stroke-width: 3;
}
```

**Implementierung:** SVG-Overlay über dem Dokument-Bild mit prozentbasierten Koordinaten.

```html
<svg id="regionsOverlay" viewBox="0 0 1024 1024">
  <rect class="region-box" data-line="3" x="10%" y="22%" width="80%" height="5%"/>
</svg>
```

### Inline-Marker (Transcription)

| Marker | CSS | Bedeutung | Klickbar |
|--------|-----|-----------|----------|
| `[?]` | `background: rgba(255, 193, 7, 0.3); padding: 2px 4px; border-radius: 2px;` | Unsichere Lesung | Ja |
| `[illegible]` | `background: rgba(248, 81, 73, 0.3); font-style: italic;` | Unleserlich | Ja |
| `[gap]` | `background: var(--bg-hover);` | Fehlende Stelle | Nein |
| `...` | `color: var(--error);` | Truncated/Abgeschnitten | Ja |

```css
.marker-uncertain {
  background: rgba(255, 193, 7, 0.3);
  padding: 2px 4px;
  border-radius: 2px;
  cursor: pointer;
}

.marker-uncertain:hover {
  background: rgba(255, 193, 7, 0.5);
}
```

## Barrierefreiheit

### Kontrastverhältnisse (WCAG)

| Element | Vordergrund | Hintergrund | Ratio | Level |
|---------|-------------|-------------|-------|-------|
| Body Text | #e6edf3 | #0d1117 | 13.7:1 | AAA |
| Secondary | #8b949e | #0d1117 | 6.2:1 | AA |
| Success | #3fb950 | #161b22 | 5.8:1 | AA |
| Warning | #d29922 | #161b22 | 5.1:1 | AA |
| Error | #f85149 | #161b22 | 5.4:1 | AA |

### Triple-Coding für Status

Jeder Validierungsstatus verwendet drei redundante Signale:

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

## Interaktionen

### Text-Bild-Synchronisation

Dreifache Verknüpfung zwischen allen drei Panels:

| Trigger | Aktion | Reaktion |
|---------|--------|----------|
| Click | Transcription-Zeile | Bounding Box wird gelb, Bild scrollt/zoomt |
| Click | Bounding Box im Bild | Transcription scrollt zur Zeile, Highlight |
| Click | Validation Card | Bild + Transcription springen zur Zeile |
| Hover | Transcription-Zeile | Sanftes Highlight im Bild (20% opacity) |
| Hover | Bounding Box | Transcription-Zeile leicht hervorgehoben |

### Validation-Interaktionen

| Aktion | Element | Reaktion |
|--------|---------|----------|
| Click | Validation Card | Expandiert mit Details |
| Click | "Show Details" Link | Zeigt erweiterte Informationen |
| Click | Zeilenreferenz (z.B. "Line 4") | Springt zu Zeile in allen Panels |

### Marker-Interaktionen

| Aktion | Element | Reaktion |
|--------|---------|----------|
| Click | `[?]` Marker | Öffnet Korrektur-Popover |
| Click | `...` Truncation | Zeigt vollständigen Text |
| Hover | Jeder Marker | Tooltip mit Erklärung |

### Keyboard Shortcuts

| Shortcut | Aktion | Kontext |
|----------|--------|---------|
| `Ctrl+S` | Speichern | Global |
| `Ctrl+Z` | Undo | Transcription |
| `Ctrl+Shift+Z` | Redo | Transcription |
| `+` / `-` | Zoom In/Out | Document Viewer |
| `W` | Fit Width | Document Viewer |
| `F` | Fit Page | Document Viewer |
| `Esc` | Dialog schließen / Deselect | Global |
| `↑` / `↓` | Zeile wechseln | Transcription |
| `Enter` | Zeile bearbeiten | Transcription |

### Transitions

```css
/* Standard */
transition: all 0.15s ease;

/* Bounding Box Highlight */
transition: background 0.1s ease, border-color 0.1s ease;

/* Panel Scroll */
scroll-behavior: smooth;
```

### Zoom Controls

| Button | Icon | Funktion |
|--------|------|----------|
| Zoom Out | `-` | 10% Reduktion |
| Zoom Level | `100%` | Aktueller Wert (klickbar → Reset) |
| Zoom In | `+` | 10% Erhöhung |
| Fit Width | `↔` | Breite anpassen |
| Fit Page | `⬜` | Ganze Seite sichtbar |

---

## Beispiel-Validierungsmeldungen

### Rule-Based

| Status | Titel | Meta |
|--------|-------|------|
| 🟢 | Date Format Correct | Lines 3-7 (DD. Month) |
| 🟡 | Sum Check Mismatch | Line 12 • Diff: 3 Taler |
| 🔴 | Missing Required Field | Line 9 • Column: BETRAG |

### AI Assistant

| Status | Titel | Meta |
|--------|-------|------|
| 🟢 | High Confidence | Overall Document Match |
| 🟡 | Ambiguous Reading | Line 4 • Confidence: Low |
| 🔴 | Missing Column | Line 9 |

---

## Editor Grid (Neu in v2)

Grid-basierter Transcription-Editor mit CSS Grid statt HTML-Tabelle.

```css
.editor-grid-row {
  display: grid;
  grid-template-columns: 32px repeat(4, 1fr);
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  cursor: pointer;
}

.editor-grid-row:hover {
  background: var(--bg-hover);
}

.editor-grid-row.active {
  background: rgba(88, 166, 255, 0.1);
  border-left: 3px solid var(--accent-primary);
}

.line-num {
  color: var(--text-muted);
  font-size: var(--text-xs);
  text-align: right;
}

.editor-cell {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.editor-cell.header {
  font-family: var(--font-sans);
  font-weight: 500;
  text-transform: uppercase;
  color: var(--text-secondary);
  font-size: var(--text-xs);
}
```

---

**Verweis:** Prototyp-Implementierung in `newer prototpye/`
