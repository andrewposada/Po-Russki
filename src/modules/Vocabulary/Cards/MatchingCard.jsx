// src/modules/Vocabulary/cards/MatchingCard.jsx
// Tier 0 — tap-based word matching. 4 Russian words × 4 English words.
// Each pair is one answer. Wrong match = onAnswer(false) for that pair.
// All 4 pairs matched → shows success state → user taps Next.

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

export default function MatchingCard({ words, onAnswer, onNext }) {
  const speakWord = async (text) => {
  try {
    // Create and "unlock" audio in the synchronous click context
    const audio = new Audio();
    audio.play().catch(() => {}); // unlocks autoplay policy immediately
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const { audioContent } = await res.json();
    if (!audioContent) return;
    audio.pause();
    audio.src = `data:audio/mp3;base64,${audioContent}`;
    audio.play();
  } catch (e) { /* silent fail */ }
};
  const pairs = words.slice(0, 4).map(w => ({
    id:      w.id,
    russian: w.word,
    english: w.translation,
  }));

  const [ruSelected,  setRuSelected]  = useState(null);
  const [enSelected,  setEnSelected]  = useState(null);
  const [matched,     setMatched]     = useState([]);
  const [wrongFlashRu, setWrongFlashRu] = useState(null);
  const [wrongFlashEn, setWrongFlashEn] = useState(null);
  const [englishList, setEnglishList] = useState([]);
  const [allDone,     setAllDone]     = useState(false);
  // Track which pair IDs had at least one wrong attempt this card
  const [pairsWithError, setPairsWithError] = useState(new Set());

  useEffect(() => {
    setEnglishList(shuffle(pairs.map(p => ({ id: p.id, english: p.english }))));
    setRuSelected(null);
    setEnSelected(null);
    setMatched([]);
    setWrongFlashRu(null);
    setWrongFlashEn(null);
    setAllDone(false);
    setPairsWithError(new Set());
  }, [words]);

  useEffect(() => {
    if (ruSelected === null || enSelected === null) return;

    if (ruSelected === enSelected) {
      // Correct pair
      const wasWrong = pairsWithError.has(ruSelected);
      if (onAnswer) onAnswer(!wasWrong, ruSelected);

      const newMatched = [...matched, ruSelected];
      setMatched(newMatched);
      setRuSelected(null);
      setEnSelected(null);
      if (newMatched.length === pairs.length) {
        setAllDone(true);
      }
    } else {
      // Wrong tap — flash red and record error, but don't fire onAnswer yet
      setWrongFlashRu(ruSelected);
      setWrongFlashEn(enSelected);
      setPairsWithError(prev => new Set([...prev, ruSelected]));

      setTimeout(() => {
        setWrongFlashRu(null);
        setWrongFlashEn(null);
        setRuSelected(null);
        setEnSelected(null);
      }, 600);
    }
  }, [ruSelected, enSelected]);

  const ruClass = (id) => {
    if (matched.includes(id))  return `${styles.matchItem} ${styles.matched}`;
    if (wrongFlashRu === id)   return `${styles.matchItem} ${styles.wrong}`;
    if (ruSelected === id)     return `${styles.matchItem} ${styles.selected}`;
    return styles.matchItem;
  };

  const enClass = (id) => {
    if (matched.includes(id))  return `${styles.matchItem} ${styles.matched}`;
    if (wrongFlashEn === id)   return `${styles.matchItem} ${styles.wrong}`;
    if (enSelected === id)     return `${styles.matchItem} ${styles.selected}`;
    return styles.matchItem;
  };

  return (
    <div className={styles.card}>
      <div className={styles.tierBadge} style={{ background: "#E6F1FB", color: "#185FA5" }}>
        Tier 0 · Matching
      </div>
      <p className={styles.taskLabel}>MATCH EACH WORD TO ITS TRANSLATION</p>
      <div className={styles.matchGrid}>
        {pairs.map((p, i) => (
          <div key={p.id} style={{ display: "contents" }}>
            <button
              className={ruClass(p.id)}
              disabled={matched.includes(p.id) || allDone || wrongFlashRu !== null}
              onClick={() => setRuSelected(p.id)}
            >
              <span className="ru">{p.russian}</span>
            </button>
            <button
              className={enClass(englishList[i]?.id)}
              disabled={!englishList[i] || matched.includes(englishList[i].id) || allDone || wrongFlashRu !== null}
              onClick={() => englishList[i] && setEnSelected(englishList[i].id)}
            >
              {englishList[i]?.english}
            </button>
          </div>
        ))}
      </div>

      {allDone && (
        <div className={styles.matchSuccess}>
          <span className={styles.matchSuccessIcon}>✓</span>
          <span className={styles.matchSuccessText}>All matched!</span>
          <button className={styles.matchNextBtn} onClick={onNext}>Next →</button>
        </div>
      )}
    </div>
  );
}