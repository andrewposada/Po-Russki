// src/modules/Library/ComprehensionBlock.jsx
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../AuthContext";
import { useAttemptTracker, ATTEMPT_SOURCES, COMPREHENSION_TYPE_TOPIC_MAP } from "../../hooks/useAttemptTracker";
import { useProgress } from "../../context/ProgressContext";
import { getAttempt, upsertAttempt, saveQuestions } from "../../storage";
import { QUESTION_TYPES } from "../../constants";
import { useSettings } from "../../context/SettingsContext";
import { useRussianKeyboard } from "../../hooks/useRussianKeyboard";
import styles from "./ComprehensionBlock.module.css";

// ── Utilities ─────────────────────────────────────────────────────────────────

function sampleParagraphs(content, count = 5) {
  if (!content) return [];
  const paras = content.split(/\n\n+/).map(p => p.trim()).filter(p => p.length > 40);
  if (paras.length <= count) return paras;
  // Always include first and last paragraph for context; sample rest randomly
  const middle = paras.slice(1, -1);
  const shuffled = middle.sort(() => Math.random() - 0.5).slice(0, count - 2);
  return [paras[0], ...shuffled, paras[paras.length - 1]];
}

function getWeakTopics(latestReport) {
  // latestReport.report_card.challenges is an array of { topic, trend, ... }
  // We want the topic name strings for the 3 weakest
  try {
    const challenges = latestReport?.report_card?.challenges;
    if (!Array.isArray(challenges) || challenges.length === 0) return [];
    return challenges.slice(0, 3).map(c => c.topic).filter(Boolean);
  } catch {
    return [];
  }
}

