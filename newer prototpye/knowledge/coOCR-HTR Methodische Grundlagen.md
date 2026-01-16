
# coOCR/HTR Methodische Grundlagen

## Summary

Dieses Dokument fasst die methodischen Grundlagen fuer das [[coOCR-HTR]]-Projekt zusammen. Es verbindet Erkenntnisse aus dem Vault zu Promptotyping, Critical Expert in the Loop, LLM-Judge-Bias und Interface-Design zu einer kohaerenten methodischen Basis fuer die Entwicklung einer OCR/HTR-Experimentierumgebung.

## Entwicklungsmethodik: Promptotyping

Die Entwicklung von coOCR/HTR folgt der [[Promptotyping]]-Methodik mit vier Phasen:

**Preparation.** Quellenanalyse, Kontextualisierung des Materials, Definition der Erkennungsziele. Bei coOCR/HTR: Analyse der drei Prototypen (DeepSeek, Schliemann, DoCTA), Identifikation gemeinsamer und unterschiedlicher Anforderungen.

**Exploration.** Iteratives Testen verschiedener Modellkonfigurationen und Prompt-Strategien. Bei coOCR/HTR: Vergleich von Vision-Language-Modellen mit spezialisierten HTR-Systemen, Entwicklung von Validierungsperspektiven.

**Distillation.** Konsolidierung der Erkenntnisse in strukturierte Dokumentation. Bei coOCR/HTR: Dieses Dokument und [[coOCR-HTR]] als Wissensbasis.

**Implementation.** Umsetzung in funktionierenden Code. Bei coOCR/HTR: Browser-basiertes Tool mit Vanilla JavaScript, statische Webseite ohne Backend.

Referenz: [[Promptotyping. Methodik und Praxis LLM-gestützter Workflow- und Werkzeugentwicklung in den Digital Humanities. Ein Praxisbericht. (PAPER)]]

## Critical Expert in the Loop

Der [[Critical Expert in the Loop]]-Ansatz definiert drei Expertise-Komponenten, die fuer coOCR/HTR zentral sind:

**Domaenenwissen.** Die Expertin validiert faktische Korrektheit basierend auf Quellenkenntnis. Bei OCR/HTR: Kenntnis der historischen Schriftformen, Sprache, Terminologie des Materials.

**Technisches Modellverstaendnis.** Verstaendnis von LLM-Charakteristiken wie Context Windows, Sycophancy, Temperature. Bei OCR/HTR: Wissen um Staerken und Schwaechen verschiedener Erkennungsmodelle.

**Metakognitive Wachsamkeit.** Reflexion ueber nicht-explorierte Optionen und potenzielle Blindstellen. Bei OCR/HTR: Bewusstsein, dass alternative Lesarten existieren koennten, die weder Mensch noch Maschine erkannt haben.

### Validierungsebenen

Die Critical-Expert-in-the-Loop-Dokumentation beschreibt drei Validierungsebenen, die coOCR/HTR umsetzt:

| Ebene | Methode | coOCR/HTR-Implementierung |
|-------|---------|---------------------------|
| Deterministische Validierung | Schema, Syntax, Referenzintegritaet | Regex fuer Datumsformate, Waehrungen, Tabellenstruktur |
| Expert Validation | Domaenenspezifische Pruefung | Palaeographische, sprachliche, strukturelle Perspektiven |
| Self-Consistency Checks | LLM prueft eigene Outputs | LLM-Judge mit konfigurierbaren Perspektiven |

## LLM-Judge-Bias: Empirische Evidenz

Die Entscheidung fuer kategorielle statt numerische Konfidenzwerte basiert auf empirischer Evidenz zu systematischen Bias-Typen in LLM-as-Judge-Systemen. Die detaillierte Analyse in [[LLM-Judge-Bias und Implikationen für FAIR-SW-Bench]] dokumentiert:

**Position Bias.** LLMs bevorzugen systematisch bestimmte Positionen in der Eingabe. Messungen zeigen 56.6% (ChatGPT) bis 83.2% (Claude) Variation bei Position-Swaps.

