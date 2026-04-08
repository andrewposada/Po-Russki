// src/modules/Lessons/blocks/DiscoveryBlock.jsx
import { useState } from "react";
import styles        from "./Blocks.module.css";

export default function DiscoveryBlock({ block }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className={styles.discovery}>
      <div className={styles.discoveryPrompt}>
        <span className={styles.discoveryIcon}>🔍</span>
        <span>{block.prompt}</span>
      </div>
      {!revealed ? (
        <button className={styles.discoveryRevealBtn} onClick={() => setRevealed(true)}>
          Reveal the pattern
        </button>
      ) : (
        <div className={styles.discoveryReveal}>
          {block.reveal}
        </div>
      )}
    </div>
  );
}