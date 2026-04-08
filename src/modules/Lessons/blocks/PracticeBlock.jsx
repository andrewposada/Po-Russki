// src/modules/Lessons/blocks/PracticeBlock.jsx
import { useState, useRef } from "react";
import { useRussianKeyboard } from "../../../hooks/useRussianKeyboard";
import styles from "./Blocks.module.css";

export default function PracticeBlock({ block, onSubmit }) {
  const [answer, setAnswer]       = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [correct, setCorrect]     = useState(null);
  const [feedback, setFeedback]   = useState("");
  const [loading, setLoading]     = useState(false);
  const [hintVisible, setHintVisible] = useState(false);
  const [ruMode, setRuMode]       = useState(true);

  const inputRef = useRef(null);
  useRussianKeyboard(inputRef, ruMode);

  async function handleCheck() {
    if (!answer.trim() || submitted) return;
    setLoading(true);
    try {
      const res = await fetch("/api/lesson-grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answer:          answer.trim(),
          target_word:     block.target_word,
          grammar_context: block.grammar_context,
          prompt_ru:       block.prompt_ru,
        }),
      });
      const data = await res.json();
      const isCorrect = data.correct === true;
      setCorrect(isCorrect);
      setFeedback(
        isCorrect
          ? `✓ Correct! "${block.target_word}" is right.`
          : `✗ The correct answer is "${block.target_word}".`
      );
      setSubmitted(true);
      onSubmit(answer.trim(), isCorrect, feedback);
    } catch {
      setFeedback("Could not check answer — please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") handleCheck();
  }

  const inputClass = submitted
    ? correct
      ? `${styles.practiceInput} ${styles.practiceInputCorrect}`
      : `${styles.practiceInput} ${styles.practiceInputWrong}`
    : styles.practiceInput;

  return (
    <div className={styles.practice}>
      <p className={styles.practicePromptRu}>{block.prompt_ru}</p>
      <p className={styles.practicePromptEn}>{block.prompt_en}</p>

      {block.hint && !submitted && (
        <>
          <button className={styles.practiceHintToggle} onClick={() => setHintVisible(v => !v)}>
            {hintVisible ? "Hide hint" : "Show hint"}
          </button>
          {hintVisible && <p className={styles.practiceHint}>{block.hint}</p>}
        </>
      )}

      <div className={styles.inputWithToggle}>
        <div className={styles.practiceInputRow}>
          <input
            ref={inputRef}
            className={inputClass}
            type="text"
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={submitted}
            placeholder="Type your answer…"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          <button
            className={styles.practiceCheckBtn}
            onClick={handleCheck}
            disabled={!answer.trim() || submitted || loading}
          >
            {loading ? "…" : "Check"}
          </button>
        </div>
        <button
          type="button"
          className={`${styles.kbToggle} ${ruMode ? styles.kbToggleActive : ""}`}
          onClick={() => setRuMode(m => !m)}
          aria-label="Toggle Russian keyboard"
        >
          {ruMode ? "РУ" : "EN"}
        </button>
      </div>

      {submitted && (
        <div className={`${styles.practiceFeedback} ${correct ? styles.practiceFeedbackCorrect : styles.practiceFeedbackWrong}`}>
          {feedback}
        </div>
      )}

      {submitted && !correct && (
        <div className={styles.practiceRemember}>
          <strong>Remember:</strong> {block.grammar_context}
        </div>
      )}
    </div>
  );
}