**Verbosity Bias.** Laengere Outputs werden unabhaengig von Qualitaet hoeher bewertet. Effektstaerke: +5.5 bis +8.2 Prozentpunkte.

**Self-Enhancement.** Modelle bevorzugen ihre eigenen Outputs. GPT-4 zeigt 70.5% Selbst-Praeferenz.

**Semantic Perturbation.** Semantisch aequivalente Variationen fuehren zu 3-77% Performance-Degradierung.

**Kalibrierungsgrenze.** Selbst optimierte Kalibrierungsmethoden erreichen maximal 47% Fehlerreduktion.

### Konsequenzen fuer coOCR/HTR

Diese Befunde begruenden mehrere Designentscheidungen:

1. Keine numerischen Konfidenzwerte im Interface
2. Kategorielle Abstufungen (z.B. "sicher", "pruefenswert", "problematisch")
3. Kombination von LLM-Judge mit deterministischen Pruefungen
4. Visuelle Unterscheidung zwischen deterministischen und LLM-basierten Hinweisen
5. Option fuer Multi-Judge-Ensemble bei kritischen Dokumenten

## Vision-Language-Modelle: Architektur und Grenzen

Die Modellauswahl in coOCR/HTR basiert auf dem Verstaendnis der Vision-Language-Model-Architektur aus [[Vision-Language Models]]:

**Architektur.** Vision Encoder (CLIP, SigLIP, ViT) → Projector (Linear, MLP, Q-Former) → LLM Backbone.

**Emergente Faehigkeiten.** OCR/HTR waren keine expliziten Trainingsziele. Die Faehigkeit entsteht aus dem allgemeinen visuellen Reasoning. Das erklaert, warum Tabellenstrukturen nativ erfasst werden (visuelle Mustererkennung), waehrend Buchstabenformen bei ungewohnten Schriften problematisch sind.

**Dokumentspezifische Grenzen** aus [[Document AI]]:

| Problemtyp | Beschreibung | Betroffene Prototypen |
|------------|--------------|----------------------|
| Komplexe Layouts | Spaltenrekonstruktion, leere Zellen | Schliemann (teilweise), DoCTA |
| Handschrift | Buchstaben als Zahlen, unkenntliche Woerter | DoCTA (stark), Schliemann (gering) |
| Historische Schriften | Ungewohnte Buchstabenformen | DoCTA (stark) |
| Tabellen | Fehlende Linien, implizite Struktur | Alle Prototypen |

**Quellenabhaengigkeit.** Neuzeitliche Handschriften (19. Jh.) werden gut verarbeitet. Mittelalterliche Schriften erfordern spezialisierte HTR-Modelle. Dies begruendet die Modellvielfalt in coOCR/HTR.

## Context Engineering fuer OCR/HTR

Die Prompt-Gestaltung fuer Vision-Modelle folgt den Prinzipien aus [[Context Engineering]]:

**Token-Effizienz.** Bei ~3,48 EUR/100 Seiten (Gemini 3 Flash) ist Kostenoptimierung relevant. Kompakte Prompts ohne redundante Information.

**Strukturelle Klarheit.** Explizite Instruktionen fuer Layouterkennung: "Erkenne Tabellen als Markdown. Trenne Spalten mit |. Kennzeichne Ueberschriften mit ##."

**Hierarchische Organisation.** Primaere Aufgabe (Erkennung) vor sekundaeren (Strukturierung, Unsicherheitsmarkierung).

**Explizite Metadaten.** Kontext zum Material: Epoche, Sprache, Schrifttyp, erwartete Inhalte.

### Beispiel: Prompt-Struktur fuer Rechnungsbuecher

```
Du bist ein Experte fuer historische Handschriften. Analysiere das Bild eines Rechnungsbuchs.

MATERIAL:
- Epoche: 19. Jahrhundert
- Sprache: Englisch
- Schrift: English Round Hand
- Format: Doppelte Buchfuehrung (Soll links, Haben rechts)

AUFGABE:
1. Transkribiere den Text zeilenweise
2. Erkenne Tabellenstruktur (Datum | Beschreibung | Betrag)
3. Markiere unsichere Lesungen mit [?]

OUTPUT-FORMAT:
Markdown-Tabelle mit | als Spaltentrenner
```

