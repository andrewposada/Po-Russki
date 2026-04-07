// src/modules/Grammar/GrammarHome.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../AuthContext";
import { getAllLessonCompletions } from "../../storage";
import { GRAMMAR_ROADMAP } from "../../data/roadmaps/grammarRoadmap";
import { LESSON_STATE, getNodeState, prerequisitesMet } from "../../constants";
import styles from "./GrammarHome.module.css";

// ── State display config ────────────────────────────────────────────────────

const STATE_CONFIG = {
  [LESSON_STATE.LOCKED]:      { label: "Locked",      cls: "stateLocked"      },
  [LESSON_STATE.AVAILABLE]:   { label: "Available",   cls: "stateAvailable"   },
  [LESSON_STATE.IN_PROGRESS]: { label: "In Progress", cls: "stateInProgress"  },
  [LESSON_STATE.COMPLETED]:   { label: "Completed",   cls: "stateCompleted"   },
  [LESSON_STATE.MASTERED]:    { label: "Mastered ★",  cls: "stateMastered"    },
};

const CEFR_COLOR = { A1: "#5a9e6a", A2: "#7ab87e", B1: "#7aaec8", B2: "#7a9e7e", C1: "#9a7e9e" };

// ── Component ───────────────────────────────────────────────────────────────

export default function GrammarHome() {
  const { user } = useAuth();
  const navigate  = useNavigate();

  const [completions, setCompletions]   = useState({});
  const [loading, setLoading]           = useState(true);

  // Build a node-id → nodeConfig lookup for prerequisitesMet()
  const nodeMap = GRAMMAR_ROADMAP.reduce((acc, n) => { acc[n.id] = n; return acc; }, {});

  useEffect(() => {
    if (!user) return;
    async function load() {
      const rows = await getAllLessonCompletions(user.uid);
      // rows is an array of lesson_completions rows; key by lesson_id
      const map = {};
      (rows ?? []).forEach(r => { map[r.lesson_id] = r; });
      setCompletions(map);
      setLoading(false);
    }
    load();
  }, [user]);

  function getEffectiveNodeState(node) {
    const prereqsMet = prerequisitesMet(node.prerequisites, nodeMap, completions);
    if (!prereqsMet) return LESSON_STATE.LOCKED;
    const state = getNodeState(node.lessons.map(l => ({ id: l.id })), completions);
    // getNodeState returns states[0] for unstarted nodes — which is LOCKED (0) since
    // no completion rows exist yet. If prerequisites are met, promote to AVAILABLE.
    return state === LESSON_STATE.LOCKED ? LESSON_STATE.AVAILABLE : state;
  }

  // Count nodes by state for the summary strip
  const nodeCounts = GRAMMAR_ROADMAP.reduce((acc, node) => {
    const s = getEffectiveNodeState(node);
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});

  const masteredCount   = nodeCounts[LESSON_STATE.MASTERED]    ?? 0;
  const completedCount  = nodeCounts[LESSON_STATE.COMPLETED]   ?? 0;
  const availableCount  = nodeCounts[LESSON_STATE.AVAILABLE]   ?? 0;
  const inProgressCount = nodeCounts[LESSON_STATE.IN_PROGRESS] ?? 0;

  // Nodes available for freeplay: completed or mastered (student has learned the material)
  const drillableCount = masteredCount + completedCount + inProgressCount;

  function handleStartFreeplay() {
    navigate("/grammar/freeplay");
  }

  if (loading) {
    return (
      <div className={styles.root}>
        <div className={styles.skeleton} />
        <div className={styles.skeleton} style={{ width: "70%", marginTop: 12 }} />
      </div>
    );
  }

  return (
    <div className={styles.root}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>Грамматика</h1>
          <p className={styles.subtitle}>Drill what you know. Master what you don't.</p>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.btnPrimary}
            onClick={handleStartFreeplay}
            disabled={drillableCount === 0}
            title={drillableCount === 0 ? "Complete at least one lesson to unlock freeplay" : undefined}
          >
            ✏️ Start Freeplay
          </button>
          <button
            className={styles.btnSecondary}
            disabled
            title="Reference sheet — coming in the next update"
          >
            📖 Reference
          </button>
        </div>
      </div>

      {/* Summary strip */}
      <div className={styles.summaryStrip}>
        <div className={styles.summaryTile}>
          <span className={styles.summaryNum}>{masteredCount}</span>
          <span className={styles.summaryLabel}>Mastered</span>
        </div>
        <div className={styles.summaryDivider} />
        <div className={styles.summaryTile}>
          <span className={styles.summaryNum}>{completedCount}</span>
          <span className={styles.summaryLabel}>Completed</span>
        </div>
        <div className={styles.summaryDivider} />
        <div className={styles.summaryTile}>
          <span className={styles.summaryNum}>{availableCount}</span>
          <span className={styles.summaryLabel}>Available</span>
        </div>
        <div className={styles.summaryDivider} />
        <div className={styles.summaryTile}>
          <span className={styles.summaryNum}>{GRAMMAR_ROADMAP.length}</span>
          <span className={styles.summaryLabel}>Total Topics</span>
        </div>
      </div>

      {/* Topic list */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>Grammar Topics</div>
        {drillableCount === 0 && (
          <div className={styles.emptyHint}>
            Complete your first lesson in the Lessons module to unlock Grammar freeplay.
          </div>
        )}
        <div className={styles.topicList}>
          {GRAMMAR_ROADMAP.map(node => {
            const state     = getEffectiveNodeState(node);
            const cfg       = STATE_CONFIG[state] ?? STATE_CONFIG[LESSON_STATE.LOCKED];
            const drillable = state >= LESSON_STATE.IN_PROGRESS;

            return (
              <div
                key={node.id}
                className={`${styles.topicRow} ${drillable ? styles.topicRowDrillable : styles.topicRowLocked}`}
                onClick={drillable ? () => navigate(`/grammar/freeplay?topics=${node.id}`) : undefined}
              >
                <div className={styles.topicLeft}>
                  <span className={styles.topicTitle}>{node.title}</span>
                  <span className={styles.topicSub}>{node.subtitle}</span>
                </div>
                <div className={styles.topicRight}>
                  <span
                    className={styles.cefrChip}
                    style={{ color: CEFR_COLOR[node.cefr] ?? "var(--c-text-mid)" }}
                  >
                    {node.cefr}
                  </span>
                  <span className={`${styles.stateChip} ${styles[cfg.cls]}`}>{cfg.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}