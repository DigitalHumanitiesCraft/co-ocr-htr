# coOCR/HTR – Implementierungsplan: Clickable Prototype

## Ziel

Erstellung eines **durchklickbaren High-Fidelity-Prototypen**, der:
- ✅ Das vollständige Design umsetzt (Dark Mode, Layout, Komponenten)
- ✅ Alle UI-Interaktionen simuliert (Klicks, Hover, Dialoge)
- ✅ Mit Mock-Daten arbeitet (kein echter API-Call)
- ✅ Im Browser testbar ist (lokal oder GitHub Pages)
- ❌ Keine echte LLM-Integration hat (kommt später)

---

## Phasen-Übersicht

| Phase | Beschreibung | Geschätzte Zeit |
|-------|-------------|-----------------|
| **Phase 1** | Grundgerüst & Design-System | 30 min |
| **Phase 2** | Layout & Header | 20 min |
| **Phase 3** | Document Viewer (mit Mock-Bild) | 25 min |
| **Phase 4** | Transcription Editor | 25 min |
| **Phase 5** | Validation Panel | 20 min |
| **Phase 6** | Dialoge (Upload, API Keys, Export) | 25 min |
| **Phase 7** | Interaktionen & Synchronisation | 20 min |
| **Phase 8** | Polish & Responsive | 15 min |
| **Gesamt** | | **~3 Stunden** |

---

## Phase 1: Grundgerüst & Design-System

### Dateien erstellen

```
vibing/
├── index.html
├── css/
│   ├── variables.css    # CSS Custom Properties
│   └── styles.css       # Haupt-Stylesheet
├── js/
│   └── app.js           # Prototyp-Logik
└── assets/
    └── mock-document.jpg  # Beispiel-Dokument
```

### Aufgaben

- [ ] **1.1** `index.html` mit HTML5-Boilerplate erstellen
- [ ] **1.2** `variables.css` mit Farbpalette, Typografie, Spacing
- [ ] **1.3** `styles.css` mit CSS Reset und Basis-Styles
- [ ] **1.4** Google Fonts einbinden (Inter, JetBrains Mono)
- [ ] **1.5** Mock-Bild für Document Viewer generieren oder einbinden

### Deliverable
✅ Leere dunkle Seite mit korrekten Schriften

---

## Phase 2: Layout & Header

### Aufgaben

- [ ] **2.1** CSS Grid für Hauptlayout (Header, 3-Spalten, Status Bar)
- [ ] **2.2** Header-Komponente:
  - Logo "coOCR/HTR"
  - Dokumentname mit Save-Indikator (grüner Punkt)
  - Seitennavigation `< Seite 15 von 47 >`
  - Buttons: Upload, API Keys, Export, Settings, Help
- [ ] **2.3** Status Bar:
  - Modell-Dropdown (nur UI, keine Funktion)
  - Perspektive-Dropdown
  - Status-Text "Bereit"
  - "Letzte Änderung: 17:08"
  - API-Status-Punkt

### Mock-Daten

```javascript
const MOCK_STATE = {
  documentName: "Rechnungsbuch_1842_S15.jpg",
  currentPage: 15,
  totalPages: 47,
  isSaved: true,
  model: "Gemini 2.0 Flash",
  perspective: "Paläographisch",
  lastChange: "17:08",
  apiStatus: "connected"
};
```

### Deliverable
✅ Vollständiger Header und Status Bar

---

## Phase 3: Document Viewer

### Aufgaben

- [ ] **3.1** Panel-Container mit Titel "Document Viewer"
- [ ] **3.2** Bild-Container (Mock-Dokument anzeigen)
- [ ] **3.3** Bounding Boxes als SVG-Overlay:
  - 5-6 blaue Boxen (automatisch erkannt)
  - 1 gelbe Box (aktuell ausgewählt)
- [ ] **3.4** Toolbar unten:
  - Zoom-Slider (visuell, 50%-200%)
  - Buttons: Fit Width, Fit Page, Draw Region
- [ ] **3.5** Minimap (optional, kann statisches Bild sein)

### Interaktionen (simuliert)

```javascript
// Klick auf Bounding Box → Wird gelb, andere werden blau
// Hover auf Box → Leichtes Aufhellen
// Zoom-Slider → console.log("Zoom: X%")
```

### Mock-Daten

