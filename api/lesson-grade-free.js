// api/lesson-grade-free.js
export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { answer, prompt, block_type, cefr_level } = req.body ?? {};

  if (!answer || !prompt) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const level = cefr_level || "B1";

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      "claude-sonnet-4-20250514",
        max_tokens: 800,
        system: `You are a Russian language teacher grading student writing.
Grade with the precision and encouragement of a skilled language instructor.
The student is at approximately ${level} level.
Respond ONLY with valid JSON matching the exact schema provided. No markdown fences. No preamble. No explanation after.`,
        messages: [{
          role: "user",
          content: `Assignment prompt: "${prompt}"
Student's response: "${answer}"

Grade this response and return JSON:
{
  "score": <integer 0-100>,
  "errors": [
    {
      "original": "<exact text from student response containing the error>",
      "corrected": "<corrected version>",
      "explanation": "<why this is wrong and what rule applies — 1-2 sentences>"
    }
  ],
  "strengths": ["<one thing they did well>"],
  "corrected_text": "<the student's full text rewritten correctly>",
  "teacher_note": "<1-2 sentence overall comment, encouraging but honest>"
}
If there are no errors, return an empty errors array. Score 90+ if the response is excellent.`,
        }],
      }),
    });

    const data = await response.json();
    const raw = data?.content?.[0]?.text ?? "";
    const grade = JSON.parse(raw.replace(/```json|```/g, "").trim());

    return res.json(grade);
  } catch (err) {
    console.error("lesson-grade-free error:", err);
    return res.status(500).json({ error: "Grading failed" });
  }
}