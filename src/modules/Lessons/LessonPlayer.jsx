// src/modules/Lessons/LessonPlayer.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams }                   from "react-router-dom";
import { useAuth }                                  from "../../AuthContext";
import {
  getLessonById,
  getLessonCompletion,
  upsertLessonCompletion,
  saveLessonAnswer,
  getLessonAnswers,
  addXP,
  getUserProgress,
  getPendingAssignments,
} from "../../storage";
import { LESSON_STATE, getLevelFromXP, XP_LEVELS } from "../../constants";
import { useAttemptTracker, ATTEMPT_SOURCES, ROADMAP_TOPIC_MAP } from "../../hooks/useAttemptTracker";

import NarrativeBlock       from "./blocks/NarrativeBlock";
import RuleTableBlock       from "./blocks/RuleTableBlock";
import ExampleSetBlock      from "./blocks/ExampleSetBlock";
import CalloutBlock         from "./blocks/CalloutBlock";
import QuizBlock            from "./blocks/QuizBlock";
import PracticeBlock        from "./blocks/PracticeBlock";
import AssignmentBlock      from "./blocks/AssignmentBlock";
import FreeResponseBlock    from "./blocks/FreeResponseBlock";
import SummaryBlock         from "./blocks/SummaryBlock";
import DialogueBlock        from "./blocks/DialogueBlock";
import MiniStoryBlock       from "./blocks/MiniStoryBlock";
import DiscoveryBlock       from "./blocks/DiscoveryBlock";
import SentenceChoiceBlock  from "./blocks/SentenceChoiceBlock";
import ErrorCorrectionBlock from "./blocks/ErrorCorrectionBlock";
import { VocabContext }     from "./VocabContext";
import { upsertWord }       from "../../storage";

import styles from "./LessonPlayer.module.css";

// ── Helper: group blocks by group string ─────────────────────────────────────

function groupBlocks(content) {
  const groups = [];
  const seen   = new Map(); // group name → array index
  for (const block of content) {
    const g = block.group || "Section";
    if (!seen.has(g)) {
      seen.set(g, groups.length);
      groups.push({ name: g, blocks: [] });
    }
    groups[seen.get(g)].blocks.push(block);
  }
  return groups;
}

const ANSWERABLE = new Set([
  "quiz", "practice", "sentence_choice", "error_correction",
  "free_response_sentence", "free_response_paragraph",
]);

// ── Vocab review panel (completion screen) ────────────────────────────────────

