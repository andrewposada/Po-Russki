// src/components/WordBank/WordBankOverlay.jsx
import { useState, useRef } from "react";
import { useAuth } from "../../AuthContext";
import { useWordBank } from "../../context/WordBankContext";
import { useSettings } from "../../context/SettingsContext";
import { deleteWord, upsertWord } from "../../storage";
import { C } from "../../constants";
import Skeleton from "../Skeleton/Skeleton";
import styles from "./WordBankOverlay.module.css";

export default function WordBankOverlay() {
  const { user }               = useAuth();
  const { isOpen, words, close, setWords } = useWordBank();
  const settings               = useSettings();
  const [tab,       setTab]    = useState("active");   // "active" | "mastered"
  const [search,    setSearch] = useState("");
  const [posFilter, setPosFilter] = useState("all");   // "all" | "noun" | "verb" | etc.
  const [sortMode,  setSortMode]  = useState("date");  // "date" | "alpha" | "mastered"
  const [addInput,  setAddInput]  = useState("");
  const [addError,  setAddError]  = useState("");
  const addInputRef = useRef(null);

  if (!isOpen) return null;

  const loading  = words === null;
  const active   = (words ?? []).filter(w => !w.is_mastered);
  const mastered = (words ?? []).filter(w =>  w.is_mastered);
  const source   = tab === "active" ? active : mastered;

  const filteredWords = source
    .filter(w =>
      (!search ||
        w.word?.toLowerCase().includes(search.toLowerCase()) ||
        w.translation?.toLowerCase().includes(search.toLowerCase())) &&
      (posFilter === "all" || w.part_of_speech === posFilter)
    )
    .sort((a, b) => {
      if (sortMode === "alpha")    return (a.word ?? "").localeCompare(b.word ?? "", "ru");
      if (sortMode === "mastered") return (b.is_mastered ? 1 : 0) - (a.is_mastered ? 1 : 0);
      return new Date(b.updated_at ?? b.created_at ?? 0) - new Date(a.updated_at ?? a.created_at ?? 0);
    });

  const handleAdd = async () => {
    const word = addInput.trim();
    if (!word || !user) return;
    if ((words ?? []).some(w => w.word === word)) {
      setAddError("Word already in bank.");
      return;
    }
    const newWord = {
      word,
      translation: "",
      is_mastered: false,
      proficiency: 0,
      updated_at: new Date().toISOString(),
    };
    await upsertWord(user.uid, newWord);
    setWords(ws => [newWord, ...(ws ?? [])]);
    setAddInput("");
    setAddError("");
  };

  const handleDelete = async (word) => {
    if (!user) return;
    await deleteWord(user.uid, word);
    setWords(ws => (ws ?? []).filter(w => w.word !== word));
  };

  const handleMasterToggle = async (wordStr, isMastered) => {
    if (!user) return;
    const wordObj = (words ?? []).find(w => w.word === wordStr);
    if (!wordObj) return;
    const updated = { ...wordObj, is_mastered: !isMastered, proficiency: isMastered ? 0 : 100 };
    await upsertWord(user.uid, updated);
    setWords(ws => (ws ?? []).map(w => w.word === wordStr ? updated : w));
  };

  return (
    <>
      <div className={styles.backdrop} onClick={close} />
      <div className={styles.overlay}>
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

        {/* Search */}
        <div className={styles.controls}>
          <input
            className={styles.search}
            type="text"
            placeholder="Search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* ── Manual add ── */}
        <div style={{
          display: "flex", gap: 8, alignItems: "center",
          padding: "12px 16px 0",
        }}>
          <input
            ref={addInputRef}
            value={addInput}
            onChange={e => setAddInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAdd()}
            placeholder="Add a Russian word…"
            style={{
              flex: 1, padding: "8px 12px",
              fontFamily: settings.cursive ? "'Caveat', cursive" : "Georgia, serif",
              fontSize: settings.cursive ? 18 : 14,
              borderRadius: 8, border: `1.5px solid ${C.border}`,
              background: C.bgCard, color: C.textDark,
              outline: "none",
            }}
          />
          <button
            onClick={handleAdd}
            disabled={!addInput.trim()}
            style={{
              padding: "8px 14px", borderRadius: 8,
              background: addInput.trim() ? C.sage : C.bgPanel,
              color: addInput.trim() ? "#fff" : C.textLight,
              border: "none", cursor: addInput.trim() ? "pointer" : "default",
              fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
            }}
          >+ Add</button>
        </div>
        {addError && (
          <p style={{ padding: "4px 16px 0", fontSize: 12, color: C.wrong, margin: 0 }}>
            {addError}
          </p>
        )}

        {/* ── POS filter pills + sort ── */}
        {source.length > 0 && (
          <div style={{
            display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center",
            padding: "10px 16px 0",
          }}>
            {["all", ...new Set(source.map(w => w.part_of_speech).filter(Boolean))].map(pos => (
              <button
                key={pos}
                onClick={() => setPosFilter(pos)}
                style={{
                  padding: "3px 10px", borderRadius: 20, fontSize: 11,
                  border: `1.5px solid ${posFilter === pos ? C.sage : C.border}`,
                  background: posFilter === pos ? C.sage : C.bgCard,
                  color: posFilter === pos ? "#fff" : C.textMid,
                  cursor: "pointer", textTransform: "capitalize",
                }}
              >
                {pos === "all" ? "All" : pos}
              </button>
            ))}

            {/* Sort dropdown — right-aligned */}
            <select
              value={sortMode}
              onChange={e => setSortMode(e.target.value)}
              style={{
                marginLeft: "auto", padding: "3px 8px", borderRadius: 8,
                border: `1.5px solid ${C.border}`, background: C.bgCard,
                color: C.textMid, fontSize: 11, cursor: "pointer",
              }}
            >
              <option value="date">Date added</option>
              <option value="alpha">A → Я</option>
              <option value="mastered">Mastered first</option>
            </select>
          </div>
        )}

        {/* Word list */}
        <div className={styles.list}>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={styles.skeletonCard}>
                <Skeleton variant="card" />
              </div>
            ))
          ) : filteredWords.length === 0 ? (
            <p className={styles.empty}>
              {search || posFilter !== "all"
                ? "No words match your filters."
                : tab === "active"
                  ? "No words yet — highlight Russian text anywhere to save a word."
                  : "No mastered words yet."}
            </p>
          ) : (
            filteredWords.map(w => (
              <div
                key={w.word}
                style={{
                  background: C.bgCard, borderRadius: 12,
                  border: `1.5px solid ${C.borderSoft}`,
                  padding: "14px 16px", marginBottom: 2,
                  boxShadow: "0 2px 8px rgba(58,48,32,0.05)",
                }}
              >
                {/* ── Top row: word + translation + POS ── */}
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                  <span style={{
                    fontFamily: settings.cursive ? "'Caveat', cursive" : "Georgia, serif",
                    fontSize: settings.cursive ? 22 : 16,
                    color: C.textDark, fontWeight: 700,
                  }}>
                    {w.word}
                  </span>
                  <span style={{ color: C.sage, fontWeight: 600, fontSize: 14 }}>
                    {w.translation}
                  </span>
                  {w.part_of_speech && (
                    <span style={{ color: C.textLight, fontSize: 11, fontStyle: "italic" }}>
                      {w.part_of_speech}
                    </span>
                  )}
                </div>

                {/* ── Pronunciation ── */}
                {w.pronunciation && (
                  <div style={{ display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 6 }}>
                    <span style={{ color: C.sky, fontSize: 13 }}>🔊</span>
                    <span style={{ color: C.sky, fontSize: 13, fontStyle: "italic" }}>
                      {w.pronunciation}
                    </span>
                  </div>
                )}

                {/* ── Etymology ── */}
                {(w.etymology || w.explanation) && (
                  <div style={{ display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 6 }}>
                    <span style={{ fontSize: 13 }}>🌱</span>
                    <span style={{
                      color: C.textMid, fontSize: 12,
                      fontFamily: "Georgia, serif", fontStyle: "italic",
                    }}>
                      {w.etymology || w.explanation}
                    </span>
                  </div>
                )}

                {/* ── Usage example ── */}
                {w.usage_example && (
                  <div style={{ display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 8 }}>
                    <span style={{ fontSize: 13 }}>💬</span>
                    <span style={{
                      color: C.textMid, fontSize: 12,
                      fontFamily: settings.cursive ? "'Caveat', cursive" : "Georgia, serif",
                      fontStyle: "italic",
                    }}>
                      {w.usage_example}
                    </span>
                  </div>
                )}

                {/* ── Bottom row: timestamp + action buttons ── */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  marginTop: 4,
                }}>
                  <span style={{ color: C.textXLight, fontSize: 10 }}>
                    {new Date(w.updated_at ?? w.created_at).toLocaleDateString()}
                  </span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => handleMasterToggle(w.word, w.is_mastered)}
                      style={{
                        padding: "4px 10px", borderRadius: 8, fontSize: 11,
                        background: w.is_mastered ? C.bgPanel : C.sage,
                        color: w.is_mastered ? C.textMid : "#fff",
                        border: `1px solid ${w.is_mastered ? C.border : C.sage}`,
                        cursor: "pointer",
                      }}
                    >
                      {w.is_mastered ? "↩ Back" : "✓ Mastered"}
                    </button>
                    <button
                      onClick={() => handleDelete(w.word)}
                      style={{
                        padding: "4px 10px", borderRadius: 8, fontSize: 11,
                        background: "transparent", color: C.wrong,
                        border: `1px solid ${C.wrong}`, cursor: "pointer",
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
