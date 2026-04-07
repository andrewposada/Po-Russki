// src/modules/Lessons/LessonsHome.jsx
import { useState, useEffect } from "react";
import { useNavigate }         from "react-router-dom";
import { useAuth }             from "../../AuthContext";
import {
  getCoreLessons,
  getUserLessons,
  getAllLessonCompletions,
  getUserProgress,
  getPendingAssignments,
} from "../../storage";
import { getLevelFromXP, XP_LEVELS, LESSON_STATE } from "../../constants";
import { ROADMAPS } from "../../data/roadmaps";
import styles from "./LessonsHome.module.css";
import { computeNodeStates, getAllLessonIds, GRAMMAR_ROADMAP } from "../../data/roadmaps/grammarRoadmap";
import RoadmapSVG   from "./RoadmapSVG";
import NodeHubPanel from "./NodeHubPanel";

// ── Helpers ───────────────────────────────────────────────────────────────────

function cefrClass(level) {
  const map = { A1: styles.cefrA1, A2: styles.cefrA2, B1: styles.cefrB1, B2: styles.cefrB2 };
  return map[level] || styles.cefrA1;
}

function stateClass(state) {
  if (state === LESSON_STATE.IN_PROGRESS) return styles.stateInProgress;
  if (state === LESSON_STATE.COMPLETED || state === LESSON_STATE.MASTERED) return styles.stateCompleted;
  return styles.stateAvailable;
}

function stateLabel(state) {
  if (state === LESSON_STATE.IN_PROGRESS) return "In progress";
  if (state === LESSON_STATE.COMPLETED)   return "Completed";
  if (state === LESSON_STATE.MASTERED)    return "Mastered ★";
  return "Available";
}

