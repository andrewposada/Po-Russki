// src/modules/Lessons/blocks/QuizBlock.jsx
import { useState } from "react";
import styles from "./Blocks.module.css";

export default function QuizBlock({ block, onAnswer, previousAnswer }) {
  const [selected, setSelected] = useState(() => {
    if (!previousAnswer) return null;
    // answer stores "true"/"false" — we can't recover which option was picked,
    // so show the correct answer highlighted as a review state
    return previousAnswer.grade?.correct === true
      ? block.correct_index
      : block.correct_index; // either way, highlight the correct answer on review
  });

  function handleSelect(idx) {
    if (selected !== null) return; // locked after first selection
    setSelected(idx);
    const correct = idx === block.correct_index;
    onAnswer(correct, idx);
  }

  function optionClass(idx) {
    if (selected === null) return styles.quizOption;
    if (idx === block.correct_index) return `${styles.quizOption} ${styles.quizOptionCorrect} ${styles.quizOptionLocked}`;
    if (idx === selected) return `${styles.quizOption} ${styles.quizOptionWrong} ${styles.quizOptionLocked}`;
    return `${styles.quizOption} ${styles.quizOptionLocked}`;
  }

  return (
    <div className={styles.quiz}>
      <p className={styles.quizQuestion}>{block.question}</p>
      <div className={styles.quizOptions}>
        {block.options.map((opt, i) => (
          <button key={i} className={optionClass(i)} onClick={() => handleSelect(i)}>
            {opt}
          </button>
        ))}
      </div>
      {selected !== null && (
        <div className={styles.quizExplanation}>{block.explanation}</div>
      )}
    </div>
  );
}