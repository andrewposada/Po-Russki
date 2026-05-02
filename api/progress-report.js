// api/progress-report.js
// Progress analysis pipeline.
// Step 1: Haiku compresses wrong pairs (CSV in) → error patterns (CSV out).
// Step 2: Sonnet receives computed scores + CSV context → qualitative report only.
//
// POST body: { snapshot }
//   snapshot: output of progressAggregator.buildProgressSnapshot()
//
// Returns: { report } — merged object of computed_scores + Sonnet commentary

export const config = { maxDuration: 45 };

const MODEL_HAIKU  = "claude-haiku-4-5-20251001";
const MODEL_SONNET = "claude-sonnet-4-20250514";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { snapshot } = req.body ?? {};
  if (!snapshot) return res.status(400).json({ error: "Missing snapshot" });

  try {
    const haikuPatterns = await runHaikuCompression(snapshot);
    const sonnetReport  = await runSonnetAnalysis(snapshot, haikuPatterns);

    // Merge: computed_scores is ground truth, Sonnet fills commentary fields
    const report = {
      report_card: {
        overall_grade:           snapshot.computed_scores.overall_grade,
        grammar_accuracy:        snapshot.computed_scores.grammar_accuracy,
        vocab_retention:         snapshot.computed_scores.vocab_retention,
        reading_comprehension:   snapshot.computed_scores.reading_comprehension,
        reading_data_sufficient: snapshot.computed_scores.reading_data_sufficient,
        consistency_score:       snapshot.computed_scores.consistency_score,
        weighted_average:        snapshot.computed_scores.weighted_average,
        vocab_tier2_plus_count:  snapshot.computed_scores.vocab_tier2_plus,
        trend:                   sonnetReport.trend          ?? "stable",
        level_estimate:          sonnetReport.level_estimate ?? snapshot.current_cefr_level,
      },
      summary:              sonnetReport.summary              ?? "",
      strengths:            sonnetReport.strengths            ?? [],
      challenges:           sonnetReport.challenges           ?? [],
      struggling_words:     sonnetReport.struggling_words     ?? [],
      reading_note:         sonnetReport.reading_note         ?? null,
      next_milestone:       sonnetReport.next_milestone       ?? null,
      recommend_level_review: sonnetReport.recommend_level_review ?? false,
      cefr_advance_to:      snapshot.cefr_advance_to,
    };

    return res.json({ report });
  } catch (err) {
    console.error("progress-report error:", err);
    return res.status(500).json({ error: "Report generation failed" });
  }
}

// ── Haiku compression ──────────────────────────────────────────────────────────

async function runHaikuCompression(snapshot) {
  const { wrong_pairs_csv, feedback_summaries } = snapshot;

  if (!wrong_pairs_csv && (!feedback_summaries || feedback_summaries.length === 0)) {
    return "";
  }

  const feedbackBlock = feedback_summaries?.length
    ? "\n\nFREE RESPONSE FEEDBACK:\n" + feedback_summaries.join("\n")
    : "";

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type":      "application/json",
      "x-api-key":         process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model:      MODEL_HAIKU,
      max_tokens: 600,
      system: `You are a Russian language error analyst.
Compress student error data into a brief CSV summary.
Do NOT make recommendations. Do NOT filter errors out. Be precise with linguistic terms.
Output ONLY the CSV — no preamble, no explanation, no markdown.`,
      messages: [{
        role: "user",
        content: `Student wrong answers (topic,wrote,correct):
${wrong_pairs_csv}${feedbackBlock}

Output a CSV summarizing error patterns. Format:
topic,pattern,severity,example_wrote,example_correct
One row per distinct error pattern. severity = high/medium/low based on frequency.
Combine minor variations of the same pattern into one row.`,
      }],
    }),
  });

  const data = await response.json();
  return data?.content?.[0]?.text?.trim() ?? "";
}

// ── Sonnet analysis ────────────────────────────────────────────────────────────

