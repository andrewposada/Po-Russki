import { useState } from "react";
import { useAuth } from "./AuthContext";
import { supabase } from "./supabase";
import {
  saveSettings,
  upsertWord,
  upsertScoreByIds,
  saveNarrative,
  upsertBook,
  upsertChapter,
  saveComprehensionAttempt,
  getRefCache,
} from "./storage";

// ── Helper: parse a value that may be a double-encoded JSON string ─────────
function parseVal(v) {
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return v; }
  }
  return v;
}

// ── Score key parsers — actual format is "Nominative|Noun|Singular" ────────
const CASE_MAP = {
  "Nominative": "nominative", "Accusative": "accusative", "Genitive": "genitive",
  "Dative": "dative", "Instrumental": "instrumental", "Prepositional": "prepositional",
};
const POS_MAP = {
  "Noun": "noun", "Adjective": "adjective", "Pronoun": "pronoun", "Verb": "verb",
};
const NUM_MAP  = { "Singular": "singular", "Plural": "plural" };
const TENSE_MAP  = { "present": "present", "past": "past", "future": "future" };
const ASPECT_MAP = { "imperfective": "imperfective", "perfective": "perfective" };
const CLASS_MAP  = { "class1": "class1", "class2": "class2", "irregular": "irregular" };

function parseGrammarKey(key, ref) {
  // e.g. "Nominative|Noun|Singular"
  const parts = key.split("|");
  if (parts.length < 3) return null;
  const [casePart, posPart, numPart] = parts;
  const caseNameId = ref.caseName[CASE_MAP[casePart]] ?? null;
  const posId      = ref.pos[POS_MAP[posPart]]        ?? null;
  const numberId   = ref.number[NUM_MAP[numPart]]     ?? null;
  if (!caseNameId || !posId || !numberId) return null;
  return { caseNameId, posId, numberId };
}

function parseConjKey(key, ref) {
  // e.g. "present|imperfective|class1"
  const parts = key.split("|");
  if (parts.length < 3) return null;
  const [tense, aspect, verbClass] = parts;
  const tenseId     = ref.tense[TENSE_MAP[tense]]         ?? null;
  const aspectId    = ref.aspect[ASPECT_MAP[aspect]]       ?? null;
  const verbClassId = ref.verbClass[CLASS_MAP[verbClass]]  ?? null;
  if (!tenseId || !aspectId || !verbClassId) return null;
  return { tenseId, aspectId, verbClassId };
}

