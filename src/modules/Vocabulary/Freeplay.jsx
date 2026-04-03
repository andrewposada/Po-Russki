// src/modules/Vocabulary/Freeplay.jsx
import { useState, useMemo, useCallback, useRef } from "react";
import { useNavigate }    from "react-router-dom";
import { useWordBank }    from "../../context/WordBankContext";
import styles             from "./Freeplay.module.css";

// ── Exercise cards (reuse existing ones) ──────────────────────────────────
import MultipleChoiceCard from "./Cards/MultipleChoiceCard";
import MatchingCard       from "./Cards/MatchingCard";
import TranslateCard      from "./Cards/TranslateCard";
import ClozeCard          from "./Cards/ClozeCard";
import SentenceCard       from "./Cards/SentenceCard";

// ── Constants ─────────────────────────────────────────────────────────────
const TIER_LABELS = ["New", "T1", "T2", "T3", "T4", "T5", "Mastered"];

// Exercise types grouped for the configurator
const EX_GROUPS = [
  {
    key: "recognition",
    label: "Recognition",
    exercises: [
      { key: "matching",  label: "Matching",        maxTier: 0 },
      { key: "mc",        label: "Multiple choice",  maxTier: 1 },
    ],
  },
  {
    key: "recall",
    label: "Recall",
    exercises: [
      { key: "translate", label: "Translate RU→EN",  maxTier: 2 },
      { key: "cloze",     label: "Cloze",            maxTier: 3 },
    ],
  },
  {
    key: "production",
    label: "Production",
    exercises: [
      { key: "translate_active", label: "Translate EN→RU", maxTier: 4 },
      { key: "sentence",         label: "Sentence builder", maxTier: 5 },
    ],
  },
];

const ALL_EX_KEYS = EX_GROUPS.flatMap(g => g.exercises.map(e => e.key));

// Default: Matching + MC + Translate RU→EN active
const DEFAULT_EXERCISES = new Set(["matching", "mc", "translate"]);
const DEFAULT_TIERS      = new Set(["all"]);  // "all" means no tier filter

// ── Weighted pool builder ─────────────────────────────────────────────────
// Weight = (6 - tier) * 2 + (100 - proficiency) / 10
// Mastered words get flat weight 1 when included
function buildWeightedPool(words, includeMastered, tierFilter) {
  let pool = words.filter(w => {
    if (w.is_mastered && !includeMastered) return false;
    if (!tierFilter.has("all")) {
      const tierKey = w.is_mastered ? "mastered" : `t${w.tier ?? 0}`;
      const tierIdx = w.is_mastered ? 6 : (w.tier ?? 0);
      const label   = w.is_mastered ? "Mastered" : TIER_LABELS[tierIdx];
      const chipKey = w.is_mastered ? "mastered" : (tierIdx === 0 ? "new" : `t${tierIdx}`);
      if (!tierFilter.has(chipKey)) return false;
    }
    return true;
  });

  // Build weighted array — higher weight = more likely to be picked
  const weighted = [];
  for (const w of pool) {
    const tier   = w.is_mastered ? 6 : (w.tier ?? 0);
    const prof   = w.proficiency ?? 0;
    const weight = w.is_mastered
      ? 1
      : Math.max(1, Math.round((6 - tier) * 2 + (100 - prof) / 10));
    for (let i = 0; i < weight; i++) weighted.push(w);
  }
  return weighted;
}

