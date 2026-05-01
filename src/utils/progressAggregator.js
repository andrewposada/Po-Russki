// src/utils/progressAggregator.js
//
// Fetches and aggregates all data needed for a progress report.
// Called client-side after the trigger check passes.
// Returns either { insufficientData: true } or a full snapshot object.
//
// Data strategy:
//   - universal_attempts:   DELTA only — since last report date
//   - lesson_completions:   FULL — cumulative curriculum map
//   - words:                AGGREGATE stats only — not every row
//   - reading_log:          DELTA — since last report date
//   - comprehension_attempts: DELTA — since last report date, enriched with book level
//   - progress_reports:     last 3 summaries for trend context
//   - books:                fetched once for level enrichment lookup
//   - user_progress:        current XP + level

import { supabase } from "../supabase";

const MIN_ATTEMPTS = 75;
const MIN_TOPICS   = 3;

export async function buildProgressSnapshot(userId, lastReportDate) {
  const since = lastReportDate ?? new Date(0).toISOString();

  // ── Parallel fetch everything ─────────────────────────────────────────────
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
    // Delta: only new attempts since last report
    supabase
      .from("universal_attempts")
      .select("source_id, topic_id, exercise_type_id, source_ref, word, is_correct, user_answer, correct_answer, feedback_summary, attempted_at")
      .eq("user_id", userId)
      .gte("attempted_at", since)
      .order("attempted_at", { ascending: true }),

    // Full: all lesson completions ever
    supabase
      .from("lesson_completions")
      .select("lesson_id, state, baseline_score, completed_at")
      .eq("user_id", userId),

    // Aggregate: word stats only — select only fields needed for stats
    supabase
      .from("words")
      .select("tier, is_mastered, next_review_at, updated_at")
      .eq("user_id", userId),

    // Delta: reading sessions since last report
    supabase
      .from("reading_log")
      .select("chapter_id, time_spent, started_at")
      .eq("user_id", userId)
      .gte("started_at", since),

    // Delta: comprehension attempts since last report
    supabase
      .from("comprehension_attempts")
      .select("chapter_id, score, attempted_at, questions, answers")
      .eq("user_id", userId)
      .gte("attempted_at", since),

    // Last 3 reports — summary + report_card only
    supabase
      .from("progress_reports")
      .select("generated_at, report")
      .eq("user_id", userId)
      .order("generated_at", { ascending: false })
      .limit(3),

    // All books — for level enrichment
    supabase
      .from("books")
      .select("id, title, level")
      .eq("user_id", userId),

    // XP + level
    supabase
      .from("user_progress")
      .select("xp_total, level")
      .eq("user_id", userId)
      .maybeSingle(),

    // Lesson metadata for completed lessons
    supabase
      .from("lessons")
      .select("id, title, cefr_level")
      .eq("is_core", true),
  ]);

  const attempts      = attemptsRes.data      ?? [];
  const completions   = completionsRes.data   ?? [];
  const words         = wordsRes.data         ?? [];
  const readingSessions = readingRes.data     ?? [];
  const comprehension = comprehensionRes.data ?? [];
  const priorReports  = priorReportsRes.data  ?? [];
  const books         = booksRes.data         ?? [];
  const userProgress  = userProgressRes.data  ?? { xp_total: 0, level: 1 };
  const lessons       = lessonsRes.data       ?? [];

  // ── Threshold check ───────────────────────────────────────────────────────
  if (attempts.length < MIN_ATTEMPTS) {
    return { insufficientData: true, attemptCount: attempts.length };
  }
  const distinctTopics = new Set(attempts.map(a => a.topic_id).filter(Boolean));
  if (distinctTopics.size < MIN_TOPICS) {
    return { insufficientData: true, attemptCount: attempts.length, topicCount: distinctTopics.size };
  }

  // ── Build lesson title map ─────────────────────────────────────────────────
  const lessonMap = Object.fromEntries(lessons.map(l => [l.id, l]));

  // ── Completed lessons list ─────────────────────────────────────────────────
  const LESSON_STATE_COMPLETED = 3;
  const completedLessons = completions
    .filter(c => c.state >= LESSON_STATE_COMPLETED)
    .map(c => ({
      id:          c.lesson_id,
      title:       lessonMap[c.lesson_id]?.title    ?? c.lesson_id,
      cefr_level:  lessonMap[c.lesson_id]?.cefr_level ?? null,
      score:       c.baseline_score ?? null,
      completed_at: c.completed_at,
    }))
    .sort((a, b) => new Date(a.completed_at) - new Date(b.completed_at));

  // ── Accuracy by topic ──────────────────────────────────────────────────────
  const topicMap = {};
  for (const a of attempts) {
    if (!a.topic_id) continue;
    if (!topicMap[a.topic_id]) {
      topicMap[a.topic_id] = { attempts: 0, correct: 0, recentAttempts: 0, recentCorrect: 0, wrongPairs: [] };
    }
    const entry = topicMap[a.topic_id];
    entry.attempts++;
    if (a.is_correct) entry.correct++;

    // "Recent" = last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    if (a.attempted_at >= sevenDaysAgo) {
      entry.recentAttempts++;
      if (a.is_correct) entry.recentCorrect++;
    }

    // Collect wrong pairs for Haiku
    if (!a.is_correct && a.user_answer && a.correct_answer) {
      entry.wrongPairs.push({ wrote: a.user_answer, correct: a.correct_answer });
    }
  }

  const accuracyByTopic = Object.entries(topicMap).map(([topicId, data]) => {
    const accuracy       = data.attempts > 0 ? Math.round((data.correct / data.attempts) * 100) : 0;
    const recentAccuracy = data.recentAttempts > 0
      ? Math.round((data.recentCorrect / data.recentAttempts) * 100)
      : null;
    let trend = "stable";
    if (recentAccuracy !== null) {
      if (recentAccuracy > accuracy + 8)  trend = "improving";
      if (recentAccuracy < accuracy - 8)  trend = "declining";
    }
    return {
      topic_id:        Number(topicId),
      attempts:        data.attempts,
      accuracy,
      recent_accuracy: recentAccuracy,
      trend,
      wrong_pairs:     data.wrongPairs.slice(0, 20), // cap at 20 per topic for Haiku
    };
  }).sort((a, b) => b.attempts - a.attempts);

  // ── Accuracy by exercise type ──────────────────────────────────────────────
  const exTypeMap = {};
  for (const a of attempts) {
    if (!a.exercise_type_id) continue;
    if (!exTypeMap[a.exercise_type_id]) exTypeMap[a.exercise_type_id] = { attempts: 0, correct: 0 };
    exTypeMap[a.exercise_type_id].attempts++;
    if (a.is_correct) exTypeMap[a.exercise_type_id].correct++;
  }
  const accuracyByExerciseType = Object.entries(exTypeMap).map(([exTypeId, data]) => ({
    exercise_type_id: Number(exTypeId),
    attempts:         data.attempts,
    accuracy:         data.attempts > 0 ? Math.round((data.correct / data.attempts) * 100) : 0,
  }));

  // ── Comprehension stats enriched with book level ───────────────────────────
  // Build chapter → book map from comprehension attempt source_refs
  // Comprehension attempts don't directly have book_id — we get it from chapters
  // via source_ref on universal_attempts. For comprehension_attempts table,
  // we use the chapter_id to look up the book level from the books array
  // by joining through the reading_log.
  const bookMap = Object.fromEntries(books.map(b => [b.id, b]));

  // Build chapter → book_id map from reading_log
  const chapterBookMap = {};
  for (const r of readingSessions) {
    if (r.chapter_id && r.book_id) chapterBookMap[r.chapter_id] = r.book_id;
  }

  // Comprehension accuracy by question type and book level
  const compByTypeLevel = {};
  for (const c of comprehension) {
    if (!c.answers) continue;
    for (const [key, answer] of Object.entries(c.answers)) {
      const qType   = answer.question_type_id ?? "unknown";
      const bookId  = chapterBookMap[c.chapter_id];
      const level   = bookId ? (bookMap[bookId]?.level ?? "unknown") : "unknown";
      const mapKey  = `${qType}__${level}`;
      if (!compByTypeLevel[mapKey]) compByTypeLevel[mapKey] = { attempts: 0, correct: 0, question_type_id: qType, book_level: level };
      compByTypeLevel[mapKey].attempts++;
      if ((answer.score ?? 0) >= 0.5) compByTypeLevel[mapKey].correct++;
    }
  }
  const comprehensionStats = Object.values(compByTypeLevel).map(d => ({
    ...d,
    accuracy: d.attempts > 0 ? Math.round((d.correct / d.attempts) * 100) : 0,
  }));

  // ── Vocabulary snapshot ───────────────────────────────────────────────────
  const tierDist = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let overdueCount = 0;
  let masteredCount = 0;
  const now = new Date();
  for (const w of words) {
    const tier = w.tier ?? 0;
    tierDist[tier] = (tierDist[tier] ?? 0) + 1;
    if (w.is_mastered) masteredCount++;
    if (w.next_review_at && new Date(w.next_review_at) < now && !w.is_mastered) overdueCount++;
  }

  // SRS accuracy from vocab attempts in this period
  const vocabAttempts = attempts.filter(a => a.source_id === 2 || a.source_id === 3);
  const vocabAccuracy = vocabAttempts.length > 0
    ? Math.round((vocabAttempts.filter(a => a.is_correct).length / vocabAttempts.length) * 100)
    : null;

  const vocabSnapshot = {
    total_words:       words.length,
    mastered_count:    masteredCount,
    tier_distribution: tierDist,
    overdue_reviews:   overdueCount,
    srs_accuracy:      vocabAccuracy,
  };

  // ── Reading snapshot ──────────────────────────────────────────────────────
  const totalReadingSeconds = readingSessions.reduce((s, r) => s + (r.time_spent ?? 0), 0);
  const lastReadSession     = readingSessions.length > 0
    ? readingSessions.sort((a, b) => new Date(b.started_at) - new Date(a.started_at))[0]
    : null;
  const daysSinceLastRead   = lastReadSession
    ? Math.floor((now - new Date(lastReadSession.started_at)) / (1000 * 60 * 60 * 24))
    : null;

  const readingSnapshot = {
    sessions_in_period:     readingSessions.length,
    total_minutes:          Math.round(totalReadingSeconds / 60),
    days_since_last_read:   daysSinceLastRead,
    books_in_progress:      [...new Set(Object.values(chapterBookMap))].map(id => ({
      id,
      title: bookMap[id]?.title ?? id,
      level: bookMap[id]?.level ?? null,
    })),
  };

  // ── Consistency stats (client-side, no AI needed) ─────────────────────────
  const attemptDates = [...new Set(
    attempts.map(a => a.attempted_at.slice(0, 10))
  )].sort();

  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    return d.toISOString().slice(0, 10);
  });
  const activeDaysLast30 = last30Days.filter(d => attemptDates.includes(d)).length;

  // Streak: consecutive days ending today or yesterday
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

  const consistencyScore = Math.min(10, Math.round((activeDaysLast30 / 20) * 10));

  // ── Free response feedback summaries ─────────────────────────────────────
  const feedbackSummaries = attempts
    .filter(a => a.feedback_summary)
    .map(a => a.feedback_summary);

  // ── Wrong pairs for Haiku (all topics combined) ───────────────────────────
  const allWrongPairs = accuracyByTopic.flatMap(t =>
    t.wrong_pairs.map(p => ({ ...p, topic_id: t.topic_id }))
  );

  // ── Prior report summaries ────────────────────────────────────────────────
  const priorReportSummaries = priorReports
    .filter(r => r.report)
    .map(r => ({
      generated_at: r.generated_at,
      summary:      r.report.summary      ?? null,
      report_card:  r.report.report_card  ?? null,
    }));

  // ── Assemble final snapshot ───────────────────────────────────────────────
  return {
    insufficientData: false,
    generated_at:     now.toISOString(),
    period_start:     since,
    total_new_attempts: attempts.length,

    // What the student has covered — full cumulative list
    completed_lessons: completedLessons,

    // Stats computed client-side
    accuracy_by_topic:         accuracyByTopic,
    accuracy_by_exercise_type: accuracyByExerciseType,
    comprehension_stats:       comprehensionStats,
    vocab_snapshot:            vocabSnapshot,
    reading_snapshot:          readingSnapshot,
    consistency: {
      active_days_last_30: activeDaysLast30,
      current_streak:      streak,
      consistency_score:   consistencyScore,
    },
    user_progress: {
      xp_total: userProgress.xp_total ?? 0,
      level:    userProgress.level    ?? 1,
    },

    // Raw data for Haiku pattern extraction
    wrong_pairs:         allWrongPairs,
    feedback_summaries:  feedbackSummaries,

    // Prior reports for trend context
    prior_reports: priorReportSummaries,
  };
}