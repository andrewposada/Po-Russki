// api/progress-report.js
// Progress analysis pipeline.
// Step 1: Haiku compresses raw wrong pairs + feedback summaries into patterns.
// Step 2: Sonnet receives the full snapshot + Haiku patterns and returns a report.
//
// POST body: { userId, snapshot }
//   snapshot: output of progressAggregator.buildProgressSnapshot()
//
// Returns: structured report JSON (see schema in response)

export const config = { maxDuration: 45 };

const MODEL_HAIKU  = "claude-haiku-4-5-20251001";
const MODEL_SONNET = "claude-sonnet-4-20250514";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { snapshot } = req.body ?? {};
  if (!snapshot) return res.status(400).json({ error: "Missing snapshot" });

  try {
    // ── Step 1: Haiku — compress wrong pairs + feedback into patterns ────────
    const haikuPatterns = await runHaikuCompression(snapshot);

    // ── Step 2: Sonnet — full pedagogical analysis ───────────────────────────
    const report = await runSonnetAnalysis(snapshot, haikuPatterns);

    return res.json({ report });
  } catch (err) {
    console.error("progress-report error:", err);
    return res.status(500).json({ error: "Report generation failed" });
  }
}

// ── Haiku compression ─────────────────────────────────────────────────────────

async function runHaikuCompression(snapshot) {
  const { wrong_pairs, feedback_summaries } = snapshot;

  // If nothing to compress, skip the call
  if (wrong_pairs.length === 0 && feedback_summaries.length === 0) {
    return { grammar_patterns: [], vocabulary_patterns: [], qualitative_patterns: [] };
  }

  // Group wrong pairs by topic_id for readability
  const byTopic = {};
  for (const p of wrong_pairs) {
    const key = String(p.topic_id ?? "unknown");
    if (!byTopic[key]) byTopic[key] = [];
    byTopic[key].push({ wrote: p.wrote, correct: p.correct });
  }

  const inputText = JSON.stringify({
    wrong_pairs_by_topic: byTopic,
    free_response_feedback: feedback_summaries,
  });

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type":      "application/json",
      "x-api-key":         process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model:      MODEL_HAIKU,
      max_tokens: 800,
      system: `You are a Russian language learning data analyst.
Your ONLY job is to organize and compress student error data into a clean structured summary.
Do NOT make teaching recommendations. Do NOT filter anything out.
Be precise with linguistic terminology.
Output ONLY valid JSON — no preamble, no markdown fences.`,
      messages: [{
        role: "user",
        content: `Analyze these student errors and feedback. Return ONLY this JSON structure:
{
  "grammar_patterns": [
    {
      "topic_id": <number — the topic_id from the input>,
      "pattern": "<precise linguistic description of what errors have in common>",
      "example_errors": [{"wrote": "<string>", "correct": "<string>"}],
      "severity": "high|medium|low — based only on frequency and consistency"
    }
  ],
  "vocabulary_patterns": [
    {
      "topic_id": <number or null>,
      "pattern": "<what errors reveal about lexical understanding>",
      "example_errors": [{"wrote": "<string>", "correct": "<string>"}],
      "severity": "high|medium|low"
    }
  ],
  "qualitative_patterns": [
    {
      "source": "free_response",
      "pattern": "<recurring theme from feedback summaries>",
      "severity": "high|medium|low"
    }
  ]
}

INPUT DATA:
${inputText}`,
      }],
    }),
  });

  const data = await response.json();
  const raw  = data?.content?.[0]?.text ?? "{}";
  try {
    return JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch {
    return { grammar_patterns: [], vocabulary_patterns: [], qualitative_patterns: [] };
  }
}

// ── Sonnet analysis ───────────────────────────────────────────────────────────

async function runSonnetAnalysis(snapshot, haikuPatterns) {
  // Build a clean input — strip wrong_pairs and feedback_summaries (already processed by Haiku)
  const {
    wrong_pairs,
    feedback_summaries,
    accuracy_by_topic,
    ...cleanSnapshot
  } = snapshot;

  // Include accuracy_by_topic but without wrong_pairs per topic
  const topicsForSonnet = accuracy_by_topic.map(({ wrong_pairs: _wp, ...rest }) => rest);

  const sonnetInput = JSON.stringify({
    ...cleanSnapshot,
    accuracy_by_topic: topicsForSonnet,
    error_patterns:    haikuPatterns,
  });

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type":      "application/json",
      "x-api-key":         process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model:      MODEL_SONNET,
      max_tokens: 1200,
      system: `You are an experienced Russian language teacher reviewing a student's progress data.
Write as if speaking directly and warmly to the student.
Be specific — reference actual topics and patterns from the data.
Do not mention data, analytics, or AI. Sound like a teacher who has been watching their progress.
Output ONLY valid JSON — no preamble, no markdown fences.

ACTION ROUTE RULES — use exactly these formats:
- Grammar freeplay targeted: /grammar/freeplay?topics=TOPIC_ID
- Vocabulary session (SRS): /vocabulary/session
- Library (reading): /library
- Specific lesson: /lessons/play/LESSON_ID
- Assignments queue: /lessons/assignments`,
      messages: [{
        role: "user",
        content: `Review this student's progress data and return a report.

STUDENT DATA:
${sonnetInput}

Return ONLY this JSON structure:
{
  "report_card": {
    "overall_grade": "<letter grade A through F with + or ->",
    "trend": "improving|stable|declining",
    "consistency_score": <1-10 integer>,
    "grammar_accuracy": <0-100 integer — overall from accuracy_by_topic>,
    "vocab_retention": <0-100 integer — from vocab_snapshot.srs_accuracy, or null if no data>,
    "reading_comprehension": <0-100 integer — from comprehension_stats, or null if no data>,
    "level_estimate": "<e.g. solid A2, approaching B1>"
  },
  "summary": "<3-5 sentences spoken directly to the student. Teacher voice. Cover overall trajectory, what is going well, what needs attention.>",
  "strengths": [
    { "topic": "<string>", "comment": "<1-2 sentences, specific and genuine>" }
  ],
  "challenges": [
    {
      "topic": "<string>",
      "comment": "<2-3 sentences. What the pattern is, why it matters, what to focus on.>",
      "action": {
        "label": "<short button label e.g. Drill it now>",
        "route": "<exact route from ACTION ROUTE RULES>"
      },
      "lesson_brief": {
        "title": "<string>",
        "focus": "<1 sentence>",
        "prompt_for_opus": "<2-3 sentence brief the student pastes into Claude Opus to generate a lesson JSON>"
      }
    }
  ],
  "struggling_words": ["<word>"],
  "reading_note": "<string or null — only if reading data warrants a comment>",
  "next_milestone": "<1 sentence about what unlocking next looks like for this student>"
}

RULES:
- Maximum 3 challenges, ranked by impact
- lesson_brief only if a targeted lesson would genuinely help — not required on every challenge
- struggling_words: list specific Russian words from wrong_pairs that appear multiple times — empty array if none
- Only comment on reading if there is reading data or a notable absence of it
- Keep summary and comments natural — no bullet points, no technical jargon`,
      }],
    }),
  });

  const data = await response.json();
  const raw  = data?.content?.[0]?.text ?? "{}";
  return JSON.parse(raw.replace(/```json|```/g, "").trim());
}