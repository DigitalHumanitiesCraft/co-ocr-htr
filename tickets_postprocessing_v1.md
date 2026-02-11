# Task Backlog: Postprocessing v1

Status: DONE (all 22 tickets implemented, feature-flagged)
Scope reference: `knowledge/HTR-POSTPROCESSING.md`

## Aufwandsskala

- `XS`: 0.5 Tag
- `S`: 1 Tag
- `M`: 2-3 Tage
- `L`: 4-5 Tage
- `L+`: 5-7 Tage

## Reihenfolge (Phasen)

1. Phase 1: Contract Hardening
2. Phase 2: Context Extension
3. Phase 3: Prompt + Orchestration + UI Integration
4. Phase 4: Confidence/Marker Alignment
5. Phase 5: QA and Release Gating

Hinweis:
- Phase 1 und Phase 2 bleiben parallelisierbar.
- Dokumentationsupdates sind als Akzeptanzkriterium in allen relevanten Tickets verpflichtend.

---

## Phase 1: Contract Hardening [DONE]

Ziel: Stabiler JSON-Vertrag für Stage-Outputs, kompatibel mit bestehender `LLM Review`-UI.

### PPV1-001: Normalize/Validate Stage Issue Schema [DONE]
- Beschreibung: Parser-Härtung für Stage-2/3 JSON-Outputs (`line`, `text`, `suggestion`, `type`, `explanation`).
- Dateien:
  - `docs/js/services/llm.js`
- Aufwand: `M`
- Abhängigkeiten: keine
- Akzeptanz:
  - Ungültige Felder werden defensiv normalisiert oder als ungültig markiert.
  - Nur erlaubte `type`-Werte passieren ungefiltert.
  - Bestehende `validation.test.js`/`llm.test.js` bleiben grün.
  - Doku-Delta im Ticket-PR enthalten.

### PPV1-002: Extend Issue Metadata (`stage`, `alternatives`, `score`) [DONE]
- Beschreibung: Optionale Metadaten robust durchreichen, ohne bestehende UI zu brechen.
- Dateien:
  - `docs/js/services/llm.js`
  - `docs/js/components/validation.js`
- Aufwand: `S`
- Abhängigkeiten:
  - PPV1-001
- Akzeptanz:
  - UI rendert weiterhin ohne Fehler, auch wenn optionale Felder fehlen.
  - Zusätzliche Felder sind im State verfügbar.
  - Doku-Delta im Ticket-PR enthalten.

### PPV1-003: Unit Tests for Contract Enforcement [DONE]
- Beschreibung: Tests für malformed JSON, unknown issue types, fehlende Pflichtfelder.
- Dateien:
  - `docs/tests/llm.test.js`
  - `docs/tests/validation.test.js`
- Aufwand: `S`
- Abhängigkeiten:
  - PPV1-001
- Akzeptanz:
  - Tests decken Happy Path und Error Path ab.
  - `npx vitest --run` bleibt grün.

---

## Phase 2: Context Extension [DONE]

Ziel: Strukturierte Kontextdaten (Script/Region/Texttyp) ohne Breaking Change.

### PPV1-101: Extend Context State Model (Backward Compatible) [DONE]
- Beschreibung: `scriptType`, `century`, `region`, `languages`, `textType`, `knownText` in Kontextmodell ergänzen.
- Dateien:
  - `docs/js/state.js`
- Aufwand: `S`
- Abhängigkeiten: keine
- Akzeptanz:
  - Alte Sessions mit Legacy-Feldern laden weiterhin.
  - Neue Felder werden gespeichert und wiederhergestellt.

### PPV1-102: Extend Context UI Fields [DONE]
- Beschreibung: Zusätzliche strukturierte Felder im Transcription-Dialog ergänzen.
- Dateien:
  - `docs/index.html`
  - `docs/js/components/context.js`
- Aufwand: `M`
- Abhängigkeiten:
  - PPV1-101
- Akzeptanz:
  - Felder sind editierbar, persistiert und wiederbefüllbar.
  - Keine Regression der bestehenden Context-Felder.

### PPV1-103: Prompt Context Builder v2 + Stage-1 Prompt Enhancement [DONE]
- Beschreibung: Kontextfelder deterministisch in Prompt-Kontext einbauen und Stage-1 explizit um Script-Hints / "do not expand abbreviations" ergänzen.
- Dateien:
  - `docs/js/components/context.js`
  - `docs/js/services/llm.js`
- Aufwand: `M`
- Abhängigkeiten:
  - PPV1-102
- Akzeptanz:
  - Prompt enthält strukturierte Kontextblöcke.
  - Leere Felder erzeugen keinen Rausch im Prompt.
  - Stage-1 Anforderungen aus Spec 6.1 sind explizit im Prompt enthalten.

---

## Phase 3: Prompt + Orchestration + UI Integration [DONE]

Ziel: Stage-2 + Stage-3 als kontrollierter Multi-Stage-Flow mit sichtbarer Herkunft der Vorschläge.

