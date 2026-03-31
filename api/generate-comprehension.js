// api/generate-comprehension.js
export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { chapterText, chapterNumber, bookTitle, level, questionTypes } = req.body ?? {};
  if (!chapterText || !questionTypes?.length) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  const typeList = questionTypes.map(q => q.type).join(", ");

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method:  "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      "claude-sonnet-4-20250514",
        max_tokens: 2000,
        system: `You are a Russian language comprehension question writer. Generate exactly 6 questions for a CEFR ${level} reader based on the provided chapter text.

Generate questions of EXACTLY these types in this order: ${typeList}.

For each question return a JSON object with these fields:
- question_type_id: the numeric id provided
- type: the type name string
- question: the question text in English

Additional fields by type:
- detail_recall: include options (array of 4 strings) and correct_index (0-3)
- inference: include correct_answer_guidance (brief description of what a correct answer contains — never shown to student)
- vocabulary_in_context: quote the exact Russian word from the text in the question, include options (4 strings) and correct_index (0-3)
- true_false: include correct (boolean) and explanation (string shown after answering)
- character_motivation: include correct_answer_guidance
- sequence: include sequence_items (array of 4 event strings from the chapter) and correct_order (array of indices 0-3)
- prediction_reflection: include correct_answer_guidance
- grammar_spotlight: quote the exact sentence in the question, include correct_answer_guidance

Respond ONLY with valid JSON: { "questions": [ ... ] }`,
        messages: [{
          role: "user",
          content: `Book: ${bookTitle || "Russian story"}\nChapter: ${chapterNumber}\n\n${chapterText.slice(0, 4000)}`,
        }],
      }),
    });

    const data = await response.json();
    const raw  = data?.content?.[0]?.text ?? "";
    try {
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
      return res.status(200).json(parsed);
    } catch {
      return res.status(502).json({ error: "Could not parse model response" });
    }
  } catch (err) {
    console.error("generate-comprehension error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}