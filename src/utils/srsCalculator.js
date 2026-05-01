// src/utils/srsCalculator.js
// Pure SM-2 SRS calculation. No API calls. No side effects.
//
// Usage:
//   import { calculateSrs } from "../utils/srsCalculator";
//   const result = calculateSrs({ quality, interval_days, ease_factor, review_count });
//
// quality:       0–5 (use SRS_QUALITY constants from constants/index.js)
// interval_days: current value from word row (pass 0 if null)
// ease_factor:   current value from word row (pass 2.5 if null)
// review_count:  current value from word row (pass 0 if null)
//
// Returns: { next_review_at, interval_days, ease_factor, review_count }

export function calculateSrs({
  quality,
  interval_days = 0,
  ease_factor   = 2.5,
  review_count  = 0,
}) {
  let newInterval    = interval_days;
  let newRepetitions = review_count;
  let newEase        = ease_factor;

  if (quality < 3) {
    // Failed — reset interval, drop ease
    newInterval    = 1;
    newRepetitions = 0;
    newEase        = Math.max(1.3, ease_factor - 0.2);
  } else {
    // Passed — advance interval
    if (review_count === 0)      newInterval = 1;
    else if (review_count === 1) newInterval = 1;
    else if (review_count === 2) newInterval = 2;
    else if (review_count === 3) newInterval = 2;
    else if (review_count === 4) newInterval = 4;
    else if (review_count === 5) newInterval = 4;
    else                         newInterval = Math.round(interval_days * ease_factor);

    newRepetitions = review_count + 1;
    const easeDelta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
    newEase = Math.max(1.3, ease_factor + easeDelta);
  }

  const nextReviewAt = new Date(
    Date.now() + newInterval * 24 * 60 * 60 * 1000
  ).toISOString();

  return {
    next_review_at: nextReviewAt,
    interval_days:  newInterval,
    ease_factor:    Math.round(newEase * 1000) / 1000,
    review_count:   newRepetitions,
  };
}