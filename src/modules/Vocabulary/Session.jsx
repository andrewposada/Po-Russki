// src/modules/Vocabulary/Session.jsx
// Exercise session — handles both My Words (SRS) and Explore (generative) modes.
// Renders the appropriate exercise card based on word tier.

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation }  from "react-router-dom";
import { useAuth }                   from "../../AuthContext";
import { useSettings }               from "../../context/SettingsContext";
import { getDueWords, updateWordSrs } from "../../storage";
import {
  getExerciseType,
  SRS_QUALITY,
  TIER_BADGE,
} from "../../constants";
import MatchingCard        from "./Cards/MatchingCard";
import MultipleChoiceCard  from "./Cards/MultipleChoiceCard";
import TranslateCard       from "./Cards/TranslateCard";
import ClozeCard           from "./Cards/ClozeCard";
import SentenceCard        from "./Cards/SentenceCard";
import ExploreControls     from "./ExploreControls";
import styles              from "./Session.module.css";

// ── Helpers ──────────────────────────────────────────────────────────────────

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
  const res = await fetch("/api/vocab-generate", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      mode:           "mc_distractors",
      word:           word.word,
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

// Quality score derived from exercise type + correctness
function deriveQuality(exerciseType, correct) {
  if (!correct) return SRS_QUALITY.FAIL;
  if (exerciseType === "matching" || exerciseType === "mc")        return SRS_QUALITY.CORRECT_EASY;
  if (exerciseType === "translate_ru_en")                          return SRS_QUALITY.CORRECT_MEDIUM;
  return SRS_QUALITY.CORRECT_HARD; // translate_en_ru, cloze, sentence
}

// ── Component ────────────────────────────────────────────────────────────────

export default function Session() {
  const { user }    = useAuth();
  const { level }   = useSettings();
  const navigate    = useNavigate();
  const { pathname } = useLocation();
  const isExplore   = pathname === "/vocabulary/explore";

  // ── Session state ──────────────────────────────────────────────────────────
  const [phase,        setPhase]        = useState("loading");
  const [words,        setWords]        = useState([]);
  const [currentIdx,   setCurrentIdx]   = useState(0);
  const [feedback,     setFeedback]     = useState(null);
  const [streak,       setStreak]       = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [totalCount,   setTotalCount]   = useState(0);
  const [leveledUp,    setLeveledUp]    = useState(0);
  const [error,        setError]        = useState(null);

  // Card-specific loading/data state
  const [distractors,  setDistractors]  = useState([]);
  const [clozeData,    setClozeData]    = useState(null);
  const [cardLoading,  setCardLoading]  = useState(false);
  const [grading,      setGrading]      = useState(false);

  // Explore mode state
  const [exploreSettings, setExploreSettings] = useState(null);
  const [exploreWord,     setExploreWord]     = useState(null);
  const [recentWords,     setRecentWords]     = useState([]);

  // Stale closure guard
  const wordsRef = useRef(words);
  useEffect(() => { wordsRef.current = words; }, [words]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const currentWord    = isExplore ? exploreWord : words[currentIdx];
  const exerciseType   = currentWord ? getExerciseType(currentWord) : null;

  // ── Load due words (My Words mode) ────────────────────────────────────────
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

  // ── Prepare card data when word/type changes ───────────────────────────────
  useEffect(() => {
    if (!currentWord || phase !== "active") return;
    setFeedback(null);
    setDistractors([]);
    setClozeData(null);
    prepareCard(currentWord, exerciseType);
  }, [currentIdx, currentWord?.id, phase]);

  const prepareCard = useCallback(async (word, exType) => {
    if (exType === "mc") {
      setCardLoading(true);
      try {
        const d = await generateDistractors(word, level);
        setDistractors(d);
      } catch { setDistractors(["—", "—", "—"]); }
      setCardLoading(false);
    }
    if (exType === "cloze") {
      setCardLoading(true);
      try {
        const c = await generateCloze(word, level);
        setClozeData(c);
      } catch { setClozeData(null); }
      setCardLoading(false);
    }
  }, [level]);

  // ── Answer handlers ────────────────────────────────────────────────────────

  // MC — tap answer
  const handleMcAnswer = useCallback(async (correct) => {
    const fb = { correct, feedback: correct ? "Good recall!" : `Correct: ${currentWord.translation}` };
    setFeedback(fb);
    setTotalCount(t => t + 1);
    if (correct) { setCorrectCount(c => c + 1); setStreak(s => s + 1); }
    else setStreak(0);
  }, [currentWord]);

  // Translate / Cloze / Sentence — submit text
  const handleTextAnswer = useCallback(async (studentAnswer) => {
    if (!currentWord) return;
    setGrading(true);

    let correct = false;
    let feedbackText = "";

    try {
      if (exerciseType === "translate_ru_en") {
        // Client-side exact match first
        const exact = studentAnswer.trim().toLowerCase() === currentWord.translation?.trim().toLowerCase();
        if (exact) {
          correct = true;
          feedbackText = "Correct!";
        } else {
          const result = await gradeAnswer({
            mode: "translate_ru_en", word: currentWord, studentAnswer,
          });
          correct      = result.correct;
          feedbackText = result.feedback;
        }
      } else {
        const modeMap = {
          translate_en_ru: "translate_en_ru",
          cloze:           "cloze",
          sentence:        "sentence",
        };
        const result = await gradeAnswer({
          mode:          modeMap[exerciseType],
          word:          currentWord,
          studentAnswer,
          correctAnswer: clozeData?.answer,
        });
        correct      = result.correct;
        feedbackText = result.feedback;
      }
    } catch {
      feedbackText = "Could not grade — please try again.";
    }

    setGrading(false);
    setFeedback({ correct, feedback: feedbackText });
    setTotalCount(t => t + 1);
    if (correct) { setCorrectCount(c => c + 1); setStreak(s => s + 1); }
    else setStreak(0);

    if (!isExplore) {
      await handleSrsUpdate(currentWord, exerciseType, correct);
    }
  }, [currentWord, exerciseType, clozeData, isExplore]);

  // SRS update after feedback is shown
  const handleSrsUpdate = async (word, exType, correct, matchWords) => {
    const quality = deriveQuality(exType, correct);
    try {
      const newSrs = await callSrsUpdate({
        quality,
        interval_days: word.interval_days  ?? 0,
        ease_factor:   word.ease_factor    ?? 2.5,
        review_count:  word.review_count   ?? 0,
      });

      const wasCloze = exType === "cloze";
      await updateWordSrs(user.uid, word.id, {
        ...newSrs,
        last_exercise_was_cloze: wasCloze,
      });

      // Track "leveled up" (review_count crossing a tier boundary)
      const oldRc = word.review_count ?? 0;
      const newRc = newSrs.review_count;
      if (correct && (
        (oldRc < 1  && newRc >= 1)  ||
        (oldRc < 3  && newRc >= 3)  ||
        (oldRc < 6  && newRc >= 6)  ||
        (oldRc < 10 && newRc >= 10)
      )) setLeveledUp(l => l + 1);

      // Update local word state so tier badge is current for rest of session
      if (!matchWords) {
        setWords(prev => prev.map(w => w.id === word.id ? { ...w, ...newSrs, last_exercise_was_cloze: wasCloze } : w));
      }
    } catch (e) {
      console.warn("SRS update failed silently:", e);
    }
  };

  // Next button
  const handleNext = useCallback(() => {
    if (isExplore) {
      // In explore mode — generate next exercise
      setExploreWord(null);
      setFeedback(null);
      setPhase("active");
      generateExploreExercise(exploreSettings);
      return;
    }
    const nextIdx = currentIdx + 1;
    if (nextIdx >= words.length) {
      setPhase("complete");
    } else {
      setCurrentIdx(nextIdx);
      setFeedback(null);
    }
  }, [currentIdx, words, isExplore, exploreSettings]);

  // Matching auto-completes when all 4 pairs matched
  const handleMatchComplete = useCallback(async () => {
    if (!currentWord) return;
    await handleSrsUpdate(currentWord, "matching", true, words.slice(0, 4));
    handleNext();
  }, [currentWord, words, handleNext]);

  // Skip / I don't know
  const handleSkip = useCallback(async () => {
    if (!currentWord) return;
    if (!isExplore) {
      await handleSrsUpdate(currentWord, exerciseType, false);
    }
    handleNext();
  }, [currentWord, exerciseType, isExplore, handleNext]);

  // ── Explore mode ───────────────────────────────────────────────────────────

  const generateExploreExercise = useCallback(async (settings) => {
    if (!settings) return;
    setCardLoading(true);
    const modeMap = {
      translate: "explore_translate",
      mc:        "explore_mc",
      cloze:     "explore_cloze",
      sentence:  "explore_translate", // generate a word first, then use SentenceCard
    };
    try {
      const data = await (async () => {
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
        return res.json();
      })();

      // Shape the returned data into a word-like object
      const syntheticWord = {
        id:             `explore-${Date.now()}`,
        word:           data.word_ru,
        translation:    data.word_en,
        part_of_speech: data.part_of_speech,
        review_count:   999, // force sentence card for sentence mode
        is_mastered:    false,
        last_exercise_was_cloze: false,
      };

      setExploreWord(syntheticWord);
      setRecentWords(r => [...r.slice(-15), data.word_ru]);

      if (settings.exerciseMode === "mc" && data.options) {
        // API returned options directly
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

  // ── Render helpers ─────────────────────────────────────────────────────────

  const progress = words.length > 0 ? `${currentIdx + 1} / ${words.length}` : "";
  const pct      = words.length > 0 ? (currentIdx / words.length) * 100 : 0;
  const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : null;

  const nextDueTime = () => {
    const future = words
      .filter(w => w.next_review_at)
      .map(w => new Date(w.next_review_at))
      .filter(d => d > new Date())
      .sort((a, b) => a - b);
    if (!future.length) return null;
    const diff = future[0] - Date.now();
    const hrs  = Math.round(diff / 3600000);
    return hrs < 1 ? "less than 1 hour" : `${hrs} hour${hrs !== 1 ? "s" : ""}`;
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (phase === "loading") return <div className={styles.center}><p>Loading your words…</p></div>;
  if (phase === "error")   return <div className={styles.center}><p className={styles.error}>{error}</p><button className={styles.backBtn} onClick={() => navigate("/vocabulary")}>← Back</button></div>;

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

  if (phase === "complete") return (
    <div className={styles.center}>
      <div className={styles.completeCard}>
        <div className={styles.completeIcon}>🎉</div>
        <h2>Session complete</h2>
        <p>{words.length} words reviewed · {nextDueTime() ? `next due in ${nextDueTime()}` : "all up to date"}</p>
        <div className={styles.statsGrid}>
          <div className={styles.statCell}>
            <span className={styles.statVal}>{accuracy !== null ? `${accuracy}%` : "—"}</span>
            <span className={styles.statLbl}>accuracy</span>
          </div>
          <div className={styles.statCell}>
            <span className={styles.statVal}>{streak}</span>
            <span className={styles.statLbl}>streak</span>
          </div>
          <div className={styles.statCell}>
            <span className={styles.statVal}>{leveledUp}</span>
            <span className={styles.statLbl}>leveled up</span>
          </div>
        </div>
        <button className={styles.backBtn} onClick={() => navigate("/vocabulary")}>Back to Vocabulary</button>
      </div>
    </div>
  );

  // Active session
  return (
    <div className={styles.sessionPage}>

      {/* Progress row */}
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

          {/* Exercise cards */}
          {exerciseType === "matching" && (
            <MatchingCard
              words={words.slice(0, 4)}
              onComplete={handleMatchComplete}
            />
          )}

          {exerciseType === "mc" && currentWord && (
            <MultipleChoiceCard
              word={currentWord}
              distractors={distractors}
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

          {/* Next / Skip row */}
          {phase === "active" && (
            <div className={styles.actionRow}>
              {feedback ? (
                <button className={styles.nextBtn} onClick={handleNext}>Next →</button>
              ) : (
                exerciseType !== "matching" && (
                  <button className={styles.skipBtn} onClick={handleSkip}>I don't know</button>
                )
              )}
            </div>
          )}
        </div>

        {/* Desktop sidebar */}
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
        </div>
      </div>
    </div>
  );
}