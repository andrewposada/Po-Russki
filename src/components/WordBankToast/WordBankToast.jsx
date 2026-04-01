// src/components/WordBankToast/WordBankToast.jsx
import { useWordBank } from "../../context/WordBankContext";
import styles from "./WordBankToast.module.css";

export default function WordBankToast() {
  const { enrichError, enrichPending, retryEnrich, dismissEnrichError } = useWordBank();

  if (!enrichError && !enrichPending) return null;

  return (
    <div className={styles.toast}>
      {enrichPending ? (
        <span className={styles.message}>Saving to word bank…</span>
      ) : (
        <>
          <span className={styles.message}>
            Couldn't save <span className="ru">{enrichError.word}</span> — try again?
          </span>
          <div className={styles.actions}>
            <button className={styles.retryBtn} onClick={retryEnrich}>Retry</button>
            <button className={styles.cancelBtn} onClick={dismissEnrichError}>Dismiss</button>
          </div>
        </>
      )}
    </div>
  );
}