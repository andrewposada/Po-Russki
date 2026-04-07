// src/data/roadmaps/grammarRoadmap.js
//
// Grammar Foundations Roadmap — По-русски
//
// SCHEMA DEVIATION FROM PHASE 3F SPEC (intentional):
//   Original spec used a single `lesson_id` string per node.
//   This file uses a `lessons` array instead, supporting multi-lesson topics.
//   Each lesson in the array is completed in sequence before the next unlocks.
//   The node's overall state on the roadmap reflects the furthest lesson reached.
//   The RoadmapView node tap opens a topic hub panel listing sub-lessons.
//
// Node state is derived at runtime from lesson_completions rows.
// Node state = max(state) across all lessons in the node's lessons array.
// A node is "completed" (state >= 3) when ALL lessons in its array are completed.
// Prerequisites reference node IDs — a node unlocks when all prerequisite nodes
// have ALL their lessons at state >= 3.
//
// Position: { x, y }
//   x — percentage of path canvas width (0–100). Center = 50.
//   y — pixel offset from top of path canvas. Drives vertical placement.
//   Left column (cases/adj) ≈ x:30, Center ≈ x:50, Right column (verbs) ≈ x:70
//
// CEFR levels per lesson are indicative. Students progress at their own pace.
// All nodes begin as status: "coming_soon". Flip to "content_ready" after
// seeding the lesson JSON into Supabase and verifying end-to-end playback.

