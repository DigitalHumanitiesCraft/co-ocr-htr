---
type: knowledge
created: 2026-02-03
updated: 2026-02-03
tags: [coocr-htr, models, ocr, htr, vlm, external-validation]
status: active
---

# OCR/HTR Model Landscape

Current state of OCR/HTR models relevant for coOCR/HTR (as of February 2026).

## External Validation

Erkenntnisse aus der Digital Humanities Community (2026-02):

- Gemini 3 Pro führt bei Closed Models "by a long way"
- LightOnOCR ist aktuell State-of-the-Art bei Open Source
- DeepSeek OCR 2 "works okay for simple layouts"
- Layout-Analyse als separater Schritt verbessert Genauigkeit erheblich
- Agentic Vision Mode relevant für komplexe Layouts
- HTR (Handschrift) bleibt anspruchsvoller als OCR (Druck) über alle Modelle hinweg

---

## Model Comparison Matrix

### Closed/Commercial Models

| Model | Strengths | Weaknesses | HTR Quality | Notes |
|-------|-----------|------------|-------------|-------|
| **Gemini 3 Pro** | Best overall accuracy, HTR breakthrough, complex layouts | Cost, API dependency | Excellent | "Solves" English HTR (18th-19th c.) |
| **Gemini 3 Flash** | Fast, cost-effective, Agentic Vision | Less accurate than Pro | Good | 3x faster, 4x cheaper than Pro |
| GPT-4o | Good semantic understanding, handwriting | Less layout-aware | Good | Better for semantic context |
| Claude | Good reasoning | Not OCR-specialized | Moderate | Better for validation than transcription |

### Open Source Models

| Model | Parameters | Strengths | Weaknesses | License |
|-------|------------|-----------|------------|---------|
| **LightOnOCR-2** | 1B | SotA on OlmOCR-Bench (83.2), fastest | Less tested on HTR | Apache 2.0 |
| **dots.ocr** | 1.7B | 100+ languages, excellent layout | Slower than LightOnOCR | MIT |
| DeepSeek OCR 2 | 3B | Structure preservation, local | Handwriting limitations | Open |
| PaddleOCR-VL | 0.9B | Multilingual | Slower | Apache 2.0 |

### Performance Benchmarks (OlmOCR-Bench)

| Model | Score | Speed (pages/s) | Notes |
|-------|-------|-----------------|-------|
| LightOnOCR-2 | 83.2 | 5.71 | Best accuracy + speed |
| dots.ocr | ~82 | 1.14 | Best multilingual |
| DeepSeek OCR 2 | ~78 | 3.3 | Good for simple layouts |

---

## Gemini 3 Details

### Pro vs Flash Decision Matrix

| Use Case | Recommended | Rationale |
|----------|-------------|-----------|
| Historical handwriting (HTR) | Pro | Significantly better accuracy |
| Complex multi-column layouts | Pro | Better layout understanding |
| Simple printed documents | Flash | Cost-effective, sufficient quality |
| Batch processing | Flash | 3x faster, 4x cheaper |
| Prototyping/testing | Flash | Lower cost iteration |

### Agentic Vision Mode (Flash)

New capability combining visual reasoning with code execution:

**Think - Act - Observe Loop:**
1. **Think**: Analyzes request, formulates multi-step plan
2. **Act**: Generates Python code to zoom, crop, annotate
3. **Observe**: Re-examines transformed image

**Benefits:**
- 5-10% quality boost on vision benchmarks
- Reduced hallucinations
- Better for high-resolution documents
- Can zoom into regions of interest

**Activation:** Requires explicit prompt or code execution enabled in API.

**Relevance for coOCR/HTR:** Could improve recognition of dense documents, small text, or damaged areas by allowing the model to "investigate" problematic regions.

### HTR Breakthrough (Pro)

Research finding (Generative History, 2025):

> "Sixty years after IBM's first HTR system, Gemini 3 Pro has solved HTR on English language texts. By 'solved' we don't mean absolute perfection, but that Gemini 3 consistently produces text with error rates comparable to the very best humans."

