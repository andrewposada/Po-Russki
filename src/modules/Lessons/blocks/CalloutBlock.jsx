// src/modules/Lessons/blocks/CalloutBlock.jsx
import styles from "./Blocks.module.css";

const ICONS = { warning: "⚠️", tip: "💡", remember: "📌" };
const CLASS_MAP = {
  warning:  styles.calloutWarning,
  tip:      styles.calloutTip,
  remember: styles.calloutRemember,
};

export default function CalloutBlock({ block }) {
  const type = block.callout_type || "tip";
  return (
    <div className={`${styles.callout} ${CLASS_MAP[type] || styles.calloutTip}`}>
      <span className={styles.calloutIcon}>{ICONS[type] || "💡"}</span>
      <p className={styles.calloutText}>{block.text}</p>
    </div>
  );
}