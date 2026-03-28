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
      usage_example: wordObj.usageExample  ?? null,
      cefr_level:    wordObj.cefrLevel     ?? null,
      proficiency:   wordObj.proficiency   ?? 0,
      is_mastered:   wordObj.isMastered    ?? false,
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
    user_id:         userId,
    title:           bookObj.title,
    level:           bookObj.level,
    synopsis:        bookObj.synopsis       ?? null,
    character_bible: bookObj.characterBible ?? null,
    total_chapters:  bookObj.totalChapters  ?? null,
    status:          bookObj.status         ?? "active",
  };
  if (bookObj.id) {
    const { error } = await supabase.from("books").update(payload).eq("id", bookObj.id);
    if (error) throw error;
    return bookObj.id;
  } else {
    const { data, error } = await supabase.from("books").insert(payload).select("id").single();
    if (error) throw error;
    return data.id;
  }
}

export async function deleteBook(bookId) {
  const { error } = await supabase.from("books").delete().eq("id", bookId);
  if (error) throw error;
}

// ── CHAPTERS ───────────────────────────────────────────────────────────────

export async function getChapters(bookId) {
  const { data, error } = await supabase
    .from("chapters")
    .select("*")
    .eq("book_id", bookId)
    .order("chapter_num", { ascending: true });
  if (error) throw error;
  return data;
}

export async function upsertChapter(bookId, chapterNum, { title, content, chapterSummary, wordCount }) {
  const { error } = await supabase
    .from("chapters")
    .upsert({
      book_id:         bookId,
      chapter_num:     chapterNum,
      title:           title          ?? null,
      content:         content,
      chapter_summary: chapterSummary ?? null,
      word_count:      wordCount      ?? null,
    }, { onConflict: "book_id,chapter_num" });
  if (error) throw error;
}

// ── COMPREHENSION ATTEMPTS ─────────────────────────────────────────────────

export async function saveComprehensionAttempt(userId, chapterId, { questions, answers, score }) {
  const { data, error } = await supabase
    .from("comprehension_attempts")
    .insert({
      user_id:    userId,
      chapter_id: chapterId,
      questions:  questions ?? null,
      answers:    answers   ?? null,
      score:      score     ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function getComprehensionAttempts(userId, chapterId) {
  const { data, error } = await supabase
    .from("comprehension_attempts")
    .select("*")
    .eq("user_id", userId)
    .eq("chapter_id", chapterId)
    .order("attempted_at", { ascending: false });
  if (error) throw error;
  return data;
}

// ── READING LOG ────────────────────────────────────────────────────────────

export async function saveReadingLog(userId, sessionId, chapterId, { startedAt, completedAt, timeSpent }) {
  const { error } = await supabase
    .from("reading_log")
    .insert({
      user_id:      userId,
      session_id:   sessionId,
      chapter_id:   chapterId,
      started_at:   startedAt   ?? null,
      completed_at: completedAt ?? null,
      time_spent:   timeSpent   ?? null,
    });
  if (error) throw error;
}