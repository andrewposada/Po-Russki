// src/modules/Vocabulary/VocabHome.jsx
// Entry screen — choose My Words, Explore, or Flashcards.

import { useNavigate } from "react-router-dom";
import { useAuth }     from "../../AuthContext";
import { useWordBank } from "../../context/WordBankContext";
import styles          from "./VocabHome.module.css";

export default function VocabHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { words } = useWordBank();

  const totalWords    = words?.length ?? 0;
  const masteredWords = words?.filter(w => w.is_mastered).length ?? 0;
  const dueCount      = words?.filter(w =>
    !w.next_review_at || new Date(w.next_review_at) <= new Date()
  ).length ?? 0;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Vocabulary</h1>
        <p className={styles.subtitle}>
          {totalWords} words · {masteredWords} mastered
        </p>
      </div>

      <div className={styles.cards}>

        {/* My Words */}
        <button className={styles.modeCard} onClick={() => navigate("/vocabulary/session")}>
          <div className={styles.modeIcon}>📖</div>
          <div className={styles.modeBody}>
            <div className={styles.modeTitle}>My Words</div>
            <div className={styles.modeDesc}>
              SRS-driven review of your personal word bank
            </div>
            {dueCount > 0 ? (
              <div className={styles.dueBadge}>{dueCount} due</div>
            ) : (
              <div className={styles.noDue}>Nothing due right now</div>
            )}
          </div>
          <div className={styles.arrow}>›</div>
        </button>

        {/* Explore */}
        <button className={styles.modeCard} onClick={() => navigate("/vocabulary/explore")}>
          <div className={styles.modeIcon}>🔍</div>
          <div className={styles.modeBody}>
            <div className={styles.modeTitle}>Explore</div>
            <div className={styles.modeDesc}>
              AI-generated exercises by topic — no SRS
            </div>
          </div>
          <div className={styles.arrow}>›</div>
        </button>

        {/* Flashcards */}
        <button
          className={styles.modeCard}
          onClick={() => navigate("/vocabulary/flashcards")}
          disabled={totalWords === 0}
        >
          <div className={styles.modeIcon}>🃏</div>
          <div className={styles.modeBody}>
            <div className={styles.modeTitle}>Flashcards</div>
            <div className={styles.modeDesc}>
              Flip through your full word bank
            </div>
            {totalWords === 0 && (
              <div className={styles.noDue}>Add words to your bank first</div>
            )}
          </div>
          <div className={styles.arrow}>›</div>
        </button>

      </div>
    </div>
  );
}