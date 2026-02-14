# Mistral OCR Optimierung

## Beobachtungen

Mistral OCR (`mistral-ocr-latest`) zeigt im Vergleich zu anderen Modellen besondere Eigenschaften:

✅ **Vorteile:**
- Sehr gut und sehr schnell
- Encodiert vorhandene Bilder im Dokument
- Überschriften werden mit Markdown `#` gekennzeichnet

⚠️ **Optimierungspotenzial:**
1. **Bildtags im Output**: Generiert Markdown-Referenzen wie `![img-0.jpeg](img-0.jpeg)` für eingebettete Bilder
2. **Zeilenumbrüche**: Ignoriert Zeilenumbrüche im Fließtext (typisches Markdown-Verhalten)

---

## Problem 1: Bildtags entfernen

### Ziel
Markdown-Bildreferenzen wie `![img-0.jpeg](img-0.jpeg)` aus dem Transkriptions-Output entfernen.

### Lösungsoptionen

#### Option A: `include_image_base64: false` (API-Parameter)
```javascript
const requestBody = {
  model: 'mistral-ocr-latest',
  document: { type: 'image_url', image_url: dataUrl },
  include_image_base64: false  // ← Bilder nicht in Response einbetten
};
```

**Bewertung:**
- ✅ Native API-Unterstützung
- ⚠️ Markdown-Referenzen könnten trotzdem bleiben (zu testen)

---

#### Option B: Post-Processing (Regex-Filter)
```javascript
response = response.replace(/!\[.*?\]\(.*?\)/g, '');
```

**Bewertung:**
- ✅ Einfach und zuverlässig
- ⚠️ Nachgelagerte Verarbeitung

---

#### Option C: `document_annotation_prompt` (Custom Prompt)
```javascript
const requestBody = {
  model: 'mistral-ocr-latest',
  document: { type: 'image_url', image_url: dataUrl },
  document_annotation_prompt: "Extract only text content, ignore embedded images"
};
```

**Bewertung:**
- ✅ Flexible Kontrolle über Output
- ✅ Kann mit Problem 2 kombiniert werden
- ⚠️ Erfordert Testing der Prompt-Wirksamkeit

---

## Problem 2: Zeilenumbrüche erhalten

### Ziel
Original-Zeilenumbrüche aus dem Dokument im Transkriptions-Output beibehalten.

### Hintergrund
Markdown kollabiert Zeilenumbrüche in Fließtext automatisch (zwei Leerzeichen oder `\n\n` für harten Umbruch nötig). Dies ist für OCR/HTR-Transkriptionen problematisch, da die Dokument-Struktur verloren geht.

### Lösungsoptionen

#### Option A: `document_annotation_prompt` ⭐ **EMPFOHLEN**
```javascript
const requestBody = {
  model: 'mistral-ocr-latest',
  document: { type: 'image_url', image_url: dataUrl },
  document_annotation_prompt: "Preserve original line breaks exactly as they appear in the document"
};
```

**Bewertung:**
- ✅ Direkteste Lösung via API
- ✅ Kombinierbar mit Bild-Filterung
- ⚠️ Erfordert Testing (Mistral könnte `\n` beibehalten oder nicht)

---

#### Option B: `bbox_annotation_format` (Layout-Rekonstruktion)
```javascript
const requestBody = {
  model: 'mistral-ocr-latest',
  document: { type: 'image_url', image_url: dataUrl },
  bbox_annotation_format: "json"  // Bounding-Box-Daten anfordern
};
```

**Bewertung:**
- ✅ Präzise Layout-Informationen
- ❌ Komplex (erfordert Parser für Bbox-Daten + Zeilen-Gruppierung)
- ❌ Änderung der Response-Struktur (nicht mehr einfaches Markdown)

---

#### Option C: Post-Processing mit Heuristik
```javascript
// Zeilen < 60 Zeichen → Umbruch beibehalten
// Zeilen >= 60 Zeichen → Zusammenführen mit nächster Zeile
function preserveLineBreaks(text) {
  const lines = text.split('\n');
  // ... Heuristik-Logik
}
```

**Bewertung:**
- ⚠️ Fehleranfällig (keine universelle Heuristik)
- ❌ Funktioniert nicht für kurze Fließtext-Zeilen
- ❌ Nachgelagert, nicht am Ursprung gelöst

---

## Empfohlene Implementierung

### Kombinierter Ansatz via `document_annotation_prompt`

Dies ist die eleganteste Lösung für **beide** Probleme gleichzeitig:

```javascript
async _callMistral(apiKey, model, imageBase64) {
  if (!imageBase64) {
    throw new Error('Mistral OCR requires an image');
  }

  const dataUrl = `data:image/jpeg;base64,${imageBase64}`;

  const requestBody = {
    model,
    document: {
      type: 'image_url',
      image_url: dataUrl
    },
    // ↓ Optimierungs-Parameter
    include_image_base64: false,  // Keine eingebetteten Bilder
    document_annotation_prompt:
      "Extract text content line by line preserving original line breaks. " +
      "Ignore embedded images and image references."
  };

  const response = await fetch('https://api.mistral.ai/v1/ocr', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(CLOUD_TIMEOUT_MS)
  });

  const data = await response.json();
  let text = data.pages?.[0]?.markdown || '';

  // Optional: Fallback-Filter falls Prompt nicht ausreicht
  text = text.replace(/!\[.*?\]\(.*?\)/g, '');

  return text;
}
```

### Vorteile dieses Ansatzes

1. **Native API-Kontrolle**: Nutzt Mistral-eigene Parameter
2. **Kombiniert**: Löst beide Probleme in einem Request
3. **Fallback**: Regex-Filter als Sicherheitsnetz
4. **Testbar**: Kann iterativ verfeinert werden

---

## Testing-Protokoll

Vor Implementierung sollten folgende Szenarien getestet werden:

| Test | Input | Erwarteter Output | Status |
|------|-------|-------------------|--------|
| Bild-Entfernung | Dokument mit eingebetteten Bildern | Kein `![img-X]` im Text | ⏳ Ausstehend |
| Zeilenumbruch-Erhalt | Mehrzeiliges Gedicht/Liste | Originalumbrüche erhalten | ⏳ Ausstehend |
| Fließtext | Prosa-Absatz | Natürlicher Textfluss | ⏳ Ausstehend |
| Überschriften | Dokument mit `#` Headings | Markdown-`#` erhalten | ⏳ Ausstehend |

---

## Nächste Schritte (optional)

1. **Testing**: A/B-Test mit/ohne `document_annotation_prompt`
2. **User-Konfiguration**: Optional in Settings einbaubar
3. **Dokumentation**: In CLAUDE.md + Help-Dialog ergänzen

---

**Status**: Dokumentiert, noch nicht implementiert (2026-02-09)
