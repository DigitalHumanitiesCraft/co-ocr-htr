# coOCR/HTR – Phase 2: Funktionalisierung

Nachdem der High-Fidelity-Prototyp steht und das UI professionalisiert wurde, ist das Ziel von Phase 2, die Anwendung **funktional** zu machen. Wir ersetzen Mock-Daten durch echte Logik.

## Zielsetzung
Verwandlung des visuellen Prototyps in eine **nutzbare Single-Page-Application (SPA)**, die komplett im Browser läuft (Local-First).

---

## Arbeitspakete

### 1. Architektur & State Management
*   [ ] **ES6 Module**: Aufteilen von `app.js` in `state.js`, `viewer.js`, `editor.js`, `ui.js`.
*   [ ] **Central State**: Ein zentrales State-Objekt, das Bilddaten, Transkription und Validierungen hält.
*   [ ] **Reaktivität**: Einfaches Event-System, damit Editor-Updates den Viewer aktualisieren und umgekehrt.

### 2. Echter Datei-Upload
*   [ ] **File Input**: Implementierung des Upload-Dialogs mit `<input type="file">`.
*   [ ] **Image Loading**: Lesen von Bilddateien via `FileReader` (DataURL) und Anzeige im Viewer.
*   [ ] **Reset State**: Zurücksetzen aller Daten bei neuem Bild.

### 3. Funktionaler Editor
*   [ ] **Editable Cells**: Die Grid-Zellen editierbar machen (`contenteditable` oder `<input>`).
*   [ ] **Data Binding**: Änderungen im UI müssen sofort das State-Objekt aktualisieren.
*   [ ] **Row Management**: Hinzufügen/Löschen von Zeilen (z.B. via Kontextmenü oder Buttons).

### 4. Daten-Persistenz
*   [ ] **Local Storage**: Automatisches Speichern des aktuellen Zustands im Browser (`localStorage`).
*   [ ] **Auto-Save**: Speichern nach jeder Änderung (debounce 1s).
*   [ ] **Wiederherstellung**: Beim Neuladen der Seite den letzten Stand laden.

### 5. Export-Funktion
*   [ ] **Markdown Export**: Generierung einer echten .md Datei aus den aktuellen Tabellendaten.
*   [ ] **JSON Export**: Export des kompletten Project-States (für Backups).

---

## Zeitplan (Geschätzt)

| Schritt | Dauer |
|---------|-------|
| 1. Architektur | 20 min |
| 2. Upload | 15 min |
| 3. Editor | 30 min |
| 4. Persistenz | 15 min |
| 5. Export | 10 min |
| **Gesamt** | **ca. 1.5 Stunden** |
