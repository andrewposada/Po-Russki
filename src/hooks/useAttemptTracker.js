// src/hooks/useAttemptTracker.js
//
// Universal attempt tracker hook.
// Provides a single recordAttempt() function that writes to universal_attempts.
// Fire-and-forget — never blocks UI, never throws to caller.
//
// SOURCE IDs (from attempt_sources table):
//   1  grammar_freeplay
//   2  vocab_session
//   3  vocab_explore
//   4  vocab_flashcard
//   5  vocab_freeplay
//   6  lesson
//   7  assignment
//   8  comprehension
//   9  song_study
//  10  song_drill
//
// TOPIC IDs: see attempt_topics table or ATTEMPT_TOPICS constant below.

import { useCallback } from "react";
import { useAuth }     from "../AuthContext";
import { recordAttempt as _recordAttempt } from "../storage";

// ── Constants — mirror of attempt_sources seed data ──────────────────────────
export const ATTEMPT_SOURCES = {
  GRAMMAR_FREEPLAY: 1,
  VOCAB_SESSION:    2,
  VOCAB_EXPLORE:    3,
  VOCAB_FLASHCARD:  4,
  VOCAB_FREEPLAY:   5,
  LESSON:           6,
  ASSIGNMENT:       7,
  COMPREHENSION:    8,
  SONG_STUDY:       9,
  SONG_DRILL:       10,
};

// ── Constants — mirror of attempt_topics seed data ───────────────────────────
export const ATTEMPT_TOPICS = {
  // Grammar
  NOMINATIVE:          1,
  ACCUSATIVE:          2,
  ACCUSATIVE_ANIMATE:  3,
  GENITIVE:            4,
  GENITIVE_PLURAL:     5,
  DATIVE:              6,
  INSTRUMENTAL:        7,
  PREPOSITIONAL:       8,
  VERB_ASPECT:         9,
  VERB_CONJUGATION:    10,
  VERB_MOTION:         11,
  ADJECTIVE_AGREEMENT: 12,
  SHORT_ADJECTIVES:    13,
  PRONOUNS:            14,
  NUMBERS:             15,
  WORD_ORDER:          16,
  NEGATION:            17,
  COMPARATIVE:         18,
  SUPERLATIVE:         19,
  REFLEXIVE_VERBS:     20,
  PARTICIPLES:         21,
  GERUNDS:             22,
  CONDITIONAL:         23,
  SUBJUNCTIVE:         24,
  PREPOSITIONS:        25,
  // Vocab
  VOCAB_GENERAL:       50,
  VOCAB_VERBS:         51,
  VOCAB_NOUNS:         52,
  VOCAB_ADJECTIVES:    53,
  VOCAB_ADVERBS:       54,
  VOCAB_PHRASES:       55,
  // Reading
  READING_DETAIL_RECALL:    80,
  READING_INFERENCE:        81,
  READING_VOCABULARY:       82,
  READING_TRUE_FALSE:       83,
  READING_SEQUENCE:         84,
  READING_FREE_RESPONSE:    85,
  READING_GRAMMAR_SPOTLIGHT: 86,
  // Song
  SONG_TRANSLATION: 90,
  SONG_MEANING:     91,
  SONG_CLOZE:       92,
  SONG_RECALL:      93,
};

// ── Maps grammar roadmap node IDs to topic IDs ────────────────────────────────
// Add entries here as new roadmap nodes are added.
// Values are ATTEMPT_TOPICS IDs.
export const ROADMAP_TOPIC_MAP = {
  "nom":        1,   // nominative
  "acc":        2,   // accusative
  "acc-anim":   3,   // accusative animate
  "gen":        4,   // genitive
  "gen-pl":     5,   // genitive plural
  "dat":        6,   // dative
  "inst":       7,   // instrumental
  "prep":       8,   // prepositional
  "verb-aspect": 9,  // verb aspect
  "verb-conj":  10,  // verb conjugation
  "verb-motion": 11, // verbs of motion
  "adj-agree":  12,  // adjective agreement
  "short-adj":  13,  // short adjectives
  "pronouns":   14,  // pronouns
  "numbers":    15,  // numbers
  "word-order": 16,  // word order
  "negation":   17,  // negation
  "comparative": 18, // comparative
  "superlative": 19, // superlative
  "reflexive":  20,  // reflexive verbs
  "participles": 21, // participles
  "gerunds":    22,  // gerunds
  "conditional": 23, // conditional
  "subjunctive": 24, // subjunctive
  "prepositions": 25, // prepositions
};

