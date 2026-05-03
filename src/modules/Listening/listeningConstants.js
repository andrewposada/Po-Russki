// src/modules/Listening/listeningConstants.js
//
// Constants specific to the Listening Comprehension module.
// Content formats live here (not in exerciseVariety.js, which is a shared
// cross-module pool for situations and vocab categories only).

// ── Content formats ───────────────────────────────────────────────────────────
export const CONTENT_FORMATS = [
  { id: "dialogue",     label: "Dialogue",     speakerCount: 2 },
  { id: "monologue",    label: "Story",        speakerCount: 1 },
  { id: "announcement", label: "Announcement", speakerCount: 1 },
  { id: "voicemail",    label: "Voicemail",    speakerCount: 1 },
  { id: "interview",    label: "Interview",    speakerCount: 2 },
];

// Weighted random selection — higher number = more likely
export const FORMAT_WEIGHTS = {
  dialogue:     40,
  monologue:    30,
  announcement: 15,
  voicemail:    10,
  interview:    5,
};

// ── Exercise types ────────────────────────────────────────────────────────────
// topicId and exerciseTypeId mirror the Supabase rows seeded in Step 1.
// grading: "mc" = client-side, "typed" = api/lesson-grade.js
export const LISTENING_EXERCISE_TYPES = [
  { id: "gist_question",            label: "Main Idea",       topicId: 100, exerciseTypeId: 30, grading: "mc"    },
  { id: "specific_detail",          label: "Specific Detail", topicId: 101, exerciseTypeId: 31, grading: "mc"    },
  { id: "inference",                label: "Inference",       topicId: 102, exerciseTypeId: 32, grading: "mc"    },
  { id: "dictation_fill",           label: "Dictation Fill",  topicId: 103, exerciseTypeId: 33, grading: "typed" },
  { id: "word_reconstruction",      label: "Word Memory",     topicId: 104, exerciseTypeId: 34, grading: "typed" },
  { id: "phrase_translation",       label: "Phrase Meaning",  topicId: 105, exerciseTypeId: 35, grading: "typed" },
  { id: "true_false_not_mentioned", label: "True / False",    topicId: 106, exerciseTypeId: 36, grading: "mc"    },
  { id: "respond_next",             label: "Next Response",   topicId: 107, exerciseTypeId: 37, grading: "mc"    },
  { id: "mishear_correction",       label: "Spot the Word",   topicId: 108, exerciseTypeId: 38, grading: "mc"    },
];

// ── Voice assignments ─────────────────────────────────────────────────────────
export const SPEAKER_VOICES = {
  A: "ru-RU-Standard-A",  // female
  B: "ru-RU-Standard-B",  // male
};
export const DEFAULT_VOICE = "ru-RU-Standard-A";

// ── Playback ──────────────────────────────────────────────────────────────────
export const PLAYBACK_SPEEDS = [0.75, 1.0, 1.25];
export const DEFAULT_SPEED   = 1.0;

// ── Loading steps ─────────────────────────────────────────────────────────────
export const LOADING_STEPS = [
  { id: "topic",   label: "Choosing your topic…"   },
  { id: "content", label: "Writing your exercise…" },
  { id: "audio",   label: "Recording audio…"       },
];