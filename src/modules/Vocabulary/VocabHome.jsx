// src/modules/Vocabulary/VocabHome.jsx
// Entry screen — stat tiles, featured word, mastery progression, mode cards.

import { useMemo, useCallback, useEffect } from "react";
import { useNavigate }                     from "react-router-dom";
import { useAuth }                         from "../../AuthContext";
import { useWordBank }                     from "../../context/WordBankContext";
import { getWords }                        from "../../storage";
import { getExerciseType }                 from "../../constants";
import styles                              from "./VocabHome.module.css";

// ── Tier config ────────────────────────────────────────────────────────────
const TIERS = [
  { key: "new",      label: "New",      tooltip: "Not yet reviewed\nWill start with matching"         },
  { key: "matching", label: "Tier 1",   tooltip: "Matching + Multiple choice\n1–2 reviews"            },
  { key: "translate",label: "Tier 2",   tooltip: "Translate + Cloze\n3–9 reviews"                     },
  { key: "cloze",    label: "Tier 3",   tooltip: "Sentence building\n10+ reviews"                     },
  { key: "mastered", label: "Mastered", tooltip: "Consistently recalled across all exercise types"    },
];

const TIER_COLORS = {
  new:      { bar: "#D3D1C7", text: "#444441" },
  matching: { bar: "#B5D4F4", text: "#0C447C" },
  translate:{ bar: "#378ADD", text: "#E6F1FB" },
  cloze:    { bar: "#185FA5", text: "#E6F1FB" },
  mastered: { bar: "#3B6D11", text: "#EAF3DE" },
};

// Map getExerciseType() return values → tier keys
function wordToTierKey(word) {
  if (word.is_mastered)                                             return "mastered";
  const count = word.review_count ?? 0;
  if (count === 0)                                                  return "new";
  if (count <= 2)                                                   return "matching";
  if (count <= 9)                                                   return "translate";
  return "cloze";
}

// Dynamic color for mastered % and due-count tiles
function tileColorForPercent(pct) {
  if (pct >= 80) return { bg: "#EAF3DE", text: "#27500A", sub: "#3B6D11" };
  if (pct >= 40) return { bg: "#FAEEDA", text: "#633806", sub: "#854F0B" };
  return           { bg: "#FCEBEB", text: "#501313", sub: "#A32D2D"  };
}

// Pick the "word to focus on": lowest proficiency among non-mastered, reviewed at least once.
// Falls back to any non-mastered word if none have been reviewed yet.
function pickFeaturedWord(words) {
  if (!words?.length) return null;
  const active = words.filter(w => !w.is_mastered);
  if (!active.length) return null;
  const reviewed = active.filter(w => (w.review_count ?? 0) > 0);
  const pool = reviewed.length ? reviewed : active;
  return pool.reduce((lowest, w) =>
    (w.proficiency ?? 0) < (lowest.proficiency ?? 0) ? w : lowest
  , pool[0]);
}

