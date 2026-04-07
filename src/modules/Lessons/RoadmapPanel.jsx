// src/modules/Lessons/RoadmapPanel.jsx
// Self-contained roadmap panel: scrollable node list + in-panel hub card.
// Replaces RoadmapSVG.jsx + NodeHubPanel.jsx entirely.
//
// Props:
//   nodes          — GRAMMAR_ROADMAP array
//   nodeStates     — { [nodeId]: 0|1|2|3|4 }
//   lessonStateMap — { [lessonId]: state }
//   completions    — { [lessonId]: completion_row }
//   totalNodes     — number
//   completedNodes — number

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { LESSON_STATE } from "../../constants";
import { ROADMAPS } from "../../data/roadmaps";
import styles from "./RoadmapPanel.module.css";

function nodeAbbr(node) {
  if (node.id.startsWith("conj")) return node.cefr ?? "V";
  return node.title.split(" ")[0].slice(0, 4);
}

function cefrColor(cefr) {
  if (cefr === "A1") return styles.cefrA1;
  if (cefr === "A2") return styles.cefrA2;
  if (cefr === "B1") return styles.cefrB1;
  if (cefr === "B2") return styles.cefrB2;
  return styles.cefrA1;
}

const ACTION_LABEL = {
  [LESSON_STATE.IN_PROGRESS]: "Continue →",
  [LESSON_STATE.AVAILABLE]:   "Start →",
  [LESSON_STATE.COMPLETED]:   "Review",
  [LESSON_STATE.MASTERED]:    "Review",
};

const ACTION_CLASS = {
  [LESSON_STATE.IN_PROGRESS]: styles.btnContinue,
  [LESSON_STATE.AVAILABLE]:   styles.btnStart,
  [LESSON_STATE.COMPLETED]:   styles.btnReview,
  [LESSON_STATE.MASTERED]:    styles.btnReview,
};