async function runSonnetAnalysis(snapshot, haikuPatternsCsv) {
  const {
    computed_scores,
    current_cefr_level,
    cefr_advance_to,
    topic_breakdown_csv,
    prior_reports_csv,
    prior_summaries,
    completed_lessons,
    reading_sessions_in_period,
  } = snapshot;

  // Build the CEFR next-level summary for Sonnet commentary
  // We tell Sonnet what level the user is at and what they need for the next level
  // without sending the full thresholds object (too verbose)
  const cefrContext = buildCefrContext(current_cefr_level, computed_scores, cefr_advance_to);

  const input = `COMPUTED SCORES (ground truth — do not recalculate):
grade:${computed_scores.overall_grade} weighted_avg:${computed_scores.weighted_average}% grammar:${computed_scores.grammar_accuracy}% vocab_retention:${computed_scores.vocab_retention}% reading:${computed_scores.reading_comprehension ?? "no_data"} consistency:${computed_scores.consistency_score}/10 streak:${computed_scores.current_streak}days

READING: ${computed_scores.reading_data_sufficient ? `${computed_scores.reading_session_count} sessions, ${computed_scores.reading_comprehension}% accuracy` : `insufficient data (${computed_scores.reading_session_count} sessions, need 3)`}

TOPIC BREAKDOWN (topic,accuracy,attempts,bucket):
${topic_breakdown_csv}

ERROR PATTERNS (topic,pattern,severity,example_wrote,example_correct):
${haikuPatternsCsv || "none"}

CEFR:
${cefrContext}

PRIOR REPORTS (date,grade,grammar,vocab,consistency):
${prior_reports_csv || "none"}

PRIOR SUMMARIES:
${prior_summaries.join("\n---\n") || "none"}

LESSONS COMPLETED: ${completed_lessons.length} core lessons`;

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
Write warmly and directly to the student. Be specific — reference actual topics and error patterns.
Do not mention data, AI, or analytics. Sound like a teacher who has been watching their progress.

CRITICAL: The grade, all percentage scores, and consistency score are pre-calculated and given to you as ground truth.
Do NOT recalculate, adjust, or contradict any numeric score. Your job is to explain and enrich these numbers, not produce them.

Output ONLY valid JSON — no preamble, no markdown fences.

ACTION ROUTE RULES — use exactly these formats:
- Grammar freeplay targeted: /grammar/freeplay?topics=TOPIC_ID (use the numeric topic ID)
- Vocabulary session: /vocabulary/session
- Library: /library
- Specific lesson: /lessons/play/LESSON_ID
- Assignments: /lessons/assignments`,
      messages: [{
        role: "user",
        content: `Review this student's data and return a report.

${input}

Return ONLY this JSON:
{
  "trend": "improving|stable|declining",
  "level_estimate": "<where they sit within their current CEFR level, e.g. 'mid A2' or 'approaching B1'>",
  "summary": "<3-5 sentences to the student. Teacher voice. Cover trajectory, strengths, what needs work. Reference their grade naturally.>",
  "strengths": [
    { "topic": "<string>", "comment": "<1-2 sentences, specific>" }
  ],
  "challenges": [
    {
      "topic": "<string>",
      "comment": "<2-3 sentences. What the pattern is, why it matters, what to focus on.>",
      "action": { "label": "<short label>", "route": "<exact route>" },
      "lesson_brief": {
        "title": "<string>",
        "focus": "<1 sentence>",
        "prompt_for_opus": "<2-3 sentence brief to paste into Claude Opus to generate a lesson JSON>"
      }
    }
  ],
  "struggling_words": ["<Russian word>"],
  "reading_note": "<string or null — comment on reading. If insufficient data, explain what practicing in the Library would do for their grade.>",
  "next_milestone": "<1 sentence about what the next concrete improvement looks like>",
  "cefr_commentary": "<2-3 sentences about where they stand in their current CEFR level and what the clearest gap is to the next level>",
  "recommend_level_review": <true if data strongly suggests readiness to advance CEFR level, false otherwise>
}

RULES:
- Maximum 3 challenges, ranked by impact
- lesson_brief only if a targeted lesson would genuinely help — omit if not
- struggling_words: specific Russian words from error patterns that appear multiple times — empty array if none
- trend: compare current scores to prior_reports if available; otherwise "stable"
- If reading is insufficient, reading_note should explain the grade impact warmly
- No bullet points in text fields`,
      }],
    }),
  });

  const data = await response.json();
  const raw  = data?.content?.[0]?.text ?? "{}";
  try {
    return JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch {
    return { trend: "stable", summary: "", strengths: [], challenges: [], struggling_words: [] };
  }
}

// ── CEFR context builder ───────────────────────────────────────────────────────

function buildCefrContext(currentLevel, computedScores, cefrAdvanceTo) {
  const levelMap = {
    A1: { next: "A2", grammarNeed: 65, vocabNeed: 500,  readNeed: 50,  topicsNeed: 6  },
    A2: { next: "B1", grammarNeed: 70, vocabNeed: 1200, readNeed: 60,  topicsNeed: 10 },
    B1: { next: "B2", grammarNeed: 78, vocabNeed: 2500, readNeed: 72,  topicsNeed: 15 },
    B2: { next: null, grammarNeed: null, vocabNeed: null, readNeed: null, topicsNeed: null },
  };
  const info = levelMap[currentLevel] ?? levelMap["A1"];

  let lines = [`current_level:${currentLevel}`];
  if (info.next) {
    lines.push(`next_level:${info.next}`);
    lines.push(`grammar_gap:${computedScores.grammar_accuracy}%_of_${info.grammarNeed}%_needed`);
    lines.push(`vocab_gap:${computedScores.vocab_tier2_plus}_of_${info.vocabNeed}_words_needed`);
    if (info.readNeed) {
      const readVal = computedScores.reading_data_sufficient ? `${computedScores.reading_comprehension}%` : "no_data";
      lines.push(`reading_gap:${readVal}_of_${info.readNeed}%_needed`);
    }
    lines.push(`reliable_topics:${computedScores.reliable_topics}_of_${info.topicsNeed}_needed`);
    if (cefrAdvanceTo) lines.push(`advancement_eligible:true`);
  } else {
    lines.push("at_maximum_tracked_level");
  }
  return lines.join(" | ");
}