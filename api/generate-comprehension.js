// api/generate-comprehension.js
export const config = { maxDuration: 30 };

const MODEL_SONNET = "claude-sonnet-4-20250514";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const {
    sampledParagraphs,
    chapterSummary,
    chapterNumber,
    bookTitle,
    level,
    questionTypes,
    weakTopics,
  } = req.body ?? {};

  if (!sampledParagraphs?.length || !questionTypes?.length) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  const typeList = questionTypes.map(q => q.type).join(", ");

  // Build the weak topics instruction for grammar spotlight
  const weakTopicsStr = weakTopics?.length
    ? weakTopics.join(", ")
    : null;

  const grammarInstruction = weakTopicsStr
    ? `For grammar_spotlight: The student has shown weakness in: ${weakTopicsStr}.
       FIRST try to find a sentence in the provided text that uses one of these structures.
       If you find one, ask a specific concrete question about it (e.g. "What case is [word] in this sentence, and why?", "Why is the imperfective verb used here instead of perfective?", "Identify the [structure] in this sentence.").
       If you cannot find a relevant sentence, instead give the student a short transformation exercise: provide a sentence in nominative/base form and ask them to rewrite it using one of their weak structures (e.g. "Rewrite this sentence putting [word] in the genitive case: ..."). Make the correct answer clear in correct_answer_guidance.`
    : `For grammar_spotlight: Find any grammatically interesting sentence in the text. Ask a specific, concrete question about it — e.g. what case a noun is in and why, what aspect a verb is and why, what a specific ending signals. Never ask a vague "what structure is used" question.`;

  const systemPrompt = `You are a Russian language comprehension question writer for a CEFR ${level} learner.

You are given: sampled paragraphs from a chapter, a chapter summary for context, and the book title.
Generate exactly 6 questions based on the sampled text and summary.

Generate questions of EXACTLY these types in this order: ${typeList}

For each question return a JSON object with:
- question_type_id: the numeric id provided
- type: the type string
- question: question text in English

Additional fields by type:
- detail_recall: options (array of 4 strings), correct_index (0–3)
- inference: correct_answer_guidance (what a correct answer contains — never shown to student)
- vocabulary_in_context: quote the exact Russian word from the text in the question, options (4 strings), correct_index (0–3)
- true_false: correct (boolean), explanation (shown after answering, 1 sentence)
- character_motivation: correct_answer_guidance (1–2 sentences max)
- sequence: sequence_items (array of exactly 4 event strings from the chapter), correct_order (array of indices 0–3). Only include if the chapter has clear sequential events; otherwise fall back to a second detail_recall.
- grammar_spotlight: correct_answer_guidance (1–2 sentences: state the correct answer and briefly why). Quote the exact Russian sentence in the question field if using a text sentence. For transformation exercises, state the base sentence clearly in the question.

${grammarInstruction}

All correct_answer_guidance fields must be 1–2 sentences maximum. They are used only for grading — never shown directly to the student.

Respond ONLY with valid JSON: { "questions": [ ... ] }`;

  const userContent = `Book: ${bookTitle || "Russian story"}
Chapter: ${chapterNumber}
Chapter summary: ${chapterSummary || "Not available"}

Sampled paragraphs from this chapter:
${sampledParagraphs.join("\n\n")}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      MODEL_SONNET,
        max_tokens: 2000,
        system:     systemPrompt,
        messages:   [{ role: "user", content: userContent }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic error:", err);
      return res.status(502).json({ error: "Anthropic request failed" });
    }

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