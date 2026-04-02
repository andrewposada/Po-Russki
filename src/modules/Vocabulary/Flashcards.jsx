// src/modules/Vocabulary/Flashcards.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate }                               from "react-router-dom";
import { useAuth }                                   from "../../AuthContext";
import { getFlashcardDeck, updateWordSrs }           from "../../storage";
import styles                                        from "./Flashcards.module.css";

// ── SRS call ──────────────────────────────────────────────────────────────
async function callSrsUpdate(quality, word) {
  const res = await fetch("/api/srs-update", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quality,
      interval_days: word.interval_days ?? 0,
      ease_factor:   word.ease_factor   ?? 2.5,
      review_count:  word.review_count  ?? 0,
    }),
  });
  if (!res.ok) throw new Error("SRS failed");
  return res.json();
}

// ── TTS call ──────────────────────────────────────────────────────────────
async function playAudio(text) {
  try {
    const res = await fetch("/api/tts", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const { audioContent } = await res.json();
    if (audioContent) new Audio("data:audio/mp3;base64," + audioContent).play();
  } catch { /* silent fail */ }
}

// ── Filter helpers ────────────────────────────────────────────────────────
const SESSION_CAP = 20;

function buildSessionDeck(allWords, filter) {
  const now = new Date();
  let pool;
  if (filter === "due") {
    pool = allWords.filter(w =>
      !w.is_mastered && (!w.next_review_at || new Date(w.next_review_at) <= now)
    );
  } else if (filter === "active") {
    pool = allWords.filter(w => !w.is_mastered);
  } else {
    // "all" — everything, no cap
    return [...allWords];
  }
  // Cap due and active at SESSION_CAP
  return pool.slice(0, SESSION_CAP);
}

function filterLabel(filter, allWords) {
  const now = new Date();
  const dueCount    = allWords.filter(w =>
    !w.is_mastered && (!w.next_review_at || new Date(w.next_review_at) <= now)
  ).length;
  const activeCount = allWords.filter(w => !w.is_mastered).length;
  const allCount    = allWords.length;
  return {
    due:    `Due now · ${Math.min(dueCount,    SESSION_CAP)}`,
    active: `All active · ${Math.min(activeCount, SESSION_CAP)}`,
    all:    `Everything · ${allCount}`,
  }[filter];
}

// ── Component ─────────────────────────────────────────────────────────────
export default function Flashcards() {
  const { user }    = useAuth();
  const navigate    = useNavigate();

  const [allWords,  setAllWords]  = useState([]);
  const [filter,    setFilter]    = useState("due");   // "due" | "active" | "all"
  const [deck,      setDeck]      = useState([]);
  const [idx,       setIdx]       = useState(0);
  const [revealed,  setRevealed]  = useState(false);
  const [direction, setDirection] = useState("ru_en"); // "ru_en" | "en_ru"
  const [done,      setDone]      = useState({});      // wordId → true, tracks rated cards
  const [loading,   setLoading]   = useState(true);
  const [complete,  setComplete]  = useState(false);

  // Load full word bank once
  useEffect(() => {
    (async () => {
      try {
        const d = await getFlashcardDeck(user.uid);
        setAllWords(d ?? []);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    })();
  }, [user.uid]);

  // Rebuild deck when filter or allWords changes
  useEffect(() => {
    const newDeck = buildSessionDeck(allWords, filter);
    setDeck(newDeck);
    setIdx(0);
    setRevealed(false);
    setComplete(false);
    setDone({});
  }, [filter, allWords]);

  const card = deck[idx] ?? null;

  const handleFlip = useCallback(() => {
    if (window.getSelection().toString().length > 0) return;
    setRevealed(r => !r);
  }, []);

  const handleAdvance = () => {
    setDone(prev => ({ ...prev, [card.id]: true }));
    const next = idx + 1;
    if (next >= deck.length) {
      setComplete(true);
    } else {
      setIdx(next);
      setRevealed(false);
    }
  };

  const handleDidntKnow = async () => {
    if (!card) return;
    try {
      await updateWordSrs(user.uid, card.id, {
        next_review_at: new Date().toISOString(),
      });
    } catch { /* silent fail */ }
    handleAdvance();
  };

  const handleNext = useCallback(() => {
    if (idx < deck.length - 1) { setIdx(i => i + 1); setRevealed(false); }
  }, [idx, deck.length]);

  const handlePrev = useCallback(() => {
    if (idx > 0) { setIdx(i => i - 1); setRevealed(false); }
  }, [idx]);

  const handleRestart = () => {
    const newDeck = buildSessionDeck(allWords, filter);
    setDeck(newDeck);
    setIdx(0);
    setRevealed(false);
    setComplete(false);
    setDone({});
  };

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (complete) return;
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); handleFlip(); }
      else if (e.key === "ArrowRight") handleNext();
      else if (e.key === "ArrowLeft")  handlePrev();
      else if (e.key === "1" && revealed) handleRate(RATINGS[0].quality);
      else if (e.key === "2" && revealed) handleRate(RATINGS[1].quality);
      else if (e.key === "3" && revealed) handleRate(RATINGS[2].quality);
      else if (e.key === "4" && revealed) handleRate(RATINGS[3].quality);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleFlip, handleNext, handlePrev, revealed, complete]);

  // ── Derived display values ────────────────────────────────────────────────
  const frontIsRu  = direction === "ru_en";
  const frontText  = card ? (frontIsRu ? card.word        : card.translation) : "";
  const backText   = card ? (frontIsRu ? card.translation : card.word)        : "";
  const progress   = deck.length > 0 ? ((idx + 1) / deck.length) * 100 : 0;

  // ── Empty state ───────────────────────────────────────────────────────────
  if (loading) return (
    <div className={styles.center}><p className={styles.emptyText}>Loading…</p></div>
  );

  if (allWords.length === 0) return (
    <div className={styles.center}>
      <p className={styles.emptyText}>Your word bank is empty. Add some words first.</p>
      <button className={styles.navBackBtn} onClick={() => navigate("/vocabulary")}>← Back</button>
    </div>
  );

  if (deck.length === 0 && !complete) return (
    <div className={styles.center}>
      <p className={styles.emptyText}>
        {filter === "due"
          ? "No words due right now — all caught up!"
          : "No words in this filter."}
      </p>
      <button className={styles.filterSwitchBtn} onClick={() => setFilter("active")}>
        See all active words
      </button>
      <button className={styles.navBackBtn} onClick={() => navigate("/vocabulary")}>← Back</button>
    </div>
  );

  // ── Session complete ──────────────────────────────────────────────────────
  if (complete) return (
    <div className={styles.completePage}>
      <div className={styles.completeCard}>
        <div className={styles.completeCheck}>✓</div>
        <h2 className={styles.completeTitle}>Session complete</h2>
        <p className={styles.completeSub}>
          {deck.length} card{deck.length !== 1 ? "s" : ""} reviewed.
          Your SRS schedule has been updated.
        </p>
        <button className={styles.completeBtn} onClick={handleRestart}>
          Another session →
        </button>
        <button className={styles.navBackBtn} onClick={() => navigate("/vocabulary")}>
          Back to Vocabulary
        </button>
      </div>
    </div>
  );

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* Top bar */}
      <div className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <button className={styles.backLink} onClick={() => navigate("/vocabulary")}>
            ← Vocabulary
          </button>
          <span className={styles.topBarSep}>|</span>
          <span className={styles.topBarTitle}>Flashcards</span>
        </div>
        <div className={styles.topBarRight}>
          <div className={styles.filterPills}>
            {["due", "active", "all"].map(f => (
              <button
                key={f}
                className={`${styles.filterPill} ${filter === f ? styles.filterPillActive : ""}`}
                onClick={() => setFilter(f)}
              >
                {filterLabel(f, allWords)}
              </button>
            ))}
          </div>
          <div className={styles.topBarDivider} />
          <button
            className={styles.dirToggle}
            onClick={() => { setDirection(d => d === "ru_en" ? "en_ru" : "ru_en"); setRevealed(false); }}
          >
            {direction === "ru_en" ? "RU → EN" : "EN → RU"}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className={styles.progressWrap}>
        <div className={styles.progressMeta}>
          <span className={styles.progressLabel}>Session progress</span>
          <span className={styles.progressCount}>{idx + 1} of {deck.length}</span>
        </div>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Card area */}
      <div className={styles.cardArea}>

        {/* Flashcard */}
        <div className={styles.flashCard} onClick={handleFlip}>

          {/* Audio button — top right, always visible */}
          <button
            className={styles.audioBtn}
            onClick={e => { e.stopPropagation(); playAudio(card.word); }}
            title="Listen"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <polygon points="2,1 10,6 2,11" />
            </svg>
          </button>

          {/* FRONT */}
          {!revealed && (
            <div className={styles.cardFront}>
              {card.part_of_speech && (
                <span className={styles.posBadge}>{card.part_of_speech}</span>
              )}
              <div className={`${styles.frontWord} ${frontIsRu ? styles.ruText : ""}`}>
                {frontText}
              </div>
              <div className={styles.tapHint}>tap to reveal</div>
            </div>
          )}

          {/* BACK */}
          {revealed && (
            <div className={styles.cardBack}>
              {card.part_of_speech && (
                <span className={styles.posBadge}>{card.part_of_speech}</span>
              )}
              <div className={`${styles.backWord} ${!frontIsRu ? styles.ruText : ""}`}>
                {backText}
              </div>
              {card.pronunciation && (
                <div className={styles.pronunciationRow}>
                  <span className={styles.pronunciation}>{card.pronunciation}</span>
                </div>
              )}
              <div className={styles.cardDivider} />
              {card.etymology && (
                <p className={styles.etymology}>🌱 {card.etymology}</p>
              )}
              {card.usage_example && (
                <p className={styles.usageExample}>💬 {card.usage_example}</p>
              )}
              <div className={styles.tapBackHint}>tap to flip back</div>
            </div>
          )}
        </div>

        {/* SRS rating buttons — locked until revealed */}
        <div className={`${styles.ratingsRow} ${revealed ? styles.ratingsVisible : styles.ratingsHidden}`}>
          <button
            className={styles.didntKnowBtn}
            onClick={handleDidntKnow}
            disabled={!revealed}
          >
            Didn't know it
          </button>
          <button
            className={styles.knewItBtn}
            onClick={handleAdvance}
            disabled={!revealed}
          >
            Knew it ✓
          </button>
        </div>

        {/* Navigation row */}
        <div className={styles.navRow}>
          <button
            className={styles.navArrow}
            onClick={handlePrev}
            disabled={idx === 0}
            title="Previous (←)"
          >
            ←
          </button>
          <div className={styles.dotStrip}>
            {deck.slice(0, 9).map((w, i) => (
              <div
                key={w.id}
                className={`${styles.dot}
                  ${i === idx    ? styles.dotCurrent : ""}
                  ${done[w.id]   ? styles.dotDone    : ""}
                `}
              />
            ))}
            {deck.length > 9 && <span className={styles.dotOverflow}>…</span>}
          </div>
          <button
            className={styles.navArrow}
            onClick={handleNext}
            disabled={idx === deck.length - 1}
            title="Next (→)"
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}