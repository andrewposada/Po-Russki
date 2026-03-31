// api/grade-comprehension.js
export const config = { maxDuration: 20 };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { question, correctAnswerGuidance, studentAnswer, level } = req.body ?? {};
  if (!question || !studentAnswer) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  const hasRussian    = /[а-яё]/i.test(studentAnswer);
  const languageNote  = hasRussian
    ? "\nNote: the student answered in Russian. Evaluate meaning, not language choice." : "";

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
        max_tokens: 300,
        system: `You are grading a Russian language learner's comprehension response.
Grade the student's answer based on the question and guidance provided.${languageNote}

Return ONLY valid JSON:
{
  "score": 0,
  "feedback": "feedback text here"
}

score must be exactly 0, 0.5, or 1 (a number, not a string).
Score 1: answer captures the key points in the guidance.
Score 0.5: partially correct or vague but shows understanding.
Score 0: incorrect or shows no comprehension.
feedback must be in English, under 40 words, specific and encouraging.`,
        messages: [{
          role: "user",
          content: `Question: ${question}\n\nGuidance: ${correctAnswerGuidance || "N/A"}\n\nStudent answer: ${studentAnswer}`,
        }],
      }),
    });

    const data = await response.json();
    const raw  = data?.content?.[0]?.text ?? "";
    try {
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
      return res.status(200).json(parsed);
    } catch {
      return res.status(502).json({ error: "Could not parse grading response" });
    }
  } catch (err) {
    console.error("grade-comprehension error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}