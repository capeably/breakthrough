// The JOYFUL letters (design doc §6) — a run-long collection in the EXTEND
// tradition. Six letters; each speaks its line once when collected; completing
// the set enacts L's line: 5-4-3-2-1 → GO! → instant Breakthrough Mode,
// +1 Setback, +5000. Run-scoped; repeat collection allowed, tokens get rarer.

import { CONFIG } from './config.js';
import { JOYFUL_LETTERS, JOYFUL_PHRASES } from './words.js';

export function createJoyful() {
  return {
    collected: 0, // 0..6 — letters are always collected in order
    cycle: 0, // completed sets this run

    reset() {
      this.collected = 0;
      this.cycle = 0;
    },

    get complete() {
      return this.collected >= JOYFUL_LETTERS.length;
    },

    nextLetter() {
      return this.complete ? null : JOYFUL_LETTERS[this.collected];
    },

    phraseFor(letter) {
      return JOYFUL_PHRASES[letter];
    },

    // elite kills roll for a token drop; rarer each completed cycle
    rollEliteDrop() {
      return Math.random() < CONFIG.joyful.eliteDropChance / (this.cycle + 1);
    },

    // returns { letter, phrase, completed }
    collect() {
      const letter = this.nextLetter();
      if (!letter) return null;
      this.collected++;
      const completed = this.complete;
      if (completed) {
        this.cycle++;
        this.collected = 0;
      }
      return { letter, phrase: JOYFUL_PHRASES[letter], completed };
    },

    slots() {
      return JOYFUL_LETTERS.map((ch, i) => ({ ch, lit: i < this.collected }));
    },
  };
}
