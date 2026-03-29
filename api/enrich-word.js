// api/enrich-word.js
// Called when user clicks "+ Word Bank" in the TranslationTooltip.
// Calls Claude Haiku to produce a full word bank entry.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { word, translation } = req.body ?? {};
  if (!word) {
    return res.status(400).json({ error: "Missing word" });
  }

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method:  "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 400,
        system: `You are a Russian language reference. Respond ONLY with valid JSON, no markdown.
Return exactly:
{
  "word": "<canonical dictionary form: nominative singular for nouns, infinitive for verbs, short form for adjectives>",
  "translation": "<primary English translation>",
  "partOfSpeech": "<noun|verb|adjective|adverb|preposition|conjunction|particle>",
  "pronunciation": "<stress-marked pronunciation with stressed syllable in CAPS, e.g. kniGA, CHItat'. Include soft-sign notes if relevant.>",
  "etymology": "<1-2 sentences on root or origin with mnemonic value. Focus on what helps remember the word: shared Russian roots, recognizable borrowings, memorable derivations. Not a linguistics lecture.>",
  "usage": "<one natural example sentence in Russian, followed by English translation in parentheses>"
}`,
        messages: [{
          role:    "user",
          content: `Russian word: ${word}\nKnown translation: ${translation ?? "unknown"}`,
        }],
      }),
    });

    const data = await response.json();
    const raw  = data?.content?.[0]?.text ?? "";

    try {
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
      return res.status(200).json(parsed);
    } catch {
      return res.status(502).json({ error: "Failed to parse enrichment response" });
    }
  } catch (err) {
    console.error("enrich-word handler error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}