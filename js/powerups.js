// Capsule drops and effect lifecycle (design doc §5). The word IS the pickup:
// capsules display the positive word that dropped them. Max 2 timed effects;
// re-catching refreshes; everything eases in and out, nothing snaps.
// Also owns: laser bolts (FOCUS), falling JOYFUL letter tokens, and WONDER's
// on-screen d20.

import { CONFIG } from './config.js';
import { wordForEffect, fitFontSize } from './words.js';

const TIMED = ['wide', 'magnet', 'clarity', 'laser', 'freedom', 'joy', 'connection'];

export function createPowerups() {
  const capsules = [];
  const timed = []; // [{ effect, remaining, duration }]
  const bolts = []; // laser fire
  const letterTokens = []; // falling JOYFUL letters
  let netActive = false;
  let netFade = 0; // visual-only fade after a save
  let laserCooldown = 0;
  let d20 = null; // { t, settleT, x, y, roll, shown }

  function timedEntry(effect) {
    return timed.find((t) => t.effect === effect);
  }

  return {
    capsules,
    timed,
    bolts,
    letterTokens,

    get netActive() { return netActive; },
    get netFade() { return netFade; },
    get d20() { return d20; },

    has(effect) {
      if (effect === 'net') return netActive;
      return !!timedEntry(effect);
    },

    remaining(effect) {
      return timedEntry(effect)?.remaining ?? 0;
    },

    reset() {
      capsules.length = 0;
      timed.length = 0;
      bolts.length = 0;
      letterTokens.length = 0;
      netActive = false;
      netFade = 0;
      laserCooldown = 0;
      d20 = null;
    },

    spawnCapsule(x, y, effect, word) {
      const display = word ?? wordForEffect(effect);
      capsules.push({
        x, y, effect,
        word: display,
        fontSize: Math.max(9, fitFontSize(display, CONFIG.powerups.capsule.w - 14) || 11),
        vy: CONFIG.powerups.capsule.fallSpeed,
        wobble: Math.random() * Math.PI * 2,
      });
    },

    spawnLetterToken(x, y, letter) {
      letterTokens.push({ x, y, letter, vy: CONFIG.joyful.tokenFallSpeed, wobble: Math.random() * Math.PI * 2 });
    },

    tryFireLaser(paddle) {
      if (!this.has('laser') || laserCooldown > 0) return false;
      laserCooldown = CONFIG.powerups.laser.shotInterval;
      const r = paddle.rect();
      bolts.push({ x: r.x + 10, y: r.y - 6 });
      bolts.push({ x: r.x + r.w - 10, y: r.y - 6 });
      return true;
    },

    startD20(x, y) {
      d20 = {
        t: CONFIG.powerups.wonder.rollTime,
        settleT: 0,
        x: Math.max(80, Math.min(CONFIG.width - 80, x)),
        y: Math.max(140, y - 40),
        roll: 1 + ((Math.random() * 20) | 0),
      };
    },

    apply(effect) {
      if (effect === 'net') {
        netActive = true;
        return;
      }
      if (!TIMED.includes(effect)) return; // structural effects live in main
      const dur = CONFIG.powerups[effect].duration;
      const existing = timedEntry(effect);
      if (existing) {
        existing.remaining = dur; // re-catch refreshes
        return;
      }
      if (timed.length >= CONFIG.powerups.maxTimedEffects) {
        timed.shift(); // replace the oldest
      }
      timed.push({ effect, remaining: dur, duration: dur });
    },

    consumeNet() {
      if (!netActive) return false;
      netActive = false;
      netFade = 0.5;
      return true;
    },

    // ctx: { paddleRect, onCatch(c), onMiss(c), onLetterCatch(t), onD20(roll) }
    update(dt, ctx) {
      const half = CONFIG.powerups.capsule.w / 2;
      const hh = CONFIG.powerups.capsule.h / 2;
      const pr = ctx.paddleRect;

      for (let i = capsules.length - 1; i >= 0; i--) {
        const c = capsules[i];
        c.y += c.vy * dt;
        c.wobble += dt * 4;
        const overlaps =
          c.y + hh >= pr.y && c.y - hh <= pr.y + pr.h &&
          c.x + half >= pr.x && c.x - half <= pr.x + pr.w;
        if (overlaps) {
          capsules.splice(i, 1);
          ctx.onCatch?.(c);
        } else if (c.y - hh > CONFIG.height) {
          capsules.splice(i, 1);
          ctx.onMiss?.(c);
        }
      }

      const ts = CONFIG.joyful.tokenSize;
      for (let i = letterTokens.length - 1; i >= 0; i--) {
        const t = letterTokens[i];
        t.y += t.vy * dt;
        t.wobble += dt * 3;
        const overlaps =
          t.y + ts / 2 >= pr.y && t.y - ts / 2 <= pr.y + pr.h &&
          t.x + ts / 2 >= pr.x && t.x - ts / 2 <= pr.x + pr.w;
        if (overlaps) {
          letterTokens.splice(i, 1);
          ctx.onLetterCatch?.(t);
        } else if (t.y > CONFIG.height + ts) {
          letterTokens.splice(i, 1);
        }
      }

      for (let i = timed.length - 1; i >= 0; i--) {
        timed[i].remaining -= dt;
        if (timed[i].remaining <= 0) timed.splice(i, 1);
      }

      if (laserCooldown > 0) laserCooldown -= dt;
      for (let i = bolts.length - 1; i >= 0; i--) {
        bolts[i].y -= CONFIG.powerups.laser.boltSpeed * dt;
        if (bolts[i].y < CONFIG.hud.height - 20) bolts.splice(i, 1);
      }

      if (netFade > 0) netFade -= dt;

      if (d20) {
        if (d20.t > 0) {
          d20.t -= dt;
          if (d20.t <= 0) {
            d20.settleT = 0.8;
            ctx.onD20?.(d20.roll);
          }
        } else if (d20.settleT > 0) {
          d20.settleT -= dt;
          if (d20.settleT <= 0) d20 = null;
        }
      }
    },
  };
}
