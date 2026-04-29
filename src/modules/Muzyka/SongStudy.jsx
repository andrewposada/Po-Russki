// src/modules/Muzyka/SongStudy.jsx
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../AuthContext";
import { getSongs, updateSongLearned, updateSongMastered, deleteSong } from "../../storage";
import styles from "./SongStudy.module.css";

// ── Drill helpers ─────────────────────────────────────────────────────────────

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

// Build flat ordered array of drillable lines from the full lines array
function getDrillableLines(lines) {
  return lines.filter(l => l.drillable);
}

// ── Context line display — shows prev, focus, next ───────────────────────────

function ContextLines({ lines, currentLine, focusClass, renderFocus }) {
  const allLines    = lines.filter(l => l.drillable);
  const currentIdx  = allLines.findIndex(
    l => l.stanza_index === currentLine.stanza_index && l.line_index === currentLine.line_index
  );
  const prev = currentIdx > 0 ? allLines[currentIdx - 1] : null;
  const next = currentIdx < allLines.length - 1 ? allLines[currentIdx + 1] : null;

  return (
    <div className={styles.ctxWrap}>
      {prev
        ? <div className={styles.ctxLine}>{prev.ru}</div>
        : <div className={styles.ctxLine}>&nbsp;</div>
      }
      <div className={`${styles.ctxFocus} ${focusClass}`}>{renderFocus()}</div>
      {next
        ? <div className={styles.ctxLine}>{next.ru}</div>
        : <div className={styles.ctxLine}>&nbsp;</div>
      }
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SongStudy() {
  const { songId }  = useParams();
  const { user }    = useAuth();
  const navigate    = useNavigate();

  const [song,           setSong]           = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [tab,            setTab]            = useState("read"); // read | drill
  const [drillMode,      setDrillMode]      = useState("cloze"); // cloze | recall | reveal
  const [linesLearned,   setLinesLearned]   = useState([]);
  const [mastered,       setMastered]       = useState(false);

  // Drill state
  const [drillIdx,       setDrillIdx]       = useState(0);
  const [answer,         setAnswer]         = useState("");
  const [feedback,       setFeedback]       = useState(null); // null | { correct, message }
  const [revealed,       setRevealed]       = useState(false);

  // Explain state — keyed by stanza_index
  const [explaining,     setExplaining]     = useState({}); // { [si]: "loading"|"done" }
  const [explanations,   setExplanations]   = useState({}); // { [si]: string }

  // Stale closure guard
  const linesLearnedRef = useRef(linesLearned);
  useEffect(() => { linesLearnedRef.current = linesLearned; }, [linesLearned]);
  const masteredRef = useRef(mastered);
  useEffect(() => { masteredRef.current = mastered; }, [mastered]);

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;
    (async () => {
      const all  = await getSongs(user.uid);
      const found = all.find(s => s.id === songId);
      if (!found) { navigate("/muzyka"); return; }
      setSong(found);
      setLinesLearned(found.lines_learned ?? []);
      setMastered(found.mastered ?? false);
      setLoading(false);
    })();
  }, [user, songId, navigate]);

  // ── Persist lines_learned + mastered ─────────────────────────────────────

  const persistLearned = useCallback(async (newLearned, newMastered) => {
    if (!user || !songId) return;
    try {
      await updateSongLearned(user.uid, songId, newLearned, newMastered);
    } catch (e) {
      console.error("persistLearned:", e);
    }
  }, [user, songId]);

  // ── Mark a line as learned ────────────────────────────────────────────────

  function markLineAsLearned(stanzaIndex, lineIndex) {
    if (isLearned(linesLearnedRef.current, stanzaIndex, lineIndex)) return;

    const newLearned = [
      ...linesLearnedRef.current,
      { stanza_index: stanzaIndex, line_index: lineIndex },
    ];

    const drillable  = (song?.lines ?? []).filter(l => l.drillable);
    const newMastered = newLearned.length >= drillable.length;

    setLinesLearned(newLearned);
    setMastered(newMastered);
    persistLearned(newLearned, newMastered);
  }

  // ── Unmark mastered ───────────────────────────────────────────────────────

  async function handleUnmarkMastered() {
    setMastered(false);
    try {
      await updateSongMastered(user.uid, songId, false);
    } catch (e) {
      console.error(e);
    }
  }

  // ── Explain stanza ────────────────────────────────────────────────────────

  async function handleExplain(stanzaIndex, stanzaLines) {
    if (explanations[stanzaIndex]) return; // already loaded
    setExplaining(prev => ({ ...prev, [stanzaIndex]: "loading" }));

    const stanzaText = stanzaLines.map(l => l.ru).join("\n");
    try {
      const res  = await fetch("/api/vocab-grade", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ mode: "explain_stanza", stanza_text: stanzaText }),
      });
      const data = await res.json();
      setExplanations(prev => ({ ...prev, [stanzaIndex]: data.explanation ?? "No explanation available." }));
    } catch {
      setExplanations(prev => ({ ...prev, [stanzaIndex]: "Could not load explanation." }));
    } finally {
      setExplaining(prev => ({ ...prev, [stanzaIndex]: "done" }));
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

  function handleRevealRate(rating) {
    // "knew" / "almost" / "missed" — no auto-marking. User must tap "Mark as learned."
    advanceDrill();
  }

  function handleDrillMarkLearned() {
    if (!currentLine) return;
    markLineAsLearned(currentLine.stanza_index, currentLine.line_index);
  }

  // ── Grouped stanzas for read tab ──────────────────────────────────────────

  const stanzaMap = new Map();
  (song?.lines ?? []).forEach(line => {
    if (!stanzaMap.has(line.stanza_index)) stanzaMap.set(line.stanza_index, []);
    stanzaMap.get(line.stanza_index).push(line);
  });

  const learnedCount = linesLearned.length;
  const totalDrill   = drillableLines.length;
  const progPct      = totalDrill === 0 ? 0 : learnedCount / totalDrill;

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
        <button className={`${styles.tab} ${tab === "read" ? styles.tabActive : ""}`} onClick={() => setTab("read")}>Read</button>
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
              <div className={styles.explainRow}>
                <button
                  className={styles.explainBtn}
                  onClick={() => handleExplain(si, lines)}
                  disabled={explaining[si] === "loading"}
                >
                  {explaining[si] === "loading" ? "Loading..." : "Explain this stanza"}
                </button>
              </div>
              {explanations[si] && (
                <div className={styles.explainCard}>{explanations[si]}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── DRILL TAB ── */}
      {tab === "drill" && (
        <div className={styles.drillBody}>

          {/* Mode picker */}
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

          {/* Progress */}
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

          {totalDrill === 0 && (
            <p className={styles.noDrill}>No drillable lines in this song.</p>
          )}

          {currentLine && (
            <>
              {/* ── CLOZE ── */}
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
                      <input
                        className={styles.drillInput}
                        placeholder="Type the missing word..."
                        value={answer}
                        onChange={e => setAnswer(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleCheckCloze()}
                      />
                      <button className={`${styles.checkBtn} ${styles.checkBtn_cloze}`} onClick={handleCheckCloze}>Check</button>
                    </div>
                  ) : (
                    <div className={styles.feedbackRow}>
                      <div className={`${styles.feedbackMsg} ${feedback.correct ? styles.feedbackCorrect : styles.feedbackWrong}`}>
                        {feedback.message}
                      </div>
                      <button className={`${styles.nextBtn} ${styles.checkBtn_cloze}`} onClick={advanceDrill}>Next</button>
                    </div>
                  )}
                  {!isLearned(linesLearned, currentLine.stanza_index, currentLine.line_index) && (
                    <button className={styles.markLearned} onClick={handleDrillMarkLearned}>
                      <span className={styles.markCheck}>○</span> Mark as learned
                    </button>
                  )}
                  {isLearned(linesLearned, currentLine.stanza_index, currentLine.line_index) && (
                    <div className={styles.alreadyLearned}>✓ Line learned</div>
                  )}
                </>
              )}

              {/* ── RECALL ── */}
              {drillMode === "recall" && (
                <>
                  <ContextLines
                    lines={song.lines}
                    currentLine={currentLine}
                    focusClass={styles.ctxFocus_recall}
                    renderFocus={() => "???"}
                  />
                  {!feedback ? (
                    <div className={styles.inputRow}>
                      <input
                        className={styles.drillInput}
                        placeholder="Type this line from memory..."
                        value={answer}
                        onChange={e => setAnswer(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleCheckRecall()}
                      />
                      <button className={`${styles.checkBtn} ${styles.checkBtn_recall}`} onClick={handleCheckRecall}>Check</button>
                    </div>
                  ) : (
                    <div className={styles.feedbackRow}>
                      <div className={`${styles.feedbackMsg} ${feedback.correct ? styles.feedbackCorrect : styles.feedbackWrong}`}>
                        {feedback.message}
                      </div>
                      <button className={`${styles.nextBtn} ${styles.checkBtn_recall}`} onClick={advanceDrill}>Next</button>
                    </div>
                  )}
                  {!isLearned(linesLearned, currentLine.stanza_index, currentLine.line_index) && (
                    <button className={styles.markLearned} onClick={handleDrillMarkLearned}>
                      <span className={styles.markCheck}>○</span> Mark as learned
                    </button>
                  )}
                  {isLearned(linesLearned, currentLine.stanza_index, currentLine.line_index) && (
                    <div className={styles.alreadyLearned}>✓ Line learned</div>
                  )}
                </>
              )}

              {/* ── REVEAL ── */}
              {drillMode === "reveal" && (
                <>
                  <ContextLines
                    lines={song.lines}
                    currentLine={currentLine}
                    focusClass={styles.ctxFocus_reveal}
                    renderFocus={() => "???"}
                  />
                  <div className={styles.revealAnswer}>
                    <div className={`${styles.revealRu} ru`}>{currentLine.ru}</div>
                    {currentLine.en && <div className={styles.revealEn}>{currentLine.en}</div>}
                  </div>
                  {!isLearned(linesLearned, currentLine.stanza_index, currentLine.line_index) ? (
                    <button className={styles.markLearned} onClick={handleDrillMarkLearned}>
                      <span className={styles.markCheck}>○</span> Mark as learned
                    </button>
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