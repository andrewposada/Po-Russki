// src/modules/Lessons/AssignmentsQueue.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate }  from "react-router-dom";
import { useAuth }      from "../../AuthContext";
import {
  getPendingAssignments,
  updateLessonAnswerGrade,
  addXP,
  getCoreLessons,
  getUserLessons,
} from "../../storage";
import { useRussianKeyboard } from "../../hooks/useRussianKeyboard";
import { useSettings }        from "../../context/SettingsContext";
import styles from "./AssignmentsQueue.module.css";

const XP_PER_CORRECT = 10;

// ── Assignment player (inline — contains input, must not be extracted) ─────────

export default function AssignmentsQueue() {
  const navigate    = useNavigate();
  const { user }    = useAuth();

  const [screen,      setScreen]      = useState("list");   // "list" | "active"
  const [assignments, setAssignments] = useState([]);
  const [lessonTitleMap, setLessonTitleMap] = useState({});
  const [loading,     setLoading]     = useState(true);

  // Active assignment state
  const [activeRow,        setActiveRow]        = useState(null);   // lesson_answers row
  const [exercises,        setExercises]        = useState([]);
  const [currentExIndex,   setCurrentExIndex]   = useState(0);
  const [results,          setResults]          = useState([]);     // { correct, feedback }
  const [exCompleted,      setExDone]           = useState(false);
  const [assignmentDone,   setAssignmentDone]   = useState(false);
  const [xpEarned,         setXpEarned]         = useState(0);
  const [completedCount,   setCompletedCount]   = useState(0);     // graded this session

  // Exercise input state (inline — contains input)
  const [answer,    setAnswer]    = useState("");
  const [feedback,  setFeedback]  = useState(null);  // { correct, message } | null
  const [grading,   setGrading]   = useState(false);

  // Stale closure guard
  const currentExIndexRef = useRef(0);
  const resultsRef        = useRef([]);

  const inputRef = useRef(null);
  const { translitOn } = useSettings();
  useRussianKeyboard(inputRef, translitOn);

  // ── Load ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;
    async function load() {
      const [pending, coreLessons, userLessons] = await Promise.all([
        getPendingAssignments(user.uid),
        getCoreLessons(),
        getUserLessons(user.uid),
      ]);
      const all = [...(coreLessons || []), ...(userLessons || [])];
      const titleMap = Object.fromEntries(all.map(l => [l.id, l.title]));
      setAssignments(pending || []);
      setLessonTitleMap(titleMap);
      setLoading(false);
    }
    load();
  }, [user]);

  // ── Start an assignment ────────────────────────────────────────────────────

  function startAssignment(row) {
    let parsed = [];
    try { parsed = JSON.parse(row.answer); } catch { parsed = []; }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      console.warn("Assignment row has no parseable exercises:", row.id);
      return;
    }
    setActiveRow(row);
    setExercises(parsed);
    setCurrentExIndex(0);
    currentExIndexRef.current = 0;
    setResults([]);
    resultsRef.current = [];
    setExDone(false);
    setAssignmentDone(false);
    setXpEarned(0);
    setAnswer("");
    setFeedback(null);
    setGrading(false);
    setScreen("active");
  }

  // ── Grade one exercise ─────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    const idx = currentExIndexRef.current;
    const ex  = exercises[idx];
    if (!ex || grading || exCompleted) return;

    const trimmed = answer.trim();
    if (!trimmed) return;

    setGrading(true);

    try {
      const res = await fetch("/api/lesson-grade", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt_ru:       ex.prompt_ru,
          target_word:     ex.target_word,
          grammar_context: ex.grammar_context,
          user_answer:     trimmed,
        }),
      });
      const data = await res.json();
      const isCorrect = data.correct === true;
      const message   = data.feedback ?? (isCorrect ? "Correct!" : `The correct answer is: ${ex.target_word}`);

      const newResult = { correct: isCorrect, feedback: message };
      resultsRef.current = [...resultsRef.current, newResult];
      setResults([...resultsRef.current]);
      setFeedback({ correct: isCorrect, message });
      setExDone(true);

      if (isCorrect) await addXP(user.uid, XP_PER_CORRECT);
    } catch (err) {
      console.error("lesson-grade error:", err);
      setFeedback({ correct: false, message: "Could not grade answer — please try again." });
    } finally {
      setGrading(false);
    }
  }, [answer, exercises, grading, exCompleted, user]);

  // ── Next exercise / finish assignment ─────────────────────────────────────

  async function handleNext() {
    const idx  = currentExIndexRef.current;
    const next = idx + 1;

    if (next >= exercises.length) {
      // All exercises done — compute score and write grade
      const correctCount = resultsRef.current.filter(r => r.correct).length;
      const score = exercises.length > 0
        ? Math.round((correctCount / exercises.length) * 100)
        : 0;
      const totalXp = correctCount * XP_PER_CORRECT;
      setXpEarned(totalXp);

      // Write grade to lesson_answers row
      await updateLessonAnswerGrade(activeRow.id, {
        correct:      correctCount === exercises.length,
        score,
        total:        exercises.length,
        correct_count: correctCount,
        completed_at:  new Date().toISOString(),
      });

      // Remove from local list and increment completed count
      setAssignments(prev => prev.filter(a => a.id !== activeRow.id));
      setCompletedCount(c => c + 1);
      setAssignmentDone(true);
    } else {
      currentExIndexRef.current = next;
      setCurrentExIndex(next);
      setExDone(false);
      setAnswer("");
      setFeedback(null);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }

  // ── Back to list ───────────────────────────────────────────────────────────

  function backToList() {
    setScreen("list");
    setActiveRow(null);
    setExercises([]);
    setFeedback(null);
    setAnswer("");
    setExDone(false);
    setAssignmentDone(false);
  }

  // ── Render — loading ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className={styles.loadingState}>
        Loading assignments…
      </div>
    );
  }

  // ── Render — assignment complete summary ───────────────────────────────────

  if (screen === "active" && assignmentDone) {
    const correctCount = resultsRef.current.filter(r => r.correct).length;
    const score = exercises.length > 0
      ? Math.round((correctCount / exercises.length) * 100)
      : 0;
    const scoreClass =
      score >= 70 ? styles.scoreGreen :
      score >= 50 ? styles.scoreAmber :
      styles.scoreRed;

    return (
      <div className={styles.page}>
        <div className={styles.summaryScreen}>
          <div className={styles.summaryIcon}>✅</div>
          <div className={styles.summaryTitle}>Assignment complete!</div>
          <div className={styles.summarySub}>{activeRow.prompt ?? "Assignment"}</div>
          <div className={styles.summaryCard}>
            <div className={`${styles.summaryScore} ${scoreClass}`}>{score}%</div>
            <div className={styles.summaryScoreLabel}>{correctCount} of {exercises.length} correct</div>
            {xpEarned > 0 && (
              <div className={styles.xpBadge}>+{xpEarned} XP</div>
            )}
          </div>
          <div className={styles.summaryResults}>
            {results.map((r, i) => (
              <div key={i} className={`${styles.summaryResultRow} ${r.correct ? styles.resultCorrect : styles.resultWrong}`}>
                <span className={styles.resultIcon}>{r.correct ? "✓" : "✗"}</span>
                <span className={styles.resultText}>Exercise {i + 1}</span>
              </div>
            ))}
          </div>
          <button className={styles.backBtn} onClick={backToList}>
            ← Back to Assignments
          </button>
        </div>
      </div>
    );
  }

  // ── Render — active assignment player ─────────────────────────────────────

  if (screen === "active" && exercises.length > 0) {
    const ex = exercises[currentExIndex];

    const exerciseCard = (
      <div className={styles.exerciseCard}>
        {/* Progress dots */}
        <div className={styles.exProgress}>
          {exercises.map((_, i) => (
            <div
              key={i}
              className={`${styles.exDot} ${
                i < currentExIndex    ? styles.exDotDone    :
                i === currentExIndex  ? styles.exDotActive  :
                styles.exDotPending
              }`}
            />
          ))}
        </div>
        <div className={styles.exCounter}>
          Exercise {currentExIndex + 1} of {exercises.length}
        </div>

        {/* Prompt */}
        <div className={styles.exPromptEn}>{ex.prompt_en}</div>
        <div className={styles.exPromptRu}>{ex.prompt_ru}</div>
        {ex.hint && !exCompleted && (
          <div className={styles.exHint}>💡 {ex.hint}</div>
        )}

        {/* Input */}
        {!exCompleted && (
          <div className={styles.exInputRow}>
            <input
              ref={inputRef}
              className={styles.exInput}
              type="text"
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !grading) handleSubmit();
              }}
              placeholder="Type your answer…"
              autoFocus
              disabled={grading}
            />
            <button
              className={styles.exSubmitBtn}
              onClick={handleSubmit}
              disabled={!answer.trim() || grading}
            >
              {grading ? "…" : "Check →"}
            </button>
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <div className={`${styles.exFeedback} ${feedback.correct ? styles.feedbackCorrect : styles.feedbackWrong}`}>
            <span className={styles.feedbackIcon}>{feedback.correct ? "✓" : "✗"}</span>
            <span className={styles.feedbackText}>{feedback.message}</span>
          </div>
        )}
      </div>
    );

    return (
      <div className={styles.page}>
        {/* Top bar */}
        <div className={styles.topBar}>
          <button className={styles.exitBtn} onClick={backToList}>✕ Exit</button>
          <div className={styles.topBarTitle}>{activeRow.prompt ?? "Assignment"}</div>
          <div className={styles.topBarSource}>
            {lessonTitleMap[activeRow.lesson_id] ?? activeRow.lesson_id}
          </div>
        </div>

        <div className={styles.playerBody}>
          {exerciseCard}

          {exCompleted && (
            <div className={styles.nextRow}>
              <button className={styles.nextBtn} onClick={handleNext}>
                {currentExIndex >= exercises.length - 1 ? "Finish →" : "Next →"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Render — assignment list ───────────────────────────────────────────────

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backLink} onClick={() => navigate("/lessons")}>
          ← Lessons
        </button>
        <div className={styles.headerTitle}>Assignments</div>
        {completedCount > 0 && (
          <div className={styles.completedBadge}>
            {completedCount} completed this session
          </div>
        )}
      </div>

      {/* Empty state */}
      {assignments.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📋</div>
          <div className={styles.emptyTitle}>All caught up!</div>
          <div className={styles.emptySub}>
            {completedCount > 0
              ? `You completed ${completedCount} assignment${completedCount !== 1 ? "s" : ""} this session.`
              : "Complete lessons to unlock assignments."}
          </div>
          <button className={styles.emptyBtn} onClick={() => navigate("/lessons")}>
            Back to Lessons
          </button>
        </div>
      )}

      {/* Assignment cards */}
      <div className={styles.cardList}>
        {assignments.map(row => {
          let exCount = 0;
          try { exCount = JSON.parse(row.answer)?.length ?? 0; } catch { exCount = 0; }

          return (
            <div key={row.id} className={styles.assignmentCard}>
              <div className={styles.assignmentCardSource}>
                {lessonTitleMap[row.lesson_id] ?? row.lesson_id}
              </div>
              <div className={styles.assignmentCardTitle}>
                {row.prompt ?? "Assignment"}
              </div>
              <div className={styles.assignmentCardMeta}>
                {exCount} exercise{exCount !== 1 ? "s" : ""}
              </div>
              <button
                className={styles.startBtn}
                onClick={() => startAssignment(row)}
              >
                Start →
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}