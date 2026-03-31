// src/modules/Library/BookReader.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth }     from "../../AuthContext";
import { useSettings } from "../../context/SettingsContext";
import { useWordBank } from "../../context/WordBankContext";
import {
  getBooks, getChapters, updateBook, upsertReadingSession, getChapterPriorTime,
} from "../../storage";
import { useReadingTimer } from "../../hooks/useReadingTimer";
import styles from "./BookReader.module.css";
import ComprehensionBlock from "./ComprehensionBlock";
import StatsOverlay from "./StatsOverlay";

// Session ID is generated per chapter visit, not once at mount.
// We store it in a ref so goToChapter can refresh it.

// ─────────────────────────────────────────────────────
// splitIntoSegments
// Preferred: content stored with \n\n separators (new/imported books).
// Fallback:  group into 4-sentence blocks (legacy/migrated content).
// ─────────────────────────────────────────────────────
function splitIntoSegments(content) {
  if (!content) return [];

  // If double-newlines exist, use them (properly formatted content)
  const byParagraph = content.split(/\n\n+/).filter(s => s.trim().length > 0);
  if (byParagraph.length > 1) return byParagraph;

  // Fallback: split on sentence-ending punctuation followed by a capital Cyrillic letter
  const sentences = content
    .split(/(?<=[.!?…»])\s+(?=[А-ЯЁ«"'])/)
    .map(s => s.trim())
    .filter(Boolean);

  if (sentences.length <= 1) return [content];

  // Group into blocks of 4 sentences
  const groups = [];
  for (let i = 0; i < sentences.length; i += 4) {
    groups.push(sentences.slice(i, i + 4).join(" "));
  }
  return groups;
}

export default function BookReader() {
  const chapterSessionIdRef = useRef(crypto.randomUUID());
  const { bookId }   = useParams();
  const { user }     = useAuth();
  const settings     = useSettings();
  const { words: wordBankWords } = useWordBank();
  const navigate     = useNavigate();

  const [book,     setBook]     = useState(null);
  const [chapters, setChapters] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  const [activeChapterNum,  setActiveChapterNum]  = useState(1);
  const [vocabHighlight,    setVocabHighlight]    = useState(() => {
    try { return localStorage.getItem("vocab_highlight") === "true"; } catch { return false; }
  });
  const [revealedSegs,      setRevealedSegs]      = useState(new Set());
  const [translationsCache, setTranslationsCache] = useState({});
  const [translating,       setTranslating]       = useState(null);
  const [bookmark,          setBookmark]          = useState(null);
  const [showChapterDrawer, setShowChapterDrawer] = useState(false);
  const [showComprehension, setShowComprehension] = useState(false);
  const [showStats,         setShowStats]         = useState(false);

  const activeChapterNumRef  = useRef(1);
  const translationsCacheRef = useRef({});
  const bookmarkRef          = useRef(null);

  useEffect(() => { activeChapterNumRef.current  = activeChapterNum;  }, [activeChapterNum]);
  useEffect(() => { translationsCacheRef.current = translationsCache; }, [translationsCache]);
  useEffect(() => { bookmarkRef.current          = bookmark;          }, [bookmark]);
  
  // ── Reading timer ────────────────────────────────────────────────────────
  const [priorSeconds, setPriorSeconds] = useState(0);
  const priorSecondsRef = useRef(0);
  useEffect(() => { priorSecondsRef.current = priorSeconds; }, [priorSeconds]);

  const { seconds, running, toggle, nudgeInteraction, flushAndReset } = useReadingTimer({
    onSave: async (elapsed) => {
      if (!user || elapsed < 1) return;
      const ch = chapters.find(c => c.chapter_num === activeChapterNumRef.current);
      if (!ch) return;
      await upsertReadingSession(user.uid, {
        sessionId:   chapterSessionIdRef.current,
        chapterId:   ch.id,
        timeSpent:   elapsed,
        startedAt:   new Date(Date.now() - elapsed * 1000).toISOString(),
        completedAt: new Date().toISOString(),
      });
    },
  });

  // ── Load data ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !bookId) return;
    loadBookData();
  }, [user, bookId]);

  async function loadBookData() {
    try {
      setLoading(true);
      const [booksData, chaptersData] = await Promise.all([
        getBooks(user.uid),
        getChapters(user.uid, bookId),
      ]);
      const thisBook = booksData.find(b => b.id === bookId);
      if (!thisBook) { setError("Book not found."); return; }
      setBook(thisBook);
      setChapters(chaptersData ?? []);

      // Load prior reading time for the initial chapter
      const startChapter = thisBook.bookmark_chapter ?? 1;
      const startChapData = (chaptersData ?? []).find(c => c.chapter_num === startChapter);
      if (startChapData && user) {
        const prior = await getChapterPriorTime(user.uid, startChapData.id);
        setPriorSeconds(prior);
        priorSecondsRef.current = prior;
      }

      // Find which chapter has a bookmark saved
      if (thisBook.bookmark_chapter_num != null && thisBook.bookmark_segment_index != null) {
        setActiveChapterNum(thisBook.bookmark_chapter_num);
        setBookmark({
          chapterNum: thisBook.bookmark_chapter_num,
          segIdx:     thisBook.bookmark_segment_index,
        });
        pendingBookmarkScroll.current = true;
      } else {
        setActiveChapterNum(1);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Keyboard navigation ──────────────────────────────────────────────────
  useEffect(() => {
    function handleKey(e) {
      const tag = document.activeElement?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;
      if (e.key === "ArrowRight") goToChapter(activeChapterNumRef.current + 1);
      if (e.key === "ArrowLeft")  goToChapter(activeChapterNumRef.current - 1);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [chapters]);

  // ── Chapter navigation ───────────────────────────────────────────────────
  async function goToChapter(num) {
    if (num < 1 || num > chapters.length) return;
    await flushAndReset();
    chapterSessionIdRef.current = crypto.randomUUID();
    setActiveChapterNum(num);
    setRevealedSegs(new Set());
    setTranslationsCache({});
    setShowComprehension(false);
    const ch = chapters.find(c => c.chapter_num === num);
    if (ch && user) {
      const prior = await getChapterPriorTime(user.uid, ch.id);
      setPriorSeconds(prior);
      priorSecondsRef.current = prior;
    } else {
      setPriorSeconds(0);
      priorSecondsRef.current = 0;
    }
    if (bookmarkRef.current?.chapterNum === num) {
      pendingBookmarkScroll.current = true;
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  // ── Bookmark ─────────────────────────────────────────────────────────────
  async function setBookmarkAt(chapterNum, segIdx) {
    const isSame = bookmark?.chapterNum === chapterNum && bookmark?.segIdx === segIdx;
    const newBm  = isSame ? null : { chapterNum, segIdx };
    setBookmark(newBm);
    try {
      await updateBook(user.uid, bookId, {
        bookmark_chapter_num:   newBm?.chapterNum ?? null,
        bookmark_segment_index: newBm?.segIdx     ?? null,
      });
    } catch (err) {
      console.warn("Could not save bookmark:", err.message);
    }
  }

    // ── Right marker (translate bar) handlers ────────────────────────────────
  const [fillingSegIdx, setFillingSegIdx] = useState(null);
  const translatePressTimer = useRef(null);
  const translateFillTimer  = useRef(null);

  function handleTranslatePointerDown(e, segIdx) {
    e.stopPropagation();
    // Start fill animation
    setFillingSegIdx(segIdx);
    // After 600ms trigger translation
    translatePressTimer.current = setTimeout(() => {
      translateSegment(segIdx);
      setFillingSegIdx(null);
    }, 600);
  }

  function handleTranslatePointerUp(e, segIdx) {
    e.stopPropagation();
    const wasfilling = fillingSegIdx === segIdx;
    clearTimeout(translatePressTimer.current);
    setFillingSegIdx(null);
    // If released before 600ms it was a tap — toggle visibility
    if (!wasfilling) return;
    // If fill was still animating (< 600ms) treat as tap
    if (translationsCacheRef.current[segIdx]) {
      setRevealedSegs(prev => {
        const next = new Set(prev);
        next.has(segIdx) ? next.delete(segIdx) : next.add(segIdx);
        return next;
      });
    }
  }

  function handleTranslatePointerLeave(e, segIdx) {
    if (fillingSegIdx === segIdx) {
      clearTimeout(translatePressTimer.current);
      setFillingSegIdx(null);
    }
  }

  

  async function translateSegment(segIdx) {
    const ch = chapters.find(c => c.chapter_num === activeChapterNumRef.current);
    if (!ch?.content) return;
    const segs = splitIntoSegments(ch.content);
    const text = segs[segIdx];
    if (!text) return;
    if (translationsCacheRef.current[segIdx]) {
      setRevealedSegs(prev => new Set([...prev, segIdx]));
      return;
    }
    setTranslating(segIdx);
    try {
      const res  = await fetch("/api/translate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text, isPhrase: true }),
      });
      const data = await res.json();
      if (data.translation) {
        setTranslationsCache(prev => {
          const next = { ...prev, [segIdx]: data.translation };
          translationsCacheRef.current = next;
          return next;
        });
        setRevealedSegs(prev => new Set([...prev, segIdx]));
      }
    } catch (err) {
      console.warn("Translation error:", err.message);
    } finally {
      setTranslating(null);
    }
  }

  // ── Vocab highlight ──────────────────────────────────────────────────────
  const wordBankSet = new Set(
    (wordBankWords ?? []).map(w => w.word?.toLowerCase().replace(/[^а-яёa-z]/gi, ""))
  );

  function highlightVocab(text) {
    if (!vocabHighlight || wordBankSet.size === 0) return text;
    return text.split(/(\s+)/).map((token, i) => {
      const clean = token.toLowerCase().replace(/[^а-яё]/gi, "");
      if (clean.length < 3 || !wordBankSet.has(clean)) return token;
      return <span key={i} className={styles.vocabHighlight}>{token}</span>;
    });
  }

  // ── Derived values ───────────────────────────────────────────────────────
  const activeChapter = chapters.find(c => c.chapter_num === activeChapterNum);
  const segments = splitIntoSegments(activeChapter?.content);

  const ruFont     = settings?.cursive ? "'Philosopher', italic" : "Georgia, serif";
  const ruFontSize = settings?.cursive ? 19 : 16;

  // Scroll to bookmark on chapter load
  const pendingBookmarkScroll = useRef(false);
  useEffect(() => {
    if (!pendingBookmarkScroll.current) return;
    if (!bookmark || bookmark.chapterNum !== activeChapterNum) return;
    const el = document.getElementById(`seg_${bookmark.segIdx}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      pendingBookmarkScroll.current = false;
    } else {
      // Element not yet in DOM — retry once after a short delay
      const t = setTimeout(() => {
        const el2 = document.getElementById(`seg_${bookmark.segIdx}`);
        if (el2) {
          el2.scrollIntoView({ behavior: "smooth", block: "center" });
          pendingBookmarkScroll.current = false;
        }
      }, 150);
      return () => clearTimeout(t);
    }
  }, [segments.length, activeChapterNum]);

const totalSeconds  = priorSeconds + seconds;
  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const timerDisplay  = fmtTime(seconds);
  const totalDisplay  = fmtTime(totalSeconds);
  const coverColor    = book?.cover_color || "#7a9e7e";

  if (loading) return (
    <div className={styles.loading}>
      <div className={styles.dots}><span /><span /><span /></div>
      <p>Загрузка…</p>
    </div>
  );

  if (error) return (
    <div className={styles.errorState}>
      <p>{error}</p>
      <button onClick={() => navigate("/library")}>← Back to Library</button>
    </div>
  );

  return (
   <div className={styles.reader}
      onClick={nudgeInteraction} onKeyDown={nudgeInteraction}>

      {/* Sub-header */}
      <div className={styles.subHeader}>
        <button className={styles.backBtn}
          onClick={async () => { await flushAndReset(); navigate("/library"); }}>✕</button>
        <span className={styles.bookTitle}>{book?.title}</span>
        <div className={styles.subHeaderRight}>
          {book?.level && (
            <span className={styles.levelBadge} style={{ background: coverColor }}>
              {book.level}
            </span>
          )}
          <button className={styles.statsLink} onClick={() => setShowStats(true)} title="Book stats">
            📊
          </button>
        </div>
      </div>

      {/* Chapter content */}
      <div className={styles.contentArea}>
        <div className={styles.chapterHeading}>
          <p className={styles.chapterLabel}>CHAPTER {activeChapterNum}</p>
          <p className={styles.chapterTitle} style={{ fontFamily: ruFont }}>
            {activeChapter?.title || ""}
          </p>
          <hr className={styles.headingRule} />
        </div>

        {segments.length === 0 && (
          <p className={styles.noContent}>This chapter has no content.</p>
        )}

        {segments.map((seg, idx) => (
          <div
            key={idx}
            id={`seg_${idx}`}
            className={`${styles.segment} ${revealedSegs.has(idx) ? styles.segmentRevealed : ""}`}
          >
            <div
              className={`${styles.bookmarkBar} ${
                bookmark?.chapterNum === activeChapterNum && bookmark?.segIdx === idx
                  ? styles.bookmarkBarActive : ""
              }`}
              style={{ "--cover-color": coverColor }}
              onClick={e => { e.stopPropagation(); setBookmarkAt(activeChapterNum, idx); }}
              title="Bookmark this paragraph"
            />

            <div className={styles.segContent}>
              <p className={styles.segText}
                style={{ fontFamily: ruFont, fontSize: ruFontSize }} lang="ru">
                {highlightVocab(seg)}
              </p>

              {translating === idx && (
                <div className={styles.translatingDots}><span /><span /><span /></div>
              )}

              {revealedSegs.has(idx) && translationsCache[idx] && (
                <div className={styles.translation}>
                  <span className={styles.enBadge}>EN</span>
                  <span className={styles.translationText}>{translationsCache[idx]}</span>
                </div>
              )}
            </div>

            {/* Right translate bar */}
            <div
              className={`${styles.translateBar} ${
                translationsCache[idx] ? styles.translateBarActive : ""
              }`}
              onPointerDown={e => handleTranslatePointerDown(e, idx)}
              onPointerUp={e => handleTranslatePointerUp(e, idx)}
              onPointerLeave={e => handleTranslatePointerLeave(e, idx)}
              title="Hold to translate paragraph"
            >
              <div className={`${styles.translateBarFill} ${
                fillingSegIdx === idx ? styles.translateBarFilling : ""
              }`} />
              <div className={`${styles.translateDot} ${
                translationsCache[idx] ? styles.translateDotVisible : ""
              }`} />
            </div>
          </div>
        ))}

        {/* End of chapter */}
        {segments.length > 0 && (
          <div className={styles.endOfChapter}>
            {!showComprehension ? (
              <button className={styles.comprehensionBtn}
                onClick={() => setShowComprehension(true)}>
                Test My Understanding
              </button>
            ) : (
              <ComprehensionBlock
                chapter={activeChapter}
                book={book}
                onDone={() => setShowComprehension(false)}
              />
            )}
          </div>
        )}
      </div>

      {/* Bottom toolbar */}
      <div className={styles.toolbar}>
        <button className={styles.chapterPill}
          onClick={() => setShowChapterDrawer(s => !s)}>
          Глава {activeChapterNum} / {chapters.length}
        </button>
        <div className={styles.toolbarRight}>
          <button
            className={`${styles.toolbarBtn} ${vocabHighlight ? styles.toolbarBtnActive : ""}`}
            onClick={() => {
              const next = !vocabHighlight;
              setVocabHighlight(next);
              try { localStorage.setItem("vocab_highlight", String(next)); } catch {}
            }}
            title="Highlight word bank words"
          >СБ</button>

          <div className={styles.timerWrapper}>
            <button
              className={`${styles.toolbarBtn} ${running ? styles.timerRunning : ""}`}
              onClick={toggle}
              title={running ? "Pause timer" : "Start timer"}
            >⏱</button>
            {totalSeconds > 0 && (
              <div className={styles.timerPopup}>
                <div className={styles.timerPopupRow}>
                  <span className={styles.timerLabel}>session</span>
                  <span className={styles.timerValue}>{timerDisplay}</span>
                </div>
                <div className={styles.timerPopupRow}>
                  <span className={styles.timerLabel}>total</span>
                  <span className={`${styles.timerValue} ${styles.timerTotal}`}>{totalDisplay}</span>
                </div>
                <div className={styles.timerPopupArrow} />
              </div>
            )}
          </div>

          <span className={`${styles.bookmarkIcon} ${
            bookmark?.chapterNum === activeChapterNum ? styles.bookmarkIconActive : ""
          }`}>🔖</span>
        </div>
      </div>

      {/* Chapter drawer */}
      {showChapterDrawer && (
        <ChapterDrawer
          chapters={chapters}
          activeChapterNum={activeChapterNum}
          onSelect={num => { goToChapter(num); setShowChapterDrawer(false); }}
          onClose={() => setShowChapterDrawer(false)}
        />
      )}

      {/* Stats overlay */}
      {showStats && (
        <StatsOverlay book={book} onClose={() => setShowStats(false)} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────
// ChapterDrawer
// ─────────────────────────────────────────────────────
function ChapterDrawer({ chapters, activeChapterNum, onSelect, onClose }) {
  return (
    <>
      <div className={styles.drawerBackdrop} onClick={onClose} />
      <div className={styles.drawer}>
        <div className={styles.drawerHeader}>
          <span className={styles.drawerTitle}>Chapters</span>
          <button className={styles.drawerClose} onClick={onClose}>✕</button>
        </div>
        <div className={styles.drawerList}>
          {chapters.map(ch => (
            <button
              key={ch.id}
              className={`${styles.drawerItem} ${ch.chapter_num === activeChapterNum ? styles.drawerItemActive : ""}`}
              onClick={() => onSelect(ch.chapter_num)}
            >
              <span className={styles.drawerChNum}>{ch.chapter_num}</span>
              <span className={styles.drawerChTitle}>{ch.title}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}