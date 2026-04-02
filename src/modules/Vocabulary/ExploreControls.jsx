// src/modules/Vocabulary/ExploreControls.jsx
// Topic, POS type, and exercise mode pill selectors for Explore mode.

import { useState } from "react";
import {
  VOCAB_TOPICS,
  VOCAB_POS_TYPES,
  VOCAB_EXPLORE_MODES,
} from "../../constants";
import styles from "./ExploreControls.module.css";

export default function ExploreControls({ onStart, loading }) {
  const [topics,       setTopics]       = useState([]);
  const [posTypes,     setPosTypes]     = useState(["nouns", "adjectives", "verbs"]);
  const [exerciseMode, setExerciseMode] = useState("translate");

  const toggle = (arr, setArr, id) =>
    setArr(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleStart = () => {
    onStart({
      topics:       topics.length ? topics : VOCAB_TOPICS.map(t => t.id),
      posTypes,
      exerciseMode,
    });
  };

  return (
    <div className={styles.controls}>

      <section className={styles.section}>
        <p className={styles.sectionLabel}>TOPICS</p>
        <p className={styles.sectionHint}>Leave blank for any topic</p>
        <div className={styles.pills}>
          {VOCAB_TOPICS.map(t => (
            <button
              key={t.id}
              className={`${styles.pill} ${topics.includes(t.id) ? styles.active : ""}`}
              onClick={() => toggle(topics, setTopics, t.id)}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <p className={styles.sectionLabel}>WORD TYPES</p>
        <div className={styles.pills}>
          {VOCAB_POS_TYPES.map(t => (
            <button
              key={t.id}
              className={`${styles.pill} ${posTypes.includes(t.id) ? styles.active : ""}`}
              onClick={() => toggle(posTypes, setPosTypes, t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <p className={styles.sectionLabel}>EXERCISE TYPE</p>
        <div className={styles.pills}>
          {VOCAB_EXPLORE_MODES.map(m => (
            <button
              key={m.id}
              className={`${styles.pill} ${exerciseMode === m.id ? styles.active : ""}`}
              onClick={() => setExerciseMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </section>

      <button
        className={styles.startBtn}
        onClick={handleStart}
        disabled={loading || posTypes.length === 0}
      >
        {loading ? "Generating…" : "Start Exploring →"}
      </button>
    </div>
  );
}