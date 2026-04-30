// ============================================================
// По-русски — Storage Adapter
// All reads/writes go through this file.
// Components never import supabase directly.
// Pass userId (from Firebase user.uid) into every function that needs it.
// ============================================================

import { supabase } from "./supabase";

// ── Reference cache ───────────────────────────────────────────────────────
let _refCache = null;
export async function getRefCache() {
  if (_refCache) return _refCache;
  const [domains, caseNames, pos, numbers, tenses, aspects, verbClasses, exTypes, sessionTypes] =
    await Promise.all([
      supabase.from("domains").select("id,name"),
      supabase.from("case_names").select("id,name"),
      supabase.from("parts_of_speech").select("id,name"),
      supabase.from("numbers").select("id,name"),
      supabase.from("tenses").select("id,name"),
      supabase.from("aspects").select("id,name"),
      supabase.from("verb_classes").select("id,name"),
      supabase.from("exercise_types").select("id,name,domain_id"),
      supabase.from("session_types").select("id,name"),
    ]);
  const toMap = (r) => Object.fromEntries(r.data.map(x => [x.name, x.id]));
  _refCache = {
    domain:      toMap(domains),
    caseName:    toMap(caseNames),
    pos:         toMap(pos),
    number:      toMap(numbers),
    tense:       toMap(tenses),
    aspect:      toMap(aspects),
    verbClass:   toMap(verbClasses),
    exType:      exTypes.data,
    sessionType: toMap(sessionTypes),
  };
  return _refCache;
}

// ── USER SETTINGS ──────────────────────────────────────────────────────────

