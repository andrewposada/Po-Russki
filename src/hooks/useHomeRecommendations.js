// src/hooks/useHomeRecommendations.js
//
// Fetches all data needed for the Home screen focus strip on mount.
// Computes streak from universal_attempts dates.
// Scores recommendation candidates and returns top 3 (1 primary + 2 secondary).
// Writes computed streak back to user_progress so it stays fresh everywhere.
//
// Returns:
//   isLoading   — bool
//   heroLine    — string (date-seeded, filled with real values)
//   primary     — { type, label, subtext, path, icon }
//   secondary   — [{ type, label, subtext, path, icon }, ...]
//   stats       — { streak, wordCount, dueCount, level, xp }

import { useState, useEffect } from "react";
import { useAuth } from "../AuthContext";
import {
  getDueWords,
  getWords,
  getAllLessonCompletions,
  getUserProgress,
  getLastReadChapter,
  getRecentAttempts,
  getSongs,
  getPendingAssignments,
} from "../storage";
import { supabase } from "../supabase";
import { GRAMMAR_ROADMAP, computeNodeStates, getActiveLesson } from "../data/roadmaps/grammarRoadmap";
import { LESSON_STATE } from "../constants";
import { HOME_COPY, pickLine, fillTokens } from "../constants/homeCopy";

// ── Streak computation ──────────────────────────────────────────────────────

/**
 * Compute current streak from an array of ISO timestamp strings.
 * A streak is the number of consecutive calendar days (ending today or yesterday)
 * with at least one attempt.
 */
function computeStreak(attemptTimestamps) {
  if (!attemptTimestamps || attemptTimestamps.length === 0) return 0;

  // Extract unique calendar dates (in user local time), most recent first
  const uniqueDates = [...new Set(
    attemptTimestamps.map(ts => new Date(ts).toLocaleDateString("en-CA")) // 'YYYY-MM-DD'
  )].sort().reverse();

  if (uniqueDates.length === 0) return 0;

  const today = new Date().toLocaleDateString("en-CA");
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("en-CA");

  // Streak must include today or yesterday to be "active"
  if (uniqueDates[0] !== today && uniqueDates[0] !== yesterday) return 0;

  let streak = 0;
  let cursor = uniqueDates[0] === today ? new Date() : new Date(Date.now() - 86400000);

  for (const dateStr of uniqueDates) {
    const expected = cursor.toLocaleDateString("en-CA");
    if (dateStr === expected) {
      streak++;
      cursor = new Date(cursor.getTime() - 86400000);
    } else {
      break;
    }
  }

  return streak;
}

// ── Days since a timestamp ──────────────────────────────────────────────────

function daysSince(isoString) {
  if (!isoString) return Infinity;
  return (Date.now() - new Date(isoString).getTime()) / 86400000;
}

// ── Topic ID → display name map ────────────────────────────────────────────
// topic_ids from attempt_topics table (Phase 3G)

const TOPIC_DISPLAY_NAMES = {
  1:  "nominative case",     2:  "accusative case",    3:  "genitive case",
  4:  "dative case",         5:  "instrumental case",  6:  "prepositional case",
  7:  "case agreement",      8:  "noun gender",         9:  "noun declension",
  10: "adjective agreement", 11: "short adjectives",   12: "comparative forms",
  13: "superlative forms",   14: "present tense verbs", 15: "past tense verbs",
  16: "future tense",        17: "verb aspect",         18: "imperative mood",
  19: "verb conjugation",    20: "reflexive verbs",     21: "participles",
  22: "gerunds",             23: "conditional mood",    24: "subjunctive mood",
  25: "prepositions",
};

// ── Grammar topic → freeplay route ─────────────────────────────────────────

const TOPIC_ID_TO_FREEPLAY_PARAM = {
  1: "nominative", 2: "accusative",  3: "genitive",
  4: "dative",     5: "instrumental", 6: "prepositional",
  14: "present",   15: "past",        16: "future",
  17: "aspect",
};

// ── Scoring ─────────────────────────────────────────────────────────────────

