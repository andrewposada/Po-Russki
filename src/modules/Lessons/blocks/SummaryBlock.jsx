// src/modules/Lessons/blocks/SummaryBlock.jsx
import styles from "./Blocks.module.css";

export default function SummaryBlock({ block }) {
  return (
    <div className={styles.summary}>
      <p className={styles.summaryHeading}>{block.title || "Summary"}</p>
      {block.points?.length > 0 && (
        <ul className={styles.summaryPoints}>
          {block.points.map((pt, i) => <li key={i}>{pt}</li>)}
        </ul>
      )}
    </div>
  );
}