export async function getSettings(userId) {
  const { data, error } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function saveSettings(userId, { cefrLevel, cursiveFont, transliteration }) {
  const { error } = await supabase
    .from("user_settings")
    .upsert({
      user_id:         userId,
      cefr_level:      cefrLevel        ?? "A2",
      cursive_font:    cursiveFont      ?? false,
      transliteration: transliteration  ?? false,
      updated_at:      new Date(),
    }, { onConflict: "user_id" });
  if (error) throw error;
}

// ── WORDS ─────────────────────────────────────────────────────────────────

export async function getWords(userId) {
  const { data, error } = await supabase
    .from("words")
    .select("*")
    .eq("user_id", userId);
  if (error) throw error;
  return data;
}

export async function upsertWord(userId, wordObj) {
  const { error } = await supabase
    .from("words")
    .upsert({
      user_id:       userId,
      word:          wordObj.word,
      translation:   wordObj.translation   ?? null,
      pronunciation: wordObj.pronunciation ?? null,
      etymology:     wordObj.etymology     ?? null,
      usage_example: wordObj.usageExample  ?? wordObj.usage_example ?? null,
      cefr_level:    wordObj.cefrLevel     ?? null,
      proficiency:   wordObj.proficiency   ?? 0,
      is_mastered:   wordObj.isMastered    ?? wordObj.is_mastered ?? false,
      updated_at:    new Date(),
    }, { onConflict: "user_id,word" });
  if (error) throw error;
}

export async function deleteWord(userId, word) {
  const { error } = await supabase
    .from("words")
    .delete()
    .eq("user_id", userId)
    .eq("word", word);
  if (error) throw error;
}

// ── VOCABULARY SRS ─────────────────────────────────────────────────────────

/**
 * Fetch words due for review (next_review_at <= now OR never reviewed).
 * Returns up to `limit` rows ordered by most overdue first.
 * Words with null next_review_at are treated as immediately due.
 * If a session has fewer than 4 unique due words, pads with mastered words
 * so the Matching card always has a full set of 4.
 */
export async function getDueWords(userId, limit = 10000) {
  // Primary: non-mastered words with null next_review_at (never reviewed)
  // + any word (mastered or not) whose next_review_at is genuinely past due.
  // Mastered words with null next_review_at are excluded from the primary
  // fetch — they only appear via the padding fallback below.
  const { data: due, error: dueErr } = await supabase
    .from("words")
    .select("*")
    .eq("user_id", userId)
    .or(
      "and(is_mastered.eq.false,next_review_at.is.null)," +
      "next_review_at.lte." + new Date().toISOString()
    )
    .order("next_review_at", { ascending: true, nullsFirst: true })
    .limit(limit);
  if (dueErr) throw dueErr;

  if (due.length >= 4) return due;

  // Pad with any non-due words to ensure Matching always has a full set of 4.
  // Ordered by next_review_at ASC so soonest-due words are preferred over
  // mastered words sitting at 30-day intervals.
  const dueIds = due.map(w => w.id);
  const needed = 4 - due.length;
  const { data: padded, error: padErr } = await supabase
    .from("words")
    .select("*")
    .eq("user_id", userId)
    .not("id", "in", `(${dueIds.length > 0 ? dueIds.join(",") : "00000000-0000-0000-0000-000000000000"})`)
    .order("next_review_at", { ascending: true, nullsFirst: false })
    .limit(needed);
  if (padErr) throw padErr;

  return [...due, ...(padded ?? [])];
}

/**
 * Update SRS fields on a word after a review.
 * Also toggles last_exercise_was_cloze for Tier 2 alternation.
 * Called by the client after receiving calculated values from api/srs-update.js.
 */
export async function updateWordSrs(userId, wordId, {
  next_review_at,
  interval_days,
  ease_factor,
  review_count,
  tier,
  tier_streak,
  is_mastered,
}) {
  const payload = {
    next_review_at,
    interval_days,
    ease_factor,
    review_count,
    updated_at: new Date(),
  };
  // Only write optional fields if explicitly provided
  if (typeof tier === "number")        payload.tier        = tier;
  if (typeof tier_streak === "number") payload.tier_streak = tier_streak;
  if (typeof is_mastered === "boolean") payload.is_mastered = is_mastered;
  const { error } = await supabase
    .from("words")
    .update(payload)
    .eq("id", wordId)
    .eq("user_id", userId);
  if (error) throw error;
}

/**
 * Fetch the full word bank for the flashcard deck,
 * ordered by most overdue first (soonest next_review_at last).
 */
export async function getFlashcardDeck(userId) {
  const { data, error } = await supabase
    .from("words")
    .select("*")
    .eq("user_id", userId)
    .order("next_review_at", { ascending: true, nullsFirst: true });
  if (error) throw error;
  return data;
}

// ── SCORES ─────────────────────────────────────────────────────────────────

export async function getScores(userId, domainName) {
  const ref = await getRefCache();
  const { data, error } = await supabase
    .from("scores")
    .select("*")
    .eq("user_id", userId)
    .eq("domain_id", ref.domain[domainName]);
  if (error) throw error;
  return data;
}

export async function upsertScoreByIds(userId, {
  domainId, caseNameId, posId, numberId,
  tenseId, aspectId, verbClassId, topicLabel, score,
}) {
  const { error } = await supabase
    .from("scores")
    .upsert({
      user_id:           userId,
      domain_id:         domainId,
      case_name_id:      caseNameId   ?? null,
      part_of_speech_id: posId        ?? null,
      number_id:         numberId     ?? null,
      tense_id:          tenseId      ?? null,
      aspect_id:         aspectId     ?? null,
      verb_class_id:     verbClassId  ?? null,
      topic_label:       topicLabel   ?? null,
      score:             score        ?? 30,
      updated_at:        new Date(),
    }, {
      onConflict: "user_id,domain_id,case_name_id,part_of_speech_id,number_id,tense_id,aspect_id,verb_class_id"
    });
  if (error) throw error;
}

// ── NARRATIVES ─────────────────────────────────────────────────────────────

export async function getNarrative(userId, domainName) {
  const ref = await getRefCache();
  const { data, error } = await supabase
    .from("narratives")
    .select("content, answer_buf")
    .eq("user_id", userId)
    .eq("domain_id", ref.domain[domainName])
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function saveNarrative(userId, domainName, content, answerBuf) {
  const ref = await getRefCache();
  const { error } = await supabase
    .from("narratives")
    .upsert({
      user_id:    userId,
      domain_id:  ref.domain[domainName],
      content:    content   ?? "",
      answer_buf: answerBuf ?? [],
      updated_at: new Date(),
    }, { onConflict: "user_id,domain_id" });
  if (error) throw error;
}

// ── SESSIONS ───────────────────────────────────────────────────────────────

export async function createSession(userId, { sessionTypeName, domainName }) {
  const ref = await getRefCache();
  const { data, error } = await supabase
    .from("sessions")
    .insert({
      user_id:         userId,
      session_type_id: ref.sessionType[sessionTypeName],
      domain_id:       domainName ? ref.domain[domainName] : null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function closeSession(sessionId, { totalAttempts, correctCount }) {
  const { error } = await supabase
    .from("sessions")
    .update({
      ended_at:       new Date(),
      is_complete:    true,
      total_attempts: totalAttempts ?? 0,
      correct_count:  correctCount  ?? 0,
    })
    .eq("id", sessionId);
  if (error) throw error;
}

export async function closeAbandonedSessions(userId) {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from("sessions")
    .update({ ended_at: new Date() })
    .eq("user_id", userId)
    .eq("is_complete", false)
    .lt("last_active_at", cutoff)
    .is("ended_at", null);
  if (error) console.warn("Could not close abandoned sessions:", error.message);
}

// ── EXERCISE ATTEMPTS ──────────────────────────────────────────────────────

export async function saveAttempt(userId, attempt) {
  const ref    = await getRefCache();
  const exType = ref.exType.find(
    e => e.domain_id === attempt.domainId && e.name === attempt.exerciseTypeName
  );
  const { data, error } = await supabase
    .from("exercise_attempts")
    .insert({
      user_id:           userId,
      session_id:        attempt.sessionId,
      domain_id:         attempt.domainId,
      exercise_type_id:  exType?.id         ?? null,
      case_name_id:      attempt.caseNameId  ?? null,
      part_of_speech_id: attempt.posId       ?? null,
      number_id:         attempt.numberId    ?? null,
      tense_id:          attempt.tenseId     ?? null,
      aspect_id:         attempt.aspectId    ?? null,
      verb_class_id:     attempt.verbClassId ?? null,
      word_id:           attempt.wordId      ?? null,
      question:          attempt.question,
      choices:           attempt.choices     ?? null,
      correct_answer:    attempt.correctAnswer,
      user_answer:       attempt.userAnswer,
      is_correct:        attempt.isCorrect,
      response_time_ms:  attempt.responseTimeMs  ?? null,
      is_migration_seed: attempt.isMigrationSeed ?? false,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

// ── RETRY QUEUE ────────────────────────────────────────────────────────────

export async function getRetryQueue(userId) {
  const { data, error } = await supabase
    .from("retry_queue")
    .select(`
      id,
      error_count,
      added_at,
      exercise_attempts (
        domain_id,
        case_name_id,
        part_of_speech_id,
        number_id,
        tense_id,
        aspect_id,
        verb_class_id,
        word_id,
        question,
        correct_answer
      )
    `)
    .eq("user_id", userId);
  if (error) throw error;
  return data;
}

export async function addToRetryQueue(userId, lastAttemptId) {
  const { error } = await supabase
    .from("retry_queue")
    .insert({ user_id: userId, last_attempt_id: lastAttemptId });
  if (error) throw error;
}

export async function removeFromRetryQueue(retryQueueId) {
  const { error } = await supabase
    .from("retry_queue")
    .delete()
    .eq("id", retryQueueId);
  if (error) throw error;
}

// ── BOOKS ──────────────────────────────────────────────────────────────────

export async function getBooks(userId) {
  const { data, error } = await supabase
    .from("books")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function upsertBook(userId, bookObj) {
  const payload = {
    user_id:          userId,
    title:            bookObj.title,
    level:            bookObj.level          ?? null,
    synopsis:         bookObj.synopsis       ?? null,
    scaffold:         bookObj.scaffold       ?? null,
    genres:           bookObj.genres         ?? null,
    total_chapters:   bookObj.totalChapters  ?? null,
    cover_color:      bookObj.coverColor     ?? null,
    cover_image:      bookObj.coverImage     ?? null,
    is_archived:      bookObj.isArchived     ?? false,
    updated_at:       new Date(),
  };
  if (bookObj.id) {
    const { error } = await supabase
      .from("books")
      .update(payload)
      .eq("id", bookObj.id);
    if (error) throw error;
    return bookObj.id;
  } else {
    const { data, error } = await supabase
      .from("books")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  }
}

export async function updateBook(userId, bookId, fields) {
  const { error } = await supabase
    .from("books")
    .update({ ...fields, updated_at: new Date() })
    .eq("id", bookId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function deleteBook(userId, bookId) {
  const { error } = await supabase
    .from("books")
    .delete()
    .eq("id", bookId)
    .eq("user_id", userId);
  if (error) throw error;
}

// ── CHAPTERS ───────────────────────────────────────────────────────────────

export async function getChapters(userId, bookId) {
  const { data, error } = await supabase
    .from("chapters")
    .select("*")
    .eq("book_id", bookId)
    .order("chapter_num", { ascending: true });
  if (error) throw error;
  return data;
}

export async function upsertChapter(userId, chapterObj) {
  const { error } = await supabase
    .from("chapters")
    .upsert({
      book_id:         chapterObj.bookId,
      chapter_num:     chapterObj.chapterNum,
      title:           chapterObj.title        ?? null,
      content:         chapterObj.content      ?? null,
      last_sentence:   chapterObj.lastSentence ?? null,
      word_count:      chapterObj.wordCount    ?? null,
      questions:       null,
    }, { onConflict: "book_id,chapter_num" });
  if (error) throw error;
}

export async function saveQuestions(userId, chapterId, questions) {
  const { error } = await supabase
    .from("chapters")
    .update({
      questions:               questions,
      questions_generated_at:  new Date(),
    })
    .eq("id", chapterId);
  if (error) throw error;
}

export async function updateChapter(userId, chapterId, fields) {
  const { error } = await supabase
    .from("chapters")
    .update(fields)
    .eq("id", chapterId);
  if (error) throw error;
}

// ── COMPREHENSION ATTEMPTS ─────────────────────────────────────────────────

export async function getAttempt(userId, chapterId) {
  const { data, error } = await supabase
    .from("comprehension_attempts")
    .select("*")
    .eq("user_id", userId)
    .eq("chapter_id", chapterId)
    .order("attempted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function upsertAttempt(userId, attemptObj) {
  const payload = {
    user_id:    userId,
    chapter_id: attemptObj.chapterId,
    questions:  attemptObj.questions ?? null,
    answers:    attemptObj.answers   ?? null,
    score:      attemptObj.score     ?? null,
  };
  if (attemptObj.id) {
    const { error } = await supabase
      .from("comprehension_attempts")
      .update(payload)
      .eq("id", attemptObj.id);
    if (error) throw error;
    return attemptObj.id;
  } else {
    const { data, error } = await supabase
      .from("comprehension_attempts")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  }
}

// ── READING LOG ────────────────────────────────────────────────────────────
export async function upsertReadingSession(userId, sessionObj) {
  console.log("upsertReadingSession called with:", { userId, sessionObj });  // ← ADD THIS
  const { error } = await supabase
    .from("reading_log")
    .upsert(
      {
        user_id:      userId,
        session_id:   sessionObj.sessionId,
        chapter_id:   sessionObj.chapterId,
        started_at:   sessionObj.startedAt ?? new Date(),
        completed_at: sessionObj.completedAt ?? null,
        time_spent:   sessionObj.timeSpent ?? 0,
      },
      { onConflict: "session_id,chapter_id" }
    );
  if (error) {
    console.error("upsertReadingSession error:", error);  // ← ADD THIS
    throw error;
  }
}

export async function getChapterPriorTime(userId, chapterId) {
  const { data, error } = await supabase
    .from("reading_log")
    .select("time_spent")
    .eq("user_id", userId)
    .eq("chapter_id", chapterId);
  if (error) throw error;
  return (data ?? []).reduce((sum, row) => sum + (row.time_spent ?? 0), 0);
}

export async function getReadingLog(userId, bookId) {
  const { data, error } = await supabase
    .from("reading_log")
    .select("*, chapters!inner(book_id, word_count)")
    .eq("user_id", userId)
    .eq("chapters.book_id", bookId);
  if (error) throw error;
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// LESSONS
// ─────────────────────────────────────────────────────────────────────────────

export async function getLessonById(lessonId) {
  const { data, error } = await supabase
    .from("lessons")
    .select("*")
    .eq("id", lessonId)
    .maybeSingle();
  if (error) { console.error("getLessonById:", error); return null; }
  return data;
}


export async function getCoreLessons() {
  const { data, error } = await supabase
    .from('lessons')
    .select('id, title, cefr_level, xp_reward, is_core, created_at')
    .eq('is_core', true)
    .order('created_at', { ascending: true });
  if (error) { console.error('getCoreLessons:', error); return []; }
  return data ?? [];
}

export async function getUserLessons(userId) {
  // Returns non-core lessons the user has a completion row for
  const { data, error } = await supabase
    .from('lessons')
    .select('id, title, cefr_level, xp_reward, is_core, created_at')
    .eq('is_core', false)
    .order('created_at', { ascending: false });
  if (error) { console.error('getUserLessons:', error); return []; }
  return data ?? [];
}

export async function insertLesson(userId, lessonData) {
  const { id, title, is_core, cefr_level, xp_reward, ...contentFields } = lessonData;
  const payload = {
    id,
    title,
    is_core:     is_core     ?? false,
    cefr_level:  cefr_level  ?? null,
    xp_reward:   xp_reward   ?? 100,
    content:     contentFields,
    inserted_by: userId,
  };
  const { data, error } = await supabase
    .from('lessons')
    .insert(payload)
    .select()
    .single();
  if (error) {
    console.error('insertLesson:', error);
    throw error;
  }
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// LESSON COMPLETIONS
// ─────────────────────────────────────────────────────────────────────────────

export async function getLessonCompletion(userId, lessonId) {
  const { data, error } = await supabase
    .from('lesson_completions')
    .select('*')
    .eq('user_id', userId)
    .eq('lesson_id', lessonId)
    .single();
  // PGRST116 = row not found — not an error, just means lesson not yet started
  if (error && error.code !== 'PGRST116') {
    console.error('getLessonCompletion:', error);
  }
  return data ?? null;
}

export async function upsertLessonCompletion(userId, lessonId, fields) {
  const { data, error } = await supabase
    .from('lesson_completions')
    .upsert(
      {
        user_id:        userId,
        lesson_id:      lessonId,
        ...fields,
        last_active_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,lesson_id' }
    )
    .select()
    .single();
  if (error) { console.error('upsertLessonCompletion:', error); return null; }
  return data;
}

export async function getAllLessonCompletions(userId) {
  // Returns ALL completion rows for this user across all lessons.
  // Callers build a completionsMap: { [lessonId]: row } for roadmap rendering.
  // With multi-lesson nodes, one roadmap node may have 2–5 completion rows.
  const { data, error } = await supabase
    .from('lesson_completions')
    .select('*')
    .eq('user_id', userId);
  if (error) { console.error('getAllLessonCompletions:', error); return []; }
  return data ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────
// LESSON ANSWERS
// ─────────────────────────────────────────────────────────────────────────────

export async function saveLessonAnswer(userId, lessonId, groupName, blockType, prompt, answer, grade) {
  const { data, error } = await supabase
    .from('lesson_answers')
    .insert({
      user_id:    userId,
      lesson_id:  lessonId,
      group_name: groupName,
      block_type: blockType,
      prompt,
      answer,
      grade,
    })
    .select()
    .single();
  if (error) { console.error('saveLessonAnswer:', error); return null; }
  return data;
}

export async function getLessonAnswers(userId, lessonId) {
  const { data, error } = await supabase
    .from('lesson_answers')
    .select('*')
    .eq('user_id', userId)
    .eq('lesson_id', lessonId)
    .order('answered_at', { ascending: true });
  if (error) { console.error('getLessonAnswers:', error); return []; }
  return data ?? [];
}

export async function updateLessonAnswerGrade(answerId, grade) {
  const { error } = await supabase
    .from('lesson_answers')
    .update({ grade })
    .eq('id', answerId);
  if (error) { console.error('updateLessonAnswerGrade:', error); return false; }
  return true;
}

export async function getPendingAssignments(userId) {
  const { data, error } = await supabase
    .from('lesson_answers')
    .select('*')
    .eq('user_id', userId)
    .eq('block_type', 'assignment')
    .is('grade', null)
    .order('answered_at', { ascending: true });
  if (error) { console.error('getPendingAssignments:', error); return []; }
  return data ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────
// USER PROGRESS (XP)
// ─────────────────────────────────────────────────────────────────────────────

export async function getUserProgress(userId) {
  const { data, error } = await supabase
    .from('user_progress')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error && error.code !== 'PGRST116') {
    console.error('getUserProgress:', error);
  }
  // Return default shape if no row yet — row is created on first addXP call
  return data ?? { user_id: userId, xp_total: 0, level: 1 };
}

export async function addXP(userId, amount) {
  const current = await getUserProgress(userId);
  const newXP = (current.xp_total ?? 0) + amount;

  // XP thresholds duplicated inline to avoid circular import with constants/index.js
  const thresholds = [
    { level: 1, xp: 0 },  { level: 2, xp: 300 },  { level: 3, xp: 800 },
    { level: 4, xp: 1800 }, { level: 5, xp: 3500 }, { level: 6, xp: 6000 },
    { level: 7, xp: 10000 }, { level: 8, xp: 16000 }, { level: 9, xp: 25000 },
    { level: 10, xp: 40000 },
  ];
  let newLevel = 1;
  for (const t of thresholds) {
    if (newXP >= t.xp) newLevel = t.level;
  }

  const { data, error } = await supabase
    .from('user_progress')
    .upsert(
      {
        user_id:    userId,
        xp_total:   newXP,
        level:      newLevel,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single();
  if (error) { console.error('addXP:', error); return null; }
  // Returns { user_id, xp_total, level } — caller can detect level-up by comparing old vs new level
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// SONGS (Музыка module)
// ─────────────────────────────────────────────────────────────────────────────

export async function getSongs(userId) {
  const { data, error } = await supabase
    .from("songs")
    .select("id, title, artist, lines, lines_learned, mastered, created_at, updated_at, last_study_score, last_studied_at, study_progress_index, study_score_points")
    .eq("user_id", userId)
    .order("artist", { ascending: true, nullsLast: true })
    .order("title", { ascending: true });
  if (error) { console.error("getSongs:", error); return []; }
  return data ?? [];
}

export async function insertSong(userId, { title, artist, lines }) {
  const { data, error } = await supabase
    .from("songs")
    .insert({
      user_id:       userId,
      title:         title.trim(),
      artist:        artist?.trim() || null,
      lines:         lines,
      lines_learned: [],
      mastered:      false,
      updated_at:    new Date(),
    })
    .select()
    .single();
  if (error) { console.error("insertSong:", error); throw error; }
  return data;
}

export async function updateSongLearned(userId, songId, linesLearned, mastered) {
  const { error } = await supabase
    .from("songs")
    .update({
      lines_learned: linesLearned,
      mastered:      mastered,
      updated_at:    new Date(),
    })
    .eq("id", songId)
    .eq("user_id", userId);
  if (error) { console.error("updateSongLearned:", error); throw error; }
}

export async function updateSongMastered(userId, songId, mastered) {
  const { error } = await supabase
    .from("songs")
    .update({ mastered, updated_at: new Date() })
    .eq("id", songId)
    .eq("user_id", userId);
  if (error) { console.error("updateSongMastered:", error); throw error; }
}

export async function deleteSong(userId, songId) {
  const { error } = await supabase
    .from("songs")
    .delete()
    .eq("id", songId)
    .eq("user_id", userId);
  if (error) { console.error("deleteSong:", error); throw error; }
}

export async function updateSongStudyProgress(userId, songId, {
  study_progress_index,
  study_score_points,
  last_study_score,
  last_studied_at,
}) {
  const payload = { updated_at: new Date() };
  if (typeof study_progress_index === "number") payload.study_progress_index = study_progress_index;
  if (typeof study_score_points   === "number") payload.study_score_points   = study_score_points;
  if (typeof last_study_score     === "number") payload.last_study_score     = last_study_score;
  if (last_studied_at !== undefined)            payload.last_studied_at      = last_studied_at;

  const { error } = await supabase
    .from("songs")
    .update(payload)
    .eq("id", songId)
    .eq("user_id", userId);
  if (error) { console.error("updateSongStudyProgress:", error); throw error; }
}

// ─────────────────────────────────────────────────────────────────────────────
// UNIVERSAL ATTEMPTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Record one exercise attempt. Fire-and-forget safe — never throws.
 * Only stores user_answer and correct_answer when is_correct is false.
 *
 * @param {string} userId
 * @param {object} attempt
 * @param {number} attempt.sourceId        - FK to attempt_sources.id
 * @param {number|null} attempt.topicId    - FK to attempt_topics.id (null if unknown)
 * @param {string|null} attempt.questionType - e.g. 'fill_in_blank', 'inference'
 * @param {string|null} attempt.sourceRef  - lesson_id, book_id, etc.
 * @param {string|null} attempt.word       - vocab word being tested
 * @param {boolean}     attempt.isCorrect
 * @param {string|null} attempt.userAnswer    - only when isCorrect is false
 * @param {string|null} attempt.correctAnswer - only when isCorrect is false
 * @param {number|null} attempt.responseMs - response time in ms
 */
export async function recordAttempt(userId, attempt) {
  try {
    const payload = {
      user_id:       userId,
      source_id:     attempt.sourceId,
      topic_id:      attempt.topicId      ?? null,
      question_type: attempt.questionType ?? null,
      source_ref:    attempt.sourceRef    ?? null,
      word:          attempt.word         ?? null,
      is_correct:    attempt.isCorrect,
      user_answer:   attempt.isCorrect ? null : (attempt.userAnswer    ?? null),
      correct_answer: attempt.isCorrect ? null : (attempt.correctAnswer ?? null),
      response_ms:   attempt.responseMs   ?? null,
      attempted_at:  new Date().toISOString(),
    };
    const { error } = await supabase
      .from("universal_attempts")
      .insert(payload);
    if (error) console.warn("recordAttempt:", error.message);
  } catch (e) {
    // Never throw — this is a background write
    console.warn("recordAttempt exception:", e.message);
  }
}

/**
 * Fetch the last N progress reports for the user.
 * Used by the progress aggregator and report history screen.
 */
export async function getProgressReports(userId, limit = 10) {
  const { data, error } = await supabase
    .from("progress_reports")
    .select("*")
    .eq("user_id", userId)
    .order("generated_at", { ascending: false })
    .limit(limit);
  if (error) { console.error("getProgressReports:", error); return []; }
  return data ?? [];
}

/**
 * Save a completed progress report.
 */
export async function saveProgressReport(userId, { snapshot, report, reportVersion = "1.0" }) {
  const { data, error } = await supabase
    .from("progress_reports")
    .insert({
      user_id:        userId,
      snapshot:       snapshot ?? null,
      report:         report   ?? null,
      report_version: reportVersion,
    })
    .select("id")
    .single();
  if (error) { console.error("saveProgressReport:", error); return null; }
  return data.id;
}

/**
 * Fetch universal_attempts for the aggregator.
 * Returns all attempts in the last `days` days.
 */
export async function getRecentAttempts(userId, days = 60) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("universal_attempts")
    .select("*")
    .eq("user_id", userId)
    .gte("attempted_at", cutoff)
    .order("attempted_at", { ascending: false });
  if (error) { console.error("getRecentAttempts:", error); return []; }
  return data ?? [];
}