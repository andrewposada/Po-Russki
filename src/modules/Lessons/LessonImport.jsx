// src/modules/Lessons/LessonImport.jsx
import { useState, useRef } from "react";
import { useNavigate }      from "react-router-dom";
import { insertLesson }     from "../../storage";
import styles               from "./LessonImport.module.css";

// ── Block schema string (embedded in generated prompt) ───────────────────────
const BLOCK_SCHEMAS = `
narrative:
{ "type": "narrative", "group": "Introduction", "content": "Plain text explanation." }

rule_table:
{ "type": "rule_table", "group": "Noun Endings", "caption": "Caption here", "headers": ["Col1","Col2"], "rows": [["val","val"]] }

example_set:
{ "type": "example_set", "group": "Noun Endings", "examples": [{ "ru": "Russian sentence.", "en": "English translation.", "note": "Optional note" }] }

callout:
{ "type": "callout", "group": "Animate vs Inanimate", "callout_type": "tip|warning|remember", "text": "Callout text." }

quiz:
{ "type": "quiz", "group": "Quick Check", "question": "Question text?", "options": ["A","B","C","D"], "correct_index": 0, "explanation": "Why this is correct." }

practice:
{ "type": "practice", "group": "Fill in the Blank", "prompt_ru": "Sentence with _____ (word).", "prompt_en": "English translation.", "target_word": "correct_form", "grammar_context": "e.g. accusative singular feminine", "hint": "Optional hint or null" }

assignment:
{ "type": "assignment", "group": "Homework: Topic Practice", "title": "Assignment title", "description": "Assignment description.", "exercises": [ { "type": "practice", "prompt_ru": "_____ (word).", "prompt_en": "English.", "target_word": "form", "grammar_context": "context", "hint": null } ] }

free_response_sentence:
{ "type": "free_response_sentence", "group": "Write Your Own", "prompt": "Write a sentence in Russian...", "guidance": "Think about..." }

free_response_paragraph:
{ "type": "free_response_paragraph", "group": "Paragraph Practice", "prompt": "Write 3–5 sentences...", "guidance": "Focus on..." }

summary:
{ "type": "summary", "group": "What You Learned", "points": ["Point 1", "Point 2", "Point 3"] }
`.trim();

const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1"];
const LESSON_TYPES = ["Grammar", "Culture", "History", "Vocabulary", "Custom"];

function buildPrompt({ title, cefr, type, focus }) {
  return `You are generating a Russian language lesson JSON file for the Po-Russki app.

Lesson details:
- Title: ${title}
- CEFR Level: ${cefr}
- Type: ${type}
- Focus: ${focus}

Generate a lesson that is as long as the topic requires to bring the student to confident understanding. Do not pad with unnecessary content — every block should earn its place.

Generate a valid lesson JSON object matching this exact schema:
{
  "id": "<slug: lowercase-hyphenated, e.g. cases-genitive-negation>",
  "title": "${title}",
  "is_core": false,
  "cefr_level": "${cefr}",
  "xp_reward": 100,
  "content": [ ...blocks array... ]
}

Rules:
1. Every block must have a "group" string — a descriptive section title. Every block in the same section shares the same group string.
2. Each group string must be unique within the lesson.
3. A group may contain multiple blocks, but no more than one answerable block (quiz, practice, assignment, free_response_sentence, free_response_paragraph).
4. Blocks within the same group are displayed together on one screen.
5. The lesson must flow pedagogically: introduce the concept, show rules, give examples, check understanding, practice, summarise.
6. Quiz blocks: multiple choice, 4 options, correct_index is 0-based.
7. Practice blocks require: prompt_ru (sentence with blank), prompt_en, target_word, grammar_context, optional hint.
8. Free response blocks require: prompt and guidance.
9. Assignment blocks contain an exercises array of practice-type items.
10. Respond with ONLY the JSON object. No markdown fences. No preamble. No explanation after.

Available block types and their schemas:
${BLOCK_SCHEMAS}`;
}

