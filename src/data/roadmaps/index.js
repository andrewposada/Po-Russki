// src/data/roadmaps/index.js
// Central registry — add new roadmaps here, no component changes needed

import { GRAMMAR_ROADMAP } from './grammarRoadmap';

export const ROADMAPS = [
  {
    id:       'grammar',
    title:    'Grammar Foundations',
    subtitle: 'Cases, conjugation, and aspect',
    icon:     '📐',
    config:   GRAMMAR_ROADMAP,
  },
  // Future entries:
  // { id: 'history', title: 'Russian History & Culture', icon: '📜', config: historyRoadmap },
];