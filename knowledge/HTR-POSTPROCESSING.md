# HTR Post-Processing Strategy

> Expert consultation (2026-02-10): Philologist for Medieval Latin + Paleographer for Medieval Scripts + HTR/Vision Orchestrator. This document captures the analysis and recommendations for optimizing HTR results through LLM-based post-processing.

---

## Table of Contents

1. [Synthesis: Pipeline Architecture](#synthesis-pipeline-architecture)
2. [Philologist Analysis: Medieval Latin HTR Errors](#philologist-analysis)
3. [Paleographer Analysis: Script-Specific Challenges](#paleographer-analysis)
4. [System Prompt Library](#system-prompt-library)
5. [Implementation Roadmap](#implementation-roadmap)

---

## Synthesis: Pipeline Architecture

### The Three-Stage Pipeline

The core insight from both experts: HTR post-processing requires a **multi-stage pipeline**, not a single prompt. Each stage addresses a different layer of the problem.

```
Stage 1: VISION LLM (Image -> Raw Text)
   |  Script-type in prompt, abbreviations NOT expanded
   v
Stage 2: PALEOGRAPHER LLM (Raw Text -> Corrected Text)
   |  Minim disambiguation, letterform corrections, script-specific rules
   v
Stage 3: PHILOLOGIST LLM (Corrected Text -> Final Text)
   |  Abbreviation expansion, formula cross-referencing, morphology check
   v
   -> Editor with diff view (human decides)
```

**Why separate stages?**
- The Vision model's task is **visual**: extracting shapes from pixels
- The Paleographer's task is **script-analytical**: resolving letterform ambiguities
- The Philologist's task is **linguistic**: ensuring the text makes sense as Latin/vernacular

Combining all three in one prompt overwhelms the model and produces worse results than sequential specialization.

### Top 5 Key Findings

**1. The Minim Problem: Anchor-Letter Recognition, Not Counting**

In Gothic Textura (13th--15th c.), the letters m, n, u, i are composed of identical vertical strokes (minims). The word *minimum* appears as 10 identical strokes. The word *communis* contains 13 minims in sequence. This is not an edge case -- it affects core vocabulary in every Latin text.

**Critical insight from paleographic practice:** Expert paleographers do NOT count minims. That is a pedagogical technique for students, not how professionals read. An experienced paleographer reads the **anchor letters** (d, s, a, e, r, t, l -- any letter without minims) and instantly recognizes the word from Latin vocabulary knowledge. The minims are resolved holistically, not character by character.

This maps directly to LLM strengths: **word-level pattern completion with linguistic knowledge**. When the Vision output contains `d_______s` with unclear minims in between, and the context is liturgical, the LLM's Latin vocabulary instantly yields *dominus* -- no counting needed.

Solution: Anchor-letter recognition + Latin vocabulary matching + grammatical context. NOT mechanical minim counting (which is error-prone and computationally unnecessary for an LLM that knows Latin).

**2. The Vision Prompt Must Know the Script Type**

The single most impactful improvement is telling the Vision LLM which script it is looking at. Without this, the model defaults to modern printed text assumptions and produces systematic errors. A library of script-specific prompt modules (Textura, Bastarda, Caroline) is needed.

The Vision LLM should NOT expand abbreviations -- that is a linguistic task for Stage 3. It should report marks as seen.

**3. Abbreviation Expansion Belongs in Stage 3**

The recommended default is semi-diplomatic with round brackets: `d(omi)n(u)s`, `eccl(esi)a`. The Philologist LLM needs context (text type, region, century) for correct expansion. The tool should offer three modes: silent expansion, marked expansion, diplomatic (no expansion).

**4. Document Context is the Key Enabler**

Both experts independently request the same metadata:

| Field | Provided by | Used by |
|-------|-------------|---------|
| Script type | Paleographer/User | Vision + Paleographer |
| Century | Paleographer/User | All 3 stages |
| Region | Philologist/User | All 3 stages |
| Text type | Philologist/User | Philologist + Paleographer |
| Language(s) | Philologist/User | All 3 stages |
| Known text | Philologist/User | Philologist |

The existing Document Context panel must be extended with structured dropdowns for these fields.

**5. Confidence Mapping to Existing System**

The post-processing results map directly to the existing validation confidence tiers:

- **sure** -> only one valid reading exists, supported by language + paleography
- **check-worthy** -> best reading is probable but alternatives exist (mark them)
- **problematic** -> multiple equally plausible readings, damaged text, or unresolvable minim sequences

---

## Philologist Analysis

### Most Common HTR Errors in Medieval Latin

#### Minim-Based Errors

The single most devastating error category. In Gothic Textura, the letters i, u, n, m are all composed of identical vertical strokes.

| True Reading | HTR Misreading | Cause |
|---|---|---|
| *minimum* | *mimmuui*, *mimiuum* | 10 minims, arbitrarily segmented |
| *anima* | *auiina*, *amina* | n/u/ni interchange |
| *dominum* | *domiuuui*, *dominuni* | final -num as minim sequence |
| *communis* | garbled | 13 minims in sequence |

#### Long-s and f Confusion

Long s and f are nearly identical in many hands, differing only in whether the crossbar extends to the left.

| True Reading | HTR Misreading |
|---|---|
| *sanctus* | *fanctus* |
| *sicut* | *ficut* |
| *fecit* | *secit* |
| *satisfactio* | *fatisfactio* |

#### c/t Confusion

Distinguished only by a minimal ascender on t.

| True Reading | HTR Misreading |
|---|---|
| *dictum* | *diccum* |
| *factum* | *faccum* |
| *ecclesia* | *etclesia* |
| *contractus* | *concraccus* |

#### Abbreviation Mark Errors

Medieval scribes used a rich abbreviation system that Vision LLMs handle poorly.

**General suspension mark (macron/titulus):**

| Manuscript Form | Correct Expansion | Typical HTR Output |
|---|---|---|
| dns with macron | *dominus* | *dns*, *dius*, *dms* |
| ecclia with macron | *ecclesia* | *ecclia*, *ecelia* |
| omes with macron | *omnes* | *omes*, *oines* |
| eps with macron | *episcopus* | *eps*, *epis* |

**Special signs:**

| Sign | Meaning | HTR Output |
|---|---|---|
| p with stroke | *per*, *par* | *p*, *pp*, garbage |
| p with flourish | *pro* | *p*, *po* |
| q with stroke | *quod* | *q*, *qd* |
| Tironian et | *et* | *7*, *z*, *&*, *t* |

#### Word Boundary Errors

Medieval manuscripts frequently lack consistent word separation:
- *inaduentu* for *in adventu*
- *deecclesie* for *de ecclesie*
- *idest* for *id est*

#### Roman Numerals vs. Letters

Flanking punctuation marks (punctus before and after numerals) are frequently missed, causing numerals to be read as parts of adjacent words: `.viij.` -> `viij` or `uiij`.

### Philological Post-Processing Strategy

#### Morphological Awareness

Latin is inflected. A corrected reading must produce a morphologically valid form. The LLM should consider:
- Noun declension patterns (5 declensions, with medieval deviations)
- Verb conjugation (including medieval contracted forms)
- Agreement (adjective-noun, subject-verb)
- Case governance by prepositions

#### Formula Recognition

A vast proportion of medieval Latin texts follow formulaic patterns:
- **Liturgical:** *In nomine Domini*, *Per omnia saecula saeculorum*, *Gloria Patri...*
- **Charter:** *Notum sit omnibus tam presentibus quam futuris*, *Actum et datum*
- **Legal:** *Nos igitur*, *Volumus et mandamus*, *Sub pena excommunicationis*
- **Biblical:** Vulgate quotations (the single most copied text)

#### Orthographic Variation Awareness

Medieval Latin is not Classical Latin. The LLM must know which variations are legitimate:

| Classical | Medieval Variant | Status |
|---|---|---|
| *ae* | *e* (monophthongization) | Legitimate, preserve |
| *oe* | *e* | Legitimate, preserve |
| *-ti-* before vowel | *-ci-* (*nacio* for *natio*) | Legitimate, preserve |
| *h-* omission | *abere* for *habere* | Legitimate, preserve |
| *nichil/nihil* | both forms | Both legitimate |
| *michi/mihi* | both forms | Both legitimate |
| double consonant variation | *littera/litera* | Both legitimate |
| *y/i* interchange | *ymaginem/imaginem* | Both legitimate |

**Key principle:** Preserve what might be a feature of the scribe's Latin; correct what is clearly a transmission error.

#### Abbreviation Handling: Three Modes

| Mode | Convention | Use Case |
|---|---|---|
| **Silent expansion** | *dominus* | Full-text search, NLP, non-specialist reading |
| **Marked expansion** (default) | *d(omi)n(u)s* | Scholarly transcription, best middle ground |
| **Diplomatic** | *dns* with macron | Paleographic study |

#### Uncertain Readings Conventions

| Situation | Convention | Example |
|---|---|---|
| Uncertain but plausible | Square brackets | *[sanctus]* |
| Illegible, estimated length | Dots in brackets | *[...]*, *[..........]* |
| Illegible, unknown extent | Dashes | *[---]* |
| Scribal deletion | Angle brackets | *<deleted text>* |
| Hopeless corruption | Daggers | *+corrupted text+* |

#### Reference Knowledge for Cross-Checking

1. **Vulgate Bible** -- compare against standard text, flag discrepancies
2. **Liturgical texts** -- Breviary and Missal follow extremely standardized texts
3. **Charter formulas** -- predictable structure: invocatio, intitulatio, inscriptio, arenga, narratio, dispositio, sanctio, corroboratio, datum
4. **Standard dictionaries** -- Niermeyer (*Mediae Latinitatis Lexicon Minus*), Du Cange (*Glossarium*)

---

## Paleographer Analysis

### Script-Specific HTR Challenges

#### Textura (Textualis Formata)

The most difficult medieval script for automated recognition.

**The Minim Problem ("Picket Fence"):**
- Letters m, n, u, i constructed from identical vertical strokes
- *minimi* = 10 identical strokes: ||||||||||
- I-dots only become systematic in the 14th century, remain inconsistent
- Even human paleographers rely on context

**Biting (Litterae Mordentes):**
When opposing curves meet (de, do, be, bo, pe, po), Textura merges them into a shared vertical. The Vision LLM may read only one letter, a different letter, or insert a spurious letter.

**Textura Confusion Matrix:**

| True Letter | Likely Misread As |
|---|---|
| c | t, e |
| e | c, o |
| f | long-s |
| long-s | f |
| m | in, ni, mi |
| n | u, ii |
| u | n, ii |
| round-r | z, 2, v |
| round-d | cl, a |
| t | c |
| w | vv, uu |

#### Textualis and Bastarda (Hybrida)

**Long-s vs. f:** More acute in Bastarda because scripts are written more quickly. The crossbar distinguishing them may be merely a thickening, extended too far, or omitted entirely.

**Regional Variants:**

German Bastarda:
- e written as two parallel strokes (like Kurrent e), confused with n or ii
- Sharp angularity even in "looser" forms
- z with descending tail, confused with 3
- Early umlaut (superscript e over u) often read incorrectly or ignored

French Batarde:
- Pronounced looped ascenders on b, h, k, l -- may be read as separate letters (l with loop becomes "el")
- v/b confusion more acute
- Highly decorated capitals unrecognizable to models

**Bastarda Additional Confusion Matrix:**

| True Letter | Likely Misread As |
|---|---|
| a (single-compartment) | u, ci |
| b | v (initial), l (with loops) |
| h | b (with loops) |
| l | b (ascender loops) |
| looped ascender | e+letter, o+letter |
| German e (two-stroke) | n, ii |

#### Caroline Minuscule (Why It Is Easier)

1. **Open letterforms**: round, well-spaced, individually distinct -- no minim problem
2. **No biting**: each letter occupies its own space
3. **Resemblance to modern type**: Caroline is the historical ancestor of printed lowercase
4. Vision LLMs find Caroline forms familiar

### Paleographic Post-Processing Strategy

#### Minim Disambiguation: The Anchor-Letter Approach

**Key insight from paleographic practice:** Expert paleographers do NOT count minims mechanically. That is a pedagogical technique for beginners. A professional paleographer reads the **anchor letters** -- any letter that is NOT composed of minims (d, s, a, e, r, t, l, o, c, p, etc.) -- and recognizes the word instantly from Latin vocabulary knowledge. The minim letters (m, n, u, i, v) resolve themselves once the word is identified.

This is directly analogous to how humans read English despite ambiguous handwriting: we recognize the word shape, not each letter individually.

**Strategy for LLM post-processing:**
1. **Extract the anchor skeleton:** identify all non-minim letters in their positions
2. **Match against Latin vocabulary:** the anchor pattern usually yields a unique or near-unique word
3. **Use grammatical context:** case endings, verb forms, preposition governance disambiguate remaining candidates
4. **I-dot presence:** when dots are present, they are authoritative anchors too
5. **Fallback only:** mechanical minim counting is a last resort when anchor letters are too few (rare)

**Examples of anchor-letter resolution:**

| HTR Output | Anchors | Recognition | Resolved |
|---|---|---|---|
| *domiuuui* | d, o | d_______  → *dominum* | dominum |
| *coiiimuiiis* | c, o, s | c_______s → *communis* | communis |
| *tenipoie* | t, e, p, e | t___p___e → *tempore* | tempore |
| *ecclefie* | e, c, c, l, e | eccl___e → *ecclesie* | ecclesie |
| *aiiiiua* | a, a | a_____a → *anima* or *annua* | check context |

#### Ligatures and Special Characters

| Feature | Post-Processing Rule |
|---|---|
| ct-ligature | Do not read as separate strokes |
| st-ligature | Do not insert space |
| ae/oe as e-caudata | Expand to ae/oe or mark |
| Tironian et | Replace with *et* |
| con/com (9-shaped) | Expand to con- or com- |
| -us abbreviation | Expand to -us |
| -rum abbreviation | Expand to -rum |

### Vision Model Guidance

#### What the Initial Vision Prompt Must Include

**A. Script Type Declaration (highest impact):**

Tell the Vision LLM exactly which script it is looking at. Example:
```
This manuscript is written in Gothic Textura (Textualis Formata), a formal
book script of the 14th century. Key features:
- Vertical, angular letterforms with no curves
- Minims (identical vertical strokes) forming m, n, u, i
- Biting/fusion where opposing curves meet (de, do, be, bo, pe, po)
- Long-s that looks like f but lacks a full crossbar
- Round-r (2-shaped) after curved letters
- Heavy abbreviation (macrons, superscript letters, special signs)
```

**B. Mark Uncertain Characters (instead of confidence scores):**
```
When unsure about a character, mark with [?]: "sacra[m?]entis"
```

**C. Do NOT Expand Abbreviations:**
```
Transcribe abbreviation marks as seen. Do NOT expand.
Expansion requires linguistic knowledge and will be handled separately.
```

**D. Damaged Passages:**
```
Mark completely illegible characters with [...] for approximate count.
Mark partially legible: d[?]minus. Do NOT guess at illegible words.
```

**E. Preserve Line Structure:**
```
Transcribe line by line. If a word is hyphenated across lines,
transcribe parts on respective lines with a hyphen.
```

**F. Visual Features:**
```
Note: rubricated text, enlarged initials, marginal annotations,
interlinear additions, deletions, hand changes.
```

---

## System Prompt Library

### Prompt A: General Medieval Latin Philological Review

```
You are a specialist in medieval Latin philology reviewing a raw HTR
(Handwritten Text Recognition) transcription of a manuscript page. Your task
is to correct obvious reading errors while preserving genuine features of
medieval Latin orthography.

LETTERFORM CORRECTIONS:
- Minim confusion: where the HTR produces nonsensical sequences of i, u, n, m
  strokes, reconstruct the most plausible Latin word. For example, if you see
  "domiuuui" or "domiuuni", correct to "dominum" or "dominuni" based on
  morphological and syntactic context.
- Long-s / f confusion: "fanctus" should be "sanctus", "ficut" should be
  "sicut", but "fecit" is correct as-is. Decide based on Latin vocabulary.
- c / t confusion: "diccum" is likely "dictum", "faccum" is likely "factum".
  Check whether the resulting word exists in medieval Latin.

ABBREVIATION EXPANSION:
- Expand all abbreviations using round parentheses to mark supplied letters:
  dns with macron -> d(omi)n(u)s
  ecclia with macron -> eccl(esi)a
  p with stroke (per-sign) -> p(er) or p(ar) based on context
  p with descending flourish -> p(ro)
  q with stroke -> q(uo)d or other q-words based on context
  Tironian et (resembling 7 or z) -> (et)
  superscript letters: expand the implied syllable
- If the abbreviation is ambiguous, choose the reading that fits syntactic
  context and note the ambiguity only if both readings are plausible.

ORTHOGRAPHIC PRESERVATION:
Do NOT normalize these medieval Latin features to classical forms:
- e for ae/oe (e.g., "ecclesie" not "ecclesiae")
- ci for ti before vowels (e.g., "nacio" not "natio")
- Omitted h (e.g., "abere" for "habere")
- michi/nichil spellings
- Double or single consonant variations
- y/i interchange (e.g., "ymago")
- set for sed, ut for aut (phonetic spellings)
These are features of the scribe's language, not errors.

UNCERTAIN READINGS:
- Plausible but unclear: square brackets [sanctus]
- Illegible: [...] for few letters, [---] for unknown extent
- Corrupt beyond reconstruction: +corrupted passage+

OUTPUT FORMAT:
Provide the corrected transcription line by line. After the transcription,
add a brief apparatus section listing significant corrections with reasoning.
```

### Prompt B: Liturgical Text Specialist

```
You are reviewing an HTR transcription of a medieval liturgical manuscript
(Breviary, Missal, Psalter, or Book of Hours). Liturgical texts are highly
formulaic, which aids correction.

LITURGICAL FORMULA CROSS-REFERENCE:
- Compare against standard Vulgate biblical text and established formulas:
  "In nomine Patris et Filii et Spiritus Sancti"
  "Per omnia secula seculorum" (medieval "secula" not "saecula")
  "Dominus vobiscum / Et cum spiritu tuo"
  "Gloria Patri et Filio et Spiritui Sancto"
  "Sicut erat in principio et nunc et semper"
- Psalm incipits follow the Vulgate Psalter (Gallicanum version for most
  Western manuscripts). If the text diverges, flag but preserve.
- Hymns: cross-reference known compositions (Ambrose, Prudentius, Venantius
  Fortunatus).

RUBRICS:
- Rubrics use abbreviated forms: R/ (responsorium), V/ (versiculus),
  A/ (antiphona), Ps. (psalmus).
- Mark rubrics distinctly from main text.

MUSICAL NOTATION:
- Garbled characters that might be neumes: mark as [neumes].

Apply standard letterform correction and abbreviation expansion rules.
```

### Prompt C: Charter/Diplomatic Text Specialist

```
You are reviewing an HTR transcription of a medieval charter (Urkunde).
Charters follow a predictable diplomatic structure.

DIPLOMATIC STRUCTURE:
1. Invocatio: "In nomine sancte et individue Trinitatis"
2. Intitulatio: name and titles of the issuer
3. Inscriptio: addressees
4. Arenga: general justification
5. Narratio: circumstances
6. Dispositio: legal content
7. Sanctio/Corroboratio: penalties, sealing clause
8. Datum: "Actum et datum [place], anno Domini M CCC..."
9. Witnesses: "Testes huius rei sunt..."

DATING FORMULAS:
- Roman numerals with flanking dots: .M.CCC.LXXVII. = 1377
- Flag numerals outside plausible range but do not silently change.

LEGAL TERMINOLOGY:
Watch for: census/censum, mansum (not "manfum"), sigillum (not "figillum"),
privilegium, advocatus/advocatia, decimae/decime.

PERSONAL AND PLACE NAMES:
- Preserve manuscript forms: "Heinricus", "Wienne", "Salczburga"
- Do NOT normalize to modern forms.
- Flag uncertain names: "Albertus de [?]burch"
```

### Prompt D: Textura Minim Resolution Module (Anchor-Letter Approach)

The following prompt encodes the expert paleographer's reading strategy: read
the clear (non-minim) letters first, then resolve the minim sequences by
recognizing the whole word from Latin vocabulary. This is how professionals
actually read Textura -- NOT by counting individual strokes.

```
You are an expert paleographer reading a Gothic Textura transcription. The raw
HTR output contains garbled minim sequences (combinations of m, n, u, i, v
that look wrong). Your task is to resolve them using the ANCHOR-LETTER method:

READING STRATEGY (how expert paleographers work):
1. IDENTIFY the anchor letters in each word -- letters that are NOT composed
   of minims and are therefore reliably transcribed: a, b, c, d, e, f, g, h,
   k, l, o, p, q, r, s, t, x, y, z. These form the skeleton of the word.
2. RECOGNIZE the word from its skeleton + your Latin vocabulary knowledge.
   Example: "d___n__s" with garbled minims -> "dominus" (immediate recognition)
   Example: "c___n__" with garbled minims -> "commune" or "communis"
   Example: "___n__" with garbled minims at start -> "annum", "anima", "unum"
3. VERIFY the recognized word fits the grammatical context (case, number,
   tense, syntactic position).
4. Only if anchor-letter recognition fails (e.g., a word consists almost
   entirely of minims), fall back to considering all possible Latin words
   of that approximate letter count.

DO NOT count individual minims mechanically. That is a student exercise,
not how experts read. Trust your Latin vocabulary to resolve minim sequences
holistically, just as a human paleographer would.

EXAMPLES:
- "domiuuui" -> anchors: d, o -> "dominum" (accusative, fits "per dominum")
- "coiiimuiiis" -> anchors: c, o, s -> "communis"
- "aiiiiua" -> anchors: a, a -> "anima" (not "annua" -- check context)
- "ecclefie" -> anchors: e, c, c, l, e -> "ecclesie" (long-s/f also fixed)
- "tenipoie" -> anchors: t, e, p, e -> "tempore" (minim n->m, i->r resolved)

Mark confidence:
- [SURE] = only one Latin word matches the anchor skeleton
- [PROBABLE] = best match is strongly favored by context
- [AMBIGUOUS] = multiple words fit (e.g., "anima" vs. "annum"); list all
```

### Prompt E: Script-Aware Validation Rules

```
FOR TEXTURA (13th-15th century):
1. "ff" at word-start is almost always double long-s or long-s + f
2. After o, b, p, d: expect round-r (2-shaped). "oz"/"o2" = "or"
3. Word-final long-s is rare in Latin. Check word boundary.
4. v appears only word-initially (elsewhere written as u). Flag medial v.
5. j does not exist in medieval Latin. Read as i.

FOR BASTARDA (14th-16th century):
1. Looped ascenders are decorative, not separate letters. "el" for l -> l
2. German two-stroke e may be read as "n" or "ii". Check spelling rules.
3. w in German is a single letter, not "vv" or "uu". Merge if split.
4. Superscript e over u (umlaut): note as ue, not ignore.

FLAG for human review:
- Words not found in standard dictionary for the language/period
- Sequences of 6+ minims without clear resolution
- Abbreviations that cannot be confidently expanded
- Damaged or unclear passages
```

---

## Implementation Roadmap

### Phase 1: Document Context Extension

Extend the existing Document Context panel with structured fields:

```
Script Type:   [Textura | Textualis | Bastarda | Caroline | Humanistic | Other]
Century:       [text field, e.g., "mid-14th century"]
Region:        [German | French | Italian | English | Other]
Language(s):   [checkboxes: Latin | German | French | Italian | Other]
Text Type:     [Liturgical | Legal/Charter | Literary | Administrative | Scientific | Other]
Known Text:    [text field, e.g., "Psalter, Psalms 1-50" or empty]
```

These fields dynamically shape all three pipeline stages.

### Phase 2: Vision Prompt Library

Create script-specific prompt modules that are injected into the transcription prompt based on Document Context:

- `prompts/vision-textura.txt`
- `prompts/vision-bastarda.txt`
- `prompts/vision-caroline.txt`
- `prompts/vision-generic.txt` (fallback)

### Phase 3: Post-Processing Pipeline

Add two additional LLM calls after transcription:

1. **Paleographic correction** (Script-aware, uses confusion matrices)
2. **Philological review** (Language-aware, uses formula databases)

Display corrections as word-level diff in the editor (reuse existing Suggesting Mode).

### Phase 4: Confidence Integration

Map post-processing results to the existing sure/check-worthy/problematic system:
- Line-level confidence based on the worst segment
- Uncertain readings `[bracketed]` shown with tooltip explaining alternatives
- Apparatus section in export formats

### Dependencies

| Phase | Depends On | Estimated Scope |
|-------|-----------|----------------|
| Phase 1 | Existing context.js | ~100 lines (dropdowns + storage) |
| Phase 2 | Phase 1 | ~200 lines (prompt templates + selection logic) |
| Phase 3 | Phase 2, existing llm.js | ~400 lines (pipeline orchestration) |
| Phase 4 | Phase 3, existing validation.js | ~150 lines (confidence mapping) |

---

*Document created 2026-02-10. Based on expert consultation with Medieval Latin Philologist, Medieval Paleographer, and HTR/Vision Model Orchestrator.*
