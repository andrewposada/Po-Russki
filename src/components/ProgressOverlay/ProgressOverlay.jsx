// src/components/ProgressOverlay/ProgressOverlay.jsx
import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useProgress }    from "../../context/ProgressContext";
import { CEFR_THRESHOLDS, CEFR_LEVELS } from "../../constants/cefrThresholds";
import { insertLesson } from "../../storage";
import { useAuth } from "../../AuthContext";
import styles from "./ProgressOverlay.module.css";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function trendPillClass(trend, s) {
  if (trend === "improving") return s.trendUp;
  if (trend === "declining") return s.trendDown;
  return s.trendSame;
}

function trendLabel(trend) {
  if (trend === "improving") return "↑ improving";
  if (trend === "declining") return "↓ declining";
  return "→ steady";
}

const MIN_ATTEMPTS = 75;

// ── Lesson Brief Modal ────────────────────────────────────────────────────────
// Inline JSX variable — contains a file input, must not be extracted as component

// ── Banner SVG (desk scene) ───────────────────────────────────────────────────

function BannerScene() {
  return (
    <svg
      className={styles.bannerImage}
      viewBox="0 0 600 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
    >
      <rect width="600" height="200" fill="#1a1410"/>
      <circle cx="470" cy="-10" r="140" fill="#2a2018" opacity="0.8"/>
      <circle cx="470" cy="-10" r="80" fill="#3a3020" opacity="0.6"/>
      <circle cx="420" cy="22" r="1.2" fill="white" opacity="0.4"/>
      <circle cx="465" cy="10" r="0.8" fill="white" opacity="0.3"/>
      <circle cx="510" cy="26" r="1" fill="white" opacity="0.35"/>
      <circle cx="550" cy="14" r="1.2" fill="white" opacity="0.3"/>
      <circle cx="340" cy="18" r="0.9" fill="white" opacity="0.2"/>
      <circle cx="385" cy="34" r="1" fill="white" opacity="0.18"/>
      <circle cx="300" cy="28" r="0.7" fill="white" opacity="0.15"/>
      <circle cx="530" cy="38" r="0.8" fill="white" opacity="0.22"/>
      <rect x="0" y="130" width="600" height="70" fill="#2a1e14"/>
      <rect x="0" y="128" width="600" height="4" fill="#3a2818"/>
      <rect x="130" y="35" width="5" height="97" rx="2" fill="#4a3820"/>
      <path d="M102 35 L158 35 L150 70 L110 70 Z" fill="#d4b46a"/>
      <path d="M102 35 L158 35 L154 44 L106 44 Z" fill="#c8a858" opacity="0.5"/>
      <ellipse cx="132" cy="130" rx="32" ry="6" fill="#3a2818"/>
      <ellipse cx="132" cy="130" rx="150" ry="36" fill="#f5c842" opacity="0.06"/>
      <rect x="200" y="96" width="158" height="36" rx="3" fill="#f0e8d8"/>
      <rect x="200" y="96" width="6" height="36" rx="2" fill="#c8a060"/>
      <line x1="214" y1="108" x2="350" y2="108" stroke="#d0c8b8" strokeWidth="1"/>
      <line x1="214" y1="116" x2="350" y2="116" stroke="#d0c8b8" strokeWidth="1"/>
      <line x1="214" y1="124" x2="336" y2="124" stroke="#d0c8b8" strokeWidth="1"/>
      <text x="218" y="107" fontFamily="Georgia,serif" fontSize="6" fill="#8a7a60" opacity="0.75">Именительный падеж</text>
      <text x="218" y="115" fontFamily="Georgia,serif" fontSize="6" fill="#8a7a60" opacity="0.55">кто? что?</text>
      <rect x="396" y="98" width="34" height="32" rx="4" fill="#3a3028"/>
      <rect x="396" y="98" width="34" height="9" rx="4" fill="#4a4038"/>
      <path d="M430 109 Q445 109 445 120 Q445 131 430 131" stroke="#3a3028" strokeWidth="4.5" strokeLinecap="round" fill="none"/>
      <rect x="458" y="102" width="82" height="13" rx="2" fill="#7a4a4a"/>
      <rect x="462" y="88" width="74" height="13" rx="2" fill="#4a6a7a"/>
      <rect x="466" y="74" width="66" height="13" rx="2" fill="#7a6a4a"/>
    </svg>
  );
}