```javascript
const MOCK_REGIONS = [
  { id: 1, x: 50, y: 80, width: 400, height: 30, selected: false },
  { id: 2, x: 50, y: 120, width: 400, height: 30, selected: false },
  { id: 3, x: 50, y: 160, width: 400, height: 30, selected: true },  // ← Gelb
  { id: 4, x: 50, y: 200, width: 400, height: 30, selected: false },
  { id: 5, x: 50, y: 240, width: 400, height: 30, selected: false },
];
```

### Deliverable
✅ Bild mit klickbaren Regionen und Zoom-Controls

---

## Phase 4: Transcription Editor

### Aufgaben

- [ ] **4.1** Panel-Container mit Titel und Toggle "Editing / View"
- [ ] **4.2** Undo/Redo Buttons (nur visuell)
- [ ] **4.3** Editor-Bereich:
  - Zeilennummern links (1-12)
  - Monospace-Text mit Mock-Transkription
  - Zeile 3 gelb hervorgehoben (synchron mit Viewer)
- [ ] **4.4** Inline-Marker stylen:
  - `[?]` → Gelber Hintergrund
  - `[illegible]` → Roter Hintergrund

### Interaktionen (simuliert)

```javascript
// Klick auf Zeile → Zeile wird gelb, sendet Event an Viewer
// Doppelklick → Cursor erscheint (contenteditable, aber ohne Speichern)
```

### Mock-Daten

```javascript
const MOCK_TRANSCRIPTION = `| Datum | Beschreibung | Betrag |
|-------|--------------|--------|
| 28. Mai | K. Schmidt | Eisenwaren | 23 Taler |
| 28. Mai | K. Schmidt | Eisenwaren | 5 Groschen |
| 28. Mai | L. [?] Müller | Kornkauf | 12 Taler |
| 29. Mai | Lieferung von Holz | 41 Taler |
| 29. Mai | [illegible] Ausgabe | 15 Taler |
| 30. Mai | Unbekannte Ausgabe | [?] Taler |`;
```

### Deliverable
✅ Editor mit klickbaren Zeilen und visuellen Markern

---

## Phase 5: Validation Panel

### Aufgaben

- [ ] **5.1** Panel-Container mit Titel "Validierung"
- [ ] **5.2** Sektion "⚙️ Regelbasiert":
  - 2-3 Validierungs-Cards (Grün, Orange)
  - Jede Card: Icon, Text, Zeilenreferenz, "Details" Link
- [ ] **5.3** Sektion "🤖 KI-Einschätzung":
  - 2-3 Validierungs-Cards
  - Visuell unterscheidbar von Regelbasiert
- [ ] **5.4** Expandierbare Details:
  - Klick auf "Details" → Karte expandiert mit Zusatzinfo

### Interaktionen (simuliert)

```javascript
// Klick auf Card → Entsprechende Zeile im Editor wird gelb
// Klick auf "Details" → Card expandiert/kollabiert
```

### Mock-Daten

```javascript
const MOCK_VALIDATIONS = {
  rulebased: [
    { type: 'success', icon: '✅', text: 'Datumsformat korrekt (DD. MM.)', lines: [3,4,5,6,7] },
    { type: 'warning', icon: '⚠️', text: 'Unsichere Transkription [?]', lines: [5], details: 'Der Name könnte auch "Möller" sein.' },
  ],
  ai: [
    { type: 'success', icon: '✅', text: 'Text-zu-Bild-Konsistenz hoch', lines: null },
    { type: 'warning', icon: '⚠️', text: 'Möglicher Lesefehler bei Betrag', lines: [8], details: 'Der Betrag "15 Taler" könnte auch "75 Taler" sein.' },
    { type: 'error', icon: '❌', text: 'Fehlender Spalteneintrag', lines: [9], details: 'Zeile 9 hat nur 3 statt 4 Spalten.' },
  ]
};
```

### Deliverable
✅ Validierungspanel mit klickbaren, expandierbaren Cards

---

## Phase 6: Dialoge

### 6.1 Upload-Dialog

- [ ] Modal-Overlay (dunkel, blur)
- [ ] Dialog-Box mit:
  - Titel "Dokument hochladen"
  - Drag & Drop Zone
  - Unterstützte Formate-Hinweis
  - Checkbox "Bestehende Transkription laden"
  - Buttons: Abbrechen, Öffnen

### 6.2 API Keys Dialog

