// src/utils/progressAggregator.js
//
// Fetches and aggregates all data needed for a progress report.
// Computes all numeric scores deterministically — no AI involvement.
// Serializes tabular data as CSV to minimize tokens sent to AI.
//
// Returns either { insufficientData: true } or a full snapshot object.

import { supabase }          from "../supabase";
import { TOPIC_NAMES_SHORT } from "../constants/topicNames";
import {
  CEFR_THRESHOLDS,
  CEFR_LEVELS,
  GRADE_THRESHOLDS,
  GRADE_WEIGHTS,
  TOPIC_BUCKETS,
  CONSISTENCY_PLUS_MIN,
  CONSISTENCY_MINUS_MAX,
} from "../constants/cefrThresholds";

const MIN_ATTEMPTS = 75;
const MIN_TOPICS   = 3;
const MIN_READING_SESSIONS_FOR_GRADE = 3;

// ── Grade computation helpers ─────────────────────────────────────────────────

function computeLetterGrade(weightedAvg, consistencyScore) {
  const base = GRADE_THRESHOLDS.find(t => weightedAvg >= t.min)?.grade ?? "F";
  if (base === "F") return "F"; // no modifier on F
  let modifier = "";
  if (consistencyScore >= CONSISTENCY_PLUS_MIN)  modifier = "+";
  if (consistencyScore <= CONSISTENCY_MINUS_MAX) modifier = "-";
  // No A+ or D- — cap modifiers
  if (base === "A" && modifier === "+") modifier = "";
  if (base === "D" && modifier === "-") modifier = "";
  return base + modifier;
}

function computeWeightedAverage(
  grammarAcc, vocabRetention,
  readingComp, readingDataSufficient,
  listeningComp, listeningDataSufficient,
) {
  const hasRead   = readingDataSufficient   && readingComp   !== null;
  const hasListen = listeningDataSufficient && listeningComp !== null;

  if (hasRead && hasListen) {
    return Math.round(
      grammarAcc     * GRADE_WEIGHTS.grammar   +
      vocabRetention * GRADE_WEIGHTS.vocab     +
      readingComp    * GRADE_WEIGHTS.reading   +
      listeningComp  * GRADE_WEIGHTS.listening
    );
  }
  if (hasRead) {
    return Math.round(
      grammarAcc     * GRADE_WEIGHTS.grammar_read_only +
      vocabRetention * GRADE_WEIGHTS.vocab_read_only   +
      readingComp    * GRADE_WEIGHTS.reading_only
    );
  }
  if (hasListen) {
    return Math.round(
      grammarAcc     * GRADE_WEIGHTS.grammar_listen_only +
      vocabRetention * GRADE_WEIGHTS.vocab_listen_only   +
      listeningComp  * GRADE_WEIGHTS.listening_only
    );
  }
  return Math.round(
    grammarAcc     * GRADE_WEIGHTS.grammar_no_read +
    vocabRetention * GRADE_WEIGHTS.vocab_no_read
  );
}

// ── Topic bucket classification ───────────────────────────────────────────────

function classifyTopic(attempts, accuracy) {
  if (attempts < TOPIC_BUCKETS.RELIABLE_MIN_ATTEMPTS) return "early";
  if (accuracy >= TOPIC_BUCKETS.RELIABLE_MIN_ACCURACY)   return "reliable";
  if (accuracy >= TOPIC_BUCKETS.DEVELOPING_MIN_ACCURACY) return "developing";
  return "weak";
}

// ── CEFR advancement check ────────────────────────────────────────────────────