**Test corpus:** 50 English documents, 18th-19th century, including letters, legal documents, meeting transcriptions, memorandums, journal entries.

**Implication:** For English historical documents, Gemini 3 Pro may reduce the need for specialized HTR models like Transkribus.

---

## LightOnOCR-2 Details

Current state-of-the-art open source OCR model.

### Architecture
- Vision Transformer encoder (Pixtral-based)
- Lightweight text decoder (Qwen3-based)
- Distilled from high-quality open VLMs

### Key Features
- End-to-end (no external OCR pipeline)
- Layout-aware text extraction
- Handles tables, receipts, forms, multi-column, math notation
- Compact variants for European languages (32k/16k vocab)

### Performance vs Competitors
- 6.49x faster than dots.ocr
- 2.67x faster than PaddleOCR-VL
- 1.73x faster than DeepSeek OCR
- 9x smaller than comparable approaches

### Integration
- Supported in vLLM v0.11.1+
- Available on Hugging Face: `lightonai/LightOnOCR-2-1B`
- Can run locally via Ollama (requires conversion)

### Limitation
- Less tested on historical handwriting (HTR)
- Optimized for document parsing, not manuscript transcription

---

## dots.ocr Details

Multilingual document parser with excellent layout detection.

### Key Differentiator
Single VLM handles everything:
- Layout detection
- Text parsing
- Reading order
- Formula recognition

No multi-model pipeline required.

### Performance
- 100+ languages supported
- SOTA on multilingual documents
- Error rates nearly halved vs competitors on low-resource languages
- Formula recognition comparable to 72B models

### Availability
- GitHub: `rednote-hilab/dots.ocr`
- Hugging Face: `rednote-hilab/dots.ocr`
- MIT License

---

## DeepSeek OCR 2 Limitations

### Confirmed Weaknesses
- **Handwriting:** Not a core focus; "performance remains limited compared to specialized cursive OCR tools"
- **Complex layouts:** "Works okay for simple layouts" (community feedback)
- **Historical scripts:** Unfamiliar letter forms problematic

### When to Use
- Printed documents with clear structure
- Local/offline processing requirement
- Privacy-sensitive documents (runs locally)
- Batch processing of simple documents

### When to Avoid
- Handwritten documents (use Gemini Pro or specialized HTR)
- Complex multi-column layouts (use dots.ocr or Gemini)
- Low-resource languages (use dots.ocr)

### Optimization Tips
- Capture at 300 DPI or higher
- Avoid glass reflections
- Denoise lightly and deskew
- Use higher token/vision preset for faint text

---

## Recommendations for coOCR/HTR

### Implemented (2026-02-03)

| Action | Status |
|--------|--------|
| Gemini 3 Pro as model option | [x] Done |
| Model Selection Guide in UI | [x] Done |
| DeepSeek OCR 2 + LightOnOCR-2 in Ollama options | [x] Done |

### Future Considerations

| Action | Priority | Effort |
|--------|----------|--------|
| Agentic Vision integration | Medium | Medium |
| LightOnOCR-2 Ollama conversion guide | Medium | Low |
| Layout analysis pre-step | Low | High |
| Multi-model ensemble | Low | High |

### Model Selection Guide (implemented in UI)

```
Is it handwritten?
├─ Yes → Use Gemini 3 Pro
└─ No (printed)
    ├─ Complex layout? → Gemini 3 Pro or dots.ocr
    ├─ Simple layout, need speed? → Gemini 3 Flash or DeepSeek OCR
    └─ Privacy/offline required? → DeepSeek OCR (Ollama) or LightOnOCR
```

---

## Implementation Concepts

### Agentic Vision (Future)

**Konzept:** Gemini 3 Flash kann Bilder aktiv untersuchen statt nur passiv zu analysieren.