async function createMigrationSession(userId, ref) {
  const { data, error } = await supabase
    .from("sessions")
    .insert({
      user_id:         userId,
      session_type_id: ref.sessionType["migration"],
      domain_id:       null,
      is_complete:     true,
      ended_at:        new Date(),
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export default function DataMigration() {
  const [status,   setStatus]   = useState("idle");
  const [log,      setLog]      = useState([]);
  const [progress, setProgress] = useState("");
  const { user, loading } = useAuth();

  function addLog(msg) { setLog(prev => [...prev, msg]); }

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setStatus("running");
    setLog([]);

    let raw;
    try {
      raw = JSON.parse(await file.text());
      addLog(`✅ Loaded export file — ${Object.keys(raw).length} keys found`);
    } catch (err) {
      addLog(`❌ Could not parse file: ${err.message}`);
      setStatus("error");
      return;
    }

    // All values may be double-encoded JSON strings — parse each one
    const exportData = {};
    for (const [k, v] of Object.entries(raw)) {
      exportData[k] = parseVal(v);
    }

    try {
      if (!user) throw new Error("Not logged in — please log in first");
      const userId = user.uid;

      setProgress("Loading reference data…");
      const ref = await getRefCache();
      addLog("✅ Reference tables loaded");

      // ── 1. User settings ──────────────────────────────────────────────
      setProgress("Migrating settings…");
      const gs = exportData["ru_global_settings"] ?? {};
      await saveSettings(userId, {
        cefrLevel:       exportData["ru_vocab_level"] ?? gs.level ?? "A2",
        cursiveFont:     gs.cursive     ?? false,
        transliteration: gs.translitOn  ?? false,
      });
      addLog("✅ Settings migrated");

      // ── 2. Words ──────────────────────────────────────────────────────
      // ru_wordbank: array of word objects with full metadata
      // ru_mastered: array of word objects (mastered words)
      // ru_vprof: CEFR level map — NOT per-word proficiency, skip for word data
      setProgress("Migrating vocabulary…");
      const wordBank    = Array.isArray(exportData["ru_wordbank"]) ? exportData["ru_wordbank"] : [];
      const mastered    = Array.isArray(exportData["ru_mastered"]) ? exportData["ru_mastered"] : [];
      const masteredSet = new Set(mastered.map(w => (typeof w === "string" ? w : w.word)).filter(Boolean));
      let wordCount = 0;

      // Merge wordbank + mastered into one set, mastered words get proficiency 100
      const allWords = new Map();
      for (const entry of wordBank) {
        const word = typeof entry === "string" ? entry : entry.word;
        if (!word) continue;
        allWords.set(word, {
          word,
          translation:   entry.translation   ?? null,
          pronunciation: entry.pronunciation ?? null,
          etymology:     entry.etymology     ?? null,
          usageExample:  entry.usageExample  ?? null,
          cefrLevel:     entry.cefrLevel     ?? null,
          proficiency:   masteredSet.has(word) ? 100 : (entry.proficiency ?? 0),
          isMastered:    masteredSet.has(word),
        });
      }
      // Add mastered words not already in wordbank
      for (const entry of mastered) {
        const word = typeof entry === "string" ? entry : entry.word;
        if (!word || allWords.has(word)) continue;
        allWords.set(word, {
          word,
          translation:   entry.translation   ?? null,
          pronunciation: entry.pronunciation ?? null,
          etymology:     entry.etymology     ?? null,
          usageExample:  entry.usageExample  ?? null,
          cefrLevel:     entry.cefrLevel     ?? null,
          proficiency:   100,
          isMastered:    true,
        });
      }

      for (const wordObj of allWords.values()) {
        await upsertWord(userId, wordObj);
        wordCount++;
      }
      addLog(`✅ Vocabulary migrated: ${wordCount} words (${masteredSet.size} mastered)`);

      // ── 3. Scores ─────────────────────────────────────────────────────
      // Keys are "Nominative|Noun|Singular" for grammar
      // and "conj:present|imperfective|class1" for conjugation
      setProgress("Migrating scores…");
      const scoresObj    = exportData["ru_scores"] ?? {};
      const grammarDomId = ref.domain["grammar"];
      const conjDomId    = ref.domain["conjugation"];
      let scoreCount = 0, scoreSkipped = 0;

      for (const [key, scoreValue] of Object.entries(scoresObj)) {
        // Skip reading scores — no reading scores table
        if (key.startsWith("reading:")) { scoreSkipped++; continue; }

        const score = typeof scoreValue === "number" ? scoreValue : 30;

        try {
          if (key.startsWith("conj:")) {
            const dims = parseConjKey(key.replace("conj:", ""), ref);
            if (!dims) { scoreSkipped++; continue; }
            await upsertScoreByIds(userId, { domainId: conjDomId, ...dims, score });
          } else {
            const dims = parseGrammarKey(key, ref);
            if (!dims) { scoreSkipped++; continue; }
            await upsertScoreByIds(userId, { domainId: grammarDomId, ...dims, score });
          }
          scoreCount++;
        } catch (scoreErr) {
          console.warn(`Skipped score key "${key}":`, scoreErr.message);
          scoreSkipped++;
        }
      }
      addLog(`✅ Scores migrated: ${scoreCount} entries (${scoreSkipped} skipped — reading scores not stored)`);

      // ── 4. Narratives ─────────────────────────────────────────────────
      // ru_narrative_g/v are objects with {where_i_am, what_to_work_on}
      setProgress("Migrating narratives…");
      const answerBuf = Array.isArray(exportData["ru_answer_buf"]) ? exportData["ru_answer_buf"] : [];

      if (exportData["ru_narrative_g"]) {
        const ng = exportData["ru_narrative_g"];
        // Flatten the object fields into a readable string
        const content = typeof ng === "string"
          ? ng
          : [ng.where_i_am, ng.what_to_work_on].filter(Boolean).join("\n\n");
        await saveNarrative(userId, "grammar", content, answerBuf);
        addLog("✅ Grammar narrative migrated");
      }
      if (exportData["ru_narrative_v"]) {
        const nv = exportData["ru_narrative_v"];
        const content = typeof nv === "string"
          ? nv
          : [nv.where_i_am, nv.what_to_work_on].filter(Boolean).join("\n\n");
        await saveNarrative(userId, "vocabulary", content, []);
        addLog("✅ Vocab narrative migrated");
      }

      // ── 5. Retry queue ────────────────────────────────────────────────
      setProgress("Migrating retry queue…");
      const retryQueue = Array.isArray(exportData["ru_retry_queue"]) ? exportData["ru_retry_queue"] : [];
      if (retryQueue.length > 0) {
        const migSessionId = await createMigrationSession(userId, ref);
        let retryCount = 0;

        for (const item of retryQueue) {
          try {
            const topicKey = item.topicKey ?? item.key ?? "";
            let domainId, caseNameId, posId, numberId, tenseId, aspectId, verbClassId;

            if (topicKey.startsWith("conj:")) {
              domainId = conjDomId;
              const dims = parseConjKey(topicKey.replace("conj:", ""), ref);
              if (dims) { tenseId = dims.tenseId; aspectId = dims.aspectId; verbClassId = dims.verbClassId; }
            } else {
              domainId = grammarDomId;
              const dims = parseGrammarKey(topicKey, ref);
              if (dims) { caseNameId = dims.caseNameId; posId = dims.posId; numberId = dims.numberId; }
            }

            const exType = ref.exType.find(e => e.domain_id === domainId && e.name === "fill_in");

            const { data: attemptData } = await supabase
              .from("exercise_attempts")
              .insert({
                user_id:           userId,
                session_id:        migSessionId,
                domain_id:         domainId,
                exercise_type_id:  exType?.id        ?? null,
                case_name_id:      caseNameId         ?? null,
                part_of_speech_id: posId              ?? null,
                number_id:         numberId           ?? null,
                tense_id:          tenseId            ?? null,
                aspect_id:         aspectId           ?? null,
                verb_class_id:     verbClassId        ?? null,
                question:          item.question      ?? "(migrated)",
                correct_answer:    item.correctAnswer ?? "(migrated)",
                user_answer:       item.userAnswer    ?? "(migrated)",
                is_correct:        false,
                is_migration_seed: true,
              })
              .select("id")
              .single();

            if (attemptData) {
              await supabase.from("retry_queue").insert({
                user_id:         userId,
                last_attempt_id: attemptData.id,
                error_count:     item.errorCount ?? 1,
              });
              retryCount++;
            }
          } catch (itemErr) {
            console.warn("Skipped retry queue item:", itemErr.message);
          }
        }
        addLog(`✅ Retry queue migrated: ${retryCount} items`);
      } else {
        addLog("✅ Retry queue was empty — nothing to migrate");
      }

      // ── 6. Books and chapters ──────────────────────────────────────────
      // Chapters are in ru_library_chapters as a flat object:
      // { "lib_xxx_ch1": { bookId, chapterNumber, russianSegments, ... }, ... }
      setProgress("Migrating library…");
      const libMeta    = Array.isArray(exportData["ru_library_meta"]) ? exportData["ru_library_meta"] : [];
      const allChapters = exportData["ru_library_chapters"] ?? {};
      let bookCount = 0, chapterCount = 0;

      for (const book of libMeta) {
        const bookId = await upsertBook(userId, {
          title:    book.title    ?? "Untitled",
          level:    book.level    ?? "A2",
          synopsis: book.synopsis ?? book.description ?? null,
          status:   book.archived ? "archived" : "active",
        });

        // Find all chapter keys belonging to this book
        const bookChapterKeys = Object.keys(allChapters).filter(k => k.startsWith(book.id));

        for (const ck of bookChapterKeys) {
          const chData = allChapters[ck];
          // Chapter number from chapterNumber field or parse from key suffix
          const chapterNum = chData.chapterNumber
            ?? parseInt((ck.match(/_ch(\d+)$/) ?? [])[1] ?? "0", 10);
          if (!chapterNum) continue;

          let content = "";
          if (Array.isArray(chData.russianSegments)) {
            content = chData.russianSegments.map(s => s.russian ?? "").join(" ").trim();
          } else if (typeof chData.text === "string") {
            content = chData.text;
          } else if (typeof chData.content === "string") {
            content = chData.content;
          }
          if (!content) continue;

          await upsertChapter(bookId, chapterNum, {
            content,
            wordCount: content.split(/\s+/).filter(Boolean).length,
          });
          chapterCount++;
        }
        bookCount++;
      }
      addLog(`✅ Library migrated: ${bookCount} books, ${chapterCount} chapters`);

      // ── 7. Comprehension answers ──────────────────────────────────────
      // Keys are "lib_xxx_ch1" (underscore before ch, not pipe)
      setProgress("Migrating comprehension answers…");
      const libAnswers = exportData["ru_library_answers"] ?? {};
      let answerCount = 0;

      for (const [ck, ansData] of Object.entries(libAnswers)) {
        // Key format: lib_{id}_ch{n}  — find the _ch split point
        const match = ck.match(/^(.+)_ch(\d+)$/);
        if (!match) continue;
        const oldBookId  = match[1];
        const chapterNum = parseInt(match[2], 10);

        const oldMeta = libMeta.find(b => b.id === oldBookId);
        if (!oldMeta) continue;

        const { data: bookRow } = await supabase
          .from("books")
          .select("id")
          .eq("user_id", userId)
          .eq("title", oldMeta.title ?? "Untitled")
          .maybeSingle();
        if (!bookRow) continue;

        const { data: chapterRow } = await supabase
          .from("chapters")
          .select("id")
          .eq("book_id", bookRow.id)
          .eq("chapter_num", chapterNum)
          .maybeSingle();
        if (!chapterRow) continue;

        await saveComprehensionAttempt(userId, chapterRow.id, {
          questions: null,
          answers:   ansData ?? null,
          score:     null,
        });
        answerCount++;
      }
      addLog(`✅ Comprehension answers migrated: ${answerCount} chapters`);

      setProgress("Migration complete!");
      setStatus("done");
      addLog("🎉 All data successfully migrated to Supabase.");

    } catch (err) {
      addLog(`❌ Migration failed: ${err.message}`);
      console.error(err);
      setStatus("error");
    }
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 600, margin: "2rem auto", padding: "2rem", fontFamily: "-apple-system, sans-serif" }}>
        <p style={{ color: "#6a5e48" }}>Waiting for login…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ maxWidth: 600, margin: "2rem auto", padding: "2rem", fontFamily: "-apple-system, sans-serif" }}>
        <p style={{ color: "#c0392b" }}>Not logged in. Please <a href="/">log in first</a>, then come back to /migrate.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: "2rem auto", padding: "2rem", background: "#fffdf7",
                  borderRadius: 12, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <h2 style={{ marginBottom: "0.5rem", color: "#3a3020" }}>Data Migration</h2>
      <p style={{ color: "#6a5e48", marginBottom: "1.5rem", fontSize: "0.9rem" }}>
        Upload your <code>po-russki-export.json</code> to migrate all data to Supabase.
        This only needs to be done once. Running it again is safe — nothing will be duplicated.
      </p>

      {status !== "done" && (
        <input type="file" accept=".json" onChange={handleFileUpload}
          disabled={status === "running"} style={{ display: "block", marginBottom: "1rem" }} />
      )}

      {progress && (
        <p style={{ color: "#7a9e7e", fontSize: "0.9rem", marginBottom: "0.5rem" }}>{progress}</p>
      )}

      {log.length > 0 && (
        <div style={{ marginTop: "1rem", padding: "1rem", background: "#f5f0e8", borderRadius: 8,
                      fontSize: "0.85rem", lineHeight: 1.6, maxHeight: 300, overflowY: "auto" }}>
          {log.map((line, i) => <div key={i}>{line}</div>)}
        </div>
      )}

      {status === "done" && (
        <p style={{ marginTop: "1rem", color: "#7a9e7e", fontWeight: 600 }}>
          ✅ Migration complete. You can now use the app normally.
        </p>
      )}
    </div>
  );
}