### PPV1-200a: Stage-2 Prompt Design (Paleographic Review) [DONE]
- Beschreibung: Promptmodul für minim disambiguation, long-s/f, c/t, script-type Regeln.
- Dateien:
  - `docs/js/services/llm.js` (Prompt-Builder)
  - optional `docs/js/prompts/*` (neu)
- Aufwand: `M`
- Abhängigkeiten:
  - PPV1-103
- Akzeptanz:
  - Prompt ist versioniert und testbar.
  - Beispielkorpus zeigt reproduzierbar bessere Vorschlagsqualität.

### PPV1-200b: Stage-3 Prompt Design (Philological Review) [DONE]
- Beschreibung: Promptmodul für Morphologie/Syntax-Plausibilität, Formel-Pattern, Abkürzungserweiterung im Review-Modus.
- Dateien:
  - `docs/js/services/llm.js`
  - optional `docs/js/prompts/*` (neu)
- Aufwand: `M`
- Abhängigkeiten:
  - PPV1-103
- Akzeptanz:
  - Output bleibt strikt im Issue-JSON-Vertrag.
  - Prompt verhält sich konservativ (keine stille Normalisierung).

### PPV1-200c: Post-Processing Guardrails (Timeouts/Budget/Backoff) [DONE]
- Beschreibung: Spezifische Limits für Postprocessing (45s pro Call, 90s/Seite, max 2 Zusatzcalls, Retry/Backoff).
- Dateien:
  - `docs/js/services/llm.js`
  - `docs/js/services/validation.js` oder `docs/js/services/postprocess.js`
  - ggf. `docs/js/utils/constants.js`
- Aufwand: `S`
- Abhängigkeiten:
  - PPV1-001
- Akzeptanz:
  - Guardrails gelten nur für Postprocessing-Pfad.
  - Teilfehler führen zu sauberem Fallback, nicht zu Hard-Fail.

### PPV1-201: Add Postprocessing Orchestrator Service (Sequencing + Fallback) [DONE]
- Beschreibung: Sequenzieller Stage-Flow (Stage-2 dann Stage-3) mit Fehlerisolierung.
- Dateien:
  - `docs/js/services/postprocess.js` (neu) oder `docs/js/services/validation.js`
  - `docs/js/services/llm.js`
- Aufwand: `L`
- Abhängigkeiten:
  - PPV1-200a
  - PPV1-200b
  - PPV1-200c
- Akzeptanz:
  - Stage-2-Fehler blockiert Stage-3 nicht.
  - Bei Doppelfehler fallback auf bestehenden Single-Review-Flow.

### PPV1-202: Deterministic Merge Rules for Multi-Stage Issues [DONE]
- Beschreibung: Dedupe/Conflict-Handling für Stage-Ausgaben auf ein `llmJudge`.
- Dateien:
  - `docs/js/services/postprocess.js` oder `docs/js/services/validation.js`
- Aufwand: `M`
- Abhängigkeiten:
  - PPV1-201
- Akzeptanz:
  - Identische Vorschläge dedupliziert.
  - Konflikte werden sichtbar als getrennte Issues behalten.
  - Keine stille Auto-Entscheidung bei Konflikt.

### PPV1-203: Wire Orchestrator into Validation Flow + Feature Flag + Batch Integration [DONE]
- Beschreibung: UI-Workflow (`Validate`, inkl. `validateAllPages`) auf orchestrierten Postprocess-Flow umhängen, gated per Feature Flag.
- Dateien:
  - `docs/js/components/validation.js`
  - `docs/js/services/validation.js`
- Aufwand: `L`
- Abhängigkeiten:
  - PPV1-202
- Akzeptanz:
  - Aktivierter Flag nutzt neuen Flow.
  - Deaktivierter Flag bleibt exakt beim bisherigen Verhalten.
  - Batch-Validation unterstützt den neuen Flow mit Guardrails.

### PPV1-204: Stage Badge Rendering in LLM Review Panel [DONE]
- Beschreibung: Sichtbare Herkunft je Issue (`paleographic` / `philological`) in der UI.
- Dateien:
  - `docs/js/components/validation.js`
  - `docs/css/validation.css`
- Aufwand: `S`
- Abhängigkeiten:
  - PPV1-002
  - PPV1-202
- Akzeptanz:
  - Badge wird nur angezeigt, wenn `stage` vorhanden ist.
  - Keine Regression in bestehender Issue-Interaktion (Apply/Apply All).

### PPV1-205: Stage Toggles in Validation UI [DONE]
- Beschreibung: Optionale Toggles für Stage-2 und Stage-3 (default ON).
- Dateien:
  - `docs/index.html`
  - `docs/js/components/validation.js`
  - `docs/js/services/validation.js`
- Aufwand: `S`
- Abhängigkeiten:
  - PPV1-203
- Akzeptanz:
  - Nutzer kann Stages einzeln aktivieren/deaktivieren.
  - Einstellungen greifen für Single- und Batch-Validation.

### PPV1-206: Persist Pipeline Metadata in Session (optional, recommended) [DONE]
- Beschreibung: Speichern, ob/wie Seite durch Stage-2/3 gelaufen ist, inkl. Timestamp/Version.
- Dateien:
  - `docs/js/state.js`
  - `docs/js/services/storage.js`