## Interface-Design: Theoretische Grundlagen

Das UI-Design folgt etablierten Prinzipien aus [[Gestaltungskonzepte und theoretische Fundierung für webbasierte Forschungsinterfaces]]:

**Shneiderman: Visual Information Seeking Mantra.** "Overview first, zoom and filter, then details on demand." Bei coOCR/HTR: Seitenuebersicht → Einzelseite → Detailansicht eines Eintrags.

**Coordinated Multiple Views.** Bild, Text und Validierung sind verlinkt. Klick auf Textstelle hebt entsprechenden Bildbereich hervor. Klick auf Validierungshinweis springt zur betroffenen Stelle.

**Progressive Disclosure.** Basis-Interface fuer einfache Korrekturen. Erweiterte Optionen (Modellvergleich, Batch-Verarbeitung, Export-Konfiguration) bei Bedarf.

**Analytic Provenance.** Nachvollziehbarkeit aller Analyseschritte: Welches Modell wurde verwendet? Welche Korrekturen wurden vorgenommen? Wann wurde validiert?

### Referenzimplementierung

Das [[aldersbach|DEPCHA Aldersbach Dashboard]] demonstriert, dass komplexe Browser-Tools mit Vanilla JavaScript in kurzer Zeit (3-8h) entwickelbar sind:

- Frontend-only ohne Framework-Dependencies
- GitHub Pages Deployment (zero infrastructure)
- Client-side Parsing
- Responsive Design
- Multiple Views mit Koordination
- Export-Funktionen

## Integration in Digital Edition Workflows

coOCR/HTR ist als Komponente in groessere [[Digital Edition Workflows]] konzipiert:

```
Digitalisierung (ASCSA, TLA, etc.)
    ↓
coOCR/HTR (Texterkennung + Validierung)
    ↓
Export (Markdown, TSV, JSON)
    ↓
Nachgelagerte Workflows:
- TEI-Kodierung (Schliemann: Bookkeeping Ontology)
- NER/Event Extraction (DoCTA: BeNASch)
- Editorische Tiefenerschliessung (ediarum)
```

Der Scope von coOCR/HTR endet beim strukturierten Export. Semantische Annotation, Normdatenverknuepfung und Publikation gehoeren zu projektspezifischen Workflows.

## Zusammenfassung: Methodische Prinzipien

| Prinzip | Begruendung | Implementierung |
|---------|-------------|-----------------|
| Hybride Validierung | LLM-Bias, epistemische Asymmetrie | Deterministische + LLM-Pruefung |
| Kategorielle Konfidenz | Position/Verbosity/Self-Enhancement-Bias | Keine numerischen Scores |
| Expert-in-the-Loop | Domaenenwissen nicht ersetzbar | Konfigurierbare Perspektiven |
| Modellvielfalt | Quellenabhaengige Erkennungsqualitaet | Multiple Provider, lokale Modelle |
| Strukturerhalt | Layoutinformation fuer Downstream-Tasks | JSON mit Positionsdaten |
| Lokale Kontrolle | Datenschutz, Kostenmanagement | Browser-basiert, keine Cloud-Abhaengigkeit |

## Sources

### Vault-Referenzen

- [[Promptotyping]]
- [[Critical Expert in the Loop]]
- [[Context Engineering]]
- [[Vision-Language Models]]
- [[Document AI]]
- [[LLM-Judge-Bias und Implikationen für FAIR-SW-Bench]]
- [[Gestaltungskonzepte und theoretische Fundierung für webbasierte Forschungsinterfaces]]
- [[Digital Edition Workflows]]

### Prototypen-Dokumentation

- [[Projektplanung Schliemann Rechnungsbuecher]]
- [[DoCTA (Hof Herzog Sigmunds)]]
- [[aldersbach]]

## Related

- [[coOCR-HTR]]
- [[Promptotyping MOC]]
- [[Framework zur Bias-Evaluierung in KI gestützter Sozialarbeit]]