// ── Empty state illustration ───────────────────────────────────────────────────

function EmptyIllustration() {
  return (
    <svg width="110" height="110" viewBox="0 0 160 160" fill="none" style={{ marginBottom: 18 }}>
      <circle cx="80" cy="80" r="76" fill="#f0ead8" stroke="#e2ddd4" strokeWidth="1"/>
      <rect x="10" y="108" width="140" height="42" rx="4" fill="#e8dfc8"/>
      <rect x="28" y="68" width="50" height="44" rx="4" fill="#ffffff" stroke="#e2ddd4" strokeWidth="1"/>
      <rect x="28" y="68" width="4" height="44" rx="2" fill="#7a9e7e" opacity="0.6"/>
      <line x1="38" y1="80" x2="72" y2="80" stroke="#e2ddd4" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="38" y1="88" x2="72" y2="88" stroke="#e2ddd4" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="38" y1="96" x2="66" y2="96" stroke="#e2ddd4" strokeWidth="1.2" strokeLinecap="round"/>
      <text x="53" y="104" textAnchor="middle" fontFamily="Georgia,serif" fontSize="28" fill="#c8c0a8" opacity="0.5">?</text>
      <path d="M98 68 L122 68 L110 88 L122 112 L98 112 L110 88 Z" fill="none" stroke="#b07c5a" strokeWidth="1.5" strokeLinejoin="round" opacity="0.5"/>
      <path d="M100 70 L120 70 L110 84 Z" fill="#d4b46a" opacity="0.35"/>
      <path d="M105 104 L115 104 L110 96 Z" fill="#d4b46a" opacity="0.5"/>
    </svg>
  );
}

// ── CEFR Progress Section ─────────────────────────────────────────────────────

