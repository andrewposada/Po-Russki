// src/constants/homeCopy.js
//
// Hero headline copy for the Home screen.
// Each key maps to an array of 10–15 bilingual lines.
// Lines use a mix of English and Russian — simple enough to be understood
// at A1–A2, but introduce vocabulary naturally.
//
// Template tokens: {topic}, {bookTitle}, {dueCount}, {streak}
// Substitution is done in useHomeRecommendations before returning heroLine.
//
// Selection: date-seeded random — same line all day, rotates daily.
// Seed function: dayOfYear % lines.length

export const HOME_COPY = {

  // ── Vocab due ───────────────────────────────────────────────────────────
  // Triggered when dueCount >= 3
  vocab_due: [
    "You have {dueCount} words waiting. Слова не терпят.",
    "Память — мышца. {dueCount} words due — time to flex.",
    "{dueCount} words are due. Повторение — мать учения.",
    "Your слова missed you. {dueCount} are ready to review.",
    "Time to review. {dueCount} words, no excuses.",
    "Не забывай! {dueCount} words are due today.",
    "{dueCount} words on the clock. Ready when you are.",
    "The words won't wait forever. {dueCount} due right now.",
    "Vocabulary review: {dueCount} words. Начнём?",
    "Слова ждут. {dueCount} ready for review.",
    "A little review goes a long way. {dueCount} words due.",
    "{dueCount} слова хотят внимания. Let's not disappoint them.",
    "Your brain is ready. {dueCount} words are too.",
  ],

  // ── Lesson overdue ──────────────────────────────────────────────────────
  // Triggered when last lesson activity was 3+ days ago
  lesson_overdue: [
    "It's been a while. Уроки скучают по вам.",
    "The lessons missed you. Let's pick up where you left off.",
    "Давно не виделись! Ready to get back to it?",
    "A few days away — уроки ждут вашего возвращения.",
    "Consistency wins. Time to open the учебник again.",
    "Your Russian won't learn itself. Уроки ждут.",
    "It's been {daysSince} days. Не страшно — let's continue.",
    "Come back to the path. Дорога не исчезла.",
    "Pick up where you left off. Продолжим?",
    "Every day matters. Let's not lose the momentum.",
    "The roadmap is waiting. Следующий урок готов.",
    "Small steps every day. Начнём с урока?",
    "Back to basics. Грамматика не исчезла.",
  ],

  // ── Lesson available (recently active, next lesson ready) ───────────────
  // Triggered when last lesson was within 3 days and a new lesson is unlocked
  lesson_available: [
    "Good momentum! Next lesson is unlocked — продолжаем?",
    "Новый урок ждёт. You're on a roll.",
    "One more lesson. Один шаг вперёд.",
    "Your next lesson is ready. Вперёд!",
    "Keep going — следующий урок открыт.",
    "Progress is progress. Next lesson, let's go.",
    "Урок разблокирован. Time to dive in.",
    "The path continues. Следующая остановка — новый урок.",
    "Learning is cumulative. Next stop on the roadmap.",
    "Готов к уроку? It's waiting for you.",
    "You unlocked the next step. Продолжаем!",
    "Маленький шаг — but a real one. Next lesson is open.",
  ],

  // ── Weak grammar topic ──────────────────────────────────────────────────
  // Triggered when a topic has accuracy < 55% in last 30 attempts
  weak_topic: [
    "Your {topic} needs some love. Let's drill it.",
    "Weak spot detected: {topic}. A little practice helps a lot.",
    "Time to work on {topic}. Практика делает совершенным.",
    "{topic} keeps tripping you up. Let's fix that today.",
    "Freeplay focus: {topic}. Готов?",
    "Your {topic} accuracy is low. One session can change that.",
    "Trouble with {topic}? You're not alone — and it's fixable.",
    "Focus mode: {topic}. Небольшая тренировка — большой результат.",
    "{topic} — let's make it click today.",
    "The grammar drill awaits. {topic} is on the menu.",
    "Систематика важна. Time to revisit {topic}.",
    "Small gaps compound. Let's close the {topic} gap now.",
  ],

  // ── Reading in progress ─────────────────────────────────────────────────
  // Triggered when a book has been started but not finished, last read 2+ days ago
  reading: [
    "«{bookTitle}» is waiting. Куда делась история?",
    "You left off mid-story. «{bookTitle}» wants a reader.",
    "Back to «{bookTitle}»? The story hasn't gone anywhere.",
    "Reading is vocabulary in disguise. Continue «{bookTitle}».",
    "Your книга is patient. «{bookTitle}» — let's continue.",
    "Context builds language. Pick up «{bookTitle}» again.",
    "Истории учат. «{bookTitle}» is right where you left it.",
    "Real reading, real progress. Вернёмся к «{bookTitle}»?",
    "The best way to absorb Russian: read. «{bookTitle}» awaits.",
    "Следующая глава ждёт. Continue «{bookTitle}».",
    "«{bookTitle}» — halfway through and already learning.",
    "Immersion starts with reading. «{bookTitle}» is here.",
  ],

  // ── Assignment pending ──────────────────────────────────────────────────
  // Triggered when pending assignment count > 0
  assignment_pending: [
    "You have a задание waiting. Best not to leave it.",
    "Assignment due. Время сдавать работу.",
    "Don't forget your задание — it's ready for review.",
    "Pending assignment: tackle it while it's fresh.",
    "Your teacher is waiting. Complete the задание.",
    "Задание готово. Let's see what you can do.",
    "One assignment standing between you and progress.",
    "Finish the задание — you're closer than you think.",
    "Assignments keep you honest. Yours is waiting.",
  ],

  // ── Streak builder ──────────────────────────────────────────────────────
  // Triggered when streak > 0 and no higher-priority item exists
  // Also used as an encouraging secondary line
  streak: [
    "🔥 {streak} days in a row. Не останавливайтесь.",
    "{streak}-day streak! Keep the огонь burning.",
    "Day {streak} — consistency is the whole game.",
    "🔥 {streak} days strong. Продолжаем!",
    "{streak} days running. Russian rewards persistence.",
    "Streak: {streak} days. Язык не забывает усилий.",
    "You've shown up {streak} days straight. Impressive.",
    "Day {streak} of your Russian journey. Keep going.",
  ],

  // ── Fallback / light day ────────────────────────────────────────────────
  // Shown when no urgent items exist — score < 0.3 on all candidates
  fallback: [
    "Feeling good? Разомните язык с игрой в Табу.",
    "Nothing urgent — perfect time for Табу.",
    "Light day? Play a round of Табу to stay sharp.",
    "Язык требует разминки. How about a game of Табу?",
    "All caught up. Сыграем в Табу?",
    "No pressure today. Just a little Табу?",
    "Relaxed day — keep it light with Табу.",
    "Maintenance mode: Табу is always a good call.",
    "Every day, even rest days, has room for Табу.",
    "A word game a day keeps the забывание away.",
    "Табу: describe without saying the word. Ready?",
    "Лёгкий день — light practice still counts.",
    "When in doubt, play Табу.",
  ],

  // ── Listening ────────────────────────────────────────────────────────────
  // Triggered when user hasn't done a listening exercise in 3+ days
  listening: [
    "Понимание на слух — it's a different muscle. Train it today.",
    "Слушание: the skill that separates textbook Russian from real Russian.",
    "Time to tune your ear. A listening exercise is ready.",
    "Can you catch every word? Let's find out — слушаем.",
    "Reading is one thing. Hearing is another. Тренируем слух.",
    "The fastest way to understand native speakers: practice слушание.",
    "Ready for an audio challenge? Слушание module is waiting.",
    "Your ears need reps too. Let's do a listening exercise.",
    "Понимание на слух builds faster than you think. One exercise?",
    "Even short listening sessions improve comprehension. Начнём?",
    "Слушание — the module that surprises most learners. Ready?",
  ],
};

// ── Date-seeded random selection ────────────────────────────────────────────
// Returns a consistent pick for a given day — same result on any render within
// the same calendar day, but rotates daily.

function dayOfYear() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now - start;
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

/**
 * Pick a line from a copy array using a date seed.
 * @param {string[]} lines — array of copy strings
 * @param {number} [salt=0] — add a salt to differentiate primary vs secondary picks from the same category
 * @returns {string}
 */
export function pickLine(lines, salt = 0) {
  if (!lines || lines.length === 0) return "";
  const idx = (dayOfYear() + salt) % lines.length;
  return lines[idx];
}

/**
 * Substitute template tokens in a copy line.
 * @param {string} line — e.g. "You have {dueCount} words waiting."
 * @param {object} tokens — e.g. { dueCount: 8, bookTitle: "Буря", topic: "dative", streak: 12 }
 * @returns {string}
 */
export function fillTokens(line, tokens = {}) {
  return line.replace(/\{(\w+)\}/g, (_, key) => tokens[key] ?? "");
}