// api/listening-generate.js
// Generates a listening exercise: passage/dialogue + comprehension questions.
//
// POST body:
//   level         {string}   CEFR level e.g. "A2"
//   situation     {string}   from SITUATIONS in exerciseVariety.js
//   vocabCategory {string}   from VOCAB_CATEGORIES in exerciseVariety.js
//   contentFormat {string}   "dialogue" | "monologue" | "announcement" | "voicemail" | "interview"
//   exerciseTypes {string[]} array of question type IDs to generate
//
// Response:
//   title         {string}   Short English scene title
//   context       {string}   One-sentence English scene description
//   content       {object[]} Array of { speaker, text } Russian lines
//   questions     {object[]} Array of question objects (structure varies by type)
//   contentHash   {string}   Stable hash for audio cache keying

export const config = { maxDuration: 25 };

const MODEL_HAIKU = "claude-haiku-4-5-20251001";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "API key not configured" });
  }

  const {
    level         = "A2",
    situation     = "at a café ordering coffee",
    vocabCategory = "food and cooking",
    contentFormat = "dialogue",
    exerciseTypes = ["gist_question", "specific_detail", "dictation_fill"],
  } = req.body ?? {};

  const isDialogue = contentFormat === "dialogue" || contentFormat === "interview";
  const questionCount = isDialogue ? 4 : 3;

  const formatInstructions = isDialogue
    ? `Write a natural ${contentFormat} between two people (Speaker A and Speaker B).
Format content as a JSON array of line objects, each with:
  "speaker": "A" or "B"
  "text": the Russian sentence (one natural spoken utterance per line)
Aim for 6–10 exchanges total. Each line should be one complete spoken sentence or short phrase.`
    : `Write a short spoken ${contentFormat} in Russian by a single narrator.
Format content as a JSON array of objects, each with:
  "speaker": "A"
  "text": a sentence or short paragraph of spoken Russian
Use 3–6 lines to create natural spoken pacing.`;

  const questionSpecs = {
    gist_question:
      `type "gist_question" — multiple choice about overall topic or mood. Fields: question (string), options (array of 4 strings), correct_index (0-based int).`,
    specific_detail:
      `type "specific_detail" — multiple choice about a specific stated fact. Fields: question (string), options (array of 4 strings), correct_index (0-based int).`,
    true_false_not_mentioned:
      `type "true_false_not_mentioned" — a statement that is true, false, or not mentioned. Fields: statement (string in English), options: ["True","False","Not mentioned"], correct_index (0-based int).`,
    inference:
      `type "inference" — multiple choice about what the speaker(s) probably feel or imply. Fields: question (string), options (array of 4 strings), correct_index (0-based int).`,
    dictation_fill:
      `type "dictation_fill" — a sentence from the content with 1–2 words replaced by _____. Fields: gapped_sentence (Russian with blanks), answers (array of missing Russian words in order).`,
    word_reconstruction:
      `type "word_reconstruction" — a short phrase (3–5 words) from the content the user must type from memory. Fields: prompt_en (English translation), answer (correct Russian phrase).`,
    phrase_translation:
      `type "phrase_translation" — a short phrase heard in the audio. Fields: prompt_ru (the Russian phrase), answer_en (its English meaning).`,
    respond_next:
      `type "respond_next" — given the context, what would be a natural next thing to say? Fields: context_en (brief English summary of the exchange), options (array of 4 Russian phrases), correct_index (0-based int).`,
    mishear_correction:
      `type "mishear_correction" — a sentence from the content but with one word swapped for a similar-sounding wrong word. Fields: shown_sentence (Russian with wrong word), correct_word (Russian), wrong_word (Russian).`,
  };

  const exerciseInstructions = exerciseTypes
    .slice(0, questionCount)
    .map((type, i) => `Question ${i + 1}: ${questionSpecs[type] ?? questionSpecs.specific_detail}`)
    .join("\n");

  const systemPrompt = `You are a Russian language content creator for a learner app.
Generate natural, idiomatic Russian appropriate for CEFR level ${level}.
Use vocabulary, grammar complexity, and speech register suited to ${level} learners.
All Russian must be authentic spoken Russian, not textbook-stiff.
Respond ONLY with valid JSON. No markdown fences. No preamble. No explanation after the JSON.`;

  const userPrompt = `Generate a listening comprehension exercise:
- Situation: ${situation}
- Vocabulary theme: ${vocabCategory}
- Content format: ${contentFormat}
- CEFR level: ${level}

${formatInstructions}

Then generate exactly ${Math.min(exerciseTypes.length, questionCount)} questions:
${exerciseInstructions}

Respond with this exact JSON structure only:
{
  "title": "short English title for the scene (max 8 words)",
  "context": "one English sentence describing the scene for the learner before they listen",
  "content": [ { "speaker": "A", "text": "Russian text" }, ... ],
  "questions": [ { "type": "...", ...question fields... }, ... ]
}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method:  "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      MODEL_HAIKU,
        max_tokens: 2000,
        system:     systemPrompt,
        messages:   [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic error:", err);
      return res.status(502).json({ error: "Generation failed" });
    }

    const anthropicData = await response.json();
    const raw   = anthropicData.content?.[0]?.text?.trim() ?? "";
    const clean = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      console.error("JSON parse failed:", raw);
      return res.status(500).json({ error: "Failed to parse generated content", raw });
    }

    // Stable hash for sessionStorage cache keying
    const contentStr = JSON.stringify(parsed.content ?? []);
    let hash = 0;
    for (let i = 0; i < contentStr.length; i++) {
      hash = ((hash << 5) - hash + contentStr.charCodeAt(i)) | 0;
    }
    const contentHash = Math.abs(hash).toString(36);

    return res.status(200).json({
      title:       parsed.title     ?? "Listening Exercise",
      context:     parsed.context   ?? "",
      content:     parsed.content   ?? [],
      questions:   parsed.questions ?? [],
      contentHash,
    });

  } catch (e) {
    console.error("listening-generate error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}