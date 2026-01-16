/**
 * vibing/js/state.js
 * Central State Management
 */

class AppState extends EventTarget {
    constructor() {
        super();
        this.data = {
            image: {
                url: 'assets/mock-document.jpg',
                width: 0,
                height: 0
            },
            regions: [
                { line: 3, x: 10, y: 22, w: 80, h: 5 },
                { line: 4, x: 10, y: 29, w: 80, h: 5 },
                { line: 5, x: 10, y: 36, w: 80, h: 5 },
                { line: 6, x: 10, y: 43, w: 80, h: 5 },
                { line: 7, x: 10, y: 50, w: 80, h: 5 },
                { line: 8, x: 10, y: 57, w: 80, h: 5 },
            ],
            transcription: [
                "| Datum   | Name         | Beschreibung   | Betrag      |",
                "|---------|--------------|----------------|-------------|",
                "| 28. Mai | K. Schmidt   | Eisenwaren     | 23 Taler    |",
                "| 28. Mai | [?] Schmidt  | Pinsel...      | 10 Taler 4 Gr|",
                "| 3. Juni | H. Müller    | Tuchstoff      | 15 Taler 4 Gr|",
                "| 3. Juni | H. Müller    | Tuchstoff      | 15 Taler 4 Gr|",
                "| 4. Juni | Stadtkasse   | [illegible]    | 40 Taler    |",
                "| 5. Juni | Unbekannt    | Lieferung      | [?] Taler   |",
                "|         |              |                |             |",
                "| Total   |              |                | 103 Taler 12 Gr |"
            ],
            zoom: 100,
            selectedLine: null
        };
    }

    getState() {
        return this.data;
    }

    setImage(url) {
        this.data.image.url = url;
        this.dispatchEvent(new CustomEvent('imageChanged', { detail: { url } }));
    }

    setSelection(lineNum) {
        this.data.selectedLine = lineNum;
        this.dispatchEvent(new CustomEvent('selectionChanged', { detail: { line: lineNum } }));
    }

    setZoom(level) {
        this.data.zoom = level;
        this.dispatchEvent(new CustomEvent('zoomChanged', { detail: { zoom: level } }));
    }
}

export const appState = new AppState();
