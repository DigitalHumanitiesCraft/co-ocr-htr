# Umsetzungsplan: Prompt-Architektur & Bibliothek

## Zielbild

Die App trennt technische Pipeline-Logik von domänenspezifischen Prompts:

1. Core in `llm.js` bleibt allgemein gültig (3 Phasen + Datenvertrag).
2. Prompt-Bibliothek liefert Szenario-Profile.
3. User kann pro Phase Prompts überschreiben oder neu schreiben.
4. User-Overrides haben immer Vorrang vor Profil und Defaults.

Prompt-Priorität:
1. User Override (Stage 1/2/3)
2. Gewähltes Prompt-Profil
3. Generischer Default in `llm.js`

## Phase 1: Prompt-Bibliothek einführen

- Neue Datei: `docs/js/config/promptProfiles.js`
- Enthält:
  - Profil-Metadaten (`id`, `label`, `description`)
  - Drei Prompt-Templates je Profil (`stage1`, `stage2`, `stage3`)
  - Helper für Profilauflösung (`getPromptProfileById`, `listPromptProfiles`)
- Startprofile:
  - `generic_default`
  - `medieval_latin_manuscript`
  - `early_modern_letter`

## Phase 2: Generischen Resolver in `llm.js` ergänzen

- Stage-Resolver je Phase:
  - `resolveStagePromptTemplate(stage, promptConfig, fallbackTemplate)`
  - Placeholder-Fallbacks, damit Input immer injiziert wird:
    - Stage 1: Kontext + Script-Hints
    - Stage 2: `{text}`, `{context}`
    - Stage 3: `{text}`, `{context}`, `{previous_issues}`
- `buildTranscriptionPrompt`, `buildPaleographicReviewPrompt`, `buildPhilologicalReviewPrompt` nutzen Resolver.
- Domänenspezifische Inhalte bleiben in Profilen, nicht im Core-Default.

## Phase 3: Prompt-Konfiguration im State

- `docs/js/state.js` erweitern:
  - `promptConfig.profileId`
  - `promptConfig.overrides.stage1|stage2|stage3`
- Neue State-Methoden:
  - `getPromptConfig()`
  - `setPromptProfile(profileId)`
  - `setPromptOverride(stage, prompt)`
  - `clearPromptOverride(stage)`
- Persistenz:
  - Session save/restore inkl. `promptConfig`
  - Rückwärtskompatibel mit bestehenden Sessions

## Phase 4: UI für Profilauswahl + Override

- Validate-Dialog (`docs/index.html`, `docs/js/components/validation.js`):
  - Profilauswahl
  - Stage-2- und Stage-3-Override-Textareas
  - Reset-Buttons je Stage
- Transcribe-Dialog (`docs/index.html`, `docs/js/components/transcription.js`):
  - gleiche Profilauswahl (synchron zum Validate-Dialog)
  - Stage-1-Override-Textarea + Reset
- UI-Verhalten:
  - Änderung speichert sofort in `appState`
  - Hinweis bei aktivem Override

## Phase 5: Pipeline-Wiring

- `docs/js/components/transcription.js`:
  - Übergibt `promptConfig` an `llmService.transcribe(...)`
- `docs/js/services/validation.js`:
  - Übergibt `promptConfig` an Postprocessing-Flow
- `docs/js/services/postprocess.js`:
  - Nimmt `promptConfig` entgegen und reicht an Stage-Builder durch

## Phase 6: Tests & Absicherung

- `docs/tests/llm.test.js`:
  - Resolver-Priorität (override > profile > default)
  - Placeholder-Fallbacks
- `docs/tests/state.test.js`:
  - `promptConfig` persistiert und wird korrekt restored
- `docs/tests/validation.test.js`:
  - `promptConfig` wird an Postprocessing durchgereicht
- Bestehende Tests weiter grün (`lint`, `vitest` gezielt + ggf. full run)

## Akzeptanzkriterien

- User kann ein Profil wählen und pro Stage frei überschreiben.
- Neue User-Prompts deaktivieren effektiv die `llm.js`-Defaults für die jeweilige Stage.
- Ohne Override läuft Profil; ohne Profil läuft generischer Default.
- Keine Regression bei Validation, Apply/Apply All, Export, Batch-Flows.

