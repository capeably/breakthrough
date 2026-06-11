// Word pools (design doc §4.1, personalized) and the legibility-safe picker.
// Words are decorative-thematic: if a candidate can't render at or above the
// minimum font size for a brick face, we simply pick a shorter word — the
// pool always contains words that fit.

import { CONFIG, COLORS } from './config.js';

export const WORD_POOLS = {
  1: [ // Nuisance — daily friction
    'SNOOZE', 'DOOMSCROLL', 'JUST CHECKING', 'ONE MORE...', 'ONE MORE GAME',
    'PINGS', 'NEW TAB', 'CLUTTER', 'NOISE', 'EXCUSES', 'BUSYWORK',
    'NOTIFICATIONS',
  ],
  2: [ // Weight — the heavier stuff
    'DOUBT', 'WORRY', 'FEAR', 'GUILT', 'AVOIDANCE', 'INERTIA',
    'VAGUE DREAD', 'AMBIGUITY', 'COMPARISON', 'OVERANALYSIS',
  ],
  3: [ // Anchor — armored
    'SHAME', 'REGRET', 'RESENTMENT', 'DREAD', 'OVERWHELM', 'LONELINESS',
  ],
};

// The infinite scroll, literalized — content words for THE FEED's conveyor.
export const FEED_WORDS = ['REELS', 'POSTS', 'TAKES', 'DRAMA', 'MEMES', 'ADS'];

// The JOYFUL mantra — canonical copy (design doc §6, finalized; do not paraphrase).
export const JOYFUL_LETTERS = ['J', 'O', 'Y', 'F', 'U', 'L'];
export const JOYFUL_PHRASES = {
  J: 'Just do it.',
  O: 'One step at a time.',
  Y: 'Your impact matters.',
  F: 'Focus on what matters most.',
  U: 'Unlock the earned reward.',
  L: 'Liftoff in 5-4-3-2-1 — GO!',
};

// Full power-up roster. `words` is what bricks and capsules display; aliases
// map extra positive vocabulary onto the same effect (§5.1).
const POSITIVE_DROPS = [
  { effect: 'wide', words: ['PEACE'] },
  { effect: 'magnet', words: ['STILLNESS'] },
  { effect: 'clarity', words: ['CLARITY'] },
  { effect: 'multiball', words: ['COURAGE', 'MOMENTUM'] },
  { effect: 'net', words: ['RESILIENCE', 'GRACE'] },
  { effect: 'laser', words: ['FOCUS'] },
  { effect: 'freedom', words: ['FREEDOM'] },
  { effect: 'joy', words: ['JOY', 'IMPACT'] },
  { effect: 'hope', words: ['HOPE', 'GRATITUDE'] },
  { effect: 'connection', words: ['CONNECTION'] },
  { effect: 'wonder', words: ['WONDER'] },
];

// Per-chapter drop weights (§5.2): early chapters teach paddle feel; later
// chapters open up the chaos toys. Index = chapter.
export const CHAPTER_WEIGHTS = [
  [['wide', 24], ['magnet', 20], ['clarity', 20], ['multiball', 14], ['net', 8], ['wonder', 14]],
  [['laser', 22], ['multiball', 18], ['wide', 14], ['magnet', 12], ['clarity', 12], ['net', 10], ['wonder', 12]],
  [['net', 16], ['freedom', 18], ['connection', 18], ['laser', 12], ['multiball', 12], ['wonder', 12], ['clarity', 9], ['hope', 3]],
  [['joy', 20], ['freedom', 16], ['connection', 14], ['laser', 14], ['multiball', 14], ['wonder', 14], ['hope', 8]],
];

let measureCtx = null;

function getMeasureCtx() {
  if (!measureCtx) {
    measureCtx = document.createElement('canvas').getContext('2d');
  }
  return measureCtx;
}

export function wordFont(px) {
  return `700 ${px}px Inter, system-ui, sans-serif`;
}

// Largest font size in [min..max] at which `word` fits `maxWidth`, or 0.
export function fitFontSize(word, maxWidth) {
  const ctx = getMeasureCtx();
  for (let px = CONFIG.words.maxFontPx; px >= CONFIG.words.minFontPx; px--) {
    ctx.font = wordFont(px);
    if (ctx.measureText(word).width <= maxWidth) return px;
  }
  return 0;
}

// For elite names that exceed the floor (PROCRASTINATION = 15 chars): render
// at the minimum size with a horizontal squeeze instead of dropping the word.
export function fitWithScale(word, maxWidth) {
  const px = fitFontSize(word, maxWidth);
  if (px > 0) return { fontSize: px, scaleX: 1 };
  const ctx = getMeasureCtx();
  ctx.font = wordFont(CONFIG.words.minFontPx);
  const w = ctx.measureText(word).width;
  return { fontSize: CONFIG.words.minFontPx, scaleX: Math.min(1, maxWidth / w) };
}

const recentByTier = { 1: [], 2: [], 3: [] };

export function pickBrickWord(tier, brickWidth) {
  const maxWidth = brickWidth - CONFIG.words.padX * 2;
  const pool = WORD_POOLS[tier];
  const recent = recentByTier[tier];

  // a few attempts at variety, then fall back to anything that fits
  for (let attempt = 0; attempt < 6; attempt++) {
    const word = pool[(Math.random() * pool.length) | 0];
    if (attempt < 4 && recent.includes(word)) continue;
    const size = fitFontSize(word, maxWidth);
    if (size > 0) {
      recent.push(word);
      if (recent.length > 3) recent.shift();
      return { word, fontSize: size };
    }
  }
  // guaranteed fallback: shortest word in the pool
  const word = [...pool].sort((a, b) => a.length - b.length)[0];
  return { word, fontSize: fitFontSize(word, maxWidth) || CONFIG.words.minFontPx };
}

export function pickWeightedEffect(chapterIndex = 0) {
  const weights = CHAPTER_WEIGHTS[Math.min(chapterIndex, CHAPTER_WEIGHTS.length - 1)];
  let total = 0;
  for (const [, w] of weights) total += w;
  let roll = Math.random() * total;
  for (const [effect, w] of weights) {
    roll -= w;
    if (roll <= 0) return effect;
  }
  return weights[0][0];
}

export function wordForEffect(effect) {
  const drop = POSITIVE_DROPS.find((d) => d.effect === effect);
  if (!drop) return effect.toUpperCase();
  return drop.words[(Math.random() * drop.words.length) | 0];
}

// effect + display word, weighted by chapter (or restricted to forcedEffects)
export function pickPositive(chapterIndex = 0, forcedEffects = null) {
  let effect;
  if (forcedEffects) {
    effect = forcedEffects[(Math.random() * forcedEffects.length) | 0];
  } else {
    effect = pickWeightedEffect(chapterIndex);
  }
  return { effect, word: wordForEffect(effect) };
}

// WONDER's d20 table — the result picks the effect (design doc §5.1).
// Nat 20: instant Breakthrough Mode. Nat 1: confetti poof + 100 pts.
export function d20Effect(roll) {
  if (roll === 1) return 'dud';
  if (roll <= 4) return 'clarity';
  if (roll <= 7) return 'wide';
  if (roll <= 10) return 'magnet';
  if (roll <= 13) return 'laser';
  if (roll <= 15) return 'net';
  if (roll <= 17) return 'multiball';
  if (roll === 18) return 'freedom';
  if (roll === 19) return 'joy';
  return 'breakthrough';
}

export const WORD_COLORS = {
  negative: COLORS.wordInk,
  positive: COLORS.wordInkDark,
};