function checkCefrAdvancement(currentLevel, computedScores, priorReports, vocabTier2Count) {
  const currentIdx = CEFR_LEVELS.indexOf(currentLevel);
  if (currentIdx === -1 || currentIdx === CEFR_LEVELS.length - 1) return null; // already at max or unknown

  const nextLevel = CEFR_LEVELS[currentIdx + 1];
  const thresholds = CEFR_THRESHOLDS[nextLevel];
  if (!thresholds) return null;

  const {
    grammar_accuracy,
    vocab_tier2_plus,
    reading_comp,
    reading_sessions,
    listening_comp,
    listening_sessions,
    consistency_min,
    consecutive_reports,
    topics_required,
  } = thresholds;

  const meetsGrammar   = computedScores.grammar_accuracy    >= grammar_accuracy;
  const meetsVocab     = vocabTier2Count                    >= vocab_tier2_plus;
  const meetsTopics    = computedScores.reliable_topics     >= topics_required;
  const meetsReading   = reading_comp === null || (
    computedScores.reading_data_sufficient &&
    computedScores.reading_comprehension !== null &&
    computedScores.reading_comprehension >= reading_comp &&
    computedScores.reading_session_count >= reading_sessions
  );
  const meetsListening = listening_comp === null || (
    computedScores.listening_data_sufficient &&
    computedScores.listening_comprehension !== null &&
    computedScores.listening_comprehension >= listening_comp &&
    computedScores.listening_session_count >= listening_sessions
  );
  const meetsConsist   = consistency_min === null || computedScores.consistency_score >= consistency_min;
  const meetsThisRound = meetsGrammar && meetsVocab && meetsTopics && meetsReading && meetsListening && meetsConsist;

  if (!meetsThisRound) return null;

  // Check consecutive_reports requirement
  if (consecutive_reports <= 1) return nextLevel;

  // Check prior reports also met the current level thresholds
  const currentThresholds = CEFR_THRESHOLDS[nextLevel]; // same thresholds, just checking history
  const passingPrior = priorReports.filter(r => {
    const rc = r.report_card ?? {};
    return (
      (rc.grammar_accuracy     ?? 0) >= grammar_accuracy &&
      (rc.consistency_score    ?? 0) >= (consistency_min ?? 0)
    );
  });

  if (passingPrior.length >= consecutive_reports - 1) return nextLevel;
  return null; // thresholds met now but not sustained
}

// ── CSV serializers ───────────────────────────────────────────────────────────

function topicBreakdownToCsv(topics) {
  if (!topics.length) return "";
  const rows = topics.map(t => {
    const name = TOPIC_NAMES_SHORT[t.topic_id] ?? `topic_${t.topic_id}`;
    const acc  = t.bucket === "early" ? "" : t.accuracy;
    return `${name},${acc},${t.attempts},${t.bucket}`;
  });
  return "topic,accuracy,attempts,bucket\n" + rows.join("\n");
}

function wrongPairsToCsv(wrongPairs) {
  if (!wrongPairs.length) return "";
  const rows = wrongPairs.map(p => {
    const name = TOPIC_NAMES_SHORT[p.topic_id] ?? `topic_${p.topic_id}`;
    // Escape commas in answers with quotes
    const wrote   = p.wrote.includes(",")   ? `"${p.wrote}"`   : p.wrote;
    const correct = p.correct.includes(",") ? `"${p.correct}"` : p.correct;
    return `${name},${wrote},${correct}`;
  });
  return "topic,wrote,correct\n" + rows.join("\n");
}