function actionButton(state, onClick) {
  if (state === LESSON_STATE.IN_PROGRESS) return <button className={styles.btnContinue} onClick={onClick}>Continue</button>;
  if (state === LESSON_STATE.COMPLETED || state === LESSON_STATE.MASTERED) return <button className={styles.btnReview} onClick={onClick}>Review</button>;
  return <button className={styles.btnStart} onClick={onClick}>Start</button>;
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function LessonsHome() {
  const navigate        = useNavigate();
  const { user }        = useAuth();
  const [lessons, setLessons]               = useState([]);
  const [completions, setCompletions]       = useState({});
  const [progress, setProgress]             = useState({ xp_total: 0, level: 1 });
  const [pending, setPending]               = useState([]);
  const [bannerOpen, setBannerOpen]         = useState(false);
  const [filter, setFilter]                 = useState("all");
  const [loading, setLoading]               = useState(true);
  const [activeNode, setActiveNode]   = useState(null);   // node tapped — drives NodeHubPanel
  const [roadmapExpanded, setRoadmapExpanded] = useState(false); // expand toggle

  useEffect(() => {
    if (!user) return;
    async function load() {
      const [coreLessons, userLessons, completionRows, prog, assignments] = await Promise.all([
        getCoreLessons ? getCoreLessons() : [],
        getUserLessons(user.uid),
        getAllLessonCompletions(user.uid),
        getUserProgress(user.uid),
        getPendingAssignments(user.uid),
      ]);
      const all = [...(coreLessons || []), ...(userLessons || [])];
      const compMap = {};
      (completionRows || []).forEach(row => { compMap[row.lesson_id] = row; });
      setLessons(all);
      setCompletions(compMap);
      setProgress(prog);
      setPending(assignments || []);
      setLoading(false);
    }
    load();
  }, [user]);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const levelInfo = getLevelFromXP(progress.xp_total);
  const nextLevel = XP_LEVELS.find(l => l.xp > progress.xp_total);
  const xpPct = nextLevel
    ? Math.min(100, ((progress.xp_total - levelInfo.xp) / (nextLevel.xp - levelInfo.xp)) * 100)
    : 100;

  const completedCount = Object.values(completions).filter(c => c.state >= LESSON_STATE.COMPLETED).length;
  const masteredCount  = Object.values(completions).filter(c => c.state === LESSON_STATE.MASTERED).length;

  function lessonState(lesson) {
    return completions[lesson.id]?.state ?? LESSON_STATE.AVAILABLE;
  }

  // Sort: in-progress first, then available, then completed/mastered
  const sortedLessons = [...lessons].sort((a, b) => {
    const sa = lessonState(a), sb = lessonState(b);
    const order = [LESSON_STATE.IN_PROGRESS, LESSON_STATE.AVAILABLE, LESSON_STATE.COMPLETED, LESSON_STATE.MASTERED];
    return order.indexOf(sa) - order.indexOf(sb);
  });

  // Build a { [lessonId]: title } lookup for the assignments drawer
  const lessonTitleMap = Object.fromEntries(lessons.map(l => [l.id, l.title]));

  const filteredLessons = sortedLessons.filter(l => {
    if (l.is_core) return false;
    const s = lessonState(l);
    if (filter === "in_progress") return s === LESSON_STATE.IN_PROGRESS;
    if (filter === "available")   return s === LESSON_STATE.AVAILABLE;
    if (filter === "completed")   return s >= LESSON_STATE.COMPLETED;
    return true;
  });

  // Divider index: last index of non-completed
  const lastActiveIdx = filteredLessons.reduce((acc, l, i) => lessonState(l) < LESSON_STATE.COMPLETED ? i : acc, -1);

  // Build a plain { [lessonId]: state } map for the SVG and hub panel
  const lessonStateMap = {};
  Object.entries(completions).forEach(([id, row]) => {
    lessonStateMap[id] = row.state ?? LESSON_STATE.AVAILABLE;
  });

  // Derive per-node states from lesson completions
  const nodeStates = computeNodeStates(lessonStateMap);

  // Roadmap progress
  const roadmapConfig = ROADMAPS[0]?.config ?? [];
  const totalNodes    = roadmapConfig.length;
  const completedNodes = roadmapConfig.filter(node => {
    const nodeIds = node.lessons?.map(l => l.id) ?? [];
    return nodeIds.length > 0 && nodeIds.every(id => (completions[id]?.state ?? 0) >= LESSON_STATE.COMPLETED);
  }).length;

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--c-text-light)", fontFamily: "var(--font-ui)" }}>
        Loading…
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Dashboard strip */}
      <div className={styles.strip}>
        <div className={styles.stripLeft}>
          <span className={styles.stripTitle}>Уроки</span>
          <span className={styles.stripLevel}>{levelInfo.name}</span>
        </div>
        <div className={styles.stripXp}>
          <div className={styles.xpTrack}>
            <div className={styles.xpFill} style={{ width: `${xpPct}%` }} />
          </div>
          <span className={styles.xpLabel}>
            {nextLevel
              ? `${progress.xp_total.toLocaleString()} / ${nextLevel.xp.toLocaleString()} XP`
              : `${progress.xp_total.toLocaleString()} XP`}
          </span>
        </div>
        <div className={styles.stripStats}>
          <div className={styles.statTile}>
            <div className={styles.statValue}>{completedCount}</div>
            <div className={styles.statLabel}>completed</div>
          </div>
          <div className={styles.statTile}>
            <div className={styles.statValue}>{masteredCount}</div>
            <div className={styles.statLabel}>mastered</div>
          </div>
          <div className={styles.statTile}>
            <div className={styles.statValue}>{pending.length}</div>
            <div className={styles.statLabel}>assignments</div>
          </div>
        </div>
      </div>

      {/* Assignments banner — always visible */}
      <>
        <div
          className={`${styles.assignmentsBanner} ${bannerOpen ? styles.assignmentsBannerOpen : ""}`}
          onClick={() => pending.length > 0 ? setBannerOpen(o => !o) : null}
        >
            <div className={styles.assignmentsBannerIcon}>📋</div>
            <div className={styles.assignmentsBannerText}>
              {pending.length > 0 ? (
                <>
                  <div className={styles.assignmentsBannerTitle}>{pending.length} assignment{pending.length !== 1 ? "s" : ""} pending</div>
                  <div className={styles.assignmentsBannerSub}>Complete them to earn XP and build mastery</div>
                </>
              ) : (
                <>
                  <div className={styles.assignmentsBannerTitle}>Assignments</div>
                  <div className={styles.assignmentsBannerSub}>No pending assignments — complete lessons to unlock them</div>
                </>
              )}
            </div>
            {pending.length > 0 && (
              <span className={styles.assignmentsBannerToggle}>{bannerOpen ? "Hide ▲" : "Show ▼"}</span>
            )}
          </div>
          {bannerOpen && (
            <div className={styles.assignmentsDrawer}>
              <div className={styles.assignmentsDrawerGrid}>
                {pending.slice(0, 3).map((a, i) => (
                  <div key={i} className={styles.assignmentPreviewCard}>
                    <div className={styles.assignmentPreviewSource}>{lessonTitleMap[a.lesson_id] ?? a.lesson_id}</div>
                    <div className={styles.assignmentPreviewTitle}>{a.prompt ?? "Assignment"}</div>
                    <button
                      className={styles.assignmentPreviewStart}
                      onClick={() => navigate("/lessons/assignments")}
                    >
                      Start →
                    </button>
                  </div>
                ))}
              </div>
              <div className={styles.assignmentsViewAll} onClick={() => navigate("/lessons/assignments")}>
                View all assignments →
              </div>
            </div>
          )}
        </>

      {/* Main two-column grid */}
      <div className={styles.mainGrid}>
        {/* Roadmap panel */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>{ROADMAPS[0]?.title ?? "Grammar Foundations"}</span>
            <span className={styles.cefrBadge}>A1 → B2</span>
          </div>
          <p className={styles.panelSub}>{ROADMAPS[0]?.subtitle ?? "Cases, conjugation, and aspect"}</p>
          <div className={styles.roadmapProgressRow}>
            <div className={styles.roadmapProgressTrack}>
              <div
                className={styles.roadmapProgressFill}
                style={{ width: totalNodes > 0 ? `${(completedNodes / totalNodes) * 100}%` : "0%" }}
              />
            </div>
            <span className={styles.roadmapProgressLabel}>{completedNodes} of {totalNodes} complete</span>
          </div>
          {/* Roadmap SVG — truncated preview (3 nodes max) */}
            <RoadmapSVG
            nodes={GRAMMAR_ROADMAP}
            nodeStates={nodeStates}
            lessonStateMap={lessonStateMap}
            onNodeTap={setActiveNode}
            maxY={roadmapExpanded ? undefined : (() => {
                // Show: last completed node, active/next node, and 1 locked node after it.
                // Find the index of the "deepest" non-locked node + 1 buffer node.
                const deepestActive = GRAMMAR_ROADMAP.reduce((acc, node, i) => {
                const s = nodeStates[node.id] ?? LESSON_STATE.LOCKED;
                return s > LESSON_STATE.LOCKED ? i : acc;
                }, 0);
                const cutoffIndex = Math.min(deepestActive + 2, GRAMMAR_ROADMAP.length - 1);
                return GRAMMAR_ROADMAP[cutoffIndex]?.position.y ?? 400;
            })()}
            />

            {/* Expand toggle */}
            <button
            className={styles.expandToggle}
            onClick={() => setRoadmapExpanded(prev => !prev)}
            >
            {roadmapExpanded ? "Hide full roadmap ▲" : "Show full roadmap ▼"}
            </button>
        </div>

        {/* Library panel */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Lesson Library</span>
            <button className={styles.importBtn} onClick={() => navigate("/lessons/import")}>
              + Import
            </button>
          </div>
          <div className={styles.filterPills}>
            {[
              { key: "all",         label: "All" },
              { key: "in_progress", label: "In progress" },
              { key: "available",   label: "Available" },
              { key: "completed",   label: "Completed" },
            ].map(f => (
              <button
                key={f.key}
                className={`${styles.filterPill} ${filter === f.key ? styles.filterPillActive : ""}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {filteredLessons.length === 0 && (
            <div className={styles.emptyState}>No lessons match this filter.</div>
          )}

          {filteredLessons.map((lesson, i) => {
            const state      = lessonState(lesson);
            const completed  = state >= LESSON_STATE.COMPLETED;
            const sections   = lesson.content ? [...new Set(lesson.content.map(b => b.group))].length : 0;
            const showDivider = !completed && i === lastActiveIdx + 1 && filter === "all";

            return (
              <div key={lesson.id}>
                {showDivider && <div className={styles.lessonsDivider} />}
                <div
                  className={`${styles.lessonCard} ${completed ? styles.lessonCardCompleted : ""}`}
                  onClick={() => navigate(`/lessons/play/${lesson.id}`)}
                >
                  <div className={styles.lessonCardTop}>
                    <span className={styles.lessonCardTitle}>{lesson.title}</span>
                    <div className={styles.lessonCardBadges}>
                      {lesson.cefr_level && <span className={cefrClass(lesson.cefr_level)}>{lesson.cefr_level}</span>}
                      <span className={stateClass(state)}>{stateLabel(state)}</span>
                    </div>
                  </div>
                  <div className={styles.lessonCardFooter}>
                    <span className={styles.lessonCardMeta}>
                      {lesson.is_core ? "Grammar Roadmap" : "Imported"} · {sections} section{sections !== 1 ? "s" : ""}
                    </span>
                    {actionButton(state, (e) => { e.stopPropagation(); navigate(`/lessons/play/${lesson.id}`); })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    {activeNode && (
        <NodeHubPanel
          node={activeNode}
          lessonStateMap={lessonStateMap}
          completions={completions}
          onClose={() => setActiveNode(null)}
        />
      )}
    </div>
  );
}