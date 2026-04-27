// src/modules/Lessons/blocks/SentenceChoiceBlock.jsx
import { useState } from "react";
import styles        from "./Blocks.module.css";

export default function SentenceChoiceBlock({ block, onAnswer, previousAnswer }) {
  const [selected, setSelected] = useState(() => {
    if (!previousAnswer?.answer) return null;
    const idx = parseInt(previousAnswer.answer, 10);
    return isNaN(idx) ? null : idx;
  });

  function handleSelect(idx) {
    if (selected !== null) return;
    setSelected(idx);
    onAnswer(idx === block.correct_index);
  }

  function optionClass(idx) {
    if (selected === null) return styles.sentenceChoiceOption;
    if (idx === block.correct_index) {
      return `${styles.sentenceChoiceOption} ${styles.sentenceChoiceCorrect} ${styles.sentenceChoiceLocked}`;
    }
    if (idx === selected) {
      return `${styles.sentenceChoiceOption} ${styles.sentenceChoiceWrong} ${styles.sentenceChoiceLocked}`;
    }
    return `${styles.sentenceChoiceOption} ${styles.sentenceChoiceLocked}`;
  }

  return (
    <div className={styles.sentenceChoice}>
      <p className={styles.sentenceChoiceInstruction}>{block.instruction}</p>
      <div className={styles.sentenceChoiceOptions}>
        {block.options.map((opt, i) => (
          <button key={i} className={optionClass(i)} onClick={() => handleSelect(i)}>
            <span className={styles.sentenceChoiceRu}>{opt.ru}</span>
            <span className={styles.sentenceChoiceEn}>{opt.en}</span>
            {selected !== null && i === block.correct_index && (
              <span className={styles.sentenceChoiceMark}>✓</span>
            )}
            {selected !== null && i === selected && i !== block.correct_index && (
              <span className={styles.sentenceChoiceMark}>✗</span>
            )}
          </button>
        ))}
      </div>
      {selected !== null && (
        <div className={styles.sentenceChoiceExplanation}>{block.explanation}</div>
      )}
    </div>
  );
}