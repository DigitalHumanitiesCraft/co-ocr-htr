---
type: knowledge
created: 2026-01-16
updated: 2026-01-16
tags: [coocr-htr, design-system, ui-ux]
status: complete
version: 2.1
---

# coOCR/HTR Design System

Version 2.1 — Consolidated and Optimized

---

## 1. Design Philosophy

### Who Uses This Tool

Researchers in Digital Humanities who transcribe and validate historical documents. They work with handwritten sources from the 16th–20th century: letters, account books, diaries, registers. They are experts in their domain but not necessarily in technology.

### Core Principle

> **The AI assists; the human decides.**

The interface positions the user as the expert operating a precision instrument. Every design element serves this relationship.

### Design Goals

| Goal | Implementation |
|------|----------------|
| **Clarity** | Clean hierarchy, consistent spacing, readable typography |
| **Efficiency** | Triple-panel synchronization, keyboard shortcuts, batch processing |
| **Trust** | Triple-coded status (color + icon + position), no false certainty |
| **Focus** | Dark theme reduces distractions, highlights document content |

### Visual Identity

The aesthetic combines scholarly rigor with modern tool design:
- **Primary influence:** Academic publishing, archival interfaces
- **Secondary influence:** Developer tools (information density, keyboard-first)
- **Avoids:** Sterile tech minimalism, decorative historicism

---

## 2. Color System

### Warm Light Theme (Editorial Design)

Inspired by archival/manuscript aesthetic with warm tones. The cream backgrounds evoke historical paper while remaining easy on the eyes for extended work sessions.

#### Background Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-primary` | `#faf8f5` | Page background (warm off-white) |
| `--bg-secondary` | `#ffffff` | Panel backgrounds (pure white) |
| `--bg-tertiary` | `#f5f2ed` | Hover states, inputs |
| `--bg-viewer` | `#f0ebe3` | Document viewer (warm paper-like) |

#### Text Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--text-primary` | `#3d3229` | Body text (dark warm brown) |
| `--text-secondary` | `#8a7e72` | Labels, hints (medium gray-brown) |

#### Brand Colors (Logo/Identity)

| Token | Value | Function |
|-------|-------|----------|
| `--brand-gold` | `#b89850` | Logo gold - warm ochre, identity |
| `--brand-brown` | `#3d3229` | Logo brown - matches text-primary |

**Usage:** Brand colors are for identity elements (logo, about section) and should NOT be used for functional UI states.

#### Accent Colors (Interactive)

| Token | Value | Usage |
|-------|-------|-------|
| `--accent-primary` | `#4a7c9b` | Primary actions, links, active states (muted steel blue) |
| `--accent-secondary` | `#3a6a87` | Hover on primary actions |
| `--selection` | `#e8c547` | Selected region highlight (golden yellow) |

#### Status Colors (Confidence Feedback)

**Rationale:** Muted, archival palette signals status without alarming. Each color has a distinct semantic meaning.

| Token | Value | Meaning | Usage |
|-------|-------|---------|-------|
| `--confident` | `#5a8a5a` | Certain | Validation passed, high confidence (muted forest green) |
| `--uncertain` | `#c4973a` | Review needed | Expert should check (warm amber) |
| `--problematic` | `#b85c4a` | Likely error | Requires correction (muted terracotta) |

**Legacy aliases (for compatibility):**
```css
--success: var(--confident);
--warning: var(--uncertain);
--error: var(--problematic);
```

#### Region Colors (Bounding Boxes)

| Token | Value | Usage |
|-------|-------|-------|
| `--region-stroke` | `#8b7355` | Default region outline (warm sienna) |
| `--region-stroke-hover` | `#6d5a45` | Hover state (darker sienna) |

### Color Function Matrix

| Category | Purpose | Example Colors |
|----------|---------|----------------|
| **Brand** | Identity, logo | Gold, Brown |
| **Accent** | Interactive elements | Steel Blue |
| **Status** | Confidence feedback | Green, Amber, Terracotta |
| **Neutral** | Backgrounds, text | Cream, White, Brown |
| **Region** | Document annotations | Sienna |

### Borders

| Token | Value | Usage |
|-------|-------|-------|
| `--border-subtle` | `rgba(61, 50, 41, 0.04)` | Subtle dividers |
| `--border-muted` | `rgba(61, 50, 41, 0.08)` | Panel sections |
| `--border-default` | `rgba(61, 50, 41, 0.12)` | Panel borders |
| `--border-emphasis` | `rgba(61, 50, 41, 0.2)` | Active elements |

---

## 3. Typography

### Font Stack

```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
```

**Rationale:** Monospace for transcription enables precise character comparison. Sans-serif for interface ensures readability at small sizes.

