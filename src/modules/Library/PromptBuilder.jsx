// src/modules/Library/PromptBuilder.jsx
import { useState, useRef } from "react";
import { useAuth } from "../../AuthContext";
import { upsertBook, upsertChapter } from "../../storage";
import { LIB_GENRES, LIB_LENGTHS, libCoverColor } from "../../constants";
import styles from "./PromptBuilder.module.css";

export default function PromptBuilder({ onClose, onImportComplete }) {
  const { user } = useAuth();

  const [level,       setLevel]       = useState("B1");
  const [genres,      setGenres]      = useState([]);
  const [length,      setLength]      = useState("standard");
  const [premise,     setPremise]     = useState("");
  const [protagonist, setProtagonist] = useState("");
  const [setting,     setSetting]     = useState("");

  const [scaffoldText,  setScaffoldText]  = useState("");
  const [scaffoldJson,  setScaffoldJson]  = useState(null);
  const [scaffoldValid, setScaffoldValid] = useState(null);

  const [copiedScaffold, setCopiedScaffold] = useState(false);
  const [copiedChapter,  setCopiedChapter]  = useState(false);

  const [importPreview, setImportPreview] = useState(null);
  const [importError,   setImportError]   = useState(null);
  const [coverImage,    setCoverImage]    = useState(null);
  const [importing,     setImporting]     = useState(false);
  const fileInputRef  = useRef(null);
  const coverInputRef = useRef(null);

  // ── Prompt builders ──────────────────────────────────────────────────────
  function buildScaffoldPrompt() {
    const lengthMap = { short: "8–10", standard: "11–13", long: "14–15" };
    const chRange   = lengthMap[length] || "11–13";
    const optionals = [
      premise     && `Premise: ${premise}`,
      protagonist && `Protagonist: ${protagonist}`,
      setting     && `Setting: ${setting}`,
    ].filter(Boolean).join("\n");

    return `You are generating a scaffold for a Russian language learning story. Respond ONLY with valid JSON — no markdown, no commentary, no code fences.

PARAMETERS:
- CEFR level: ${level}
- Genres: ${genres.join(", ") || "any"}
- Chapter count: ${chRange} chapters
${optionals}

Return exactly this JSON shape:
{
  "title": "<clean Russian title — no English, no placeholders, no check marks>",
  "synopsis": "<2–3 sentence English description of the story and its themes>",
  "totalChapters": <number within the chapter range above>,
  "cast": [
    {
      "name": "...",
      "role": "protagonist | supporting | antagonist",
      "description": "...",
      "relationshipToProtagonist": "...",
      "firstAppearsInChapter": 1
    }
  ],
  "subplots": [
    {
      "title": "...",
      "opensInChapter": 1,
      "resolvesInChapter": 8,
      "description": "..."
    }
  ],
  "chapterOutlines": [
    {
      "chapterNumber": 1,
      "title": "<Russian chapter title>",
      "summary": "<What happens. What changes. Where the chapter ends.>",
      "charactersPresent": ["name1", "name2"],
      "subplotsAdvanced": ["subplot title"]
    }
  ]
}

Rules:
- Title must be clean Russian — no English words
- Cast must have 3–6 entries
- Subplots must have at least 2 entries
- Every chapter outline must include charactersPresent and subplotsAdvanced
- Chapter count must be within the target range
- No notes, no commentary — JSON only`;
  }

  function buildChapterPrompt() {
    if (!scaffoldJson) return "";
    const totalChapters = scaffoldJson.totalChapters || "?";
    return `You are writing a Russian language learning story. Respond ONLY with a valid JSON file — no markdown, no commentary, no code fences.

CEFR level: ${level}. All vocabulary and grammar must match this level.

SCAFFOLD (do not deviate from this):
${JSON.stringify(scaffoldJson, null, 2)}

GENERATION RULES:
- Before writing each chapter, think through (do NOT include this thinking in the output):
    * What is the emotional tone of this chapter?
    * What vocabulary and grammar are appropriate for ${level}?
    * Exactly where did the previous chapter end, and how does this chapter begin?
    * Which subplots must advance, and how?
    * What is the final sentence — does it create forward momentum?
- Each chapter must be a minimum of 1,000 Russian words.
- Write in natural paragraphs separated by a blank line (\\n\\n). No other special formatting.
- Store the final sentence of each chapter in lastSentence.
- VOCABULARY: introduce 4–8 new vocabulary items per chapter appropriate for ${level}. Each new word must appear at least twice.
- GRAMMAR: each chapter should naturally feature 1–2 grammar structures appropriate for ${level} with enough repetition for the student to notice the pattern.

OUTPUT FORMAT — one single JSON object:
{
  "title": "${scaffoldJson.title}",
  "synopsis": "${(scaffoldJson.synopsis || "").replace(/"/g, "'")}",
  "totalChapters": ${totalChapters},
  "scaffold": <the full scaffold object, verbatim>,
  "chapters": [
    {
      "chapterNumber": 1,
      "title": "<Russian chapter title>",
      "lastSentence": "<final sentence of this chapter>",
      "wordCount": 1050,
      "text": "<full chapter text as a single string, paragraphs separated by \\n\\n>"
    }
  ]
}

Generate all ${totalChapters} chapters now. If the output is long, continue until all chapters are complete.`;
  }

  // ── Scaffold validation ──────────────────────────────────────────────────
  function handleScaffoldPaste(text) {
    setScaffoldText(text);
    try {
      const parsed = JSON.parse(text.trim());
      if (parsed.title && parsed.chapterOutlines && parsed.cast) {
        setScaffoldJson(parsed);
        setScaffoldValid(true);
      } else {
        setScaffoldValid(false);
      }
    } catch {
      setScaffoldValid(false);
    }
  }

  // ── Copy helpers ─────────────────────────────────────────────────────────
  async function copyScaffoldPrompt() {
    await navigator.clipboard.writeText(buildScaffoldPrompt());
    setCopiedScaffold(true);
    setTimeout(() => setCopiedScaffold(false), 2000);
  }

  async function copyChapterPrompt() {
    await navigator.clipboard.writeText(buildChapterPrompt());
    setCopiedChapter(true);
    setTimeout(() => setCopiedChapter(false), 2000);
  }

  // ── File import ──────────────────────────────────────────────────────────
  function validateBookJson(json) {
    if (!json.title || typeof json.title !== "string") return "Missing title field.";
    if (!json.chapters || !Array.isArray(json.chapters) || json.chapters.length === 0)
      return "No chapters found in file.";
    for (const ch of json.chapters) {
      if (typeof ch.text !== "string" || ch.text.trim().length === 0)
        return `Chapter ${ch.chapterNumber || "?"} has no text.`;
      if (!ch.title)
        return `Chapter ${ch.chapterNumber || "?"} is missing a title.`;
    }
    return null;
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setImportPreview(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target.result);
        const err  = validateBookJson(json);
        if (err) { setImportError(err); return; }
        setImportPreview(json);
      } catch {
        setImportError("Could not parse the file. Make sure it is a valid JSON file.");
      }
    };
    reader.readAsText(file);
  }

  // ── Cover image resize ───────────────────────────────────────────────────
  function handleCoverSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setImportError("Cover image must be under 2MB."); return; }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX_W = 300, MAX_H = 420;
      const scale  = Math.min(MAX_W / img.width, MAX_H / img.height, 1);
      const canvas = document.createElement("canvas");
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      setCoverImage(canvas.toDataURL("image/jpeg", 0.8));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  // ── Import to Supabase ───────────────────────────────────────────────────
  async function handleImport() {
    if (!importPreview || !user) return;
    setImporting(true);
    setImportError(null);
    try {
      const json   = importPreview;
      const bookId = await upsertBook(user.uid, {
        title:         json.title,
        level:         level,
        synopsis:      json.synopsis        ?? null,
        scaffold:      json.scaffold        ?? null,
        genres:        genres.length > 0 ? genres : null,
        totalChapters: json.chapters.length,
        coverColor:    libCoverColor(json.title),
        coverImage:    coverImage           ?? null,
        isArchived:    false,
      });

      const chapters = json.chapters;
      for (let i = 0; i < chapters.length; i += 3) {
        const batch = chapters.slice(i, i + 3);
        await Promise.all(batch.map(ch =>
          upsertChapter(user.uid, {
            bookId:       bookId,
            chapterNum:   ch.chapterNumber,
            title:        ch.title,
            content:      ch.text,
            lastSentence: ch.lastSentence ?? null,
            wordCount:    ch.wordCount    ?? null,
          })
        ));
      }
      onImportComplete();
    } catch (err) {
      setImportError(err.message || "Import failed. Please try again.");
    } finally {
      setImporting(false);
    }
  }

  const canCopyChapter = scaffoldValid === true;

  return (
    <div className={styles.backdrop} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Import a Book</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>

          {/* Step 1 — Configure */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Step 1 — Configure your book</h3>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Reading level</label>
              <div className={styles.pills}>
                {["A1","A2","B1","B2","C1"].map(l => (
                  <button key={l} onClick={() => setLevel(l)}
                    className={`${styles.pill} ${level === l ? styles.pillActive : ""}`}
                  >{l}</button>
                ))}
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Genres (pick at least one)</label>
              <div className={styles.pills}>
                {LIB_GENRES.map(g => (
                  <button key={g}
                    onClick={() => setGenres(gs => gs.includes(g) ? gs.filter(x => x !== g) : [...gs, g])}
                    className={`${styles.pill} ${genres.includes(g) ? styles.pillActive : ""}`}
                  >{g}</button>
                ))}
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Story length</label>
              <div className={styles.pills}>
                {LIB_LENGTHS.map(l => (
                  <button key={l.id} onClick={() => setLength(l.id)}
                    className={`${styles.pill} ${length === l.id ? styles.pillActive : ""}`}
                  >{l.label}</button>
                ))}
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Premise (optional)</label>
              <input value={premise} onChange={e => setPremise(e.target.value)}
                placeholder="A young scientist discovers a time machine…"
                className={styles.textInput} />
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.fieldGroup} style={{ flex: 1 }}>
                <label className={styles.label}>Protagonist (optional)</label>
                <input value={protagonist} onChange={e => setProtagonist(e.target.value)}
                  placeholder="Мария, 28, historian" className={styles.textInput} />
              </div>
              <div className={styles.fieldGroup} style={{ flex: 1 }}>
                <label className={styles.label}>Setting (optional)</label>
                <input value={setting} onChange={e => setSetting(e.target.value)}
                  placeholder="1920s St. Petersburg" className={styles.textInput} />
              </div>
            </div>
          </section>

          {/* Step 2 — Scaffold prompt */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Step 2 — Generate the scaffold in Claude.ai</h3>
            <p className={styles.instruction}>
              Copy the scaffold prompt and paste it into <strong>Claude.ai</strong> using the <strong>Opus</strong> model.
              When Claude finishes, copy the entire JSON output and paste it into the box below.
            </p>
            <button
              className={`${styles.copyBtn} ${copiedScaffold ? styles.copyBtnDone : ""}`}
              onClick={copyScaffoldPrompt}
            >{copiedScaffold ? "✓ Copied!" : "📋 Copy Scaffold Prompt"}</button>

            <label className={styles.label} style={{ marginTop: 16 }}>Paste scaffold JSON here</label>
            <textarea
              value={scaffoldText}
              onChange={e => handleScaffoldPaste(e.target.value)}
              placeholder='{"title": "…", "chapterOutlines": […], …}'
              className={styles.textarea}
              rows={5}
            />
            {scaffoldValid === true && (
              <p className={styles.validMsg}>✓ Scaffold validated — ready for chapter generation</p>
            )}
            {scaffoldValid === false && scaffoldText.length > 10 && (
              <p className={styles.errorMsg}>✗ Invalid JSON — check that you copied the full output</p>
            )}
          </section>

          {/* Step 3 — Chapter prompt */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Step 3 — Generate the chapters in Claude.ai</h3>
            <p className={styles.instruction}>
              Copy the chapter prompt and paste it into <strong>Claude.ai</strong> using the <strong>Sonnet</strong> model.
              Wait for all chapters to generate. If Claude pauses mid-way, click Continue.
              When complete, save the full JSON output as a <code>.json</code> file on your computer.
            </p>
            <button
              className={`${styles.copyBtn} ${!canCopyChapter ? styles.copyBtnDisabled : ""} ${copiedChapter ? styles.copyBtnDone : ""}`}
              onClick={canCopyChapter ? copyChapterPrompt : undefined}
              disabled={!canCopyChapter}
            >{copiedChapter ? "✓ Copied!" : "📋 Copy Chapter Prompt"}</button>
            {!canCopyChapter && (
              <p className={styles.hint}>Paste and validate the scaffold JSON in Step 2 first.</p>
            )}
          </section>

          {/* Step 4 — Import file */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Step 4 — Import the JSON file</h3>
            <p className={styles.instruction}>
              Select the <code>.json</code> file you saved from Claude.ai.
            </p>

            <input ref={fileInputRef} type="file" accept=".json"
              onChange={handleFileSelect} style={{ display: "none" }} />
            <button className={styles.fileBtn} onClick={() => fileInputRef.current?.click()}>
              📂 Select Book JSON File
            </button>

            {importError && <p className={styles.errorMsg}>{importError}</p>}

            {importPreview && (
              <div className={styles.preview}>
                <p className={styles.previewTitle}>{importPreview.title}</p>
                <p className={styles.previewMeta}>
                  {importPreview.chapters.length} chapters
                  {importPreview.synopsis ? ` · ${importPreview.synopsis.slice(0, 100)}…` : ""}
                </p>

                <input ref={coverInputRef} type="file" accept=".jpg,.jpeg,.png,.webp"
                  onChange={handleCoverSelect} style={{ display: "none" }} />

                {coverImage ? (
                  <div className={styles.coverPreview}>
                    <img src={coverImage} alt="Cover preview" className={styles.coverThumb} />
                    <button className={styles.removeCoverBtn} onClick={() => setCoverImage(null)}>
                      Remove cover
                    </button>
                  </div>
                ) : (
                  <button className={styles.coverUploadBtn}
                    onClick={() => coverInputRef.current?.click()}>
                    📷 Upload cover image (optional)
                  </button>
                )}

                <button className={styles.importConfirmBtn}
                  onClick={handleImport} disabled={importing}>
                  {importing ? "Importing…" : "✓ Import Book"}
                </button>
              </div>
            )}
          </section>

        </div>
      </div>
    </div>
  );
}