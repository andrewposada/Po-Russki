// src/components/TranslationTooltip/TranslationTooltip.jsx
import { useAuth } from "../../AuthContext";
import { useTooltip } from "../../context/TooltipContext";
import { useWordBank } from "../../context/WordBankContext";
import styles from "./TranslationTooltip.module.css";

export default function TranslationTooltip() {
  const { user }                  = useAuth();
  const { tooltip, closeTooltip } = useTooltip();
  const { enrich }                = useWordBank();

  if (!tooltip) return null;

  const { x, y, word, displayWord, translation, contextNote, isPhrase, wordBankStatus } = tooltip;

  const handleAddToWordBank = async () => {
    if (!user || isPhrase) return;
    await enrich(user.uid, { word, translation });
    closeTooltip();
  };

  const handleAddToMastered = async () => {
    if (!user || isPhrase) return;
    await enrich(user.uid, { word, translation, isMastered: true });
    closeTooltip();
  };

  return (
    <>
      {/* Backdrop to close */}
      <div className={styles.backdrop} onClick={closeTooltip} />

      <div
        className={styles.tooltip}
        style={{ left: x, top: y - 12 }}
      >
        {/* Word display */}
        <div className={styles.wordRow}>
          <span className={`${styles.word} ru`}>{displayWord}</span>
          {word !== displayWord && (
            <span className={styles.lemma}>({word})</span>
          )}
        </div>

        {/* Translation */}
        <p className={styles.translation}>{translation}</p>

        {/* Context note */}
        {contextNote && (
          <p className={styles.contextNote}>{contextNote}</p>
        )}

        {/* Actions — single words only */}
        {!isPhrase && (
          <div className={styles.actions}>
            {wordBankStatus === "none" && (
              <>
                <button className={styles.actionBtn} onClick={handleAddToWordBank}>
                  + Word Bank
                </button>
                <button className={`${styles.actionBtn} ${styles.masteredBtn}`} onClick={handleAddToMastered}>
                  + Mastered
                </button>
              </>
            )}
            {wordBankStatus === "active" && (
              <>
                <span className={styles.savedTag}>In Word Bank</span>
                <button className={`${styles.actionBtn} ${styles.masteredBtn}`} onClick={handleAddToMastered}>
                  Mark Mastered
                </button>
              </>
            )}
            {wordBankStatus === "mastered" && (
              <span className={styles.savedTag}>Mastered ✓</span>
            )}
          </div>
        )}

        <button className={styles.closeBtn} onClick={closeTooltip} aria-label="Close">✕</button>
      </div>
    </>
  );
}