function VocabReviewPanel({ vocab, userId }) {
  const [added, setAdded] = useState({});

  if (!vocab || vocab.length === 0) return null;

  async function handleAdd(entry, key) {
    if (added[key] || !userId) return;
    try {
      await upsertWord(userId, {
        word:          entry.word,
        translation:   entry.translation,
        pronunciation: entry.pronunciation ?? "",
        etymology:     "",
        usage_example: "",
        cefr_level:    "A1",
      });
      setAdded(a => ({ ...a, [key]: true }));
    } catch {
      // silently fail — word may already exist
    }
  }

  async function handleAddAll() {
    for (let i = 0; i < vocab.length; i++) {
      if (!added[i]) await handleAdd(vocab[i], i);
    }
  }

  return (
    <div className={styles.vocabReviewPanel}>
      <div className={styles.vocabReviewTitle}>New Words</div>
      <button className={styles.vocabReviewAddAll} onClick={handleAddAll}>
        Add all to word bank
      </button>
      <div className={styles.vocabReviewList}>
        {vocab.map((entry, i) => (
          <div key={i} className={styles.vocabReviewEntry}>
            <span className={styles.vocabReviewWord}>{entry.word}</span>
            {entry.gender && (
              <span className={styles.vocabReviewGender}>{entry.gender}</span>
            )}
            <span className={styles.vocabReviewTranslation}>{entry.translation}</span>
            <button
              className={`${styles.vocabReviewAddBtn} ${added[i] ? styles.vocabReviewAddBtnDone : ""}`}
              onClick={() => handleAdd(entry, i)}
              disabled={!!added[i]}
            >
              {added[i] ? "✓" : "+ Add"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Level-up banner ────────────────────────────────────────────────────────────

function LevelUpBanner({ level, name }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(t);
  }, []);
  if (!visible) return null;
  return (
    <div className={styles.levelUpBanner}>
      ⭐ Уровень {level} — {name}!
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function LessonPlayer() {
  const navigate     = useNavigate();
  const { lessonId } = useParams();
  const { user }     = useAuth();

  const [lesson,    setLesson]    = useState(null);
  const [groups,    setGroups]    = useState([]);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [revealedCount,     setRevealedCount]      = useState(1); // how many groups are in the DOM
  const [answered,  setAnswered]  = useState({}); // { groupIndex: true } — groups that have been answered
  const [previousAnswers, setPreviousAnswers] = useState({}); // { groupName: answerRow }
  const [loading,   setLoading]   = useState(true);
  const [completed, setCompleted] = useState(false);
  const [baselineScore, setBaselineScore] = useState(0);
  const [xpEarned,  setXpEarned]  = useState(0);
  const [hasAssignments, setHasAssignments] = useState(false);
  const [showResume, setShowResume] = useState(false);
  const [leveledUp, setLeveledUp] = useState(null); // { level: number, name: string } | null

  const { track } = useAttemptTracker();

  // Stale closure guard
  const currentGroupIndexRef    = useRef(0);
  const answeredRef             = useRef({});
  const wasAlreadyCompletedRef  = useRef(false);

  // Refs for scroll targets
  const groupRefs = useRef([]);

  useEffect(() => {
    if (!user || !lessonId) return;
    async function load() {
      const [lessonData, completion, priorAnswers] = await Promise.all([
        getLessonById(lessonId),
        getLessonCompletion(user.uid, lessonId),
        getLessonAnswers(user.uid, lessonId),
      ]);
      if (!lessonData) {
        console.error("Lesson not found or access denied:", lessonId);
        // Don't navigate immediately — show error state instead
        setLoading(false);
        return;
       }

      const grouped = groupBlocks(lessonData.content?.content || []);
      setLesson(lessonData);
      setGroups(grouped);

      // Resume
      const savedIndex = completion?.current_block_index ?? 0;
      if (savedIndex > 0 && savedIndex < grouped.length) {
        setCurrentGroupIndex(savedIndex);
        currentGroupIndexRef.current = savedIndex;
        setRevealedCount(savedIndex + 1);
        setShowResume(true);
        setTimeout(() => setShowResume(false), 2000);
      }

      // Mark if already completed (for XP idempotency check)
      const alreadyCompleted = completion && completion.state >= LESSON_STATE.COMPLETED;
      if (alreadyCompleted) {
        wasAlreadyCompletedRef.current = true;
      }

      // Build previous answers map: { [groupName]: answerRow }
      // Take the most recent answer per group (last write wins)
      const prevMap = {};
      (priorAnswers ?? []).forEach(row => {
        prevMap[row.group_name] = row;
      });
      setPreviousAnswers(prevMap);

      // Pre-seed answered state for any group that has a prior answer row
      // so Continue is enabled without re-submitting on review
      const preSeedAnswered = {};
      grouped.forEach((group, i) => {
        if (prevMap[group.name]) {
          preSeedAnswered[i] = true;
        }
      });
      answeredRef.current = preSeedAnswered;
      setAnswered(preSeedAnswered);

      // For completed lessons, reveal all groups so the full lesson is visible
      if (alreadyCompleted) {
        setRevealedCount(grouped.length);
        setCurrentGroupIndex(grouped.length - 1);
        currentGroupIndexRef.current = grouped.length - 1;
      }

      // Only write IN_PROGRESS if not already completed — reviewing a lesson
      // must not downgrade its state back to in_progress.
      if (!alreadyCompleted) {
        await upsertLessonCompletion(user.uid, lessonId, {
          state:               LESSON_STATE.IN_PROGRESS,
          current_block_index: savedIndex,
          current_group:       grouped[savedIndex]?.name ?? null,
        });
      }

      setLoading(false);
    }
    load();
  }, [user, lessonId, navigate]);

  // ── Answer handlers ───────────────────────────────────────────────────────────

  // Resolve topic ID from lesson ID (e.g. "nom-1" → 1, "gen-2" → 4)
  function lessonTopicId(lid) {
    if (!lid) return null;
    const prefix = lid.split("-")[0]; // "nom-1" → "nom"
    return ROADMAP_TOPIC_MAP[prefix] ?? null;
  }

  const handleAnswer = useCallback((groupIndex, isCorrect) => {
    answeredRef.current = { ...answeredRef.current, [groupIndex]: true };
    setAnswered({ ...answeredRef.current });
    const group = groups[groupIndex];
    if (!group) return;
    saveLessonAnswer(
      user.uid, lessonId, group.name, "quiz", null,
      String(selectedIdx ?? isCorrect),
      { correct: isCorrect }
    );
    track({
      sourceId:       ATTEMPT_SOURCES.LESSON,
      topicId:        lessonTopicId(lessonId),
      exerciseTypeId: ATTEMPT_EXERCISE_TYPES.LESSON_QUIZ,
      sourceRef:      lessonId,
      isCorrect,
    });
  }, [user, lessonId, groups, track]);

  const handleSubmit = useCallback((groupIndex, answer, isCorrect, grade) => {
    answeredRef.current = { ...answeredRef.current, [groupIndex]: true };
    setAnswered({ ...answeredRef.current });
    const group = groups[groupIndex];
    if (!group) return;
    const block     = group.blocks.find(b => ANSWERABLE.has(b.type));
    const blockType = block?.type || "practice";
    saveLessonAnswer(
      user.uid, lessonId, group.name, blockType,
      block?.prompt_ru ?? null,
      answer, grade
    );

    // Determine correctness for tracking
    // grade may be null (free_response not yet graded), { correct: bool }, or a score object
    const gradeCorrect = grade === null
      ? null   // free_response — we don't know yet; skip tracking until Phase 3G.3
      : (typeof grade === "object" ? (grade.correct ?? isCorrect) : isCorrect);

    const lessonExTypeMap = {
      practice:               ATTEMPT_EXERCISE_TYPES.LESSON_PRACTICE,
      sentence_choice:        ATTEMPT_EXERCISE_TYPES.LESSON_SENTENCE_CHOICE,
      error_correction:       ATTEMPT_EXERCISE_TYPES.LESSON_ERROR_CORRECTION,
      free_response_sentence: ATTEMPT_EXERCISE_TYPES.LESSON_FREE_RESPONSE,
      free_response_paragraph: ATTEMPT_EXERCISE_TYPES.LESSON_FREE_RESPONSE,
    };
    if (gradeCorrect !== null) {
      track({
        sourceId:       ATTEMPT_SOURCES.LESSON,
        topicId:        lessonTopicId(lessonId),
        exerciseTypeId: lessonExTypeMap[blockType] ?? null,
        sourceRef:      lessonId,
        isCorrect:      gradeCorrect,
        userAnswer:     gradeCorrect ? null : String(answer ?? ""),
        correctAnswer:  gradeCorrect ? null : (block?.target_word ?? block?.correct_answer ?? null),
      });
    }
  }, [user, lessonId, groups, track]);

  // ── Continue ──────────────────────────────────────────────────────────────────

  async function handleContinue() {
    const idx  = currentGroupIndexRef.current;
    const next = idx + 1;

    if (next >= groups.length) {
      // Lesson complete
      await finishLesson();
      return;
    }

    currentGroupIndexRef.current = next;
    setCurrentGroupIndex(next);
    setRevealedCount(next + 1);

    // Persist progress
    await upsertLessonCompletion(user.uid, lessonId, {
      current_block_index: next,
      current_group:       groups[next]?.name ?? null,
    });

    // Scroll to new group — offset by top bar height so the section header
    // lands just below the progress bar, not hidden behind it
    setTimeout(() => {
      const el = groupRefs.current[next];
      if (!el) return;
      const TOP_BAR_HEIGHT = 72; // px — matches .topBar height in LessonPlayer.module.css
      const y = el.getBoundingClientRect().top + window.scrollY - TOP_BAR_HEIGHT - 16;
      window.scrollTo({ top: y, behavior: "smooth" });
    }, 60);
  }

  async function finishLesson() {
    // Compute baseline score from quiz blocks
   const quizGroupsWithIndex = groups
  .map((g, i) => ({ group: g, index: i }))
  .filter(({ group }) => group.blocks.some(b => b.type === "quiz"));
const answeredCorrect = quizGroupsWithIndex.filter(({ index }) => answeredRef.current[index]).length;
const quizGroups = quizGroupsWithIndex.map(({ group }) => group); // for the length check below
    const score = quizGroups.length > 0
      ? Math.round((answeredCorrect / quizGroups.length) * 100)
      : 100;
    setBaselineScore(score);

    // Release assignment blocks to queue
    const assignmentBlocks = groups.flatMap(g => g.blocks.filter(b => b.type === "assignment"));
    for (const ab of assignmentBlocks) {
      const group = groups.find(g => g.blocks.includes(ab));
      await saveLessonAnswer(user.uid, lessonId, group?.name ?? "Assignment", "assignment", ab.title, JSON.stringify(ab.exercises), null);
    }
    if (assignmentBlocks.length > 0) setHasAssignments(true);

    // Write completion
    await upsertLessonCompletion(user.uid, lessonId, {
      state:          LESSON_STATE.COMPLETED,
      baseline_score: score,
      completed_at:   new Date().toISOString(),
    });

    // Award XP only if this is the first completion (not a review)
    if (!wasAlreadyCompletedRef.current) {
      const xp = lesson.xp_reward ?? 100;
      // Snapshot level before awarding XP so we can detect level-up
      const prevProgress = await getUserProgress(user.uid);
      const prevLevel = prevProgress?.level ?? 1;
      const result = await addXP(user.uid, xp);
      setXpEarned(xp);
      // Detect level-up: if the new level from addXP is higher, show banner
      if (result && result.level > prevLevel) {
        const newLevelInfo = getLevelFromXP(result.xp_total);
        setLeveledUp({ level: result.level, name: newLevelInfo.name });
      }
    } else {
      setXpEarned(0);
    }


    setCompleted(true);
  }

  // ── Continue button enable logic ─────────────────────────────────────────────

  function continueEnabled() {
    const group = groups[currentGroupIndex];
    if (!group) return false;
    const hasAnswerable = group.blocks.some(b => ANSWERABLE.has(b.type) && b.type !== "assignment");
    if (!hasAnswerable) return true;
    return !!answered[currentGroupIndex];
  }

  // ── Block renderer (inline JSX variable — do not extract) ─────────────────────

  function renderBlocks(group, groupIndex) {
    const prevAnswer = previousAnswers[group.name] ?? null;
    const blocks = group.blocks.map((block, i) => {
      switch (block.type) {
        case "narrative":
          return <NarrativeBlock key={i} block={block} />;
        case "rule_table":
          return <RuleTableBlock key={i} block={block} />;
        case "example_set":
          return <ExampleSetBlock key={i} block={block} />;
        case "callout":
          return <CalloutBlock key={i} block={block} />;
        case "quiz":
          return (
            <QuizBlock
              key={i}
              block={block}
              onAnswer={(correct) => handleAnswer(groupIndex, correct)}
              previousAnswer={prevAnswer}
            />
          );
        case "practice":
          return (
            <PracticeBlock
              key={i}
              block={block}
              onSubmit={(answer, correct, grade) => handleSubmit(groupIndex, answer, correct, grade)}
              previousAnswer={prevAnswer}
            />
          );
        case "assignment":
          return <AssignmentBlock key={i} block={block} />;
        case "free_response_sentence":
        case "free_response_paragraph":
          return (
            <FreeResponseBlock
              key={i}
              block={block}
              onSubmit={(answer, correct, grade) => handleSubmit(groupIndex, answer, correct, grade)}
              previousAnswer={prevAnswer}
              lessonId={lessonId}
              topicId={lessonTopicId(lessonId)}
            />
          );
        case "summary":
          return <SummaryBlock key={i} block={block} />;
        case "dialogue":
          return <DialogueBlock key={i} block={block} />;
        case "mini_story":
          return <MiniStoryBlock key={i} block={block} />;
        case "discovery":
          return <DiscoveryBlock key={i} block={block} />;
        case "sentence_choice":
          return (
            <SentenceChoiceBlock
              key={i}
              block={block}
              onAnswer={(correct) => handleAnswer(groupIndex, correct)}
              previousAnswer={prevAnswer}
            />
          );
        case "error_correction":
          return (
            <ErrorCorrectionBlock
              key={i}
              block={block}
              onSubmit={(answer, correct) => handleSubmit(groupIndex, answer, correct, null)}
              previousAnswer={prevAnswer}
            />
          );
        default:
          return null;
      }
    });

    return (
      <VocabContext.Provider value={lesson?.content?.vocabulary ?? []}>
        {blocks}
      </VocabContext.Provider>
    );
  }

  // ── Completion screen ─────────────────────────────────────────────────────────

  if (completed) {
    const scoreColorClass =
      baselineScore >= 70 ? styles.completionScoreGreen :
      baselineScore >= 50 ? styles.completionScoreAmber :
      styles.completionScoreRed;

    return (
      <div className={styles.page}>
        <div className={styles.completionScreen}>
          <div className={styles.completionTitle}>Урок завершён!</div>
          <div className={styles.completionSub}>{lesson?.title}</div>
          <div className={styles.completionCard}>
            <div className={`${styles.completionScore} ${scoreColorClass}`}>{baselineScore}%</div>
            <div className={styles.completionScoreLabel}>Lesson score</div>
            {xpEarned > 0 ? (
              <div className={styles.xpBadge}>+{xpEarned} XP</div>
            ) : (
              <div className={styles.reviewNote}>Lesson reviewed — XP already earned</div>
            )}
          </div>
          {leveledUp && (
            <LevelUpBanner level={leveledUp.level} name={leveledUp.name} />
          )}
          {hasAssignments && (
            <div className={styles.assignmentUnlockedBanner}>
              📋 Assignment unlocked and added to your queue
            </div>
          )}

          <VocabReviewPanel vocab={lesson?.vocabulary ?? []} userId={user?.uid} />

          <button
            className={styles.completionContinueBtn}
            onClick={() => navigate(hasAssignments ? "/lessons/assignments" : "/lessons")}
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────────

  if (loading) {
  return (
    <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--c-text-light)", fontFamily: "var(--font-ui)" }}>
      Loading lesson…
    </div>
  );
}

if (!lesson) {
  return (
    <div style={{ padding: "40px 20px", textAlign: "center", fontFamily: "var(--font-ui)" }}>
      <p style={{ color: "var(--c-wrong)", marginBottom: 12 }}>Could not load lesson. Check console for details.</p>
      <button onClick={() => navigate("/lessons")} style={{ fontSize: 13, color: "var(--c-text-mid)", cursor: "pointer", background: "none", border: "1px solid var(--c-border)", borderRadius: "var(--radius-md)", padding: "8px 16px" }}>
        ← Back to Lessons
      </button>
    </div>
  );
}

  // ── Player ────────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      {/* Top bar */}
      <div className={styles.topBar}>
        <button className={styles.exitBtn} onClick={() => navigate("/lessons")}>✕ Exit</button>
        <div className={styles.progressSection}>
          <div className={styles.segmentedBar}>
            {groups.map((_, i) => {
              const cls =
                i < currentGroupIndex ? styles.segmentDone :
                i === currentGroupIndex ? styles.segmentCurrent :
                styles.segmentPending;
              return <div key={i} className={`${styles.segment} ${cls}`} />;
            })}
          </div>
          <div className={styles.progressLabel}>
            Section {currentGroupIndex + 1} of {groups.length} · {groups[currentGroupIndex]?.name}
          </div>
        </div>
        <div className={styles.lessonTitle}>{lesson.title}</div>
      </div>

      {/* Lesson body */}
      <div className={styles.body}>
        {showResume && (
          <div className={styles.resumeBanner}>
            Resuming from: <strong>{groups[currentGroupIndex]?.name}</strong>
          </div>
        )}

        {groups.slice(0, revealedCount).map((group, groupIndex) => (
          <div key={groupIndex}>
            {groupIndex > 0 && <div className={styles.groupDivider} />}
            <div
              className={styles.groupWrapper}
              ref={el => groupRefs.current[groupIndex] = el}
            >
              <div className={styles.groupEyebrow}>Section {groupIndex + 1}</div>
              <div className={styles.groupTitle}>{group.name}</div>
              {renderBlocks(group, groupIndex)}
            </div>
          </div>
        ))}
      </div>

      {/* Continue button */}
      <div className={styles.continueRow}>
        <button
          className={styles.continueBtn}
          onClick={handleContinue}
          disabled={!continueEnabled()}
        >
          {currentGroupIndex >= groups.length - 1 ? "Complete lesson →" : "Continue →"}
        </button>
      </div>
    </div>
  );
}