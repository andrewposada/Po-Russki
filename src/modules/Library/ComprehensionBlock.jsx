// src/modules/Library/ComprehensionBlock.jsx
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../AuthContext";
import { useAttemptTracker, ATTEMPT_SOURCES, COMPREHENSION_TYPE_TOPIC_MAP } from "../../hooks/useAttemptTracker";
import { getAttempt, upsertAttempt, saveQuestions } from "../../storage";
import { QUESTION_TYPES } from "../../constants";
import { useSettings } from "../../context/SettingsContext";
import { useRussianKeyboard } from "../../hooks/useRussianKeyboard";
import styles from "./ComprehensionBlock.module.css";

export default function ComprehensionBlock({ chapter, book, onDone }) {
  const { user } = useAuth();
  const { track } = useAttemptTracker();

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
      const selectedTypes = selectQuestionTypes();
      const res = await fetch("/api/generate-comprehension", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          chapterText:   chapter.content,
          chapterNumber: chapter.chapter_num,
          bookTitle:     book?.title,
          level:         book?.level || "B1",
          questionTypes: selectedTypes,
        }),
      });
      const data = await res.json();
      if (!data.questions) throw new Error("No questions returned");
      setQuestions(data.questions);
      // Save questions to chapters table (backup / fast path)
      await saveQuestions(user.uid, chapter.id, data.questions);
      // Also create an attempt row immediately so getAttempt() finds
      // the questions on any future visit, even with zero answers
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
    const all      = [...QUESTION_TYPES];
    const selected = [];

    const gs  = all.find(q => q.type === "grammar_spotlight");
    if (gs) selected.push(gs);

    const vic = all.find(q => q.type === "vocabulary_in_context");
    if (vic) selected.push(vic);

    const freeTypes = all.filter(q => q.freeResponse && !selected.find(s => s.id === q.id));
    if (freeTypes.length > 0)
      selected.push(freeTypes[Math.floor(Math.random() * freeTypes.length)]);

    const remaining = all.filter(q => !selected.find(s => s.id === q.id));
    let tfCount = 0;
    while (selected.length < 6 && remaining.length > 0) {
      const idx  = Math.floor(Math.random() * remaining.length);
      const pick = remaining.splice(idx, 1)[0];
      if (pick.type === "true_false" && tfCount >= 2) continue;
      if (pick.type === "true_false") tfCount++;
      selected.push(pick);
    }
    return selected.map(q => ({ id: q.id, type: q.type, supports_free_response: q.freeResponse }));
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

    // Track the attempt — score: 1 = correct, 0.5 = partial, 0 = wrong, null = not yet graded
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
  const answered = !!answer;
  const { translitOn } = useSettings();
  const freeTextareaRef = useRef(null);
  useRussianKeyboard(freeTextareaRef, translitOn);

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

      {/* Sequence */}
      {q.type === "sequence" && q.sequence_items && (
        <div className={styles.sequenceList}>
          {seqOrder.map((itemIdx, pos) => (
            <div key={pos} className={styles.seqItem}>
              <span className={styles.seqNum}>{pos + 1}</span>
              <span className={styles.seqText}>{q.sequence_items[itemIdx]}</span>
              {!answered && (
                <div className={styles.seqBtns}>
                  <button onClick={() => {
                    if (pos === 0) return;
                    const next = [...seqOrder];
                    [next[pos-1], next[pos]] = [next[pos], next[pos-1]];
                    setSeqOrder(next);
                  }} disabled={pos === 0}>▲</button>
                  <button onClick={() => {
                    if (pos === seqOrder.length - 1) return;
                    const next = [...seqOrder];
                    [next[pos], next[pos+1]] = [next[pos+1], next[pos]];
                    setSeqOrder(next);
                  }} disabled={pos === seqOrder.length - 1}>▼</button>
                </div>
              )}
            </div>
          ))}
          {!answered && (
            <button className={styles.seqSubmit} onClick={() => onSubmit(seqOrder)}>
              Submit order
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
          answer.score === 1 ? styles.scoreCorrect :
          answer.score === 0 ? styles.scoreWrong   : styles.scorePartial
        }`}>
          {answer.score === 1 ? "✓ Correct" : answer.score === 0.5 ? "Partial" : "✗ Incorrect"}
        </span>
      )}
    </div>
  );
}