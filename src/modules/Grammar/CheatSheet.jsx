// src/modules/Grammar/CheatSheet.jsx
import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { GRAMMAR_REFERENCE } from "../../data/grammarReference";
import { GRAMMAR_ROADMAP } from "../../data/roadmaps/grammarRoadmap";
import { LESSON_STATE, getNodeState, prerequisitesMet } from "../../constants";
import styles from "./CheatSheet.module.css";

// ── State display config ─────────────────────────────────────────────────────

const STATE_LABELS = {
  [LESSON_STATE.LOCKED]:      { label: "Locked",      chipCls: "chipLocked"      },
  [LESSON_STATE.AVAILABLE]:   { label: "Available",   chipCls: "chipAvailable"   },
  [LESSON_STATE.IN_PROGRESS]: { label: "In Progress", chipCls: "chipInProgress"  },
  [LESSON_STATE.COMPLETED]:   { label: "Completed",   chipCls: "chipCompleted"   },
  [LESSON_STATE.MASTERED]:    { label: "Mastered ★",  chipCls: "chipMastered"    },
};

const CALLOUT_CONFIG = {
  warning: { icon: "⚠️", cls: "calloutWarning" },
  tip:     { icon: "💡", cls: "calloutTip"     },
  remember:{ icon: "📌", cls: "calloutRemember"},
};

// ── Sub-component: Reference Table with tappable cells ────────────────────────

