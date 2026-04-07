// src/data/grammarReference.js
//
// All Cheat Sheet content.
// Keys must exactly match node IDs in grammarRoadmap.js.
// CheatSheet.jsx imports this and renders whatever topics it finds.
// Adding content for a new topic: add a new key to GRAMMAR_REFERENCE.
// No component changes needed.
//
// Each topic entry shape:
// {
//   title:     string               — display title
//   subtitle:  string               — Russian name / subtitle
//   cefr:      string               — "A1" | "A2" | "B1" | "B2"
//   uses:      string[]             — when/why this case/form is used
//   tables: [
//     {
//       id:      string             — unique within topic, used as React key
//       label:   string             — short caption above the table
//       headers: string[]
//       rows:    string[][]         — each row is array of cell strings
//       cellExamples: {             — optional: keyed by "rowIndex-colIndex"
//         "0-1": [                  — array of { ru, en } example pairs
//           { ru: "...", en: "..." }
//         ]
//       }
//     }
//   ],
//   examples: [
//     { ru: string, en: string, note: string }
//   ],
//   exceptions: [
//     { ru: string, note: string }
//   ],
//   callouts: [
//     { type: "warning" | "tip" | "remember", text: string }
//   ]
// }

export const GRAMMAR_REFERENCE = {

  // ─────────────────────────────────────────────
  // NOMINATIVE
  // ─────────────────────────────────────────────

  nom: {
    title: "Nominative Case",
    subtitle: "Именительный падеж",
    cefr: "A1",
    uses: [
      "Subject of the sentence — who or what is performing the action",
      "Predicate noun after быть (to be) — Он врач (He is a doctor)",
      "Dictionary / citation form of any noun or adjective",
    ],
    tables: [
      {
        id: "nom-noun-sg",
        label: "Noun endings — singular (nominative is the base form)",
        headers: ["Gender", "Ending", "Example"],
        rows: [
          ["Masculine", "consonant", "стол, брат"],
          ["Masculine", "-й", "музей, трамвай"],
          ["Masculine", "-ь", "день, словарь"],
          ["Feminine", "-а / -я", "книга, неделя"],
          ["Feminine", "-ь", "ночь, площадь"],
          ["Neuter", "-о / -е", "окно, море"],
        ],
        cellExamples: {
          "0-2": [{ ru: "Стол стоит у окна.", en: "The table is by the window." }],
          "3-2": [{ ru: "Книга лежит здесь.", en: "The book is here." }],
          "5-2": [{ ru: "Море красиво.", en: "The sea is beautiful." }],
        },
      },
      {
        id: "nom-noun-pl",
        label: "Noun endings — plural",
        headers: ["Gender", "Ending", "Example"],
        rows: [
          ["Masculine", "-ы / -и", "столы, музеи"],
          ["Feminine", "-ы / -и", "книги, недели"],
          ["Neuter", "-а / -я", "окна, моря"],
        ],
        cellExamples: {
          "0-2": [{ ru: "Столы стоят здесь.", en: "The tables are here." }],
          "2-2": [{ ru: "Окна открыты.", en: "The windows are open." }],
        },
      },
    ],
    examples: [
      { ru: "Студент читает книгу.", en: "The student is reading a book.", note: "Студент is the subject — nominative." },
      { ru: "Кошка спит на диване.", en: "The cat is sleeping on the sofa.", note: "Кошка is the subject — nominative feminine." },
      { ru: "Он — хороший учитель.", en: "He is a good teacher.", note: "After быть, the predicate noun stays nominative." },
    ],
    exceptions: [
      { ru: "время, имя, знамя", note: "Neuter nouns ending in -мя take -мени in all oblique cases." },
      { ru: "путь", note: "Masculine noun that follows feminine declension pattern in most cases." },
    ],
    callouts: [
      {
        type: "tip",
        text: "The nominative is the dictionary form. When you look a noun up in a dictionary, you see the nominative singular.",
      },
      {
        type: "remember",
        text: "Adjectives in the nominative must agree in gender and number with their noun: новый стол, новая книга, новое окно, новые столы.",
      },
    ],
  },

  // ─────────────────────────────────────────────
  // ACCUSATIVE
  // ─────────────────────────────────────────────

  acc: {
    title: "Accusative Case",
    subtitle: "Винительный падеж",
    cefr: "A1",
    uses: [
      "Direct object of a transitive verb — I read the book (книгу)",
      "Direction or destination — going to Moscow (в Москву)",
      "Duration of time — for a week (неделю), for an hour (час)",
      "After prepositions: в (into/to), на (onto/to), за (behind, for), через (through)",
    ],
    tables: [
      {
        id: "acc-noun-sg",
        label: "Noun endings — singular",
        headers: ["Gender", "Animate", "Inanimate", "Change from Nom"],
        rows: [
          ["Masculine", "-а / -я (= gen)", "no change", "Animate only changes"],
          ["Feminine", "-у / -ю", "-у / -ю", "Always changes"],
          ["Neuter", "no change", "no change", "Never changes"],
        ],
        cellExamples: {
          "0-1": [
            { ru: "Я вижу брата.", en: "I see my brother." },
            { ru: "Мы любим учителя.", en: "We love the teacher." },
          ],
          "0-2": [{ ru: "Я читаю журнал.", en: "I am reading a magazine." }],
          "1-1": [{ ru: "Я вижу маму.", en: "I see mum." }],
          "1-2": [{ ru: "Я читаю книгу.", en: "I am reading a book." }],
          "2-2": [{ ru: "Я пью молоко.", en: "I am drinking milk." }],
        },
      },
      {
        id: "acc-noun-pl",
        label: "Noun endings — plural",
        headers: ["Gender", "Animate", "Inanimate"],
        rows: [
          ["Masculine", "= genitive plural", "= nominative plural"],
          ["Feminine", "= genitive plural", "= nominative plural"],
          ["Neuter", "= nominative plural", "= nominative plural"],
        ],
        cellExamples: {
          "0-1": [{ ru: "Я вижу студентов.", en: "I see the students." }],
          "0-2": [{ ru: "Я читаю журналы.", en: "I am reading magazines." }],
        },
      },
    ],
    examples: [
      { ru: "Она читает газету.", en: "She is reading a newspaper.", note: "Газета → газету: feminine accusative." },
      { ru: "Мы едем в Москву.", en: "We are going to Moscow.", note: "Direction: в + accusative." },
      { ru: "Я жду час.", en: "I have been waiting for an hour.", note: "Duration of time: accusative without preposition." },
    ],
    exceptions: [
      { ru: "путь", note: "Masculine but follows feminine pattern: путь → путь (inanim. acc. = nom.)." },
    ],
    callouts: [
      {
        type: "warning",
        text: "The animate/inanimate distinction only affects masculine nouns and all plurals. Feminine nouns always take -у/-ю in accusative singular regardless of animacy.",
      },
      {
        type: "tip",
        text: "A useful test: can you ask 'who?' about the object? If yes — it is animate. If 'what?' — inanimate.",
      },
    ],
  },

  // ─────────────────────────────────────────────
  // GENITIVE
  // ─────────────────────────────────────────────

  gen: {
    title: "Genitive Case",
    subtitle: "Родительный падеж",
    cefr: "A1",
    uses: [
      "Possession and belonging — my brother's book (книга брата)",
      "Absence and negation — I don't have (у меня нет + gen), no time (нет времени)",
      "Quantity and measurement — a glass of water (стакан воды), a lot of (много + gen)",
      "After negated verbs — Я не вижу машины (I don't see the car)",
      "After prepositions: из, до, от, без, после, у, около, для, вместо, кроме",
      "Numbers 2–4 take genitive singular; 5+ take genitive plural",
    ],
    tables: [
      {
        id: "gen-noun-sg",
        label: "Noun endings — singular",
        headers: ["Gender", "Ending", "Example"],
        rows: [
          ["Masculine (hard)", "-а", "стол → стола"],
          ["Masculine (soft)", "-я", "музей → музея"],
          ["Feminine (hard)", "-ы", "книга → книги"],
          ["Feminine (soft)", "-и", "неделя → недели"],
          ["Feminine -ь", "-и", "ночь → ночи"],
          ["Neuter (hard)", "-а", "окно → окна"],
          ["Neuter (soft)", "-я", "море → моря"],
        ],
        cellExamples: {
          "0-2": [{ ru: "книга брата", en: "brother's book" }],
          "2-2": [{ ru: "нет книги", en: "no book / there is no book" }],
          "5-2": [{ ru: "стакан молока", en: "a glass of milk" }],
        },
      },
      {
        id: "gen-noun-pl",
        label: "Noun endings — plural (the hardest case to memorize)",
        headers: ["Gender/Type", "Ending", "Example"],
        rows: [
          ["Masc hard stem", "-ов", "стол → столов"],
          ["Masc soft / -й", "-ев / -ёв", "музей → музеев"],
          ["Masc -ь", "-ей", "словарь → словарей"],
          ["Fem -а (hard)", "zero ending", "книга → книг"],
          ["Fem -я / soft", "-ь + zero", "неделя → недель"],
          ["Fem -ь", "-ей", "ночь → ночей"],
          ["Neuter -о", "zero ending", "окно → окон"],
          ["Neuter -е", "-ей", "море → морей"],
        ],
        cellExamples: {
          "0-2": [{ ru: "пять столов", en: "five tables" }],
          "3-2": [{ ru: "нет книг", en: "no books" }],
        },
      },
    ],
    examples: [
      { ru: "У меня нет времени.", en: "I don't have time.", note: "Absence: нет + genitive. Время → времени." },
      { ru: "Стакан воды, пожалуйста.", en: "A glass of water, please.", note: "Quantity: стакан + genitive." },
      { ru: "Он живёт без машины.", en: "He lives without a car.", note: "Preposition без always takes genitive." },
    ],
    exceptions: [
      { ru: "друг → друзей", note: "Irregular genitive plural — не другов." },
      { ru: "человек → людей", note: "Suppletive plural (completely different stem)." },
      { ru: "ребёнок → детей", note: "Suppletive plural — irregular genitive plural." },
    ],
    callouts: [
      {
        type: "warning",
        text: "Genitive plural has many irregular forms. The most common nouns — человек, ребёнок, друг — are suppletive or irregular. Memorize these early.",
      },
      {
        type: "tip",
        text: "After numbers: один takes nominative singular; два/три/четыре take genitive singular; пять and above take genitive plural.",
      },
    ],
  },

  // ─────────────────────────────────────────────
  // DATIVE
  // ─────────────────────────────────────────────

  dat: {
    title: "Dative Case",
    subtitle: "Дательный падеж",
    cefr: "A2",
    uses: [
      "Indirect object — to whom / for whom: give to (дать кому), say to (сказать кому)",
      "Age expression — Мне 25 лет (I am 25 years old)",
      "Inner states and feelings — Мне холодно (I am cold), мне нравится (I like)",
      "After prepositions: к (towards), по (along, by, according to)",
      "With impersonal constructions — Надо, нужно, можно, нельзя + dative for the experiencer",
    ],
    tables: [
      {
        id: "dat-noun-sg",
        label: "Noun endings — singular",
        headers: ["Gender", "Ending", "Example"],
        rows: [
          ["Masculine (hard)", "-у", "брат → брату"],
          ["Masculine (soft)", "-ю", "учитель → учителю"],
          ["Feminine (hard)", "-е", "мама → маме"],
          ["Feminine (soft)", "-е / -и", "неделя → неделе"],
          ["Feminine -ь", "-и", "ночь → ночи"],
          ["Neuter", "-у / -ю", "окно → окну, море → морю"],
        ],
        cellExamples: {
          "0-2": [{ ru: "Я дал брату книгу.", en: "I gave my brother the book." }],
          "2-2": [{ ru: "Он позвонил маме.", en: "He called his mum." }],
          "5-2": [{ ru: "Иди к морю.", en: "Walk towards the sea." }],
        },
      },
      {
        id: "dat-noun-pl",
        label: "Noun endings — plural",
        headers: ["Gender", "Ending", "Example"],
        rows: [
          ["Masculine (hard)", "-ам", "братьям"],
          ["Masculine (soft)", "-ям", "учителям"],
          ["Feminine", "-ам / -ям", "мамам, неделям"],
          ["Neuter", "-ам / -ям", "окнам, морям"],
        ],
        cellExamples: {
          "0-2": [{ ru: "Я помог братьям.", en: "I helped my brothers." }],
        },
      },
    ],
    examples: [
      { ru: "Мне двадцать пять лет.", en: "I am twenty-five years old.", note: "Age: dative of the experiencer + лет." },
      { ru: "Мне нравится эта книга.", en: "I like this book.", note: "Нравиться takes dative — literally 'pleases to me'." },
      { ru: "Ей холодно.", en: "She is cold.", note: "Impersonal state: dative experiencer + short adjective." },
    ],
    exceptions: [
      { ru: "мать → матери", note: "Dative singular of мать (mother) is матери, not мате." },
      { ru: "дочь → дочери", note: "Same pattern as мать." },
    ],
    callouts: [
      {
        type: "remember",
        text: "Нравиться, помогать, верить, мешать, принадлежать, and several other verbs always take a dative object rather than accusative.",
      },
      {
        type: "tip",
        text: "Мне, тебе, ему, ей, нам, вам, им are the personal pronoun dative forms. Memorize these — they appear constantly in everyday Russian.",
      },
    ],
  },

  // ─────────────────────────────────────────────
  // INSTRUMENTAL
  // ─────────────────────────────────────────────

  instr: {
    title: "Instrumental Case",
    subtitle: "Творительный падеж",
    cefr: "A2",
    uses: [
      "Means or instrument — write with a pen (писать ручкой), travel by train (ехать поездом)",
      "Accompaniment — with a friend (с другом), with pleasure (с удовольствием)",
      "Predicate noun with быть (to be) in the past/future — He was/became a doctor (был/стал врачом)",
      "After prepositions: с (with), за (behind), перед (in front of), над (above), под (below), между (between), рядом с (next to)",
    ],
    tables: [
      {
        id: "instr-noun-sg",
        label: "Noun endings — singular",
        headers: ["Gender", "Ending", "Example"],
        rows: [
          ["Masculine (hard)", "-ом", "брат → братом"],
          ["Masculine (soft)", "-ем / -ём", "учитель → учителем"],
          ["Feminine (hard)", "-ой", "мама → мамой"],
          ["Feminine (soft)", "-ей / -ёй", "неделя → неделей"],
          ["Feminine -ь", "-ью", "ночь → ночью"],
          ["Neuter (hard)", "-ом", "окно → окном"],
          ["Neuter (soft)", "-ем", "море → морем"],
        ],
        cellExamples: {
          "0-2": [{ ru: "Он стал врачом.", en: "He became a doctor." }],
          "2-2": [{ ru: "Я пришёл с мамой.", en: "I came with mum." }],
          "4-2": [{ ru: "ночью темно", en: "it is dark at night" }],
        },
      },
      {
        id: "instr-noun-pl",
        label: "Noun endings — plural",
        headers: ["Gender", "Ending", "Example"],
        rows: [
          ["Masculine", "-ами / -ями", "братьями, учителями"],
          ["Feminine", "-ами / -ями", "мамами, неделями"],
          ["Neuter", "-ами / -ями", "окнами, морями"],
        ],
        cellExamples: {},
      },
    ],
    examples: [
      { ru: "Пишу ручкой.", en: "I am writing with a pen.", note: "Instrument: ручка → ручкой." },
      { ru: "Он идёт с другом.", en: "He is walking with a friend.", note: "С + instrumental for accompaniment." },
      { ru: "Она стала учительницей.", en: "She became a teacher.", note: "Predicate noun after стать: instrumental." },
    ],
    exceptions: [
      { ru: "мать → матерью", note: "Instrumental of мать is матерью." },
      { ru: "дочь → дочерью", note: "Same pattern as мать." },
    ],
    callouts: [
      {
        type: "remember",
        text: "After быть, стать, казаться, называться, and являться: the predicate noun must be instrumental, not nominative.",
      },
      {
        type: "tip",
        text: "Time expressions: утром (in the morning), днём (in the afternoon), вечером (in the evening), ночью (at night) — all instrumental of time nouns.",
      },
    ],
  },

  // ─────────────────────────────────────────────
  // PREPOSITIONAL
  // ─────────────────────────────────────────────

  prep: {
    title: "Prepositional Case",
    subtitle: "Предложный падеж",
    cefr: "A2",
    uses: [
      "Location — in/at a place: в школе (at school), на работе (at work), в городе (in the city)",
      "Topic of speech or thought — говорить о (to talk about), думать о (to think about)",
      "After prepositions: в (in, at), на (on, at), о / об / обо (about), при (in the presence of, under)",
    ],
    tables: [
      {
        id: "prep-noun-sg",
        label: "Noun endings — singular",
        headers: ["Gender", "Ending", "Example"],
        rows: [
          ["Masculine (hard)", "-е", "город → городе"],
          ["Masculine (soft)", "-е / -и", "музей → музее, гений → гении"],
          ["Feminine (hard)", "-е", "школа → школе"],
          ["Feminine (soft)", "-е / -и", "неделя → неделе, лекция → лекции"],
          ["Feminine -ь", "-и", "ночь → ночи"],
          ["Neuter (hard)", "-е", "окно → окне"],
          ["Neuter (soft)", "-е / -и", "море → море, здание → здании"],
        ],
        cellExamples: {
          "0-2": [{ ru: "Он живёт в городе.", en: "He lives in the city." }],
          "2-2": [{ ru: "Мы учимся в школе.", en: "We study at school." }],
          "5-2": [{ ru: "Книга на окне.", en: "The book is on the window sill." }],
        },
      },
    ],
    examples: [
      { ru: "Она работает в больнице.", en: "She works at the hospital.", note: "Location: в + prepositional." },
      { ru: "Мы говорим о погоде.", en: "We are talking about the weather.", note: "Topic: о + prepositional." },
      { ru: "Книга лежит на столе.", en: "The book is on the table.", note: "На + prepositional for surface location." },
    ],
    exceptions: [
      { ru: "гений → гении", note: "Nouns ending in -ий/-ие/-ия take -и, not -е, in the prepositional." },
      { ru: "лес, сад → в лесу, в саду", note: "A small group of masculine nouns take stressed -у/-ю in prepositional after в/на. Memorize these." },
    ],
    callouts: [
      {
        type: "tip",
        text: "В vs на: generally, в = inside an enclosed space (в комнате, в магазине). На = on a surface or at an open place (на столе, на работе, на улице). But there are many exceptions — set phrases must be memorized.",
      },
      {
        type: "warning",
        text: "О becomes об before words starting with a vowel: об этом (about this), об Иване (about Ivan). It becomes обо before себе: говорить обо мне (talk about me).",
      },
    ],
  },

  // ─────────────────────────────────────────────
  // PRESENT TENSE CONJUGATION
  // ─────────────────────────────────────────────

  "conj-present": {
    title: "Present Tense Conjugation",
    subtitle: "Настоящее время",
    cefr: "A1",
    uses: [
      "Ongoing actions happening right now — I am reading (я читаю)",
      "Habitual actions — I read every day (я читаю каждый день)",
      "General truths — Water boils at 100°C",
      "Only imperfective verbs have a present tense — perfective verbs go straight to future",
    ],
    tables: [
      {
        id: "conj-present-type1",
        label: "Type I conjugation (-ать / -ять verbs)",
        headers: ["Person", "Ending", "читать", "знать"],
        rows: [
          ["я (I)", "-ю / -у", "читаю", "знаю"],
          ["ты (you, sg)", "-ешь / -ёшь", "читаешь", "знаешь"],
          ["он/она (he/she)", "-ет / -ёт", "читает", "знает"],
          ["мы (we)", "-ем / -ём", "читаем", "знаем"],
          ["вы (you, pl)", "-ете / -ёте", "читаете", "знаете"],
          ["они (they)", "-ют / -ут", "читают", "знают"],
        ],
        cellExamples: {
          "0-2": [{ ru: "Я читаю книгу.", en: "I am reading a book." }],
          "1-2": [{ ru: "Ты читаешь по-русски?", en: "Do you read in Russian?" }],
        },
      },
      {
        id: "conj-present-type2",
        label: "Type II conjugation (-ить / -еть / -ать verbs with consonant mutation)",
        headers: ["Person", "Ending", "говорить", "любить"],
        rows: [
          ["я (I)", "-ю / -у (+ mutation)", "говорю", "люблю"],
          ["ты (you, sg)", "-ишь", "говоришь", "любишь"],
          ["он/она (he/she)", "-ит", "говорит", "любит"],
          ["мы (we)", "-им", "говорим", "любим"],
          ["вы (you, pl)", "-ите", "говорите", "любите"],
          ["они (they)", "-ят / -ат", "говорят", "любят"],
        ],
        cellExamples: {
          "0-2": [{ ru: "Я говорю по-русски.", en: "I speak Russian." }],
          "0-3": [{ ru: "Я люблю кофе.", en: "I love coffee." }],
        },
      },
    ],
    examples: [
      { ru: "Он работает в банке.", en: "He works at a bank.", note: "Type I: работать → работает." },
      { ru: "Они говорят по-французски.", en: "They speak French.", note: "Type II: говорить → говорят." },
      { ru: "Мы понимаем задание.", en: "We understand the task.", note: "Type I: понимать → понимаем." },
    ],
    exceptions: [
      { ru: "хотеть", note: "Mixed conjugation: хочу, хочешь, хочет (Sg Type II style), хотим, хотите, хотят (Pl Type I style)." },
      { ru: "есть (to eat)", note: "Highly irregular: ем, ешь, ест, едим, едите, едят." },
      { ru: "дать (to give)", note: "Highly irregular: дам, дашь, даст, дадим, дадите, дадут." },
    ],
    callouts: [
      {
        type: "warning",
        text: "Type II verbs with certain consonants in the stem mutate in the я form only: любить → люблю, готовить → готовлю, писать → пишу (Type I with mutation). The other persons are regular.",
      },
      {
        type: "tip",
        text: "To find the verb type: remove -ть from the infinitive. If the remaining stem ends in -а/-я and has more than one syllable → likely Type I. If it ends in -и → likely Type II. When in doubt, check a dictionary.",
      },
    ],
  },

  // ─────────────────────────────────────────────
  // PAST TENSE CONJUGATION
  // ─────────────────────────────────────────────

  "conj-past": {
    title: "Past Tense Conjugation",
    subtitle: "Прошедшее время",
    cefr: "A1",
    uses: [
      "Actions completed or ongoing in the past — I read, I was reading",
      "Past tense is formed the same way for all persons — no person-based ending changes",
      "Agreement is by gender and number of the subject, not by person",
      "Both imperfective and perfective verbs have a past tense",
    ],
    tables: [
      {
        id: "past-endings",
        label: "Past tense endings",
        headers: ["Subject", "Ending", "читать", "говорить"],
        rows: [
          ["он / я (m)", "-л", "читал", "говорил"],
          ["она / ты (f)", "-ла", "читала", "говорила"],
          ["оно (n)", "-ло", "читало", "говорило"],
          ["они / мы / вы (pl)", "-ли", "читали", "говорили"],
        ],
        cellExamples: {
          "0-2": [{ ru: "Он читал газету.", en: "He was reading the newspaper." }],
          "1-2": [{ ru: "Она читала всю ночь.", en: "She read all night." }],
          "3-2": [{ ru: "Мы читали вместе.", en: "We read together." }],
        },
      },
    ],
    examples: [
      { ru: "Вчера он работал дома.", en: "Yesterday he worked from home.", note: "Masculine subject → -л ending." },
      { ru: "Она пришла поздно.", en: "She arrived late.", note: "Perfective past, feminine → -ла ending." },
      { ru: "Дети играли в парке.", en: "The children were playing in the park.", note: "Plural → -ли ending." },
    ],
    exceptions: [
      { ru: "идти → шёл / шла / шли", note: "Irregular past: stem changes completely." },
      { ru: "мочь → мог / могла / могли", note: "Irregular: no -л in masculine form." },
      { ru: "нести → нёс / несла / несли", note: "Many -ти verbs drop the -л in masculine: вести → вёл, везти → вёз." },
    ],
    callouts: [
      {
        type: "remember",
        text: "Masculine past tense has NO ending after the -л: читал (not читало). The bare -л form is masculine singular only.",
      },
      {
        type: "tip",
        text: "When the subject is я or ты, the ending still depends on natural gender: я читал (if you are male), я читала (if you are female).",
      },
    ],
  },

  // ─────────────────────────────────────────────
  // FUTURE TENSE
  // ─────────────────────────────────────────────

  "conj-future": {
    title: "Future Tense",
    subtitle: "Будущее время",
    cefr: "A2",
    uses: [
      "Imperfective future (compound): будет + infinitive — describes ongoing or repeated future actions",
      "Perfective future (simple): conjugate the perfective verb in present-tense endings — describes a completed future action",
      "The distinction mirrors imperfective/perfective in the past: process vs completion",
    ],
    tables: [
      {
        id: "future-impf",
        label: "Imperfective future — будет + infinitive",
        headers: ["Person", "Form of быть", "Example"],
        rows: [
          ["я", "буду", "буду читать"],
          ["ты", "будешь", "будешь читать"],
          ["он/она", "будет", "будет читать"],
          ["мы", "будем", "будем читать"],
          ["вы", "будете", "будете читать"],
          ["они", "будут", "будут читать"],
        ],
        cellExamples: {
          "0-2": [{ ru: "Завтра я буду читать.", en: "Tomorrow I will be reading." }],
          "2-2": [{ ru: "Он будет работать весь день.", en: "He will be working all day." }],
        },
      },
      {
        id: "future-pf",
        label: "Perfective future — conjugate like present tense",
        headers: ["Person", "прочитать (pf)", "сказать (pf)"],
        rows: [
          ["я", "прочитаю", "скажу"],
          ["ты", "прочитаешь", "скажешь"],
          ["он/она", "прочитает", "скажет"],
          ["мы", "прочитаем", "скажем"],
          ["вы", "прочитаете", "скажете"],
          ["они", "прочитают", "скажут"],
        ],
        cellExamples: {
          "0-1": [{ ru: "Я прочитаю эту книгу.", en: "I will (have) read this book." }],
          "2-2": [{ ru: "Она скажет правду.", en: "She will tell the truth." }],
        },
      },
    ],
    examples: [
      { ru: "Я буду учиться каждый день.", en: "I will study every day.", note: "Ongoing/repeated: imperfective future." },
      { ru: "Я выучу это правило.", en: "I will learn this rule (and know it).", note: "Completed result: perfective future." },
    ],
    exceptions: [],
    callouts: [
      {
        type: "warning",
        text: "Perfective verbs have NO compound future. Never say буду прочитать — use прочитаю.",
      },
      {
        type: "tip",
        text: "If you are not sure which aspect to use: imperfective future is safer. It describes what you will be doing. Perfective future emphasises that you will finish.",
      },
    ],
  },

  // ─────────────────────────────────────────────
  // VERBAL ASPECT
  // ─────────────────────────────────────────────

  aspect: {
    title: "Verbal Aspect",
    subtitle: "Глагольный вид",
    cefr: "A2",
    uses: [
      "Every Russian verb has an aspect: imperfective (НСВ) or perfective (СВ)",
      "Imperfective — the process, duration, repetition, or general fact of an action",
      "Perfective — the completion, result, or single occurrence of an action",
      "Aspect must be chosen at every point where a verb is used — it is not optional",
    ],
    tables: [
      {
        id: "aspect-pairs",
        label: "Common aspect pairs",
        headers: ["Imperfective (НСВ)", "Perfective (СВ)", "Notes"],
        rows: [
          ["читать", "прочитать", "prefix по- / про-"],
          ["писать", "написать", "prefix на-"],
          ["говорить", "сказать", "suppletive pair"],
          ["делать", "сделать", "prefix с-"],
          ["покупать", "купить", "suppletive pair"],
          ["приходить", "прийти", "suppletive pair"],
          ["видеть", "увидеть", "prefix у-"],
        ],
        cellExamples: {
          "0-0": [{ ru: "Я читал книгу.", en: "I was reading a book (process)." }],
          "0-1": [{ ru: "Я прочитал книгу.", en: "I read the book (finished)." }],
          "2-0": [{ ru: "Он говорил долго.", en: "He spoke for a long time." }],
          "2-1": [{ ru: "Он сказал правду.", en: "He said (told) the truth." }],
        },
      },
    ],
    examples: [
      { ru: "Вчера я читал весь вечер.", en: "Yesterday I was reading all evening.", note: "Process/duration → imperfective." },
      { ru: "Я прочитал эту книгу за три дня.", en: "I read this book in three days.", note: "Completed result → perfective." },
      { ru: "Он часто звонит маме.", en: "He often calls his mum.", note: "Habitual/repeated → imperfective." },
    ],
    exceptions: [
      { ru: "Some verbs are bi-aspectual", note: "Verbs like использовать (to use) and женить (to marry) can serve as both imperfective and perfective depending on context." },
    ],
    callouts: [
      {
        type: "remember",
        text: "Aspect is not about past/present/future. It is about whether the action is viewed as a completed whole (perfective) or as a process/fact (imperfective).",
      },
      {
        type: "tip",
        text: "Context clue: time expressions like всегда, часто, иногда, каждый день strongly suggest imperfective. Expressions like наконец, уже, вдруг, за + time period suggest perfective.",
      },
    ],
  },

  // ─────────────────────────────────────────────
  // STUB ENTRIES (remaining roadmap nodes)
  // Content to be added in future phases or sessions.
  // ─────────────────────────────────────────────

  adj: {
    title: "Adjective Agreement",
    subtitle: "Согласование прилагательных",
    cefr: "A2",
    uses: ["Adjectives must agree in gender, number, and case with the noun they modify."],
    tables: [],
    examples: [],
    exceptions: [],
    callouts: [],
  },

  "adj-short": {
    title: "Short-Form Adjectives",
    subtitle: "Краткая форма прилагательных",
    cefr: "B1",
    uses: ["Short adjectives are used predicatively (after быть) and in fixed expressions."],
    tables: [],
    examples: [],
    exceptions: [],
    callouts: [],
  },

  motion: {
    title: "Verbs of Motion",
    subtitle: "Глаголы движения",
    cefr: "B1",
    uses: ["Russian distinguishes one-directional (идти) from multi-directional (ходить) motion."],
    tables: [],
    examples: [],
    exceptions: [],
    callouts: [],
  },

  "motion-prefix": {
    title: "Prefixed Motion Verbs",
    subtitle: "Приставочные глаголы движения",
    cefr: "B1",
    uses: ["Prefixes add directional meaning: при- (arrival), у- (departure), вы- (exit), за- (stopping by)."],
    tables: [],
    examples: [],
    exceptions: [],
    callouts: [],
  },

  "aspect-practice": {
    title: "Aspect in Practice",
    subtitle: "Вид глагола на практике",
    cefr: "B1",
    uses: ["Advanced aspect usage: negation, commands, requests, and the 5 key choice rules."],
    tables: [],
    examples: [],
    exceptions: [],
    callouts: [],
  },

  numerals: {
    title: "Numerals and Cases",
    subtitle: "Числительные и падежи",
    cefr: "B1",
    uses: ["Numbers 1–4 take genitive singular; 5+ take genitive plural; ordinals decline like adjectives."],
    tables: [],
    examples: [],
    exceptions: [],
    callouts: [],
  },

  conditional: {
    title: "Conditional Mood",
    subtitle: "Условное наклонение",
    cefr: "B1",
    uses: ["The particle бы + past tense forms the conditional (would). Real vs unreal conditions differ."],
    tables: [],
    examples: [],
    exceptions: [],
    callouts: [],
  },

  participles: {
    title: "Participles",
    subtitle: "Причастия",
    cefr: "B1",
    uses: ["Participles are verb forms that function as adjectives. Active and passive, present and past."],
    tables: [],
    examples: [],
    exceptions: [],
    callouts: [],
  },

  reflexive: {
    title: "Reflexive Verbs",
    subtitle: "Возвратные глаголы",
    cefr: "B1",
    uses: ["The suffix -ся/-сь adds reflexive, reciprocal, or passive meaning depending on context."],
    tables: [],
    examples: [],
    exceptions: [],
    callouts: [],
  },

  imperative: {
    title: "Imperative Mood",
    subtitle: "Повелительное наклонение",
    cefr: "B1",
    uses: ["Commands and requests. Aspect choice changes tone: imperfective = casual/ongoing; perfective = specific/firm."],
    tables: [],
    examples: [],
    exceptions: [],
    callouts: [],
  },

  "verbal-adverbs": {
    title: "Verbal Adverbs",
    subtitle: "Деепричастия",
    cefr: "B2",
    uses: ["Verbal adverbs (gerunds) describe a secondary action by the same subject as the main verb."],
    tables: [],
    examples: [],
    exceptions: [],
    callouts: [],
  },

  comparatives: {
    title: "Comparatives and Superlatives",
    subtitle: "Сравнительная и превосходная степени",
    cefr: "B1",
    uses: ["Simple comparatives (лучше, хуже) and compound comparatives (более + adj, самый + adj)."],
    tables: [],
    examples: [],
    exceptions: [],
    callouts: [],
  },

  subjunctive: {
    title: "Subjunctive and чтобы",
    subtitle: "Сослагательное наклонение",
    cefr: "B2",
    uses: ["Чтобы clauses express purpose and desire. Wishes and polite indirection use бы + past."],
    tables: [],
    examples: [],
    exceptions: [],
    callouts: [],
  },

  "sentence-complexity": {
    title: "Sentence Complexity",
    subtitle: "Сложные предложения",
    cefr: "B2",
    uses: ["Subordinate clauses with что, потому что, хотя; relative clauses with который; temporal clauses."],
    tables: [],
    examples: [],
    exceptions: [],
    callouts: [],
  },
};