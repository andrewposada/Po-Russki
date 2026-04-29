// src/modules/Muzyka/MuzykaHome.jsx
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../AuthContext";
import { getSongs, insertSong, deleteSong } from "../../storage";
import styles from "./MuzykaHome.module.css";

// ── Lyric parser ──────────────────────────────────────────────────────────────

const SECTION_LABEL_RE = /^\[.+\]$/;
const FILLER_RE        = /^[лЛ][аА][-лЛаА\s]*$|^[чЧ][аА][тТ][\s,чЧаАтТ-]*$|\(.*\)$/;

function parseLyrics(raw) {
  const stanzas = raw
    .split(/\n{2,}/)
    .map(block => block.trim())
    .filter(Boolean);

  const lines = [];
  stanzas.forEach((block, stanzaIndex) => {
    block.split("\n").forEach((rawLine, lineIndex) => {
      const ru = rawLine.trim();
      if (!ru) return;
      if (SECTION_LABEL_RE.test(ru)) return; // strip [Припев] etc.
      const drillable = !FILLER_RE.test(ru);
      lines.push({ stanza_index: stanzaIndex, line_index: lineIndex, ru, en: "", drillable });
    });
  });
  return lines;
}

// Group parsed lines back into stanzas for translation calls
function groupByStanza(lines) {
  const map = new Map();
  for (const line of lines) {
    if (!map.has(line.stanza_index)) map.set(line.stanza_index, []);
    map.get(line.stanza_index).push(line);
  }
  return map;
}

// ── Translation helper ────────────────────────────────────────────────────────

async function translateStanza(ruLines) {
  const stanzaText = ruLines.map(l => l.ru).join("\n");
  const res  = await fetch("/api/translate", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ text: stanzaText, isPhrase: true }),
  });
  if (!res.ok) return ruLines.map(() => "");
  const data = await res.json();
  const enLines = (data.translation ?? "").split("\n");
  return ruLines.map((_, i) => enLines[i]?.trim() ?? "");
}

// ── Progress ring helper ──────────────────────────────────────────────────────

