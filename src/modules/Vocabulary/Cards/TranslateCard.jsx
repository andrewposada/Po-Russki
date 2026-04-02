// src/modules/Vocabulary/cards/TranslateCard.jsx
// Tier 2 — type a translation. Direction prop controls RU→EN or EN→RU.

import { useState, useRef, useEffect } from "react";
import { useSettings }          from "../../../context/SettingsContext";
import { useRussianKeyboard }   from "../../../hooks/useRussianKeyboard";
import styles from "./Cards.module.css";

async function playAudio(text) {
  try {
    const res = await fetch("/api/tts", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ text }),
    });
    const { audioContent } = await res.json();
    if (audioContent) new Audio("data:audio/mp3;base64," + audioContent).play();
  } catch { /* silent fail */ }
}

export default function TranslateCard({
  word,       // word object
  direction,  // "ru_en" | "en_ru"
  onAnswer,   // (correct: bool, studentAnswer: string) => void
  feedback,   // { correct, feedback } | null
  grading,    // bool — true while grading via API
}) {
  const { translitOn } = useSettings();
  const inputRef = useRef(null);
  useRussianKeyboard(inputRef, direction === "en_ru" ? translitOn : false);

  const [value, setValue] = useState("");

  useEffect(() => {
    setValue("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [word]);

  const tierLabel  = direction === "ru_en" ? "Tier 2a" : "Tier 2b";
  const tierColors = { bg: "#FAEEDA", text: "#854F0B" };

  const handleSubmit = () => {
    if (!value.trim() || feedback || grading) return;
    onAnswer(value.trim());
  };

  const handleKey = (e) => {
    if (e.key === "Enter") handleSubmit();
  };

  return (
    <div className={styles.card} style={feedback ? { borderColor: feedback.correct ? "#639922" : "#A32D2D" } : {}}>
      <div className={styles.tierBadge} style={{ background: tierColors.bg, color: tierColors.text }}>
        {tierLabel}
      </div>

      <p className={styles.taskLabel}>
        {direction === "ru_en" ? "TRANSLATE INTO ENGLISH" : "TRANSLATE INTO RUSSIAN"}
      </p>

      {direction === "ru_en" ? (
        <div className={styles.wordRow}>
          <p className={`${styles.wordRu} ru`}>{word.word}</p>
          <button className={styles.audioBtn} onClick={() => playAudio(word.word)} title="Listen">
            ▶
          </button>
        </div>
      ) : (
        <p className={styles.wordEn}>{word.translation}</p>
      )}

      {word.part_of_speech && <p className={styles.posLabel}>{word.part_of_speech}</p>}

      <div className={styles.inputRow}>
        <input
          ref={inputRef}
          className={`${styles.textInput} ${direction === "en_ru" ? "ru" : ""}`}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKey}
          placeholder={direction === "ru_en" ? "English translation…" : "Ваш ответ…"}
          disabled={!!feedback || grading}
        />
        <button
          className={styles.submitBtn}
          onClick={handleSubmit}
          disabled={!value.trim() || !!feedback || grading}
        >
          {grading ? "…" : "Check"}
        </button>
      </div>

      {feedback && (
        <p className={styles.feedbackText} style={{ color: feedback.correct ? "#639922" : "#A32D2D" }}>
          {feedback.correct ? "✓ " : "✗ "}{feedback.feedback || (feedback.correct ? "Correct!" : `Answer: ${direction === "ru_en" ? word.translation : word.word}`)}
        </p>
      )}

      <WordDetailsPanel word={word} />
    </div>
  );
}

function WordDetailsPanel({ word }) {
  const [open, setOpen] = useState(false);
  if (!word.pronunciation && !word.etymology) return null;
  return (
    <div className={styles.detailsPanel}>
      <button className={styles.detailsToggle} onClick={() => setOpen(o => !o)}>
        word details {open ? "▲" : "▼"}
      </button>
      {open && (
        <div className={styles.detailsBody}>
          {word.pronunciation && <p className={styles.detailLine}>🔊 {word.pronunciation}</p>}
          {word.etymology      && <p className={styles.detailLine}>🌱 {word.etymology}</p>}
        </div>
      )}
    </div>
  );
}