function priorReportsToCsv(priorReports) {
  if (!priorReports.length) return "";
  const rows = priorReports.map(r => {
    const rc   = r.report_card ?? {};
    const date = r.generated_at?.slice(0, 10) ?? "";
    return `${date},${rc.overall_grade ?? ""},${rc.grammar_accuracy ?? ""},${rc.vocab_retention ?? ""},${rc.consistency_score ?? ""}`;
  });
  return "date,grade,grammar,vocab,consistency\n" + rows.join("\n");
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function buildProgressSnapshot(userId, lastReportDate, currentCefrLevel = "A1") {
  const since = lastReportDate ?? new Date(0).toISOString();

  const [
    attemptsRes,
    completionsRes,
    wordsRes,
    readingRes,
    comprehensionRes,
    priorReportsRes,
    booksRes,
    userProgressRes,
    lessonsRes,
  ] = await Promise.all([
    supabase
      .from("universal_attempts")
      .select("source_id, topic_id, word, is_correct, user_answer, correct_answer, feedback_summary, attempted_at")
      .eq("user_id", userId)
      .gte("attempted_at", since)
      .order("attempted_at", { ascending: true }),

    supabase
      .from("lesson_completions")
      .select("lesson_id, state, baseline_score, completed_at")
      .eq("user_id", userId),

    supabase
      .from("words")
      .select("tier, is_mastered, next_review_at")
      .eq("user_id", userId),

    Promise.resolve({ data: [] }), // chapters fetched below after books resolve

    supabase
      .from("comprehension_attempts")
      .select("chapter_id, score, attempted_at")
      .eq("user_id", userId)
      .gte("attempted_at", since),

    supabase
      .from("progress_reports")
      .select("generated_at, report")
      .eq("user_id", userId)
      .order("generated_at", { ascending: false })
      .limit(3),

    supabase
      .from("books")
      .select("id, title, level")
      .eq("user_id", userId),

    supabase
      .from("user_progress")
      .select("xp_total, level")
      .eq("user_id", userId)
      .maybeSingle(),

    supabase
      .from("lessons")
      .select("id, title, cefr_level")
      .eq("is_core", true),
  ]);

  const attempts      = attemptsRes.data      ?? [];
  const completions   = completionsRes.data   ?? [];
  const words         = wordsRes.data         ?? [];
  const comprehension = comprehensionRes.data ?? [];
  const priorReports  = priorReportsRes.data  ?? [];
  const books         = booksRes.data         ?? [];
  const userProgress  = userProgressRes.data  ?? { xp_total: 0, level: 1 };
  const lessons       = lessonsRes.data       ?? [];

  // Fetch completed chapters scoped to this user's books, filtered by last_read_at in period
  const bookIds = books.map(b => b.id);
  let completedChapters = [];
  if (bookIds.length > 0) {
    const chaptersRes = await supabase
      .from("chapters")
      .select("id, book_id, reading_time_seconds, word_count, last_read_at")
      .eq("is_completed", true)
      .in("book_id", bookIds)
      .gte("last_read_at", since);
    completedChapters = chaptersRes.data ?? [];
  }

  // ── Threshold check ──────────────────────────────────────────────────────
  if (attempts.length < MIN_ATTEMPTS) {
    return { insufficientData: true, attemptCount: attempts.length };
  }
  const distinctTopics = new Set(attempts.map(a => a.topic_id).filter(Boolean));
  if (distinctTopics.size < MIN_TOPICS) {
    return { insufficientData: true, attemptCount: attempts.length, topicCount: distinctTopics.size };
  }

  const now = new Date();

  // ── Per-topic accuracy ────────────────────────────────────────────────────
  const topicMap = {};
  for (const a of attempts) {
    if (!a.topic_id) continue;
    if (!topicMap[a.topic_id]) {
      topicMap[a.topic_id] = { attempts: 0, correct: 0, wrongPairs: [] };
    }
    const entry = topicMap[a.topic_id];
    entry.attempts++;
    if (a.is_correct) entry.correct++;
    if (!a.is_correct && a.user_answer && a.correct_answer) {
      entry.wrongPairs.push({ wrote: a.user_answer, correct: a.correct_answer });
    }
  }

  // Build topic breakdown with bucket classification
  const topicBreakdown = Object.entries(topicMap).map(([topicId, data]) => {
    const accuracy = data.attempts > 0 ? Math.round((data.correct / data.attempts) * 100) : 0;
    const bucket   = classifyTopic(data.attempts, accuracy);
    return {
      topic_id:   Number(topicId),
      attempts:   data.attempts,
      accuracy,
      bucket,
      wrongPairs: data.wrongPairs.slice(0, 20),
    };
  }).sort((a, b) => b.attempts - a.attempts);

  // ── Computed: grammar accuracy ────────────────────────────────────────────
  // Average accuracy across reliable + developing topics only
  const scoringTopics = topicBreakdown.filter(t => t.bucket === "reliable" || t.bucket === "developing");
  const reliableTopics = topicBreakdown.filter(t => t.bucket === "reliable");
  const grammarAccuracy = scoringTopics.length > 0
    ? Math.round(scoringTopics.reduce((s, t) => s + t.accuracy, 0) / scoringTopics.length)
    : 0;

  // ── Computed: vocabulary retention ───────────────────────────────────────
  // tier 2+ count / total words seen
  const tier2PlusCount  = words.filter(w => (w.tier ?? 0) >= 2 || w.is_mastered).length;
  const totalWords      = words.length;
  const vocabRetention  = totalWords > 0 ? Math.round((tier2PlusCount / totalWords) * 100) : 0;

  // ── Computed: reading comprehension ──────────────────────────────────────
  // Session count = completed chapters last_read_at within the reporting period.
  // Accuracy comes from comprehension_attempts (unchanged).
  const readingSessionCount = completedChapters.length;
  const readingDataSufficient = readingSessionCount >= MIN_READING_SESSIONS_FOR_GRADE;
  let readingComprehension = null;
  if (readingDataSufficient && comprehension.length > 0) {
    const totalScore = comprehension.reduce((s, c) => s + (c.score ?? 0), 0);
    readingComprehension = Math.round((totalScore / comprehension.length) * 100);
  }

  // ── Computed: listening comprehension ─────────────────────────────────────
  // Listening attempts live in universal_attempts with source_id = 11.
  // A session = a day with ≥ 3 listening attempts (each exercise produces 3–4 attempts).
  // Accuracy = correct / total across all listening attempts in period.
  const listeningAttempts = attempts.filter(a => a.source_id === 11);
  const listeningByDay = {};
  for (const a of listeningAttempts) {
    const day = a.attempted_at.slice(0, 10);
    if (!listeningByDay[day]) listeningByDay[day] = { total: 0, correct: 0 };
    listeningByDay[day].total++;
    if (a.is_correct) listeningByDay[day].correct++;
  }
  // Count days with ≥ 3 attempts as a completed session
  const listeningSessionCount = Object.values(listeningByDay)
    .filter(d => d.total >= 3).length;
  const listeningDataSufficient = listeningSessionCount >= MIN_READING_SESSIONS_FOR_GRADE;
  let listeningComprehension = null;
  if (listeningDataSufficient && listeningAttempts.length > 0) {
    const listeningCorrect = listeningAttempts.filter(a => a.is_correct).length;
    listeningComprehension = Math.round((listeningCorrect / listeningAttempts.length) * 100);
  }

  // ── Computed: consistency ─────────────────────────────────────────────────
  const attemptDates = [...new Set(attempts.map(a => a.attempted_at.slice(0, 10)))].sort();
  const last30Days   = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    return d.toISOString().slice(0, 10);
  });
  const activeDaysLast30 = last30Days.filter(d => attemptDates.includes(d)).length;
  const consistencyScore = Math.min(10, Math.round((activeDaysLast30 / 20) * 10 * 10) / 10);

  // Streak
  let streak = 0;
  const today     = now.toISOString().slice(0, 10);
  const yesterday = new Date(now - 86400000).toISOString().slice(0, 10);
  const dateSet   = new Set(attemptDates);
  let checkDate   = dateSet.has(today) ? today : (dateSet.has(yesterday) ? yesterday : null);
  while (checkDate && dateSet.has(checkDate)) {
    streak++;
    const prev = new Date(new Date(checkDate) - 86400000).toISOString().slice(0, 10);
    checkDate = prev;
  }

  // ── Computed: weighted average + letter grade ────────────────────────────
  const weightedAverage = computeWeightedAverage(
    grammarAccuracy, vocabRetention,
    readingComprehension, readingDataSufficient,
    listeningComprehension, listeningDataSufficient,
  );
  const overallGrade = computeLetterGrade(weightedAverage, consistencyScore);

  // ── Computed scores object (passed to API as ground truth) ───────────────
  const computedScores = {
    grammar_accuracy:           grammarAccuracy,
    vocab_retention:            vocabRetention,
    reading_comprehension:      readingComprehension,
    reading_data_sufficient:    readingDataSufficient,
    reading_session_count:      readingSessionCount,
    listening_comprehension:    listeningComprehension,
    listening_data_sufficient:  listeningDataSufficient,
    listening_session_count:    listeningSessionCount,
    consistency_score:          consistencyScore,
    active_days_last_30:        activeDaysLast30,
    current_streak:             streak,
    weighted_average:           weightedAverage,
    overall_grade:              overallGrade,
    reliable_topics:            reliableTopics.length,
    total_words:                totalWords,
    vocab_tier2_plus:           tier2PlusCount,
  };

  // ── CEFR advancement check ────────────────────────────────────────────────
  const priorReportSummaries = priorReports
    .filter(r => r.report)
    .map(r => ({
      generated_at: r.generated_at,
      summary:      r.report.summary     ?? null,
      report_card:  r.report.report_card ?? null,
    }));

  const cefrAdvanceTo = checkCefrAdvancement(
    currentCefrLevel, computedScores, priorReportSummaries, tier2PlusCount
  );

  // ── Wrong pairs for Haiku (CSV) ────────────────────────────────────────────
  const allWrongPairs = topicBreakdown.flatMap(t =>
    t.wrongPairs.map(p => ({ ...p, topic_id: t.topic_id }))
  );
  const wrongPairsCsv = wrongPairsToCsv(allWrongPairs);

  // ── Topic breakdown for Sonnet (CSV) ─────────────────────────────────────
  const topicBreakdownCsv = topicBreakdownToCsv(topicBreakdown);

  // ── Prior reports for Sonnet (CSV) ────────────────────────────────────────
  const priorReportsCsv = priorReportsToCsv(priorReportSummaries);

  // ── Prior report summaries (prose — not CSV, irregular length) ───────────
  const priorSummaries = priorReportSummaries.map(r => r.summary).filter(Boolean);

  // ── Free response feedback summaries ─────────────────────────────────────
  const feedbackSummaries = attempts
    .filter(a => a.feedback_summary)
    .map(a => a.feedback_summary);

  // ── Lesson completions ───────────────────────────────────────────────────
  const lessonMap = Object.fromEntries(lessons.map(l => [l.id, l]));
  const LESSON_STATE_COMPLETED = 3;
  const completedLessons = completions
    .filter(c => c.state >= LESSON_STATE_COMPLETED)
    .map(c => ({
      id:         c.lesson_id,
      title:      lessonMap[c.lesson_id]?.title      ?? c.lesson_id,
      cefr_level: lessonMap[c.lesson_id]?.cefr_level ?? null,
      score:      c.baseline_score ?? null,
    }));

  return {
    insufficientData: false,
    generated_at:     now.toISOString(),
    period_start:     since,
    total_new_attempts: attempts.length,

    // ── Computed scores — ground truth for AI ──
    computed_scores: computedScores,

    // ── CEFR ──
    current_cefr_level: currentCefrLevel,
    cefr_advance_to:    cefrAdvanceTo,   // null or next level string

    // ── CSV data for AI prompts ──
    wrong_pairs_csv:       wrongPairsCsv,
    topic_breakdown_csv:   topicBreakdownCsv,
    prior_reports_csv:     priorReportsCsv,

    // ── Prose context for Sonnet ──
    prior_summaries:    priorSummaries,
    feedback_summaries: feedbackSummaries,

    // ── Supporting context ──
    completed_lessons: completedLessons,
    user_progress:     { xp_total: userProgress.xp_total ?? 0, level: userProgress.level ?? 1 },
    reading_sessions_in_period: completedChapters.length,
    reading_avg_wpm: (() => {
      const timed = completedChapters.filter(c => c.reading_time_seconds > 0 && c.word_count > 0);
      if (!timed.length) return null;
      const avg = timed.reduce((s, c) => s + (c.word_count / c.reading_time_seconds) * 60, 0) / timed.length;
      return Math.round(avg);
    })(),
  };
}