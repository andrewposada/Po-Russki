// src/modules/Vocabulary/cards/MultipleChoiceCard.jsx
// Tier 1 — show Russian word, pick correct English translation from 4 options.

import { useState, useEffect } from "react";
import styles from "./Cards.module.css";

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function MultipleChoiceCard({
  word,           // word object
  distractors,    // string[] — 3 wrong options from api/vocab-generate.js
  loading,        // bool — true while fetching distractors
  onAnswer,       // (correct: bool) => void
  feedback,       // { correct, feedback } | null — set after answer
}) {
  const [options, setOptions] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (distractors?.length) {
      setOptions(shuffle([word.translation, ...distractors]));
      setSelected(null);
    }
  }, [distractors, word]);

  const handleSelect = (opt) => {
    if (feedback) return; // already answered
    setSelected(opt);
    onAnswer(opt === word.translation);
  };

  const optClass = (opt) => {
    if (!feedback) return selected === opt ? `${styles.mcOption} ${styles.selected}` : styles.mcOption;
    if (opt === word.translation) return `${styles.mcOption} ${styles.correct}`;
    if (opt === selected)         return `${styles.mcOption} ${styles.wrong}`;
    return `${styles.mcOption} ${styles.dimmed}`;
  };

  return (
    <div className={styles.card} style={feedback ? { borderColor: feedback.correct ? "#639922" : "#A32D2D" } : {}}>
      <div className={styles.tierBadge} style={{ background: "#EAF3DE", color: "#3B6D11" }}>
        Tier 1
      </div>
      <p className={styles.taskLabel}>CHOOSE THE CORRECT TRANSLATION</p>
      <p className={`${styles.wordRu} ru`}>{word.word}</p>
      {word.part_of_speech && (
        <p className={styles.posLabel}>{word.part_of_speech}</p>
      )}

      {loading ? (
        <p className={styles.loading}>Loading options…</p>
      ) : (
        <div className={styles.mcOptions}>
          {options.map((opt, i) => (
            <button key={i} className={optClass(opt)} onClick={() => handleSelect(opt)}>
              {opt}
            </button>
          ))}
        </div>
      )}

      {feedback && (
        <p className={styles.feedbackText} style={{ color: feedback.correct ? "#639922" : "#A32D2D" }}>
          {feedback.correct ? "✓ Correct" : `✗ ${word.translation}`}
        </p>
      )}
    </div>
  );
}