export const GRAMMAR_ROADMAP = [

  // ─────────────────────────────────────────────
  // TIER 1 — Foundation (A1)
  // ─────────────────────────────────────────────

  {
    id: "nom",
    title: "Nominative Case",
    subtitle: "Subjects, gender, and identity",
    cefr: "A1",
    tier: 1,
    prerequisites: [],
    status: "coming_soon",
    position: { x: 50, y: 0 },
    lessons: [
      {
        id: "nom-1",
        title: "Nouns and Gender",
        subtitle: "Masculine, feminine, neuter — how to tell",
        cefr: "A1",
        xp_reward: 100,
      },
      {
        id: "nom-2",
        title: "Personal Pronouns",
        subtitle: "Я, ты, он, она, мы, вы, они",
        cefr: "A1",
        xp_reward: 100,
      },
      {
        id: "nom-3",
        title: "This is / There is — Это and Вот",
        subtitle: "Identifying and pointing at things",
        cefr: "A1",
        xp_reward: 100,
      },
    ],
  },

  {
    id: "acc",
    title: "Accusative Case",
    subtitle: "Direct objects and direction",
    cefr: "A1",
    tier: 1,
    prerequisites: ["nom"],
    status: "coming_soon",
    position: { x: 30, y: 180 },
    lessons: [
      {
        id: "acc-1",
        title: "Accusative: Inanimate Nouns",
        subtitle: "Direct objects — things you can see, read, eat",
        cefr: "A1",
        xp_reward: 100,
      },
      {
        id: "acc-2",
        title: "Accusative: Animate Nouns and Direction",
        subtitle: "People as objects, going somewhere",
        cefr: "A1",
        xp_reward: 100,
      },
    ],
  },

  {
    id: "conj-present",
    title: "Present Tense Conjugation",
    subtitle: "How verbs change by person",
    cefr: "A1",
    tier: 1,
    prerequisites: ["nom"],
    status: "coming_soon",
    position: { x: 70, y: 180 },
    lessons: [
      {
        id: "conj-present-1",
        title: "Type I Verbs (-ать / -ять)",
        subtitle: "читать, знать, понимать and their patterns",
        cefr: "A1",
        xp_reward: 100,
      },
      {
        id: "conj-present-2",
        title: "Type II Verbs (-ить / -еть)",
        subtitle: "говорить, любить, смотреть and their patterns",
        cefr: "A1",
        xp_reward: 100,
      },
      {
        id: "conj-present-3",
        title: "Irregular Verbs",
        subtitle: "хотеть, мочь, идти, есть, дать",
        cefr: "A1",
        xp_reward: 150,
      },
    ],
  },

  {
    id: "gen",
    title: "Genitive Case",
    subtitle: "Possession, absence, and quantity",
    cefr: "A1",
    tier: 1,
    prerequisites: ["acc"],
    status: "coming_soon",
    position: { x: 30, y: 380 },
    lessons: [
      {
        id: "gen-1",
        title: "Genitive: Possession and Belonging",
        subtitle: "Whose is it? — книга брата, дом мамы",
        cefr: "A1",
        xp_reward: 100,
      },
      {
        id: "gen-2",
        title: "Genitive: Absence and Negation",
        subtitle: "У меня нет..., нет времени",
        cefr: "A1",
        xp_reward: 100,
      },
      {
        id: "gen-3",
        title: "Genitive: Quantity and Measurement",
        subtitle: "A glass of, a lot of, a few — много, мало, стакан",
        cefr: "A2",
        xp_reward: 100,
      },
      {
        id: "gen-4",
        title: "Genitive: Partitive and After Prepositions",
        subtitle: "из, до, от, без, после, у and partitive use",
        cefr: "A2",
        xp_reward: 150,
      },
    ],
  },

  {
    id: "conj-past",
    title: "Past Tense Conjugation",
    subtitle: "What happened — gender agreement",
    cefr: "A1",
    tier: 1,
    prerequisites: ["conj-present"],
    status: "coming_soon",
    position: { x: 70, y: 380 },
    lessons: [
      {
        id: "conj-past-1",
        title: "Past Tense Formation",
        subtitle: "Dropping -ть and adding -л, -ла, -ло, -ли",
        cefr: "A1",
        xp_reward: 100,
      },
      {
        id: "conj-past-2",
        title: "Gender and Number Agreement in the Past",
        subtitle: "он читал / она читала — why it changes",
        cefr: "A1",
        xp_reward: 100,
      },
    ],
  },

  {
    id: "dat",
    title: "Dative Case",
    subtitle: "Giving, telling, and inner states",
    cefr: "A2",
    tier: 1,
    prerequisites: ["gen"],
    status: "coming_soon",
    position: { x: 30, y: 570 },
    lessons: [
      {
        id: "dat-1",
        title: "Dative: Indirect Objects",
        subtitle: "Giving and telling — дать кому, сказать кому",
        cefr: "A2",
        xp_reward: 100,
      },
      {
        id: "dat-2",
        title: "Dative: Age and Feelings",
        subtitle: "Мне 25 лет, мне холодно, мне нравится",
        cefr: "A2",
        xp_reward: 100,
      },
      {
        id: "dat-3",
        title: "Dative Verbs and Prepositions",
        subtitle: "помогать, верить, к, по and dative verbs",
        cefr: "A2",
        xp_reward: 150,
      },
    ],
  },

  {
    id: "conj-future",
    title: "Future Tense",
    subtitle: "Plans, intentions, completed actions",
    cefr: "A2",
    tier: 1,
    prerequisites: ["conj-past"],
    status: "coming_soon",
    position: { x: 70, y: 570 },
    lessons: [
      {
        id: "conj-future-1",
        title: "Imperfective Future — будет + инфинитив",
        subtitle: "я буду читать — ongoing future actions",
        cefr: "A2",
        xp_reward: 100,
      },
      {
        id: "conj-future-2",
        title: "Perfective Future",
        subtitle: "я прочитаю — completed future actions",
        cefr: "A2",
        xp_reward: 100,
      },
    ],
  },

  // ─────────────────────────────────────────────
  // TIER 2 — Core Grammar (A2–B1)
  // ─────────────────────────────────────────────

  {
    id: "instr",
    title: "Instrumental Case",
    subtitle: "With, by means of, and becoming",
    cefr: "A2",
    tier: 2,
    prerequisites: ["dat"],
    status: "coming_soon",
    position: { x: 30, y: 780 },
    lessons: [
      {
        id: "instr-1",
        title: "Instrumental: With and By Means Of",
        subtitle: "с другом, писать ручкой — accompaniment and tool",
        cefr: "A2",
        xp_reward: 100,
      },
      {
        id: "instr-2",
        title: "Instrumental: Predicate Nouns",
        subtitle: "Он стал врачом — becoming and being",
        cefr: "A2",
        xp_reward: 100,
      },
      {
        id: "instr-3",
        title: "Instrumental Prepositions",
        subtitle: "между, за, перед, над, под, рядом с",
        cefr: "A2",
        xp_reward: 150,
      },
    ],
  },

  {
    id: "aspect",
    title: "Verbal Aspect",
    subtitle: "The most important concept in Russian",
    cefr: "A2",
    tier: 2,
    prerequisites: ["conj-future"],
    status: "coming_soon",
    position: { x: 70, y: 780 },
    lessons: [
      {
        id: "aspect-1",
        title: "What Is Aspect?",
        subtitle: "Imperfective vs perfective — the core idea",
        cefr: "A2",
        xp_reward: 100,
      },
      {
        id: "aspect-2",
        title: "Aspect in the Past Tense",
        subtitle: "читал vs прочитал — process vs completion",
        cefr: "A2",
        xp_reward: 150,
      },
    ],
  },

  {
    id: "prep",
    title: "Prepositional Case",
    subtitle: "Location and topics of thought",
    cefr: "A2",
    tier: 2,
    prerequisites: ["instr"],
    status: "coming_soon",
    position: { x: 30, y: 970 },
    lessons: [
      {
        id: "prep-1",
        title: "Prepositional: Location",
        subtitle: "в школе, на работе, в городе",
        cefr: "A2",
        xp_reward: 100,
      },
      {
        id: "prep-2",
        title: "Prepositional: About and Special Forms",
        subtitle: "говорить о, думать о — and irregular forms",
        cefr: "A2",
        xp_reward: 100,
      },
    ],
  },

  {
    id: "aspect-practice",
    title: "Aspect in Practice",
    subtitle: "Choosing the right aspect in context",
    cefr: "B1",
    tier: 2,
    prerequisites: ["aspect"],
    status: "coming_soon",
    position: { x: 70, y: 970 },
    lessons: [
      {
        id: "aspect-practice-1",
        title: "Aspect Choice Rules",
        subtitle: "How to decide which aspect to use — 5 key rules",
        cefr: "B1",
        xp_reward: 150,
      },
      {
        id: "aspect-practice-2",
        title: "Aspect with Negation",
        subtitle: "не читал vs не прочитал — what changes",
        cefr: "B1",
        xp_reward: 150,
      },
      {
        id: "aspect-practice-3",
        title: "Aspect in Commands and Requests",
        subtitle: "читай vs прочитай — when tone and aspect align",
        cefr: "B1",
        xp_reward: 150,
      },
    ],
  },

  {
    id: "adj",
    title: "Adjective Agreement",
    subtitle: "Adjectives change to match nouns",
    cefr: "A2",
    tier: 2,
    prerequisites: ["prep"],
    status: "coming_soon",
    position: { x: 30, y: 1160 },
    lessons: [
      {
        id: "adj-1",
        title: "Adjectives in Nominative and Accusative",
        subtitle: "новый, новая, новое, новые — gender and number",
        cefr: "A2",
        xp_reward: 100,
      },
      {
        id: "adj-2",
        title: "Adjectives Across All Cases",
        subtitle: "нового, новому, новым — the full declension",
        cefr: "A2",
        xp_reward: 150,
      },
      {
        id: "adj-3",
        title: "Soft Adjectives and Special Stems",
        subtitle: "синий, хороший, большой — the irregular group",
        cefr: "B1",
        xp_reward: 150,
      },
    ],
  },

  {
    id: "motion",
    title: "Verbs of Motion",
    subtitle: "Going, walking, driving — direction matters",
    cefr: "B1",
    tier: 2,
    prerequisites: ["aspect-practice"],
    status: "coming_soon",
    position: { x: 70, y: 1160 },
    lessons: [
      {
        id: "motion-1",
        title: "идти vs ходить / ехать vs ездить",
        subtitle: "One-direction vs multi-direction — the core split",
        cefr: "B1",
        xp_reward: 150,
      },
      {
        id: "motion-2",
        title: "Direction Cases with Motion Verbs",
        subtitle: "идти в школу, ехать на море — which case and why",
        cefr: "B1",
        xp_reward: 150,
      },
    ],
  },

  {
    id: "adj-short",
    title: "Short-Form Adjectives",
    subtitle: "A second set of adjective endings",
    cefr: "B1",
    tier: 2,
    prerequisites: ["adj"],
    status: "coming_soon",
    position: { x: 30, y: 1340 },
    lessons: [
      {
        id: "adj-short-1",
        title: "Formation of Short Adjectives",
        subtitle: "рад, готов, должен — how they're built",
        cefr: "B1",
        xp_reward: 100,
      },
      {
        id: "adj-short-2",
        title: "Short vs Long Adjective Usage",
        subtitle: "When the short form is required — and when it changes meaning",
        cefr: "B1",
        xp_reward: 150,
      },
    ],
  },

  {
    id: "motion-prefix",
    title: "Prefixed Motion Verbs",
    subtitle: "Arrive, leave, enter, exit — prefixes give direction",
    cefr: "B1",
    tier: 2,
    prerequisites: ["motion"],
    status: "coming_soon",
    position: { x: 70, y: 1340 },
    lessons: [
      {
        id: "motion-prefix-1",
        title: "Common Prefixes: при-, у-, вы-, за-",
        subtitle: "Arriving, leaving, going out, stopping by",
        cefr: "B1",
        xp_reward: 150,
      },
      {
        id: "motion-prefix-2",
        title: "Aspect of Prefixed Motion Verbs",
        subtitle: "приходить vs прийти — how prefixes interact with aspect",
        cefr: "B1",
        xp_reward: 150,
      },
    ],
  },

  // ─────────────────────────────────────────────
  // TIER 3 — Advanced (B1–B2)
  // ─────────────────────────────────────────────

  {
    id: "numerals",
    title: "Numerals and Cases",
    subtitle: "Numbers change the nouns they govern",
    cefr: "B1",
    tier: 3,
    prerequisites: ["adj-short"],
    status: "coming_soon",
    position: { x: 20, y: 1560 },
    lessons: [
      {
        id: "numerals-1",
        title: "Numerals 1–4 and Case",
        subtitle: "один, два/три/четыре — nominative vs genitive singular",
        cefr: "B1",
        xp_reward: 150,
      },
      {
        id: "numerals-2",
        title: "Numerals 5–20 and Beyond",
        subtitle: "пять and above → genitive plural — and why",
        cefr: "B1",
        xp_reward: 150,
      },
      {
        id: "numerals-3",
        title: "Ordinal Numbers and Dates",
        subtitle: "первый, второй — dates, years, floors",
        cefr: "B1",
        xp_reward: 100,
      },
    ],
  },

  {
    id: "conditional",
    title: "Conditional Mood",
    subtitle: "If / would — real and hypothetical",
    cefr: "B1",
    tier: 3,
    prerequisites: ["adj-short", "motion-prefix"],
    status: "coming_soon",
    position: { x: 42, y: 1560 },
    lessons: [
      {
        id: "conditional-1",
        title: "The Particle бы and Past Tense",
        subtitle: "я бы хотел — how the conditional is formed",
        cefr: "B1",
        xp_reward: 150,
      },
      {
        id: "conditional-2",
        title: "Real vs Unreal Conditions",
        subtitle: "если + present vs если бы + past — the difference",
        cefr: "B1",
        xp_reward: 150,
      },
    ],
  },

  {
    id: "participles",
    title: "Participles",
    subtitle: "Verb forms that act like adjectives",
    cefr: "B1",
    tier: 3,
    prerequisites: ["motion-prefix"],
    status: "coming_soon",
    position: { x: 64, y: 1560 },
    lessons: [
      {
        id: "participles-1",
        title: "Active Present Participles",
        subtitle: "читающий — the person who is reading",
        cefr: "B1",
        xp_reward: 150,
      },
      {
        id: "participles-2",
        title: "Active Past Participles",
        subtitle: "читавший — the person who was reading",
        cefr: "B1",
        xp_reward: 150,
      },
      {
        id: "participles-3",
        title: "Passive Participles",
        subtitle: "прочитанный — the book that was read",
        cefr: "B2",
        xp_reward: 200,
      },
    ],
  },

  {
    id: "reflexive",
    title: "Reflexive Verbs",
    subtitle: "The -ся / -сь suffix and what it means",
    cefr: "B1",
    tier: 3,
    prerequisites: ["conditional"],
    status: "coming_soon",
    position: { x: 30, y: 1760 },
    lessons: [
      {
        id: "reflexive-1",
        title: "Reflexive and Reciprocal Meanings",
        subtitle: "мыться, одеваться, встречаться — self and each other",
        cefr: "B1",
        xp_reward: 150,
      },
      {
        id: "reflexive-2",
        title: "Reflexive as Passive and Fixed Expressions",
        subtitle: "строится, казаться, нравиться — obligatorily reflexive verbs",
        cefr: "B1",
        xp_reward: 150,
      },
    ],
  },

  {
    id: "imperative",
    title: "Imperative Mood",
    subtitle: "Commands, requests, and instructions",
    cefr: "B1",
    tier: 3,
    prerequisites: ["conditional", "participles"],
    status: "coming_soon",
    position: { x: 50, y: 1760 },
    lessons: [
      {
        id: "imperative-1",
        title: "Forming the Imperative",
        subtitle: "читай / читайте — the formation rules",
        cefr: "B1",
        xp_reward: 100,
      },
      {
        id: "imperative-2",
        title: "Aspect in Commands and Softening",
        subtitle: "читай vs прочитай — tone, politeness, and aspect choice",
        cefr: "B1",
        xp_reward: 150,
      },
    ],
  },

  {
    id: "verbal-adverbs",
    title: "Verbal Adverbs",
    subtitle: "Деепричастия — doing two things at once",
    cefr: "B2",
    tier: 3,
    prerequisites: ["participles"],
    status: "coming_soon",
    position: { x: 70, y: 1760 },
    lessons: [
      {
        id: "verbal-adverbs-1",
        title: "Imperfective Verbal Adverbs",
        subtitle: "читая — while reading, simultaneously",
        cefr: "B2",
        xp_reward: 200,
      },
      {
        id: "verbal-adverbs-2",
        title: "Perfective Verbal Adverbs",
        subtitle: "прочитав — having read, before starting next action",
        cefr: "B2",
        xp_reward: 200,
      },
    ],
  },

  {
    id: "comparatives",
    title: "Comparatives and Superlatives",
    subtitle: "Better, worse, the most, the least",
    cefr: "B1",
    tier: 3,
    prerequisites: ["reflexive", "imperative"],
    status: "coming_soon",
    position: { x: 30, y: 1960 },
    lessons: [
      {
        id: "comparatives-1",
        title: "Simple Comparatives",
        subtitle: "лучше, хуже, больше, меньше — the short form",
        cefr: "B1",
        xp_reward: 100,
      },
      {
        id: "comparatives-2",
        title: "Compound Comparatives and Superlatives",
        subtitle: "более интересный, самый красивый",
        cefr: "B1",
        xp_reward: 150,
      },
    ],
  },

  {
    id: "subjunctive",
    title: "Subjunctive and чтобы",
    subtitle: "Wishes, purposes, and indirect requests",
    cefr: "B2",
    tier: 3,
    prerequisites: ["imperative", "verbal-adverbs"],
    status: "coming_soon",
    position: { x: 60, y: 1960 },
    lessons: [
      {
        id: "subjunctive-1",
        title: "Чтобы Clauses",
        subtitle: "хочу, чтобы ты пришёл — purpose and desire",
        cefr: "B2",
        xp_reward: 200,
      },
      {
        id: "subjunctive-2",
        title: "Wishes, Requests, and Softening",
        subtitle: "Хотелось бы, было бы неплохо — polite indirection",
        cefr: "B2",
        xp_reward: 200,
      },
    ],
  },

  {
    id: "sentence-complexity",
    title: "Sentence Complexity",
    subtitle: "Write like a real speaker",
    cefr: "B2",
    tier: 3,
    prerequisites: ["comparatives", "subjunctive"],
    status: "coming_soon",
    position: { x: 50, y: 2150 },
    lessons: [
      {
        id: "sentence-complexity-1",
        title: "Subordinate Clauses",
        subtitle: "что, потому что, хотя — joining ideas",
        cefr: "B2",
        xp_reward: 200,
      },
      {
        id: "sentence-complexity-2",
        title: "Relative Clauses with который",
        subtitle: "The book that I read — который in all cases",
        cefr: "B2",
        xp_reward: 200,
      },
      {
        id: "sentence-complexity-3",
        title: "Temporal and Complex Clauses",
        subtitle: "когда, пока, после того как, до того как",
        cefr: "B2",
        xp_reward: 200,
      },
    ],
  },
];

