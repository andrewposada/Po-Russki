// src/modules/Lessons/blocks/FreeResponseBlock.jsx
import { useState, useRef } from "react";
import { useRussianKeyboard } from "../../../hooks/useRussianKeyboard";
import styles from "./Blocks.module.css";

export default function FreeResponseBlock({ block, onSubmit }) {
  const [answer, setAnswer]   = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [grade, setGrade]     = useState(null);
  const [ruMode, setRuMode]   = useState(true);

  const textareaRef = useRef(null);
  useRussianKeyboard(textareaRef, ruMode);

  const isMultiLine = block.type === "free_response_paragraph";

  async function handleSubmit() {
    if (!answer.trim() || submitted) return;
    setLoading(true);
    try {
      const res = await fetch("/api/lesson-grade-free", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answer:     answer.trim(),
          prompt:     block.prompt,
          block_type: block.type,
          cefr_level: block.cefr_level || "B1",
        }),
      });
      const data = await res.json();
      setGrade(data);
      setSubmitted(true);
      onSubmit(answer.trim(), data.score >= 70, data);
    } catch {
      setGrade({ teacher_note: "Could not grade — please try again.", score: 0, errors: [] });
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.freeResponse}>
      <p className={styles.freeResponsePrompt}>{block.prompt}</p>
      {block.guidance && <p className={styles.freeResponseGuidance}>{block.guidance}</p>}

      <div className={styles.inputWithToggle}>
        <textarea
          ref={textareaRef}
          className={styles.freeResponseTextarea}
          value={answer}
          onChange={e => setAnswer(e.target.value)}
          disabled={submitted}
          rows={isMultiLine ? 5 : 3}
          placeholder="Write your answer in Russian…"
        />
        <button
          type="button"
          className={`${styles.kbToggle} ${ruMode ? styles.kbToggleActive : ""}`}
          onClick={() => setRuMode(m => !m)}
          aria-label="Toggle Russian keyboard"
        >
          {ruMode ? "РУ" : "EN"}
        </button>
      </div>

      {!submitted && (
        <button
          className={styles.freeResponseSubmitBtn}
          onClick={handleSubmit}
          disabled={!answer.trim() || loading}
        >
          {loading ? "Grading…" : "Submit"}
        </button>
      )}

      {loading && <p className={styles.freeResponseGrading}>Your teacher is reading this…</p>}

      {grade && (
        <div className={styles.freeResponseGradeCard}>
          <div className={styles.freeResponseScore}>{grade.score}/100</div>
          <p className={styles.freeResponseTeacherNote}>{grade.teacher_note}</p>
          {grade.corrected_text && (
            <div className={styles.freeResponseCorrected}>{grade.corrected_text}</div>
          )}
          {grade.errors?.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--c-text-light)", marginBottom: 6 }}>
                CORRECTIONS
              </p>
              {grade.errors.map((err, i) => (
                <div key={i} className={styles.freeResponseError}>
                  <span className={styles.freeResponseErrorOriginal}>{err.original}</span>
                  {" → "}
                  <span className={styles.freeResponseErrorCorrected}>{err.corrected}</span>
                  <span style={{ fontSize: 12, color: "var(--c-text-light)", display: "block", marginTop: 2 }}>
                    {err.explanation}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}