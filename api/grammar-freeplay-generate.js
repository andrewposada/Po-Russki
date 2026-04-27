// api/grammar-freeplay-generate.js
const MODEL_HAIKU = "claude-haiku-4-5-20251001";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { topicId, topicTitle, exerciseType, cefrLevel } = req.body ?? {};

  if (!topicId || !topicTitle || !exerciseType) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Anthropic API key not configured" });

  const exerciseInstructions = {
    fillin: `Generate a fill-in-the-blank exercise about ${topicTitle}.
LANGUAGE RULE: prompt_ru is the only Russian field. All other fields (prompt_en, grammar_context, hint) must be in English.
Return JSON with exactly these fields:
{
  "prompt_ru": "Russian sentence with _____ where the answer goes — in Russian",
  "prompt_en": "English translation of the full correct sentence — in English",
  "target_word": "the correct Russian word or ending that fills the blank",
  "grammar_context": "brief English description e.g. 'accusative singular masculine'",
  "hint": "optional short hint in English, or empty string"
}`,

    mc: `Generate a multiple-choice grammar question about ${topicTitle}.
LANGUAGE RULE: The question and explanation must be in English. context_ru (if used) is Russian. Options may be Russian words/forms if the exercise tests recognition of Russian forms, or English grammar terms if it tests conceptual knowledge.
Return JSON with exactly these fields:
{
  "question": "The question in English e.g. 'Which word is in the nominative case?' or 'Which form is correct here?'",
  "context_ru": "A Russian example sentence or phrase — in Russian (or empty string if not needed)",
  "options": ["option A", "option B", "option C", "option D"],
  "correct_index": 0,
  "explanation": "Why the correct answer is right — in English"
}`,

    translate: `Generate a translation exercise about ${topicTitle}.
Alternate randomly between Russian→English and English→Russian.
LANGUAGE RULE: source is the text to translate (may be Russian or English depending on direction). target is the correct translation. grammar_focus is in English.
Return JSON with exactly these fields:
{
  "direction": "ru_to_en or en_to_ru",
  "source": "The sentence to translate (Russian if ru_to_en, English if en_to_ru)",
  "target": "The correct translation",
  "grammar_focus": "What grammar point this tests — in English e.g. 'dative plural'",
  "acceptable_alternatives": ["alternative correct answer if any, otherwise empty array"]
}`,

    error: `Generate a spot-the-error exercise about ${topicTitle}.
The student must identify the incorrect word/ending and provide the correction.
LANGUAGE RULE: sentence_ru is Russian. sentence_en, explanation are in English.
Return JSON with exactly these fields:
{
  "sentence_ru": "A Russian sentence containing exactly one grammatical error — in Russian",
  "sentence_en": "English translation of what the sentence SHOULD mean — in English",
  "error_word": "The incorrect word as it appears in the sentence — in Russian",
  "correct_word": "The corrected Russian form",
  "explanation": "Why this is an error — in English"
}`,

    transform: `Generate a transformation exercise about ${topicTitle}.
The student is given a Russian word and must transform it into a specified form.
LANGUAGE RULE: prompt and source_context are in English. source_word and target_word are Russian. grammar_context is in English.
Return JSON with exactly these fields:
{
  "prompt": "Instruction in English e.g. 'Put this word in the genitive singular'",
  "source_word": "The Russian word to transform",
  "source_context": "Brief English context e.g. 'дом (house, masculine noun)'",
  "target_word": "The correct transformed Russian form",
  "grammar_context": "What case/tense/form is required — in English"
}`
  };

  const instructions = exerciseInstructions[exerciseType];
  if (!instructions) {
    return res.status(400).json({ error: "Unknown exercise type" });
  }

  const systemPrompt = `You are a Russian language teacher generating grammar exercises for English-speaking learners.
Topic: ${topicTitle} (${topicId})
CEFR level: ${cefrLevel || "A2"}
Exercise type: ${exerciseType}

CRITICAL LANGUAGE RULE: All instructions, questions, explanations, hints, and feedback must be written in ENGLISH. Only the actual Russian language content being tested (sentences, words, forms) should be in Russian. Never write the question prompt or explanation in Russian.

Generate ONE exercise. Respond with ONLY valid JSON. No markdown fences. No explanation. No preamble.
The exercise must directly test ${topicTitle} grammar — not vocabulary or translation skill in general.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      MODEL_HAIKU,
        max_tokens: 600,
        system:     systemPrompt,
        messages:   [{ role: "user", content: instructions }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic error:", err);
      return res.status(502).json({ error: "Anthropic request failed" });
    }

    const data = await response.json();
    const raw  = data.content?.[0]?.text?.trim() ?? "";
    const cleaned = raw.replace(/^```json?\s*/i, "").replace(/```\s*$/i, "").trim();

    let exercise;
    try {
      exercise = JSON.parse(cleaned);
    } catch {
      return res.status(500).json({ error: "Failed to parse exercise JSON", raw });
    }

    return res.json({ exercise, exerciseType });
  } catch (err) {
    console.error("grammar-freeplay-generate error:", err);
    return res.status(500).json({ error: err.message });
  }
}