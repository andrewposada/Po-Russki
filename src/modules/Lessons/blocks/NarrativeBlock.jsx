// src/modules/Lessons/blocks/NarrativeBlock.jsx
import styles from "./Blocks.module.css";

export default function NarrativeBlock({ block }) {
  return (
    <p
      className={styles.narrative}
      dangerouslySetInnerHTML={{ __html: block.content }}
    />
  );
}