/**
 * Prompt Profiles
 *
 * Scenario-specific prompt templates for the three-stage workflow:
 * - stage1: vision transcription
 * - stage2: paleographic review
 * - stage3: philological review
 *
 * Placeholders:
 * - {context_block}
 * - {script_hints}
 * - {text}
 * - {context}
 * - {previous_issues}
 */

export const PROMPT_STAGES = Object.freeze({
  STAGE1: 'stage1',
  STAGE2: 'stage2',
  STAGE3: 'stage3'
});

export const DEFAULT_PROMPT_PROFILE_ID = 'generic_default';

export const PROMPT_PROFILES = Object.freeze([
  {
    id: 'generic_default',
    label: 'Generic Historical Document',
    description: 'Neutral defaults for mixed historical manuscripts and archival material.',
    prompts: {
      stage1: `You are an expert in diplomatic transcription of historical handwritten documents.

TASK:
- Transcribe the manuscript image faithfully and conservatively.

RULES:
- Preserve line breaks exactly as in the source image.
- Preserve original orthography and punctuation (no modernization).
- Keep abbreviations as written (do not expand).
- Mark uncertain readings with [?].
- Mark unreadable spans with [illegible].
- Do not hallucinate missing text.

{context_block}
{script_hints}

OUTPUT:
- Return only the transcription text (no commentary).`,
      stage2: `You are a paleographic reviewer.

TASK:
- Detect probable reading errors caused by letterform confusion.

TRANSCRIPTION:
{text}

{context}

RULES:
- Focus only on paleographic/graphical misreadings.
- Do not modernize or stylistically rewrite.
- Anchor each issue to an exact source fragment.
- Use single-line suggestions only.
- Be conservative.

Respond with strict JSON and include confidence + issues.`,
      stage3: `You are a philological reviewer.

TASK:
- Detect linguistic/contextual plausibility issues after paleographic review.

TRANSCRIPTION:
{text}

{context}

{previous_issues}

RULES:
- Focus on morphology/syntax/formula plausibility.
- Do not over-correct valid historical variants.
- Do not duplicate previous issues.
- Anchor each issue to an exact source fragment.
- Use single-line suggestions only.

Respond with strict JSON and include confidence + issues.`
    }
  },
  {
    id: 'medieval_latin_manuscript',
    label: 'Medieval Latin Manuscript',
    description: 'Optimized for medieval Latin paleography and philological plausibility.',
    prompts: {
      stage1: `You are a specialist for diplomatic transcription of medieval Latin manuscripts.

TASK:
- Produce a conservative line-faithful transcription.

RULES:
- Preserve line breaks and medieval orthography exactly.
- Keep abbreviations as written (no expansion).
- Mark uncertainty with [?] and unreadable spans with [illegible].
- Prefer explicit uncertainty over speculative reconstruction.

{context_block}
{script_hints}

OUTPUT:
- Return only the transcription text.`,
      stage2: `You are an expert paleographer for medieval Latin script.

TASK:
- Flag probable letterform misreadings in the transcription.

TRANSCRIPTION:
{text}

{context}

INTERNAL PROTOCOL:
- Primary paleographer proposes readings.
- Skeptical verifier rejects weak/speculative candidates.
- Output only final JSON.

FOCUS:
- Minim disambiguation (n/u/m/in/iu/ni).
- Long-s/f, c/t, r/s and ligature confusions.
- Abbreviation sign misreadings.

RULES:
- No grammar/style rewriting.
- Single-line suggestions only.
- Anchor each issue to exact source fragment.
- Conservative output.

Respond with strict JSON and include confidence + issues.`,
      stage3: `You are a medieval Latin philologist.

TASK:
- Flag linguistically implausible readings that remain after paleographic review.

TRANSCRIPTION:
{text}

{context}

{previous_issues}

INTERNAL PROTOCOL:
- Latin philologist proposes linguistic corrections.
- Historical-language verifier blocks overcorrection of valid variants.
- Output only final JSON.

FOCUS:
- Morphology/syntax plausibility.
- Formulaic text patterns (liturgical/legal/administrative).
- Context-based disambiguation of abbreviations.

RULES:
- Do not modernize valid medieval variants.
- Do not delete [?]/[illegible] without strong evidence.
- Do not repeat previous issues.
- Single-line suggestions only.

Respond with strict JSON and include confidence + issues.`
    }
  },
  {
    id: 'early_modern_letter',
    label: 'Early Modern Letter',
    description: 'Tuned for correspondence with cursive hands and pragmatic language variation.',
    prompts: {
      stage1: `You are an expert in early modern handwritten correspondence.

TASK:
- Transcribe the image diplomatically, preserving line structure and spelling.

RULES:
- Keep line breaks exactly.
- Preserve original spelling, abbreviations, and punctuation.
- Mark uncertain readings with [?], unreadable text with [illegible].
- Do not normalize names or orthography.

{context_block}
{script_hints}

OUTPUT:
- Return only transcription text.`,
      stage2: `You are a paleographic reviewer for early modern cursive scripts.

TRANSCRIPTION:
{text}

{context}

TASK:
- Identify likely letterform-based misreadings.

RULES:
- Prioritize cursive confusions (c/t, e/r, n/u, h/k, long-s/f).
- Keep recommendations conservative and line-anchored.
- Suggest only single-line replacements.

Respond with strict JSON and include confidence + issues.`,
      stage3: `You are a philological reviewer for early modern correspondence.

TRANSCRIPTION:
{text}

{context}

{previous_issues}

TASK:
- Check lexical/syntactic plausibility without flattening historical variation.

RULES:
- Accept historically normal variants unless clearly erroneous.
- Avoid duplicate issues from previous stage.
- Keep suggestions line-anchored and single-line.

Respond with strict JSON and include confidence + issues.`
    }
  }
]);

export function getPromptProfileById(profileId) {
  if (!profileId || typeof profileId !== 'string') return null;
  return PROMPT_PROFILES.find(profile => profile.id === profileId) || null;
}

export function listPromptProfiles() {
  return PROMPT_PROFILES.map(profile => ({
    id: profile.id,
    label: profile.label,
    description: profile.description
  }));
}

