---
type: actionplan
created: 2026-01-17
updated: 2026-01-17
status: complete
---

# Aktionsplan: Status

## Sprint 1: Kritische Bugs [x] COMPLETE

| Bug | Problem | Lösung | Status |
|-----|---------|--------|--------|
| 1.1 | LLM-Segmente ohne bounds werden gefiltert | Pseudo-Regionen generieren in `state.js` | [x] |
| 1.2 | PAGE-XML zeigt nur Wortfragmente | `extractLineText()` mit Word-Fallback | [x] |
| 1.3 | Tabellen-Prompt für alle Dokumente | Dual-Prompts + UI-Selector | [x] |
| 1.4 | Validation Panel initial sichtbar | Conditional display in `validation.js` | [x] |

## Sprint 2: Features [x] COMPLETE

| Feature | Beschreibung | Status |
|---------|--------------|--------|
| 2.1 METS-XML Upload | Parser in Upload-UI integriert | [x] |
| 2.2 PAGE-XML Export | Export mit PAGE 2019-07-15 Schema | [x] |
| 2.2b Export-Dialog | XML-Option im UI | [x] |

## Sprint 3: Tests [x] COMPLETE

| Test-Datei | Tests | Abdeckung |
|------------|-------|-----------|
| `llm.test.js` | 28 | Provider, Transcription, Validation |
| `page-xml.test.js` | 26 | Parser, Segments, Metadata |
| `export.test.js` | 32 | Alle Formate, XML-Escaping |
| `validation.test.js` | 32 | Regeln, Marker, Summary |
| **Gesamt** | **118** | |

## Offen (Future)

| Feature | Priorität | Beschreibung |
|---------|-----------|--------------|
| Batch-Transkription | MITTEL | Alle Seiten automatisch |
| Batch-Export ZIP | MITTEL | Multi-Page als ZIP |
| state.test.js | NIEDRIG | State-Transitions |
| storage.test.js | NIEDRIG | Save/Load |

## Refactoring (Optional)

| Datei | LOC | Problem |
|-------|-----|---------|
| `llm.js` | 763 | Provider in einer Datei |
| `viewer.js` | 379 | 330-Zeilen initViewer() |
| `validation.js` | 737 | Legacy-Render + CSS embedded |

**Empfehlung:** Erst wenn Tests vorhanden, dann refactoren.

---
*Aktualisiert: 2026-01-17*
