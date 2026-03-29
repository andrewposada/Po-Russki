// src/constants/index.js

// ── Models ────────────────────────────────────────────────────────────────────
export const MODEL_SONNET = "claude-sonnet-4-20250514";
export const MODEL_HAIKU  = "claude-haiku-4-5-20251001";
export const MODEL_OPUS   = "claude-opus-4-6";

// ── Color palette ─────────────────────────────────────────────────────────────
// Use these values in CSS Modules via var(--c-*) tokens defined in globals.css.
// Import C directly only when you need the value in JavaScript (e.g. SVG fills).
export const C = {
  bg:           "#f5f0e8",
  bgCard:       "#fffdf7",
  bgPanel:      "#eee8d8",
  bgDeep:       "#e8dfc8",
  border:       "#d4c9b0",
  borderSoft:   "#e0d8c4",
  sage:         "#7a9e7e",
  sageDark:     "#5a7a5e",
  sageLight:    "#c8ddc8",
  mushroom:     "#b07c5a",
  mushroomLight:"#e8c8a8",
  sky:          "#7aaec8",
  skyLight:     "#c8e0ee",
  cream:        "#f0e8d0",
  textDark:     "#3a3020",
  textMid:      "#6a5e48",
  textLight:    "#9a8e78",
  textXLight:   "#b8ae98",
  correct:      "#5a9e6a",
  wrong:        "#c07050",
  orange:       "#d08030",
};

// ── Header button accent colors ───────────────────────────────────────────────
export const HEADER_COLORS = {
  reference: { text: "#4a6e8a", bg: "#edf4f9", border: "#ccdde8", hover: "#ddeaf3", hoverBorder: "#b8d0e0" },
  progress:  { text: "#7a5a20", bg: "#faf0e0", border: "#e8d4a8", hover: "#f0e0c0", hoverBorder: "#d8c090" },
  words:     { text: "#3a6a3e", bg: "#eaf3ea", border: "#c0d8c0", hover: "#d4e8d4", hoverBorder: "#a8c8a8" },
  settings:  { text: "#6a4e38", bg: "#f4ece4", border: "#dcc8b4", hover: "#e8d8c8", hoverBorder: "#c8b098" },
};

// ── CEFR levels ───────────────────────────────────────────────────────────────
export const LEVELS = [
  { id: "A1" }, { id: "A2" }, { id: "B1" }, { id: "B2" }, { id: "C1" },
];

// ── QWERTY → Cyrillic map ─────────────────────────────────────────────────────
export const QWERTY_TO_CYR = {
  "`":"ё","~":"Ё",
  q:"я",w:"ш",e:"е",r:"р",t:"т",y:"ы",u:"у",i:"и",o:"о",p:"п",
  "[":"ю","]":"щ","\\":"э",
  a:"а",s:"с",d:"д",f:"ф",g:"г",h:"ч",j:"й",k:"к",l:"л",
  ";":"ь","'":"ж",
  z:"з",x:"х",c:"ц",v:"в",b:"б",n:"н",m:"м",
  Q:"Я",W:"Ш",E:"Е",R:"Р",T:"Т",Y:"Ы",U:"У",I:"И",O:"О",P:"П",
  "{":"Ю","}":"Щ","|":"Э",
  A:"А",S:"С",D:"Д",F:"Ф",G:"Г",H:"Ч",J:"Й",K:"К",L:"Л",
  ":":"Ь",'"':"Ж",
  Z:"З",X:"Х",C:"Ц",V:"В",B:"Б",N:"Н",M:"М",
};

// ── Grammar constants ─────────────────────────────────────────────────────────
export const ALL_CASES  = ["Nominative","Accusative","Genitive","Dative","Instrumental","Prepositional"];
export const G_CASES    = ["Nominative","Accusative","Genitive","Dative","Instrumental","Prepositional"];
export const G_TYPES    = ["Noun","Adjective","Pronoun","Verb"];
export const G_NUMBERS  = ["Singular","Plural"];

