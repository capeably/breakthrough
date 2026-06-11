// Hit-stop, slow-mo, screen shake, pop-text, and full-screen flash.
// Time manipulation runs through one knob: scaleElapsed() converts real
// elapsed time into gameplay time, so freezes and slow-mo affect everything
// consistently (design doc §13). Accessibility settings gate shake and cap
// flash intensity at call time.

export function createEffects(settings) {
  let hitStopT = 0;
  let slowmoT = 0;
  let slowmoScale = 1;
  let shakeT = 0;
  let shakeMag = 0;
  let shakeDirX = 0;
  let shakeDirY = 0;
  let flashT = 0;
  let flashMax = 0;
  const texts = [];

  return {
    hitStop(seconds) {
      hitStopT = Math.max(hitStopT, seconds);
    },

    slowmo(seconds, scale) {
      slowmoT = Math.max(slowmoT, seconds);
      slowmoScale = scale;
    },

    shake(mag, dirX = 0, dirY = 0) {
      if (!settings.shake) return;
      shakeMag = Math.max(shakeMag, mag);
      shakeT = 0.22;
      const len = Math.hypot(dirX, dirY) || 1;
      shakeDirX = dirX / len;
      shakeDirY = dirY / len;
    },

    flash(seconds) {
      flashT = settings.reducedFlash ? seconds * 0.5 : seconds;
      flashMax = flashT || 1;
    },

    popText(text, x, y, opts = {}) {
      texts.push({
        text, x, y,
        vy: opts.vy ?? -55,
        life: opts.life ?? 0.9,
        maxLife: opts.life ?? 0.9,
        size: opts.size ?? 28,
        color: opts.color ?? '#F4F7FF',
        font: opts.font ?? "'Archivo Black', 'Arial Black', sans-serif",
      });
      if (texts.length > 12) texts.shift();
    },

    // a quieter pop-text variant for the JOYFUL phrases — body type, slow fade
    toast(text, x, y, opts = {}) {
      this.popText(text, x, y, {
        vy: 0,
        life: opts.life ?? 2.2,
        size: opts.size ?? 17,
        color: opts.color ?? '#F4F7FF',
        font: "600 17px Inter, system-ui, sans-serif",
        ...opts,
      });
    },

    // real elapsed in → gameplay elapsed out; decays its own timers in real time
    scaleElapsed(elapsed) {
      if (shakeT > 0) shakeT -= elapsed;
      if (flashT > 0) flashT -= elapsed;
      for (let i = texts.length - 1; i >= 0; i--) {
        const t = texts[i];
        t.life -= elapsed;
        t.y += t.vy * elapsed;
        if (t.life <= 0) texts.splice(i, 1);
      }
      if (hitStopT > 0) {
        hitStopT -= elapsed;
        return 0;
      }
      if (slowmoT > 0) {
        slowmoT -= elapsed;
        return elapsed * slowmoScale;
      }
      return elapsed;
    },

    applyShake(ctx) {
      if (shakeT <= 0) return;
      const falloff = shakeT / 0.22;
      const wobble = Math.sin(shakeT * 95);
      ctx.translate(
        shakeDirX * shakeMag * falloff * wobble,
        shakeDirY * shakeMag * falloff * wobble,
      );
    },

    drawOverlays(ctx, width, height) {
      for (const t of texts) {
        const a = Math.min(1, t.life / (t.maxLife * 0.5));
        const grow = t.vy === 0 ? 1 : 1 + (1 - t.life / t.maxLife) * 0.12;
        ctx.save();
        ctx.translate(t.x, t.y);
        ctx.scale(grow, grow);
        ctx.globalAlpha = a;
        ctx.font = t.font.includes('px') ? t.font : `${t.size}px ${t.font}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(61, 220, 255, 0.6)';
        ctx.shadowBlur = 14; // pop-text is rare — shadowBlur is fine here
        ctx.fillStyle = t.color;
        ctx.fillText(t.text, 0, 0);
        ctx.restore();
      }
      if (flashT > 0) {
        const cap = settings.reducedFlash ? 0.4 : 0.85;
        ctx.fillStyle = `rgba(244, 247, 255, ${(flashT / flashMax) * cap})`;
        ctx.fillRect(0, 0, width, height);
      }
    },
  };
}