### Type Scale

| Token | Size | Usage |
|-------|------|-------|
| `--text-xs` | 11px | Panel headers (uppercase), hints |
| `--text-sm` | 13px | Body text, buttons, cards |
| `--text-base` | 14px | Transcription text |
| `--text-lg` | 16px | Dialog titles |
| `--text-xl` | 18px | Section headers |

### Type Styles

| Element | Font | Size | Weight | Additional |
|---------|------|------|--------|------------|
| Panel headers | Inter | 11px | 500 | Uppercase, +0.5px tracking |
| Body text | Inter | 13px | 400 | — |
| Transcription | JetBrains Mono | 14px | 400 | Line-height 1.6 |
| Button labels | Inter | 13px | 500 | — |
| Line numbers | JetBrains Mono | 11px | 400 | 50% opacity |

---

## 4. Spacing

8-point grid system. All spacing values are multiples of 4px.

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | 4px | Tight spacing, icon gaps |
| `--space-2` | 8px | Default padding, gaps |
| `--space-3` | 12px | Panel padding |
| `--space-4` | 16px | Section spacing |
| `--space-6` | 24px | Large gaps |
| `--space-8` | 32px | Panel margins |

---

## 5. Layout

### Three-Panel Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ HEADER (56px)                                                   │
│ Logo                                     Demo │ Upload │ Config │
├───────────────────┬───────────────────┬─────────────────────────┤
│ DOCUMENT VIEWER   │ TRANSCRIPTION     │ VALIDATION              │
│ 40%               │ 35%               │ 25%                     │
│                   │                   │                         │
│ [Document image   │ [Transcribed text │ [Validation results     │
│  with bounding    │  with line        │  grouped by source:     │
│  boxes]           │  numbers]         │  Rules / AI]            │
│                   │                   │                         │
│ ─ 100% +          │                   │                         │
├───────────────────┴───────────────────┴─────────────────────────┤
│ WORKFLOW BAR (32px)                                             │
│ I. Load ─── II. Transcribe ─── III. Validate ─── IV. Export     │
└─────────────────────────────────────────────────────────────────┘
```

### Panel Proportions

| Viewport | Viewer | Transcription | Validation |
|----------|--------|---------------|------------|
| ≥1400px | 40% | 35% | 25% |
| 1200–1399px | 35% | 35% | 30% |
| 900–1199px | Tabs (one panel visible) |
| <900px | Mobile warning |

### Grid Configuration

```css
.app-container {
  display: grid;
  grid-template-rows: 56px 1fr 32px;
  grid-template-columns: 40fr 35fr 25fr;
  gap: 8px;
  padding: 8px;
}
```

### Z-Index Layers

| Layer | Value | Content |
|-------|-------|---------|
| Base | 0 | Panels, content |
| Toolbar | 10 | Zoom controls |
| Overlay | 100 | Dropdowns, menus |
| Modal | 200 | Dialogs |
| Tooltip | 250 | Info tooltips |
| Toast | 300 | Notifications |

---

## 6. Components

### 6.1 Document Viewer

**Purpose:** Display document image with interactive bounding boxes.

**Empty State:**
- Light gray background
- Upload icon (line drawing)
- Text: "Drop image here or click Upload"
- Two buttons: "Load Demo" / "Upload Image"

**Loaded State:**
- Document image centered with shadow
- SVG overlay for bounding boxes
- Zoom toolbar at bottom center

**Zoom Controls:**
```
┌─────────────────────┐
│  −   100%   +       │  (pill-shaped, semi-transparent)
└─────────────────────┘
```

**Bounding Boxes:**

| State | Stroke | Fill | Opacity |
|-------|--------|------|---------|
| Default | `--accent-primary` 1px | transparent | 60% |
| Hover | `--accent-primary` 2px | 10% accent | 100% |
| Selected | `--selection` 2px | 10% selection | 100% |

### 6.2 Transcription Editor

**Two Modes:**

| Mode | Use Case | Layout |
|------|----------|--------|
| `lines` | Prose text (letters, diaries) | Line numbers + full-width text |
| `grid` | Tabular data (account books) | Columns detected from PAGE-XML or pipes |

**Lines Mode:**
```
┌──────────────────────────────────────────┐
│  1   First line of transcribed text...   │
│  2   Second line continues here...       │
│  3   [?] Uncertain reading marked        │
│  4   More text follows...                │
└──────────────────────────────────────────┘
```

**Grid Mode:**
```
┌──────┬────────────┬────────────────┬──────────┐
│  #   │ DATE       │ DESCRIPTION    │ AMOUNT   │
├──────┼────────────┼────────────────┼──────────┤
│  3   │ 28. Mai    │ K. Schmidt     │ 23 Taler │
│  4   │ 28. Mai    │ [?] Müller     │ 12 Taler │
└──────┴────────────┴────────────────┴──────────┘
```

**Row States:**

| State | Background | Border | Additional |
|-------|------------|--------|------------|
| Default | transparent | — | — |
| Hover | `rgba(255,255,255,0.02)` | — | — |
| Selected | `rgba(255,193,7,0.1)` | 2px left `--selection` | — |
| Editing | `rgba(88,166,255,0.1)` | 1px outline `--accent` | Cursor: text |

**Inline Markers:**

| Marker | Style | Meaning |
|--------|-------|---------|
| `[?]` | Amber background (30% opacity), rounded | Uncertain reading |
| `[illegible]` | Red background (30% opacity), italic | Cannot be read |
| `...` | Gray, ellipsis character | Truncated/continues |

### 6.3 Validation Panel

**Two Sections:**

| Section | Icon | Source | Characteristic |
|---------|------|--------|----------------|
| Rule-Based | (gear) | Deterministic rules | Always same result |
| AI Analysis | (diamond) | LLM perspectives | May vary, context-dependent |

**Section Header:**
```
RULE-BASED                    (11px, uppercase, tracking)
```

### 6.4 Validation Card

**Anatomy:**
```
┌─ 3px left border (status color) ──────────────────┐
│                                                   │
│  ● Title of validation result                     │
│    Description text explaining the finding        │
│    Lines 3-7 · paleographic                       │
│    ▸ Show Details                                 │
│                                                   │
└───────────────────────────────────────────────────┘
```

**Card States:**

| State | Background | Interaction |
|-------|------------|-------------|
| Default | transparent | — |
| Hover | `rgba(255,255,255,0.02)` | Cursor: pointer |
| Expanded | Same | Shows details section |

**Status Indicators (Triple-Coded):**

Every validation result uses THREE redundant signals:

| Signal | Confident | Uncertain | Problematic |
|--------|-----------|-----------|-------------|
| **1. Color** | `--confident` | `--uncertain` | `--problematic` |
| **2. Icon** | Checkmark | Question | Exclamation |
| **3. Position** | Success section | Warning section | Error section |

**Perspective Icons:**

| Perspective | Icon | Description |
|-------------|------|-------------|
| Paleographic | Feather | Letter forms, ligatures, abbreviations |
| Linguistic | Speech bubble | Grammar, historical spelling |
| Structural | Grid | Table logic, sums, cross-references |
| Domain | Book | Period-appropriate terms, plausible values |

### 6.5 Workflow Stepper

**Visual Style:** Roman numerals connected by thin line. Scholarly aesthetic.

```
I. Load ─── II. Transcribe ─── III. Validate ─── IV. Export
   ●             ○                  ○               ○
