// src/components/TranslationTooltip/TranslationTooltip.jsx
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../AuthContext";
import { useTooltip } from "../../context/TooltipContext";
import { useWordBank } from "../../context/WordBankContext";
import styles from "./TranslationTooltip.module.css";

export default function TranslationTooltip() {
  const { user }                  = useAuth();
  const { tooltip, closeTooltip } = useTooltip();
  const { enrich }                = useWordBank();

  const tooltipRef = useRef(null);
  const [pos, setPos] = useState({ left: 0, top: 0, below: false, triangleOffset: "50%" });

  useEffect(() => {
    if (!tooltipRef.current || !tooltip) return;

    const tt  = tooltipRef.current.getBoundingClientRect();
    const gap = 8;

    // tooltip.x / tooltip.y are the anchor center point
    const anchorCenterX = tooltip.x;
    const anchorY       = tooltip.y;

    // Default: centered above anchor point
    let left  = anchorCenterX - tt.width / 2;
    let top   = anchorY - tt.height - gap;
    let below = false;

    // Not enough room above? Flip below.
    if (top < 8) {
      top   = anchorY + gap;
      below = true;
    }

    // Nudge left/right to stay inside viewport
    const nudgedLeft = Math.max(8, Math.min(window.innerWidth - tt.width - 8, left));

    // Triangle offset: always points at anchor center even after nudge
    const triangleOffset  = anchorCenterX - nudgedLeft;
    const clampedTriangle = Math.max(12, Math.min(tt.width - 12, triangleOffset));

    setPos({
      left:           nudgedLeft,
      top:            top,
      below:          below,
      triangleOffset: `${clampedTriangle}px`,
    });
  }, [tooltip]);

  if (!tooltip) return null;

  const { word, displayWord, translation, contextNote, isPhrase, wordBankStatus } = tooltip;

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
        ref={tooltipRef}
        className={`${styles.tooltip} ${pos.below ? styles.tooltipBelow : ""}`}
        style={{
          position:          "fixed",
          left:              pos.left,
          top:               pos.top,
          "--triangle-offset": pos.triangleOffset,
        }}
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