// api/translate.js
// Handles: Google Translate (translation) + Claude Haiku (lemmatization)
// Called by: SelectionPill when user taps "Translate"

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { text, isPhrase } = req.body ?? {};
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Missing text" });
  }

  const GOOGLE_KEY     = process.env.GOOGLE_TRANSLATE_API_KEY;
  const ANTHROPIC_KEY  = process.env.ANTHROPIC_API_KEY;

  try {
    // ── 1. Google Translate ───────────────────────────────────────────────────
    const googleRes = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_KEY}`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ q: text, source: "ru", target: "en", format: "text" }),
      }
    );
    const googleData = await googleRes.json();
    const translation = googleData?.data?.translations?.[0]?.translatedText ?? null;

    if (!translation) {
      return res.status(502).json({ error: "Translation failed" });
    }

    // ── 2. Haiku lemmatization (single words only) ────────────────────────────
    let lemma      = null;
    let contextNote = null;

    if (!isPhrase) {
      const haikuRes = await fetch("https://api.anthropic.com/v1/messages", {
        method:  "POST",
        headers: {
          "Content-Type":   "application/json",
          "x-api-key":      ANTHROPIC_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model:      "claude-haiku-4-5-20251001",
          max_tokens: 120,
          system:     `You are a Russian morphology assistant. Respond ONLY with valid JSON, no markdown, no explanation.
Return exactly: {"lemma":"<dictionary form: nominative singular for nouns/adjectives, infinitive for verbs>","contextNote":"<one short phrase describing how this word form is used, e.g. 'genitive singular, object of ждать' — or null if it is already in dictionary form>"}`,
          messages: [{ role: "user", content: text }],
        }),
      });
      const haikuData = await haikuRes.json();
      const raw       = haikuData?.content?.[0]?.text ?? "";
      try {
        const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
        lemma       = parsed.lemma       ?? null;
        contextNote = parsed.contextNote ?? null;
      } catch {
        lemma = text; // fallback: use original
      }
    }

    return res.status(200).json({ translation, lemma, contextNote });
  } catch (err) {
    console.error("translate handler error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}