```

**Step States:**

| State | Number Style | Label Style |
|-------|--------------|-------------|
| Inactive | Circle outline, muted | Muted text |
| Active | Filled circle, accent | Accent text, underline |
| Complete | Checkmark, success | Success text |

### 6.6 Dialogs

**Structure:**
```
┌─────────────────────────────────────────┐
│ HEADER                            X     │
├─────────────────────────────────────────┤
│ [Tab 1] [Tab 2] [Tab 3]                 │  (optional)
├─────────────────────────────────────────┤
│                                         │
│ BODY                                    │
│                                         │
├─────────────────────────────────────────┤
│                      [Cancel] [Primary] │
└─────────────────────────────────────────┘
```

**Backdrop:** `rgba(13,17,23,0.9)` with 8px blur.

**Container:**
- Width: 520px (max 90vw)
- Background: `--bg-secondary`
- Border: 1px `--bg-tertiary`
- Border-radius: 12px
- Shadow: `0 16px 48px rgba(0,0,0,0.5)`

### 6.7 Toast Notifications

**Position:** Bottom-right, 16px from edges.

**Structure:**
```
┌─ 3px left border (status color) ──────────────────┐
│  [Icon]  Message text here                    X   │
└───────────────────────────────────────────────────┘
```

**Animation:** Slide in from right, 300ms ease-out.

**Duration:** 4s default, 8s for important messages.

---

## 7. States

### Loading States

**During LLM transcription:**
- Transcription panel: Circular spinner (48px), status text below
- Other panels: 70% opacity dimming
- Status text phases: "Analyzing image..." → "Recognizing text..." → "Structuring content..."

### Error States

Errors appear inline within the affected panel, not as modal dialogs.

| Error | Display | Action |
|-------|---------|--------|
| API unreachable | Red left border, message | "Retry" button |
| Invalid API key | Lock icon, message | "Open Settings" link |
| Image too large | Warning icon, message | "Compress" button |
| Timeout | Clock icon, message | "Retry" button |

### Empty States

| Panel | Message | Visual |
|-------|---------|--------|
| Document Viewer | "Drop image here or click Upload" | Upload icon |
| Transcription | "Transcription appears after analysis" | None |
| Validation | "Validation results appear after transcription" | Checkmark outline |

---

## 8. Interaction

### Synchronization

The three panels are bidirectionally linked. Selection in any panel updates the other two.

```
User clicks line 7 in Transcription
         │
         ▼
    State updates: selectedLine = 7
         │
         ├─────────────────┬─────────────────┐
         ▼                 ▼                 ▼
   Document Viewer    Transcription     Validation
   - Region 7 gets    - Row 7 gets      - Related card
     selection border   selected bg       scrolls into view
   - Scrolls to       - 2px left        - Brief pulse
     show region        border            animation
