// src/constants/cefrThresholds.js
// CEFR level thresholds — single source of truth for aggregator + UI.
// To adjust difficulty, change numbers here only — nowhere else.
//
// "topics_required" = number of grammar topics with ≥15 attempts needed
// "grammar_accuracy" = minimum overall grammar accuracy %
// "vocab_tier2_plus" = minimum words at tier 2 or above
// "reading_comp"     = minimum reading comprehension % (requires reading_data_sufficient)
// "reading_sessions" = minimum comprehension sessions needed for reading to count
// "consistency_min"  = minimum consistency score (0–10) over 2+ consecutive reports (B1+ only)
// "consecutive_reports" = number of consecutive reports that must meet thresholds (B1+ only)

export const CEFR_THRESHOLDS = {
  A1: {
    label: "A1 — Beginner",
    description: "Can understand and use familiar everyday expressions and very basic phrases.",
    topics_required:      3,
    grammar_accuracy:     60,
    vocab_tier2_plus:     200,
    reading_comp:         null,   // not required at A1
    reading_sessions:     0,
    consistency_min:      null,
    consecutive_reports:  1,
  },
  A2: {
    label: "A2 — Elementary",
    description: "Can communicate in simple and routine tasks on familiar topics.",
    topics_required:      6,
    grammar_accuracy:     65,
    vocab_tier2_plus:     500,
    reading_comp:         50,
    reading_sessions:     3,
    consistency_min:      null,
    consecutive_reports:  1,
  },
  B1: {
    label: "B1 — Intermediate",
    description: "Can deal with most situations likely to arise while travelling. Can describe experiences and events.",
    topics_required:      10,
    grammar_accuracy:     70,
    vocab_tier2_plus:     1200,
    reading_comp:         60,
    reading_sessions:     3,
    consistency_min:      6,
    consecutive_reports:  2,   // must hold across 2 consecutive reports
  },
  B2: {
    label: "B2 — Upper Intermediate",
    description: "Can understand the main ideas of complex text on both concrete and abstract topics.",
    topics_required:      15,
    grammar_accuracy:     78,
    vocab_tier2_plus:     2500,
    reading_comp:         72,
    reading_sessions:     5,
    consistency_min:      null,
    consecutive_reports:  2,
  },
};

// Ordered list of levels for progression logic
export const CEFR_LEVELS = ["A1", "A2", "B1", "B2"];

// Grade thresholds — weighted average → letter grade
// Plus/minus applied by consistency score afterward
export const GRADE_THRESHOLDS = [
  { min: 90, grade: "A" },
  { min: 80, grade: "B" },
  { min: 70, grade: "C" },
  { min: 65, grade: "D" },
  { min: 0,  grade: "F" },
];

// Consistency modifier: score ≥ 8 → +, score ≤ 4 → -, else no modifier
export const CONSISTENCY_PLUS_MIN  = 8;
export const CONSISTENCY_MINUS_MAX = 4;

// Grade weights — must sum to 1.0
// When reading_data_sufficient is false, grammar and vocab are rebalanced
export const GRADE_WEIGHTS = {
  grammar:          0.40,
  vocab:            0.35,
  reading:          0.25,
  // Fallback when reading data is insufficient:
  grammar_no_read:  0.53,
  vocab_no_read:    0.47,
};

// Topic accuracy bucket thresholds
export const TOPIC_BUCKETS = {
  RELIABLE_MIN_ATTEMPTS:   15,
  RELIABLE_MIN_ACCURACY:   70,
  DEVELOPING_MIN_ACCURACY: 55,
  // < DEVELOPING_MIN_ACCURACY with ≥ RELIABLE_MIN_ATTEMPTS → "weak"
  // < RELIABLE_MIN_ATTEMPTS → "early_data"
};