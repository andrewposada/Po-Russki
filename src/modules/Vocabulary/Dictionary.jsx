// src/modules/Vocabulary/Dictionary.jsx
// Мой словарь — full word bank browser with filtering, stats, and SRS management.

import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate }       from "react-router-dom";
import { useAuth }           from "../../AuthContext";
import { useWordBank }       from "../../context/WordBankContext";
import { getWords, updateWordSrs } from "../../storage";
import styles                from "./Dictionary.module.css";

// ── Constants ────────────────────────────────────────────────────────────────

const TIER_META = [
  { value: 0, label: "Tier 0", exerciseLabel: "Matching",          bg: "#D3D1C7", color: "#444441" },
  { value: 1, label: "Tier 1", exerciseLabel: "Multiple choice",   bg: "#B5D4F4", color: "#0C447C" },
  { value: 2, label: "Tier 2", exerciseLabel: "Translate RU→EN",   bg: "#C0DD97", color: "#27500A" },
  { value: 3, label: "Tier 3", exerciseLabel: "Cloze",             bg: "#FAC775", color: "#633806" },
  { value: 4, label: "Tier 4", exerciseLabel: "Translate EN→RU",   bg: "#F4C0D1", color: "#72243E" },
  { value: 5, label: "Tier 5", exerciseLabel: "Sentence builder",  bg: "#CECBF6", color: "#3C3489" },
  { value: 6, label: "Mastered", exerciseLabel: "Sentence builder",bg: "#9FE1CB", color: "#085041" },
];

const POS_SECTIONS = [
  { key: "verb",        label: "Глаголы",          labelEn: "Verbs"       },
  { key: "noun",        label: "Существительные",  labelEn: "Nouns"       },
  { key: "adjective",   label: "Прилагательные",   labelEn: "Adjectives"  },
  { key: "adverb",      label: "Наречия",           labelEn: "Adverbs"     },
  { key: "other",       label: "Другое",            labelEn: "Other"       },
];

// Normalise part_of_speech values from DB into section keys
function normalisePOS(pos) {
  if (!pos) return "other";
  const p = pos.toLowerCase();
  if (p.includes("verb"))      return "verb";
  if (p.includes("noun"))      return "noun";
  if (p.includes("adj"))       return "adjective";
  if (p.includes("adv"))       return "adverb";
  return "other";
}

// Cyrillic-aware alphabetical sort
function cyrillicSort(a, b) {
  return (a.word ?? "").localeCompare(b.word ?? "", "ru");
}

// Format relative time for "last studied"
function relativeTime(dateStr) {
  if (!dateStr) return "never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 30)  return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 8)  return `${weeks}wk ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function formatDue(dateStr, reviewCount) {
  if (!reviewCount || reviewCount === 0) return { text: "not started", color: "var(--color-text-tertiary)" };
  if (!dateStr) return { text: "due now", color: "#E24B4A" };
  const diff = new Date(dateStr).getTime() - Date.now();
  const days = Math.ceil(diff / 86400000);
  if (days <= 0)  return { text: `${Math.abs(days)}d overdue`, color: "#E24B4A" };
  if (days === 1) return { text: "tomorrow",   color: "#185FA5" };
  if (days < 7)   return { text: `in ${days}d`, color: "#185FA5" };
  if (days < 30)  return { text: `in ${Math.floor(days/7)}wk`, color: "var(--color-text-secondary)" };
  return { text: `in ${Math.floor(days/30)}mo`, color: "var(--color-text-secondary)" };
}

function getTierMeta(word) {
  if (word.is_mastered) return TIER_META[6];
  return TIER_META[Math.min(word.tier ?? 0, 5)];
}

// Weekly bar chart data from words' updated_at
function buildWeeklyBars(words) {
  const days = Array(7).fill(0);
  const now = new Date();
  words?.forEach(w => {
    if (!w.updated_at || !w.review_count) return;
    const diff = Math.floor((now - new Date(w.updated_at)) / 86400000);
    if (diff >= 0 && diff < 7) days[6 - diff]++;
  });
  return days;
}

const DAY_LABELS = ["M","T","W","T","F","S","S"];

// ── Component ────────────────────────────────────────────────────────────────

