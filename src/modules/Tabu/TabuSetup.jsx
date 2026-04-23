// src/modules/Tabu/TabuSetup.jsx
import { useState, useMemo } from "react";
import styles from "./Tabu.module.css";

const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1"];

export default function TabuSetup({ words, onStart, onBack }) {
  // ── Config state ─────────────────────────────────────────────────────
  const [roundMinutes, setRoundMinutes] = useState(3);
  const [teamCount,    setTeamCount]    = useState(2);

  // Word filters — defaults: all status, all POS, all CEFR
  const [statusFilter, setStatusFilter] = useState("all");    // "all" | "due" | "mastered"
  const [posFilter,    setPosFilter]    = useState("all");    // "all" | "noun" | "verb" | "adjective"
  const [cefrFilter,   setCefrFilter]   = useState("all");    // "all" | "A1" | "A2" ...

  // ── Filtered words ───────────────────────────────────────────────────
  const filteredWords = useMemo(() => {
    return (words ?? []).filter(w => {
      // Status filter
      if (statusFilter === "mastered" && !w.is_mastered) return false;
      if (statusFilter === "due") {
        const isDue = !w.next_review_at || new Date(w.next_review_at) <= new Date();
        if (!isDue) return false;
      }
      // POS filter
      if (posFilter !== "all") {
        const pos = (w.part_of_speech ?? "").toLowerCase();
        if (!pos.includes(posFilter)) return false;
      }
      // CEFR filter
      if (cefrFilter !== "all" && w.cefr_level !== cefrFilter) return false;
      return true;
    });
  }, [words, statusFilter, posFilter, cefrFilter]);

  const canStart = filteredWords.length >= 2;

  // ── Helpers ──────────────────────────────────────────────────────────
  function buildTeamNames(count) {
    return Array.from({ length: count }, (_, i) => `Команда ${i + 1}`);
  }

  function handleStart() {
    onStart({
      roundMinutes,
      teamCount,
      teamNames: buildTeamNames(teamCount),
      filteredWords,
    });
  }

  const StatusPill = ({ value, label }) => (
    <div
      className={`${styles.pill} ${statusFilter === value ? styles.pillActive : ""}`}
      onClick={() => setStatusFilter(value)}
    >
      {label}
    </div>
  );

  const PosPill = ({ value, label }) => (
    <div
      className={`${styles.pill} ${posFilter === value ? styles.pillActive : ""}`}
      onClick={() => setPosFilter(value)}
    >
      {label}
    </div>
  );

  const CefrPill = ({ value }) => (
    <div
      className={`${styles.pill} ${cefrFilter === value ? styles.pillActive : ""}`}
      onClick={() => setCefrFilter(value)}
    >
      {value}
    </div>
  );

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Табу</h1>
        <p className={styles.pageSub}>Настройки игры</p>
      </div>

      {/* Round length */}
      <div className={styles.setupSection}>
        <div className={styles.sectionLabel}>Время раунда</div>
        <div className={styles.stepper}>
          <button
            className={styles.stepBtn}
            onClick={() => setRoundMinutes(m => Math.max(1, m - 1))}
            disabled={roundMinutes <= 1}
          >−</button>
          <span className={styles.stepVal}>{roundMinutes}</span>
          <button
            className={styles.stepBtn}
            onClick={() => setRoundMinutes(m => Math.min(5, m + 1))}
            disabled={roundMinutes >= 5}
          >+</button>
          <span className={styles.stepUnit}>
            {roundMinutes === 1 ? "минута" : roundMinutes < 5 ? "минуты" : "минут"}
          </span>
        </div>
      </div>

      {/* Team count */}
      <div className={styles.setupSection}>
        <div className={styles.sectionLabel}>Количество команд</div>
        <div className={styles.stepper}>
          <button
            className={styles.stepBtn}
            onClick={() => setTeamCount(t => Math.max(2, t - 1))}
            disabled={teamCount <= 2}
          >−</button>
          <span className={styles.stepVal}>{teamCount}</span>
          <button
            className={styles.stepBtn}
            onClick={() => setTeamCount(t => Math.min(4, t + 1))}
            disabled={teamCount >= 4}
          >+</button>
          <span className={styles.stepUnit}>команды</span>
        </div>
      </div>

      {/* Word filters */}
      <div className={styles.setupSection}>
        <div className={styles.sectionLabel}>Слова для игры</div>

        <div className={styles.filterGroup}>
          <div className={styles.filterGroupHead}>Статус</div>
          <div className={styles.filterPills}>
            <StatusPill value="all"      label="Все слова" />
            <StatusPill value="due"      label="К повторению" />
            <StatusPill value="mastered" label="Освоенные" />
          </div>
        </div>

        <div className={styles.filterGroup}>
          <div className={styles.filterGroupHead}>Часть речи</div>
          <div className={styles.filterPills}>
            <PosPill value="all"       label="Все" />
            <PosPill value="noun"      label="Существ." />
            <PosPill value="verb"      label="Глаголы" />
            <PosPill value="adjective" label="Прилаг." />
          </div>
        </div>

        <div className={styles.filterGroup}>
          <div className={styles.filterGroupHead}>Уровень CEFR</div>
          <div className={styles.filterPills}>
            <div
              className={`${styles.pill} ${cefrFilter === "all" ? styles.pillActive : ""}`}
              onClick={() => setCefrFilter("all")}
            >Все</div>
            {CEFR_LEVELS.map(l => <CefrPill key={l} value={l} />)}
          </div>
        </div>
      </div>

      <p className={styles.wordCount}>
        {filteredWords.length === 0
          ? "Нет слов для выбранных фильтров"
          : `${filteredWords.length} слов доступно`}
      </p>

      <button
        className={styles.startBtn}
        onClick={handleStart}
        disabled={!canStart}
      >
        Начать игру
      </button>

      <button className={styles.backBtn} onClick={onBack} style={{ marginTop: 8 }}>
        ← Назад
      </button>
    </div>
  );
}