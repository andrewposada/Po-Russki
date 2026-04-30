// src/modules/Muzyka/SongStudy.jsx
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../AuthContext";
import { getSongs, updateSongLearned, updateSongMastered, updateSongStudyProgress } from "../../storage";
import { songExplainContext } from "../../components/TranslationTooltip/songExplainContext";
import styles from "./SongStudy.module.css";

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeAnswer(s) {
  return s.trim().toLowerCase().replace(/[.,!?;:«»"'()-]/g, "").replace(/\s+/g, " ");
}

function getRandomWord(line) {
  const words = line.ru.split(" ").filter(w => w.replace(/[.,!?;:«»"'()-]/g, "").length > 1);
  if (words.length === 0) return null;
  return words[Math.floor(Math.random() * words.length)];
}

function isLearned(linesLearned, stanzaIndex, lineIndex) {
  return linesLearned.some(l => l.stanza_index === stanzaIndex && l.line_index === lineIndex);
}

function getDrillableLines(lines) {
  return lines.filter(l => l.drillable);
}

// ── ContextLines — prev / focus / next for drill tab ─────────────────────────

function ContextLines({ lines, currentLine, focusClass, renderFocus }) {
  const allLines   = lines.filter(l => l.drillable);
  const currentIdx = allLines.findIndex(
    l => l.stanza_index === currentLine.stanza_index && l.line_index === currentLine.line_index
  );
  const prev = currentIdx > 0 ? allLines[currentIdx - 1] : null;
  const next = currentIdx < allLines.length - 1 ? allLines[currentIdx + 1] : null;

  return (
    <div className={styles.ctxWrap}>
      {prev ? <div className={styles.ctxLine}>{prev.ru}</div> : <div className={styles.ctxLine}>&nbsp;</div>}
      <div className={`${styles.ctxFocus} ${focusClass}`}>{renderFocus()}</div>
      {next ? <div className={styles.ctxLine}>{next.ru}</div> : <div className={styles.ctxLine}>&nbsp;</div>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SongStudy() {
  const { songId } = useParams();
  const { user }   = useAuth();
  const navigate   = useNavigate();

  const [song,          setSong]          = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [tab,           setTab]           = useState("read"); // read | study | drill
  const [drillMode,     setDrillMode]     = useState("cloze");
  const [linesLearned,  setLinesLearned]  = useState([]);
  const [mastered,      setMastered]      = useState(false);

  // ── Drill state ─────────────────────────────────────────────────────────────
  const [drillIdx,  setDrillIdx]  = useState(0);
  const [answer,    setAnswer]    = useState("");
  const [feedback,  setFeedback]  = useState(null);
  const [revealed,  setRevealed]  = useState(false);

  // ── Study state ─────────────────────────────────────────────────────────────
  // studyPhase: "resume_prompt" | "studying" | "complete"
  const [studyPhase,      setStudyPhase]      = useState("studying");
  const [studyIdx,        setStudyIdx]        = useState(0);   // index into song.lines (all lines, not just drillable)
  const [studyAnswer,     setStudyAnswer]     = useState("");
  const [studyFeedback,   setStudyFeedback]   = useState(null); // null | { correct, partial, feedback }
  const [studyGrading,    setStudyGrading]    = useState(false);
  const [studyScorePoints, setStudyScorePoints] = useState(0);
  const [studyGradedCount, setStudyGradedCount] = useState(0);
  // completedLines: array of { line, result } — drives the stack display
  // result: "correct" | "partial" | "wrong" | "skip"
  const [completedLines,  setCompletedLines]  = useState([]);

  // Stale closure guards
  const linesLearnedRef    = useRef(linesLearned);
  const studyScoreRef      = useRef(studyScorePoints);
  const studyGradedRef     = useRef(studyGradedCount);
  const studyIdxRef        = useRef(studyIdx);
  useEffect(() => { linesLearnedRef.current   = linesLearned;    }, [linesLearned]);
  useEffect(() => { studyScoreRef.current     = studyScorePoints; }, [studyScorePoints]);
  useEffect(() => { studyGradedRef.current    = studyGradedCount; }, [studyGradedCount]);
  useEffect(() => { studyIdxRef.current       = studyIdx;         }, [studyIdx]);

  // Auto-scroll study stack to bottom when completedLines changes
  const stackRef = useRef(null);
  useEffect(() => {
    if (stackRef.current) {
      stackRef.current.scrollTop = stackRef.current.scrollHeight;
    }
  }, [completedLines]);

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;
    (async () => {
      const all   = await getSongs(user.uid);
      const found = all.find(s => s.id === songId);
      if (!found) { navigate("/muzyka"); return; }
      setSong(found);
      setLinesLearned(found.lines_learned ?? []);
      setMastered(found.mastered ?? false);

      // Determine study start state
      const savedIdx    = found.study_progress_index ?? null;
      const savedPoints = found.study_score_points   ?? 0;
      if (savedIdx !== null && savedIdx > 0 && savedIdx < (found.lines ?? []).length) {
        // There's a saved mid-session position — show resume prompt
        setStudyPhase("resume_prompt");
        setStudyIdx(savedIdx);
        setStudyScorePoints(savedPoints);
        // Reconstruct graded count from lines passed so far
        const drillableBeforeIdx = (found.lines ?? [])
          .slice(0, savedIdx)
          .filter(l => l.drillable).length;
        setStudyGradedCount(drillableBeforeIdx);
      } else {
        setStudyPhase("studying");
        setStudyIdx(0);
      }

      setLoading(false);
      songExplainContext.lines = found.lines ?? [];
    })();
    return () => { songExplainContext.lines = null; };
  }, [user, songId, navigate]);

  // ── Persist helpers ───────────────────────────────────────────────────────

  const persistLearned = useCallback(async (newLearned, newMastered) => {
    if (!user || !songId) return;
    try { await updateSongLearned(user.uid, songId, newLearned, newMastered); }
    catch (e) { console.error("persistLearned:", e); }
  }, [user, songId]);

  const persistStudyProgress = useCallback(async (idx, points) => {
    if (!user || !songId) return;
    try {
      await updateSongStudyProgress(user.uid, songId, {
        study_progress_index: idx,
        study_score_points:   points,
      });
    } catch (e) { console.error("persistStudyProgress:", e); }
  }, [user, songId]);

  const persistStudyComplete = useCallback(async (score) => {
    if (!user || !songId) return;
    try {
      await updateSongStudyProgress(user.uid, songId, {
        last_study_score:     score,
        last_studied_at:      new Date().toISOString(),
        study_progress_index: 0,
        study_score_points:   0,
      });
    } catch (e) { console.error("persistStudyComplete:", e); }
  }, [user, songId]);

  // ── Mark line learned (drill) ─────────────────────────────────────────────

  function markLineAsLearned(stanzaIndex, lineIndex) {
    if (isLearned(linesLearnedRef.current, stanzaIndex, lineIndex)) return;
    const newLearned  = [...linesLearnedRef.current, { stanza_index: stanzaIndex, line_index: lineIndex }];
    const drillable   = (song?.lines ?? []).filter(l => l.drillable);
    const newMastered = newLearned.length >= drillable.length;
    setLinesLearned(newLearned);
    setMastered(newMastered);
    persistLearned(newLearned, newMastered);
  }

  async function handleUnmarkMastered() {
    setMastered(false);
    try { await updateSongMastered(user.uid, songId, false); }
    catch (e) { console.error(e); }
  }

  // ── Study: resume / restart ───────────────────────────────────────────────

  function handleStudyResume() {
    // Restore the visual stack for lines already completed
    const completed = (song.lines ?? []).slice(0, studyIdx).map(line => ({
      line,
      result: "skip", // we don't have the original grades stored, so show neutral
    }));
    setCompletedLines(completed);
    setStudyPhase("studying");
  }

  function handleStudyRestart() {
    setStudyIdx(0);
    setStudyScorePoints(0);
    setStudyGradedCount(0);
    setCompletedLines([]);
    setStudyFeedback(null);
    setStudyAnswer("");
    setStudyPhase("studying");
    persistStudyProgress(0, 0);
  }

  // ── Study: check answer ───────────────────────────────────────────────────

  async function handleStudyCheck() {
    if (!song || studyGrading) return;
    const currentStudyLine = (song.lines ?? [])[studyIdx];
    if (!currentStudyLine || !currentStudyLine.drillable) return;

    setStudyGrading(true);
    try {
      const res  = await fetch("/api/vocab-grade", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          mode:           "study_line",
          line_ru:        currentStudyLine.ru,
          line_en:        currentStudyLine.en,
          student_answer: studyAnswer,
        }),
      });
      const data = await res.json();
      setStudyFeedback({
        correct: data.correct,
        partial: data.partial,
        feedback: data.feedback ?? "",
        actualEn: currentStudyLine.en,
      });
    } catch (e) {
      console.error("study grade error:", e);
      setStudyFeedback({ correct: false, partial: false, feedback: "Could not grade — moving on.", actualEn: currentStudyLine.en });
    }
    setStudyGrading(false);
  }

  // ── Study: advance to next line ───────────────────────────────────────────

  function handleStudyNext() {
    if (!song) return;
    const lines              = song.lines ?? [];
    const currentStudyLine   = lines[studyIdx];
    const fb                 = studyFeedback;

    // Determine result for the completed line
    let result = "skip";
    let pointsEarned = 0;
    if (currentStudyLine?.drillable && fb) {
      if (fb.correct)       { result = "correct"; pointsEarned = 1;   }
      else if (fb.partial)  { result = "partial"; pointsEarned = 0.5; }
      else                  { result = "wrong";   pointsEarned = 0;   }
    }

    // Add to completed stack
    setCompletedLines(prev => [...prev, { line: currentStudyLine, result }]);

    // Update running score
    const newPoints = studyScoreRef.current + pointsEarned;
    const newGraded = currentStudyLine?.drillable
      ? studyGradedRef.current + 1
      : studyGradedRef.current;

    setStudyScorePoints(newPoints);
    setStudyGradedCount(newGraded);
    setStudyFeedback(null);
    setStudyAnswer("");

    const nextIdx = studyIdx + 1;

    if (nextIdx >= lines.length) {
      // Session complete
      const drillableCount = lines.filter(l => l.drillable).length;
      const finalScore     = drillableCount === 0
        ? 0
        : Math.round((newPoints / drillableCount) * 100);
      setStudyPhase("complete");
      persistStudyComplete(finalScore);
    } else {
      setStudyIdx(nextIdx);
      // Fire-and-forget progress save every 3 lines
      if (nextIdx % 3 === 0) persistStudyProgress(nextIdx, newPoints);
    }
  }

  // ── Drill actions ─────────────────────────────────────────────────────────

  const drillableLines = song ? getDrillableLines(song.lines) : [];
  const currentLine    = drillableLines[drillIdx] ?? null;
  const clozeWord      = currentLine ? getRandomWord(currentLine) : null;

  function advanceDrill() {
    setAnswer("");
    setFeedback(null);
    setRevealed(false);
    setDrillIdx(i => (i + 1) % Math.max(drillableLines.length, 1));
  }

  function handleCheckCloze() {
    if (!currentLine || !clozeWord) return;
    const correct = normalizeAnswer(answer) === normalizeAnswer(clozeWord);
    setFeedback({ correct, message: correct ? "Correct!" : `The word was: ${clozeWord}` });
  }

  function handleCheckRecall() {
    if (!currentLine) return;
    const correct = normalizeAnswer(answer) === normalizeAnswer(currentLine.ru);
    setFeedback({ correct, message: correct ? "Correct!" : `The line was: ${currentLine.ru}` });
  }

  function handleRevealRate() { advanceDrill(); }

  function handleDrillMarkLearned() {
    if (!currentLine) return;
    markLineAsLearned(currentLine.stanza_index, currentLine.line_index);
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const stanzaMap = new Map();
  (song?.lines ?? []).forEach(line => {
    if (!stanzaMap.has(line.stanza_index)) stanzaMap.set(line.stanza_index, []);
    stanzaMap.get(line.stanza_index).push(line);
  });

  const learnedCount = linesLearned.length;
  const totalDrill   = drillableLines.length;
  const progPct      = totalDrill === 0 ? 0 : learnedCount / totalDrill;

  // Study derived
  const allLines           = song?.lines ?? [];
  const currentStudyLine   = allLines[studyIdx] ?? null;
  const studyTotalLines    = allLines.length;
  const studyDrillableTotal = allLines.filter(l => l.drillable).length;

  // Completion screen values
  const completionCorrect = completedLines.filter(c => c.result === "correct").length;
  const completionPartial = completedLines.filter(c => c.result === "partial").length;
  const completionWrong   = completedLines.filter(c => c.result === "wrong").length;
  const finalScore        = studyDrillableTotal === 0
    ? 0
    : Math.round((studyScorePoints / studyDrillableTotal) * 100);
  const ringDash          = 314;
  const ringOffset        = ringDash - (ringDash * finalScore / 100);

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return <div className={styles.loading}>Loading...</div>;
  if (!song)   return null;

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate("/muzyka")}>← Музыка</button>
        <div className={styles.headerCenter}>
          <div className={styles.headerTitle}>{song.title}</div>
          {song.artist && <div className={styles.headerArtist}>{song.artist}</div>}
        </div>
        <div className={styles.headerRight} />
      </div>

      {/* Mastered banner */}
      {mastered && (
        <div className={styles.masteredBanner}>
          <span>All lines learned!</span>
          <button className={styles.unmarkBtn} onClick={handleUnmarkMastered}>Unmark</button>
        </div>
      )}

      {/* Tabs */}
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === "read"  ? styles.tabActive : ""}`} onClick={() => setTab("read")}>Read</button>
        <button className={`${styles.tab} ${tab === "study" ? styles.tabActive : ""}`} onClick={() => setTab("study")}>Study</button>
        <button className={`${styles.tab} ${tab === "drill" ? styles.tabActive : ""}`} onClick={() => setTab("drill")}>Drill</button>
      </div>

      {/* ── READ TAB ── */}
      {tab === "read" && (
        <div className={styles.lyricsBody}>
          {Array.from(stanzaMap.entries()).map(([si, lines]) => (
            <div key={si} className={styles.stanza}>
              {lines.map((line, li) => (
                <div key={li} className={styles.lyricLine}>
                  <div className={`${styles.lyricRu} ru`}>{line.ru}</div>
                  {line.en && <div className={styles.lyricEn}>{line.en}</div>}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── STUDY TAB ── */}
      {tab === "study" && (
        <>
          {/* Resume prompt */}
          {studyPhase === "resume_prompt" && (
            <div className={styles.resumeWrap}>
              <div className={styles.resumeTitle}>Continue where you left off?</div>
              <div className={styles.resumeSub}>You were on line {studyIdx + 1} of {studyTotalLines}</div>
              <div className={styles.resumeStats}>
                <div className={styles.resumeStat}>
                  <div className={styles.resumeStatNum}>{studyScorePoints}</div>
                  <div className={styles.resumeStatLabel}>points so far</div>
                </div>
                <div className={styles.resumeStat}>
                  <div className={styles.resumeStatNum}>{studyGradedCount}</div>
                  <div className={styles.resumeStatLabel}>lines graded</div>
                </div>
              </div>
              <button className={styles.resumeBtnPrimary} onClick={handleStudyResume}>
                Continue from line {studyIdx + 1}
              </button>
              <button className={styles.resumeBtnSecondary} onClick={handleStudyRestart}>
                Start over
              </button>
            </div>
          )}

          {/* Studying */}
          {studyPhase === "studying" && (
            <div className={styles.studyWrap}>
              {/* Progress bar */}
              <div className={styles.studyProgWrap}>
                <div className={styles.studyProgRow}>
                  <span className={styles.studyProgLabel}>Line {studyIdx + 1} of {studyTotalLines}</span>
                  <span className={styles.studyProgScore}>{studyScorePoints} / {studyGradedCount} so far</span>
                </div>
                <div className={styles.studyProgTrack}>
                  <div
                    className={styles.studyProgFill}
                    style={{ width: `${studyTotalLines === 0 ? 0 : (studyIdx / studyTotalLines) * 100}%` }}
                  />
                </div>
              </div>

              {/* Completed lines stack */}
              <div className={styles.studyStack} ref={stackRef}>
                {completedLines.map((item, i) => (
                  <div
                    key={i}
                    className={`${styles.studyCompletedLine} ${styles[`studyResult_${item.result}`]}`}
                  >
                    <div className={`${styles.studyCompletedRu} ru`}>{item.line.ru}</div>
                    {item.line.en && (
                      <div className={styles.studyCompletedEn}>{item.line.en}</div>
                    )}
                  </div>
                ))}
              </div>

              {/* Active line panel */}
              {currentStudyLine && (
                <div className={styles.studyActivePanel}>
                  {currentStudyLine.drillable ? (
                    <>
                      <div className={`${styles.studyActiveRu} ru`}>{currentStudyLine.ru}</div>
                      {!studyFeedback ? (
                        <>
                          <div className={styles.studyActiveHint}>What do you think this means?</div>
                          <textarea
                            className={styles.studyInput}
                            rows={2}
                            placeholder="Type your translation in English..."
                            value={studyAnswer}
                            onChange={e => setStudyAnswer(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleStudyCheck();
                              }
                            }}
                            disabled={studyGrading}
                          />
                          <button
                            className={styles.studyCheckBtn}
                            onClick={handleStudyCheck}
                            disabled={studyGrading || !studyAnswer.trim()}
                          >
                            {studyGrading ? "Grading..." : "Check"}
                          </button>
                        </>
                      ) : (
                        <>
                          {/* Feedback */}
                          <div className={`${styles.studyFeedback} ${
                            studyFeedback.correct ? styles.studyFeedbackCorrect
                            : studyFeedback.partial ? styles.studyFeedbackPartial
                            : styles.studyFeedbackWrong
                          }`}>
                            <div className={styles.studyFeedbackTag}>
                              {studyFeedback.correct ? "Correct" : studyFeedback.partial ? "Partially right" : "Not quite"}
                            </div>
                            <div className={styles.studyFeedbackText}>{studyFeedback.feedback}</div>
                            {!studyFeedback.correct && studyFeedback.actualEn && (
                              <div className={styles.studyFeedbackActual}>Actual: "{studyFeedback.actualEn}"</div>
                            )}
                          </div>
                          <button
                            className={`${styles.studyNextBtn} ${
                              studyFeedback.correct ? styles.studyNextCorrect
                              : studyFeedback.partial ? styles.studyNextPartial
                              : styles.studyNextWrong
                            }`}
                            onClick={handleStudyNext}
                          >
                            Next line →
                          </button>
                        </>
                      )}
                    </>
                  ) : (
                    /* Non-drillable line */
                    <>
                      <div className={`${styles.studySkipRu} ru`}>{currentStudyLine.ru}</div>
                      {currentStudyLine.en && (
                        <div className={styles.studySkipEn}>{currentStudyLine.en}</div>
                      )}
                      <button className={styles.studySkipBtn} onClick={handleStudyNext}>Next →</button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Completion */}
          {studyPhase === "complete" && (
            <div className={styles.studyComplete}>
              <div className={styles.studyCompleteTitle}>Study complete</div>
              <div className={styles.studyCompleteSub}>You went through all {studyTotalLines} lines</div>

              <div className={styles.studyScoreRing}>
                <svg width="120" height="120" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="var(--c-bg-deep)" strokeWidth="10" />
                  <circle
                    cx="60" cy="60" r="50" fill="none"
                    stroke="var(--c-sage)" strokeWidth="10"
                    strokeDasharray={ringDash}
                    strokeDashoffset={ringOffset}
                    strokeLinecap="round"
                    transform="rotate(-90 60 60)"
                  />
                </svg>
                <div className={styles.studyScoreLabel}>
                  <span className={styles.studyScoreNum}>{finalScore}</span>
                  <span className={styles.studyScorePct}>score</span>
                </div>
              </div>

              <div className={styles.studyBreakdown}>
                <div className={`${styles.studyBreakdownCard} ${styles.studyBreakdownCorrect}`}>
                  <div className={styles.studyBreakdownNum}>{completionCorrect}</div>
                  <div className={styles.studyBreakdownLabel}>Correct</div>
                </div>
                <div className={`${styles.studyBreakdownCard} ${styles.studyBreakdownPartial}`}>
                  <div className={styles.studyBreakdownNum}>{completionPartial}</div>
                  <div className={styles.studyBreakdownLabel}>Partial</div>
                </div>
                <div className={`${styles.studyBreakdownCard} ${styles.studyBreakdownWrong}`}>
                  <div className={styles.studyBreakdownNum}>{completionWrong}</div>
                  <div className={styles.studyBreakdownLabel}>Missed</div>
                </div>
              </div>

              {song.last_study_score != null && (
                <div className={styles.studyPrevScore}>
                  Previous best: <span>{song.last_study_score}</span>
                </div>
              )}

              <button className={styles.studyCompletePrimary} onClick={() => setTab("read")}>
                View lyrics →
              </button>
              <button className={styles.studyCompleteSecondary} onClick={handleStudyRestart}>
                Study again
              </button>
            </div>
          )}
        </>
      )}

      {/* ── DRILL TAB ── */}
      {tab === "drill" && (
        <div className={styles.drillBody}>
          <div className={styles.modePicker}>
            {[
              { id: "cloze",  label: "Cloze",  desc: "Fill the gap",  icon: "✏️" },
              { id: "recall", label: "Recall", desc: "Type the line", icon: "💬" },
              { id: "reveal", label: "Reveal", desc: "Self-rate",     icon: "👁" },
            ].map(m => (
              <button
                key={m.id}
                className={`${styles.modeCard} ${drillMode === m.id ? styles[`modeCard_${m.id}`] : ""}`}
                onClick={() => { setDrillMode(m.id); setAnswer(""); setFeedback(null); setRevealed(false); }}
              >
                <span className={styles.modeIcon}>{m.icon}</span>
                <span className={`${styles.modeName} ${drillMode === m.id ? styles[`modeName_${m.id}`] : ""}`}>{m.label}</span>
                <span className={styles.modeDesc}>{m.desc}</span>
              </button>
            ))}
          </div>

          <div className={styles.progRow}>
            <span>Line {drillIdx + 1} of {totalDrill}</span>
            <span className={styles[`progCount_${drillMode}`]}>{learnedCount} learned</span>
          </div>
          <div className={styles.progTrack}>
            <div
              className={`${styles.progFill} ${styles[`progFill_${drillMode}`]}`}
              style={{ width: `${progPct * 100}%` }}
            />
          </div>

          {totalDrill === 0 && <p className={styles.noDrill}>No drillable lines in this song.</p>}

          {currentLine && (
            <>
              {drillMode === "cloze" && clozeWord && (
                <>
                  <ContextLines
                    lines={song.lines}
                    currentLine={currentLine}
                    focusClass={styles.ctxFocus_cloze}
                    renderFocus={() => {
                      const parts = currentLine.ru.split(clozeWord);
                      return (
                        <>
                          {parts[0]}
                          <span className={styles.clozeBlank} />
                          {parts.slice(1).join(clozeWord)}
                        </>
                      );
                    }}
                  />
                  {!feedback ? (
                    <div className={styles.inputRow}>
                      <input className={styles.drillInput} placeholder="Type the missing word..." value={answer} onChange={e => setAnswer(e.target.value)} onKeyDown={e => e.key === "Enter" && handleCheckCloze()} />
                      <button className={`${styles.checkBtn} ${styles.checkBtn_cloze}`} onClick={handleCheckCloze}>Check</button>
                    </div>
                  ) : (
                    <div className={styles.feedbackRow}>
                      <div className={`${styles.feedbackMsg} ${feedback.correct ? styles.feedbackCorrect : styles.feedbackWrong}`}>{feedback.message}</div>
                      <button className={`${styles.nextBtn} ${styles.checkBtn_cloze}`} onClick={advanceDrill}>Next</button>
                    </div>
                  )}
                  {!isLearned(linesLearned, currentLine.stanza_index, currentLine.line_index) && (
                    <button className={styles.markLearned} onClick={handleDrillMarkLearned}><span className={styles.markCheck}>○</span> Mark as learned</button>
                  )}
                  {isLearned(linesLearned, currentLine.stanza_index, currentLine.line_index) && (
                    <div className={styles.alreadyLearned}>✓ Line learned</div>
                  )}
                </>
              )}

              {drillMode === "recall" && (
                <>
                  <ContextLines lines={song.lines} currentLine={currentLine} focusClass={styles.ctxFocus_recall} renderFocus={() => "???"}  />
                  {!feedback ? (
                    <div className={styles.inputRow}>
                      <input className={styles.drillInput} placeholder="Type this line from memory..." value={answer} onChange={e => setAnswer(e.target.value)} onKeyDown={e => e.key === "Enter" && handleCheckRecall()} />
                      <button className={`${styles.checkBtn} ${styles.checkBtn_recall}`} onClick={handleCheckRecall}>Check</button>
                    </div>
                  ) : (
                    <div className={styles.feedbackRow}>
                      <div className={`${styles.feedbackMsg} ${feedback.correct ? styles.feedbackCorrect : styles.feedbackWrong}`}>{feedback.message}</div>
                      <button className={`${styles.nextBtn} ${styles.checkBtn_recall}`} onClick={advanceDrill}>Next</button>
                    </div>
                  )}
                  {!isLearned(linesLearned, currentLine.stanza_index, currentLine.line_index) && (
                    <button className={styles.markLearned} onClick={handleDrillMarkLearned}><span className={styles.markCheck}>○</span> Mark as learned</button>
                  )}
                  {isLearned(linesLearned, currentLine.stanza_index, currentLine.line_index) && (
                    <div className={styles.alreadyLearned}>✓ Line learned</div>
                  )}
                </>
              )}

              {drillMode === "reveal" && (
                <>
                  <ContextLines lines={song.lines} currentLine={currentLine} focusClass={styles.ctxFocus_reveal} renderFocus={() => "???"} />
                  <div className={styles.revealAnswer}>
                    <div className={`${styles.revealRu} ru`}>{currentLine.ru}</div>
                    {currentLine.en && <div className={styles.revealEn}>{currentLine.en}</div>}
                  </div>
                  {!isLearned(linesLearned, currentLine.stanza_index, currentLine.line_index) ? (
                    <button className={styles.markLearned} onClick={handleDrillMarkLearned}><span className={styles.markCheck}>○</span> Mark as learned</button>
                  ) : (
                    <div className={styles.alreadyLearned}>✓ Line learned</div>
                  )}
                  <div className={styles.rateBtns}>
                    <button className={`${styles.rateBtn} ${styles.rateKnew}`}   onClick={() => handleRevealRate("knew")}>Knew it</button>
                    <button className={`${styles.rateBtn} ${styles.rateAlmost}`} onClick={() => handleRevealRate("almost")}>Almost</button>
                    <button className={`${styles.rateBtn} ${styles.rateMissed}`} onClick={() => handleRevealRate("missed")}>Missed it</button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}