function CefrProgressSection({ cefrLevel, report, rc }) {
  const currentIdx  = CEFR_LEVELS.indexOf(cefrLevel);
  const nextLevel   = currentIdx < CEFR_LEVELS.length - 1 ? CEFR_LEVELS[currentIdx + 1] : null;
  const thresholds  = nextLevel ? CEFR_THRESHOLDS[nextLevel] : null;
  const currentDef  = CEFR_THRESHOLDS[cefrLevel] ?? CEFR_THRESHOLDS["A1"];

  if (!thresholds) {
    return (
      <div className={styles.section}>
        <p className={styles.sectionLabel}>CEFR level</p>
        <div className={styles.cefrCard}>
          <div className={styles.cefrHeaderRow}>
            <span className={styles.cefrBadge}>{cefrLevel}</span>
            <span className={styles.cefrDesc}>{currentDef.description}</span>
          </div>
          <p className={styles.cefrMaxNote}>You've reached the highest tracked level.</p>
        </div>
      </div>
    );
  }

  // Build progress bars toward next level
  const grammarPct = thresholds.grammar_accuracy > 0
    ? Math.min(100, Math.round(((rc.grammar_accuracy ?? 0) / thresholds.grammar_accuracy) * 100))
    : 100;
  const vocabPct = thresholds.vocab_tier2_plus > 0
    ? Math.min(100, Math.round(((rc.vocab_tier2_plus_count ?? 0) / thresholds.vocab_tier2_plus) * 100))
    : 100;
  const readingPct = thresholds.reading_comp
    ? Math.min(100, Math.round((((rc.reading_comprehension ?? 0)) / thresholds.reading_comp) * 100))
    : null;
  const consistPct = thresholds.consistency_min
    ? Math.min(100, Math.round(((rc.consistency_score ?? 0) / thresholds.consistency_min) * 100))
    : null;

  const listeningPct = thresholds.listening_comp
    ? Math.min(100, Math.round((((rc.listening_comprehension ?? 0)) / thresholds.listening_comp) * 100))
    : null;

  const bars = [
    { label: `Grammar (${rc.grammar_accuracy ?? 0}% / ${thresholds.grammar_accuracy}% needed)`, pct: grammarPct, color: "#b07c5a" },
    { label: `Vocabulary (${rc.vocab_tier2_plus_count ?? 0} / ${thresholds.vocab_tier2_plus} words needed)`, pct: vocabPct, color: "#7a9e7e" },
    readingPct !== null ? { label: `Reading (${rc.reading_data_sufficient ? `${rc.reading_comprehension ?? 0}%` : "no data"} / ${thresholds.reading_comp}% needed)`, pct: rc.reading_data_sufficient ? readingPct : 0, color: "#7aaec8" } : null,
    listeningPct !== null ? { label: `Listening (${rc.listening_data_sufficient ? `${rc.listening_comprehension ?? 0}%` : "no data"} / ${thresholds.listening_comp}% needed)`, pct: rc.listening_data_sufficient ? listeningPct : 0, color: "#9a7ec8" } : null,
    consistPct !== null ? { label: `Consistency (${rc.consistency_score ?? 0} / ${thresholds.consistency_min} needed)`, pct: consistPct, color: "#6a8ec8" } : null,
  ].filter(Boolean);

  const advancementReady = !!report.cefr_advance_to;

  return (
    <div className={styles.section}>
      <p className={styles.sectionLabel}>CEFR level</p>
      <div className={styles.cefrCard}>
        <div className={styles.cefrHeaderRow}>
          <span className={styles.cefrBadge}>{cefrLevel}</span>
          <span className={styles.cefrArrow}>→</span>
          <span className={`${styles.cefrBadge} ${styles.cefrBadgeNext}`}>{nextLevel}</span>
        </div>

        {report.cefr_commentary && (
          <p className={styles.cefrCommentary}>{report.cefr_commentary}</p>
        )}

        <div className={styles.cefrBars}>
          {bars.map((bar, i) => (
            <div key={i} className={styles.cefrBarRow}>
              <span className={styles.cefrBarLabel}>{bar.label}</span>
              <div className={styles.cefrBarTrack}>
                <div
                  className={styles.cefrBarFill}
                  style={{ width: `${bar.pct}%`, background: bar.color }}
                />
              </div>
            </div>
          ))}
        </div>

        {advancementReady && (
          <div className={styles.cefrAdvanceBanner}>
            🎯 Your data shows you may be ready to advance to {nextLevel}. Keep it up!
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ProgressOverlay({ onClose }) {
  const navigate  = useNavigate();
  const { user }  = useAuth();
  const { latestReport, checkComplete, newAttemptCount, cefrLevel } = useProgress();

  // Lesson brief modal state — inline to avoid focus issues
  const [briefOpen,    setBriefOpen]    = useState(false);
  const [briefTitle,   setBriefTitle]   = useState("");
  const [briefFocus,   setBriefFocus]   = useState("");
  const [briefPrompt,  setBriefPrompt]  = useState("");
  const [copied,       setCopied]       = useState(false);
  const [importStatus, setImportStatus] = useState(null); // null | "success" | "error"
  const [importedLesson, setImportedLesson] = useState(null); // parsed lesson JSON
  const [importing,    setImporting]    = useState(false);
  const fileInputRef = useRef(null);

  const hasReport = !!latestReport;
  const report    = latestReport ?? {};
  const rc        = report.report_card ?? {};

  // ── Backdrop dismiss ──────────────────────────────────────────────────────

  function handleBackdropClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  // ── Lesson brief modal ────────────────────────────────────────────────────

  function openBrief(title, focus, prompt) {
    setBriefTitle(title);
    setBriefFocus(focus);
    setBriefPrompt(prompt);
    setCopied(false);
    setImportStatus(null);
    setImportedLesson(null);
    setBriefOpen(true);
  }

  function closeBrief() {
    setBriefOpen(false);
    setImportStatus(null);
    setImportedLesson(null);
  }

  async function handleCopy() {
    try { await navigator.clipboard.writeText(briefPrompt); } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    readImportFile(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    readImportFile(file);
  }

  function readImportFile(file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        setImportedLesson(parsed);
        setImportStatus("success");
      } catch {
        setImportStatus("error");
        setImportedLesson(null);
      }
    };
    reader.readAsText(file);
  }

  async function handleImportAndNavigate() {
    if (!importedLesson || !user?.uid || importing) return;
    setImporting(true);
    try {
      await insertLesson(user.uid, importedLesson);
      closeBrief();
      onClose();
      navigate("/lessons");
    } catch (err) {
      console.error("Lesson import failed:", err);
      setImportStatus("error");
    } finally {
      setImporting(false);
    }
  }

  // ── Drill navigation ──────────────────────────────────────────────────────

  function handleDrill(route) {
    onClose();
    navigate(route);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  // The lesson brief modal — inline JSX variable (contains file input)
  const briefModal = briefOpen && (
    <div className={styles.modalBackdrop} onClick={e => e.target === e.currentTarget && closeBrief()}>
      <div className={styles.briefModal}>
        <div className={styles.briefModalHeader}>
          <h3 className={styles.briefModalTitle}>{briefTitle}</h3>
          <button className={styles.briefModalClose} onClick={closeBrief}>✕</button>
        </div>
        <p className={styles.briefModalFocus}>{briefFocus}</p>

        <p className={styles.briefModalSubLabel}>Prompt for AI lesson generation</p>
        <textarea
          className={styles.briefPromptTextarea}
          value={briefPrompt}
          readOnly
        />

        <div className={styles.briefDivider} />

        <p className={styles.briefModalSubLabel}>Import generated lesson</p>
        <p className={styles.briefImportHint}>
          After generating your lesson with Claude Opus, paste the JSON here to import it directly into your lessons.
        </p>

        {importStatus === null && (
          <div
            className={styles.importDrop}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
          >
            <p className={styles.importDropText}>Click to select lesson JSON file</p>
            <p className={styles.importDropSub}>or drag and drop</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{ display: "none" }}
              onChange={handleFileSelect}
            />
          </div>
        )}

        {importStatus === "success" && (
          <div className={styles.importSuccess}>
            <span>✓</span>
            <span>Lesson ready to import — tap "Go to lesson" to add it to your library.</span>
          </div>
        )}

        {importStatus === "error" && (
          <div className={styles.importError}>
            <span>✕</span>
            <span>Invalid file — please check it's a valid lesson JSON and try again.</span>
          </div>
        )}

        <div className={styles.briefActions}>
          <button
            className={`${styles.btnCopy} ${copied ? styles.btnCopied : ""}`}
            onClick={handleCopy}
          >
            {copied ? "✓ Copied!" : "Copy prompt"}
          </button>
          {importStatus === "success" && (
            <button
              className={styles.btnGoToLesson}
              onClick={handleImportAndNavigate}
              disabled={importing}
            >
              {importing ? "Importing…" : "Go to lesson →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className={styles.backdrop} onClick={handleBackdropClick}>
        <div className={styles.modal}>

          {/* ── Banner ── */}
          <div className={styles.banner}>
            <BannerScene />
            <div className={styles.bannerFade} />
            <div className={styles.bannerTopBar}>
              <span className={styles.bannerEyebrow}>Progress report</span>
              {hasReport && rc.overall_grade ? (
                <span className={styles.bannerDatePill}>
                  {formatDate(latestReport.generated_at ?? report.generated_at)}
                </span>
              ) : (
                <button className={styles.closeBtn} onClick={onClose}>✕</button>
              )}
            </div>
            {hasReport && (
              <div className={styles.bannerContent}>
                <div className={styles.gradeBadge}>
                  <span className={styles.gradeLetter}>{rc.overall_grade ?? "—"}</span>
                </div>
                <div className={styles.gradeMeta}>
                  {rc.trend && (
                    <div className={styles.gradeTrend}>
                      {rc.trend === "improving" ? "↑" : rc.trend === "declining" ? "↓" : "→"} {rc.trend}
                    </div>
                  )}
                  {rc.level_estimate && (
                    <span className={styles.gradeLevel}>{rc.level_estimate}</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Body ── */}
          <div className={styles.body}>

            {/* Close button when we have a report (moves to body so banner stays clean) */}
            {hasReport && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
                <button className={styles.briefModalClose} onClick={onClose}>✕</button>
              </div>
            )}

            {/* ── REPORT STATE ── */}
            {hasReport && (
              <>
                {/* Stat row */}
                <div className={styles.statRow}>
                  {rc.grammar_accuracy != null && (
                    <div className={styles.statPill}>
                      <span className={styles.statVal}>{rc.grammar_accuracy}%</span>
                      <span className={styles.statLbl}>Grammar</span>
                      <div className={styles.statBar}>
                        <div className={styles.statBarFill} style={{ width: `${rc.grammar_accuracy}%`, background: "#b07c5a" }} />
                      </div>
                    </div>
                  )}
                  {rc.vocab_retention != null && (
                    <div className={styles.statPill}>
                      <span className={styles.statVal}>{rc.vocab_retention}%</span>
                      <span className={styles.statLbl}>Vocab</span>
                      <div className={styles.statBar}>
                        <div className={styles.statBarFill} style={{ width: `${rc.vocab_retention}%` }} />
                      </div>
                    </div>
                  )}
                  <div className={styles.statPill}>
                    {rc.reading_data_sufficient && rc.reading_comprehension != null ? (
                      <>
                        <span className={styles.statVal}>{rc.reading_comprehension}%</span>
                        <span className={styles.statLbl}>Reading</span>
                        <div className={styles.statBar}>
                          <div className={styles.statBarFill} style={{ width: `${rc.reading_comprehension}%`, background: "#7aaec8" }} />
                        </div>
                      </>
                    ) : (
                      <>
                        <span className={styles.statVal} style={{ fontSize: 13, color: "var(--c-text-light)" }}>—</span>
                        <span className={styles.statLbl}>Reading</span>
                        <span className={styles.statNote}>needs 3+ sessions</span>
                      </>
                    )}
                  </div>
                  <div className={styles.statPill}>
                    {rc.listening_data_sufficient && rc.listening_comprehension != null ? (
                      <>
                        <span className={styles.statVal}>{rc.listening_comprehension}%</span>
                        <span className={styles.statLbl}>Listening</span>
                        <div className={styles.statBar}>
                          <div className={styles.statBarFill} style={{ width: `${rc.listening_comprehension}%`, background: "#9a7ec8" }} />
                        </div>
                      </>
                    ) : (
                      <>
                        <span className={styles.statVal} style={{ fontSize: 13, color: "var(--c-text-light)" }}>—</span>
                        <span className={styles.statLbl}>Listening</span>
                        <span className={styles.statNote}>needs 3+ sessions</span>
                      </>
                    )}
                  </div>
                  {rc.consistency_score != null && (
                    <div className={styles.statPill}>
                      <span className={styles.statVal}>{rc.consistency_score}/10</span>
                      <span className={styles.statLbl}>Streak</span>
                      <div className={styles.statBar}>
                        <div className={styles.statBarFill} style={{ width: `${rc.consistency_score * 10}%`, background: "#9a7ec8" }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Teacher's note */}
                {report.summary && (
                  <div className={styles.section}>
                    <p className={styles.sectionLabel}>Teacher's note</p>
                    <div className={styles.summaryBlock}>
                      <p className={styles.summaryText}>"{report.summary}"</p>
                    </div>
                  </div>
                )}

                {/* Strengths */}
                {report.strengths?.length > 0 && (
                  <div className={styles.section}>
                    <p className={styles.sectionLabel}>Strengths</p>
                    <div className={styles.strengthsList}>
                      {report.strengths.map((s, i) => (
                        <div key={i} className={styles.strengthCard}>
                          <p className={styles.strengthTopic}>{s.topic}</p>
                          <p className={styles.strengthComment}>{s.comment}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Challenges */}
                {report.challenges?.length > 0 && (
                  <div className={styles.section}>
                    <p className={styles.sectionLabel}>Challenges</p>
                    <div className={styles.challengesList}>
                      {report.challenges.map((c, i) => (
                        <div key={i} className={styles.challengeCard}>
                          <p className={styles.challengeTopic}>{c.topic}</p>
                          <p className={styles.challengeComment}>{c.comment}</p>
                          <div className={styles.challengeActions}>
                            {c.action?.route && (
                              <button
                                className={styles.btnDrill}
                                onClick={() => handleDrill(c.action.route)}
                              >
                                ▶ {c.action.label ?? "Drill it now"}
                              </button>
                            )}
                            {c.lesson_brief && (
                              <button
                                className={styles.btnBrief}
                                onClick={() => openBrief(
                                  c.lesson_brief.title,
                                  c.lesson_brief.focus,
                                  c.lesson_brief.prompt_for_opus,
                                )}
                              >
                                + Generate lesson brief
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Struggling words */}
                {report.struggling_words?.length > 0 && (
                  <div className={styles.section}>
                    <p className={styles.sectionLabel}>Words to revisit</p>
                    <div className={styles.wordsRow}>
                      {report.struggling_words.map((w, i) => (
                        <span key={i} className={styles.wordChip}>{w}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reading note */}
                {report.reading_note && (
                  <div className={styles.section}>
                    <div className={styles.readingNote}>
                      <span style={{ fontSize: 14, flexShrink: 0 }}>📖</span>
                      <p className={styles.readingNoteText}>{report.reading_note}</p>
                    </div>
                  </div>
                )}

                {/* Listening note */}
                {report.listening_note && (
                  <div className={styles.section}>
                    <div className={styles.readingNote}>
                      <span style={{ fontSize: 14, flexShrink: 0 }}>🎧</span>
                      <p className={styles.readingNoteText}>{report.listening_note}</p>
                    </div>
                  </div>
                )}

                {/* Next milestone */}
                {report.next_milestone && (
                  <div className={`${styles.section} ${styles.milestone}`}>
                    <p className={styles.milestoneLabel}>Next milestone</p>
                    <p className={styles.milestoneText}>"{report.next_milestone}"</p>
                  </div>
                )}

                {/* CEFR progress */}
                <CefrProgressSection
                  cefrLevel={cefrLevel}
                  report={report}
                  rc={rc}
                />

                {/* History — from prior_reports in the report JSON */}
                {report.prior_reports?.length > 0 && (
                  <div className={styles.historySection}>
                    <p className={styles.sectionLabel}>Past reports</p>
                    <div className={styles.historyList}>
                      {report.prior_reports.map((r, i) => {
                        const prc = r.report_card ?? {};
                        return (
                          <div key={i} className={styles.historyRow}>
                            <span className={styles.historyGrade}>{prc.overall_grade ?? "—"}</span>
                            <div className={styles.historyInfo}>
                              <p className={styles.historyDate}>{formatDate(r.generated_at)}</p>
                              <p className={styles.historyDesc}>{r.summary?.slice(0, 100)}{r.summary?.length > 100 ? "…" : ""}</p>
                            </div>
                            {prc.trend && (
                              <span className={`${styles.trendPill} ${trendPillClass(prc.trend, styles)}`}>
                                {trendLabel(prc.trend)}
                              </span>
                            )}
                            <span className={styles.historyChevron}>›</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── EMPTY STATE ── */}
            {!hasReport && checkComplete && (
              <div className={styles.emptyWrap}>
                <EmptyIllustration />
                <h2 className={styles.emptyTitle}>Report card not ready yet</h2>
                <p className={styles.emptySub}>
                  Keep practicing — we need a bit more data to build you a meaningful report.
                </p>

                <div className={styles.emptyStats}>
                  <div className={styles.emptyStat}>
                    <span className={styles.emptyStatVal}>{newAttemptCount}</span>
                    <span className={styles.emptyStatLbl}>Attempts logged</span>
                  </div>
                </div>

                <div className={styles.towardReport}>
                  <div className={styles.towardLabel}>
                    <span>Progress toward first report</span>
                    <span className={styles.towardLabelCount}>{newAttemptCount} / {MIN_ATTEMPTS}</span>
                  </div>
                  <div className={styles.towardBar}>
                    <div
                      className={styles.towardFill}
                      style={{ width: `${Math.min(100, (newAttemptCount / MIN_ATTEMPTS) * 100)}%` }}
                    />
                  </div>
                  <p className={styles.towardNote}>
                    Complete {Math.max(0, MIN_ATTEMPTS - newAttemptCount)} more practice attempts across at least 3 topics to unlock your first AI report card.
                  </p>
                </div>
              </div>
            )}

            {/* Loading state — check not yet complete */}
            {!hasReport && !checkComplete && (
              <div className={styles.emptyWrap}>
                <p style={{ color: "var(--c-text-light)", fontSize: 13, paddingTop: 40 }}>
                  Checking your progress…
                </p>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Lesson brief modal — rendered outside overlay div to avoid z-index issues */}
      {briefModal}
    </>
  );
}