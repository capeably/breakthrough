// The Flow meter and Breakthrough Mode (design doc §6) — sustained momentum
// literally builds to a breakthrough. Flow gains on every break (more for
// heavy bricks and air-chains), decays when idle, drains on Setbacks. At 100%
// the ball goes radiant: fireball + 2× score + wider paddle for 8 seconds.

import { CONFIG } from './config.js';

export function createFlow() {
  const cfg = CONFIG.flow;
  return {
    value: 0,
    chain: 0, // bricks broken since the last paddle touch
    idleT: 0,
    mode: { active: false, t: 0 },

    reset() {
      this.value = 0;
      this.chain = 0;
      this.idleT = 0;
      this.mode.active = false;
      this.mode.t = 0;
    },

    addBreak(kind, tier) {
      let gain =
        kind === 'elite' ? cfg.gainElite
        : kind === 'boss' ? cfg.gainBossSegment
        : kind === 'positive' ? cfg.gainPositive
        : cfg.gainByTier[tier] ?? 3;
      this.chain++;
      gain += Math.min(this.chain - 1, cfg.chainCap) * cfg.chainBonus;
      this.idleT = 0;
      if (!this.mode.active) {
        this.value = Math.min(cfg.max, this.value + gain);
      }
      return this.chain;
    },

    onPaddleTouch() {
      this.chain = 0;
    },

    onSetback() {
      this.chain = 0;
      this.value *= 1 - cfg.setbackDrain;
    },

    // returns true exactly once, on the tick the meter fills
    update(dt) {
      if (this.mode.active) {
        this.mode.t -= dt;
        if (this.mode.t <= 0) {
          this.mode.active = false;
          this.value = cfg.breakthrough.resetTo; // momentum carries
        }
        return false;
      }
      this.idleT += dt;
      if (this.idleT > cfg.decayIdleDelay && this.value > 0) {
        this.value = Math.max(0, this.value - cfg.decayPerSec * dt);
      }
      if (this.value >= cfg.max) {
        this.trigger();
        return true;
      }
      return false;
    },

    trigger() {
      this.mode.active = true;
      this.mode.t = cfg.breakthrough.duration;
      this.value = cfg.max;
    },
  };
}