```

### Keyboard Shortcuts

| Key | Action | Context |
|-----|--------|---------|
| Tab | Move between panels | Global |
| ↑/↓ | Navigate lines | Editor focused |
| Enter | Start editing / Confirm | Editor |
| Escape | Cancel edit / Close dialog | Editor / Dialog |
| Ctrl+Z | Undo | Editor |
| Ctrl+Shift+Z | Redo | Editor |
| N | Next uncertain item | Global |
| P | Previous uncertain item | Global |

### Focus States

All interactive elements show visible focus: 2px outline in `--accent-primary`, 2px offset.

---

## 9. Animation

### Timing

| Type | Duration | Easing |
|------|----------|--------|
| Micro-interactions | 150ms | ease-out |
| Panel transitions | 150ms | ease-out |
| Dialog open/close | 200ms | ease-out |
| Toast slide | 300ms | ease-out |

**Rule:** No animation exceeds 300ms.

### What Animates

- Hover states (background, border)
- Selection highlighting
- Card expansion/collapse
- Loading spinner rotation
- Toast entrance/exit

### What Does Not Animate

- Text editing
- Validation results appearing (instant)
- Error messages (instant)

---

## 10. Accessibility

### Contrast Ratios

All text meets WCAG AA (4.5:1 minimum).

| Element | Foreground | Background | Ratio |
|---------|------------|------------|-------|
| Body text | #e6edf3 | #0d1117 | 14.2:1 |
| Secondary text | #8b949e | #0d1117 | 6.4:1 |
| Confident status | #2d8659 | #161b22 | 4.8:1 |
| Uncertain status | #b8860b | #161b22 | 4.6:1 |
| Problematic status | #a84432 | #161b22 | 5.1:1 |

### Triple Coding

Every validation status uses three redundant signals:
1. **Color** (green/amber/red spectrum)
2. **Icon** (checkmark/question/exclamation)
3. **Position** (grouped in sections)

This ensures accessibility for color-blind users.

### Screen Reader Support

- All images have alt text
- Interactive elements have ARIA labels
- Focus order follows visual layout
- Status changes announced via live regions

---

## 11. Implementation Notes

### CSS Custom Properties

All design tokens defined as CSS custom properties in `:root`. This enables:
- Consistent styling across components
- Easy theme switching (future feature)
- Runtime customization

### No Framework Dependency

Design implementable with vanilla CSS. No Tailwind, no component library required.

### Asset Requirements

| Asset | Format | Size |
|-------|--------|------|
| Inter font | WOFF2 | ~100KB |
| JetBrains Mono font | WOFF2 | ~80KB |
| Icons | Inline SVG | <5KB total |

### File Structure

```
docs/
├── css/
│   ├── variables.css    # All design tokens
│   └── styles.css       # Component styles
├── js/
│   └── ...
└── index.html
```

---

## Changelog

### v2.1 (2026-01-16)
- Consolidated best elements from v2.0 editorial design
- Kept dark theme (better for document focus)
- Adopted muted status colors (less alarming)
- Added triple-coding requirement for status
- Added perspective icons (Feather, Speech, Grid, Book)
- Changed workflow stepper to Roman numerals
- Reduced animation durations (max 300ms)
- Added scholarly design rationale

### v2.0 (2026-01-16)
- Complete redesign proposal (light theme, warm palette)
- New editorial/archival visual identity
- Four validation perspectives with icons

### v1.0 (2026-01-16)
- Initial design system (GitHub Dark inspired)
- Three-panel layout
- Glass morphism effects

---

**References:**
- [METHODOLOGY](METHODOLOGY.md) for categorical confidence rationale
- [ARCHITECTURE](ARCHITECTURE.md) for component implementation
- [VALIDATION](VALIDATION.md) for validation card details