export default function RoadmapPanel({
  nodes,
  nodeStates,
  lessonStateMap,
  completions,
  totalNodes,
  completedNodes,
}) {
  const navigate = useNavigate();
  const [activeNodeId, setActiveNodeId] = useState(null);
  const scrollRef   = useRef(null);
  const activeRef   = useRef(null);
  const nodeRefs    = useRef({});

  // On mount: scroll so the in-progress (or first available) node is centered
  useEffect(() => {
    const scroller = scrollRef.current;
    const el = activeRef.current;
    if (!scroller || !el) return;
    const scrollerH = scroller.clientHeight;
    const elTop     = el.offsetTop;
    const elH       = el.offsetHeight;
    scroller.scrollTop = elTop - scrollerH / 2 + elH / 2;
  }, []);

  function tapNode(node) {
    const state = nodeStates[node.id] ?? LESSON_STATE.LOCKED;
    if (state === LESSON_STATE.LOCKED || node.status === "coming_soon") return;

    if (activeNodeId === node.id) {
      // Close: re-center the node
      setActiveNodeId(null);
      const scroller = scrollRef.current;
      const el = nodeRefs.current[node.id];
      if (scroller && el) {
        const scrollerH = scroller.clientHeight;
        scroller.scrollTo({ top: el.offsetTop - scrollerH / 2 + el.offsetHeight / 2, behavior: "smooth" });
      }
      return;
    }

    setActiveNodeId(node.id);

    // Scroll tapped node to top of window (with a little breathing room)
    requestAnimationFrame(() => {
      const scroller = scrollRef.current;
      const el = nodeRefs.current[node.id];
      if (scroller && el) {
        scroller.scrollTo({ top: el.offsetTop - 16, behavior: "smooth" });
      }
    });
  }

  function closeHub() {
    const prevId = activeNodeId;
    setActiveNodeId(null);
    // Re-center after close
    requestAnimationFrame(() => {
      const scroller = scrollRef.current;
      const el = nodeRefs.current[prevId];
      if (scroller && el) {
        const scrollerH = scroller.clientHeight;
        scroller.scrollTo({ top: el.offsetTop - scrollerH / 2 + el.offsetHeight / 2, behavior: "smooth" });
      }
    });
  }

  const activeHubNode = activeNodeId ? nodes.find(n => n.id === activeNodeId) : null;

  return (
    <div className={styles.panel}>
      {/* Panel header */}
      <div className={styles.header}>
        <div className={styles.headerRow}>
          <span className={styles.panelTitle}>{ROADMAPS[0]?.title ?? "Grammar Foundations"}</span>
          <span className={styles.cefrRange}>A1 → B2</span>
        </div>
        <p className={styles.panelSub}>{ROADMAPS[0]?.subtitle ?? "Cases, conjugation, and aspect"}</p>
        <div className={styles.progressRow}>
          <div className={styles.progressTrack}>
            <div
              className={styles.progressFill}
              style={{ width: totalNodes > 0 ? `${(completedNodes / totalNodes) * 100}%` : "0%" }}
            />
          </div>
          <span className={styles.progressLabel}>{completedNodes} of {totalNodes} complete</span>
        </div>
      </div>

      {/* Scrollable node window */}
      <div className={styles.window}>
        <div className={styles.fadeTop} />
        <div className={styles.fadeBottom} />
        <div className={styles.scroll} ref={scrollRef}>
          <div className={styles.track}>
            {nodes.map((node, i) => {
              const state       = nodeStates[node.id] ?? LESSON_STATE.LOCKED;
              const isActive    = state === LESSON_STATE.IN_PROGRESS;
              const isDone      = state >= LESSON_STATE.COMPLETED;
              const isNext      = state === LESSON_STATE.AVAILABLE;
              const isLocked    = state === LESSON_STATE.LOCKED || node.status === "coming_soon";
              const isOpen      = activeNodeId === node.id;
              const isCurrentFocus = isActive || (isNext && !nodes.some(n => (nodeStates[n.id] ?? 0) === LESSON_STATE.IN_PROGRESS));

              // Count lessons completed within this node for progress pill
              const lessonIds      = node.lessons?.map(l => l.id) ?? [];
              const doneLessons    = lessonIds.filter(id => (lessonStateMap[id] ?? 0) >= LESSON_STATE.COMPLETED).length;
              const totalLessons   = lessonIds.length;

              return (
                <div key={node.id} className={styles.nodeWrap}>
                  {/* Connector above (skip first) */}
                  {i > 0 && (
                    <div className={`${styles.connector} ${
                      (nodeStates[nodes[i-1].id] ?? 0) >= LESSON_STATE.COMPLETED && isDone
                        ? styles.connectorDone : ""
                    }`} />
                  )}

                  {/* Node row */}
                  <div
                    className={`${styles.nodeRow} ${isLocked ? styles.nodeRowLocked : styles.nodeRowClickable} ${isOpen ? styles.nodeRowOpen : ""}`}
                    ref={el => {
                      nodeRefs.current[node.id] = el;
                      if (isCurrentFocus) activeRef.current = el;
                    }}
                    onClick={() => tapNode(node)}
                  >
                    {/* Circle */}
                    <div className={`${styles.circle} ${
                      isDone    ? styles.circleDone    :
                      isActive  ? styles.circleActive  :
                      isNext    ? styles.circleNext    :
                                  styles.circleLocked
                    }`}>
                      {isDone && state < LESSON_STATE.MASTERED && <span className={styles.check}>✓</span>}
                      {state === LESSON_STATE.MASTERED && <span className={styles.star}>★</span>}
                      {!isDone && <span className={styles.abbr}>{nodeAbbr(node)}</span>}
                    </div>

                    {/* Label */}
                    <div className={styles.label}>
                      <span className={styles.nodeName}>{node.title}</span>
                      <span className={styles.nodeSub}>{node.status === "coming_soon" ? "Coming soon" : node.subtitle}</span>
                      <div className={styles.pills}>
                        {node.cefr && (
                          <span className={`${styles.pill} ${isLocked ? styles.pillLocked : cefrColor(node.cefr)}`}>
                            {node.cefr}
                          </span>
                        )}
                        {isActive && totalLessons > 0 && (
                          <span className={`${styles.pill} ${styles.pillProgress}`}>
                            {doneLessons} of {totalLessons} lessons
                          </span>
                        )}
                        {node.status === "coming_soon" && (
                          <span className={`${styles.pill} ${styles.pillLocked}`}>Coming soon</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {/* Bottom padding so last node clears the fade */}
            <div style={{ height: 40 }} />
          </div>
        </div>
      </div>

      {/* Hub card — slides up from bottom of panel */}
      <div className={`${styles.hubWrap} ${activeHubNode ? styles.hubOpen : ""}`}>
        {activeHubNode && (
          <div className={styles.hub}>
            <div className={styles.hubHeader}>
              <div>
                <div className={styles.hubTitle}>{activeHubNode.title}</div>
                <div className={styles.hubSub}>{activeHubNode.subtitle}</div>
              </div>
              <button className={styles.hubClose} onClick={closeHub}>✕</button>
            </div>
            <div className={styles.hubLessons}>
              {(activeHubNode.lessons ?? []).map((lesson, i) => {
                const ls   = lessonStateMap[lesson.id] ?? LESSON_STATE.LOCKED;
                const comp = completions[lesson.id];
                const locked = ls === LESSON_STATE.LOCKED;
                return (
                  <div key={lesson.id} className={`${styles.hubRow} ${locked ? styles.hubRowLocked : ""}`}>
                    <div className={styles.hubRowInfo}>
                      <span className={styles.hubRowName}>{lesson.title}</span>
                      {ls === LESSON_STATE.IN_PROGRESS && (
                        <div className={styles.hubProgress}>
                          <div className={styles.hubProgressFill} style={{ width: "45%" }} />
                        </div>
                      )}
                      {ls >= LESSON_STATE.COMPLETED && comp?.baseline_score != null && (
                        <div className={styles.hubScore}>
                          <div className={styles.hubScoreTrack}>
                            <div className={styles.hubScoreFill} style={{ width: `${comp.baseline_score}%` }} />
                          </div>
                          <span className={styles.hubScoreLabel}>{comp.baseline_score}%</span>
                        </div>
                      )}
                    </div>
                    {!locked ? (
                      <button
                        className={`${styles.hubBtn} ${ACTION_CLASS[ls] ?? styles.btnStart}`}
                        onClick={() => navigate(`/lessons/play/${lesson.id}`)}
                      >
                        {ACTION_LABEL[ls] ?? "Start →"}
                      </button>
                    ) : (
                      <span className={styles.hubLocked}>Locked</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}