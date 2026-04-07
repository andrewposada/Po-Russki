// src/modules/Grammar/GrammarFreeplay.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../AuthContext";
import { getAllLessonCompletions, addXP } from "../../storage";
import { GRAMMAR_ROADMAP } from "../../data/roadmaps/grammarRoadmap";
import {
  LESSON_STATE,
  GRAMMAR_EXERCISE_TYPES,
  getNodeState,
  prerequisitesMet,
} from "../../constants";
import styles from "./GrammarFreeplay.module.css";

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildNodeMap() {
  return GRAMMAR_ROADMAP.reduce((acc, n) => { acc[n.id] = n; return acc; }, {});
}

// Topics a user can drill: node state >= IN_PROGRESS
function getDrillableTopics(completions) {
  const nodeMap = buildNodeMap();
  return GRAMMAR_ROADMAP.filter(node => {
    const prereqsMet = prerequisitesMet(node.prerequisites, nodeMap, completions);
    if (!prereqsMet) return false;
    const state = getNodeState(node.lessons.map(l => ({ id: l.id })), completions);
    return state >= LESSON_STATE.IN_PROGRESS;
  });
}

// ── Grade helpers ────────────────────────────────────────────────────────────

async function gradeFillin(answer, exercise) {
  try {
    const res = await fetch("/api/lesson-grade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answer,
        target_word: exercise.target_word,
        grammar_context: exercise.grammar_context,
        prompt_ru: exercise.prompt_ru,
      }),
    });
    const data = await res.json();
    return data.correct === true || (typeof data.result === "string" && data.result.toLowerCase().startsWith("yes"));
  } catch {
    return false;
  }
}

async function gradeTranslate(answer, exercise) {
  // Reuse lesson-grade with a synthetic context
  const target = exercise.target;
  const alternatives = exercise.acceptable_alternatives ?? [];
  const allAccepted = [target, ...alternatives].map(s => s.toLowerCase().trim());
  if (allAccepted.includes(answer.toLowerCase().trim())) return true;
  // Fall back to API for fuzzy matching
  try {
    const res = await fetch("/api/lesson-grade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answer,
        target_word: target,
        grammar_context: exercise.grammar_focus ?? "translation",
        prompt_ru: exercise.source,
      }),
    });
    const data = await res.json();
    return data.correct === true || (typeof data.result === "string" && data.result.toLowerCase().startsWith("yes"));
  } catch {
    return false;
  }
}

async function gradeTransform(answer, exercise) {
  try {
    const res = await fetch("/api/lesson-grade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answer,
        target_word: exercise.target_word,
        grammar_context: exercise.grammar_context,
        prompt_ru: exercise.source_word,
      }),
    });
    const data = await res.json();
    return data.correct === true || (typeof data.result === "string" && data.result.toLowerCase().startsWith("yes"));
  } catch {
    return false;
  }
}

async function gradeError(answer, exercise) {
  const clean = (s) => s.toLowerCase().trim().replace(/[.,!?;:]/g, "");
  return clean(answer) === clean(exercise.correct_word);
}

// ── Main component ───────────────────────────────────────────────────────────

