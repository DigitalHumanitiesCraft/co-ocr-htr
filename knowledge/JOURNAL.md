# Entwicklungsjournal

Chronologische Dokumentation der Projektentwicklung.

---

## 2026-01-16 | Session 1: Initialisierung und Wissenskonsolidierung

**Teilnehmer:** User, Claude Opus 4.5

### Phase 1: Projektinitialisierung

**Auftrag:** Promptotyping-Projekt für coOCR/HTR initialisieren.

**Ergebnis:** Erste Struktur erstellt:
- `README.md` (englisch, kompakt)
- `CLAUDE.md` (Projektkontext)
- `docs/` mit REQUIREMENTS, DESIGN, ARCHITECTURE, DATA
- `src/` (leer)

### Phase 2: Knowledge-Analyse

**Auftrag:** `new_knowledge/` Ordner analysieren (Gemini 3 Material).

**Befund:** Material aus Gemini-Session war umfangreicher:

| Quelle | Inhalt | Bewertung |
|--------|--------|-----------|
| `knowledge/coOCR-HTR Methodische Grundlagen.md` | Wissenschaftliche Basis (LLM-Bias, Critical Expert) | Hoch relevant |
| `docs/design-ui.md` | Detailliertes Design-System | Hoch relevant |
| `docs/architecture.md` | Konkrete Modulstruktur, APIs | Hoch relevant |
| `docs/implementation-plan.md` | Phasen-Plan für Prototyp | Mittel relevant |
| `index.html` | Funktionierender Prototyp (1400 LOC) | Hoch relevant |

**Kernerkenntnisse:**
1. Kategorielle statt numerische Konfidenz (LLM-Bias-Forschung)
2. Validierungs-Perspektiven (Paläographisch, Sprachlich, etc.)
3. Event-basierte Text-Bild-Synchronisation

### Phase 3: Wissenskonsolidierung

**Auftrag:** Alles in gemeinsamen `knowledge/` Ordner integrieren.

**Durchgeführte Aktionen:**

| Aktion | Ergebnis |
|--------|----------|
| `knowledge/INDEX.md` erstellt | Zentrale Navigation, Dokumentenmatrix |
| `knowledge/METHODOLOGY.md` erstellt | Promptotyping, LLM-Bias, Critical Expert |
| `knowledge/DESIGN-SYSTEM.md` erstellt | CSS-Variablen, Komponenten, a11y |
| `knowledge/ARCHITECTURE.md` erstellt | Systemdiagramm, Module, APIs |
| `knowledge/VALIDATION.md` erstellt | Regeln, Perspektiven, Kategorien |
| `knowledge/DATA-SCHEMA.md` erstellt | TypeScript-Interfaces, JSON-Beispiele |
| `new_knowledge/index.html` → `src/index.html` | Prototyp verschoben |
| `CLAUDE.md` aktualisiert | Verweise auf knowledge/ |
| `docs/` gelöscht | Redundant |
| `new_knowledge/` gelöscht | Integriert |

### Finale Projektstruktur

```
coocr-htr/
├── README.md
├── CLAUDE.md
├── knowledge/
│   ├── INDEX.md
│   ├── METHODOLOGY.md
│   ├── DESIGN-SYSTEM.md
│   ├── ARCHITECTURE.md
│   ├── VALIDATION.md
│   ├── DATA-SCHEMA.md
│   └── JOURNAL.md
└── src/
    └── index.html
```

### Offene Punkte

- [ ] Prototyp in modulare Struktur aufteilen (js/, css/)
- [ ] Echte LLM-Integration implementieren
- [ ] LocalStorage/IndexedDB-Persistenz
- [ ] Export-Funktionen (Markdown, JSON, TSV)

---

## Dokumentenbeziehungen

```
METHODOLOGY ─────┬──→ DESIGN-SYSTEM (Farbcodierung)
                 ├──→ ARCHITECTURE (Technologieentscheidungen)
                 └──→ VALIDATION (Kategorien, Perspektiven)

ARCHITECTURE ────┬──→ VALIDATION (Engine-Integration)
                 └──→ DATA-SCHEMA (Storage-Formate)

VALIDATION ──────┬──→ DATA-SCHEMA (ValidationResult)
                 └──→ DESIGN-SYSTEM (UI-Darstellung)
```

---

*Format: YYYY-MM-DD | Session N: Titel*
