# coOCR/HTR Workbench

> Browser-basiertes Tool für OCR/HTR-Texterkennung historischer Dokumente mit KI-gestützter Validierung

![Status](https://img.shields.io/badge/Status-Prototyp-orange)
![Technologie](https://img.shields.io/badge/Tech-Vanilla%20JS-yellow)
![Lizenz](https://img.shields.io/badge/Lizenz-MIT-green)

## 🎯 Projektübersicht

**coOCR/HTR** ist eine Experimentierumgebung für die Texterkennung (OCR/HTR) historischer Dokumente. Das Tool kombiniert Vision-Language-Modelle mit menschlicher Expertise nach dem "Critical Expert in the Loop"-Prinzip.

### Kernfunktionen

| Feature | Beschreibung |
|---------|-------------|
| **Dokumentenansicht** | Zoom, Pan, Regionenauswahl für Bilddokumente |
| **Transkriptions-Editor** | Markdown-basierter Editor mit Syntax-Highlighting |
| **Hybride Validierung** | Regelbasierte + KI-gestützte Qualitätsprüfung |
| **Multi-Modell-Support** | Gemini, GPT-4, Claude, lokale Modelle |
| **Export** | Markdown, JSON, TSV |

## 🚀 Quickstart

```bash
# Repository klonen
git clone https://github.com/your-org/coocr-htr.git
cd coocr-htr

# Lokalen Server starten (Python)
python -m http.server 8080

# Oder mit Node.js
npx serve .
```

Danach im Browser öffnen: `http://localhost:8080`

## 📁 Projektstruktur

```
coocr-htr/
├── index.html              # Hauptseite
├── css/
│   └── styles.css          # Design System (Dark Mode)
├── js/
│   ├── app.js              # Hauptlogik & Initialisierung
│   ├── imageViewer.js      # Dokumentenansicht mit Zoom/Pan
│   ├── editor.js           # Markdown-Editor
│   ├── validation.js       # Regelbasierte Prüfungen
│   ├── llm-api.js          # LLM-Provider-Integration
│   └── storage.js          # LocalStorage-Persistenz
├── docs/
│   ├── design-ui.md        # UI/UX-Spezifikation
│   └── architecture.md     # Technische Architektur
└── knowledge/              # Methodische Grundlagen
```

## 🔑 API-Konfiguration

API-Keys werden im Browser-LocalStorage gespeichert (keine Server-Speicherung):

1. Klick auf "API Keys" im Header
2. Keys für gewünschte Provider eingeben:
   - **Google Gemini**: [API Key holen](https://aistudio.google.com/app/apikey)
   - **OpenAI**: [API Key holen](https://platform.openai.com/api-keys)
   - **Anthropic**: [API Key holen](https://console.anthropic.com/)

## 📖 Dokumentation

| Dokument | Inhalt |
|----------|--------|
| [Design & UI](docs/design-ui.md) | Interface-Spezifikation, Komponenten, Barrierefreiheit |
| [Architektur](docs/architecture.md) | Technische Architektur, Datenflüsse, APIs |
| [Methodische Grundlagen](knowledge/coOCR-HTR%20Methodische%20Grundlagen.md) | Wissenschaftliche Basis |

## 🎨 Design-Prinzipien

1. **Lokale Kontrolle** – Keine Cloud-Abhängigkeit, alle Daten im Browser
2. **Kategorielle Konfidenz** – Keine irreführenden numerischen Scores
3. **Expert-in-the-Loop** – Mensch validiert, Maschine unterstützt
4. **Progressive Disclosure** – Komplexität bei Bedarf

## 🛠️ Technologie-Stack

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Styling**: Custom Design System (Dark Mode)
- **APIs**: Gemini API, OpenAI API, Anthropic API
- **Persistenz**: LocalStorage, IndexedDB (geplant)
- **Deployment**: Statische Dateien, GitHub Pages kompatibel

## 🤝 Beitragen

Beiträge sind willkommen! Bitte beachten Sie:

1. Fork des Repositories erstellen
2. Feature-Branch anlegen (`git checkout -b feature/mein-feature`)
3. Änderungen committen (`git commit -m 'Add: Mein Feature'`)
4. Branch pushen (`git push origin feature/mein-feature`)
5. Pull Request erstellen

## 📄 Lizenz

MIT License – siehe [LICENSE](LICENSE) für Details.

## 🙏 Danksagungen

Entwickelt im Kontext der Digital Humanities. Basiert auf Erkenntnissen aus:
- Promptotyping-Methodik
- Critical Expert in the Loop-Ansatz
- LLM-Judge-Bias-Forschung

---

**Kontakt**: [project@example.org](mailto:project@example.org)