export default function Dictionary() {
  const navigate            = useNavigate();
  const { user }            = useAuth();
  const { words, setWords } = useWordBank();

  const [search,      setSearch]      = useState("");
  const [posFilter,   setPosFilter]   = useState("all");
  const [tierFilter,  setTierFilter]  = useState("all");
  const [dueOnly,     setDueOnly]     = useState(false);
  const [fadingOnly,  setFadingOnly]  = useState(false);
  const [openTierMenu, setOpenTierMenu] = useState(null); // wordId or null
  const [playingId,   setPlayingId]   = useState(null);

  // Load words if not yet in context
  useEffect(() => {
    if (!user || words !== null) return;
    getWords(user.uid).then(fetched => setWords(fetched ?? []));
  }, [user, words, setWords]);

  // Close tier dropdown on outside click
  useEffect(() => {
    if (!openTierMenu) return;
    const handler = (e) => {
      if (!e.target.closest("[data-tier-dropdown]")) setOpenTierMenu(null);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [openTierMenu]);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const totalWords    = words?.length ?? 0;
  const masteredCount = words?.filter(w => w.is_mastered).length ?? 0;
  const totalReviews  = words?.reduce((s, w) => s + (w.review_count ?? 0), 0) ?? 0;
  const fadingWords   = useMemo(() => {
    if (!words) return [];
    const cutoff = Date.now() - 30 * 86400000;
    return words.filter(w =>
      w.review_count > 0 &&
      !w.is_mastered &&
      w.updated_at &&
      new Date(w.updated_at).getTime() < cutoff
    );
  }, [words]);

  const weeklyBars   = useMemo(() => buildWeeklyBars(words), [words]);
  const weeklyMax    = Math.max(...weeklyBars, 1);

  // ── Filtering + grouping ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!words) return [];
    return words.filter(w => {
      if (search) {
        const q = search.toLowerCase();
        if (!w.word?.toLowerCase().includes(q) && !w.translation?.toLowerCase().includes(q)) return false;
      }
      if (posFilter !== "all" && normalisePOS(w.part_of_speech) !== posFilter) return false;
      if (tierFilter !== "all") {
        if (tierFilter === "mastered" && !w.is_mastered) return false;
        if (tierFilter === "0-2" && (w.is_mastered || (w.tier ?? 0) > 2)) return false;
        if (tierFilter === "3-5" && (w.is_mastered || (w.tier ?? 0) < 3)) return false;
      }
      if (dueOnly) {
        const due = !w.next_review_at || new Date(w.next_review_at) <= new Date();
        if (!due || w.is_mastered) return false;
      }
      if (fadingOnly) {
        const cutoff = Date.now() - 30 * 86400000;
        const fading = w.review_count > 0 && !w.is_mastered && w.updated_at &&
          new Date(w.updated_at).getTime() < cutoff;
        if (!fading) return false;
      }
      return true;
    });
  }, [words, search, posFilter, tierFilter, dueOnly, fadingOnly]);

  const grouped = useMemo(() => {
    const map = {};
    POS_SECTIONS.forEach(s => { map[s.key] = []; });
    filtered.forEach(w => {
      const key = normalisePOS(w.part_of_speech);
      map[key].push(w);
    });
    POS_SECTIONS.forEach(s => { map[s.key].sort(cyrillicSort); });
    return map;
  }, [filtered]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handlePrioritize = useCallback(async (word) => {
    if (!user) return;
    const now = new Date().toISOString();
    await updateWordSrs(user.uid, word.id, {
      next_review_at: now,
      interval_days:  word.interval_days  ?? 1,
      ease_factor:    word.ease_factor    ?? 2.5,
      review_count:   word.review_count   ?? 0,
      tier:           word.tier           ?? 0,
      tier_streak:    word.tier_streak    ?? 0,
    });
    setWords(prev => prev.map(w =>
      w.id === word.id ? { ...w, next_review_at: now } : w
    ));
  }, [user, setWords]);

  const handleTierChange = useCallback(async (word, newTierValue) => {
    if (!user) return;
    const isMastered = newTierValue === 6;
    const tierVal    = isMastered ? (word.tier ?? 0) : newTierValue;
    await updateWordSrs(user.uid, word.id, {
      next_review_at: word.next_review_at,
      interval_days:  word.interval_days  ?? 1,
      ease_factor:    word.ease_factor    ?? 2.5,
      review_count:   word.review_count   ?? 0,
      tier:           tierVal,
      tier_streak:    0,
      is_mastered:    isMastered,
    });
    setWords(prev => prev.map(w =>
      w.id === word.id ? { ...w, tier: tierVal, tier_streak: 0, is_mastered: isMastered } : w
    ));
    setOpenTierMenu(null);
  }, [user, setWords]);

  const handleFadingSession = useCallback(() => {
    // Prioritise all fading words then go to session
    Promise.all(fadingWords.map(w => handlePrioritize(w))).then(() => {
      navigate("/vocabulary/session");
    });
  }, [fadingWords, handlePrioritize, navigate]);

  const playWord = useCallback(async (wordText, wordId) => {
    if (playingId === wordId) return;
    setPlayingId(wordId);
    try {
      const res  = await fetch("/api/tts", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text: wordText }),
      });
      const { audioContent } = await res.json();
      const audio = new Audio(`data:audio/mp3;base64,${audioContent}`);
      audio.onended = () => setPlayingId(null);
      audio.play();
    } catch {
      setPlayingId(null);
    }
  }, [playingId]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (!words) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>Loading your dictionary…</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Мой словарь</h1>
          <p className={styles.subtitle}>{totalWords} words in your bank</p>
        </div>
        <button className={styles.backLink} onClick={() => navigate("/vocabulary")}>
          ← Словарь
        </button>
      </div>

      {/* Stats row */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Due today</div>
          <div className={styles.statValue} style={{ color: "#185FA5" }}>
            {words.filter(w => !w.is_mastered && (!w.next_review_at || new Date(w.next_review_at) <= new Date())).length}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Mastered</div>
          <div className={styles.statValue} style={{ color: "#1D9E75" }}>{masteredCount}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total reviews</div>
          <div className={styles.statValue}>{totalReviews}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>This week</div>
          <div className={styles.barsWrap}>
            {weeklyBars.map((count, i) => (
              <div key={i} className={styles.barCol}>
                <div
                  className={`${styles.bar} ${i === 6 ? styles.barToday : ""}`}
                  style={{ height: `${Math.round((count / weeklyMax) * 100)}%` }}
                />
                <div className={styles.barDay}>{DAY_LABELS[(new Date().getDay() + i) % 7]}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Fading banner */}
      {fadingWords.length > 0 && (
        <div className={styles.fadingBanner}>
          <div className={styles.fadingDot} />
          <div className={styles.fadingText}>
            <strong>{fadingWords.length} word{fadingWords.length > 1 ? "s" : ""} may be fading</strong>
            <div className={styles.fadingSub}>Not reviewed in 30+ days — will appear at the front of your next session</div>
          </div>
          <button className={styles.fadingBtn} onClick={handleFadingSession}>
            Start session
          </button>
        </div>
      )}

      {/* Search */}
      <div className={styles.searchWrap}>
        <svg className={styles.searchIcon} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="6.5" cy="6.5" r="4.5" /><line x1="10" y1="10" x2="14" y2="14" />
        </svg>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Search by Russian word or English meaning…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Filter pills */}
      <div className={styles.filterRow}>
        {["all","verb","noun","adjective","adverb","other"].map(k => (
          <button
            key={k}
            className={`${styles.fpill} ${posFilter === k ? styles.fpillOn : ""}`}
            onClick={() => setPosFilter(k)}
          >
            {{ all:"All", verb:"Verbs", noun:"Nouns", adjective:"Adjectives", adverb:"Adverbs", other:"Other" }[k]}
          </button>
        ))}
        <div className={styles.fpill} style={{ gap: 4 }}>
          Tier&nbsp;
          <select
            value={tierFilter}
            onChange={e => setTierFilter(e.target.value)}
            style={{ background:"transparent", border:"none", outline:"none", fontSize:12, color:"inherit", cursor:"pointer" }}
          >
            <option value="all">All tiers</option>
            <option value="0-2">0 – 2</option>
            <option value="3-5">3 – 5</option>
            <option value="mastered">Mastered</option>
          </select>
        </div>
        <button
          className={`${styles.fpill} ${dueOnly ? styles.fpillOn : ""}`}
          onClick={() => setDueOnly(v => !v)}
        >
          Due only
        </button>
        <button
          className={`${styles.fpill} ${fadingOnly ? styles.fpillOn : ""}`}
          onClick={() => setFadingOnly(v => !v)}
        >
          Fading
        </button>
      </div>

      {/* Word sections */}
      {POS_SECTIONS.map(section => {
        const sectionWords = grouped[section.key];
        if (!sectionWords?.length) return null;
        return (
          <div key={section.key} className={styles.posSection}>
            <div className={styles.posDivider}>
              <span className={styles.posHeading}>{section.label} · {section.labelEn}</span>
              <div className={styles.posLine} />
              <span className={styles.posCount}>{sectionWords.length} words</span>
            </div>

            <div className={styles.wordList}>
              {sectionWords.map(word => {
                const tierMeta  = getTierMeta(word);
                const due       = formatDue(word.next_review_at, word.review_count);
                const lastStudied = relativeTime(word.updated_at);
                const isFading  = fadingWords.some(f => f.id === word.id);
                const streak    = word.tier_streak ?? 0;

                return (
                  <div
                    key={word.id}
                    className={`${styles.wordCard} ${isFading ? styles.wordCardFading : ""}`}
                  >
                    {/* Card header */}
                    <div className={styles.cardHeader}>
                      <div className={styles.wordBlock}>
                        <div className={styles.wordRu}>{word.word}</div>
                        <div className={styles.wordEn}>{word.translation}</div>
                        {word.pronunciation && (
                          <div className={styles.wordPron}>{word.pronunciation}</div>
                        )}
                      </div>
                      <div className={styles.headerRight}>
                        <div className={styles.tierRow}>
                          {isFading && <span className={styles.fadingBadge}>fading</span>}
                          <div
                            className={styles.tierDropdown}
                            data-tier-dropdown
                          >
                            <button
                              className={styles.tierPill}
                              style={{ background: tierMeta.bg, color: tierMeta.color }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenTierMenu(openTierMenu === word.id ? null : word.id);
                              }}
                            >
                              {tierMeta.label} <span className={styles.caret}>▾</span>
                            </button>
                            {openTierMenu === word.id && (
                              <div className={styles.tierMenu}>
                                <div className={styles.tierMenuLabel}>Change tier</div>
                                {TIER_META.map(t => (
                                  <div
                                    key={t.value}
                                    className={`${styles.tierOpt} ${tierMeta.value === t.value ? styles.tierOptActive : ""}`}
                                    onClick={() => handleTierChange(word, t.value)}
                                  >
                                    <span className={styles.tierDot} style={{ background: t.bg }} />
                                    {t.label}
                                    <span className={styles.tierOptEx}>{t.exerciseLabel}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <button
                            className={styles.audioBtn}
                            onClick={() => playWord(word.word, word.id)}
                            title="Play pronunciation"
                          >
                            {playingId === word.id ? "◼" : "▶"}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Stats section */}
                    <div className={styles.cardStats}>
                      <div className={styles.statsGrid}>
                        <div className={styles.sItem}>
                          <div className={styles.sLabel}>Reviews</div>
                          <div className={styles.sVal}>{word.review_count ?? 0}</div>
                        </div>
                        <div className={styles.sItem}>
                          <div className={styles.sLabel}>Last studied</div>
                          <div
                            className={styles.sVal}
                            style={isFading ? { color: "#854F0B" } : {}}
                          >
                            {lastStudied}
                          </div>
                        </div>
                        <div className={styles.sItem}>
                          <div className={styles.sLabel}>Next due</div>
                          <div className={styles.sVal} style={{ color: due.color }}>{due.text}</div>
                        </div>
                        <div className={styles.sItem}>
                          <div className={styles.sLabel}>Ease factor</div>
                          <div className={styles.sVal}>{(word.ease_factor ?? 2.5).toFixed(1)}</div>
                        </div>
                      </div>

                      {word.is_mastered ? (
                        <div className={styles.masteredTag}>✓ Mastered — Sentence builder</div>
                      ) : (
                        <div className={styles.streakRow}>
                          <span className={styles.streakLabel}>Tier streak</span>
                          {[0,1,2].map(i => (
                            <div
                              key={i}
                              className={`${styles.streakDot} ${i < streak ? styles.streakDotOn : ""}`}
                            />
                          ))}
                          <span className={styles.streakHint}>{streak} / 3 to level up</span>
                        </div>
                      )}
                    </div>

                    {/* Detail section */}
                    {(word.etymology || word.usage_example) && (
                      <div className={styles.cardDetail}>
                        {word.etymology && (
                          <div className={styles.detailBlock}>
                            <div className={styles.detailLabel}>Etymology</div>
                            <div className={styles.detailText}>{word.etymology}</div>
                          </div>
                        )}
                        {word.usage_example && (
                          <div className={styles.detailBlock}>
                            <div className={styles.detailLabel}>Usage</div>
                            <div className={styles.detailText}>
                              <em>{word.usage_example}</em>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Footer */}
                    <div className={styles.cardFooter}>
                      <button
                        className={styles.priBtn}
                        onClick={() => handlePrioritize(word)}
                      >
                        ⚡ Prioritize
                      </button>
                      {word.is_mastered ? (
                        <button
                          className={styles.unmasterBtn}
                          onClick={() => handleTierChange(word, 5)}
                        >
                          Unmaster
                        </button>
                      ) : (
                        <button
                          className={styles.masterBtn}
                          onClick={() => handleTierChange(word, 6)}
                        >
                          Mark mastered
                        </button>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div className={styles.emptyState}>
          No words match your current filters.
        </div>
      )}

    </div>
  );
}