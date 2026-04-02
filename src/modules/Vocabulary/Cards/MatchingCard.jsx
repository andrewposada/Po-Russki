// src/modules/Vocabulary/cards/MatchingCard.jsx
// Tier 0 — tap-based word matching. 4 Russian words × 4 English words.
// Pads to 4 pairs using mastered words when fewer than 4 due words exist.
// Auto-advances when all 4 pairs are matched.

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

export default function MatchingCard({ words, onComplete }) {
  const pairs = words.slice(0, 4).map(w => ({
    id:      w.id,
    russian: w.word,
    english: w.translation,
  }));

  const [ruSelected,  setRuSelected]  = useState(null);
  const [enSelected,  setEnSelected]  = useState(null);
  const [matched,     setMatched]     = useState([]);
  const [wrongFlash,  setWrongFlash]  = useState([]);
  const [englishList, setEnglishList] = useState([]);

  useEffect(() => {
    setEnglishList(shuffle(pairs.map(p => ({ id: p.id, english: p.english }))));
    setRuSelected(null);
    setEnSelected(null);
    setMatched([]);
    setWrongFlash([]);
  }, [words]);

  useEffect(() => {
    if (ruSelected !== null && enSelected !== null) {
      if (ruSelected === enSelected) {
        const newMatched = [...matched, ruSelected];
        setMatched(newMatched);
        setRuSelected(null);
        setEnSelected(null);
        if (newMatched.length === pairs.length) {
          setTimeout(() => onComplete(), 600);
        }
      } else {
        setWrongFlash([ruSelected, enSelected]);
        setTimeout(() => {
          setWrongFlash([]);
          setRuSelected(null);
          setEnSelected(null);
        }, 500);
      }
    }
  }, [ruSelected, enSelected]);

  const ruClass = (id) => {
    if (matched.includes(id))    return `${styles.matchItem} ${styles.matched}`;
    if (wrongFlash.includes(id)) return `${styles.matchItem} ${styles.wrong}`;
    if (ruSelected === id)       return `${styles.matchItem} ${styles.selected}`;
    return styles.matchItem;
  };

  const enClass = (id) => {
    if (matched.includes(id))    return `${styles.matchItem} ${styles.matched}`;
    if (wrongFlash.includes(id)) return `${styles.matchItem} ${styles.wrong}`;
    if (enSelected === id)       return `${styles.matchItem} ${styles.selected}`;
    return styles.matchItem;
  };

  return (
    <div className={styles.card}>
      <div className={styles.tierBadge} style={{ background: "#E6F1FB", color: "#185FA5" }}>
        Tier 0
      </div>
      <p className={styles.taskLabel}>MATCH EACH WORD TO ITS TRANSLATION</p>
      <div className={styles.matchGrid}>
        {pairs.map((p, i) => (
          <>
            <button
              key={`ru-${p.id}`}
              className={ruClass(p.id)}
              disabled={matched.includes(p.id)}
              onClick={() => !matched.includes(p.id) && setRuSelected(p.id)}
            >
              <span className="ru">{p.russian}</span>
            </button>
            <button
              key={`en-${englishList[i]?.id}`}
              className={enClass(englishList[i]?.id)}
              disabled={!englishList[i] || matched.includes(englishList[i].id)}
              onClick={() => englishList[i] && !matched.includes(englishList[i].id) && setEnSelected(englishList[i].id)}
            >
              {englishList[i]?.english}
            </button>
          </>
        ))}
      </div>
    </div>
  );
}