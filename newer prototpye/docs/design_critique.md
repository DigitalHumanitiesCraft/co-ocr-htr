# Design-Analyse & Verbesserungsplan

Basierend auf dem Screenshot (Status Quo) und den Anforderungen an ein "High-End User Interface".

## 1. Transcription Editor (Mitte) – *Größtes Potenzial*
**Beobachtung:**
Die Darstellung als "Raw Markdown" mit Pipe-Zeichen (`|`) wirkt technisch und erzeugt visuelles Rauschen ("Visual Noise"). Es ist schwer, den Textfluss schnell zu erfassen.

**Verbesserungsvorschlag:**
*   **"Hybrid-Table" Rendering:** Statt roher Pipes eine visuelle Tabellenstruktur verwenden, die aber editierbar bleibt.
*   **Schriftart:** Die Monospace-Schrift ist gut für Code, aber für historische Texte oft zu starr.
*   **Vorschlag:** Wechsel zu einer proportionalen Schrift (z.B. Inter) für den Inhalt, aber behalte Monospace für Zahlen/Spalten bei.
*   **Line Numbers:** Diese nehmen Platz weg und sind sehr prominent. Dezentere Farbe wählen.

## 2. Document Viewer (Links)
**Beobachtung:**
Die blauen Region-Boxen liegen "flach" auf dem Bild. Die Fill-Opacity (Füllung) macht den Text darunter schwerer lesbar (Kontrastverlust).

**Verbesserungsvorschlag:**
*   **Hollow Highlights:** Standardmäßig nur Rahmen (Stroke) anzeigen, keine Füllung.
*   **Active State Focus:** Wenn eine Zeile aktiv ist, den *Rest* des Bildes leicht abdunkeln ("Dimming"), statt die aktive Zeile zu übermalen.
*   **Toolbar:** Die Floating Toolbar ist schick, aber schwebt etwas verloren. Ein "Glassmorphism"-Effekt (Blur) würde sie moderner machen.

## 3. Validation Panel (Rechts)
**Beobachtung:**
Die Karten nehmen viel Platz für relativ wenig Inhalt ein. Die Hierarchie zwischen "Regelbasiert" und "AI" ist rein durch Text gelöst.

**Verbesserungsvorschlag:**
*   **Compact Mode:** Die Karten sollten kompakter sein, solange sie nicht ausgeklappt sind.
*   **Icons:** Die Icons (✅, ⚠️) sind Standard-Emojis. Custom SVG-Icons wirken professioneller.
*   **Visual cues:** Ein feiner Hover-Effekt (z.B. Leuchten des linken farbigen Randes) würde die Interaktivität betonen.

## 4. General UI & Atmosphäre (The "Wow" Factor)
**Beobachtung:**
Das Design ist solide "Dark Mode", aber sehr flach (Flat Design). Es fehlt Tiefe.

**Verbesserungsvorschlag:**
*   **Glassmorphism:** Einsatz von `backdrop-filter: blur()` in Headern, Toolbars und Modals für mehr Tiefe.
*   **Subtile Gradienten:** Statt reinem Grau (#0d1117) einen extrem subtilen dunklen Blau- oder fast Schwarz-Verlauf im Hintergrund nutzen.
*   **Borders:** Die Panel-Grenzen sind harte 1px Linien. Weichere Trennung durch Schatten oder nur partielle Borders.

---

## Konkreter Maßnahmen-Plan

1.  **Editor-Makeover:** CSS anpassen, um die Pipes `|` auszublenden und stattdessen CSS-Grid-Linien zu nutzen. Das sieht sauberer aus.
2.  **Glass-Look:** Header und Toolbar erhalten Transparenz & Blur.
3.  **Region-Styling:** Boxen werden subtiler (dünnere Linien, keine Füllung normal, leuchtende Füllung bei Hover).
4.  **Typography Polish:** Labels in Uppercase mit Letter-Spacing, bessere Kontraste bei sekundären Texten.

Soll ich diese Änderungen (besonders den "Editor-Look" und "Glassmorphism") jetzt umsetzen?