// ─────────────────────────────────────────────
// DERIVED HELPERS (used by RoadmapView at runtime)
// ─────────────────────────────────────────────

/**
 * Returns a flat list of all lesson IDs across the roadmap.
 * Useful for bulk-fetching lesson_completions from Supabase.
 */
export function getAllLessonIds() {
  return GRAMMAR_ROADMAP.flatMap(node => node.lessons.map(l => l.id));
}

/**
 * Given a map of lessonId → completion state (0–4),
 * returns a map of nodeId → effective node state.
 *
 * Node state rules:
 *   - If ALL lessons in the node are state >= 3 → node state = min(lesson states) (could be 3 or 4)
 *   - If ANY lesson is state >= 2 (in progress) → node state = 2
 *   - If the node is unlocked (all prerequisites complete) → node state = 1
 *   - Otherwise → node state = 0
 *
 * "All prerequisites complete" means every prerequisite node's effective state >= 3.
 */
export function computeNodeStates(lessonStateMap) {
  const nodeStates = {};

  // Two-pass: first pass computes raw states, second resolves prerequisites in order
  // Since prerequisites always reference earlier nodes, a single ordered pass suffices.
  for (const node of GRAMMAR_ROADMAP) {
    const lessonStates = node.lessons.map(l => lessonStateMap[l.id] ?? 0);
    const allComplete = lessonStates.every(s => s >= 3);
    const anyInProgress = lessonStates.some(s => s >= 2);
    const allPrereqsDone = node.prerequisites.every(prereqId => (nodeStates[prereqId] ?? 0) >= 3);

    if (allComplete) {
      nodeStates[node.id] = Math.min(...lessonStates); // 3 or 4
    } else if (anyInProgress) {
      nodeStates[node.id] = 2;
    } else if (allPrereqsDone) {
      nodeStates[node.id] = 1;
    } else {
      nodeStates[node.id] = 0;
    }
  }

  return nodeStates;
}

/**
 * Given a node ID and a lesson state map, returns the first lesson
 * in the node that is not yet completed — i.e., the active lesson.
 * Returns null if all lessons are completed.
 */
export function getActiveLesson(nodeId, lessonStateMap) {
  const node = GRAMMAR_ROADMAP.find(n => n.id === nodeId);
  if (!node) return null;
  return node.lessons.find(l => (lessonStateMap[l.id] ?? 0) < 3) ?? null;
}