function scoreCandidate(type, data) {
  switch (type) {
    case "assignment_pending":
      // Assignments always win — they're explicit commitments
      return 0.97;

    case "vocab_due": {
      const { dueCount, daysSinceLastVocab } = data;
      // Base: scales 0→1 as due count grows past 5
      const volumeScore = Math.min(dueCount / 5, 1.0);
      // Recency boost: if vocab hasn't been touched in 2+ days, urgency rises
      const recencyBoost = Math.min(daysSinceLastVocab / 2, 0.4);
      return Math.min(volumeScore + recencyBoost, 1.0);
    }

    case "lesson_overdue": {
      // Grows linearly — 3 days idle = 0.75, 5 days = full urgency
      return Math.min(data.daysSinceLesson / 5, 0.9);
    }

    case "lesson_available": {
      // Next lesson is unlocked and user is actively progressing
      // Base 0.6 — solid but vocab/assignment urgency can beat it
      return 0.6;
    }

    case "weak_topic": {
      // Accuracy below 55% is significant
      // Below 40% is critical
      const accuracy = data.accuracy;
      if (accuracy < 0.40) return 0.82;
      if (accuracy < 0.55) return 0.68;
      return 0;
    }

    case "reading": {
      // Reading is healthy but never as urgent as overdue vocab/lessons
      const days = data.daysSinceReading;
      if (days === Infinity) return 0; // never started
      return Math.min(days / 5, 0.55);
    }

    case "song": {
      // Songs are the most optional — only surface if nothing else is pressing
      return Math.min(data.daysSinceSong / 7, 0.35);
    }

    case "listening": {
      // Listening is a great complement to grammar/vocab — surfaces if idle for 3+ days
      const days = data.daysSinceListening;
      if (days === Infinity) return 0.45; // never tried — worth suggesting
      return Math.min(days / 4, 0.50);   // peaks at 0.5 after 4 days idle
    }

    case "fallback":
      return 0.1;

    default:
      return 0;
  }
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useHomeRecommendations() {
  const { user } = useAuth();
  const [state, setState] = useState({
    isLoading: true,
    heroLine: "",
    primary: null,
    secondary: [],
    stats: { streak: 0, wordCount: 0, dueCount: 0, level: 1, xp: 0 },
  });

  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;

    async function load() {
      try {
        // ── Parallel fetch ───────────────────────────────────────────────
        const [
          dueWords,
          allWords,
          lessonCompletions,
          userProgress,
          lastChapter,
          recentAttempts,
          songs,
          pendingAssignments,
        ] = await Promise.all([
          getDueWords(user.uid, 100).catch(() => []),
          getWords(user.uid).catch(() => []),
          getAllLessonCompletions(user.uid).catch(() => []),
          getUserProgress(user.uid).catch(() => ({ xp_total: 0, level: 1, current_streak: 0 })),
          getLastReadChapter(user.uid).catch(() => null),
          getRecentAttempts(user.uid, 60).catch(() => []),
          getSongs(user.uid).catch(() => []),
          getPendingAssignments(user.uid).catch(() => []),
        ]);

        if (cancelled) return;

        // ── Compute streak ───────────────────────────────────────────────
        const timestamps = recentAttempts.map(a => a.attempted_at);
        const currentStreak = computeStreak(timestamps);

        // Write streak back to user_progress if it changed
        const prevStreak = userProgress.current_streak ?? 0;
        const prevLongest = userProgress.longest_streak ?? 0;
        if (currentStreak !== prevStreak || currentStreak > prevLongest) {
          supabase.from("user_progress").upsert({
            user_id:        user.uid,
            current_streak: currentStreak,
            longest_streak: Math.max(currentStreak, prevLongest),
            updated_at:     new Date().toISOString(),
          }, { onConflict: "user_id" }).then(({ error }) => {
            if (error) console.warn("useHomeRecommendations: streak write failed", error.message);
          });
        }

        // ── Lesson state ─────────────────────────────────────────────────
        const completionMap = {};
        lessonCompletions.forEach(row => { completionMap[row.lesson_id] = row; });

        const lessonStateMap = {};
        lessonCompletions.forEach(row => { lessonStateMap[row.lesson_id] = row.state ?? 0; });

        const nodeStates = computeNodeStates(lessonStateMap);

        // Find the active (next available) lesson across the roadmap
        let nextLesson = null;
        let nextLessonNodeTitle = null;
        for (const node of GRAMMAR_ROADMAP) {
          const ns = nodeStates[node.id] ?? LESSON_STATE.LOCKED;
          if (ns === LESSON_STATE.AVAILABLE || ns === LESSON_STATE.IN_PROGRESS) {
            const active = getActiveLesson(node.id, lessonStateMap);
            if (active) {
              nextLesson = active;
              nextLessonNodeTitle = node.title;
              break;
            }
          }
        }

        // Days since last lesson activity
        const lastLessonDate = lessonCompletions.reduce((latest, row) => {
          const d = row.last_active_at ? new Date(row.last_active_at) : null;
          return d && (!latest || d > latest) ? d : latest;
        }, null);
        const daysSinceLesson = lastLessonDate ? daysSince(lastLessonDate.toISOString()) : Infinity;

        // ── Vocab timing ─────────────────────────────────────────────────
        // Use word updated_at as a proxy for last vocab session
        const lastVocabDate = allWords.reduce((latest, w) => {
          const d = w.updated_at ? new Date(w.updated_at) : null;
          return d && (!latest || d > latest) ? d : latest;
        }, null);
        const daysSinceLastVocab = lastVocabDate ? daysSince(lastVocabDate.toISOString()) : Infinity;
        const dueCount = dueWords.filter(w => !w.is_mastered).length;

        // ── Weak topic detection ─────────────────────────────────────────
        // Count accuracy by topic_id over last 30 days
        const thirtyDaysAgo = Date.now() - 30 * 86400000;
        const recentGrammar = recentAttempts.filter(a =>
          a.topic_id && a.topic_id <= 25 && new Date(a.attempted_at).getTime() > thirtyDaysAgo
        );

        const topicBuckets = {};
        recentGrammar.forEach(a => {
          if (!topicBuckets[a.topic_id]) topicBuckets[a.topic_id] = { correct: 0, total: 0 };
          topicBuckets[a.topic_id].total++;
          if (a.is_correct) topicBuckets[a.topic_id].correct++;
        });

        // Find worst topic with at least 5 attempts (enough signal)
        let worstTopic = null;
        let worstAccuracy = 1.0;
        Object.entries(topicBuckets).forEach(([topicId, { correct, total }]) => {
          if (total >= 5) {
            const acc = correct / total;
            if (acc < worstAccuracy) {
              worstAccuracy = acc;
              worstTopic = { id: Number(topicId), accuracy: acc };
            }
          }
        });

        // ── Reading / Songs timing ────────────────────────────────────────
        const daysSinceReading = lastChapter?.last_read_at
          ? daysSince(lastChapter.last_read_at)
          : Infinity;

        const activeSongs = songs.filter(s => !s.mastered && (s.study_progress_index ?? 0) > 0);
        const lastSong = activeSongs.sort((a, b) =>
          new Date(b.last_studied_at ?? 0) - new Date(a.last_studied_at ?? 0)
        )[0] ?? null;
        const daysSinceSong = lastSong?.last_studied_at ? daysSince(lastSong.last_studied_at) : Infinity;

        // ── Listening timing ─────────────────────────────────────────────
        // Derive from universal_attempts source_id = 11 (LISTENING)
        const listeningAttempts = recentAttempts.filter(a => a.source_id === 11);
        const lastListeningTs = listeningAttempts.length > 0
          ? listeningAttempts[0].attempted_at  // already sorted DESC
          : null;
        const daysSinceListening = lastListeningTs ? daysSince(lastListeningTs) : Infinity;

        // ── Build candidate list ─────────────────────────────────────────
        const candidates = [];

        if (pendingAssignments.length > 0) {
          candidates.push({
            type: "assignment_pending",
            score: scoreCandidate("assignment_pending", {}),
            label: `Complete assignment`,
            subtext: `${pendingAssignments.length} pending`,
            path: "/lessons",
            icon: "📋",
            heroCategory: "assignment_pending",
            heroTokens: {},
          });
        }

        if (dueCount >= 3) {
          candidates.push({
            type: "vocab_due",
            score: scoreCandidate("vocab_due", { dueCount, daysSinceLastVocab }),
            label: `Review your ${dueCount} due words`,
            subtext: `Don't let them fade — pick up where you left off`,
            path: "/vocabulary/session",
            icon: "📚",
            heroCategory: "vocab_due",
            heroTokens: { dueCount },
          });
        }

        if (daysSinceLesson >= 3 && nextLesson) {
          candidates.push({
            type: "lesson_overdue",
            score: scoreCandidate("lesson_overdue", { daysSinceLesson }),
            label: `Pick up ${nextLesson.title}`,
            subtext: `You haven't studied in ${Math.floor(daysSinceLesson)} days`,
            path: `/lessons/play/${nextLesson.id}`,
            icon: "📖",
            heroCategory: "lesson_overdue",
            heroTokens: { daysSince: Math.floor(daysSinceLesson) },
          });
        } else if (nextLesson) {
          candidates.push({
            type: "lesson_available",
            score: scoreCandidate("lesson_available", {}),
            label: `Start ${nextLesson.title}`,
            subtext: `Next up in ${nextLessonNodeTitle ?? "your roadmap"}`,
            path: `/lessons/play/${nextLesson.id}`,
            icon: "🎯",
            heroCategory: "lesson_available",
            heroTokens: {},
          });
        }

        if (worstTopic && worstAccuracy < 0.55) {
          const topicName = TOPIC_DISPLAY_NAMES[worstTopic.id] ?? `topic ${worstTopic.id}`;
          const freeplayParam = TOPIC_ID_TO_FREEPLAY_PARAM[worstTopic.id];
          candidates.push({
            type: "weak_topic",
            score: scoreCandidate("weak_topic", { accuracy: worstAccuracy }),
            label: `Struggling with ${topicName}?`,
            subtext: `${Math.round(worstAccuracy * 100)}% accuracy — a short drill will help`,
            path: freeplayParam ? `/grammar/freeplay?topics=${freeplayParam}` : "/grammar",
            icon: "⚡",
            heroCategory: "weak_topic",
            heroTokens: { topic: topicName },
          });
        }

        if (lastChapter && !lastChapter.is_completed) {
          const bookTitle = lastChapter.books?.title ?? "your book";
          candidates.push({
            type: "reading",
            score: scoreCandidate("reading", { daysSinceReading }),
            label: `Continue «${bookTitle}»`,
            subtext: `Your story is waiting — pick it back up`,
            path: `/library`,
            icon: "📕",
            heroCategory: "reading",
            heroTokens: { bookTitle },
          });
        }

        if (lastSong && daysSinceSong < Infinity) {
          candidates.push({
            type: "song",
            score: scoreCandidate("song", { daysSinceSong }),
            label: `Continue song`,
            subtext: lastSong.title,
            path: `/muzyka`,
            icon: "🎵",
            heroCategory: "streak",
            heroTokens: { streak: currentStreak },
          });
        }

        // Listening
        candidates.push({
            type: "listening",
            score: scoreCandidate("listening", { daysSinceListening }),
            label: daysSinceListening === Infinity
              ? "Try a listening exercise"
              : "Train your ear today",
            subtext: daysSinceListening === Infinity
              ? "You haven't tried Слушание yet"
              : `${Math.floor(daysSinceListening)} days since your last session`,
            path: "/listening",
            icon: "🎧",
          heroCategory: "listening",
          heroTokens: {},
        });

        // Always include fallback
        candidates.push({
            type: "fallback",
            score: scoreCandidate("fallback", {}),
            label: "Take a break with Табу",
            subtext: "Describe the word without saying it",
            path: "/tabu",
            icon: "🎲",
          heroCategory: "fallback",
          heroTokens: {},
        });

        // ── Sort by score and pick top 3 ─────────────────────────────────
        candidates.sort((a, b) => b.score - a.score);
        const [primary, ...rest] = candidates;
        const secondary = rest.slice(0, 2);

        // ── Hero line ────────────────────────────────────────────────────
        const copyLines = HOME_COPY[primary.heroCategory] ?? HOME_COPY.fallback;
        const rawLine = pickLine(copyLines, 0);
        const heroLine = fillTokens(rawLine, {
          ...primary.heroTokens,
          streak: currentStreak,
        });

        // ── Stats row ────────────────────────────────────────────────────
        const stats = {
          streak:    currentStreak,
          wordCount: allWords.length,
          dueCount,
          level:     userProgress.level ?? 1,
          xp:        userProgress.xp_total ?? 0,
        };

        if (!cancelled) {
          setState({ isLoading: false, heroLine, primary, secondary, stats });
        }
      } catch (err) {
        console.error("useHomeRecommendations:", err);
        if (!cancelled) {
          setState(prev => ({ ...prev, isLoading: false }));
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [user?.uid]);

  return state;
}