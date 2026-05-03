// src/modules/Listening/ListeningHome.jsx
//
// Listening Comprehension module — on-demand AI generated exercises.
//
// State machine:
//   IDLE           → first open, nothing generated
//   GENERATING     → Haiku call in flight (shows loading screen)
//   CONTENT_READY  → content available; audio loading in background
//   AUDIO_READY    → TTS complete; play button active
//   ANSWERING      → user working through questions
//   REVIEWING      → all answered; transcript unlocked; score shown
//   TRANSITIONING  → between exercises while pre-generated content resolves
//
// Pre-generation strategy:
//   After Q1 answered → fire next content generation in background
//   After last Q answered → fire next TTS in background
//   On "Next exercise" → await both (usually already resolved = instant transition)

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAuth }           from "../../AuthContext";
import { useSettings }       from "../../context/SettingsContext";
import { useAttemptTracker }  from "../../hooks/useAttemptTracker";
import { useRussianKeyboard } from "../../hooks/useRussianKeyboard";
import { pickRandom, SITUATIONS, VOCAB_CATEGORIES } from "../../data/exerciseVariety";
import {
  CONTENT_FORMATS, FORMAT_WEIGHTS, LISTENING_EXERCISE_TYPES,
  GENDER_VOICES, DEFAULT_VOICE, PLAYBACK_SPEEDS, DEFAULT_SPEED,
  LOADING_STEPS, pickVoiceForGender,
} from "./listeningConstants";
import { cacheAudio, getCachedAudio, revokeAllAudio } from "../../utils/audioCache";
import styles from "./ListeningHome.module.css";

// ── Helpers ───────────────────────────────────────────────────────────────────

function weightedPickFormat() {
  const entries = CONTENT_FORMATS.filter(f => FORMAT_WEIGHTS[f.id]);
  const total   = entries.reduce((s, f) => s + (FORMAT_WEIGHTS[f.id] ?? 0), 0);
  let r = Math.random() * total;
  for (const f of entries) {
    r -= FORMAT_WEIGHTS[f.id] ?? 0;
    if (r <= 0) return f.id;
  }
  return "dialogue";
}

function pickExerciseTypes() {
  const mc    = LISTENING_EXERCISE_TYPES.filter(t => t.grading === "mc");
  const typed = LISTENING_EXERCISE_TYPES.filter(t => t.grading === "typed");
  const shuffledMc = [...mc].sort(() => Math.random() - 0.5);
  const picks = shuffledMc.slice(0, 3).map(t => t.id);
  picks.push(pickRandom(typed).id);
  return picks.sort(() => Math.random() - 0.5);
}

function getExerciseTypeMeta(typeId) {
  return LISTENING_EXERCISE_TYPES.find(t => t.id === typeId) ?? null;
}

// ── TTS helpers ───────────────────────────────────────────────────────────────

async function fetchTtsLine(text, voiceName, hash, lineIndex) {
  const cached = getCachedAudio(hash, lineIndex);
  if (cached) return cached;
  const res = await fetch("/api/tts", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ text, voiceName }),
  });
  if (!res.ok) throw new Error(`TTS failed for line ${lineIndex}`);
  const { audioContent } = await res.json();
  return cacheAudio(hash, audioContent, lineIndex);
}

async function fetchAllAudio(content, contentHash, characters) {
  // Assign one consistent voice per speaker key for this exercise
  const speakerVoiceMap = {};
  const usedVoices = new Set();
  for (const line of content) {
    if (!speakerVoiceMap[line.speaker]) {
      const gender = characters?.[line.speaker]?.gender ?? "female";
      const voice  = pickVoiceForGender(gender, usedVoices);
      speakerVoiceMap[line.speaker] = voice;
      usedVoices.add(voice);
    }
  }
  const promises = content.map((line, idx) => {
    const voice = speakerVoiceMap[line.speaker] ?? DEFAULT_VOICE;
    return fetchTtsLine(line.text, voice, contentHash, idx);
  });
  return Promise.all(promises);
}

// ── Content generator ─────────────────────────────────────────────────────────

async function generateContent(cefrLevel) {
  const situation     = pickRandom(SITUATIONS);
  const vocabCategory = pickRandom(VOCAB_CATEGORIES);
  const contentFormat = weightedPickFormat();
  const exerciseTypes = pickExerciseTypes();

  const res = await fetch("/api/listening-generate", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ level: cefrLevel, situation, vocabCategory, contentFormat, exerciseTypes }),
  });
  if (!res.ok) throw new Error("Content generation failed");
  return res.json();
}

