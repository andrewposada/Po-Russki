// src/components/TranslationTooltip/songExplainContext.js
// Singleton that SongStudy writes to so SelectionPill can access
// song lines without threading props through global context.
// When not in a song, lines is null and SelectionPill shows no Explain button.

export const songExplainContext = {
  lines: null, // set to song.lines array by SongStudy on mount, null on unmount
};