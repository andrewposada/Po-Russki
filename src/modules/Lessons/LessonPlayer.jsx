// src/modules/Lessons/LessonPlayer.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams }                   from "react-router-dom";
import { useAuth }                                  from "../../AuthContext";
import {
  getLessonById,
  getLessonCompletion,
  upsertLessonCompletion,
  saveLessonAnswer,
  addXP,
  getPendingAssignments,
} from "../../storage";
import { LESSON_STATE } from "../../constants";

import NarrativeBlock    from "./blocks/NarrativeBlock";
import RuleTableBlock    from "./blocks/RuleTableBlock";
import ExampleSetBlock   from "./blocks/ExampleSetBlock";
import CalloutBlock      from "./blocks/CalloutBlock";
import QuizBlock         from "./blocks/QuizBlock";
import PracticeBlock     from "./blocks/PracticeBlock";
import AssignmentBlock   from "./blocks/AssignmentBlock";
import FreeResponseBlock from "./blocks/FreeResponseBlock";
import SummaryBlock      from "./blocks/SummaryBlock";

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

const ANSWERABLE = new Set(["quiz", "practice", "free_response_sentence", "free_response_paragraph"]);

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
  const [loading,   setLoading]   = useState(true);
  const [completed, setCompleted] = useState(false);
  const [baselineScore, setBaselineScore] = useState(0);
  const [xpEarned,  setXpEarned]  = useState(0);
  const [hasAssignments, setHasAssignments] = useState(false);
  const [showResume, setShowResume] = useState(false);

  // Stale closure guard
  const currentGroupIndexRef = useRef(0);
  const answeredRef          = useRef({});

  // Refs for scroll targets
  const groupRefs = useRef([]);

  useEffect(() => {
    if (!user || !lessonId) return;
    async function load() {
      const [lessonData, completion] = await Promise.all([
        getLessonById(lessonId),
        getLessonCompletion(user.uid, lessonId),
      ]);
      if (!lessonData) { navigate("/lessons"); return; }

      const grouped = groupBlocks(lessonData.content || []);
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

      // Upsert in_progress
      await upsertLessonCompletion(user.uid, lessonId, {
        state:               LESSON_STATE.IN_PROGRESS,
        current_block_index: savedIndex,
        current_group:       grouped[savedIndex]?.name ?? null,
      });

      setLoading(false);
    }
    load();
  }, [user, lessonId, navigate]);

  // ── Answer handlers ───────────────────────────────────────────────────────────

  const handleAnswer = useCallback((groupIndex, isCorrect) => {
    answeredRef.current = { ...answeredRef.current, [groupIndex]: true };
    setAnswered({ ...answeredRef.current });
    const group = groups[groupIndex];
    if (!group) return;
    saveLessonAnswer(
      user.uid, lessonId, group.name, "quiz", null,
      String(isCorrect), { correct: isCorrect }
    );
  }, [user, lessonId, groups]);

  const handleSubmit = useCallback((groupIndex, answer, isCorrect, grade) => {
    answeredRef.current = { ...answeredRef.current, [groupIndex]: true };
    setAnswered({ ...answeredRef.current });
    const group = groups[groupIndex];
    if (!group) return;
    const blockType = group.blocks.find(b => ANSWERABLE.has(b.type))?.type || "practice";
    saveLessonAnswer(
      user.uid, lessonId, group.name, blockType,
      group.blocks.find(b => ANSWERABLE.has(b.type))?.prompt_ru ?? null,
      answer, grade
    );
  }, [user, lessonId, groups]);

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

    // Scroll to new group
    setTimeout(() => {
      groupRefs.current[next]?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  }

  async function finishLesson() {
    // Compute baseline score from quiz blocks
    const quizGroups = groups.filter(g => g.blocks.some(b => b.type === "quiz"));
    const answeredCorrect = quizGroups.filter((_, i) => answeredRef.current[i]).length;
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

    // Award XP
    const xp = lesson.xp_reward ?? 100;
    await addXP(user.uid, xp);
    setXpEarned(xp);

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
    return group.blocks.map((block, i) => {
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
            />
          );
        case "practice":
          return (
            <PracticeBlock
              key={i}
              block={block}
              onSubmit={(answer, correct, grade) => handleSubmit(groupIndex, answer, correct, grade)}
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
            />
          );
        case "summary":
          return <SummaryBlock key={i} block={block} />;
        default:
          return null;
      }
    });
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
            <div className={styles.xpBadge}>+{xpEarned} XP</div>
          </div>
          {hasAssignments && (
            <div className={styles.assignmentUnlockedBanner}>
              📋 Assignment unlocked and added to your queue
            </div>
          )}
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

  if (loading || !lesson || groups.length === 0) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--c-text-light)", fontFamily: "var(--font-ui)" }}>
        Loading lesson…
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