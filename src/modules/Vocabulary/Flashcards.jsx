// src/modules/Vocabulary/Flashcards.jsx
// Flashcard deck — full word bank, direction toggle, SRS rating buttons.

import { useState, useEffect } from "react";
import { useNavigate }          from "react-router-dom";
import { useAuth }              from "../../AuthContext";
import { getFlashcardDeck, updateWordSrs } from "../../storage";
import styles from "./Flashcards.module.css";

async function callSrsUpdate(quality, word) {
  const res = await fetch("/api/srs-update", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      quality,
      interval_days: word.interval_days ?? 0,
      ease_factor:   word.ease_factor   ?? 2.5,
      review_count:  word.review_count  ?? 0,
    }),
  });
  if (!res.ok) throw new Error("SRS failed");
  return res.json();
}

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

// SRS quality: Again=0, Hard=3, Good=5
const RATINGS = [
  { label: "Again", quality: 0, color: "#A32D2D", bg: "#fde8e8" },
  { label: "Hard",  quality: 3, color: "#854F0B", bg: "#FAEEDA" },
  { label: "Good",  quality: 5, color: "#185FA5", bg: "#E6F1FB" },
];

export default function Flashcards() {
  const { user }   = useAuth();
  const navigate   = useNavigate();

  const [deck,      setDeck]      = useState([]);
  const [idx,       setIdx]       = useState(0);
  const [revealed,  setRevealed]  = useState(false);
  const [direction, setDirection] = useState("ru_en"); // "ru_en" | "en_ru"
  const [loading,   setLoading]   = useState(true);
  const [complete,  setComplete]  = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const d = await getFlashcardDeck(user.uid);
        setDeck(d);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    })();
  }, [user.uid]);

  const card = deck[idx];

  const handleReveal = () => setRevealed(true);

  const handleRate = async (quality) => {
    if (!card) return;
    try {
      const newSrs = await callSrsUpdate(quality, card);
      await updateWordSrs(user.uid, card.id, newSrs);
    } catch { /* silent fail */ }

    const next = idx + 1;
    if (next >= deck.length) {
      setComplete(true);
    } else {
      setIdx(next);
      setRevealed(false);
    }
  };

  const handleRestart = () => {
    setIdx(0);
    setRevealed(false);
    setComplete(false);
  };

  if (loading) return <div className={styles.center}><p>Loading flashcards…</p></div>;

  if (deck.length === 0) return (
    <div className={styles.center}>
      <p>Your word bank is empty. Add some words first.</p>
      <button className={styles.backBtn} onClick={() => navigate("/vocabulary")}>← Back</button>
    </div>
  );

  if (complete) return (
    <div className={styles.center}>
      <div className={styles.doneCard}>
        <div className={styles.doneIcon}>🃏</div>
        <h2>Deck complete</h2>
        <p>{deck.length} cards reviewed</p>
        <button className={styles.restartBtn} onClick={handleRestart}>Review again</button>
        <button className={styles.backBtn} onClick={() => navigate("/vocabulary")}>Back to Vocabulary</button>
      </div>
    </div>
  );

  const frontText = direction === "ru_en" ? card.word : card.translation;
  const backText  = direction === "ru_en" ? card.translation : card.word;
  const frontIsRu = direction === "ru_en";

  return (
    <div className={styles.page}>

      {/* Top bar */}
      <div className={styles.topBar}>
        <button className={styles.backLink} onClick={() => navigate("/vocabulary")}>← Vocabulary</button>
        <span className={styles.counter}>{idx + 1} / {deck.length}</span>
        <button
          className={`${styles.dirToggle} ${direction === "en_ru" ? styles.dirActive : ""}`}
          onClick={() => { setDirection(d => d === "ru_en" ? "en_ru" : "ru_en"); setRevealed(false); }}
        >
          {direction === "ru_en" ? "RU → EN" : "EN → RU"}
        </button>
      </div>

      {/* Card */}
      <div className={styles.cardWrap} onClick={!revealed ? handleReveal : undefined}>
        <div className={styles.flashCard} style={{ cursor: revealed ? "default" : "pointer" }}>

          {/* Front */}
          <p className={`${styles.frontWord} ${frontIsRu ? "ru" : ""}`}>{frontText}</p>
          {card.part_of_speech && <p className={styles.pos}>{card.part_of_speech}</p>}

          {!revealed && (
            <p className={styles.tapHint}>Tap to reveal</p>
          )}

          {/* Back — revealed */}
          {revealed && (
            <div className={styles.backSection}>
              <div className={styles.divider} />
              <p className={`${styles.backWord} ${!frontIsRu ? "ru" : ""}`}>{backText}</p>
              {card.etymology && <p className={styles.etymology}>🌱 {card.etymology}</p>}
              {card.pronunciation && (
                <div className={styles.audioRow}>
                  <span className={styles.pronunciation}>{card.pronunciation}</span>
                  <button
                    className={styles.audioBtn}
                    onClick={e => { e.stopPropagation(); playAudio(card.word); }}
                    title="Listen"
                  >
                    ▶
                  </button>
                </div>
              )}

              {/* SRS rating buttons */}
              <div className={styles.ratings}>
                {RATINGS.map(r => (
                  <button
                    key={r.label}
                    className={styles.rateBtn}
                    style={{ background: r.bg, color: r.color }}
                    onClick={e => { e.stopPropagation(); handleRate(r.quality); }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}