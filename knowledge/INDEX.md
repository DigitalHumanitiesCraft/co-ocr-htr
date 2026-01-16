# coOCR/HTR Knowledge Base

Zentraler Wissensordner für das coOCR/HTR-Projekt. Jedes Dokument hat einen definierten Scope und verweist auf verwandte Dokumente.

## Dokumentenstruktur

```
knowledge/
├── INDEX.md           ← Navigation (dieses Dokument)
├── METHODOLOGY.md     ← Wissenschaftliche Grundlagen
├── DESIGN-SYSTEM.md   ← UI/UX-Spezifikation
├── ARCHITECTURE.md    ← Technische Architektur
├── VALIDATION.md      ← Hybride Validierung
└── DATA-SCHEMA.md     ← Datenstrukturen
```

## Dokumentenmatrix

| Dokument | Beantwortet | Zielgruppe | Abhängigkeiten |
|----------|-------------|------------|----------------|
| [METHODOLOGY](METHODOLOGY.md) | Warum so? | Alle | - |
| [DESIGN-SYSTEM](DESIGN-SYSTEM.md) | Wie sieht es aus? | UI/Frontend | METHODOLOGY |
| [ARCHITECTURE](ARCHITECTURE.md) | Wie ist es gebaut? | Entwicklung | METHODOLOGY |
| [VALIDATION](VALIDATION.md) | Wie wird geprüft? | Entwicklung | METHODOLOGY, ARCHITECTURE |
| [DATA-SCHEMA](DATA-SCHEMA.md) | Welche Daten? | Entwicklung | ARCHITECTURE |

## Kernkonzepte (Schnellreferenz)

| Konzept | Definition | Dokument |
|---------|------------|----------|
| Critical Expert in the Loop | Mensch validiert, Maschine unterstützt | METHODOLOGY |
| Kategorielle Konfidenz | sicher/prüfenswert/problematisch statt 0-100% | METHODOLOGY |
| Hybride Validierung | Deterministisch + LLM-Judge kombiniert | VALIDATION |
| Perspektiven | Paläographisch, Sprachlich, Strukturell, Domäne | VALIDATION |
| Promptotyping | Iterative Entwicklung durch KI-Dialog | METHODOLOGY |

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
