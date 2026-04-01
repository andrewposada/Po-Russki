// src/components/WordBank/WordBankOverlay.jsx
import { useState } from "react";
import { useAuth } from "../../AuthContext";
import { useWordBank } from "../../context/WordBankContext";
import { deleteWord, upsertWord } from "../../storage";
import Skeleton from "../Skeleton/Skeleton";
import styles from "./WordBankOverlay.module.css";

const SORT_OPTIONS = [
  { id: "date",    label: "Date added" },
  { id: "alpha",   label: "A → Я"     },
  { id: "mastered",label: "Mastered"  },
];

export default function WordBankOverlay() {
  const { user }               = useAuth();
  const { isOpen, words, close, setWords } = useWordBank();
  const [tab,    setTab]       = useState("active");   // "active" | "mastered"
  const [search, setSearch]    = useState("");
  const [sort,   setSort]      = useState("date");
  const [searchFocused, setSearchFocused] = useState(false);

  if (!isOpen) return null;

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
      if (sort === "alpha")    return (a.word ?? "").localeCompare(b.word ?? "", "ru");
      if (sort === "mastered") return (b.is_mastered ? 1 : 0) - (a.is_mastered ? 1 : 0);
      return new Date(b.created_at ?? 0) - new Date(a.created_at ?? 0);
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