export const CASE_PILLS = [
  { id:"genitive",      label:"Genitive"      },
  { id:"prepositional", label:"Prepositional" },
  { id:"accusative",   label:"Accusative"    },
  { id:"dative",        label:"Dative"        },
  { id:"instrumental",  label:"Instrumental"  },
  { id:"nominative",    label:"Nominative"    },
];
export const G_TYPE_PILLS = [
  { id:"nouns",       label:"Nouns"       },
  { id:"adjectives",  label:"Adjectives"  },
  { id:"pronouns",    label:"Pronouns"    },
  { id:"verbs",       label:"Verbs"       },
  { id:"singular",    label:"Singular"    },
  { id:"plural",      label:"Plural"      },
];
export const G_MODES = [
  { id:"fillin",    label:"Fill in the Blank", icon:"✏️" },
  { id:"translate", label:"Translate",         icon:"🌿" },
  { id:"correct",   label:"Spot the Error",    icon:"🔍" },
];

export const gTopicKey = (cas, typ, num) => `${cas}|${typ}|${num}`;
export const ALL_G_TOPICS = G_CASES.flatMap(c =>
  G_TYPES.flatMap(t => G_NUMBERS.map(n => gTopicKey(c, t, n)))
);
export const defaultGScores = () => ({
  ...Object.fromEntries(ALL_G_TOPICS.map(k => [k, 30])),
  ...defaultConjScores(),
});

// ── Conjugation constants ─────────────────────────────────────────────────────
export const CONJ_TENSE_PILLS  = [
  { id:"present", label:"Present"         },
  { id:"past",    label:"Past"            },
  { id:"future",  label:"Future"          },
];
export const CONJ_ASPECT_PILLS = [
  { id:"imperfective", label:"Imperfective" },
  { id:"perfective",   label:"Perfective"   },
  { id:"both",         label:"Both (mixed)" },
];
export const CONJ_CLASS_PILLS  = [
  { id:"all",       label:"All verbs"      },
  { id:"class1",    label:"Class I (-ать)" },
  { id:"class2",    label:"Class II (-ить)"},
  { id:"irregular", label:"Irregular"      },
];
export const CONJ_MODE_PILLS   = [
  { id:"conjugate",     label:"Conjugate",     icon:"✏️" },
  { id:"translate",     label:"Translate",     icon:"🌿" },
  { id:"aspect_choice", label:"Aspect choice", icon:"⚡" },
];

export const conjTopicKey    = (tense, aspect, cls) => `conj:${tense}|${aspect}|${cls}`;
export const CONJ_TENSES     = ["present","past","future"];
export const CONJ_ASPECTS    = ["imperfective","perfective"];
export const CONJ_CLASSES    = ["class1","class2","irregular"];
export const ALL_CONJ_TOPICS = CONJ_TENSES.flatMap(t =>
  CONJ_ASPECTS.flatMap(a => CONJ_CLASSES.map(c => conjTopicKey(t, a, c)))
);
export const CONJ_ARC_TOPICS = ALL_CONJ_TOPICS.filter(
  k => !k.startsWith("conj:present|perfective")
);
export const defaultConjScores = () =>
  Object.fromEntries(ALL_CONJ_TOPICS.map(k => [k, 30]));

// ── Vocabulary constants ──────────────────────────────────────────────────────
export const VOCAB_TOPICS = [
  { id:"food",      label:"Food & Drink",       icon:"🍞" },
  { id:"animals",   label:"Animals",            icon:"🐾" },
  { id:"body",      label:"Body & Health",      icon:"🩺" },
  { id:"clothing",  label:"Clothing",           icon:"👗" },
  { id:"home",      label:"Home & Furniture",   icon:"🏠" },
  { id:"family",    label:"Family",             icon:"👨‍👩‍👧" },
  { id:"time",      label:"Numbers & Time",     icon:"🕐" },
  { id:"colours",   label:"Colours",            icon:"🎨" },
  { id:"weather",   label:"Weather",            icon:"🌤" },
  { id:"transport", label:"Transport",          icon:"🚂" },
  { id:"greetings", label:"Greetings & Phrases",icon:"👋" },
  { id:"emotions",  label:"Emotions & Feelings",icon:"💭" },
  { id:"work",      label:"Work & Professions", icon:"💼" },
  { id:"school",    label:"School & Education", icon:"📚" },
  { id:"shopping",  label:"Shopping",           icon:"🛍" },
  { id:"nature",    label:"Nature",             icon:"🌲" },
  { id:"travel",    label:"Travel & Places",    icon:"✈️" },
  { id:"sports",    label:"Sports & Hobbies",   icon:"⚽" },
];
export const V_TYPE_PILLS = [
  { id:"nouns",      label:"Nouns"      },
  { id:"adjectives", label:"Adjectives" },
  { id:"verbs",      label:"Verbs"      },
];
export const V_MODES = [
  { id:"translate",      label:"Translate",        icon:"🌿" },
  { id:"multiplechoice", label:"Multiple Choice",  icon:"🔢" },
  { id:"sentence",       label:"Use in a Sentence",icon:"✍️" },
  { id:"story",          label:"Story",            icon:"📖" },
  { id:"flashcard",      label:"Flashcards",       icon:"🃏" },
];