- [ ] Modal mit:
  - Drei Input-Felder (Gemini, OpenAI, Anthropic)
  - Status-Punkte (🟢/⚪)
  - Sicherheitshinweis
  - Buttons: Abbrechen, Speichern

### 6.3 Export-Dialog

- [ ] Modal mit:
  - Radio-Buttons für Format (Markdown, JSON, TSV)
  - Checkboxen für Optionen
  - Buttons: Abbrechen, Exportieren

### Interaktionen (simuliert)

```javascript
// Klick auf Header-Button → Modal öffnet
// Klick auf Abbrechen oder Overlay → Modal schließt
// Klick auf primären Button → Modal schließt + Toast-Nachricht
```

### Deliverable
✅ Alle drei Dialoge öffnen und schließen

---

## Phase 7: Interaktionen & Synchronisation

### Aufgaben

- [ ] **7.1** Event-System implementieren:
  ```javascript
  const events = new EventTarget();
  events.dispatchEvent(new CustomEvent('lineSelected', { detail: { line: 5 } }));
  ```
- [ ] **7.2** Text-Bild-Synchronisation:
  - Klick auf Editor-Zeile → Region im Viewer wird gelb
  - Klick auf Viewer-Region → Zeile im Editor wird gelb
  - Klick auf Validation-Card → Beide werden aktualisiert
- [ ] **7.3** Hover-Effekte:
  - Hover auf Zeile → Sanftes Highlight der Region
  - Hover auf Region → Sanftes Highlight der Zeile
- [ ] **7.4** Keyboard Shortcuts (für Demo):
  - `Ctrl+S` → Toast "Gespeichert"
  - `+`/`-` → Zoom-Wert ändert sich

### Deliverable
✅ Alle drei Panels sind synchronisiert

---

## Phase 8: Polish & Responsive

### Aufgaben

- [ ] **8.1** Transitions & Animations:
  - Smooth Hover-Transitions (150ms)
  - Dialog fade-in/out
  - Toast slide-in
- [ ] **8.2** Loading States:
  - Skeleton für leeren Zustand
  - "Analysiere..."-Overlay (manuell triggerbar)
- [ ] **8.3** Toast-System:
  - Erfolg: "Gespeichert ✓"
  - Fehler: "API-Fehler"
  - Position: Oben rechts
- [ ] **8.4** Responsive Check:
  - ≥1400px: Vollständig
  - <1024px: Hinweis "Desktop empfohlen"
- [ ] **8.5** Browser-Test:
  - Chrome, Firefox, Edge

### Deliverable
✅ Polierter, testbarer Prototyp

---

## Zusammenfassung: Was funktioniert / Was nicht

### ✅ Funktioniert (im Prototyp)

| Feature | Interaktion |
|---------|-------------|
| Layout | Vollständiges 3-Panel-Design |
| Header | Alle Buttons, Seitennavigation (visuell) |
| Document Viewer | Bild anzeigen, Regionen klicken |
| Editor | Zeilen klicken, Highlighting |
| Validation | Cards klicken, Details expandieren |
| Dialoge | Öffnen, Schließen |
| Synchronisation | Klick in einem Panel → Update in anderen |
| Toasts | Erscheinen bei Aktionen |

### ❌ Funktioniert nicht (Platzhalter)

| Feature | Simulation |
|---------|------------|
| Echter Upload | Klick auf "Öffnen" → Zeigt immer Mock-Bild |
| LLM-API-Call | Klick auf "Analysieren" → Zeigt Mock-Text nach 2s Delay |
| Echtes Editieren | Änderungen werden nicht gespeichert |
| API Keys | Werden nicht gespeichert |
| Export | Zeigt nur Toast "Exportiert" |
| Zoom | Slider bewegt sich, Bild skaliert nicht |

---

## Start-Befehl

Nach Implementierung:

```bash
# Im Projektverzeichnis
cd c:\Users\Chrisi\Downloads\vibing

# Lokalen Server starten
python -m http.server 8080

# Dann im Browser öffnen
# http://localhost:8080
```

---

## Nächste Schritte nach Prototyp

1. **Usability-Test** mit dem Prototypen
2. **Feedback sammeln** zu Layout, Interaktionen, Verständlichkeit
3. **Echte Implementierung** der LLM-Integration
4. **Persistenz** mit LocalStorage/IndexedDB

---

*Erstellt: 2026-01-16*
