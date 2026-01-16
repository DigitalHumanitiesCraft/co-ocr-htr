---
type: knowledge
created: 2026-01-16
tags: [coocr-htr, navigation, moc]
status: complete
---

# coOCR/HTR Knowledge Base

Zentraler Wissensordner fuer das coOCR/HTR-Projekt. Jedes Dokument hat einen definierten Scope und verweist auf verwandte Dokumente.

## Dokumentenstruktur

```
knowledge/
├── INDEX.md               ← Navigation (dieses Dokument)
├── METHODOLOGY.md         ← Wissenschaftliche Grundlagen
├── DESIGN-SYSTEM.md       ← UI/UX-Spezifikation (inkl. UI-Mockup-Analyse)
├── ARCHITECTURE.md        ← Technische Architektur (inkl. Event-Flows)
├── VALIDATION.md          ← Hybride Validierung (inkl. Panel-Struktur)
├── DATA-SCHEMA.md         ← Datenstrukturen (inkl. Tabellenformat)
├── IMPLEMENTATION-PLAN.md ← Roadmap zur Vollständigkeit (NEU)
└── JOURNAL.md             ← Entwicklungslog
```

## Dokumentenmatrix

| Dokument | Beantwortet | Zielgruppe | Abhängigkeiten |
|----------|-------------|------------|----------------|
| [METHODOLOGY](METHODOLOGY.md) | Warum so? | Alle | - |
| [DESIGN-SYSTEM](DESIGN-SYSTEM.md) | Wie sieht es aus? | UI/Frontend | METHODOLOGY |
| [ARCHITECTURE](ARCHITECTURE.md) | Wie ist es gebaut? | Entwicklung | METHODOLOGY |
| [VALIDATION](VALIDATION.md) | Wie wird geprüft? | Entwicklung | METHODOLOGY, ARCHITECTURE |
| [DATA-SCHEMA](DATA-SCHEMA.md) | Welche Daten? | Entwicklung | ARCHITECTURE |
| [IMPLEMENTATION-PLAN](IMPLEMENTATION-PLAN.md) | Was kommt als nächstes? | Entwicklung | ARCHITECTURE |
| [JOURNAL](JOURNAL.md) | Was wurde gemacht? | Alle | - |

## Kernkonzepte (Schnellreferenz)

| Konzept | Definition | Dokument |
|---------|------------|----------|
| Critical Expert in the Loop | Mensch validiert, Maschine unterstützt | METHODOLOGY |
| Kategorielle Konfidenz | sicher/prüfenswert/problematisch statt 0-100% | METHODOLOGY |
| Hybride Validierung | Deterministisch + LLM-Judge kombiniert | VALIDATION |
| Perspektiven | Paläographisch, Sprachlich, Strukturell, Domäne | VALIDATION |
| Promptotyping | Iterative Entwicklung durch KI-Dialog | METHODOLOGY |
| Dreifach-Synchronisation | Viewer ↔ Transcription ↔ Validation | ARCHITECTURE |
| Tabellarische Transkription | Strukturierte Felder statt Freitext | DATA-SCHEMA |

## UI-Komponenten (Schnellreferenz)

| Komponente | Beschreibung | Dokument |
|------------|--------------|----------|
| Document Viewer | Bild + Bounding Boxes + Zoom | DESIGN-SYSTEM |
| Transcription Table | Spalten: #, DATUM, NAME, BESCHREIBUNG, BETRAG | DESIGN-SYSTEM |
| Validation Panel | Rule-Based + AI Assistant Sektionen | VALIDATION |
| Status Bar | Model, Perspective, Status, Timestamp | DESIGN-SYSTEM |
| Inline-Marker | [?], [illegible], ... | DESIGN-SYSTEM |

## Beziehungen

```
METHODOLOGY ──────────────────────────────────────┐
    │                                             │
    ├──→ DESIGN-SYSTEM                            │
    │        │                                    │
    │        └──→ Farbcodierung für Konfidenz     │
    │                                             │
    ├──→ ARCHITECTURE                             │
    │        │                                    │
    │        ├──→ VALIDATION (ValidationEngine)   │
    │        │                                    │
    │        └──→ DATA-SCHEMA (Transcription)     │
    │                                             │
    └──→ Alle Designentscheidungen begründet ←────┘
```

## Versionierung

| Version | Datum | Änderung |
|---------|-------|----------|
| 1.0 | 2026-01-16 | Initiale Konsolidierung aus docs/ und new_knowledge/ |
| 1.1 | 2026-01-16 | UI-Mockup-Analyse integriert: Dreifach-Synchronisation, Tabellenstruktur, Panel-Layout |
| 1.2 | 2026-01-16 | Prototyp v2 Analyse: AppState mit EventTarget, modulare JS-Architektur, IMPLEMENTATION-PLAN.md |
