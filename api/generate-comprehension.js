// api/grammar-freeplay-generate.js

const MODEL_HAIKU = "claude-haiku-4-5-20251001";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { topicId, topicTitle, exerciseType, cefrLevel } = req.body ?? {};

  if (!topicId || !topicTitle || !exerciseType) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Anthropic API key not configured" });
  }

  const exerciseInstructions = {
    fillin: `Generate a fill-in-the-blank exercise about ${topicTitle}.
Return JSON with exactly these fields:
{
  "prompt_ru": "Russian sentence with _____ where the answer goes",
  "prompt_en": "English translation of the full sentence",
  "target_word": "the correct Russian word or ending that fills the blank",
  "grammar_context": "brief description e.g. 'accusative singular masculine'",
  "hint": "optional short hint, or empty string"
}`,

    mc: `Generate a multiple-choice grammar question about ${topicTitle}.
Return JSON with exactly these fields:
{
  "question": "The question to ask the student",
  "context_ru": "A Russian example sentence or phrase to base the question on (optional, or empty string)",
  "options": ["option A", "option B", "option C", "option D"],
  "correct_index": 0,
  "explanation": "Why the correct answer is right"
}`,

    translate: `Generate a translation exercise about ${topicTitle}.
Alternate randomly between Russian→English and English→Russian.
Return JSON with exactly these fields:
{
  "direction": "ru_to_en or en_to_ru",
  "source": "The sentence to translate",
  "target": "The correct translation",
  "grammar_focus": "What grammar point this tests e.g. 'dative plural'",
  "acceptable_alternatives": ["alternative correct answer if any, otherwise empty array"]
}`,

    error: `Generate a spot-the-error exercise about ${topicTitle}.
The student must identify the incorrect word/ending and provide the correction.
Return JSON with exactly these fields:
{
  "sentence_ru": "A Russian sentence containing exactly one grammatical error",
  "sentence_en": "English translation of what the sentence should mean",
  "error_word": "The incorrect word as it appears in the sentence",
  "correct_word": "The corrected form",
  "explanation": "Why this is an error"
}`,

    transform: `Generate a transformation exercise about ${topicTitle}.
The student is given a word/phrase and must transform it into a specified form.
Return JSON with exactly these fields:
{
  "prompt": "Instruction e.g. 'Put the word in the genitive singular'",
  "source_word": "The word to transform",
  "source_context": "Brief context e.g. 'дом (house, masculine)'",
  "target_word": "The correct transformed form",
  "grammar_context": "What case/tense/form is required"
}`,
  };

  const instructions = exerciseInstructions[exerciseType];
  if (!instructions) {
    return res.status(400).json({ error: "Unknown exercise type" });
  }

  const systemPrompt = `You are a Russian language teacher generating grammar exercises.
Topic: ${topicTitle} (${topicId})
CEFR level: ${cefrLevel || "A2"}
Exercise type: ${exerciseType}

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

    return res.status(200).json({ exercise, exerciseType });
  } catch (err) {
    console.error("grammar-freeplay-generate error:", err);
    return res.status(500).json({ error: err.message });
  }
}