// ── Exercise type IDs — mirrors exercise_types table ─────────────────────────
// Grammar (domain 1)
// Vocab (domain 3)
// Lesson (domain 5)
// Song (domain 6)
// Comprehension (domain 7)
export const ATTEMPT_EXERCISE_TYPES = {
  // Grammar freeplay — domain 1
  FILL_IN:           1,
  MULTIPLE_CHOICE:   2,
  TRANSLATE:         3,
  TRANSFORM:         12,
  SPOT_ERROR:        13,
  // Vocab — domain 3
  VOCAB_TRANSLATE:   7,
  VOCAB_FLASHCARD:   8,
  VOCAB_FILL_IN:     9,
  VOCAB_MC:          10,
  VOCAB_SENTENCE:    11,
  VOCAB_MATCHING:    2,   // reuse mc id — closest fit
  VOCAB_CLOZE:       9,   // reuse fill_in — closest fit
  VOCAB_TRANSLATE_EN_RU: 7,
  // Lesson blocks — domain 5
  LESSON_QUIZ:            14,
  LESSON_PRACTICE:        15,
  LESSON_SENTENCE_CHOICE: 16,
  LESSON_ERROR_CORRECTION: 17,
  LESSON_FREE_RESPONSE:   18,
  // Comprehension — domain 7
  COMP_DETAIL_RECALL:     19,
  COMP_INFERENCE:         20,
  COMP_VOCAB_IN_CONTEXT:  21,
  COMP_TRUE_FALSE:        22,
  COMP_SEQUENCE:          23,
  COMP_FREE_RESPONSE:     24,
  COMP_GRAMMAR_SPOTLIGHT: 25,
  // Song — domain 6
  SONG_TRANSLATION: 26,
  SONG_MEANING:     27,
  SONG_CLOZE:       28,
  SONG_RECALL:      29,
};

// ── Maps comprehension question type strings to topic IDs ─────────────────────
export const COMPREHENSION_TYPE_TOPIC_MAP = {
  "detail_recall":         80,
  "inference":             81,
  "vocabulary_in_context": 82,
  "true_false":            83,
  "sequence":              84,
  "prediction_reflection": 85,
  "character_motivation":  85,
  "free_response":         85,
  "grammar_spotlight":     86,
};

// ── Maps comprehension question type strings to exercise type IDs ─────────────
export const COMPREHENSION_TYPE_EXERCISE_MAP = {
  "detail_recall":         19,
  "inference":             20,
  "vocabulary_in_context": 21,
  "true_false":            22,
  "sequence":              23,
  "prediction_reflection": 24,
  "character_motivation":  24,
  "free_response":         24,
  "grammar_spotlight":     25,
};

// ── Maps part-of-speech strings to vocab topic IDs ───────────────────────────
export const POS_TOPIC_MAP = {
  "verb":      51,
  "noun":      52,
  "adjective": 53,
  "adverb":    54,
};

function posToTopicId(partOfSpeech) {
  if (!partOfSpeech) return ATTEMPT_TOPICS.VOCAB_GENERAL;
  return POS_TOPIC_MAP[partOfSpeech.toLowerCase()] ?? ATTEMPT_TOPICS.VOCAB_GENERAL;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAttemptTracker() {
  const { user } = useAuth();

  /**
   * Record a single attempt. Fire-and-forget.
   *
   * @param {object} params
   * @param {number}       params.sourceId      - ATTEMPT_SOURCES.*
   * @param {number|null}  params.topicId       - ATTEMPT_TOPICS.* (null if unknown)
   * @param {string|null}  params.questionType  - e.g. 'fill_in_blank', 'inference'
   * @param {string|null}  params.sourceRef     - lesson_id, book_id, etc.
   * @param {string|null}  params.word          - vocab word being tested
   * @param {boolean}      params.isCorrect
   * @param {string|null}  params.userAnswer    - only needed when isCorrect is false
   * @param {string|null}  params.correctAnswer - only needed when isCorrect is false
   * @param {number|null}  params.responseMs    - optional response time
   */
  const track = useCallback((params) => {
    if (!user?.uid) return;
    // Intentionally not awaited — fire and forget
    _recordAttempt(user.uid, params);
  }, [user?.uid]);

  return {
    track,
    ATTEMPT_SOURCES,
    ATTEMPT_TOPICS,
    ATTEMPT_EXERCISE_TYPES,
    ROADMAP_TOPIC_MAP,
    COMPREHENSION_TYPE_TOPIC_MAP,
    COMPREHENSION_TYPE_EXERCISE_MAP,
    posToTopicId,
  };
}