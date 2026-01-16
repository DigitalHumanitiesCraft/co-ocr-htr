# Design System

UI/UX-Spezifikation für coOCR/HTR. Alle Werte sind verbindlich.

**Abhängigkeit:** [METHODOLOGY](METHODOLOGY.md) (Begründung für Farbcodierung, Kategorien)

## Farbpalette

### Hintergründe

| Variable | Hex | Verwendung |
|----------|-----|------------|
| `--bg-primary` | `#0d1117` | Haupthintergrund |
| `--bg-secondary` | `#161b22` | Panels |
| `--bg-tertiary` | `#21262d` | Cards, Inputs |
| `--bg-hover` | `#30363d` | Hover-States |

### Text

| Variable | Hex | Verwendung |
|----------|-----|------------|
| `--text-primary` | `#e6edf3` | Haupttext |
| `--text-secondary` | `#8b949e` | Labels, Hints |
| `--text-muted` | `#6e7681` | Deaktiviert, Zeilennummern |

### Status (→ kategorielle Konfidenz)

| Variable | Hex | Kategorie | Icon |
|----------|-----|-----------|------|
| `--success` | `#3fb950` | sicher | ✅ |
| `--warning` | `#d29922` | prüfenswert | ⚠️ |
| `--error` | `#f85149` | problematisch | ❌ |
| `--selection` | `#ffc107` | ausgewählt | - |

### Akzent

| Variable | Hex | Verwendung |
|----------|-----|------------|
| `--accent-primary` | `#58a6ff` | Buttons, Links, Fokus |
| `--accent-hover` | `#79b8ff` | Hover auf Akzent |

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
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-6: 24px;

--radius-sm: 4px;
--radius-md: 8px;
--radius-lg: 12px;
```

## Layout

### Hauptstruktur

```
┌─────────────────────────────────────────────────────────┐
│ HEADER (56px)                                           │
├─────────────────────────────────────────────────────────┤
│ DOCUMENT VIEWER │ EDITOR      │ VALIDATION             │
│ (40%)           │ (35%)       │ (25%)                  │
├─────────────────────────────────────────────────────────┤
│ STATUS BAR (36px)                                       │
└─────────────────────────────────────────────────────────┘
```

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
}
```

### Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| ≥1400px | Drei Spalten (40/35/25) |
| 1024–1399px | Zwei Spalten, Validation als Tab |
| 768–1023px | Tabs: Viewer / Editor / Validation |
| <768px | Nicht unterstützt (Hinweis) |

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
}

.panel-title {
  font-weight: 600;
  font-size: 13px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
```

### Validation Card

```css
.validation-card {
  padding: var(--space-3);
  background: var(--bg-tertiary);
  border-radius: var(--radius-md);
  border-left: 3px solid transparent;
  cursor: pointer;
}

.validation-card.success { border-left-color: var(--success); }
.validation-card.warning { border-left-color: var(--warning); }
.validation-card.error   { border-left-color: var(--error); }
```

### Bounding Box

```css
.bounding-box {
  border: 2px solid var(--accent-primary);
  background: rgba(88, 166, 255, 0.1);
}

.bounding-box.selected {
  border-color: var(--selection);
  background: rgba(255, 193, 7, 0.2);
}
```

### Inline-Marker (Editor)

| Marker | CSS | Bedeutung |
|--------|-----|-----------|
| `[?]` | `background: rgba(255, 193, 7, 0.3)` | Unsichere Lesung |
| `[illegible]` | `background: rgba(248, 81, 73, 0.3); font-style: italic` | Unleserlich |
| `[gap]` | `background: var(--bg-hover)` | Fehlende Stelle |

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

| Aktion | Reaktion |
|--------|----------|
| Klick Editor-Zeile | Bildregion gelb markiert |
| Klick Bildregion | Editor scrollt zur Zeile |
| Hover Editor-Zeile | Sanftes Highlight (30% opacity) im Bild |
| Klick Validation-Card | Bild + Editor springen zur Stelle |

### Keyboard Shortcuts

| Shortcut | Aktion |
|----------|--------|
| `Ctrl+S` | Speichern |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `+` / `-` | Zoom In/Out |
| `W` | Fit Width |
| `F` | Fit Page |
| `Esc` | Abbrechen |

### Transitions

```css
transition: all 0.15s ease;
```

Alle interaktiven Elemente: 150ms Übergang.

---

**Verweis:** Prototyp-Implementierung in `src/index.html`
