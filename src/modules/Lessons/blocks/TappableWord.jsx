// src/modules/Lessons/blocks/TappableWord.jsx
import { useState, useRef, useEffect } from "react";
import { useVocab }                    from "../VocabContext";
import { upsertWord }                  from "../../../storage";
import { useAuth }                     from "../../../AuthContext";
import styles                          from "./Blocks.module.css";

// ── Normalisation helpers ─────────────────────────────────────────────────────

function stripPunctuation(token) {
  return token.replace(/[.,!?;:«»()—–\-"""]+$/g, "").replace(/^[«(""]+/, "");
}

function normalise(str) {
  return str.toLowerCase().trim();
}

// Match a cleaned token against a vocabulary entry.
// Returns true on exact match (dictionary form or known form) or stem match.
function matchesEntry(token, entry) {
  const t = normalise(stripPunctuation(token));
  if (!t) return false;

  // Exact match against dictionary form
  if (normalise(entry.word) === t) return true;

  // Exact match against any declared form
  if (Array.isArray(entry.forms)) {
    if (entry.forms.some(f => normalise(f) === t)) return true;
  }

  // Stem match fallback: compare first (n-3) chars if word is long enough
  const stem = normalise(entry.word);
  if (stem.length > 4 && t.length > 3) {
    const stemBase = stem.slice(0, stem.length - 2);
    const tokBase  = t.slice(0, t.length - 2);
    if (stemBase === tokBase) return true;
  }

  return false;
}

// ── Popover ───────────────────────────────────────────────────────────────────

function VocabPopover({ entry, onClose, onAdd, added }) {
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("touchstart", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("touchstart", handleClick);
    };
  }, [onClose]);

  return (
    <span className={styles.vocabPopover} ref={ref}>
      <span className={styles.vocabPopoverWord}>{entry.word}</span>
      {entry.gender && (
        <span className={styles.vocabPopoverGender}>{entry.gender}</span>
      )}
      <span className={styles.vocabPopoverTranslation}>{entry.translation}</span>
      <button
        className={`${styles.vocabPopoverAddBtn} ${added ? styles.vocabPopoverAddBtnDone : ""}`}
        onClick={e => { e.stopPropagation(); onAdd(); }}
      >
        {added ? "✓" : "+ Add"}
      </button>
    </span>
  );
}

// ── Single tappable token ─────────────────────────────────────────────────────

function TappableToken({ token, entry }) {
  const { user }       = useAuth();
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState(false);

  async function handleAdd() {
    if (added || !user) return;
    try {
      await upsertWord(user.uid, {
        word:          entry.word,
        translation:   entry.translation,
        pronunciation: entry.pronunciation ?? "",
        etymology:     "",
        usage_example: "",
        cefr_level:    "A1",
      });
      setAdded(true);
    } catch {
      // silently fail — word may already exist
    }
    setOpen(false);
  }

  return (
    <span className={styles.vocabTokenWrapper}>
      <span
        className={styles.vocabToken}
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
      >
        {token}
      </span>
      {open && (
        <VocabPopover
          entry={entry}
          onClose={() => setOpen(false)}
          onAdd={handleAdd}
          added={added}
        />
      )}
    </span>
  );
}

// ── Main export: renders a Russian string with tappable vocabulary words ───────

export default function TappableWord({ text }) {
  const vocab = useVocab();

  if (!vocab || vocab.length === 0) {
    return <span>{text}</span>;
  }

  // Split on whitespace, preserving the spaces as separate tokens so we can
  // rejoin the rendered output without losing spacing.
  const rawTokens = text.split(/(\s+)/);

  return (
    <>
      {rawTokens.map((token, i) => {
        // Whitespace tokens — render as-is
        if (/^\s+$/.test(token)) return <span key={i}>{token}</span>;

        const entry = vocab.find(v => matchesEntry(token, v));
        if (entry) {
          return <TappableToken key={i} token={token} entry={entry} />;
        }
        return <span key={i}>{token}</span>;
      })}
    </>
  );
}