function ProgressRing({ learned, total }) {
  const r = 11;
  const circ = 2 * Math.PI * r;
  const pct  = total === 0 ? 0 : learned / total;
  const dash = circ * pct;
  return (
    <svg width="28" height="28" viewBox="0 0 28 28">
      <circle cx="14" cy="14" r={r} fill="none" stroke="var(--c-border)" strokeWidth="2.5" />
      {pct > 0 && (
        <circle
          cx="14" cy="14" r={r} fill="none"
          stroke="var(--c-sage)" strokeWidth="2.5"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 14 14)"
        />
      )}
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MuzykaHome() {
  const { user }   = useAuth();
  const navigate   = useNavigate();

  const [songs,        setSongs]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [importing,    setImporting]    = useState(false);
  const [importStep,   setImportStep]   = useState("idle"); // idle | form | translating | done
  const [search,       setSearch]       = useState("");

  // Import form state
  const [rawLyrics,    setRawLyrics]    = useState("");
  const [songTitle,    setSongTitle]    = useState("");
  const [songArtist,   setSongArtist]   = useState("");
  const [importError,  setImportError]  = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const data = await getSongs(user.uid);
    setSongs(data);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // ── Import flow ─────────────────────────────────────────────────────────────

  async function handleImport() {
    setImportError("");
    if (!songTitle.trim()) { setImportError("Song title is required."); return; }
    if (!rawLyrics.trim()) { setImportError("Paste some lyrics first."); return; }

    const parsed = parseLyrics(rawLyrics);
    if (parsed.length === 0) { setImportError("No lines found — check your lyrics."); return; }

    setImportStep("translating");

    try {
      const stanzaMap   = groupByStanza(parsed);
      const translatedLines = [...parsed];

      // Translate one stanza at a time
      for (const [stanzaIndex, stanzaLines] of stanzaMap.entries()) {
        const translations = await translateStanza(stanzaLines);
        stanzaLines.forEach((line, i) => {
          const idx = translatedLines.findIndex(
            l => l.stanza_index === stanzaIndex && l.line_index === line.line_index
          );
          if (idx !== -1) translatedLines[idx] = { ...translatedLines[idx], en: translations[i] };
        });
      }

      await insertSong(user.uid, {
        title:  songTitle,
        artist: songArtist || null,
        lines:  translatedLines,
      });

      setImportStep("done");
      setRawLyrics("");
      setSongTitle("");
      setSongArtist("");
      setTimeout(() => {
        setImporting(false);
        setImportStep("idle");
        load();
      }, 800);
    } catch (e) {
      console.error(e);
      setImportError("Something went wrong. Please try again.");
      setImportStep("form");
    }
  }

  function openImport() {
    setImportError("");
    setImportStep("form");
    setImporting(true);
  }

  function closeImport() {
    setImporting(false);
    setImportStep("idle");
    setRawLyrics("");
    setSongTitle("");
    setSongArtist("");
    setImportError("");
  }

  // ── Derived data ────────────────────────────────────────────────────────────

  const filtered = songs.filter(s => {
    const q = search.toLowerCase();
    return (
      s.title.toLowerCase().includes(q) ||
      (s.artist ?? "").toLowerCase().includes(q)
    );
  });

  // Group filtered songs by artist
  const grouped = filtered.reduce((acc, song) => {
    const key = song.artist ?? "__unknown__";
    if (!acc[key]) acc[key] = [];
    acc[key].push(song);
    return acc;
  }, {});

  const sortedArtists = Object.keys(grouped).sort((a, b) => {
    if (a === "__unknown__") return 1;
    if (b === "__unknown__") return -1;
    return a.localeCompare(b, "ru");
  });

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft} />
        <h1 className={`${styles.headerTitle} ru`}>Музыка</h1>
        <button className={styles.addBtn} onClick={openImport}>+ Add song</button>
      </div>

      <div className={styles.body}>
        <input
          className={styles.search}
          placeholder="Search songs and artists..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {loading && <p className={styles.empty}>Loading...</p>}

        {!loading && filtered.length === 0 && (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>No songs yet</p>
            <p className={styles.emptySub}>Add a song to start learning lyrics.</p>
          </div>
        )}

        {sortedArtists.map(artist => (
          <div key={artist} className={styles.artistGroup}>
            <div className={styles.artistHeader}>
              {artist === "__unknown__" ? "Unknown artist" : artist}
            </div>
            {grouped[artist].map(song => {
              const drillable = (song.lines ?? []).filter(l => l.drillable).length;
              const learned   = (song.lines_learned ?? []).length;
              const lastPrac  = song.updated_at
                ? new Date(song.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                : null;
              return (
                <button
                  key={song.id}
                  className={styles.songRow}
                  onClick={() => navigate(`/muzyka/song/${song.id}`)}
                >
                  <div className={styles.songInfo}>
                    <span className={styles.songTitle}>{song.title}</span>
                    <span className={styles.songMeta}>
                      {drillable} lines
                      {learned > 0 && ` · ${learned} / ${drillable} learned`}
                      {lastPrac && ` · ${lastPrac}`}
                    </span>
                  </div>
                  <div className={styles.songRight}>
                    {song.mastered
                      ? <span className={styles.masteredPill}>Mastered</span>
                      : <ProgressRing learned={learned} total={drillable} />
                    }
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* ── Import overlay ── */}
      {importing && (
        <div className={styles.overlay} onClick={closeImport}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            {importStep === "done" ? (
              <div className={styles.doneState}>
                <div className={styles.doneCheck}>✓</div>
                <p>Song added!</p>
              </div>
            ) : (
              <>
                <div className={styles.modalHeader}>
                  <h2 className={styles.modalTitle}>Add a song</h2>
                  <button className={styles.closeBtn} onClick={closeImport}>✕</button>
                </div>

                <div className={styles.formRow}>
                  <label className={styles.label}>Title</label>
                  <input
                    className={styles.input}
                    placeholder="Song title"
                    value={songTitle}
                    onChange={e => setSongTitle(e.target.value)}
                    disabled={importStep === "translating"}
                  />
                </div>
                <div className={styles.formRow}>
                  <label className={styles.label}>Artist <span className={styles.optional}>(optional)</span></label>
                  <input
                    className={styles.input}
                    placeholder="Artist name"
                    value={songArtist}
                    onChange={e => setSongArtist(e.target.value)}
                    disabled={importStep === "translating"}
                  />
                </div>
                <div className={styles.formRow}>
                  <label className={styles.label}>Lyrics</label>
                  <textarea
                    className={styles.textarea}
                    placeholder={"Paste Russian lyrics here...\nBlank lines separate stanzas.\nSection labels like [Припев] are stripped automatically."}
                    value={rawLyrics}
                    onChange={e => setRawLyrics(e.target.value)}
                    disabled={importStep === "translating"}
                    rows={10}
                  />
                </div>

                {importError && <p className={styles.error}>{importError}</p>}

                <button
                  className={styles.importBtn}
                  onClick={handleImport}
                  disabled={importStep === "translating"}
                >
                  {importStep === "translating" ? "Translating..." : "Add song"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}