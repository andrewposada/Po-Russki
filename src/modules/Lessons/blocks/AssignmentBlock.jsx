// src/modules/Lessons/blocks/AssignmentBlock.jsx
import styles from "./Blocks.module.css";

export default function AssignmentBlock({ block }) {
  return (
    <div className={styles.assignment}>
      <p className={styles.assignmentTitle}>{block.title}</p>
      <p className={styles.assignmentDesc}>{block.description}</p>
      <p className={styles.assignmentMeta}>
        {block.exercises?.length ?? 0} exercises · Released to your assignments queue when this lesson is complete
      </p>
    </div>
  );
}