// ── Grader for typed questions ────────────────────────────────────────────────

async function gradeTypedAnswer(questionType, question, studentAnswer) {
  const correctAnswer = question.answer ?? question.answers?.[0] ?? question.answer_en ?? "";
  const res = await fetch("/api/lesson-grade", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ type: "listening_typed", questionType, correctAnswer, studentAnswer }),
  });
  if (!res.ok) return { correct: false, feedback: "Could not grade — please try again." };
  return res.json();
}

// ── Module state constants ────────────────────────────────────────────────────

const MS = {
  IDLE:          "idle",
  GENERATING:    "generating",
  CONTENT_READY: "content_ready",
  AUDIO_READY:   "audio_ready",
  ANSWERING:     "answering",
  REVIEWING:     "reviewing",
  TRANSITIONING: "transitioning",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function ListeningHome() {
  const { user }       = useAuth();
  const { translitOn } = useSettings();
  const { track, ATTEMPT_SOURCES } = useAttemptTracker();

  // Core state
  const [moduleState,  setModuleState]  = useState(MS.IDLE);
  const [exercise,     setExercise]     = useState(null);
  const [audioUrls,    setAudioUrls]    = useState([]);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError,   setAudioError]   = useState(false);
  const [loadingStep,  setLoadingStep]  = useState(0);
  const [error,        setError]        = useState(null);

  // Player state
  const [isPlaying,     setIsPlaying]     = useState(false);
  const [currentLine,   setCurrentLine]   = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(DEFAULT_SPEED);
  const [progress,      setProgress]      = useState(0);
  const [hasListened,   setHasListened]   = useState(false);

  // Question state
  const [answers,        setAnswers]        = useState({});
  const [gradingIdx,     setGradingIdx]     = useState(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [typedValues,    setTypedValues]    = useState({});

  // Pre-generation refs
  const nextContentRef  = useRef(null); // Promise<contentData>
  const nextAudioRef    = useRef(null); // Promise<audioUrls>
  const nextReadyRef    = useRef(null); // { exercise, audioUrls } when both resolved

  // Audio refs
  const activeAudioRef = useRef(null);
  const rafRef         = useRef(null);

  // Typed input refs for Russian keyboard
  const typedRefs = useRef({});

  // CEFR level — hardcoded, wire to getCefrLevel() in future pass
  const cefrLevel = "A2";

  // Russian keyboard refs — declared unconditionally for up to 4 typed inputs.
  // useRussianKeyboard(ref, enabled) must be called at top level, never conditionally.
  const typedRef0 = useRef(null);
  const typedRef1 = useRef(null);
  const typedRef2 = useRef(null);
  const typedRef3 = useRef(null);
  const typedRefArray = useMemo(() => [typedRef0, typedRef1, typedRef2, typedRef3], []);

  useRussianKeyboard(typedRef0, translitOn);
  useRussianKeyboard(typedRef1, translitOn);
  useRussianKeyboard(typedRef2, translitOn);
  useRussianKeyboard(typedRef3, translitOn);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      try { activeAudioRef.current?.pause(); } catch {}
      revokeAllAudio();
    };
  }, []);

  // Apply Russian keyboard to typed inputs
  // We import the hook at the top and call it once per input via a stable ref callback.
  // Since useRussianKeyboard takes (ref, enabled) and the inputs are conditional,
  // we manage this by keeping typedRefs and calling the hook effects manually via
  // the individual input's ref callback. For simplicity, use a plain onChange approach
  // with manual transliteration via the QWERTY_TO_CYR map when translitOn is true.
  // This avoids conditional hook calls while still respecting the keyboard hook contract.
  // See the RussianInput inline variable below.

  // Sync playback speed to any active audio
  useEffect(() => {
    if (activeAudioRef.current) {
      activeAudioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // ── Generation ──────────────────────────────────────────────────────────────

  const startGeneration = useCallback(async () => {
    setModuleState(MS.GENERATING);
    setError(null);
    setLoadingStep(0);

    try {
      await new Promise(r => setTimeout(r, 350));
      setLoadingStep(1);

      const data = await generateContent(cefrLevel);

      setExercise(data);
      setAnswers({});
      setTypedValues({});
      setHasListened(false);
      setShowTranscript(false);
      setCurrentLine(0);
      setProgress(0);
      setModuleState(MS.CONTENT_READY);

      // Track 2: audio in background
      setLoadingStep(2);
      setAudioLoading(true);
      setAudioError(false);

      fetchAllAudio(data.content, data.contentHash, data.characters)
        .then(urls => {
          setAudioUrls(urls);
          setAudioLoading(false);
          setModuleState(prev =>
            prev === MS.CONTENT_READY ? MS.AUDIO_READY : prev
          );
        })
        .catch(() => {
          setAudioLoading(false);
          setAudioError(true);
        });

    } catch (e) {
      console.error("Generation error:", e);
      setError("Something went wrong. Tap to try again.");
      setModuleState(MS.IDLE);
    }
  }, [cefrLevel]);

  // ── Pre-generation ──────────────────────────────────────────────────────────

  const preGenerateNextContent = useCallback(() => {
    if (nextContentRef.current) return;
    nextContentRef.current = generateContent(cefrLevel).catch(() => null);
  }, [cefrLevel]);

  const preGenerateNextAudio = useCallback((contentData) => {
    if (!contentData || nextAudioRef.current) return;
    nextAudioRef.current = fetchAllAudio(contentData.content, contentData.contentHash, contentData.characters)
      .then(urls => {
        nextReadyRef.current = { exercise: contentData, audioUrls: urls };
      })
      .catch(() => null);
  }, []);

  // ── Audio playback ──────────────────────────────────────────────────────────

  const playLine = useCallback((lineIdx, urls) => {
    const urlList = urls ?? audioUrls;
    if (!urlList.length || lineIdx >= urlList.length) {
      setIsPlaying(false);
      setHasListened(true);
      return;
    }

    try { activeAudioRef.current?.pause(); } catch {}
    cancelAnimationFrame(rafRef.current);

    setCurrentLine(lineIdx);
    setIsPlaying(true);
    setProgress(0);

    const audio = new Audio(urlList[lineIdx]);
    audio.playbackRate = playbackSpeed;
    activeAudioRef.current = audio;

    const tick = () => {
      if (audio.duration > 0) setProgress(audio.currentTime / audio.duration);
      if (!audio.paused && !audio.ended) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    audio.onended = () => {
      cancelAnimationFrame(rafRef.current);
      setProgress(0);
      playLine(lineIdx + 1, urlList);
    };
    audio.onerror = () => {
      cancelAnimationFrame(rafRef.current);
      setIsPlaying(false);
    };

    audio.play().catch(() => setIsPlaying(false));
  }, [audioUrls, playbackSpeed]);

  const handlePlay = useCallback(() => {
    if (audioLoading || !audioUrls.length) return;
    playLine(0);
  }, [audioLoading, audioUrls, playLine]);

  const handlePause = useCallback(() => {
    try { activeAudioRef.current?.pause(); } catch {}
    cancelAnimationFrame(rafRef.current);
    setIsPlaying(false);
  }, []);

  const handleSeekToLine = useCallback((lineIdx) => {
    if (!audioUrls.length) return;
    try { activeAudioRef.current?.pause(); } catch {}
    cancelAnimationFrame(rafRef.current);
    playLine(lineIdx);
  }, [audioUrls, playLine]);

  // ── Questions reveal after first listen ────────────────────────────────────

  useEffect(() => {
    if (hasListened && (moduleState === MS.AUDIO_READY || moduleState === MS.CONTENT_READY)) {
      setModuleState(MS.ANSWERING);
    }
  }, [hasListened, moduleState]);

  // ── Answer handlers ────────────────────────────────────────────────────────

  const handleMcAnswer = useCallback((qIdx, chosenIndex) => {
    if (answers[qIdx]?.graded) return;
    const q       = exercise.questions[qIdx];
    const correct = chosenIndex === q.correct_index;
    const meta    = getExerciseTypeMeta(q.type);

    setAnswers(prev => ({
      ...prev,
      [qIdx]: { value: chosenIndex, correct, feedback: null, graded: true },
    }));

    track({
      sourceId:       ATTEMPT_SOURCES.LISTENING,
      topicId:        meta?.topicId        ?? null,
      exerciseTypeId: meta?.exerciseTypeId ?? null,
      isCorrect:      correct,
      userAnswer:     correct ? null : String(chosenIndex),
      correctAnswer:  correct ? null : String(q.correct_index),
    });

    if (qIdx === 0) preGenerateNextContent();

  }, [exercise, answers, track, ATTEMPT_SOURCES, preGenerateNextContent]);

  const handleTypedSubmit = useCallback(async (qIdx) => {
    if (answers[qIdx]?.graded || gradingIdx === qIdx) return;
    const value = (typedValues[qIdx] ?? "").trim();
    if (!value) return;
    const q = exercise.questions[qIdx];
    setGradingIdx(qIdx);

    try {
      const { correct, feedback } = await gradeTypedAnswer(q.type, q, value);
      const meta = getExerciseTypeMeta(q.type);

      setAnswers(prev => ({
        ...prev,
        [qIdx]: { value, correct, feedback, graded: true },
      }));

      track({
        sourceId:       ATTEMPT_SOURCES.LISTENING,
        topicId:        meta?.topicId        ?? null,
        exerciseTypeId: meta?.exerciseTypeId ?? null,
        isCorrect:      correct,
        userAnswer:     correct ? null : value,
        correctAnswer:  correct ? null : (q.answer ?? q.answers?.[0] ?? q.answer_en ?? ""),
      });

      if (qIdx === 0) preGenerateNextContent();

    } catch {
      setAnswers(prev => ({
        ...prev,
        [qIdx]: { value, correct: false, feedback: "Grading failed — try again.", graded: false },
      }));
    } finally {
      setGradingIdx(null);
    }
  }, [exercise, answers, gradingIdx, typedValues, track, ATTEMPT_SOURCES, preGenerateNextContent]);

  // ── Detect all answered → REVIEWING ───────────────────────────────────────

  useEffect(() => {
    if (!exercise || moduleState !== MS.ANSWERING) return;
    const total  = exercise.questions.length;
    const graded = Object.values(answers).filter(a => a.graded).length;
    if (graded === total && total > 0) {
      setModuleState(MS.REVIEWING);
      setShowTranscript(false); // toggle hidden, user opens manually
      // Pre-generate next audio
      if (nextContentRef.current) {
        nextContentRef.current.then(data => {
          if (data) preGenerateNextAudio(data);
        });
      }
    }
  }, [answers, exercise, moduleState, preGenerateNextAudio]);

  // ── Next exercise ──────────────────────────────────────────────────────────

  const handleNextExercise = useCallback(async () => {
    setModuleState(MS.TRANSITIONING);
    try { activeAudioRef.current?.pause(); } catch {}
    cancelAnimationFrame(rafRef.current);

    try {
      // Best case: both content + audio pre-generated
      if (nextReadyRef.current) {
        const { exercise: nextEx, audioUrls: nextUrls } = nextReadyRef.current;
        nextReadyRef.current  = null;
        nextContentRef.current = null;
        nextAudioRef.current   = null;
        setExercise(nextEx);
        setAudioUrls(nextUrls);
        setAnswers({});
        setTypedValues({});
        setHasListened(false);
        setShowTranscript(false);
        setCurrentLine(0);
        setProgress(0);
        setAudioLoading(false);
        setAudioError(false);
        setModuleState(MS.AUDIO_READY);
        return;
      }

      // Content ready, audio still loading
      if (nextContentRef.current) {
        const data = await nextContentRef.current;
        nextContentRef.current = null;
        if (data) {
          setExercise(data);
          setAnswers({});
          setTypedValues({});
          setHasListened(false);
          setShowTranscript(false);
          setCurrentLine(0);
          setProgress(0);
          setModuleState(MS.CONTENT_READY);
          setAudioLoading(true);
          setAudioError(false);
          fetchAllAudio(data.content, data.contentHash, data.characters)
            .then(urls => {
              setAudioUrls(urls);
              setAudioLoading(false);
              setModuleState(MS.AUDIO_READY);
            })
            .catch(() => {
              setAudioLoading(false);
              setAudioError(true);
            });
          return;
        }
      }

      // Nothing pre-generated — generate fresh
      nextContentRef.current = null;
      nextAudioRef.current   = null;
      nextReadyRef.current   = null;
      await startGeneration();

    } catch {
      nextContentRef.current = null;
      nextAudioRef.current   = null;
      nextReadyRef.current   = null;
      await startGeneration();
    }
  }, [startGeneration]);

  // ── Derived values ─────────────────────────────────────────────────────────

  const allAnswered  = exercise
    ? Object.values(answers).filter(a => a.graded).length === exercise.questions.length
    : false;
  const scoreCount   = Object.values(answers).filter(a => a.correct).length;
  const isDialogue   = exercise
    ? exercise.content.some(l => l.speaker === "B")
    : false;
  const canPlay      = !audioLoading && audioUrls.length > 0;
  const questionsVisible =
    moduleState === MS.ANSWERING || moduleState === MS.REVIEWING;

  // ── Inline typed question inputs (must be inline variable, not component) ──
  // This prevents focus reset on re-render.
  const typedInputsJSX = exercise
    ? exercise.questions.map((q, qIdx) => {
        const isTypedType = ["dictation_fill","word_reconstruction","phrase_translation"].includes(q.type);
        if (!isTypedType) return null;
        const ans       = answers[qIdx];
        const isGrading = gradingIdx === qIdx;
        const inputId   = `typed_q_${qIdx}`;

        return (
          <div key={inputId} className={styles.typedInputWrap}>
            <input
              id={inputId}
              className={styles.typedInput}
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder={
                q.type === "phrase_translation"
                  ? "Type the English meaning…"
                  : "Type in Russian…"
              }
              disabled={!!ans?.graded || isGrading}
              ref={typedRefArray[qIdx]}
              value={typedValues[qIdx] ?? ""}
              onChange={e => setTypedValues(prev => ({ ...prev, [qIdx]: e.target.value }))}
              onKeyDown={e => {
                if (e.key === "Enter") handleTypedSubmit(qIdx);
              }}
            />
            <button
              className={styles.typedSubmitBtn}
              disabled={!!ans?.graded || isGrading || !(typedValues[qIdx] ?? "").trim()}
              onClick={() => handleTypedSubmit(qIdx)}
            >
              {isGrading ? "Checking…" : "Check"}
            </button>
          </div>
        );
      })
    : [];

  // ── Screens ────────────────────────────────────────────────────────────────

  // Loading
  if (moduleState === MS.GENERATING) {
    return (
      <div className={styles.page}>
        <div className={styles.centreWrap}>
          <div className={styles.loadingIcon}>🎧</div>
          <h2 className={styles.loadingTitle}>Preparing your exercise</h2>
          <div className={styles.loadingSteps}>
            {LOADING_STEPS.map((step, i) => (
              <div
                key={step.id}
                className={`${styles.loadingStep} ${
                  i < loadingStep   ? styles.stepDone   :
                  i === loadingStep ? styles.stepActive : ""
                }`}
              >
                <span className={styles.stepDot} />
                <span className={styles.stepLabel}>{step.label}</span>
              </div>
            ))}
          </div>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${((loadingStep + 1) / LOADING_STEPS.length) * 100}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Transitioning between exercises
  if (moduleState === MS.TRANSITIONING) {
    return (
      <div className={styles.page}>
        <div className={styles.centreWrap}>
          <div className={styles.loadingIcon}>🎧</div>
          <h2 className={styles.loadingTitle}>Loading next exercise…</h2>
          <div className={styles.progressBar} style={{ marginTop: 24 }}>
            <div className={styles.progressFill} style={{ width: "55%" }} />
          </div>
        </div>
      </div>
    );
  }

  // Idle / error
  if (moduleState === MS.IDLE) {
    return (
      <div className={styles.page}>
        <div className={styles.centreWrap}>
          <div className={styles.idleIcon}>🎧</div>
          <h1 className={styles.idleTitle}>Слушание</h1>
          <p className={styles.idleSub}>
            Train your ear with AI-generated Russian listening exercises.
          </p>
          {error && <p className={styles.errorMsg}>{error}</p>}
          <button className={styles.startBtn} onClick={startGeneration}>
            Start listening
          </button>
        </div>
      </div>
    );
  }

  if (!exercise) return null;

  // ── Main exercise screen ───────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* Context card */}
      <div className={styles.contextCard}>
        <div className={styles.contextMeta}>
          <span className={styles.contextBadge}>
            {isDialogue ? "🗣 Dialogue" : "🎙 Listening"}
          </span>
          {isDialogue && exercise.characters && (
            <span className={styles.contextSpeakers}>
              {exercise.characters.A?.name ?? "Speaker A"} · {exercise.characters.B?.name ?? "Speaker B"}
            </span>
          )}
        </div>
        <h2 className={styles.contextTitle}>{exercise.title}</h2>
        <p className={styles.contextSub}>{exercise.context}</p>
      </div>

      {/* Player card — sticky */}
      <div className={styles.playerCard}>

        {/* Top row: status + speed scrubber */}
        <div className={styles.playerHeader}>
          <span className={styles.playerLabel}>
            {audioLoading ? "Recording audio…" : "Audio ready"}
          </span>
          <div className={styles.speedScrubWrap}>
            <span className={styles.speedScrubMin}>0.5×</span>
            <input
              type="range"
              className={styles.speedScrub}
              min={0.5}
              max={1.25}
              step={0.25}
              value={playbackSpeed}
              onChange={e => setPlaybackSpeed(Number(e.target.value))}
            />
            <span className={styles.speedScrubMax}>{playbackSpeed}×</span>
          </div>
        </div>

        {/* Timeline */}
        {isDialogue ? (() => {
          // Compute segment widths proportional to text length (proxy for duration)
          const lengths = exercise.content.map(l => Math.max(l.text.length, 8));
          const total   = lengths.reduce((s, n) => s + n, 0);
          // Find playhead position: sum of completed segments + progress through current
          const playedWidth = lengths.slice(0, currentLine).reduce((s, n) => s + n, 0) / total;
          const currentSegWidth = lengths[currentLine] / total;
          const playheadPct = (playedWidth + currentSegWidth * progress) * 100;

          return (
            <div className={styles.dialogueTimeline}>
              <div className={styles.dialogueTrack}>
                {exercise.content.map((line, idx) => {
                  const widthPct = (lengths[idx] / total) * 100;
                  const isA = line.speaker === "A";
                  return (
                    <button
                      key={idx}
                      className={`${styles.dialoguePill} ${
                        isA ? styles.dialoguePillA : styles.dialoguePillB
                      } ${idx < currentLine ? styles.dialoguePillPlayed : ""} ${
                        idx === currentLine ? styles.dialoguePillActive : ""
                      }`}
                      style={{ width: `${widthPct}%` }}
                      onClick={() => canPlay && handleSeekToLine(idx)}
                      title={`${exercise.characters?.[line.speaker]?.name ?? line.speaker}: ${line.text}`}
                      disabled={!canPlay}
                    />
                  );
                })}
                {/* Playhead indicator */}
                {(isPlaying || currentLine > 0) && (
                  <div
                    className={styles.dialoguePlayhead}
                    style={{ left: `${playheadPct}%` }}
                  />
                )}
              </div>
              {/* Legend */}
              <div className={styles.dialogueLegend}>
                <span className={styles.legendDotA} />
                <span className={styles.legendName}>
                  {exercise.characters?.A?.name ?? "Speaker A"}
                </span>
                <span className={styles.legendDotB} />
                <span className={styles.legendName}>
                  {exercise.characters?.B?.name ?? "Speaker B"}
                </span>
              </div>
            </div>
          );
        })() : (
          <div className={styles.monoScrubber}>
            <div className={styles.monoFill} style={{ width: `${progress * 100}%` }} />
          </div>
        )}

        {/* Controls */}
        <div className={styles.playerControls}>
          <button
            className={styles.playBtn}
            onClick={isPlaying ? handlePause : handlePlay}
            disabled={!canPlay}
          >
            {audioLoading
              ? <span className={styles.spinner} />
              : isPlaying ? "⏸" : "▶"
            }
          </button>
          <button
            className={styles.replayBtn}
            onClick={handlePlay}
            disabled={!canPlay}
          >
            ↺ Replay
          </button>
        </div>

        {audioError && (
          <p className={styles.audioError}>
            Audio failed to load.{" "}
            <button className={styles.retryLink} onClick={handlePlay}>Retry</button>
          </p>
        )}

        {!hasListened && !audioLoading && canPlay && (
          <p className={styles.listenPrompt}>
            Listen first — questions will appear after.
          </p>
        )}
      </div>

      {/* Questions */}
      {questionsVisible && (
        <div className={styles.questionsSection}>
          <h3 className={styles.questionsHeading}>Questions</h3>

          {exercise.questions.map((q, qIdx) => {
            const ans     = answers[qIdx];
            const isMc    = ["gist_question","specific_detail","inference",
                              "true_false_not_mentioned","respond_next"].includes(q.type);
            const isTyped = ["dictation_fill","word_reconstruction","phrase_translation",
                              "mishear_correction"].includes(q.type);

            return (
              <div
                key={qIdx}
                className={`${styles.questionCard} ${
                  ans?.graded
                    ? ans.correct ? styles.qCorrect : styles.qWrong
                    : ""
                }`}
              >
                {/* Prompt text */}
                <div className={styles.qPrompt}>
                  {q.type === "dictation_fill" && (
                    <p className={styles.qText}>
                      Fill in the missing {(q.answers?.length ?? 1) > 1 ? "words" : "word"}:
                      <br /><span className="ru">{q.gapped_sentence}</span>
                    </p>
                  )}
                  {q.type === "word_reconstruction" && (
                    <p className={styles.qText}>
                      You heard a phrase meaning: <em>"{q.prompt_en}"</em><br />Type it in Russian.
                    </p>
                  )}
                  {q.type === "phrase_translation" && (
                    <p className={styles.qText}>
                      What does this phrase mean?<br />
                      <span className="ru">{q.prompt_ru}</span>
                    </p>
                  )}
                  {q.type === "mishear_correction" && (
                    <p className={styles.qText}>
                      One word is wrong — which word should replace <em>"{q.wrong_word}"</em>?<br />
                      <span className="ru">{q.shown_sentence}</span>
                    </p>
                  )}
                  {q.type === "respond_next" && (
                    <p className={styles.qText}>
                      {q.context_en}<br />What would you say next?
                    </p>
                  )}
                  {!["dictation_fill","word_reconstruction","phrase_translation",
                      "mishear_correction","respond_next"].includes(q.type) && (
                    <p className={styles.qText}>{q.question ?? q.statement}</p>
                  )}
                </div>

                {/* MC options */}
                {isMc && (
                  <div className={styles.mcOptions}>
                    {(q.options ?? []).map((opt, oIdx) => (
                      <button
                        key={oIdx}
                        className={`${styles.mcOption} ${
                          ans?.graded
                            ? oIdx === q.correct_index
                              ? styles.mcCorrect
                              : oIdx === ans.value
                                ? styles.mcWrong
                                : styles.mcDim
                            : ""
                        }`}
                        onClick={() => handleMcAnswer(qIdx, oIdx)}
                        disabled={!!ans?.graded}
                      >
                        <span className="ru">{opt}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Typed input (inline variable — not a component) */}
                {isTyped && typedInputsJSX[qIdx]}

                {/* Feedback */}
                {ans?.graded && (
                  <div className={styles.feedback}>
                    <span className={ans.correct ? styles.fbCorrect : styles.fbWrong}>
                      {ans.correct ? "✓ Correct" : "✗ Incorrect"}
                    </span>
                    {ans.feedback && (
                      <span className={styles.fbMsg}>{ans.feedback}</span>
                    )}
                    {!ans.correct && isTyped && (
                      <span className={`ru ${styles.fbAnswer}`}>
                        {q.answer ?? q.answers?.join(", ") ?? q.answer_en}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Transcript toggle (visible once all answered) */}
      {moduleState === MS.REVIEWING && (
        <div className={styles.transcriptWrap}>
          <button
            className={styles.transcriptToggle}
            onClick={() => setShowTranscript(p => !p)}
          >
            {showTranscript ? "Hide transcript ▲" : "Show transcript ▼"}
          </button>
          {showTranscript && (
            <div className={styles.transcript}>
              {exercise.content.map((line, idx) => (
                <div key={idx} className={styles.transcriptLine}>
                  {isDialogue && (
                    <span className={`${styles.tSpeaker} ${line.speaker === "B" ? styles.tSpeakerB : ""}`}>
                      {exercise.characters?.[line.speaker]?.name ?? line.speaker}:
                    </span>
                  )}
                  <span className={`ru ${styles.tText}`}>{line.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Score + Next */}
      {moduleState === MS.REVIEWING && (
        <div className={styles.resultsCard}>
          <div className={styles.scoreRow}>
            <span className={styles.scoreNum}>{scoreCount}</span>
            <span className={styles.scoreDenom}>/ {exercise.questions.length} correct</span>
          </div>
          <button className={styles.nextBtn} onClick={handleNextExercise}>
            Next exercise →
          </button>
        </div>
      )}

    </div>
  );
}