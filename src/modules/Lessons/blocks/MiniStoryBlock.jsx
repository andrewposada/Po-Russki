// src/modules/Lessons/blocks/MiniStoryBlock.jsx
import { useState } from "react";
import TappableWord  from "./TappableWord";
import styles        from "./Blocks.module.css";

export default function MiniStoryBlock({ block }) {
  const [showTranslation, setShowTranslation] = useState(false);

  return (
    <div className={styles.miniStory}>
      <p className={styles.miniStoryRu}>
        <TappableWord text={block.story_ru} />
      </p>

      <button
        className={styles.miniStoryToggle}
        onClick={() => setShowTranslation(v => !v)}
      >
        {showTranslation ? "Hide translation" : "Show translation"}
      </button>

      {showTranslation && (
        <p className={styles.miniStoryEn}>{block.story_en}</p>
      )}

      {block.focus_note && (
        <div className={styles.focusNote}>
          <span className={styles.focusNoteIcon}>👁</span>
          {block.focus_note}
        </div>
      )}
    </div>
  );
}