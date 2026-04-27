// src/components/WordBank/WordBankOverlay.jsx
import { useRef, useState } from "react";
import { useAuth } from "../../AuthContext";
import { useWordBank } from "../../context/WordBankContext";
import { useSettings } from "../../context/SettingsContext";
import { useRussianKeyboard } from "../../hooks/useRussianKeyboard";
import { deleteWord, upsertWord } from "../../storage";
import Skeleton from "../Skeleton/Skeleton";
import styles from "./WordBankOverlay.module.css";

const SORT_OPTIONS = [
  { id: "date",  label: "Date added" },
  { id: "alpha", label: "A → Я"     },
];

export default function WordBankOverlay() {
  const { user }               = useAuth();
  const { isOpen, words, close, setWords, enrich } = useWordBank();
  const { translitOn }         = useSettings();
  const [tab,    setTab]       = useState("active");
  const [search, setSearch]    = useState("");
  const [sort,   setSort]      = useState("date");
  const [searchFocused, setSearchFocused] = useState(false);

  // Manual add state
  const [addInput,  setAddInput]  = useState("");
  const [addState,  setAddState]  = useState("idle"); // "idle" | "loading" | "result" | "saving" | "duplicate"
  const [addResult, setAddResult] = useState(null);   // enriched word object from API
  const addInputRef = useRef(null);
  useRussianKeyboard(addInputRef, translitOn);

  if (!isOpen) return null;
const existingWords = (words ?? []).map(w => w.word);

  const handleLookup = async () => {
    const raw = addInput.trim();
    if (!raw) return;

    // Check duplicate before API call
    if (existingWords.includes(raw)) {
      setAddState("duplicate");
      return;
    }

    setAddState("loading");
    setAddResult(null);

    try {
      const res  = await fetch("/api/enrich-word", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ word: raw, translation: "" }),
      });
      const data = await res.json();
      setAddResult(data);
      setAddState("result");
    } catch {
      setAddState("idle");
    }
  };

  const handleAddConfirm = async (isMastered = false) => {
    if (!user || !addResult) return;
    setAddState("saving");
    await enrich(user.uid, {
      word:        addResult.word ?? addInput.trim(),
      translation: addResult.translation ?? "",
      isMastered,
    });
    setAddInput("");
    setAddResult(null);
    setAddState("idle");
  };

  const handleAddKeyDown = (e) => {
    if (e.key === "Enter") handleLookup();
    if (e.key === "Escape") {
      setAddInput("");
      setAddResult(null);
      setAddState("idle");
    }
  };

  const loading = words === null;
  const active   = (words ?? []).filter(w => !w.is_mastered);
  const mastered = (words ?? []).filter(w =>  w.is_mastered);
  const source   = tab === "active" ? active : mastered;

  const filtered = source
    .filter(w =>
      !search ||
      w.word?.toLowerCase().includes(search.toLowerCase()) ||
      w.translation?.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sort === "alpha") return (a.word ?? "").localeCompare(b.word ?? "", "ru");
      return new Date(b.added_at ?? 0) - new Date(a.added_at ?? 0);
    });

  const handleDelete = async (word) => {
    if (!user) return;
    await deleteWord(user.uid, word);
    setWords(ws => (ws ?? []).filter(w => w.word !== word));
  };

  const handleMaster = async (wordObj) => {
    if (!user) return;
    const updated = { ...wordObj, is_mastered: true, proficiency: 100 };
    await upsertWord(user.uid, updated);
    setWords(ws => (ws ?? []).map(w => w.word === wordObj.word ? updated : w));
  };

  const handleUnmaster = async (wordObj) => {
    if (!user) return;
    const updated = { ...wordObj, is_mastered: false, proficiency: 0 };
    await upsertWord(user.uid, updated);
    setWords(ws => (ws ?? []).map(w => w.word === wordObj.word ? updated : w));
  };

  return (
    <>
      <div className={styles.backdrop} onClick={close} />
      <div className={`${styles.overlay} ${searchFocused ? styles.overlayKeyboard : ""}`}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>Word Bank</h2>
          <button className={styles.closeBtn} onClick={close} aria-label="Close">✕</button>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${tab === "active" ? styles.tabActive : ""}`}
            onClick={() => setTab("active")}
          >
            Active {!loading && `(${active.length})`}
          </button>
          <button
            className={`${styles.tab} ${tab === "mastered" ? styles.tabActive : ""}`}
            onClick={() => setTab("mastered")}
          >
            Mastered {!loading && `(${mastered.length})`}
          </button>
        </div>

        {/* Manual add */}
        <div className={styles.addSection}>
          <div className={styles.addRow}>
            <input
              ref={addInputRef}
              className={styles.addInput}
              type="text"
              placeholder="Add a word…"
              value={addInput}
              onChange={e => { setAddInput(e.target.value); setAddState("idle"); setAddResult(null); }}
              onKeyDown={handleAddKeyDown}
              disabled={addState === "loading" || addState === "saving"}
            />
            <button
              className={styles.addLookupBtn}
              onClick={handleLookup}
              disabled={!addInput.trim() || addState === "loading" || addState === "saving"}
            >
              {addState === "loading" ? "…" : "Look up"}
            </button>
          </div>

          {/* Duplicate notice */}
          {addState === "duplicate" && (
            <p className={styles.addDuplicate}>Already in your word bank.</p>
          )}

          {/* Preview card */}
          {addState === "result" && addResult && (
            <div className={styles.addPreview}>
              <div className={styles.addPreviewTop}>
                <span className={`${styles.addPreviewWord} ru`}>{addResult.word}</span>
                <span className={styles.addPreviewTranslation}>{addResult.translation}</span>
                {addResult.partOfSpeech && (
                  <span className={styles.addPreviewPos}>{addResult.partOfSpeech}</span>
                )}
              </div>
              {addResult.pronunciation && (
                <p className={styles.addPreviewPron}>{addResult.pronunciation}</p>
              )}
              <div className={styles.addPreviewActions}>
                <button
                  className={styles.addConfirmBtn}
                  onClick={() => handleAddConfirm(false)}
                  disabled={addState === "saving"}
                >
                  + Word Bank
                </button>
                <button
                  className={`${styles.addConfirmBtn} ${styles.addConfirmMastered}`}
                  onClick={() => handleAddConfirm(true)}
                  disabled={addState === "saving"}
                >
                  + Mastered
                </button>
                <button
                  className={styles.addCancelBtn}
                  onClick={() => { setAddInput(""); setAddResult(null); setAddState("idle"); }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Saving state */}
          {addState === "saving" && (
            <p className={styles.addSaving}>Saving…</p>
          )}
        </div>

        {/* Search + Sort */}
        <div className={styles.controls}>
          <input
            className={styles.search}
            type="text"
            placeholder="Search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          <select
            className={styles.sortSelect}
            value={sort}
            onChange={e => setSort(e.target.value)}
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Word list */}
        <div className={styles.list}>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={styles.skeletonCard}>
                <Skeleton variant="card" />
              </div>
            ))
          ) : filtered.length === 0 ? (
            <p className={styles.empty}>
              {search ? "No words match your search." : tab === "active" ? "No words yet — highlight Russian text anywhere to save a word." : "No mastered words yet."}
            </p>
          ) : (
            filtered.map(w => (
              <WordCard
                key={w.word}
                word={w}
                tab={tab}
                onDelete={() => handleDelete(w.word)}
                onMaster={() => handleMaster(w)}
                onUnmaster={() => handleUnmaster(w)}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}

function WordCard({ word: w, tab, onDelete, onMaster, onUnmaster }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={styles.card}>
      <div className={styles.cardTop} onClick={() => setExpanded(v => !v)}>
        <div className={styles.cardLeft}>
          <span className={`${styles.cardWord} ru`}>{w.word}</span>
          <span className={styles.cardTranslation}>{w.translation}</span>
          {w.part_of_speech && (
            <span className={styles.cardPos}>{w.part_of_speech}</span>
          )}
        </div>
        <span className={styles.chevron}>{expanded ? "▴" : "▾"}</span>
      </div>

      {expanded && (
        <div className={styles.cardDetail}>
          {w.pronunciation && (
            <p className={styles.detailLine}>
              <span className={styles.detailLabel}>Pronunciation</span>
              {w.pronunciation}
            </p>
          )}
          {w.etymology && (
            <p className={styles.detailLine}>
              <span className={styles.detailLabel}>Etymology</span>
              {w.etymology}
            </p>
          )}
          {w.usage_example && (
            <p className={`${styles.detailLine} ru`}>
              <span className={styles.detailLabel}>Usage</span>
              {w.usage_example}
            </p>
          )}
          <div className={styles.cardActions}>
            {tab === "active" ? (
              <button className={styles.masterBtn} onClick={onMaster}>Mark mastered ★</button>
            ) : (
              <button className={styles.unmasterBtn} onClick={onUnmaster}>Move to active</button>
            )}
            <button className={styles.deleteBtn} onClick={onDelete}>Remove</button>
          </div>
        </div>
      )}
    </div>
  );
}