**Think-Act-Observe Loop:**
```
1. THINK: Modell analysiert Anfrage, plant mehrstufige Untersuchung
2. ACT: Modell generiert Python-Code zum Zoomen, Croppen, Annotieren
3. OBSERVE: Transformiertes Bild wird neu analysiert
4. REPEAT: Bis ausreichende Klarheit erreicht
```

**Potenzielle Anwendungsfaelle in coOCR/HTR:**
- Automatisches Zoomen auf unleserliche Stellen
- Segmentierung komplexer Layouts
- Qualitaetsverbesserung bei beschaedigten Dokumenten
- Verifikation unsicherer Lesungen durch Re-Analyse

**Technische Umsetzung:**
```javascript
// Konzept: Agentic Vision API-Aufruf
const requestBody = {
  contents: [{ parts }],
  generationConfig: {
    temperature: 1.0,
    maxOutputTokens: 8192
  },
  // Code Execution aktivieren fuer Agentic Vision
  tools: [{
    codeExecution: {}
  }]
};
```

**Voraussetzungen:**
- Gemini API mit Code Execution Support
- Prompt-Engineering fuer mehrstufige Analyse
- UI fuer Visualisierung der Zwischenschritte (optional)

**Status:** Konzept dokumentiert, nicht implementiert.

---

### Ollama-Integration (Erweitert)

**Aktueller Stand:**
- DeepSeek-OCR als Standardmodell
- DeepSeek-OCR 2 als Option hinzugefuegt
- LightOnOCR-2 als Option hinzugefuegt (erfordert Konvertierung)

**LightOnOCR-2 via Ollama:**

Das Modell ist auf Hugging Face verfuegbar, muss aber fuer Ollama konvertiert werden:

```bash
# 1. Modell von Hugging Face laden
git lfs install
git clone https://huggingface.co/lightonai/LightOnOCR-2-1B

# 2. In GGUF konvertieren (erfordert llama.cpp)
python convert.py lightonai/LightOnOCR-2-1B --outtype f16

# 3. Modelfile erstellen
cat > Modelfile << EOF
FROM ./lightonocr-2-1b.gguf
PARAMETER temperature 0.1
PARAMETER num_ctx 4096
EOF

# 4. In Ollama importieren
ollama create lightonocr -f Modelfile
```

**Hinweis:** Die Konvertierung ist nicht trivial und erfordert:
- llama.cpp mit Vision-Support
- Ausreichend RAM (16GB+)
- GPU empfohlen fuer brauchbare Geschwindigkeit

**DeepSeek-OCR 2:**

Einfacher verfuegbar, kann direkt mit Ollama verwendet werden:

```bash
# Falls verfuegbar im Ollama Registry
ollama pull deepseek-ocr2

# Oder manuell mit Modelfile
ollama create deepseek-ocr2 -f Modelfile
```

**Status:** Optionen in UI hinzugefuegt, Konvertierungsanleitung dokumentiert.

---

## Sources

### Primary Sources
- [LightOnOCR Blog](https://www.lighton.ai/lighton-blogs/making-knowledge-machine-readable)
- [LightOnOCR-2 Hugging Face](https://huggingface.co/lightonai/LightOnOCR-2-1B)
- [Gemini 3 Pro Vision Blog](https://blog.google/technology/developers/gemini-3-pro-vision/)
- [Gemini 3 HTR Analysis](https://generativehistory.substack.com/p/gemini-3-solves-handwriting-recognition)
- [Agentic Vision Blog](https://blog.google/innovation-and-ai/technology/developers-tools/agentic-vision-gemini-3-flash/)
- [dots.ocr GitHub](https://github.com/rednote-hilab/dots.ocr)
- [DeepSeek OCR Handwriting Test](https://skywork.ai/blog/llm/deepseek-ocr-for-handwriting-recognition-accuracy-test-and-tips/)

### Community Validation
- Digital Humanities community discussion (2026-02)

---

**Related:** [METHODOLOGY](METHODOLOGY.md) | [ARCHITECTURE](ARCHITECTURE.md) | [VALIDATION](VALIDATION.md)
