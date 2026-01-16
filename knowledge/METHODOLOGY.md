---
type: knowledge
created: 2026-01-16
tags: [coocr-htr, methodology, llm-bias]
status: complete
---

# Methodische Grundlagen

Wissenschaftliche Basis fuer Designentscheidungen in coOCR/HTR.

## Promptotyping

Entwicklungsmethodik in vier Phasen:

| Phase | Aktivität | coOCR/HTR-Anwendung |
|-------|-----------|---------------------|
| Preparation | Quellenanalyse, Kontextualisierung | Analyse bestehender OCR/HTR-Workflows |
| Exploration | Iteratives Testen von Modellen/Prompts | VLM-Vergleich, Prompt-Optimierung |
| Distillation | Konsolidierung in Dokumentation | Dieser knowledge/-Ordner |
| Implementation | Umsetzung in Code | src/-Implementierung |

**Prinzip:** Dokumentation vor Code. Iteration durch Dialog. Frühe Validierung.

## Critical Expert in the Loop

Drei Expertise-Komponenten für OCR/HTR-Validierung:

| Komponente | Beschreibung | Beispiel |
|------------|--------------|----------|
| Domänenwissen | Faktische Korrektheit aus Quellenkenntnis | Historische Schriftformen, Terminologie |
| Technisches Modellverständnis | LLM-Charakteristiken (Context, Temperature) | Stärken/Schwächen verschiedener VLMs |
| Metakognitive Wachsamkeit | Reflexion über Blindstellen | Alternative Lesarten, die niemand erkannte |

**Kernaussage:** Expertenwissen ist nicht ersetzbar. Die Maschine unterstützt, der Mensch entscheidet.

## LLM-Judge-Bias

Empirische Evidenz gegen numerische Konfidenzwerte:

| Bias-Typ | Effekt | Messung |
|----------|--------|---------|
| Position Bias | Bevorzugung bestimmter Eingabepositionen | 56-83% Variation bei Position-Swaps |
| Verbosity Bias | Längere Outputs höher bewertet | +5.5 bis +8.2 Prozentpunkte |
| Self-Enhancement | Eigene Outputs bevorzugt | GPT-4: 70.5% Selbst-Präferenz |
| Semantic Perturbation | Äquivalente Variationen → unterschiedliche Scores | 3-77% Performance-Degradierung |

**Kalibrierungsgrenze:** Selbst optimierte Methoden erreichen maximal 47% Fehlerreduktion.

### Konsequenz für coOCR/HTR

| Entscheidung | Begründung |
|--------------|------------|
| Keine numerischen Konfidenzwerte | Suggerieren Präzision, die nicht existiert |
| Kategorielle Abstufungen | sicher / prüfenswert / problematisch |
| Hybride Validierung | LLM-Judge + deterministische Regeln |
| Visuelle Unterscheidung | Regelbasiert vs. KI-basiert erkennbar |
| Multi-Judge-Option | Ensemble bei kritischen Dokumenten |

## Vision-Language Models

### Architektur

```
Vision Encoder (CLIP/SigLIP/ViT)
         ↓
    Projector (Linear/MLP/Q-Former)
         ↓
    LLM Backbone
```

### Emergente OCR/HTR-Fähigkeit

OCR/HTR war kein explizites Trainingsziel. Die Fähigkeit entsteht aus visuellem Reasoning.

**Folge:** Tabellenstrukturen werden gut erkannt (visuelle Muster), ungewohnte Buchstabenformen sind problematisch.

### Dokumentspezifische Grenzen

| Problem | Beschreibung | Schweregrad |
|---------|--------------|-------------|
| Komplexe Layouts | Spaltenrekonstruktion, leere Zellen | Mittel |
| Handschrift | Buchstaben-Zahlen-Verwechslung | Hoch |
| Historische Schriften | Ungewohnte Buchstabenformen | Hoch |
| Tabellen ohne Linien | Implizite Struktur | Mittel |

**Quellenabhängigkeit:** Neuzeitliche Handschriften (19. Jh.) funktionieren gut. Mittelalterliche Schriften erfordern spezialisierte HTR-Modelle.

## Interface-Design-Theorie

### Visual Information Seeking Mantra (Shneiderman)

> "Overview first, zoom and filter, then details on demand."

**coOCR/HTR-Umsetzung:** Seitenübersicht → Einzelseite → Detailansicht eines Eintrags

### Coordinated Multiple Views

Bild, Text und Validierung sind verlinkt:
- Klick auf Textstelle → Bildbereich hervorgehoben
- Klick auf Validierungshinweis → Sprung zur Stelle

### Progressive Disclosure

- Basis-Interface für einfache Korrekturen
- Erweiterte Optionen (Modellvergleich, Batch, Export-Konfiguration) bei Bedarf

### Analytic Provenance

Nachvollziehbarkeit aller Schritte: Modell, Korrekturen, Zeitstempel.

## Zusammenfassung: Design-Prinzipien

| Prinzip | Begründung | Verweis |
|---------|------------|---------|
| Hybride Validierung | LLM-Bias, epistemische Asymmetrie | → [VALIDATION](VALIDATION.md) |
| Kategorielle Konfidenz | Position/Verbosity/Self-Enhancement-Bias | → [DESIGN-SYSTEM](DESIGN-SYSTEM.md) |
| Expert-in-the-Loop | Domänenwissen nicht ersetzbar | → [VALIDATION](VALIDATION.md) |
| Modellvielfalt | Quellenabhängige Erkennungsqualität | → [ARCHITECTURE](ARCHITECTURE.md) |
| Lokale Kontrolle | Datenschutz, Kostenmanagement | → [ARCHITECTURE](ARCHITECTURE.md) |

---

**Quellen:** Promptotyping-Methodik, Critical Expert in the Loop, LLM-Judge-Bias-Forschung, Vision-Language Models, Document AI, Shneiderman (Visual Information Seeking).
