// src/modules/Vocabulary/Session.jsx

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useLocation }  from "react-router-dom";
import { useAuth }                   from "../../AuthContext";
import { useSettings }               from "../../context/SettingsContext";
import { getDueWords, updateWordSrs } from "../../storage";
import {
  getExerciseType,
  SRS_QUALITY,
  TIER_BADGE,
  MAX_TIER,
  TIER_GRADUATION_STREAK,
} from "../../constants";
import MatchingCard        from "./Cards/MatchingCard";
import MultipleChoiceCard  from "./Cards/MultipleChoiceCard";
import TranslateCard       from "./Cards/TranslateCard";
import ClozeCard           from "./Cards/ClozeCard";
import SentenceCard        from "./Cards/SentenceCard";
import ExploreControls     from "./ExploreControls";
import styles              from "./Session.module.css";
import { useAttemptTracker, ATTEMPT_SOURCES } from "../../hooks/useAttemptTracker";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function callSrsUpdate({ quality, interval_days, ease_factor, review_count }) {
  const res = await fetch("/api/srs-update", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ quality, interval_days, ease_factor, review_count }),
  });
  if (!res.ok) throw new Error("SRS update failed");
  return res.json();
}

async function generateDistractors(word, level) {
  const definitions = word.translation
    ? word.translation.split(",").map(d => d.trim()).filter(Boolean)
    : [];
  const res = await fetch("/api/vocab-generate", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      mode:           "mc_distractors",
      word:           word.word,
      word_en:        word.translation,
      definitions,
      part_of_speech: word.part_of_speech,
      level,
    }),
  });
  if (!res.ok) throw new Error("Distractor generation failed");
  const data = await res.json();
  return data.distractors ?? [];
}

async function generateCloze(word, level) {
  const res = await fetch("/api/vocab-generate", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      mode:           "cloze",
      word:           word.word,
      word_en:        word.translation,
      part_of_speech: word.part_of_speech,
      level,
    }),
  });
  if (!res.ok) throw new Error("Cloze generation failed");
  return res.json();
}

async function gradeAnswer({ mode, word, studentAnswer, correctAnswer }) {
  const res = await fetch("/api/vocab-grade", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      mode,
      word_ru:        word.word,
      word_en:        word.translation,
      correct_answer: correctAnswer,
      student_answer: studentAnswer,
    }),
  });
  if (!res.ok) throw new Error("Grading failed");
  return res.json();
}

function deriveQuality(exerciseType, correct) {
  if (!correct) return SRS_QUALITY.FAIL;
  if (exerciseType === "matching" || exerciseType === "mc") return SRS_QUALITY.CORRECT_EASY;
  if (exerciseType === "translate_ru_en")                   return SRS_QUALITY.CORRECT_MEDIUM;
  return SRS_QUALITY.CORRECT_HARD;
}

