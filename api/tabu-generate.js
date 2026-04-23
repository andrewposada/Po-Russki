// api/tabu-generate.js
// Generates 5 Russian taboo hint words for a given target word.
//
// POST body: { word, word_en, cefr_level }
// Returns:   { hints: ["word1", "word2", "word3", "word4", "word5"] }

const MODEL_HAIKU = "claude-haiku-4-5-20251001";

// Maps CEFR level to one step below (floor A1)
const CEFR_STEP_DOWN = {
  A1: "A1",
  A2: "A1",
  B1: "A2",
  B2: "B1",
  C1: "B2",
  C2: "C1",
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { word, word_en, cefr_level } = req.body ?? {};

  if (!word) {
    return res.status(400).json({ error: "word is required" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Anthropic API key not configured" });
  }

  // Hint words should be at learner's level or one step below, floor A1
  const hintLevel = CEFR_STEP_DOWN[cefr_level ?? "B1"] ?? "A2";

  const prompt = `You are helping create a Taboo card game for Russian language learners.

Target word: "${word}" (English: "${word_en ?? ""}")
Hint word level: ${hintLevel} CEFR

Generate exactly 5 Russian words that a player would WANT to use when explaining "${word}", but which are FORBIDDEN. These should be:
- The most obvious related words, synonyms, or strongly associated concepts
- Simple enough for ${hintLevel} CEFR level (common vocabulary)
- In their dictionary/nominative form
- All in Russian (Cyrillic)

Return ONLY valid JSON, no markdown, no explanation:
{"hints":["слово1","слово2","слово3","слово4","слово5"]}`;

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
        max_tokens: 150,
        system:     "You are a Russian language teacher creating Taboo game cards. Respond with JSON only — no markdown, no explanation.",
        messages:   [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic error:", err);
      return res.status(502).json({ error: "Anthropic request failed" });
    }

    const data  = await response.json();
    const raw   = data.content?.[0]?.text ?? "{}";
    const clean = raw.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      console.error("JSON parse error:", clean);
      return res.status(500).json({ error: "Model returned invalid JSON" });
    }

    // Validate shape — must be array of 5 strings
    if (!Array.isArray(parsed.hints) || parsed.hints.length === 0) {
      return res.status(500).json({ error: "Unexpected response shape" });
    }

    return res.status(200).json({ hints: parsed.hints.slice(0, 5) });
  } catch (e) {
    console.error("tabu-generate error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}