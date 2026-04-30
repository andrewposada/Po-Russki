// api/vocab-grade.js
// Grades a vocabulary exercise answer via Claude Haiku.
//
// Receives: { mode, word_ru, word_en, correct_answer, student_answer }
//   mode: "translate_ru_en" | "translate_en_ru" | "cloze" | "sentence"
//
// Returns: { correct: bool, feedback: string }

const MODEL_HAIKU = "claude-haiku-4-5-20251001";

const PROMPTS = {
  explain_stanza: ({ stanza_text }) =>
    `Russian song lyrics stanza:\n"${stanza_text}"\n\nExplain in plain English what this stanza means. Cover any idioms, slang, or cultural references. Be concise — 3 to 5 sentences maximum.`,

  study_line: ({ line_ru, line_en, student_answer }) =>
    `Russian lyric line: "${line_ru}"\nCorrect meaning: "${line_en}"\nStudent's translation: "${student_answer}"\n\nGrade the student's understanding. correct=true if they captured the core meaning well. partial=true if they got the gist but missed something important (idiom, nuance, key word). correct=false,partial=false if they were substantially wrong.\nRespond ONLY with valid JSON: {"correct":bool,"partial":bool,"feedback":"1-2 sentences explaining what they got right or wrong, and noting any idioms or slang"}`,

  translate_ru_en: ({ word_ru, word_en, student_answer }) =>
    `Word:"${word_ru}" correct:"${word_en}" student:"${student_answer}"\nAccept synonyms and close translations. Return: {"correct":bool,"feedback":"<1 sentence max>"}`,

  translate_en_ru: ({ word_ru, word_en, student_answer }) =>
    `English:"${word_en}" correct_ru:"${word_ru}" student:"${student_answer}"\nAccept correct spelling and common alternates. Return: {"correct":bool,"feedback":"<1 sentence max>"}`,

  cloze: ({ correct_answer, student_answer, word_ru }) =>
    `Answer:"${correct_answer}" student:"${student_answer}" word:"${word_ru}"\nAccept correct form and common variants. Return: {"correct":bool,"feedback":"<1 sentence max>"}`,

  sentence: ({ word_ru, word_en, student_answer }) =>
    `Word:"${word_ru}"("${word_en}"). Student sentence:"${student_answer}".\nCorrect if the word is used sensibly, even with grammar errors. Return: {"correct":bool,"feedback":"<2 sentences max>"}`,
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { mode, word_ru, word_en, correct_answer, student_answer, stanza_text } = req.body ?? {};

  if (!mode || !PROMPTS[mode]) {
    return res.status(400).json({ error: `Unknown mode: ${mode}` });
  }

  // explain_stanza uses stanza_text; study_line uses line_ru + line_en + student_answer
  if (mode === "explain_stanza" && (!stanza_text || typeof stanza_text !== "string")) {
    return res.status(400).json({ error: "stanza_text is required for explain_stanza" });
  }
  if (mode !== "explain_stanza" && (!student_answer || typeof student_answer !== "string")) {
    return res.status(400).json({ error: "student_answer is required" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Anthropic API key not configured" });
  }

  const isExplain   = mode === "explain_stanza";
    const { line_ru, line_en } = req.body ?? {};
    const userPrompt  = PROMPTS[mode]({ word_ru, word_en, correct_answer, student_answer, stanza_text, line_ru, line_en });

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
        max_tokens: isExplain ? 150 : 120,
        system:     isExplain
          ? "You are a Russian language and culture expert. Respond in plain English prose only — no JSON, no markdown."
          : "You are a Russian vocabulary teacher. Respond with JSON only — no markdown, no explanation.",
        messages:   [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic error:", err);
      return res.status(502).json({ error: "Anthropic request failed" });
    }

    const data = await response.json();
    const raw  = data.content?.[0]?.text ?? "";

    // explain_stanza returns plain text, not JSON
    if (isExplain) {
      return res.status(200).json({ explanation: raw.trim() });
    }

    const clean = raw.replace(/```json|```/g, "").trim();
    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      console.error("JSON parse error:", clean);
      return res.status(500).json({ error: "Model returned invalid JSON" });
    }

    // study_line returns correct + partial + feedback
    if (mode === "study_line") {
      return res.status(200).json({
        correct:  Boolean(parsed.correct),
        partial:  Boolean(parsed.partial),
        feedback: parsed.feedback ?? "",
      });
    }

    return res.status(200).json({
      correct:  Boolean(parsed.correct),
      feedback: parsed.feedback ?? "",
    });
  } catch (e) {
    console.error("vocab-grade error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}