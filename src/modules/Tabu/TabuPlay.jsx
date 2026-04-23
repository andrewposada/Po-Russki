// src/modules/Tabu/TabuPlay.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import styles from "./Tabu.module.css";

export default function TabuPlay({
  config,
  cefrLevel,
  currentTeam,
  scores,
  playedWordIds,
  onRoundComplete,
}) {
  const { roundMinutes, teamNames, filteredWords } = config;
  const totalSeconds = roundMinutes * 60;

  // ── Refs (stale-closure safe) ────────────────────────────────────────
  const timeLeftRef      = useRef(totalSeconds);
  const timerRef         = useRef(null);
  const localPlayedRef   = useRef(new Set()); // words played this round
  const correctRef       = useRef(0);
  const incorrectRef     = useRef(0);
  const nextCardRef      = useRef(null);   // pre-loaded { word, hints } or null
  const nextLoadingRef   = useRef(false);  // is a pre-load in flight?
  const roundActiveRef   = useRef(true);   // set false when timer fires

  // ── State (drives rendering) ─────────────────────────────────────────
  const [timeLeft,      setTimeLeft]      = useState(totalSeconds);
  const [currentCard,   setCurrentCard]   = useState(null);  // { word, hints }
  const [cardLoading,   setCardLoading]   = useState(true);
  const [showTranslate,   setShowTranslate]   = useState(false);
  const [hintTranslations, setHintTranslations] = useState([]);
  const [translating,      setTranslating]      = useState(false);
  const [nextIsLoading, setNextIsLoading] = useState(false);
  const [correct,       setCorrect]       = useState(0);
  const [incorrect,     setIncorrect]     = useState(0);
  const [roundCorrect,  setRoundCorrect]  = useState(0);

  // ── Pick next unplayed word ──────────────────────────────────────────
  const pickWord = useCallback(() => {
    const played = localPlayedRef.current;
    const globalPlayed = playedWordIds;
    const available = filteredWords.filter(
      w => !played.has(w.id) && !globalPlayed.has(w.id)
    );
    if (available.length === 0) return null;
    return available[Math.floor(Math.random() * available.length)];
  }, [filteredWords, playedWordIds]);

  // ── Fetch hints for a word ───────────────────────────────────────────
  const fetchHints = useCallback(async (word) => {
    try {
      const res = await fetch("/api/vocab-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode:    "tabu_hints",
          word:    word.word,
          word_en: word.translation ?? "",
          level:   cefrLevel,
        }),
      });
      const data = await res.json();
      return data.hints ?? [];
    } catch {
      return [];
    }
  }, [cefrLevel]);

  // ── Load a card (word + hints) and set as current ───────────────────
  const loadCard = useCallback(async (word) => {
    setCardLoading(true);
    setShowTranslate(false);
    const hints = await fetchHints(word);
    if (!roundActiveRef.current) return; // timer fired while fetching
    setCurrentCard({ word, hints });
    setCardLoading(false);
    // Mark as played
    localPlayedRef.current.add(word.id);
    // Start pre-loading next card
    preloadNext();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchHints]);

  // ── Pre-load next card in background ────────────────────────────────
  const preloadNext = useCallback(async () => {
    if (nextLoadingRef.current) return;
    const word = pickWord();
    if (!word) { nextCardRef.current = null; return; }
    nextLoadingRef.current = true;
    setNextIsLoading(true);
    // Temporarily mark as played to avoid duplicate pre-load
    localPlayedRef.current.add(word.id);
    const hints = await fetchHints(word);
    nextCardRef.current = { word, hints };
    nextLoadingRef.current = false;
    setNextIsLoading(false);
  }, [pickWord, fetchHints]);

  // ── Clear translations when card changes ─────────────────────────────
  useEffect(() => {
    setHintTranslations([]);
    setShowTranslate(false);
  }, [currentCard]);

  // ── Advance to next card ─────────────────────────────────────────────
  const advanceCard = useCallback(() => {
    if (!roundActiveRef.current) return;
    setShowTranslate(false);

    if (nextCardRef.current) {
      // Use pre-loaded card immediately
      const card = nextCardRef.current;
      nextCardRef.current = null;
      setCurrentCard(card);
      setCardLoading(false);
      // Start pre-loading the one after
      preloadNext();
    } else {
      // No pre-loaded card yet — pick and load fresh
      const word = pickWord();
      if (!word) {
        // Pool exhausted
        endRound();
        return;
      }
      loadCard(word);
    }
  }, [pickWord, preloadNext, loadCard]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── End round ────────────────────────────────────────────────────────
  const endRound = useCallback(() => {
    roundActiveRef.current = false;
    clearInterval(timerRef.current);
    onRoundComplete({
      correct:      correctRef.current,
      incorrect:    incorrectRef.current,
      newPlayedIds: localPlayedRef.current,
    });
  }, [onRoundComplete]);

  // ── Timer ─────────────────────────────────────────────────────────────
  useEffect(() => {
    roundActiveRef.current = true;
    timerRef.current = setInterval(() => {
      timeLeftRef.current -= 1;
      setTimeLeft(timeLeftRef.current);
      if (timeLeftRef.current <= 0) {
        endRound();
      }
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Initial card load ────────────────────────────────────────────────
  useEffect(() => {
    const word = pickWord();
    if (!word) { endRound(); return; }
    loadCard(word);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Translate toggle ─────────────────────────────────────────────────
  async function handleTranslateToggle() {
    if (showTranslate) {
      setShowTranslate(false);
      return;
    }
    setShowTranslate(true);
    if (!currentCard) return;
    // Already have translations for this card
    if (hintTranslations.length > 0) return;

    setTranslating(true);
    try {
      // Batch all hint words into one call: "1. слово 2. слово 3. слово ..."
      const batch = currentCard.hints
        .map((h, i) => `${i + 1}. ${h}`)
        .join(" ");
      const res  = await fetch("/api/translate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text: batch, isPhrase: true }),
      });
      const data = await res.json();
      // Split result back by number markers
      const raw = data.translation ?? "";
      const parts = raw
        .split(/\d+\.\s+/)
        .map(s => s.trim())
        .filter(Boolean);
      setHintTranslations(parts);
    } catch {
      setHintTranslations([]);
    } finally {
      setTranslating(false);
    }
  }

  // ── Answer handlers ──────────────────────────────────────────────────
  function handleCorrect() {
    correctRef.current += 1;
    setCorrect(correctRef.current);
    setRoundCorrect(correctRef.current);
    advanceCard();
  }

  function handleWrong() {
    incorrectRef.current += 1;
    setIncorrect(incorrectRef.current);
    advanceCard();
  }

  function handleSkip() {
    // Skip = point for the other team(s) — add 1 to all OTHER teams
    // We handle this by decrementing the current team's score by 1 (floor 0)
    // Actually simpler: skip just advances without counting for current team,
    // and the summary shows it as a penalty note.
    // Implementation: treat as incorrect for current team's round tally
    incorrectRef.current += 1;
    setIncorrect(incorrectRef.current);
    advanceCard();
  }

  // ── Derived display values ───────────────────────────────────────────
  const minutes = Math.floor(timeLeft / 60);
  const secs    = timeLeft % 60;
  const timeStr = `${minutes}:${secs.toString().padStart(2, "0")}`;
  const pct     = (timeLeft / totalSeconds) * 100;
  const isWarning = timeLeft <= 30;

  return (
    <div className={styles.page}>

      {/* Timer + progress bar */}
      <div className={styles.progressWrap}>
        <div className={styles.progressTop}>
          <span className={styles.progressTeam}>{teamNames[currentTeam]}</span>
          <span className={`${styles.progressTime} ${isWarning ? styles.progressTimeWarning : ""}`}>
            {timeStr}
          </span>
        </div>
        <div className={styles.progressTrack}>
          <div
            className={`${styles.progressFill} ${isWarning ? styles.progressFillWarning : ""}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Cumulative score strip */}
      <div className={styles.scoreStrip}>
        {config.teamNames.map((name, i) => (
          <div
            key={i}
            className={`${styles.scoreChip} ${i === currentTeam ? styles.scoreChipActive : ""}`}
          >
            <div className={styles.scoreChipName}>{name}</div>
            <div className={styles.scoreChipVal}>
              {i === currentTeam
                ? (scores[i] ?? 0) + roundCorrect
                : (scores[i] ?? 0)}
            </div>
          </div>
        ))}
      </div>

      {/* Taboo card */}
      {cardLoading ? (
        <div className={styles.tabuCard}>
          <div className={styles.tabuCardLoading}>Загрузка карточки…</div>
        </div>
      ) : currentCard ? (
        <div className={styles.tabuCard}>
          <div className={styles.tabuCardTop}>
            <div className={styles.tabuMainWord}>
              {currentCard.word.word.toUpperCase()}
            </div>
            {showTranslate && currentCard.word.translation && (
              <div className={styles.tabuMainWordEn}>
                {currentCard.word.translation}
              </div>
            )}
          </div>
          <div className={styles.tabuCardBody}>
            {currentCard.hints.map((hint, i) => (
              <div key={i} className={styles.tabuHintRow}>
                <span className={styles.tabuHintWord}>{hint.toUpperCase()}</span>
                {showTranslate && hintTranslations[i] && (
                  <span className={styles.tabuHintEn}>{hintTranslations[i]}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className={styles.tabuCard}>
          <div className={styles.tabuCardLoading}>Слова закончились!</div>
        </div>
      )}

      {/* Translate toggle */}
      <button
        className={`${styles.translateToggle} ${showTranslate ? styles.translateToggleActive : ""}`}
        onClick={handleTranslateToggle}
        disabled={translating}
      >
        {translating ? "Перевод…" : showTranslate ? "Скрыть перевод" : "Показать перевод"}
      </button>

      {/* Action buttons */}
      <div className={styles.actionBtns}>
        <button className={styles.btnCorrect} onClick={handleCorrect}>
          ✓ Угадали
        </button>
        <button className={styles.btnWrong} onClick={handleWrong}>
          ✕ Не угадали
        </button>
      </div>

      <button className={styles.btnSkip} onClick={handleSkip}>
        Пропустить (−1 очко) →
      </button>

      {nextIsLoading && (
        <p className={styles.nextLoading}>Подготовка следующей карточки…</p>
      )}
    </div>
  );
}