function validateLesson(data) {
  const errors = [];
  const warnings = [];

  if (!data || typeof data !== "object") { errors.push("File does not contain a valid JSON object."); return { errors, warnings }; }
  if (!data.id || typeof data.id !== "string") errors.push("Missing required field: id");
  if (!data.title || typeof data.title !== "string") errors.push("Missing required field: title");
  if (!Array.isArray(data.content)) errors.push("Missing required field: content (must be an array)");

  if (Array.isArray(data.content)) {
    const missing = data.content.filter(b => !b.group);
    if (missing.length > 0) errors.push(`${missing.length} block(s) are missing the required "group" field.`);

    // Check for duplicate answerable blocks within the same group
    const ANSWERABLE = ["quiz", "practice", "assignment", "free_response_sentence", "free_response_paragraph"];
    const groupAnswerCount = {};
    data.content.forEach(b => {
      if (ANSWERABLE.includes(b.type)) {
        groupAnswerCount[b.group] = (groupAnswerCount[b.group] || 0) + 1;
      }
    });
    const overloaded = Object.entries(groupAnswerCount).filter(([, count]) => count > 1);
    if (overloaded.length > 0) {
      warnings.push(
        `${overloaded.length} group(s) contain more than one answerable block: ${overloaded.map(([g]) => `"${g}"`).join(", ")}. Only the first will be graded.`
      );
    }
  }

  return { errors, warnings };
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function LessonImport() {
  const navigate   = useNavigate();
  const fileRef    = useRef(null);

  // Step 1 — form state
  const [title,  setTitle]  = useState("");
  const [cefr,   setCefr]   = useState("A2");
  const [type,   setType]   = useState("Grammar");
  const [focus,  setFocus]  = useState("");

  // Step 2 — prompt state
  const [promptText,     setPromptText]     = useState("");
  const [promptGenerated, setPromptGenerated] = useState(false);
  const [copied,         setCopied]         = useState(false);

  // Step 3 — import state
  const [parsedLesson,  setParsedLesson]  = useState(null);
  const [fileErrors,    setFileErrors]    = useState([]);
  const [fileWarnings,  setFileWarnings]  = useState([]);
  const [importStatus,  setImportStatus]  = useState("idle"); // "idle" | "importing" | "done" | "error"

  // ── Derived ─────────────────────────────────────────────────────────────────

  const step1Complete = title.trim().length > 0 && focus.trim().length > 0;
  const step2Complete = promptGenerated;

  const blockCount = parsedLesson?.content?.length ?? 0;

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function handleGenerate() {
    if (!step1Complete) return;
    const prompt = buildPrompt({ title: title.trim(), cefr, type, focus: focus.trim() });
    setPromptText(prompt);
    setPromptGenerated(true);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(promptText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — silently ignore
    }
  }

  function handleOpenClaude() {
    window.open("https://claude.ai/new?q=" + encodeURIComponent(promptText), "_blank");
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw = ev.target.result;
        const data = JSON.parse(raw);
        const { errors, warnings } = validateLesson(data);
        if (errors.length > 0) {
          setFileErrors(errors);
          setFileWarnings([]);
          setParsedLesson(null);
        } else {
          // Force is_core false on import regardless of what Claude produced
          data.is_core = false;
          setParsedLesson(data);
          setFileErrors([]);
          setFileWarnings(warnings);
        }
      } catch {
        setFileErrors(["Invalid JSON — the file could not be parsed. Make sure you saved the raw JSON output from Claude without any extra text."]);
        setFileWarnings([]);
        setParsedLesson(null);
      }
    };
    reader.readAsText(file);
    // Reset the input so selecting the same file again re-triggers onChange
    e.target.value = "";
  }

