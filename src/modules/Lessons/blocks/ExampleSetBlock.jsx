// src/modules/Lessons/blocks/ExampleSetBlock.jsx
import styles from "./Blocks.module.css";

export default function ExampleSetBlock({ block }) {
  return (
    <div className={styles.exampleSet}>
      {block.examples.map((ex, i) => (
        <div key={i} className={styles.example}>
          <div style={{ flex: 1 }}>
            <div className={styles.exampleRu}>{ex.ru}</div>
            <div className={styles.exampleEn}>{ex.en}</div>
            {ex.note && <div className={styles.exampleNote}>{ex.note}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}