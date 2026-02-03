---
type: knowledge
created: 2026-02-03
tags: [coocr-htr, vision, goals]
status: active
---

# Project Vision

## Mission Statement

**coOCR/HTR ist ein browserbasiertes Werkzeug, das Fachexpert*innen dabei unterstuetzt, OCR/HTR-Ergebnisse zu verifizieren, validieren und korrigieren.**

## Kernproblem

Standard-OCR/HTR-Pipelines liefern bei historischen Dokumenten oft fehlerhafte Ergebnisse:
- Ungewoehnliche Schriftformen (Kurrent, Fraktur, historische Handschriften)
- Komplexe Layouts (Tabellen, Marginalia, Streichungen)
- Domänenspezifisches Vokabular (Fachtermini, historische Begriffe)

Diese Fehler erfordern **menschliche Expertise** zur Korrektur - aber die vorhandenen Tools sind oft:
- Komplex und schwer zu bedienen
- Nicht auf den Korrektur-Workflow optimiert
- Ohne KI-Unterstuetzung fuer schwierige Stellen

## Loesung

coOCR/HTR positioniert sich als **Editor-in-the-Loop Werkzeug**:

```
┌─────────────────────────────────────────────────────────────────┐
│                        WORKFLOW                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   [Bild/PAGE-XML]  ──►  [coOCR/HTR]  ──►  [Korrektes OCR/HTR]   │
│                              │                                   │
│                              ▼                                   │
│                     ┌─────────────────┐                         │
│                     │ Expert*in       │                         │
│                     │ - verifiziert   │                         │
│                     │ - validiert     │                         │
│                     │ - korrigiert    │                         │
│                     └─────────────────┘                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Zwei Eingabe-Modi

| Modus | Input | Anwendungsfall |
|-------|-------|----------------|
| **OCR erzeugen** | Bild hochladen | Dokument hat noch keine Transkription |
| **OCR korrigieren** | PAGE-XML hochladen | Transkription existiert (z.B. aus Transkribus) |

### Unterstuetzung durch KI

- **LLM-Transkription**: Fuer schwierige Dokumente, bei denen Standard-OCR versagt
- **Hybrid-Validierung**: Deterministische Regeln + KI-Judge zur Qualitaetspruefung
- **Visuelles Interface**: Synchronisierte Ansicht von Bild, Text und Validierung

## Zielgruppe

| Nutzer*in | Beduerfnis |
|-----------|------------|
| Digital Humanists | OCR-Korrektur fuer Editionsprojekte |
| Archivar*innen | Schnelle Transkription von Bestaenden |
| Historiker*innen | Quellenerschliessung mit KI-Unterstuetzung |
| Citizen Scientists | Niederschwellige Transkriptionsarbeit |

## Erfolgskriterien

**Das Produkt ist fertig, wenn:**

1. **Selbsterklaerend**: Jemand, der das Tool nicht kennt, kann es ohne Anleitung nutzen
2. **Vollstaendiger Workflow**:
   - Eigene Dokumente hochladen (Bild ODER PAGE-XML)
   - OCR erzeugen oder vorhandenes bearbeiten
   - Validieren und korrigieren
   - In nutzbarem Format exportieren (PAGE-XML, TXT, JSON)
3. **Workflow-Integration**: Output kann in anderen Prozessen weiterverwendet werden
4. **Qualitaetssicherung**: "Gutes, korrektes OCR/HTR kommt auf der anderen Seite raus"

## Nicht-Ziele

- Kein Ersatz fuer spezialisierte HTR-Modelle (Transkribus, eScriptorium)
- Keine Batch-Verarbeitung grosser Korpora (Fokus: Einzeldokument-Korrektur)
- Kein Trainingstool fuer eigene Modelle

## Aktueller Status

| Phase | Status | Beschreibung |
|-------|--------|--------------|
| Phase 1: Core Application | [x] | LLM-Integration, Viewer, Editor, Validation |
| Phase 2: Multi-Page & Docs | [x] | Seitennavigation, Help/About Pages |
| Phase 3: Batch-Processing | [ ] | Alle Seiten automatisch transkribieren |
| Phase 4: Polish & Release | [x] | Tests, PAGE-XML Export, UI-Feinschliff |

**Live Demo:** [dhcraft.org/co-ocr-htr](http://dhcraft.org/co-ocr-htr)

## Designprinzipien

| Prinzip | Bedeutung |
|---------|-----------|
| **Expert-in-the-Loop** | Maschine assistiert, Mensch entscheidet |
| **Kategorielle Konfidenz** | sicher/pruefenswert/problematisch statt 0-100% |
| **Konstruktives UI** | Hilft bei der Arbeit, steht nicht im Weg |
| **Workflow-Tool** | Input rein, korrekter Output raus |
| **Zero Dependencies** | Laeuft im Browser, keine Installation |

---

**Referenzen:**
- [METHODOLOGY](METHODOLOGY.md) - Wissenschaftliche Grundlagen
- [IMPLEMENTATION-PLAN](IMPLEMENTATION-PLAN.md) - Technische Roadmap
- [ARCHITECTURE](ARCHITECTURE.md) - Systemarchitektur