export default function GrammarFreeplay() {
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const location   = useLocation();

  // ── Config state ──────────────────────────────────────────────────────────
  const [view, setView]                     = useState("config"); // "config" | "session" | "summary"
  const [completions, setCompletions]       = useState({});
  const [drillableTopics, setDrillableTopics] = useState([]);
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [selectedTypes, setSelectedTypes]   = useState(["fillin", "mc"]);
  const [cefrLevel, setCefrLevel]           = useState("A2");
  const [loadingTopics, setLoadingTopics]   = useState(true);

  // ── Session state ─────────────────────────────────────────────────────────
  const [exercise, setExercise]             = useState(null);
  const [exerciseType, setExerciseType]     = useState(null);
  const [exerciseTopic, setExerciseTopic]   = useState(null); // roadmap node
  const [generating, setGenerating]         = useState(false);
  const [answer, setAnswer]                 = useState("");
  const [submitted, setSubmitted]           = useState(false);
  const [isCorrect, setIsCorrect]           = useState(null);
  const [grading, setGrading]               = useState(false);
  const [sessionAnswers, setSessionAnswers] = useState([]); // { topicId, correct }
  const [score, setScore]                   = useState({ correct: 0, total: 0 });
  const [newlyMastered, setNewlyMastered]   = useState([]); // topic IDs newly mastered this session

  // Ref mirrors for stale closure safety
  const sessionAnswersRef = useRef([]);
  const scoreRef          = useRef({ correct: 0, total: 0 });

  // ── URL param initialisation ──────────────────────────────────────────────
  // Runs after completions load — pre-selects topics/types from URL
  const urlParamsApplied = useRef(false);

  // ── Load completions ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    async function load() {
      const rows = await getAllLessonCompletions(user.uid);
      const map  = {};
      (rows ?? []).forEach(r => { map[r.lesson_id] = r; });
      setCompletions(map);

      const drillable = getDrillableTopics(map);
      setDrillableTopics(drillable);

      // Read last-used config from localStorage
      let lastConfig = null;
      try {
        const stored = localStorage.getItem("ru_grammar_freeplay_last");
        if (stored) lastConfig = JSON.parse(stored);
      } catch { /* ignore */ }

      // Apply URL params first (highest priority), then last-used, then defaults
      const params = new URLSearchParams(location.search);
      const urlTopics = params.get("topics")?.split(",").filter(Boolean) ?? [];
      const urlTypes  = params.get("types")?.split(",").filter(Boolean)  ?? [];
      const urlLevel  = params.get("level") ?? "";

      if (!urlParamsApplied.current) {
        urlParamsApplied.current = true;
        if (urlTopics.length > 0) {
          setSelectedTopics(urlTopics);
        } else if (lastConfig?.topics?.length > 0) {
          // Only keep topics that are still drillable
          const drillableIds = drillable.map(t => t.id);
          const valid = lastConfig.topics.filter(id => drillableIds.includes(id));
          setSelectedTopics(valid.length > 0 ? valid : drillable.slice(0, 3).map(t => t.id));
        } else {
          setSelectedTopics(drillable.slice(0, 3).map(t => t.id));
        }

        if (urlTypes.length > 0) {
          setSelectedTypes(urlTypes);
        } else if (lastConfig?.types?.length > 0) {
          setSelectedTypes(lastConfig.types);
        }

        if (urlLevel) {
          setCefrLevel(urlLevel);
        } else if (lastConfig?.level) {
          setCefrLevel(lastConfig.level);
        }
      }

      setLoadingTopics(false);
    }
    load();
  }, [user]);

  // ── Topic toggle ──────────────────────────────────────────────────────────
  function toggleTopic(id) {
    setSelectedTopics(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  }

  // ── Exercise type toggle ──────────────────────────────────────────────────
  function toggleType(id) {
    setSelectedTypes(prev => {
      if (prev.includes(id)) {
        // Don't allow deselecting last type
        return prev.length > 1 ? prev.filter(t => t !== id) : prev;
      }
      return [...prev, id];
    });
  }

  // ── Start session ─────────────────────────────────────────────────────────
  async function startSession() {
    if (selectedTopics.length === 0) return;
    // Save config to localStorage
    try {
      localStorage.setItem("ru_grammar_freeplay_last", JSON.stringify({
        topics: selectedTopics,
        types:  selectedTypes,
        level:  cefrLevel,
      }));
    } catch { /* ignore */ }

    setScore({ correct: 0, total: 0 });
    scoreRef.current = { correct: 0, total: 0 };
    setSessionAnswers([]);
    sessionAnswersRef.current = [];
    setNewlyMastered([]);
    setView("session");
    await generateNextExercise();
  }

  // ── Generate next exercise ────────────────────────────────────────────────
  const generateNextExercise = useCallback(async () => {
    setExercise(null);
    setAnswer("");
    setSubmitted(false);
    setIsCorrect(null);
    setGenerating(true);

    // Pick a random topic from selected (weighted toward weaker topics later if desired)
    const validTopics = drillableTopics.filter(t => selectedTopics.includes(t.id));
    if (validTopics.length === 0) { setGenerating(false); return; }
    const topic = validTopics[Math.floor(Math.random() * validTopics.length)];

    // Pick a random exercise type from selected
    const type = selectedTypes[Math.floor(Math.random() * selectedTypes.length)];

    setExerciseTopic(topic);
    setExerciseType(type);

    try {
      const res = await fetch("/api/grammar-freeplay-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicId:      topic.id,
          topicTitle:   topic.title,
          exerciseType: type,
          cefrLevel,
        }),
      });
      const data = await res.json();
      if (data.exercise) {
        setExercise(data.exercise);
      } else {
        setExercise({ error: data.error ?? "Failed to generate exercise" });
      }
    } catch (err) {
      setExercise({ error: err.message });
    }

    setGenerating(false);
  }, [drillableTopics, selectedTopics, selectedTypes, cefrLevel]);

  // ── Submit answer ─────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!exercise || !answer.trim() || submitted || grading) return;
    setGrading(true);

    let correct = false;
    try {
      if (exerciseType === "fillin")    correct = await gradeFillin(answer, exercise);
      if (exerciseType === "translate") correct = await gradeTranslate(answer, exercise);
      if (exerciseType === "transform") correct = await gradeTransform(answer, exercise);
      if (exerciseType === "error")     correct = await gradeError(answer, exercise);
    } catch { correct = false; }

    setIsCorrect(correct);
    setSubmitted(true);
    setGrading(false);

    // Update score — use ref to avoid stale closure
    const newScore = {
      correct: scoreRef.current.correct + (correct ? 1 : 0),
      total:   scoreRef.current.total + 1,
    };
    scoreRef.current = newScore;
    setScore(newScore);

    // Record answer
    const newAnswers = [...sessionAnswersRef.current, { topicId: exerciseTopic?.id, correct }];
    sessionAnswersRef.current = newAnswers;
    setSessionAnswers(newAnswers);

    // Award XP for correct answer
    if (correct && user) {
      addXP(user.uid, 5); // fire and forget — cosmetic
    }
  }

  // MC is graded client-side — no async needed
  function handleMCAnswer(optionIndex) {
    if (submitted) return;
    const correct = optionIndex === exercise.correct_index;
    setAnswer(String(optionIndex));
    setIsCorrect(correct);
    setSubmitted(true);

    const newScore = {
      correct: scoreRef.current.correct + (correct ? 1 : 0),
      total:   scoreRef.current.total + 1,
    };
    scoreRef.current = newScore;
    setScore(newScore);

    const newAnswers = [...sessionAnswersRef.current, { topicId: exerciseTopic?.id, correct }];
    sessionAnswersRef.current = newAnswers;
    setSessionAnswers(newAnswers);

    if (correct && user) addXP(user.uid, 5);
  }

  // ── Stop session ──────────────────────────────────────────────────────────
  function stopSession() {
    setView("summary");
  }

  // ── Exercise card — inline JSX variable (contains input) ─────────────────
  // Must NOT be extracted as a component — would reset input focus on each render.

  const exerciseCard = (() => {
    if (generating || !exercise) {
      return (
        <div className={styles.exerciseCard}>
          <div className={styles.cardSkeleton} />
          <div className={styles.cardSkeleton} style={{ width: "60%", marginTop: 10 }} />
        </div>
      );
    }

    if (exercise.error) {
      return (
        <div className={styles.exerciseCard}>
          <p className={styles.errorText}>⚠️ {exercise.error}</p>
          <button className={styles.btnNext} onClick={generateNextExercise}>Try again →</button>
        </div>
      );
    }

    // ── Fill in the Blank ──
    if (exerciseType === "fillin") {
      const parts = (exercise.prompt_ru ?? "").split("_____");
      return (
        <div className={styles.exerciseCard}>
          <div className={styles.topicTag}>{exerciseTopic?.title}</div>
          <div className={styles.exerciseTypeTag}>Fill in the Blank</div>
          <div className={styles.promptEn}>{exercise.prompt_en}</div>
          <div className={styles.promptRu}>
            {parts[0]}
            <input
              className={`${styles.inlineInput} ${submitted ? (isCorrect ? styles.inputCorrect : styles.inputWrong) : ""}`}
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !submitted && handleSubmit()}
              disabled={submitted}
              placeholder="___"
              autoFocus
            />
            {parts[1]}
          </div>
          {exercise.hint && !submitted && (
            <div className={styles.hint}>💡 {exercise.hint}</div>
          )}
          {!submitted && (
            <button
              className={styles.btnSubmit}
              onClick={handleSubmit}
              disabled={!answer.trim() || grading}
            >
              {grading ? "Checking…" : "Check →"}
            </button>
          )}
          {submitted && (
            <div className={`${styles.feedback} ${isCorrect ? styles.feedbackCorrect : styles.feedbackWrong}`}>
              {isCorrect ? "✓ Correct!" : `✗ The answer is: ${exercise.target_word}`}
              {!isCorrect && exercise.grammar_context && (
                <span className={styles.feedbackContext}> ({exercise.grammar_context})</span>
              )}
            </div>
          )}
        </div>
      );
    }

    // ── Multiple Choice ──
    if (exerciseType === "mc") {
      return (
        <div className={styles.exerciseCard}>
          <div className={styles.topicTag}>{exerciseTopic?.title}</div>
          <div className={styles.exerciseTypeTag}>Multiple Choice</div>
          {exercise.context_ru && (
            <div className={styles.contextRu}>{exercise.context_ru}</div>
          )}
          <div className={styles.question}>{exercise.question}</div>
          <div className={styles.mcOptions}>
            {(exercise.options ?? []).map((opt, i) => {
              let cls = styles.mcOption;
              if (submitted) {
                if (i === exercise.correct_index) cls = `${styles.mcOption} ${styles.mcCorrect}`;
                else if (answer === String(i))    cls = `${styles.mcOption} ${styles.mcWrong}`;
              }
              return (
                <button
                  key={i}
                  className={cls}
                  onClick={() => handleMCAnswer(i)}
                  disabled={submitted}
                >
                  {opt}
                </button>
              );
            })}
          </div>
          {submitted && exercise.explanation && (
            <div className={`${styles.feedback} ${isCorrect ? styles.feedbackCorrect : styles.feedbackWrong}`}>
              {exercise.explanation}
            </div>
          )}
        </div>
      );
    }

    // ── Translate ──
    if (exerciseType === "translate") {
      const dirLabel = exercise.direction === "ru_to_en" ? "Translate to English" : "Translate to Russian";
      return (
        <div className={styles.exerciseCard}>
          <div className={styles.topicTag}>{exerciseTopic?.title}</div>
          <div className={styles.exerciseTypeTag}>{dirLabel}</div>
          <div className={styles.promptRu}>{exercise.source}</div>
          <input
            className={`${styles.textInput} ${submitted ? (isCorrect ? styles.inputCorrect : styles.inputWrong) : ""}`}
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !submitted && handleSubmit()}
            disabled={submitted}
            placeholder="Your translation…"
            autoFocus
          />
          {!submitted && (
            <button
              className={styles.btnSubmit}
              onClick={handleSubmit}
              disabled={!answer.trim() || grading}
            >
              {grading ? "Checking…" : "Check →"}
            </button>
          )}
          {submitted && (
            <div className={`${styles.feedback} ${isCorrect ? styles.feedbackCorrect : styles.feedbackWrong}`}>
              {isCorrect ? "✓ Correct!" : `✗ ${exercise.target}`}
            </div>
          )}
        </div>
      );
    }

    // ── Spot the Error ──
    if (exerciseType === "error") {
      return (
        <div className={styles.exerciseCard}>
          <div className={styles.topicTag}>{exerciseTopic?.title}</div>
          <div className={styles.exerciseTypeTag}>Spot the Error</div>
          <div className={styles.promptEn}>{exercise.sentence_en}</div>
          <div className={styles.promptRu}>{exercise.sentence_ru}</div>
          <div className={styles.hint}>Find the error and type the correct form of the word.</div>
          <input
            className={`${styles.textInput} ${submitted ? (isCorrect ? styles.inputCorrect : styles.inputWrong) : ""}`}
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !submitted && handleSubmit()}
            disabled={submitted}
            placeholder="Corrected word…"
            autoFocus
          />
          {!submitted && (
            <button
              className={styles.btnSubmit}
              onClick={handleSubmit}
              disabled={!answer.trim() || grading}
            >
              {grading ? "Checking…" : "Check →"}
            </button>
          )}
          {submitted && (
            <div className={`${styles.feedback} ${isCorrect ? styles.feedbackCorrect : styles.feedbackWrong}`}>
              {isCorrect ? "✓ Correct!" : `✗ ${exercise.correct_word}`}
              {exercise.explanation && (
                <span className={styles.feedbackContext}> — {exercise.explanation}</span>
              )}
            </div>
          )}
        </div>
      );
    }

    // ── Transform ──
    if (exerciseType === "transform") {
      return (
        <div className={styles.exerciseCard}>
          <div className={styles.topicTag}>{exerciseTopic?.title}</div>
          <div className={styles.exerciseTypeTag}>Transform</div>
          <div className={styles.promptEn}>{exercise.prompt}</div>
          <div className={styles.promptRu}>{exercise.source_word}
            {exercise.source_context && (
              <span className={styles.sourceContext}> — {exercise.source_context}</span>
            )}
          </div>
          <input
            className={`${styles.textInput} ${submitted ? (isCorrect ? styles.inputCorrect : styles.inputWrong) : ""}`}
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !submitted && handleSubmit()}
            disabled={submitted}
            placeholder="Transformed form…"
            autoFocus
          />
          {!submitted && (
            <button
              className={styles.btnSubmit}
              onClick={handleSubmit}
              disabled={!answer.trim() || grading}
            >
              {grading ? "Checking…" : "Check →"}
            </button>
          )}
          {submitted && (
            <div className={`${styles.feedback} ${isCorrect ? styles.feedbackCorrect : styles.feedbackWrong}`}>
              {isCorrect ? "✓ Correct!" : `✗ ${exercise.target_word}`}
              {exercise.grammar_context && (
                <span className={styles.feedbackContext}> ({exercise.grammar_context})</span>
              )}
            </div>
          )}
        </div>
      );
    }

    return null;
  })();

  // ── Render: loading ───────────────────────────────────────────────────────
  if (loadingTopics) {
    return (
      <div className={styles.root}>
        <div className={styles.skeleton} style={{ height: 28, width: "60%", marginBottom: 16 }} />
        <div className={styles.skeleton} style={{ height: 18, width: "40%" }} />
      </div>
    );
  }

  // ── Render: config ────────────────────────────────────────────────────────
  if (view === "config") {
    return (
      <div className={styles.root}>
        <div className={styles.configHeader}>
          <button className={styles.backBtn} onClick={() => navigate("/grammar")}>← Back</button>
          <h2 className={styles.configTitle}>Grammar Freeplay</h2>
        </div>

        {drillableTopics.length === 0 && (
          <div className={styles.emptyHint}>
            Complete at least one lesson in the Lessons module to unlock grammar freeplay topics.
          </div>
        )}

        {/* Topics */}
        <div className={styles.configSection}>
          <div className={styles.configLabel}>Topics</div>
          <div className={styles.pillRow}>
            {GRAMMAR_ROADMAP.map(node => {
              const drillable = drillableTopics.some(t => t.id === node.id);
              const selected  = selectedTopics.includes(node.id);
              return (
                <button
                  key={node.id}
                  className={`${styles.pill} ${selected ? styles.pillSelected : ""} ${!drillable ? styles.pillDisabled : ""}`}
                  onClick={() => drillable && toggleTopic(node.id)}
                  disabled={!drillable}
                  title={!drillable ? "Complete this topic's lesson to unlock" : undefined}
                >
                  {node.title}
                </button>
              );
            })}
          </div>
        </div>

        {/* Exercise types */}
        <div className={styles.configSection}>
          <div className={styles.configLabel}>Exercise Types</div>
          <div className={styles.pillRow}>
            {GRAMMAR_EXERCISE_TYPES.map(t => (
              <button
                key={t.id}
                className={`${styles.pill} ${selectedTypes.includes(t.id) ? styles.pillSelected : ""}`}
                onClick={() => toggleType(t.id)}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* CEFR level */}
        <div className={styles.configSection}>
          <div className={styles.configLabel}>Level</div>
          <div className={styles.pillRow}>
            {["A1","A2","B1","B2","C1"].map(lvl => (
              <button
                key={lvl}
                className={`${styles.pill} ${cefrLevel === lvl ? styles.pillSelected : ""}`}
                onClick={() => setCefrLevel(lvl)}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        <button
          className={styles.btnStart}
          onClick={startSession}
          disabled={selectedTopics.length === 0}
        >
          Start Session →
        </button>
      </div>
    );
  }

  // ── Render: session ───────────────────────────────────────────────────────
  if (view === "session") {
    return (
      <div className={styles.root}>
        {/* Session header */}
        <div className={styles.sessionHeader}>
          <button className={styles.stopBtn} onClick={stopSession}>Stop</button>
          <div className={styles.sessionScore}>
            {score.correct} / {score.total} correct
          </div>
        </div>

        {/* Exercise card (inline JSX variable — contains input) */}
        {exerciseCard}

        {/* Next button — only shown after answer submitted */}
        {submitted && !generating && (
          <button className={styles.btnNext} onClick={generateNextExercise}>
            Next →
          </button>
        )}

        {/* Mastery celebration (inline, no modal) */}
        {newlyMastered.length > 0 && (
          <div className={styles.masteryBanner}>
            {newlyMastered.map(id => {
              const node = GRAMMAR_ROADMAP.find(n => n.id === id);
              return node ? (
                <div key={id}>✨ Мастер! You've mastered {node.title}.</div>
              ) : null;
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Render: summary ───────────────────────────────────────────────────────
  const pct = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;
  return (
    <div className={styles.root}>
      <div className={styles.summaryCard}>
        <div className={styles.summaryTitle}>Session complete</div>
        <div className={styles.summaryScore}>
          {score.correct} / {score.total}
        </div>
        <div className={styles.summaryPct}>{pct}% correct</div>
        <div className={styles.summaryXp}>+{score.correct * 5} XP earned</div>
        {newlyMastered.length > 0 && (
          <div className={styles.masteredList}>
            {newlyMastered.map(id => {
              const node = GRAMMAR_ROADMAP.find(n => n.id === id);
              return node ? <div key={id} className={styles.masteredItem}>✨ Mastered: {node.title}</div> : null;
            })}
          </div>
        )}
        <div className={styles.summaryActions}>
          <button className={styles.btnPrimary} onClick={() => { setView("config"); }}>
            Practice Again
          </button>
          <button className={styles.btnSecondary} onClick={() => navigate("/grammar")}>
            Back to Grammar
          </button>
        </div>
      </div>
    </div>
  );
}