function ReferenceTable({ table }) {
  // openPopover: { rowIndex, colIndex } | null
  // openPopover: { rowIndex, colIndex, x, y } | null  (x/y = fixed pixel position)
  const [openPopover, setOpenPopover] = useState(null);
  const tableRef = useRef(null);

  // Close popover when clicking outside
  useEffect(() => {
    if (!openPopover) return;
    function handleClick(e) {
      // Don't close if clicking inside the popover itself
      const popoverEl = document.getElementById("cheatsheet-popover");
      if (popoverEl && popoverEl.contains(e.target)) return;
      if (tableRef.current && !tableRef.current.contains(e.target)) {
        setOpenPopover(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [openPopover]);

  function handleCellClick(e, rowIndex, colIndex) {
    const key = `${rowIndex}-${colIndex}`;
    const examples = table.cellExamples?.[key];
    if (!examples || examples.length === 0) return;
    if (openPopover?.rowIndex === rowIndex && openPopover?.colIndex === colIndex) {
      setOpenPopover(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setOpenPopover({
      rowIndex,
      colIndex,
      x: rect.left,
      y: rect.bottom + 4,
    });
  }

  function hasCellExamples(rowIndex, colIndex) {
    return !!(table.cellExamples?.[`${rowIndex}-${colIndex}`]?.length);
  }

  return (
    <div className={styles.tableWrapper} ref={tableRef}>
      {table.label && <div className={styles.tableCaption}>{table.label}</div>}
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              {table.headers.map((h, i) => (
                <th key={i} className={styles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className={rowIndex % 2 === 1 ? styles.trAlt : ""}>
                {row.map((cell, colIndex) => {
                  const tappable = hasCellExamples(rowIndex, colIndex);
                  const isOpen = openPopover?.rowIndex === rowIndex && openPopover?.colIndex === colIndex;
                  const popoverExamples = table.cellExamples?.[`${rowIndex}-${colIndex}`] ?? [];
                  return (
                    <td
                      key={colIndex}
                      className={`${styles.td} ${tappable ? styles.tdTappable : ""} ${isOpen ? styles.tdOpen : ""}`}
                      onClick={tappable ? (e) => handleCellClick(e, rowIndex, colIndex) : undefined}
                      style={{ position: "relative" }}
                    >
                      <span className={colIndex === 0 ? styles.tdFirst : ""}>{cell}</span>
                      {isOpen && createPortal(
                        <div
                          id="cheatsheet-popover"
                          className={styles.popover}
                          style={{ top: openPopover.y, left: openPopover.x }}
                        >
                          <div className={styles.popoverHeader}>Examples</div>
                          {popoverExamples.map((ex, i) => (
                            <div key={i} className={styles.popoverExample}>
                              <div className={styles.popoverRu}>{ex.ru}</div>
                              <div className={styles.popoverEn}>{ex.en}</div>
                            </div>
                          ))}
                          <button
                            className={styles.popoverClose}
                            onClick={e => { e.stopPropagation(); setOpenPopover(null); }}
                          >✕</button>
                        </div>,
                        document.body
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CheatSheet({ onClose, completions, initialTopicId }) {
  const navigate = useNavigate();

  // Build ordered topic list from roadmap (preserves roadmap order in sidebar)
  const orderedTopics = GRAMMAR_ROADMAP
    .filter(node => GRAMMAR_REFERENCE[node.id])
    .map(node => ({
      id:       node.id,
      title:    node.title,
      subtitle: node.subtitle,
      cefr:     node.cefr,
    }));

  const nodeMap = GRAMMAR_ROADMAP.reduce((acc, n) => { acc[n.id] = n; return acc; }, {});

  // Default to first topic with content, or initialTopicId if provided
  const firstId = initialTopicId && GRAMMAR_REFERENCE[initialTopicId]
    ? initialTopicId
    : orderedTopics[0]?.id ?? null;

  const [activeTopic, setActiveTopic] = useState(firstId);
  const [exceptionsOpen, setExceptionsOpen] = useState(false);

  // Reset exceptions toggle when topic changes
  useEffect(() => { setExceptionsOpen(false); }, [activeTopic]);

  // Derive effective state for each topic (same logic as GrammarHome)
  function getEffectiveNodeState(node) {
    const prereqsMet = prerequisitesMet(node.prerequisites, nodeMap, completions);
    if (!prereqsMet) return LESSON_STATE.LOCKED;
    const state = getNodeState(node.lessons.map(l => ({ id: l.id })), completions);
    return state === LESSON_STATE.LOCKED ? LESSON_STATE.AVAILABLE : state;
  }

  function handleDrill(topicId) {
    onClose();
    navigate(`/grammar/freeplay?topics=${topicId}`);
  }

  const topic    = activeTopic ? GRAMMAR_REFERENCE[activeTopic] : null;
  const nodeConf = activeTopic ? GRAMMAR_ROADMAP.find(n => n.id === activeTopic) : null;
  const nodeState = nodeConf ? getEffectiveNodeState(nodeConf) : LESSON_STATE.LOCKED;
  const stateCfg  = STATE_LABELS[nodeState] ?? STATE_LABELS[LESSON_STATE.LOCKED];

  const isStub = topic && topic.tables.length === 0 && topic.examples.length === 0;

  // Group topics by tier for sidebar section labels
  const tierGroups = [];
  let lastTier = null;
  for (const t of orderedTopics) {
    const node = nodeMap[t.id];
    if (!node) continue;
    if (node.tier !== lastTier) {
      tierGroups.push({ tier: node.tier, topics: [] });
      lastTier = node.tier;
    }
    tierGroups[tierGroups.length - 1].topics.push(t);
  }

  const TIER_LABELS = { 1: "Foundation", 2: "Core Grammar", 3: "Advanced" };

  return (
    <div className={styles.backdrop} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        {/* Modal header */}
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>Cheat Sheet</span>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>
          {/* Sidebar */}
          <div className={styles.sidebar}>
            {tierGroups.map(({ tier, topics }) => (
              <div key={tier}>
                <div className={styles.sidebarSection}>{TIER_LABELS[tier] ?? `Tier ${tier}`}</div>
                {topics.map(t => {
                  const node  = nodeMap[t.id];
                  const state = node ? getEffectiveNodeState(node) : LESSON_STATE.LOCKED;
                  const cfg   = STATE_LABELS[state] ?? STATE_LABELS[LESSON_STATE.LOCKED];
                  return (
                    <div
                        key={t.id}
                        className={`${styles.sidebarItem} ${activeTopic === t.id ? styles.sidebarItemActive : ""}`}
                        onClick={() => setActiveTopic(t.id)}
                    >
                      <span className={styles.sidebarItemName}>{t.title}</span>
                      <span className={`${styles.sidebarChip} ${styles[cfg.chipCls]}`}>
                        {cfg.label}
                      </span>
                    </div>
                  );
                })}
                <div className={styles.sidebarDivider} />
              </div>
            ))}
          </div>

          {/* Content area */}
          <div className={styles.content}>
            {!topic ? (
              <div className={styles.emptyState}>Select a topic from the sidebar.</div>
            ) : (
              <>
                {/* Topic header */}
                <div className={styles.topicTitle}>{topic.title}</div>
                <div className={styles.badgeRow}>
                  <span className={styles.cefrBadge}>{topic.cefr}</span>
                  <span className={`${styles.statusChip} ${styles[stateCfg.chipCls]}`}>
                    {stateCfg.label}
                  </span>
                </div>
                {topic.subtitle && (
                  <div className={styles.topicSubtitle}>{topic.subtitle}</div>
                )}

                {/* Drill CTA */}
                {nodeState >= LESSON_STATE.IN_PROGRESS && (
                  <div
                    className={styles.drillCta}
                    onClick={() => handleDrill(activeTopic)}
                  >
                    <span className={styles.drillCtaLeft}>Ready to practice this topic?</span>
                    <span className={styles.drillCtaBtn}>Drill {topic.title}</span>
                  </div>
                )}

                {/* Stub message */}
                {isStub && (
                  <div className={styles.stubMessage}>
                    Reference content for this topic is coming soon. Complete the lessons to unlock it.
                  </div>
                )}

                {/* Uses */}
                {topic.uses && topic.uses.length > 0 && (
                  <div className={styles.section}>
                    <div className={styles.sectionTitle}>When to use</div>
                    <ul className={styles.usesList}>
                      {topic.uses.map((u, i) => (
                        <li key={i} className={styles.usesItem}>{u}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Tables */}
                {topic.tables && topic.tables.length > 0 && (
                  <div className={styles.section}>
                    <div className={styles.sectionTitle}>Reference tables</div>
                    <div className={styles.sectionNote}>Tap a highlighted cell to see example sentences.</div>
                    {topic.tables.map(table => (
                      <ReferenceTable key={table.id} table={table} />
                    ))}
                  </div>
                )}

                {/* Examples */}
                {topic.examples && topic.examples.length > 0 && (
                  <div className={styles.section}>
                    <div className={styles.sectionTitle}>Examples</div>
                    {topic.examples.map((ex, i) => (
                      <div key={i} className={styles.exampleItem}>
                        <div className={styles.exampleRu}>{ex.ru}</div>
                        <div className={styles.exampleEn}>{ex.en}</div>
                        {ex.note && <div className={styles.exampleNote}>{ex.note}</div>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Callouts */}
                {topic.callouts && topic.callouts.length > 0 && (
                  <div className={styles.section}>
                    {topic.callouts.map((c, i) => {
                      const cfg = CALLOUT_CONFIG[c.type] ?? CALLOUT_CONFIG.tip;
                      return (
                        <div key={i} className={`${styles.callout} ${styles[cfg.cls]}`}>
                          <span className={styles.calloutIcon}>{cfg.icon}</span>
                          <span className={styles.calloutText}>{c.text}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Exceptions */}
                {topic.exceptions && topic.exceptions.length > 0 && (
                  <div className={styles.section}>
                    <button
                      className={styles.exceptionsToggle}
                      onClick={() => setExceptionsOpen(v => !v)}
                    >
                      {exceptionsOpen ? "Hide exceptions ▲" : "Show exceptions ▾"}
                    </button>
                    {exceptionsOpen && (
                      <div className={styles.exceptionsList}>
                        {topic.exceptions.map((ex, i) => (
                          <div key={i} className={styles.exceptionItem}>
                            <span className={styles.exceptionWord}>{ex.ru}</span>
                            <span className={styles.exceptionNote}>{ex.note}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}