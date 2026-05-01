// api/lesson-grade.js
// Unified lesson grading endpoint.
//
// type: "practice" (default) — Haiku yes/no grader for fill-in, transform, etc.
// type: "free_response"      — Sonnet grader for free response blocks.
//
// This file merges api/lesson-grade.js + api/lesson-grade-free.js.
// api/lesson-grade-free.js should be deleted after this is deployed.

export const config = { maxDuration: 30 };

const MODEL_HAIKU  = "claude-haiku-4-5-20251001";
const MODEL_SONNET = "claude-sonnet-4-20250514";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { type = "practice", ...body } = req.body ?? {};

  if (type === "free_response") {
    return handleFreeResponse(body, res);
  }
  return handlePractice(body, res);
}

// ── Practice / fill-in / transform grading (Haiku, yes/no) ──────────────────

async function handlePractice({ answer, target_word, grammar_context, prompt_ru }, res) {
  if (!answer || !target_word || !grammar_context || !prompt_ru) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      MODEL_HAIKU,
        max_tokens: 10,
        system: `You are a Russian grammar checker.
A student is completing a Russian language exercise.
Respond with ONLY the single word "yes" or "no".
No punctuation. No explanation. No other text.`,
        messages: [{
          role: "user",
          content: `Exercise: "${prompt_ru}"
Expected answer: "${target_word}" (${grammar_context})
Student's answer: "${answer}"
Is the student's answer correct for this context? Consider:
- Accept ё/е alternations as correct (е and ё are interchangeable)
- Accept minor stress mark variations
- The grammatical form must be correct even if a slightly different vocabulary word is used
- Capitalisation differences are not errors
Answer yes or no:`,
        }],
      }),
    });
    const data = await response.json();
    const text = data?.content?.[0]?.text?.trim().toLowerCase() ?? "";
    return res.json({ correct: text.startsWith("yes") });
  } catch (err) {
    console.error("lesson-grade practice error:", err);
    return res.status(500).json({ error: "Grading failed" });
  }
}

// ── Free response grading (Sonnet, structured JSON) ──────────────────────────

async function handleFreeResponse({ answer, prompt, block_type, cefr_level }, res) {
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
        model:      MODEL_SONNET,
        max_tokens: 600,
        system: `You are a Russian language teacher grading student writing.
Grade with the precision and encouragement of a skilled language instructor.
The student is at approximately ${level} level.
Keep teacher_note to 1-2 sentences maximum — be direct and specific.
Respond ONLY with valid JSON matching the exact schema provided. No markdown fences. No preamble.`,
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
      "explanation": "<why this is wrong — 1 sentence>"
    }
  ],
  "strengths": ["<one thing they did well>"],
  "corrected_text": "<the student's full text rewritten correctly>",
  "teacher_note": "<1-2 sentence overall comment, encouraging but honest. This will be stored as a progress note so make it substantive.>"
}
If there are no errors, return an empty errors array. Score 90+ if the response is excellent.`,
        }],
      }),
    });
    const data = await response.json();
    const raw  = data?.content?.[0]?.text ?? "";
    const grade = JSON.parse(raw.replace(/```json|```/g, "").trim());
    return res.json(grade);
  } catch (err) {
    console.error("lesson-grade-free error:", err);
    return res.status(500).json({ error: "Grading failed" });
  }
}