export default function VocabHome() {
  const navigate              = useNavigate();
  const { user }              = useAuth();
  const { words, setWords }   = useWordBank();

  // Always re-fetch words when VocabHome mounts so stats reflect latest session
  useEffect(() => {
    if (!user) return;
    getWords(user.uid).then(fetched => setWords(fetched ?? []));
  }, [user]); // intentionally omits `words` — we want a fresh pull every mount

  // ── Derived stats ────────────────────────────────────────────────────────
  const totalWords    = words?.length ?? 0;
  const masteredWords = words?.filter(w => w.is_mastered).length ?? 0;
  const masteredPct   = totalWords > 0 ? Math.round((masteredWords / totalWords) * 100) : 0;
  const dueCount      = words?.filter(w =>
    !w.is_mastered && (!w.next_review_at || new Date(w.next_review_at) <= new Date())
  ).length ?? 0;
  const addedThisWeek = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    return words?.filter(w => w.created_at && new Date(w.created_at) >= cutoff).length ?? 0;
  }, [words]);

  // ── Tile colors ──────────────────────────────────────────────────────────
  const masteredColor = tileColorForPercent(masteredPct);
  const dueColor      = tileColorForPercent(dueCount === 0 ? 100 : 0);

  // ── Tier counts ──────────────────────────────────────────────────────────
  const tierCounts = useMemo(() => {
    const counts = { new: 0, matching: 0, mc: 0, translate: 0, cloze: 0, mastered: 0 };
    words?.forEach(w => { counts[wordToTierKey(w)] += 1; });
    return counts;
  }, [words]);

  // ── Featured word ────────────────────────────────────────────────────────
  const featured = useMemo(() => pickFeaturedWord(words), [words]);

  // ── TTS playback ─────────────────────────────────────────────────────────
  const playWord = useCallback(async (word) => {
    try {
      const res  = await fetch("/api/tts", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text: word }),
      });
      const { audioContent } = await res.json();
      const audio = new Audio(`data:audio/mp3;base64,${audioContent}`);
      audio.play();
    } catch (err) {
      console.warn("TTS error:", err);
    }
  }, []);

  return (
    <div className={styles.page}>

      {/* ── Page header ── */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Словарь</h1>
          <p className={styles.subtitle}>Your personal Russian vocabulary</p>
        </div>
        <button
          className={styles.dictLink}
          onClick={() => navigate("/vocabulary/dictionary")}
        >
          Мой словарь <span className={styles.dictArrow}>→</span>
        </button>
      </div>

      {/* ── Stat strip ── */}
      <div className={styles.statStrip}>

        <div className={styles.statTile}>
          <div className={styles.statLabel}>Total words</div>
          <div className={styles.statValue}>{totalWords}</div>
          <div className={styles.statSub}>in your bank</div>
        </div>

        <div className={styles.statTile} style={{
          background: masteredColor.bg,
          "--stat-label-color": masteredColor.sub,
          "--stat-value-color": masteredColor.text,
          "--stat-sub-color":   masteredColor.sub,
        }}>
          <div className={styles.statLabel}>Mastered</div>
          <div className={styles.statValue}>{masteredWords}</div>
          <div className={styles.statSub}>{masteredPct}% of bank</div>
        </div>

        <div className={styles.statTile} style={{
          background: dueColor.bg,
          "--stat-label-color": dueColor.sub,
          "--stat-value-color": dueColor.text,
          "--stat-sub-color":   dueColor.sub,
        }}>
          <div className={styles.statLabel}>Due now</div>
          <div className={styles.statValue}>{dueCount}</div>
          <div className={styles.statSub}>{dueCount === 0 ? "all caught up" : "ready to review"}</div>
        </div>

        <div className={styles.statTile}>
          <div className={styles.statLabel}>Added this week</div>
          <div className={styles.statValue}>{addedThisWeek}</div>
          <div className={styles.statSub}>new words</div>
        </div>

      </div>

      {/* ── Top grid: featured word + mastery progression ── */}
      <div className={styles.topGrid}>

        {/* Featured word */}
        {featured ? (
          <div className={styles.featuredCard}>
            <div className={styles.featuredEyebrow}>Word to focus on</div>

            <div className={styles.featuredWordRow}>
              <div className={styles.featuredWord}>{featured.word}</div>
              <button
                className={styles.playBtn}
                onClick={() => playWord(featured.word)}
                title="Hear pronunciation"
              >
                <div className={styles.playTriangle} />
              </button>
            </div>

            <div className={styles.featuredTranslation}>{featured.translation}</div>

            <div className={styles.featuredMeta}>
              {featured.part_of_speech && (
                <span className={styles.posBadge}>{featured.part_of_speech}</span>
              )}
              {featured.proficiency != null && (
                <span className={styles.profBadge}>{featured.proficiency}% proficiency</span>
              )}
            </div>

            <div className={styles.featuredDetail}>
              {featured.pronunciation && (
                <><strong>Pronunciation:</strong> {featured.pronunciation}<br /></>
              )}
              {featured.etymology && (
                <><strong>Root:</strong> {featured.etymology}<br /></>
              )}
              {featured.usage_example && (
                <><strong>Usage:</strong> {featured.usage_example}</>
              )}
            </div>

            <button
              className={styles.featuredLink}
              onClick={() => navigate("/vocabulary/session")}
            >
              Practice this word →
            </button>
          </div>
        ) : (
          <div className={styles.featuredCard}>
            <div className={styles.featuredEyebrow}>Word to focus on</div>
            <div className={styles.featuredEmpty}>
              Add words to your bank to see a focus word here.
            </div>
          </div>
        )}

        {/* Word mastery progression */}
        <div className={styles.masteryCard}>
          <div className={styles.masteryTitle}>Word mastery progression</div>

          {totalWords > 0 ? (
            <>
              <div className={styles.tierBarWrap}>
                {TIERS.map(tier => {
                  const count = tierCounts[tier.key];
                  if (!count) return null;
                  const pct   = (count / totalWords) * 100;
                  const col   = TIER_COLORS[tier.key];
                  return (
                    <div
                      key={tier.key}
                      className={styles.tierSeg}
                      style={{ width: `${pct}%`, background: col.bar, color: col.text }}
                    >
                      <span className={styles.tierSegLabel}>{count}</span>
                      <div className={styles.tierTooltip}>
                        <strong>{tier.label}</strong><br />
                        {tier.tooltip.split("\n").map((line, i) => (
                          <span key={i}>{line}{i === 0 ? <br /> : null}</span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className={styles.tierLegend}>
                {TIERS.map(tier => {
                  const count = tierCounts[tier.key];
                  if (!count) return null;
                  const col = TIER_COLORS[tier.key];
                  return (
                    <div key={tier.key} className={styles.legendItem}>
                      <div className={styles.legendDot} style={{ background: col.bar }} />
                      <span className={styles.legendLabel}>{tier.label}</span>
                      <span className={styles.legendCount}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className={styles.masteryEmpty}>
              Your word mastery chart will appear here once you start adding words.
            </div>
          )}

          <p className={styles.masteryNote}>
            Each word climbs tiers as you get it right — from simple matching all the way to filling in
            the blank from memory. Reaching Mastered means your brain has stored it at the deepest
            level, across every exercise type.
          </p>
        </div>

      </div>

      {/* ── Mode cards ── */}
      <div className={styles.modeCards}>

        <button
          className={`${styles.modeCard} ${styles.modeCardBlue}`}
          onClick={() => navigate("/vocabulary/session")}
        >
          <div className={styles.cardTop}>
            <span className={styles.cardEmoji}>📖</span>
            <span className={styles.cardChevron}>›</span>
          </div>
          <div className={styles.cardName}>My Words</div>
          <div className={styles.cardDesc}>
            Your personal word bank, reviewed in the order your brain needs them most.
          </div>
          <div className={styles.cardFooter}>
            <span className={styles.cardStat}>Spaced repetition</span>
            {dueCount > 0
              ? <span className={`${styles.cardCta} ${styles.ctaBlue}`}>{dueCount} due now</span>
              : <span className={`${styles.cardCta} ${styles.ctaBlueEmpty}`}>All caught up</span>
            }
          </div>
        </button>

        <button
          className={`${styles.modeCard} ${styles.modeCardGreen}`}
          onClick={() => navigate("/vocabulary/explore")}
        >
          <div className={styles.cardTop}>
            <span className={styles.cardEmoji}>🌿</span>
            <span className={styles.cardChevron}>›</span>
          </div>
          <div className={styles.cardName}>Explore</div>
          <div className={styles.cardDesc}>
            Dive into a topic — food, travel, emotions — and practice words you haven't saved yet.
          </div>
          <div className={styles.cardFooter}>
            <span className={styles.cardStat}>18 topics</span>
            <span className={`${styles.cardCta} ${styles.ctaGreen}`}>Start exploring</span>
          </div>
        </button>

        <button
          className={`${styles.modeCard} ${styles.modeCardPurple}`}
          onClick={() => navigate("/vocabulary/flashcards")}
          disabled={totalWords === 0}
        >
          <div className={styles.cardTop}>
            <span className={styles.cardEmoji}>🃏</span>
            <span className={styles.cardChevron}>›</span>
          </div>
          <div className={styles.cardName}>Flashcards</div>
          <div className={styles.cardDesc}>
            Flip through your whole word bank at your own pace. Great for a quick refresh.
          </div>
          <div className={styles.cardFooter}>
            <span className={styles.cardStat}>{totalWords} cards</span>
            <span className={`${styles.cardCta} ${styles.ctaPurple}`}>Start flipping</span>
          </div>
        </button>

      </div>

    </div>
  );
}