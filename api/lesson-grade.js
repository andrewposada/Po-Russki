// api/lesson-grade.js
import Anthropic from "@anthropic-ai/sdk";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { answer, target_word, grammar_context, prompt_ru } = req.body;

  if (!answer || !target_word || !grammar_context || !prompt_ru) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const client = new Anthropic();

  const systemPrompt = `You are a Russian grammar checker.
A student is completing a Russian language exercise.
Respond with ONLY the single word "yes" or "no".
No punctuation. No explanation. No other text.`;

  const userPrompt = `Exercise: "${prompt_ru}"
Expected answer: "${target_word}" (${grammar_context})
Student's answer: "${answer}"
Is the student's answer correct for this context? Consider:
- Accept ё/е alternations as correct (е and ё are interchangeable)
- Accept minor stress mark variations
- The grammatical form must be correct even if a slightly different vocabulary word is used
- Capitalisation differences are not errors
Answer yes or no:`;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 10,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = message.content[0]?.text?.trim().toLowerCase() ?? "";
    const correct = text.startsWith("yes");

    return res.json({ correct });
  } catch (err) {
    console.error("lesson-grade error:", err);
    return res.status(500).json({ error: "Grading failed" });
  }
}