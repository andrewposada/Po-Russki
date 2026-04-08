// src/modules/Lessons/blocks/ErrorCorrectionBlock.jsx
import { useState } from "react";
import styles        from "./Blocks.module.css";

export default function ErrorCorrectionBlock({ block, onSubmit }) {
  const [answer,    setAnswer]    = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [correct,   setCorrect]   = useState(null);

  function handleCheck() {
    if (!answer.trim() || submitted) return;
    const isCorrect =
      answer.trim().toLowerCase() === block.corrected_word.toLowerCase();
    setCorrect(isCorrect);
    setSubmitted(true);
    onSubmit(answer.trim(), isCorrect);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") handleCheck();
  }

  // Render the sentence with error_word highlighted
  const parts = block.sentence_ru.split(block.error_word);

  const inputClass = submitted
    ? correct
      ? `${styles.practiceInput} ${styles.practiceInputCorrect}`
      : `${styles.practiceInput} ${styles.practiceInputWrong}`
    : styles.practiceInput;

  return (
    <div className={styles.errorCorrection}>
      <div className={styles.errorCorrectionSentence}>
        {parts.map((part, i) => (
          <span key={i}>
            {part}
            {i < parts.length - 1 && (
              <span className={styles.errorWord}>{block.error_word}</span>
            )}
          </span>
        ))}
      </div>
      <div className={styles.errorCorrectionEn}>{block.sentence_en}</div>

      <div className={styles.practiceInputRow}>
        <input
          className={inputClass}
          type="text"
          value={answer}
          onChange={e => setAnswer(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type the corrected word"
          disabled={submitted}
        />
        <button
          className={styles.practiceCheckBtn}
          onClick={handleCheck}
          disabled={!answer.trim() || submitted}
        >
          Check
        </button>
      </div>

      {submitted && (
        <div className={`${styles.practiceFeedback} ${correct ? styles.practiceFeedbackCorrect : styles.practiceFeedbackWrong}`}>
          {correct
            ? `✓ Correct! "${block.corrected_word}" is right.`
            : `✗ The correct word is "${block.corrected_word}".`}
        </div>
      )}

      {submitted && block.explanation && (
        <div className={styles.quizExplanation}>{block.explanation}</div>
      )}
    </div>
  );
}