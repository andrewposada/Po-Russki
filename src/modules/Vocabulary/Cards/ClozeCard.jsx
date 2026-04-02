// src/modules/Vocabulary/cards/ClozeCard.jsx
// Tier 2 — fill in the blank. AI-generated sentence with target word omitted.

import { useState, useRef, useEffect } from "react";
import { useSettings }        from "../../../context/SettingsContext";
import { useRussianKeyboard } from "../../../hooks/useRussianKeyboard";
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

export default function ClozeCard({
  word,          // word object
  clozeData,     // { sentence_before, sentence_after, answer, grammar_hint } from API
  loading,       // bool — true while generating cloze
  onAnswer,      // (studentAnswer: string) => void
  feedback,      // { correct, feedback } | null
  grading,       // bool
}) {
  const { translitOn } = useSettings();
  const inputRef = useRef(null);
  useRussianKeyboard(inputRef, translitOn);

  const [value, setValue] = useState("");
  const [hintOpen, setHintOpen] = useState(false);

  useEffect(() => {
    setValue("");
    setHintOpen(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [word]);

  const handleSubmit = () => {
    if (!value.trim() || feedback || grading) return;
    onAnswer(value.trim());
  };

  const fullSentence = clozeData
    ? `${clozeData.sentence_before} ${clozeData.answer} ${clozeData.sentence_after}`
    : "";

  return (
    <div className={styles.card} style={feedback ? { borderColor: feedback.correct ? "#639922" : "#A32D2D" } : {}}>
      <div className={styles.tierBadge} style={{ background: "#FAEEDA", color: "#854F0B" }}>
        Tier 2c
      </div>
      <p className={styles.taskLabel}>FILL IN THE BLANK</p>

      {loading ? (
        <p className={styles.loading}>Generating sentence…</p>
      ) : clozeData ? (
        <>
          <p className={`${styles.clozeSentence} ru`}>
            {clozeData.sentence_before}{" "}
            <span className={styles.clozeBlank}>___</span>
            {" "}{clozeData.sentence_after}
          </p>
          <p className={styles.clozeHint}>{word.translation}</p>

          <div className={styles.inputRow}>
            <input
              ref={inputRef}
              className={`${styles.textInput} ru`}
              value={value}
              onChange={e => setValue(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
              placeholder="Ваш ответ…"
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

          {/* Grammar hint — collapsed by default, shows form name only */}
          <div className={styles.detailsPanel}>
            <button className={styles.detailsToggle} onClick={() => setHintOpen(o => !o)}>
              grammar hint {hintOpen ? "▲" : "▼"}
            </button>
            {hintOpen && clozeData.grammar_hint && (
              <p className={styles.detailLine}>{clozeData.grammar_hint}</p>
            )}
          </div>

          {feedback && (
            <>
              <p className={styles.feedbackText} style={{ color: feedback.correct ? "#639922" : "#A32D2D" }}>
                {feedback.correct ? "✓ " : "✗ "}{feedback.feedback || (feedback.correct ? "Correct!" : `Answer: ${clozeData.answer}`)}
              </p>
              {!feedback.correct && (
                <button className={styles.audioBtn} onClick={() => playAudio(fullSentence)} title="Hear the sentence">
                  ▶ full sentence
                </button>
              )}
            </>
          )}
        </>
      ) : (
        <p className={styles.loading}>Loading…</p>
      )}
    </div>
  );
}