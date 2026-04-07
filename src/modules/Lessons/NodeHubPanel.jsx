// src/modules/Lessons/NodeHubPanel.jsx
// Bottom sheet / inline panel showing sub-lessons for a tapped roadmap node.
// Props:
//   node          — roadmap node object
//   lessonStateMap — { [lessonId]: state }
//   completions   — { [lessonId]: completion_row }
//   onClose       — () => void
//   onStartLesson — (lessonId) => void  (navigates to player)

import { useNavigate } from "react-router-dom";
import { LESSON_STATE } from "../../constants";
import styles from "./NodeHubPanel.module.css";

const STATE_LABELS = {
  [LESSON_STATE.LOCKED]:      { label: "Locked",      chip: "locked"      },
  [LESSON_STATE.AVAILABLE]:   { label: "Available",   chip: "available"   },
  [LESSON_STATE.IN_PROGRESS]: { label: "In Progress", chip: "inprogress"  },
  [LESSON_STATE.COMPLETED]:   { label: "Completed",   chip: "completed"   },
  [LESSON_STATE.MASTERED]:    { label: "Mastered",    chip: "mastered"    },
};

export default function NodeHubPanel({ node, lessonStateMap, completions, onClose, onStartLesson }) {
  const navigate = useNavigate();

  if (!node) return null;

  function lessonState(lessonId) {
    return lessonStateMap[lessonId] ?? LESSON_STATE.AVAILABLE;
  }

  function actionLabel(state) {
    if (state === LESSON_STATE.IN_PROGRESS) return "Continue";
    if (state >= LESSON_STATE.COMPLETED)    return "Review";
    return "Start";
  }

  function actionVariant(state) {
    if (state === LESSON_STATE.IN_PROGRESS) return styles.btnContinue;
    if (state >= LESSON_STATE.COMPLETED)    return styles.btnReview;
    return styles.btnStart;
  }

  return (
    <div className={styles.backdrop} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.panel}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.nodeTitle}>{node.title}</div>
            <div className={styles.nodeSub}>{node.subtitle}</div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* CEFR + tier row */}
        <div className={styles.metaRow}>
          <span className={`${styles.cefrBadge} ${styles[`cefr${node.cefr}`]}`}>{node.cefr}</span>
          <span className={styles.tierLabel}>Tier {node.tier}</span>
          <span className={styles.lessonCount}>{node.lessons.length} lesson{node.lessons.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Sub-lesson list */}
        <div className={styles.lessonList}>
          {node.lessons.map((lesson, i) => {
            const state     = lessonState(lesson.id);
            const comp      = completions[lesson.id];
            const stateInfo = STATE_LABELS[state] ?? STATE_LABELS[LESSON_STATE.LOCKED];
            const locked    = state === LESSON_STATE.LOCKED;

            return (
              <div
                key={lesson.id}
                className={`${styles.lessonRow} ${locked ? styles.lessonRowLocked : ""}`}
              >
                {/* Step number */}
                <div className={`${styles.stepNum} ${locked ? styles.stepNumLocked : state >= LESSON_STATE.COMPLETED ? styles.stepNumDone : styles.stepNumActive}`}>
                  {state >= LESSON_STATE.COMPLETED ? "✓" : i + 1}
                </div>

                {/* Lesson info */}
                <div className={styles.lessonInfo}>
                  <div className={styles.lessonTitle}>{lesson.title}</div>
                  <div className={styles.lessonSubtitle}>{lesson.subtitle}</div>
                  {comp && comp.baseline_score !== null && (
                    <div className={styles.scoreRow}>
                      <div className={styles.scoreTrack}>
                        <div
                          className={styles.scoreFill}
                          style={{ width: `${comp.baseline_score}%` }}
                        />
                      </div>
                      <span className={styles.scoreLabel}>{comp.baseline_score}%</span>
                    </div>
                  )}
                </div>

                {/* State chip + action */}
                <div className={styles.lessonActions}>
                  <span className={`${styles.stateChip} ${styles[stateInfo.chip]}`}>
                    {stateInfo.label}
                  </span>
                  {!locked && (
                    <button
                      className={`${styles.actionBtn} ${actionVariant(state)}`}
                      onClick={() => {
                        onClose();
                        navigate(`/lessons/play/${lesson.id}`);
                      }}
                    >
                      {actionLabel(state)}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* XP summary */}
        <div className={styles.xpRow}>
          <span className={styles.xpLabel}>
            Total XP available: <strong>{node.lessons.reduce((sum, l) => sum + (l.xp_reward ?? 100), 0)} XP</strong>
          </span>
        </div>
      </div>
    </div>
  );
}