// ── Library constants ─────────────────────────────────────────────────────────
export const LIB_GENRES = [
  "Adventure","Mystery","Romance","Historical","Fantasy",
  "Folk Tale","Slice of Life","Thriller","Science Fiction","Comedy",
];
export const LIB_LENGTHS = [
  { id:"short",    label:"Short (8–10 ch)"    },
  { id:"standard", label:"Standard (11–13 ch)" },
  { id:"long",     label:"Long (14–15 ch)"    },
];
export const LIB_COVER_PALETTE = [
  "#6e7fa8","#7a6ea8","#6ea88a","#a86e7a","#a8936e",
  "#6e9ea8","#8a7aa8","#a87a6e","#6e8aa8","#7a9e8a",
];
export const libCoverColor = (title) => {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) & 0xffff;
  return LIB_COVER_PALETTE[h % LIB_COVER_PALETTE.length];
};

// ── Shared helpers ────────────────────────────────────────────────────────────
export const letterGrade = p => p >= 90 ? "A" : p >= 80 ? "B" : p >= 70 ? "C" : p >= 60 ? "D" : "F";
export const gradeColor  = g => ({ A:"#5a9e6a", B:"#7ab87e", C:"#b07820", D:"#b07c5a", F:"#c07050" }[g] || "#9a8e78");

export const pickWeightedTopic = (scores, selCases, selTypes) => {
  const casLabels  = selCases.map(id => CASE_PILLS.find(p => p.id === id)?.label).filter(Boolean);
  const typeLabels = [];
  if (selTypes.includes("nouns"))      typeLabels.push("Noun");
  if (selTypes.includes("adjectives")) typeLabels.push("Adjective");
  if (selTypes.includes("pronouns"))   typeLabels.push("Pronoun");
  if (selTypes.includes("verbs"))      typeLabels.push("Verb");
  if (!typeLabels.length)              typeLabels.push("Noun","Adjective","Pronoun","Verb");
  const numLabels = [];
  if (selTypes.includes("singular"))   numLabels.push("Singular");
  if (selTypes.includes("plural"))     numLabels.push("Plural");
  if (!numLabels.length)               numLabels.push("Singular","Plural");
  if (!casLabels.length) return null;
  const eligible = casLabels.flatMap(cas =>
    typeLabels.flatMap(typ => numLabels.map(num => ({ key: gTopicKey(cas, typ, num), cas, typ, num })))
  );
  const weights = eligible.map(t => ({ ...t, w: 100 - (scores[t.key] ?? 30) }));
  const total   = weights.reduce((s, t) => s + t.w, 0);
  if (total === 0) return eligible[0];
  let r = Math.random() * total;
  for (const t of weights) { r -= t.w; if (r <= 0) return t; }
  return weights[weights.length - 1];
};

// ── Changelog ─────────────────────────────────────────────────────────────────
export const APP_VERSION = "3.0.0";
export const CHANGELOG = [
  {
    version: "3.0.0",
    date: "2026",
    summary: "Full rebuild: React + Vite, Supabase, Firebase Auth, CSS Modules",
    changes: [
      "Migrated from single-file artifact to full React + Vite web app",
      "Supabase PostgreSQL database replaces localStorage",
      "Firebase Auth for sign-in (email/password + Google)",
      "CSS Modules for scoped, maintainable styling",
      "React Router with deep linking for all modules",
      "Global translation tooltip: highlight any Russian text to translate instantly",
      "Lemmatization: tooltip correctly identifies dictionary form of inflected words",
      "Word bank enrichment: Claude Haiku fills pronunciation, etymology, and usage on save",
      "Global Russian keyboard hook: QWERTY→Cyrillic in every text input",
      "Skeleton loading states throughout the app",
    ],
  },
];