- Aufwand: `S`
- Abhängigkeiten:
  - PPV1-203
- Akzeptanz:
  - Session-Restore vermeidet unnötiges Re-Processing.
  - Keine Breaking Changes für alte Sessions.

---

## Phase 4: Confidence and Marker Alignment [DONE]

Ziel: Einheitliche Begriffe und Marker über Pipeline, UI und Export.

### PPV1-301: Confidence Mapping Guardrails [DONE]
- Beschreibung: Expertenwerte (`sure/check-worthy/problematic`) explizit auf `confident/likely/uncertain` mappen.
- Dateien:
  - `docs/js/services/llm.js`
  - `docs/js/services/validation.js`
- Aufwand: `XS-S`
- Abhängigkeiten:
  - PPV1-001
- Akzeptanz:
  - Persistenz nutzt nur kanonische Werte.
  - UI zeigt konsistente Labels.

### PPV1-302: Canonical Marker Enforcement [DONE]
- Beschreibung: Marker auf `[?]`, `[illegible]`, `[...]` begrenzen und bei Abweichung normalisieren.
- Dateien:
  - `docs/js/services/validation.js`
  - ggf. `docs/js/services/llm.js`
- Aufwand: `S`
- Abhängigkeiten:
  - PPV1-001
- Akzeptanz:
  - Rule-based Validation erkennt Marker konsistent.
  - Keine unbeabsichtigten neuen Marker im Runtime-Pfad.

### PPV1-303: Final Docs Consolidation [DONE]
- Beschreibung: README/Knowledge final konsolidieren (zusätzlich zu Ticket-lokalen Doku-Deltas).
- Dateien:
  - `README.md`
  - `knowledge/HTR-POSTPROCESSING.md`
- Aufwand: `XS`
- Abhängigkeiten:
  - PPV1-301
  - PPV1-302
- Akzeptanz:
  - Dokumentation entspricht finalem Code-Verhalten.

---

## Phase 5: QA and Release Gating [DONE]

Ziel: Testbarkeit, Browser-Absicherung und kontrollierter Rollout.

### PPV1-401: Unit/Integration Test Coverage for Stages + Merge [DONE]
- Beschreibung: Tests für Stage-Parsing, Merge-Konflikte, Fallback-Verhalten.
- Dateien:
  - `docs/tests/validation.test.js`
  - `docs/tests/llm.test.js`
  - `docs/tests/*integration*.test.js` (neu/erweitern)
- Aufwand: `M`
- Abhängigkeiten:
  - PPV1-203
  - PPV1-205
- Akzeptanz:
  - Abdeckung aller Merge-Regeln.
  - Error-/Fallback-Fälle reproduzierbar getestet.

### PPV1-402: Playwright Setup + E2E for Apply/Diff/Undo/Export [DONE]
- Beschreibung: Playwright-Infrastruktur (falls nicht vorhanden) und kritische HITL-Flows.
- Dateien:
  - `docs/tests/e2e/*` (neu)
  - Playwright config (neu)
- Aufwand: `M-L`
- Abhängigkeiten:
  - PPV1-203
  - PPV1-205
- Akzeptanz:
  - E2E deckt: Validate -> Apply -> Diff -> Undo -> Apply All -> Export.
  - Trace/Screenshots bei Fehlern.

### PPV1-403: Rollout Checklist and Go/No-Go Review [DONE]
- Beschreibung: Reiner Rollout-/Freigabe-Checkpoint (Feature Flag wurde bereits in PPV1-203 umgesetzt).
- Dateien:
  - `knowledge/HTR-POSTPROCESSING.md`
  - Release checklist artifact
- Aufwand: `XS-S`
- Abhängigkeiten:
  - PPV1-401
  - PPV1-402
- Akzeptanz:
  - Freigabekriterien dokumentiert und abgehakt.

---

## Kritischer Pfad

1. PPV1-001 -> PPV1-002 -> PPV1-003  
2. PPV1-101 -> PPV1-102 -> PPV1-103  
3. PPV1-200a + PPV1-200b + PPV1-200c -> PPV1-201 -> PPV1-202 -> PPV1-203 -> PPV1-205  
4. PPV1-204 (parallel nach PPV1-202)  
5. PPV1-301 + PPV1-302 -> PPV1-303  
6. PPV1-401 + PPV1-402 -> PPV1-403

## Gesamtaufwand (grob, revidiert)

- Phase 1: `M + S + S` -> ca. 4-5 Tage
- Phase 2: `S + M + M` -> ca. 5-7 Tage
- Phase 3: `M + M + S + L + M + L + S + S + S` -> ca. 13-17 Tage
- Phase 4: `XS-S + S + XS` -> ca. 2-3 Tage
- Phase 5: `M + M-L + XS-S` -> ca. 6-8 Tage

Gesamt: ca. 28-38 Arbeitstage (1 Person, inkl. Test/Debug, ohne externe Review-Wartezeit).
