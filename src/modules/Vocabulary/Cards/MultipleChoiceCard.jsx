// src/modules/Vocabulary/cards/MultipleChoiceCard.jsx
// Tier 1 — show Russian word, pick correct English translation from 4 options.

import { useState, useEffect, useRef } from "react";
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
  word,                // word object
  distractors,         // string[] — 3 wrong options from api/vocab-generate.js
  displayTranslation,  // string — single picked definition to show as correct option
  loading,             // bool — true while fetching distractors
  onAnswer,            // (correct: bool) => void
  feedback,            // { correct, feedback } | null — set after answer
}) {
  const [options, setOptions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);

  const playAudio = async () => {
    if (playing) return;
    setPlaying(true);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: word.word }),
      });
      const data = await res.json();
      if (data.audioContent) {
        const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
        audioRef.current = audio;
        audio.onended = () => setPlaying(false);
        audio.play();
      } else {
        setPlaying(false);
      }
    } catch {
      setPlaying(false);
    }
  };

  const correctOption = displayTranslation ?? word.translation;

  useEffect(() => {
    if (distractors?.length) {
      setOptions(shuffle([correctOption, ...distractors]));
      setSelected(null);
    }
  }, [distractors, word.id]);

  const handleSelect = (opt) => {
    if (feedback) return; // already answered
    setSelected(opt);
    onAnswer(opt === correctOption);
  };

  const optClass = (opt) => {
    if (!feedback) return selected === opt ? `${styles.mcOption} ${styles.selected}` : styles.mcOption;
    if (opt === correctOption) return `${styles.mcOption} ${styles.correct}`;
    if (opt === selected)      return `${styles.mcOption} ${styles.wrong}`;
    return `${styles.mcOption} ${styles.dimmed}`;
  };

  return (
    <div className={styles.card} style={feedback ? { borderColor: feedback.correct ? "#639922" : "#A32D2D" } : {}}>
      <div className={styles.tierBadge} style={{ background: "#EAF3DE", color: "#3B6D11" }}>
        Tier 1
      </div>
      <p className={styles.taskLabel}>CHOOSE THE CORRECT TRANSLATION</p>
      <div className={styles.wordRow}>
        <p className={`${styles.wordRu} ru`} style={{ margin: 0 }}>{word.word}</p>
        <button className={styles.audioBtn} onClick={playAudio} disabled={playing} title="Play pronunciation">
          {playing ? "…" : "🔊"}
        </button>
      </div>
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