// api/vocab-generate.js
// Generates vocabulary exercise content via Claude Haiku.
//
// Receives: { mode, word, word_en, part_of_speech, level, topics, pos_types, recent_words }
//   mode: "mc_distractors" | "cloze" | "explore_translate" | "explore_mc" | "explore_cloze"
//
// Returns: exercise data object (shape varies by mode — see prompts below)

const MODEL_HAIKU = "claude-haiku-4-5-20251001";

const PROMPTS = {
  mc_distractors: ({ word, pos, level }) =>
    `Give 3 wrong English translations for "${word}" (${pos}). Level:${level}.\nReturn: {"distractors":["<a>","<b>","<c>"]}`,

  cloze: ({ word, word_en, pos, level }) =>
    `Target word:"${word}"(${pos},"${word_en}"). Level:${level}.\nReturn: {"sentence_before":"<Russian before blank>","sentence_after":"<Russian after blank>","answer":"<word in correct form>","grammar_hint":"<case/form name only, e.g. accusative singular>"}`,

  explore_translate: ({ level, topics, pos_types, recent_words }) =>
    `New translate exercise. Level:${level}. Topics:${topics}. Types:${pos_types}. Avoid reusing:${recent_words}.\nReturn: {"word_ru":"<ru>","word_en":"<en>","part_of_speech":"<pos>"}`,

  explore_mc: ({ level, topics, pos_types, recent_words }) =>
    `New multiple choice exercise. Level:${level}. Topics:${topics}. Types:${pos_types}. Avoid reusing:${recent_words}.\nReturn: {"word_ru":"<ru>","word_en":"<en>","part_of_speech":"<pos>","options":["<a>","<b>","<c>","<d>"],"correct_option":"<en>"}`,

  explore_cloze: ({ level, topics, pos_types, recent_words }) =>
    `New cloze exercise. Level:${level}. Topics:${topics}. Avoid reusing:${recent_words}.\nReturn: {"word_ru":"<ru>","word_en":"<en>","part_of_speech":"<pos>","sentence_before":"<ru>","sentence_after":"<ru>","answer":"<correct form>","grammar_hint":"<form name>"}`,
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    mode, word, word_en, part_of_speech, level,
    topics, pos_types, recent_words,
  } = req.body ?? {};

  if (!mode || !PROMPTS[mode]) {
    return res.status(400).json({ error: `Unknown mode: ${mode}` });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Anthropic API key not configured" });
  }

  const userPrompt = PROMPTS[mode]({
    word, word_en,
    pos: part_of_speech,
    level: level ?? "A2",
    topics: topics ?? "any",
    pos_types: pos_types ?? "any",
    recent_words: recent_words ?? "none",
  });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":         "application/json",
        "x-api-key":            apiKey,
        "anthropic-version":    "2023-06-01",
      },
      body: JSON.stringify({
        model:      MODEL_HAIKU,
        max_tokens: 200,
        system:     "You are a Russian vocabulary teacher. Respond with JSON only — no markdown, no explanation.",
        messages:   [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic error:", err);
      return res.status(502).json({ error: "Anthropic request failed" });
    }

    const data = await response.json();
    const raw  = data.content?.[0]?.text ?? "{}";
    const clean = raw.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      console.error("JSON parse error:", clean);
      return res.status(500).json({ error: "Model returned invalid JSON" });
    }

    return res.status(200).json(parsed);
  } catch (e) {
    console.error("vocab-generate error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}