async function handleImport() {
  if (!parsedLesson || importStatus !== "idle") return;
  setImportStatus("importing");
  try {
    await insertLesson(parsedLesson);
    setImportStatus("done");
    setTimeout(() => navigate("/lessons"), 1200);
  } catch (err) {
    console.error("insertLesson error:", err);
    setImportStatus("error");
    // Reset to idle after 3s so the user can retry
    setTimeout(() => setImportStatus("idle"), 3000);
  }
}

  // ── Inline JSX variable — Step 1 form (contains inputs, must not be extracted) ──

  const step1Form = (
    <div className={styles.stepContent}>
      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel}>Title</label>
        <input
          className={styles.textInput}
          type="text"
          placeholder="e.g. Accusative Case — Animate Nouns"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel}>CEFR Level</label>
        <div className={styles.pillRow}>
          {CEFR_LEVELS.map(l => (
            <button
              key={l}
              className={`${styles.pill} ${cefr === l ? styles.pillActive : ""}`}
              onClick={() => setCefr(l)}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel}>Lesson Type</label>
        <div className={styles.pillRow}>
          {LESSON_TYPES.map(t => (
            <button
              key={t}
              className={`${styles.pill} ${type === t ? styles.pillActive : ""}`}
              onClick={() => setType(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel}>Focus</label>
        <textarea
          className={styles.textareaInput}
          placeholder="e.g. I keep confusing genitive and accusative for animate masculine nouns. Focus on that distinction with clear examples and practice."
          value={focus}
          onChange={e => setFocus(e.target.value)}
        />
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate("/lessons")}>
          ← Back
        </button>
        <h1 className={styles.pageTitle}>Import a Lesson</h1>
      </div>

      <div className={styles.body}>

        {/* ── Step 1 — Configure ─────────────────────────────────────── */}
        <div className={styles.stepRow}>
          <div className={`${styles.stepCircle} ${step1Complete ? styles.stepCircleDone : ""}`}>1</div>
          <div className={styles.stepTitle}>Configure your lesson</div>
        </div>
        {step1Form}

        <div className={styles.divider} />

        {/* ── Step 2 — Generate + send ───────────────────────────────── */}
        <div className={styles.stepRow}>
          <div className={`${styles.stepCircle} ${step2Complete ? styles.stepCircleDone : ""}`}>2</div>
          <div className={styles.stepTitle}>Generate and send prompt to Claude</div>
        </div>
        <div className={styles.stepContent}>
          <p className={styles.stepInstruction}>
            Click generate to build your prompt, then open Claude.ai with it pre-filled — just hit send.
          </p>
          <button
            className={`${styles.generateBtn} ${!step1Complete ? styles.generateBtnDisabled : ""}`}
            onClick={handleGenerate}
            disabled={!step1Complete}
          >
            Generate prompt
          </button>

          {promptGenerated && (
            <>
              <textarea
                className={styles.promptOutput}
                readOnly
                value={promptText}
              />
              <div className={styles.actionsRow}>
                <button className={styles.copyBtn} onClick={handleCopy}>
                  {copied ? "✓ Copied!" : "Copy"}
                </button>
                {copied && <span className={styles.copiedConfirm}>Copied!</span>}
                <button className={styles.claudeBtn} onClick={handleOpenClaude}>
                  Open in Claude.ai
                  {/* External link icon */}
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M10.5 1.5H12.5V3.5M12.5 1.5L6.5 7.5M5.5 2.5H2.5C1.948 2.5 1.5 2.948 1.5 3.5V11.5C1.5 12.052 1.948 12.5 2.5 12.5H10.5C11.052 12.5 11.5 12.052 11.5 11.5V8.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>

        <div className={styles.divider} />

        {/* ── Step 3 — Import JSON ───────────────────────────────────── */}
        <div className={styles.stepRow}>
          <div className={`${styles.stepCircle} ${parsedLesson ? styles.stepCircleDone : ""}`}>3</div>
          <div className={styles.stepTitle}>Import the lesson JSON</div>
        </div>
        <div className={styles.stepContent}>
          <p className={styles.stepInstruction}>
            Once Claude generates the JSON, save it as a .json file and import it here.
          </p>

          {/* Hidden file input */}
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            style={{ display: "none" }}
            onChange={handleFileSelect}
          />

          <button
            className={styles.fileSelectBtn}
            onClick={() => fileRef.current?.click()}
          >
            📂 Select JSON file…
          </button>

          {/* Error message */}
          {fileErrors.length > 0 && (
            <div className={styles.errorMsg}>
              {fileErrors.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}

          {/* Preview card */}
          {parsedLesson && (
            <div className={styles.previewCard}>
              <div className={styles.previewTitle}>{parsedLesson.title}</div>
              <div className={styles.previewMeta}>
                <span className={styles.previewCefr}>{parsedLesson.cefr_level ?? "—"}</span>
                {" · "}
                {parsedLesson.content?.[0]?.type
                  ? (parsedLesson.content[0].type.charAt(0).toUpperCase() + parsedLesson.content[0].type.slice(1).replace(/_/g, " "))
                  : "Lesson"}
                {" · "}
                {blockCount} block{blockCount !== 1 ? "s" : ""}
              </div>

              {fileWarnings.length > 0 && (
                <div className={styles.warningMsg}>
                  ⚠️ {fileWarnings.map((w, i) => <div key={i}>{w}</div>)}
                </div>
              )}

              <button
                className={`${styles.importBtn} ${
                  importStatus === "importing" ? styles.importBtnLoading :
                  importStatus === "done"      ? styles.importBtnDone    : ""
                }`}
                onClick={handleImport}
                disabled={importStatus !== "idle"}
              >
                {importStatus === "importing" ? "Importing…" :
                 importStatus === "done"      ? "Imported!" :
                 importStatus === "error"     ? "Error — try again" :
                 "Import lesson"}
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}