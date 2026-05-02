// src/modules/Library/StatsOverlay.jsx
import { useState, useEffect } from "react";
import { useAuth } from "../../AuthContext";
import { getChapters } from "../../storage";
import { C } from "../../constants";
import styles from "./StatsOverlay.module.css";

export default function StatsOverlay({ book, onClose }) {
  const { user }    = useAuth();
  const [chapters,  setChapters]  = useState([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    if (!book || !user) return;
    loadStats();
  }, [book?.id]);

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

  function wpmForChapter(ch) {
    const secs = ch.reading_time_seconds ?? 0;
    if (!secs || !ch.word_count) return null;
    return Math.round((ch.word_count / secs) * 60);
  }

  const totalSeconds  = chapters.reduce((s, ch) => s + (ch.reading_time_seconds ?? 0), 0);
  const totalHours    = Math.floor(totalSeconds / 3600);
  const totalMins     = Math.floor((totalSeconds % 3600) / 60);
  const chaptersRead  = chapters.filter(ch => (ch.reading_time_seconds ?? 0) > 0).length;

  const wpmValues    = chapters.map(wpmForChapter).filter(Boolean);
  const levelAvgWpm  = wpmValues.length >= 2
    ? Math.round(wpmValues.reduce((a, b) => a + b, 0) / wpmValues.length)
    : null;
  const maxWpm = levelAvgWpm ?? Math.max(...wpmValues, 1);

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
          {levelAvgWpm && (
            <div className={styles.stat}>
              <span className={styles.statVal}>{levelAvgWpm} wpm</span>
              <span className={styles.statLabel}>Your avg at {book.level}</span>
            </div>
          )}
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
              const barPct = chWpm && maxWpm ? Math.min(chWpm / maxWpm, 1) * 100 : 0;
              const isGood = levelAvgWpm ? chWpm >= levelAvgWpm : true;

              return (
                <div key={ch.id} className={styles.chRow}>
                  <div className={styles.chMeta}>
                    <span className={styles.chNum}>Ch {ch.chapter_num}</span>
                    <span className={styles.chTitle}>{ch.title}</span>
                    <span className={styles.chWords}>{ch.word_count ? `${ch.word_count} w` : ""}</span>
                  </div>
                  <div className={styles.chBar}>
                    <div
                      className={styles.chBarFill}
                      style={{ width: `${barPct}%`, background: isGood ? C.sage : C.orange }}
                    />
                    {levelAvgWpm && (
                      <div
                        className={styles.chBarRef}
                        style={{ left: `${Math.min((levelAvgWpm / maxWpm) * 100, 100)}%` }}
                      />
                    )}
                  </div>
                  <div className={styles.chStats}>
                    {chWpm
                      ? <span className={styles.chWpm}>{chWpm} wpm</span>
                      : <span className={styles.chDash}>—</span>}
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