// Pick a random word from weighted pool
function pickWord(pool) {
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Pick an exercise type: random from enabled set, constrained to word's tier or below
function pickExercise(word, enabledExercises) {
  const wordTier = word.is_mastered ? 5 : (word.tier ?? 0);
  // Filter enabled exercises to those at or below word's tier
  const eligible = ALL_EX_KEYS.filter(k => {
    if (!enabledExercises.has(k)) return false;
    const meta = EX_GROUPS.flatMap(g => g.exercises).find(e => e.key === k);
    return meta && meta.maxTier <= wordTier;
  });
  // If nothing eligible (e.g. word is tier 0 but only production enabled),
  // fall back to matching which is always appropriate
  const pool = eligible.length ? eligible : ["matching"];
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── Configurator component ─────────────────────────────────────────────────
function Configurator({ config, onChange, compact = false }) {
  const { includeMastered, enabledExercises, tierFilter } = config;

  function toggleExercise(key) {
    const next = new Set(enabledExercises);
    if (next.has(key) && next.size === 1) return; // must keep at least one
    next.has(key) ? next.delete(key) : next.add(key);
    onChange({ ...config, enabledExercises: next });
  }

  function toggleGroup(groupExKeys) {
    const allOn = groupExKeys.every(k => enabledExercises.has(k));
    const next  = new Set(enabledExercises);
    if (allOn) {
      // Only turn off if it won't leave zero selected
      const remaining = [...next].filter(k => !groupExKeys.includes(k));
      if (remaining.length === 0) return;
      groupExKeys.forEach(k => next.delete(k));
    } else {
      groupExKeys.forEach(k => next.add(k));
    }
    onChange({ ...config, enabledExercises: next });
  }

  function toggleTierChip(chip) {
    if (chip === "all") {
      onChange({ ...config, tierFilter: new Set(["all"]) });
      return;
    }
    const next = new Set(tierFilter);
    next.delete("all");
    next.has(chip) ? next.delete(chip) : next.add(chip);
    if (next.size === 0) next.add("all");
    onChange({ ...config, tierFilter: next });
  }

  const pillClass = (key, color) => {
    const base = styles.pill;
    if (!enabledExercises.has(key)) return base;
    if (color === "orange") return `${base} ${styles.pillActiveOrange}`;
    if (color === "blue")   return `${base} ${styles.pillActiveBlue}`;
    return `${base} ${styles.pillActiveGreen}`;
  };

  const GROUP_COLORS = { recognition: "orange", recall: "blue", production: "green" };

  const tierChips = [
    { key: "all",      label: "All tiers", cls: styles.chipAll  },
    { key: "new",      label: "New",       cls: styles.chipNew  },
    { key: "t1",       label: "T1",        cls: styles.chipT1   },
    { key: "t2",       label: "T2",        cls: styles.chipT2   },
    { key: "t3",       label: "T3",        cls: styles.chipT3   },
    { key: "t4",       label: "T4",        cls: styles.chipT4   },
    { key: "t5",       label: "T5",        cls: styles.chipT5   },
    { key: "mastered", label: "Mastered",  cls: styles.chipTM   },
  ];

  return (
    <div>
      {/* Mastered toggle — hide in compact mode */}
      {!compact && (
        <div className={styles.configCard}>
          <div className={styles.configLabel}>Include mastered words</div>
          <div className={styles.toggleRow}>
            <div>
              <div className={styles.toggleDesc}>Mastered words</div>
              <div className={styles.toggleSub}>Occasional overlearning reinforces long-term retention</div>
            </div>
            <button
              className={`${styles.toggle} ${includeMastered ? "" : styles.toggleOff}`}
              onClick={() => onChange({ ...config, includeMastered: !includeMastered })}
            />
          </div>
        </div>
      )}

      {/* Exercise types */}
      <div className={styles.configCard}>
        <div className={styles.configLabel}>Exercise types</div>
        {EX_GROUPS.map((group, gi) => (
          <div key={group.key}>
            {gi > 0 && <div className={styles.divider} />}
            <div className={styles.groupRow}>
              <div className={styles.groupHeader}>
                <div className={styles.groupName}>{group.label}</div>
                <button
                  className={styles.groupBtn}
                  onClick={() => toggleGroup(group.exercises.map(e => e.key))}
                >
                  {group.exercises.every(e => enabledExercises.has(e.key)) ? "deselect all" : "select all"}
                </button>
              </div>
              <div className={styles.pillRow}>
                {group.exercises.map(ex => (
                  <div
                    key={ex.key}
                    className={pillClass(ex.key, GROUP_COLORS[group.key])}
                    onClick={() => toggleExercise(ex.key)}
                  >
                    {ex.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tier focus */}
      <div className={styles.configCard}>
        <div className={styles.configLabel}>Tier focus</div>
        <div className={styles.chipRow}>
          {tierChips.map(({ key, label, cls }) => (
            <div
              key={key}
              className={`${styles.chip} ${tierFilter.has(key) ? cls : ""}`}
              onClick={() => toggleTierChip(key)}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Freeplay component ───────────────────────────────────────────────
export default function Freeplay() {
  const navigate         = useNavigate();
  const { words }        = useWordBank();

  // ── Session state ────────────────────────────────────────────────────────
  const [phase, setPhase]     = useState("config"); // "config" | "drill" | "summary"
  const [showConfig, setShowConfig] = useState(false); // mid-session config bar

  // ── Configurator state ───────────────────────────────────────────────────
  const [config, setConfig] = useState({
    includeMastered:  true,
    enabledExercises: new Set(DEFAULT_EXERCISES),
    tierFilter:       new Set(DEFAULT_TIERS),
  });

  // ── Drill state ──────────────────────────────────────────────────────────
  const [currentWord,     setCurrentWord]     = useState(null);
  const [currentExercise, setCurrentExercise] = useState(null);
  const [matchingWords,   setMatchingWords]   = useState([]);
  const [cardKey,         setCardKey]         = useState(0);
  const [answered,        setAnswered]        = useState(0);
  const [correct,         setCorrect]         = useState(0);
  const [streak,          setStreak]          = useState(0);
  const [bestStreak,      setBestStreak]       = useState(0);
  const [waiting,         setWaiting]         = useState(false); // between answer and next

  // ── Weighted pool (rebuilt when config or words change) ──────────────────
  const pool = useMemo(
    () => buildWeightedPool(words ?? [], config.includeMastered, config.tierFilter),
    [words, config.includeMastered, config.tierFilter]
  );

  // ── Advance to next word ─────────────────────────────────────────────────
  const nextWord = useCallback(() => {
    const word = pickWord(pool);
    if (!word) return;
    const exercise = pickExercise(word, config.enabledExercises);

    if (exercise === "matching") {
      // Pick 4 unique words from the unique word set (dedupe pool first)
      const uniqueWords = [...new Map(pool.map(w => [w.id, w])).values()];
      const shuffled = [...uniqueWords].sort(() => Math.random() - 0.5);
      setMatchingWords(shuffled.slice(0, 4));
    }

    setCurrentWord(word);
    setCurrentExercise(exercise);
    setCardKey(k => k + 1);
    setWaiting(false);
  }, [pool, config.enabledExercises]);

  // ── Start session ────────────────────────────────────────────────────────
  function startSession() {
    setAnswered(0);
    setCorrect(0);
    setStreak(0);
    setBestStreak(0);
    setPhase("drill");
    setShowConfig(false);
    // Pick first word after state is set
    setTimeout(() => nextWord(), 0);
  }

  // ── Handle answer ────────────────────────────────────────────────────────
  function handleAnswer(isCorrect) {
    setAnswered(a => a + 1);
    if (isCorrect) {
      setCorrect(c => {
        const next = c + 1;
        return next;
      });
      setStreak(s => {
        const next = s + 1;
        setBestStreak(b => Math.max(b, next));
        return next;
      });
    } else {
      setStreak(0);
    }
    setWaiting(true);
  }

  // ── Stop session ─────────────────────────────────────────────────────────
  function stopSession() {
    setPhase("summary");
  }

  const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0;

  // ── Render: CONFIG ───────────────────────────────────────────────────────
  if (phase === "config") {
    return (
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <h1 className={styles.title}>Freeplay</h1>
          <p className={styles.subtitle}>Practice any time — no SRS scheduling affected</p>
        </div>

        <Configurator config={config} onChange={setConfig} />

        <button className={styles.startBtn} onClick={startSession} disabled={pool.length === 0}>
          {pool.length === 0 ? "No words match your filters" : "Start session"}
        </button>
      </div>
    );
  }

  // ── Render: DRILL ────────────────────────────────────────────────────────
  if (phase === "drill") {
    return (
      <div className={styles.page}>

        {/* Header */}
        <div className={styles.drillHeader}>
          <div className={styles.accuracyBadge}>
            <strong>{correct}</strong> / {answered} &nbsp;·&nbsp; <strong>{accuracy}%</strong>
          </div>
          <div className={styles.drillActions}>
            <button className={styles.gearBtn} onClick={() => setShowConfig(s => !s)} title="Adjust session">
              ⚙
            </button>
            <button className={styles.stopBtn} onClick={stopSession}>Stop</button>
          </div>
        </div>

        {/* Mid-session config bar */}
        {showConfig && (
          <div className={styles.configBar}>
            <Configurator config={config} onChange={setConfig} compact={true} />
          </div>
        )}

        {/* Exercise card */}
        {currentWord && currentExercise === "mc" && (
          <MultipleChoiceCard
            key={cardKey}
            word={currentWord}
            allWords={words}
            onAnswer={handleAnswer}
            onNext={nextWord}
            waiting={waiting}
          />
        )}
        {currentWord && currentExercise === "matching" && (
          <MatchingCard
            key={cardKey}
            words={matchingWords}
            onAnswer={handleAnswer}
            onNext={nextWord}
          />
        )}
        {currentWord && currentExercise === "translate" && (
          <TranslateCard
            key={cardKey}
            word={currentWord}
            onAnswer={handleAnswer}
            onNext={nextWord}
            waiting={waiting}
          />
        )}
        {currentWord && currentExercise === "cloze" && (
          <ClozeCard
            key={cardKey}
            word={currentWord}
            onAnswer={handleAnswer}
            onNext={nextWord}
            waiting={waiting}
          />
        )}
        {(currentWord && (currentExercise === "translate_active" || currentExercise === "sentence")) && (
          <SentenceCard
            key={cardKey}
            word={currentWord}
            onAnswer={handleAnswer}
            onNext={nextWord}
            waiting={waiting}
          />
        )}

      </div>
    );
  }

  // ── Render: SUMMARY ──────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <div className={styles.summaryHeader}>
        <div className={styles.summaryTitle}>Session complete</div>
        <div className={styles.summarySub}>No SRS changes — this was freeplay</div>
      </div>

      <div className={styles.statGrid}>
        <div className={styles.statBox}>
          <div className={styles.statVal}>{answered}</div>
          <div className={styles.statLbl}>Answered</div>
        </div>
        <div className={styles.statBox}>
          <div className={styles.statVal}>{accuracy}%</div>
          <div className={styles.statLbl}>Accuracy</div>
        </div>
        <div className={styles.statBox}>
          <div className={styles.statVal}>{bestStreak}</div>
          <div className={styles.statLbl}>Best streak</div>
        </div>
      </div>

      <div className={styles.summaryBtns}>
        <button className={styles.playAgainBtn} onClick={() => setPhase("config")}>Play again</button>
        <button className={styles.backBtn} onClick={() => navigate("/vocabulary")}>Back to vocabulary</button>
      </div>
    </div>
  );
}