function getChapterSummary(book, chapterNum) {
  try {
    const outlines = book?.scaffold?.chapterOutlines;
    if (!Array.isArray(outlines)) return "";
    const outline = outlines.find(o => o.chapterNumber === chapterNum);
    if (!outline) return "";
    // Combine summary + characters + subplots into a compact string
    const parts = [];
    if (outline.summary)            parts.push(outline.summary);
    if (outline.charactersPresent?.length)
      parts.push(`Characters: ${outline.charactersPresent.join(", ")}`);
    if (outline.subplotsAdvanced?.length)
      parts.push(`Subplots: ${outline.subplotsAdvanced.join(", ")}`);
    return parts.join(" | ");
  } catch {
    return "";
  }
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ComprehensionBlock({ chapter, book, onDone }) {
  const { user } = useAuth();
  const { track, COMPREHENSION_TYPE_EXERCISE_MAP } = useAttemptTracker();
  const { latestReport } = useProgress();

  const [questions, setQuestions] = useState(null);
  const [answers,   setAnswers]   = useState({});
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [grading,   setGrading]   = useState(null);
  const [attemptId, setAttemptId] = useState(null);

  useEffect(() => {
    if (!chapter) return;
    loadOrGenerate();
  }, [chapter?.id]);

  async function loadOrGenerate() {
    setLoading(true);
    setError(null);
    try {
      const attempt = await getAttempt(user.uid, chapter.id);
      if (attempt?.questions?.length > 0) {
        setQuestions(attempt.questions);
        setAnswers(attempt.answers ?? {});
        setAttemptId(attempt.id);
        setLoading(false);
        return;
      }
      if (chapter.questions?.length > 0) {
        setQuestions(chapter.questions);
        setLoading(false);
        return;
      }

      const selectedTypes   = selectQuestionTypes();
      const sampledParas    = sampleParagraphs(chapter.content, 5);
      const chapterSummary  = getChapterSummary(book, chapter.chapter_num);
      const weakTopics      = getWeakTopics(latestReport);

      const res = await fetch("/api/generate-comprehension", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          sampledParagraphs: sampledParas,
          chapterSummary,
          chapterNumber: chapter.chapter_num,
          bookTitle:     book?.title,
          level:         book?.level || "B1",
          questionTypes: selectedTypes,
          weakTopics,
        }),
      });
      const data = await res.json();
      if (!data.questions) throw new Error("No questions returned");
      setQuestions(data.questions);

      await saveQuestions(user.uid, chapter.id, data.questions);
      const newId = await upsertAttempt(user.uid, {
        chapterId: chapter.id,
        questions: data.questions,
        answers:   null,
        score:     null,
      });
      setAttemptId(newId);
    } catch (err) {
      setError(err.message || "Could not load questions");
    } finally {
      setLoading(false);
    }
  }

  function selectQuestionTypes() {
    // Fixed slots: detail_recall, vocabulary_in_context, true_false, grammar_spotlight
    // Variable slot 5: inference OR character_motivation (random, level-gated)
    // Variable slot 6: sequence (if available) OR second detail_recall
    const byType = Object.fromEntries(QUESTION_TYPES.map(q => [q.type, q]));

    const selected = [
      byType["detail_recall"],
      byType["vocabulary_in_context"],
      byType["true_false"],
      byType["grammar_spotlight"],
    ];

    // Slot 5: higher-order free response
    const higherOrder = book?.level >= "B1"
      ? (Math.random() < 0.5 ? byType["inference"] : byType["character_motivation"])
      : byType["inference"];
    selected.push(higherOrder ?? byType["inference"]);

    // Slot 6: sequence if chapter outline mentions sequential events, else second detail_recall
    const outline = book?.scaffold?.chapterOutlines?.find(
      o => o.chapterNumber === chapter.chapter_num
    );
    const hasSequentialEvents = outline?.summary?.toLowerCase().includes("then") ||
      outline?.summary?.toLowerCase().includes("after") ||
      outline?.subplotsAdvanced?.length >= 2;
    selected.push(hasSequentialEvents ? byType["sequence"] : byType["detail_recall"]);

    return selected
      .filter(Boolean)
      .map(q => ({ id: q.id, type: q.type, supports_free_response: q.freeResponse }));
  }

  async function handleAnswerSubmit(qIdx, value) {
    const q   = questions[qIdx];
    const key = `q${qIdx}`;
    let score = null, feedback = null;

    if (q.type === "true_false") {
      score    = value === String(q.correct) ? 1 : 0;
      feedback = q.explanation ?? null;
    } else if (q.options && q.correct_index != null) {
      score = value === String(q.correct_index) ? 1 : 0;
    } else if (q.type === "sequence") {
      score = JSON.stringify(value) === JSON.stringify(q.correct_order) ? 1 : 0;
    }

    if (q.correct_answer_guidance) {
      setGrading(qIdx);
      try {
        const res = await fetch("/api/grade-comprehension", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            question:              q.question,
            correctAnswerGuidance: q.correct_answer_guidance,
            studentAnswer:         value,
            level:                 book?.level || "B1",
          }),
        });
        const data = await res.json();
        score    = data.score   ?? 0;
        feedback = data.feedback ?? null;
      } catch {
        score = 0; feedback = "Could not grade this answer.";
      } finally {
        setGrading(null);
      }
    }

    const updatedAnswers = {
      ...answers,
      [key]: { value, question_type_id: q.question_type_id, score, feedback, graded_at: Date.now() },
    };
    setAnswers(updatedAnswers);

    const isCorrect = score === null ? false : score >= 0.5;
    track({
      sourceId:       ATTEMPT_SOURCES.COMPREHENSION,
      topicId:        COMPREHENSION_TYPE_TOPIC_MAP[q.type] ?? null,
      exerciseTypeId: COMPREHENSION_TYPE_EXERCISE_MAP[q.type] ?? null,
      sourceRef:      chapter?.book_id ?? null,
      isCorrect,
      userAnswer:     isCorrect ? null : String(value ?? ""),
      correctAnswer:  isCorrect ? null : (
        q.correct_answer_guidance
          ? "(see feedback)"
          : q.options?.[q.correct_index] ?? String(q.correct) ?? null
      ),
    });

    try {
      const totalScore = Math.round(
        Object.values(updatedAnswers).reduce((s, a) => s + (a.score ?? 0), 0)
        / questions.length * 100
      );
      const id = await upsertAttempt(user.uid, {
        id:        attemptId,
        chapterId: chapter.id,
        questions,
        answers:   updatedAnswers,
        score:     totalScore,
      });
      if (!attemptId) setAttemptId(id);
    } catch (err) {
      console.warn("Could not persist attempt:", err.message);
    }
  }

  if (loading) return (
    <div className={styles.loading}>
      <div className={styles.dots}><span /><span /><span /></div>
      <p style={{ fontSize: 13, color: "var(--c-text-light)" }}>Generating questions…</p>
    </div>
  );

  if (error) return (
    <div className={styles.error}>
      <p>{error}</p>
      <button onClick={loadOrGenerate}>Retry</button>
    </div>
  );

  if (!questions) return null;

  const allAnswered = Object.keys(answers).length >= questions.length;
  const totalScore  = allAnswered
    ? Math.round(Object.values(answers).reduce((s, a) => s + (a.score ?? 0), 0) / questions.length * 100)
    : null;

  return (
    <div className={styles.block}>
      <h3 className={styles.blockTitle}>Comprehension Questions</h3>

      {questions.map((q, idx) => (
        <QuestionCard
          key={idx}
          q={q}
          qIdx={idx}
          answer={answers[`q${idx}`]}
          grading={grading === idx}
          onSubmit={val => handleAnswerSubmit(idx, val)}
        />
      ))}

      {allAnswered && (
        <div className={styles.result}>
          <p className={styles.resultScore}>Score: {totalScore}%</p>
          <button className={styles.doneBtn} onClick={onDone}>Continue Reading</button>
        </div>
      )}

      {!allAnswered && (
        <button className={styles.skipLink} onClick={onDone}>
          Skip questions and continue →
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────
// QuestionCard
// ─────────────────────────────────────────────────────
function QuestionCard({ q, qIdx, answer, grading, onSubmit }) {
  const [freeText, setFreeText] = useState(answer?.value ?? "");
  const [seqOrder, setSeqOrder] = useState(() =>
    q.sequence_items ? q.sequence_items.map((_, i) => i) : []
  );
  const [dragIdx, setDragIdx] = useState(null);
  const touchStartY = useRef(null);
  const touchDragIdx = useRef(null);

  const answered = !!answer;
  const { translitOn } = useSettings();
  const freeTextareaRef = useRef(null);
  useRussianKeyboard(freeTextareaRef, translitOn);

  // ── Drag handlers (mouse) ──────────────────────────────────────────────
  function handleDragStart(idx) {
    setDragIdx(idx);
  }

  function handleDragOver(e, overIdx) {
    e.preventDefault();
    if (dragIdx === null || dragIdx === overIdx) return;
    const next = [...seqOrder];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(overIdx, 0, moved);
    setSeqOrder(next);
    setDragIdx(overIdx);
  }

  function handleDragEnd() {
    setDragIdx(null);
  }

  // ── Touch handlers (mobile) ────────────────────────────────────────────
  function handleTouchStart(e, idx) {
    touchStartY.current  = e.touches[0].clientY;
    touchDragIdx.current = idx;
  }

  function handleTouchMove(e) {
    e.preventDefault();
    if (touchDragIdx.current === null) return;
    const y = e.touches[0].clientY;
    // Find the element being hovered by y-position
    const items = e.currentTarget.closest(`.${styles.sequenceList}`)
      ?.querySelectorAll(`.${styles.seqItem}`);
    if (!items) return;
    let overIdx = touchDragIdx.current;
    items.forEach((el, i) => {
      const rect = el.getBoundingClientRect();
      if (y >= rect.top && y <= rect.bottom) overIdx = i;
    });
    if (overIdx !== touchDragIdx.current) {
      const next = [...seqOrder];
      const [moved] = next.splice(touchDragIdx.current, 1);
      next.splice(overIdx, 0, moved);
      setSeqOrder(next);
      touchDragIdx.current = overIdx;
    }
  }

  function handleTouchEnd() {
    touchDragIdx.current = null;
    touchStartY.current  = null;
  }

  return (
    <div className={`${styles.card} ${answered ? styles.cardAnswered : ""}`}>
      <p className={styles.qLabel}>
        Q{qIdx + 1} · <span className={styles.qType}>{q.type?.replace(/_/g, " ")}</span>
      </p>
      <p className={styles.qText}>{q.question}</p>

      {/* Multiple choice */}
      {q.options && (
        <div className={styles.options}>
          {q.options.map((opt, i) => {
            const isSelected = answer?.value === String(i);
            const isCorrect  = answered && i === q.correct_index;
            const isWrong    = answered && isSelected && !isCorrect;
            return (
              <button key={i}
                className={`${styles.option} ${isCorrect ? styles.optionCorrect : ""} ${isWrong ? styles.optionWrong : ""} ${!answered ? styles.optionClickable : ""}`}
                onClick={() => !answered && onSubmit(String(i))}
                disabled={answered}
              >{opt}</button>
            );
          })}
        </div>
      )}

      {/* True / False */}
      {q.type === "true_false" && !q.options && (
        <div className={styles.tfBtns}>
          {["true", "false"].map(v => {
            const label      = v === "true" ? "Верно" : "Неверно";
            const isSelected = answer?.value === v;
            const isCorrect  = answered && v === String(q.correct);
            const isWrong    = answered && isSelected && !isCorrect;
            return (
              <button key={v}
                className={`${styles.tfBtn} ${isCorrect ? styles.optionCorrect : ""} ${isWrong ? styles.optionWrong : ""} ${!answered ? styles.optionClickable : ""}`}
                onClick={() => !answered && onSubmit(v)}
                disabled={answered}
              >{label}</button>
            );
          })}
        </div>
      )}

      {/* Sequence — drag to reorder */}
      {q.type === "sequence" && q.sequence_items && (
        <div
          className={styles.sequenceList}
          onTouchMove={!answered ? handleTouchMove : undefined}
          onTouchEnd={!answered ? handleTouchEnd : undefined}
        >
          {seqOrder.map((itemIdx, pos) => (
            <div
              key={pos}
              className={`${styles.seqItem} ${dragIdx === pos ? styles.seqItemDragging : ""}`}
              draggable={!answered}
              onDragStart={() => !answered && handleDragStart(pos)}
              onDragOver={e => !answered && handleDragOver(e, pos)}
              onDragEnd={handleDragEnd}
              onTouchStart={e => !answered && handleTouchStart(e, pos)}
            >
              {!answered && (
                <span className={styles.dragHandle} aria-hidden="true">⠿</span>
              )}
              <span className={styles.seqNum}>{pos + 1}</span>
              <span className={styles.seqText}>{q.sequence_items[itemIdx]}</span>
            </div>
          ))}
          {!answered && (
            <button className={styles.seqSubmit} onClick={() => onSubmit(seqOrder)}>
              Confirm order
            </button>
          )}
        </div>
      )}

      {/* Free response */}
      {q.correct_answer_guidance && (
        <div className={styles.freeResponse}>
          <textarea
            ref={freeTextareaRef}
            value={answered ? (answer.value ?? "") : freeText}
            onChange={e => !answered && setFreeText(e.target.value)}
            disabled={answered}
            placeholder="Type your answer in English or Russian…"
            className={styles.freeTextarea}
            rows={3}
          />
          {!answered && (
            <button
              className={styles.submitBtn}
              onClick={() => freeText.trim() && onSubmit(freeText.trim())}
              disabled={!freeText.trim() || grading}
            >{grading ? "Grading…" : "Submit"}</button>
          )}
        </div>
      )}

      {answered && answer.feedback && (
        <p className={styles.feedback}>{answer.feedback}</p>
      )}
      {answered && q.type === "true_false" && q.explanation && !answer.feedback && (
        <p className={styles.feedback}>{q.explanation}</p>
      )}

      {answered && answer.score != null && (
        <span className={`${styles.scoreBadge} ${
          answer.score === 1   ? styles.scoreCorrect :
          answer.score === 0   ? styles.scoreWrong   : styles.scorePartial
        }`}>
          {answer.score === 1 ? "✓ Correct" : answer.score === 0.5 ? "Partial" : "✗ Incorrect"}
        </span>
      )}
    </div>
  );
}