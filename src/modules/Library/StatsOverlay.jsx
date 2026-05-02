// src/modules/Library/StatsOverlay.jsx
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../AuthContext";
import { getChapters } from "../../storage";
import { C } from "../../constants";
import styles from "./StatsOverlay.module.css";

// ── CEFR reading WPM rubric ───────────────────────────────────────────────
// Based on established Russian L2 reading fluency benchmarks.
const WPM_RUBRIC = {
  A1: { slow: 40,  comfortable: 70  },
  A2: { slow: 60,  comfortable: 100 },
  B1: { slow: 80,  comfortable: 130 },
  B2: { slow: 100, comfortable: 170 },
  C1: { slow: 130, comfortable: 220 },
  C2: { slow: 160, comfortable: 250 },
};

function getRubric(level) {
  return WPM_RUBRIC[level] ?? WPM_RUBRIC["B1"];
}

function wpmLabel(wpm, rubric) {
  if (wpm < rubric.slow)        return { label: "Slow",        color: C.orange };
  if (wpm < rubric.comfortable) return { label: "Comfortable", color: C.sky   };
  return                               { label: "Fluent",       color: C.sage  };
}

export default function StatsOverlay({ book, onClose }) {
  const { user }   = useAuth();
  const [chapters, setChapters] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [tooltip,  setTooltip]  = useState(null); // { chapterId, x, y }
  const tooltipRef = useRef(null);

  useEffect(() => {
    if (!book || !user) return;
    loadStats();
  }, [book?.id]);

  // Close tooltip on outside click
  useEffect(() => {
    function handleClick(e) {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target)) {
        setTooltip(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function loadStats() {
    try {
      setLoading(true);
      const chapData = await getChapters(user.uid, book.id);
      setChapters(chapData ?? []);
    } catch (err) {
      console.warn("Stats load error:", err.message);
    } finally {
      setLoading(false);
    }
  }

  const rubric = getRubric(book.level);

  function wpmForChapter(ch) {
    if (!ch.is_completed) return null;
    const secs = ch.reading_time_seconds ?? 0;
    if (!secs || !ch.word_count) return null;
    return Math.round((ch.word_count / secs) * 60);
  }

  const completedChapters = chapters.filter(ch => ch.is_completed);
  const totalSeconds  = chapters.reduce((s, ch) => s + (ch.reading_time_seconds ?? 0), 0);
  const totalHours    = Math.floor(totalSeconds / 3600);
  const totalMins     = Math.floor((totalSeconds % 3600) / 60);
  const chaptersRead  = chapters.filter(ch => (ch.reading_time_seconds ?? 0) > 0).length;

  const wpmValues    = completedChapters.map(wpmForChapter).filter(Boolean);
  const personalAvg  = wpmValues.length >= 2
    ? Math.round(wpmValues.reduce((a, b) => a + b, 0) / wpmValues.length)
    : null;

  // Bar scale: based on rubric fluent ceiling (comfortable * 1.5), not personal avg
  const barMax = Math.round(rubric.comfortable * 1.6);

  return (
    <div className={styles.backdrop} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>{book.title}</h2>
            {book.level && <span className={styles.levelBadge}>{book.level}</span>}
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.summary}>
          <div className={styles.stat}>
            <span className={styles.statVal}>
              {totalHours > 0 ? `${totalHours}h ` : ""}{totalMins}m
            </span>
            <span className={styles.statLabel}>Total reading time</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statVal}>{chaptersRead} / {chapters.length}</span>
            <span className={styles.statLabel}>Chapters read</span>
          </div>
          {personalAvg && (
            <div className={styles.stat}>
              <span className={styles.statVal}>{personalAvg} wpm</span>
              <span className={styles.statLabel}>Your avg ({book.level})</span>
            </div>
          )}
        </div>

        {/* CEFR rubric legend */}
        <div className={styles.rubric}>
          <span className={styles.rubricLabel}>At {book.level}:</span>
          <span className={styles.rubricItem} style={{ color: C.orange }}>
            Slow &lt;{rubric.slow}
          </span>
          <span className={styles.rubricItem} style={{ color: C.sky }}>
            Comfortable {rubric.slow}–{rubric.comfortable}
          </span>
          <span className={styles.rubricItem} style={{ color: C.sage }}>
            Fluent {rubric.comfortable}+
          </span>
        </div>

        {book.synopsis && <p className={styles.synopsis}>{book.synopsis}</p>}

        {loading ? (
          <p className={styles.loadingText}>Loading stats…</p>
        ) : (
          <div className={styles.chapterList}>
            {chapters.map(ch => {
              const secs   = ch.reading_time_seconds ?? 0;
              const chWpm  = wpmForChapter(ch);
              const mins   = Math.floor(secs / 60);
              const secRem = secs % 60;
              const barPct = chWpm ? Math.min(chWpm / barMax, 1) * 100 : 0;
              const wpmInfo = chWpm ? wpmLabel(chWpm, rubric) : null;

              // Reference lines as % of barMax
              const slowPct        = Math.min(rubric.slow        / barMax, 1) * 100;
              const comfortablePct = Math.min(rubric.comfortable / barMax, 1) * 100;

              return (
                <div key={ch.id} className={styles.chRow}>
                  <div className={styles.chMeta}>
                    <span className={styles.chNum}>Ch {ch.chapter_num}</span>
                    <span className={styles.chTitle}>{ch.title}</span>
                    <span className={styles.chWords}>
                      {ch.word_count ? `${ch.word_count} w` : ""}
                      {ch.is_completed && (
                        <span className={styles.completedBadge} title="Completed">✓</span>
                      )}
                    </span>
                  </div>

                  <div className={styles.chBar}>
                    {/* Fill */}
                    {chWpm && (
                      <div
                        className={styles.chBarFill}
                        style={{ width: `${barPct}%`, background: wpmInfo.color }}
                      />
                    )}
                    {/* Rubric reference lines */}
                    <div className={styles.chBarRef} style={{ left: `${slowPct}%` }} title={`Slow threshold: ${rubric.slow} wpm`} />
                    <div className={styles.chBarRef} style={{ left: `${comfortablePct}%` }} title={`Comfortable threshold: ${rubric.comfortable} wpm`} />
                  </div>

                  <div className={styles.chStats}>
                    {chWpm ? (
                      <span
                        className={styles.chWpm}
                        style={{ color: wpmInfo.color, cursor: "pointer" }}
                        onClick={e => setTooltip(t =>
                          t?.chapterId === ch.id ? null : { chapterId: ch.id, x: e.clientX, y: e.clientY }
                        )}
                      >
                        {chWpm} wpm
                        {tooltip?.chapterId === ch.id && (
                          <div
                            className={styles.wpmTooltip}
                            ref={tooltipRef}
                            style={{ top: tooltip.y + 12, left: tooltip.x - 110 }}
                          >
                            <div className={styles.wpmTooltipTitle}>{book.level} Reading Speed</div>
                            <div className={styles.wpmTooltipRow}>
                              <span style={{ color: C.orange }}>● Slow</span>
                              <span>&lt;{rubric.slow} wpm</span>
                            </div>
                            <div className={styles.wpmTooltipRow}>
                              <span style={{ color: C.sky }}>● Comfortable</span>
                              <span>{rubric.slow}–{rubric.comfortable} wpm</span>
                            </div>
                            <div className={styles.wpmTooltipRow}>
                              <span style={{ color: C.sage }}>● Fluent</span>
                              <span>{rubric.comfortable}+ wpm</span>
                            </div>
                            <div className={styles.wpmTooltipDivider} />
                            <div className={styles.wpmTooltipRow}>
                              <span>This chapter</span>
                              <span style={{ color: wpmInfo.color, fontWeight: 600 }}>
                                {chWpm} wpm — {wpmInfo.label}
                              </span>
                            </div>
                          </div>
                        )}
                      </span>
                    ) : (
                      <span className={styles.chDash}>
                        {secs > 0 && !ch.is_completed ? "not finished" : "—"}
                      </span>
                    )}
                    {secs > 0 && (
                      <span className={styles.chTime}>{mins}m {String(secRem).padStart(2, "0")}s</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}