function computeTierProgression(word, correct) {
  const currentTier   = word.tier        ?? 0;
  const currentStreak = word.tier_streak ?? 0;
  if (!correct) return { tier: currentTier, tier_streak: 0 };
  const newStreak = currentStreak + 1;
  if (newStreak >= TIER_GRADUATION_STREAK && currentTier < MAX_TIER) {
    return { tier: currentTier + 1, tier_streak: 0 };
  }
  return { tier: currentTier, tier_streak: newStreak };
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Session() {
  const { user }     = useAuth();
  const { level }    = useSettings();
  const navigate     = useNavigate();
  const { pathname } = useLocation();
  const isExplore    = pathname === "/vocabulary/explore";

  // ── Session state ─────────────────────────────────────────────────────────
  const [phase,        setPhase]        = useState("loading");
  const [words,        setWords]        = useState([]);
  const [currentIdx,   setCurrentIdx]   = useState(0);
  const [feedback,     setFeedback]     = useState(null);
  const [streak,       setStreak]       = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [totalCount,   setTotalCount]   = useState(0);
  const [error,        setError]        = useState(null);
  const [sessionResults, setSessionResults] = useState({});

  // Card-specific state
  const [distractors,      setDistractors]      = useState([]);
  const [displayTranslation, setDisplayTranslation] = useState(null);
  const [clozeData,        setClozeData]        = useState(null);
  const [cardLoading, setCardLoading] = useState(false);
  const [grading,     setGrading]     = useState(false);

  // Explore state
  const [exploreSettings, setExploreSettings] = useState(null);
  const [exploreWord,     setExploreWord]     = useState(null);
  const [recentWords,     setRecentWords]     = useState([]);

  const { track, posToTopicId } = useAttemptTracker();

  // Stale closure guards
  const wordsRef = useRef(words);
  useEffect(() => { wordsRef.current = words; }, [words]);

  const currentIdxRef = useRef(currentIdx);
  useEffect(() => { currentIdxRef.current = currentIdx; }, [currentIdx]);

  // Tracks which word IDs have already had SRS written this session.
  // Persists across retries — SRS only writes once per word per session.
  const reviewedThisSession = useRef(new Set());

  // Accumulates matching pair results until all 4 are done, then flushes on Next.
  // Prevents setWords from firing mid-card and resetting MatchingCard state.
  const pendingMatchResults = useRef({});

  // ── Derived ───────────────────────────────────────────────────────────────
  const currentWord  = isExplore ? exploreWord : words[currentIdx];
  const exerciseType = currentWord ? getExerciseType(currentWord) : null;

  // How many words does the current exercise step consume?
  // Matching = 4 words at once, everything else = 1.
  const stepSize = exerciseType === "matching" ? 4 : 1;

  const matchingWords = useMemo(
  () => words.slice(currentIdx, currentIdx + 4),
  [words.slice(currentIdx, currentIdx + 4).map(w => w.id).join(",")]
);

  // ── Load due words ────────────────────────────────────────────────────────
  useEffect(() => {
    if (isExplore) { setPhase("explore_setup"); return; }
    (async () => {
      try {
        const due = await getDueWords(user.uid);
        if (due.length === 0) { setPhase("nothing_due"); return; }
        setWords(due);
        setPhase("active");
      } catch (e) {
        console.error(e);
        setError("Could not load due words. Please try again.");
        setPhase("error");
      }
    })();
  }, [user.uid, isExplore]);

  // ── Prepare card when word/index changes ──────────────────────────────────
  useEffect(() => {
    if (!currentWord || phase !== "active") return;
    setFeedback(null);
    setDistractors([]);
    setClozeData(null);
    prepareCard(currentWord, exerciseType);
  }, [currentIdx, phase]);

  const prepareCard = useCallback(async (word, exType) => {
    if (exType === "mc") {
      const definitions = word.translation
        ? word.translation.split(",").map(d => d.trim()).filter(Boolean)
        : [word.translation ?? "—"];
      const picked = definitions[Math.floor(Math.random() * definitions.length)];
      setDisplayTranslation(picked);
      setCardLoading(true);
      try   { setDistractors(await generateDistractors(word, level)); }
      catch { setDistractors(["—", "—", "—"]); }
      setCardLoading(false);
    }
    if (exType === "cloze") {
      setCardLoading(true);
      try   { setClozeData(await generateCloze(word, level)); }
      catch { setClozeData(null); }
      setCardLoading(false);
    }
  }, [level]);

  // ── Background DB writer with retry ──────────────────────────────────────
  async function writeSrsWithRetry(userId, word, exType, correct, newTier, newStreak, maxAttempts = 3) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        let newSrs;
        if (word.is_mastered) {
          const next = new Date();
          next.setDate(next.getDate() + 30);
          newSrs = {
            next_review_at: next.toISOString(),
            interval_days:  30,
            ease_factor:    word.ease_factor ?? 2.5,
            review_count:   (word.review_count ?? 0) + 1,
          };
        } else {
          newSrs = await callSrsUpdate({
            quality:       deriveQuality(exType, correct),
            interval_days: word.interval_days ?? 0,
            ease_factor:   word.ease_factor   ?? 2.5,
            review_count:  word.review_count  ?? 0,
          });
        }
        await updateWordSrs(userId, word.id, {
          ...newSrs,
          tier:        newTier,
          tier_streak: newStreak,
        });
        return;
      } catch (e) {
        const isLastAttempt = attempt === maxAttempts;
        if (isLastAttempt) {
          console.warn(`SRS write failed after ${maxAttempts} attempts for word "${word.word}":`, e);
        } else {
          await new Promise(res => setTimeout(res, 1000 * Math.pow(2, attempt - 1)));
        }
      }
    }
  }

  // ── SRS + tier update ─────────────────────────────────────────────────────
  // skipWordsMutation: pass true for matching to avoid mutating the words array
  // mid-card, which would cause MatchingCard to reset via its useEffect([words]).
  const handleSrsUpdate = (word, exType, correct, skipWordsMutation = false) => {
    const alreadyReviewed = reviewedThisSession.current.has(word.id);

    const { tier: newTier, tier_streak: newStreak } = computeTierProgression(word, correct);
    const graduated = newTier > (word.tier ?? 0);

    setSessionResults(prev => ({
      ...prev,
      [word.id]: {
        correct,
        graduated: alreadyReviewed ? false : graduated,
        fromTier:  word.tier ?? 0,
        toTier:    newTier,
        word:      word.word,
        translation: word.translation,
      },
    }));

    // Only mutate words array for non-matching exercises.
    // For matching, this is called after navigation so the card is already gone.
    if (!skipWordsMutation) {
      setWords(prev => prev.map(w =>
        w.id === word.id ? { ...w, tier: newTier, tier_streak: newStreak } : w
      ));
    }

    if (alreadyReviewed) return;

    reviewedThisSession.current.add(word.id);
    writeSrsWithRetry(user.uid, word, exType, correct, newTier, newStreak);
  };

  // ── Answer handlers ───────────────────────────────────────────────────────

  const handleMcAnswer = useCallback((correct) => {
    const fb = {
      correct,
      feedback: correct ? "Good recall!" : `Correct answer: ${currentWord.translation}`,
    };
    setFeedback(fb);

    const counted = !reviewedThisSession.current.has(currentWord.id);
    if (counted) {
      setTotalCount(t => t + 1);
      if (correct) { setCorrectCount(c => c + 1); setStreak(s => s + 1); }
      else setStreak(0);
    }

    handleSrsUpdate(currentWord, "mc", correct);

    track({
      sourceId:       isExplore ? ATTEMPT_SOURCES.VOCAB_EXPLORE : ATTEMPT_SOURCES.VOCAB_SESSION,
      topicId:        posToTopicId(currentWord.part_of_speech),
      exerciseTypeId: ATTEMPT_EXERCISE_TYPES.VOCAB_MC,
      word:           currentWord.word,
      isCorrect:      correct,
    });
  }, [currentWord, isExplore, track, posToTopicId]);

  const handleTextAnswer = useCallback(async (studentAnswer) => {
    if (!currentWord) return;
    setGrading(true);

    let correct = false;
    let feedbackText = "";

    try {
      if (exerciseType === "translate_ru_en") {
        const exact = studentAnswer.trim().toLowerCase() === currentWord.translation?.trim().toLowerCase();
        if (exact) {
          correct = true; feedbackText = "Correct!";
        } else {
          const result = await gradeAnswer({ mode: "translate_ru_en", word: currentWord, studentAnswer });
          correct = result.correct; feedbackText = result.feedback;
        }
      } else {
        const modeMap = { translate_en_ru: "translate_en_ru", cloze: "cloze", sentence: "sentence" };
        const result  = await gradeAnswer({
          mode: modeMap[exerciseType], word: currentWord,
          studentAnswer, correctAnswer: clozeData?.answer,
        });
        correct = result.correct; feedbackText = result.feedback;
      }
    } catch {
      feedbackText = "Could not grade — please try again.";
    }

    setGrading(false);
    setFeedback({ correct, feedback: feedbackText });

    const counted = !reviewedThisSession.current.has(currentWord.id);
    if (counted) {
      setTotalCount(t => t + 1);
      if (correct) { setCorrectCount(c => c + 1); setStreak(s => s + 1); }
      else setStreak(0);
    }

    if (!isExplore) handleSrsUpdate(currentWord, exerciseType, correct);

    const vocabExTypeMap = {
      translate_ru_en: ATTEMPT_EXERCISE_TYPES.VOCAB_TRANSLATE,
      translate_en_ru: ATTEMPT_EXERCISE_TYPES.VOCAB_TRANSLATE_EN_RU,
      cloze:           ATTEMPT_EXERCISE_TYPES.VOCAB_CLOZE,
      sentence:        ATTEMPT_EXERCISE_TYPES.VOCAB_SENTENCE,
    };
    track({
      sourceId:       isExplore ? ATTEMPT_SOURCES.VOCAB_EXPLORE : ATTEMPT_SOURCES.VOCAB_SESSION,
      topicId:        posToTopicId(currentWord.part_of_speech),
      exerciseTypeId: vocabExTypeMap[exerciseType] ?? null,
      word:           currentWord.word,
      isCorrect:      correct,
      userAnswer:     correct ? null : studentAnswer,
      correctAnswer:  correct ? null : (
        exerciseType === "cloze"
          ? (clozeData?.answer ?? null)
          : (currentWord.translation ?? null)
      ),
    });
  }, [currentWord, exerciseType, clozeData, isExplore, track, posToTopicId]);

  // Matching: accumulates one result per pair as each pair is matched.
  // Does NOT write SRS or mutate words — that happens in handleMatchNext.
  const handleMatchAnswer = useCallback((wordId, correct) => {
    const matchWords = wordsRef.current.slice(currentIdxRef.current, currentIdxRef.current + 4);
    const word = matchWords.find(w => w.id === wordId);
    if (!word) return;

    pendingMatchResults.current[wordId] = { word, correct };

    const counted = !reviewedThisSession.current.has(word.id);
    if (counted) {
      setTotalCount(t => t + 1);
      if (correct) {
        setCorrectCount(c => c + 1);
        setStreak(s => s + 1);
      } else {
        setStreak(0);
      }
    }

    track({
      sourceId:       ATTEMPT_SOURCES.VOCAB_SESSION,
      topicId:        posToTopicId(word.part_of_speech),
      exerciseTypeId: ATTEMPT_EXERCISE_TYPES.VOCAB_MATCHING,
      word:           word.word,
      isCorrect:      correct,
    });
  }, [track, posToTopicId]);

  // Called when user taps "Next →" on the matching success banner.
  // Flushes all 4 pending SRS writes (with skipWordsMutation=true so the
  // words array stays stable), then advances the session index.
  const handleMatchNext = useCallback(() => {
    Object.values(pendingMatchResults.current).forEach(({ word, correct }) => {
      handleSrsUpdate(word, "matching", correct, true);
    });
    pendingMatchResults.current = {};

    const nextIdx = currentIdxRef.current + 4;
    if (nextIdx >= wordsRef.current.length) {
      setPhase("complete");
    } else {
      setCurrentIdx(nextIdx);
      setFeedback(null);
    }
  }, []);

  const handleSkip = useCallback(async () => {
    if (!currentWord) return;

    const counted = !reviewedThisSession.current.has(currentWord.id);
    if (counted) {
      setTotalCount(t => t + 1);
      setStreak(0);
    }

    if (!isExplore) handleSrsUpdate(currentWord, exerciseType, false);
    handleNext();
  }, [currentWord, exerciseType, isExplore]);

  // ── Navigation ────────────────────────────────────────────────────────────

  const handleNext = useCallback(() => {
    if (isExplore) {
      setExploreWord(null);
      setFeedback(null);
      setPhase("active");
      generateExploreExercise(exploreSettings);
      return;
    }
    const nextIdx = currentIdx + stepSize;
    if (nextIdx >= words.length) {
      setPhase("complete");
    } else {
      setCurrentIdx(nextIdx);
      setFeedback(null);
    }
  }, [currentIdx, stepSize, words, isExplore, exploreSettings]);

  // Retry: reshuffle words, reset display state, keep reviewedThisSession intact
  const handleRetry = useCallback(() => {
    setWords(prev => shuffle([...prev]));
    setCurrentIdx(0);
    setFeedback(null);
    setStreak(0);
    setCorrectCount(0);
    setTotalCount(0);
    setSessionResults({});
    setDistractors([]);
    setClozeData(null);
    pendingMatchResults.current = {};
    setPhase("active");
  }, []);

  // ── Explore mode ──────────────────────────────────────────────────────────

  const generateExploreExercise = useCallback(async (settings) => {
    if (!settings) return;
    setCardLoading(true);
    const modeMap = {
      translate: "explore_translate",
      mc:        "explore_mc",
      cloze:     "explore_cloze",
      sentence:  "explore_translate",
    };
    try {
      const res = await fetch("/api/vocab-generate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          mode:         modeMap[settings.exerciseMode],
          level,
          topics:       settings.topics.join(", "),
          pos_types:    settings.posTypes.join(", "),
          recent_words: recentWords.slice(-8).join(", "),
        }),
      });
      if (!res.ok) throw new Error("generate failed");
      const data = await res.json();

      const syntheticWord = {
        id:          `explore-${Date.now()}`,
        word:        data.word_ru,
        translation: data.word_en,
        part_of_speech: data.part_of_speech,
        tier:        5,
        tier_streak: 0,
        is_mastered: false,
      };

      setExploreWord(syntheticWord);
      setRecentWords(r => [...r.slice(-15), data.word_ru]);

      if (settings.exerciseMode === "mc" && data.options) {
        setDistractors(data.options.filter(o => o !== data.correct_option));
      } else if (settings.exerciseMode === "cloze" && data.sentence_before) {
        setClozeData({
          sentence_before: data.sentence_before,
          sentence_after:  data.sentence_after,
          answer:          data.answer,
          grammar_hint:    data.grammar_hint,
        });
      }

      setPhase("active");
    } catch (e) {
      console.error("Explore generate failed:", e);
      setError("Could not generate an exercise. Please try again.");
    }
    setCardLoading(false);
  }, [level, recentWords]);

  const handleExploreStart = (settings) => {
    setExploreSettings(settings);
    generateExploreExercise(settings);
  };

  // ── Render helpers ────────────────────────────────────────────────────────

  const reviewedCount = currentIdx;
  const progress      = words.length > 0 ? `${reviewedCount} / ${words.length}` : "";
  const pct           = words.length > 0 ? (reviewedCount / words.length) * 100 : 0;
  const accuracy      = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : null;

  const tierLabel = (t) =>
    ["Matching","Multiple Choice","Translate RU→EN","Cloze","Translate EN→RU","Sentence Builder"][t] ?? "—";

  const nextDueTime = () => {
    const future = wordsRef.current
      .filter(w => w.next_review_at)
      .map(w => new Date(w.next_review_at))
      .filter(d => d > new Date())
      .sort((a, b) => a - b);
    if (!future.length) return null;
    const diff = future[0] - Date.now();
    const hrs  = Math.round(diff / 3600000);
    return hrs < 1 ? "less than 1 hour" : `${hrs} hour${hrs !== 1 ? "s" : ""}`;
  };

  // ── Phase renders ─────────────────────────────────────────────────────────

  if (phase === "loading") return (
    <div className={styles.center}><p>Loading your words…</p></div>
  );

  if (phase === "error") return (
    <div className={styles.center}>
      <p className={styles.error}>{error}</p>
      <button className={styles.backBtn} onClick={() => navigate("/vocabulary")}>← Back</button>
    </div>
  );

  if (phase === "nothing_due") return (
    <div className={styles.center}>
      <div className={styles.completeCard}>
        <div className={styles.completeIcon}>✓</div>
        <h2>All caught up!</h2>
        <p>No words are due for review right now.</p>
        {nextDueTime() && <p className={styles.nextDue}>Next review in {nextDueTime()}</p>}
        <button className={styles.backBtn} onClick={() => navigate("/vocabulary")}>Back to Vocabulary</button>
      </div>
    </div>
  );

  if (phase === "explore_setup") return (
    <div className={styles.explorePage}>
      <div className={styles.exploreHeader}>
        <button className={styles.backLink} onClick={() => navigate("/vocabulary")}>← Vocabulary</button>
        <h2 className={styles.exploreTitle}>Explore</h2>
      </div>
      <ExploreControls onStart={handleExploreStart} loading={cardLoading} />
    </div>
  );

  // ── Session Summary ───────────────────────────────────────────────────────
  if (phase === "complete") {
    const resultsList = Object.values(sessionResults);
    const graduated   = resultsList.filter(r => r.graduated);
    const wrong       = resultsList.filter(r => !r.correct);
    const correctList = resultsList.filter(r => r.correct);

    return (
      <div className={styles.center}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryHeader}>
            <span className={styles.summaryIcon}>🎉</span>
            <h2 className={styles.summaryTitle}>Session Complete</h2>
            <p className={styles.summarySubtitle}>
              {words.length} word{words.length !== 1 ? "s" : ""} reviewed
              {nextDueTime() ? ` · next due in ${nextDueTime()}` : " · all up to date"}
            </p>
          </div>

          <div className={styles.summaryStats}>
            <div className={styles.summaryStat}>
              <span className={styles.summaryStatVal}>{accuracy !== null ? `${accuracy}%` : "—"}</span>
              <span className={styles.summaryStatLbl}>accuracy</span>
            </div>
            <div className={styles.summaryStat}>
              <span className={styles.summaryStatVal}>{correctList.length}</span>
              <span className={styles.summaryStatLbl}>correct</span>
            </div>
            <div className={styles.summaryStat}>
              <span className={styles.summaryStatVal} style={{ color: graduated.length > 0 ? "#3b6d11" : undefined }}>
                {graduated.length}
              </span>
              <span className={styles.summaryStatLbl}>leveled up</span>
            </div>
          </div>

          {graduated.length > 0 && (
            <div className={styles.summarySection}>
              <p className={styles.summarySectionLabel}>⬆ TIER GRADUATIONS</p>
              <div className={styles.summaryWordList}>
                {graduated.map(r => (
                  <div key={r.word} className={styles.summaryWordRow}>
                    <span className={`${styles.summaryWordRu} ru`}>{r.word}</span>
                    <span className={styles.summaryWordEn}>{r.translation}</span>
                    <span className={styles.summaryTierBadge}>Tier {r.fromTier} → {r.toTier}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {wrong.length > 0 && (
            <div className={styles.summarySection}>
              <p className={styles.summarySectionLabel}>✗ NEEDS WORK</p>
              <div className={styles.summaryWordList}>
                {wrong.map(r => (
                  <div key={r.word} className={`${styles.summaryWordRow} ${styles.summaryWordWrong}`}>
                    <span className={`${styles.summaryWordRu} ru`}>{r.word}</span>
                    <span className={styles.summaryWordEn}>{r.translation}</span>
                    <span className={styles.summaryTierSmall}>Tier {r.fromTier} · {tierLabel(r.fromTier)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={styles.summarySection}>
            <p className={styles.summarySectionLabel}>ALL WORDS THIS SESSION</p>
            <div className={styles.summaryWordList}>
              {words.map(w => {
                const r = sessionResults[w.id];
                return (
                  <div key={w.id} className={styles.summaryWordRow}>
                    <span className={`${styles.summaryWordRu} ru`}>{w.word}</span>
                    <span className={styles.summaryWordEn}>{w.translation}</span>
                    {r ? (
                      <span className={r.correct ? styles.summaryCorrectBadge : styles.summaryWrongBadge}>
                        {r.correct ? "✓" : "✗"}
                      </span>
                    ) : (
                      <span className={styles.summarySkippedBadge}>—</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className={styles.summaryActions}>
            <button className={styles.retryBtn} onClick={handleRetry}>
              Retry This Session
            </button>
            <button className={styles.backBtn} onClick={() => navigate("/vocabulary")}>
              Back to Vocabulary
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Active session ────────────────────────────────────────────────────────
  return (
    <div className={styles.sessionPage}>

      {!isExplore && (
        <div className={styles.progressRow}>
          <div className={styles.streakBox}>
            <span className={styles.streakNum}>{streak}</span>
            <span className={styles.streakLbl}>streak</span>
          </div>
          <div className={styles.dueBox}>
            <span className={styles.dueLabel}>words due</span>
            <span className={styles.dueCount}>{progress}</span>
            <div className={styles.progressBarWrap}>
              <div className={styles.progressBarFill} style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
      )}

      {isExplore && (
        <div className={styles.exploreTopBar}>
          <button className={styles.backLink} onClick={() => navigate("/vocabulary/explore")}>← Settings</button>
          <span className={styles.exploreModeLabel}>Explore</span>
        </div>
      )}

      <div className={styles.sessionBody}>
        <div className={styles.cardArea}>

          {exerciseType === "matching" && (
  <MatchingCard
    words={matchingWords}
    onAnswer={(correct, wordId) => handleMatchAnswer(wordId, correct)}
    onNext={handleMatchNext}
  />
)}
          {exerciseType === "mc" && currentWord && (
            <MultipleChoiceCard
              word={currentWord}
              distractors={distractors}
              displayTranslation={displayTranslation ?? currentWord.translation}
              loading={cardLoading}
              onAnswer={handleMcAnswer}
              feedback={feedback}
            />
          )}
          {(exerciseType === "translate_ru_en" || exerciseType === "translate_en_ru") && currentWord && (
            <TranslateCard
              word={currentWord}
              direction={exerciseType === "translate_ru_en" ? "ru_en" : "en_ru"}
              onAnswer={handleTextAnswer}
              feedback={feedback}
              grading={grading}
            />
          )}
          {exerciseType === "cloze" && currentWord && (
            <ClozeCard
              word={currentWord}
              clozeData={clozeData}
              loading={cardLoading}
              onAnswer={handleTextAnswer}
              feedback={feedback}
              grading={grading}
            />
          )}
          {exerciseType === "sentence" && currentWord && (
            <SentenceCard
              word={currentWord}
              onAnswer={handleTextAnswer}
              feedback={feedback}
              grading={grading}
            />
          )}

          {phase === "active" && exerciseType !== "matching" && (
            <div className={styles.actionRow}>
              {feedback ? (
                <button className={styles.nextBtn} onClick={handleNext}>Next →</button>
              ) : (
                <button className={styles.skipBtn} onClick={handleSkip}>I don't know</button>
              )}
            </div>
          )}
        </div>

        {!isExplore && (
          <div className={styles.sidebar}>
            <div className={styles.sidebarCard}>
              <p className={styles.sidebarLabel}>Words Due</p>
              <p className={styles.sidebarVal}>{words.length}</p>
            </div>
            <div className={styles.sidebarCard}>
              <p className={styles.sidebarLabel}>Accuracy</p>
              <p className={styles.sidebarVal}>{accuracy !== null ? `${accuracy}%` : "—"}</p>
            </div>
            <div className={styles.sidebarCard}>
              <p className={styles.sidebarLabel}>Streak</p>
              <p className={styles.sidebarVal} style={{ color: "#5B9EBD" }}>{streak}</p>
            </div>

            <div className={`${styles.sidebarCard} ${styles.sidebarWordList}`}>
              <p className={styles.sidebarLabel}>This Session</p>
              <div className={styles.sessionWordList}>
                {words.map((w, i) => {
                  const result    = sessionResults[w.id];
                  const isCurrent = exerciseType === "matching"
                    ? (i >= currentIdx && i < currentIdx + 4)
                    : i === currentIdx;
                  const isDone    = result !== undefined;

                  return (
                    <div
                      key={w.id}
                      className={[
                        styles.sessionWordItem,
                        isCurrent ? styles.sessionWordCurrent : "",
                        isDone && result.correct  ? styles.sessionWordCorrect : "",
                        isDone && !result.correct ? styles.sessionWordWrongItem : "",
                      ].join(" ")}
                    >
                      <span
                        className={styles.sessionWordStatus}
                        style={{
                          color: isDone
                            ? (result.correct ? "#3b6d11" : "var(--c-wrong)")
                            : isCurrent ? "var(--c-sky)" : undefined,
                        }}
                      >
                        {isDone
                          ? (result.correct ? "✓" : "✗")
                          : isCurrent ? "▶" : "·"
                        }
                      </span>
                      <span className={`${styles.sessionWordRu} ru`}>{w.word}</span>
                      {result?.graduated && (
                        <span className={styles.sessionWordGrad}>↑</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}