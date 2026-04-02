// src/modules/Vocabulary/cards/SentenceCard.jsx
// Tier 3 + Mastered — write any Russian sentence using the target word.
// Never shows the Russian word — the English translation is the only prompt.

import { useState, useRef, useEffect } from "react";
import { useSettings }        from "../../../context/SettingsContext";
import { useRussianKeyboard } from "../../../hooks/useRussianKeyboard";
import styles from "./Cards.module.css";

export default function SentenceCard({
  word,       // word object
  onAnswer,   // (studentAnswer: string) => void
  feedback,   // { correct, feedback } | null
  grading,    // bool
}) {
  const { translitOn } = useSettings();
  const textareaRef = useRef(null);
  useRussianKeyboard(textareaRef, translitOn);

  const [value, setValue] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    setValue("");
    setDetailsOpen(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, [word]);

  const isMastered = word.is_mastered;
  const tierBg     = isMastered ? "#EEEDFE" : "#FBEAF0";
  const tierText   = isMastered ? "#3C3489" : "#993556";
  const tierLabel  = isMastered ? "Mastered" : "Tier 3";

  return (
    <div className={styles.card} style={feedback ? { borderColor: feedback.correct ? "#639922" : "#A32D2D" } : {}}>
      <div className={styles.tierBadge} style={{ background: tierBg, color: tierText }}>
        {tierLabel}
      </div>
      <p className={styles.taskLabel}>USE THIS WORD IN A RUSSIAN SENTENCE</p>
      <p className={styles.wordEn}>{word.translation}</p>
      {word.part_of_speech && <p className={styles.posLabel}>{word.part_of_speech}</p>}

      <textarea
        ref={textareaRef}
        className={`${styles.textarea} ru`}
        rows={2}
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="Ваш ответ…"
        disabled={!!feedback || grading}
        style={{ resize: "none" }}
      />
      <button
        className={styles.submitBtn}
        style={{ marginTop: 8, alignSelf: "flex-end" }}
        onClick={() => !grading && !feedback && value.trim() && onAnswer(value.trim())}
        disabled={!value.trim() || !!feedback || grading}
      >
        {grading ? "Grading…" : "Check"}
      </button>

      {feedback && (
        <p className={styles.feedbackText} style={{ color: feedback.correct ? "#639922" : "#A32D2D" }}>
          {feedback.correct ? "✓ " : "✗ "}{feedback.feedback}
        </p>
      )}

      {/* Word details (no Russian word shown) */}
      <div className={styles.detailsPanel}>
        <button className={styles.detailsToggle} onClick={() => setDetailsOpen(o => !o)}>
          word details {detailsOpen ? "▲" : "▼"}
        </button>
        {detailsOpen && (
          <div className={styles.detailsBody}>
            {word.part_of_speech && <p className={styles.detailLine}>POS: {word.part_of_speech}</p>}
            {word.etymology       && <p className={styles.detailLine}>🌱 {word.etymology}</p>}
          </div>
        )}
      </div>
    </div>
  );
}