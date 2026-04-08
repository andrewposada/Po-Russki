// src/modules/Lessons/blocks/DialogueBlock.jsx
import { useState } from "react";
import TappableWord  from "./TappableWord";
import styles        from "./Blocks.module.css";

const SPEAKER_COLORS = ["var(--c-sage)", "var(--c-sky)"];

export default function DialogueBlock({ block }) {
  const [revealed, setRevealed] = useState({}); // { lineIndex: true }

  function toggleLine(i) {
    setRevealed(r => ({ ...r, [i]: !r[i] }));
  }

  return (
    <div className={styles.dialogue}>
      {block.setup && (
        <p className={styles.dialogueSetup}>{block.setup}</p>
      )}

      <div className={styles.dialogueLines}>
        {block.lines.map((line, i) => {
          const speakerIndex = (block.speakers ?? []).indexOf(line.speaker);
          const color = SPEAKER_COLORS[speakerIndex % SPEAKER_COLORS.length] ?? SPEAKER_COLORS[0];
          return (
            <div key={i} className={styles.dialogueLine}>
              <span className={styles.dialogueSpeaker} style={{ color }}>
                {line.speaker}
              </span>
              <span
                className={styles.dialogueRu}
                onClick={() => toggleLine(i)}
              >
                <TappableWord text={line.ru} />
              </span>
              {revealed[i] && (
                <span className={styles.dialogueEn}>{line.en}</span>
              )}
            </div>
          );
        })}
      </div>

      {block.focus_note && (
        <div className={styles.focusNote}>
          <span className={styles.focusNoteIcon}>👁</span>
          {block.focus_note}
        </div>
      )}
    </div>
  );
}