// The slim top bar (design doc §12): score · Flow meter with JOYFUL slots ·
// level name · Setback pips. Active power-ups as radial-timer badges below.

import { CONFIG, COLORS } from './config.js';

const EFFECT_LABELS = {
  wide: 'P', magnet: 'S', clarity: 'C', laser: 'F', freedom: 'FR',
  joy: 'J', connection: 'CN',
};

export function drawHUD(ctx, run, powerups, debug, flow, joyful) {
  const w = CONFIG.width;
  const h = CONFIG.hud.height;

  ctx.fillStyle = 'rgba(5, 8, 18, 0.55)';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(61, 220, 255, 0.18)';
  ctx.fillRect(0, h - 1, w, 1);

  ctx.textBaseline = 'middle';

  // score
  ctx.font = '600 13px Inter, system-ui, sans-serif';
  ctx.fillStyle = COLORS.hudDim;
  ctx.textAlign = 'left';
  ctx.fillText('SCORE', 20, h / 2 - 11);
  ctx.font = '700 22px Inter, system-ui, sans-serif';
  ctx.fillStyle = COLORS.hudText;
  ctx.fillText(String(Math.round(run.displayScore)), 20, h / 2 + 9);

  // level name, small, above the flow bar
  ctx.font = '500 12px Inter, system-ui, sans-serif';
  ctx.fillStyle = COLORS.hudDim;
  ctx.textAlign = 'center';
  ctx.fillText(
    `${run.chapterIndex + 1}-${run.levelIndex + 1} · ${run.levelName}`,
    w / 2, h / 2 - 13,
  );

  // flow meter — the thin radiant bar (design doc §6)
  if (flow) {
    const barX = 330;
    const barW = 560;
    const barY = h / 2 + 6;
    const barH = 7;
    ctx.fillStyle = 'rgba(138, 147, 178, 0.18)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, barH / 2);
    ctx.fill();
    const frac = flow.mode.active
      ? flow.mode.t / CONFIG.flow.breakthrough.duration
      : flow.value / CONFIG.flow.max;
    if (frac > 0) {
      ctx.fillStyle = flow.mode.active ? COLORS.positiveGlow : COLORS.paddle;
      ctx.beginPath();
      ctx.roundRect(barX, barY, Math.max(barH, barW * frac), barH, barH / 2);
      ctx.fill();
    }
    if (flow.mode.active) {
      ctx.font = "11px 'Archivo Black', 'Arial Black', sans-serif";
      ctx.fillStyle = COLORS.positiveGlow;
      ctx.fillText('BREAKTHROUGH', w / 2, barY - 24);
    }

    // JOYFUL slots at the bar's right end, gilding as collected
    if (joyful) {
      const slots = joyful.slots();
      let sx = barX + barW + 18;
      ctx.font = '700 13px Inter, system-ui, sans-serif';
      for (const slot of slots) {
        ctx.fillStyle = slot.lit ? COLORS.positive : 'rgba(138, 147, 178, 0.28)';
        ctx.fillText(slot.ch, sx, barY + 3);
        sx += 14;
      }
    }
  }

  // Setbacks remaining, as ball pips — or ∞ when the dev toggle is on
  if (debug && debug.infiniteLives) {
    ctx.font = '700 26px Inter, system-ui, sans-serif';
    ctx.fillStyle = COLORS.positiveGlow;
    ctx.textAlign = 'right';
    ctx.fillText('∞', w - 20, h / 2 + 1);
  } else {
    const pipR = 6;
    const spacing = 22;
    const startX = w - 20 - pipR;
    const slots = Math.max(CONFIG.rules.lives, run.lives);
    for (let i = 0; i < slots; i++) {
      const x = startX - i * spacing;
      ctx.beginPath();
      ctx.arc(x, h / 2, pipR, 0, Math.PI * 2);
      if (i < run.lives) {
        ctx.fillStyle = COLORS.ball;
        ctx.fill();
      } else {
        ctx.strokeStyle = 'rgba(138, 147, 178, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }

  drawActiveEffects(ctx, powerups);
}

// Active power-ups: small badges with radial timers, top-right under the bar.
function drawActiveEffects(ctx, powerups) {
  if (!powerups) return;
  const size = 26;
  const gap = 8;
  let x = CONFIG.width - 20 - size / 2;
  const y = CONFIG.hud.height + 22;
  const now = performance.now();

  const entries = [...powerups.timed];
  if (powerups.netActive) entries.push({ effect: 'net', remaining: Infinity, duration: Infinity });

  for (const entry of entries) {
    const warning = entry.remaining < CONFIG.powerups.warnTime;
    const blinkOff = warning && Math.sin(now / 90) < 0;

    if (!blinkOff) {
      ctx.fillStyle = 'rgba(5, 8, 18, 0.6)';
      ctx.beginPath();
      ctx.roundRect(x - size / 2, y - size / 2, size, size, 6);
      ctx.fill();

      if (entry.effect === 'net') {
        ctx.strokeStyle = COLORS.positiveGlow;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(x - 8, y + 5);
        ctx.lineTo(x + 8, y + 5);
        ctx.stroke();
        ctx.font = '700 11px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = COLORS.hudText;
        ctx.fillText('G', x, y - 3);
      } else {
        ctx.font = '700 12px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = COLORS.hudText;
        ctx.fillText(EFFECT_LABELS[entry.effect] ?? '?', x, y);

        const frac = entry.remaining / entry.duration;
        ctx.strokeStyle = COLORS.paddle;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, size / 2 - 1, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
        ctx.stroke();
      }
    }
    x -= size + gap;
  }
}
