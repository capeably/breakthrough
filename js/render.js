import { CONFIG, COLORS } from './config.js';
import { wordFont } from './words.js';
import { drawHUD } from './hud.js';

const lerp = (a, b, t) => a + (b - a) * t;

// Pre-rendered radial glow sprite — glow without shadowBlur in the hot path.
function makeGlowSprite(size, color) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

function makeScanlines() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 3;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(0, 0, 0, 0.13)';
  g.fillRect(0, 0, 4, 1);
  return c;
}

export function createRenderer(ctx, deps) {
  const { particles, effects, powerups, debug, flow, joyful, settings } = deps;
  const w = CONFIG.width;
  const h = CONFIG.height;

  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, COLORS.bgTop);
  bg.addColorStop(1, COLORS.bgBottom);

  const vignette = ctx.createRadialGradient(w / 2, h / 2, h * 0.45, w / 2, h / 2, h * 0.95);
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.3)');

  const warmBloom = ctx.createRadialGradient(w / 2, h * 0.4, 80, w / 2, h * 0.4, h);
  warmBloom.addColorStop(0, 'rgba(255, 209, 102, 0.14)');
  warmBloom.addColorStop(1, 'rgba(255, 209, 102, 0)');

  const ballGlow = makeGlowSprite(64, 'rgba(190, 235, 255, 0.55)');
  const fireGlow = makeGlowSprite(64, 'rgba(255, 179, 107, 0.6)');
  const positiveGlow = makeGlowSprite(96, 'rgba(124, 255, 203, 0.4)');
  const scanlines = ctx.createPattern(makeScanlines(), 'repeat');

  const tierFill = { 1: COLORS.tier1, 2: COLORS.tier2, 3: COLORS.tier3 };

  function brickOffset(b, now) {
    let ox = 0;
    let oy = 0;
    if (b.positive || b.kind === 'joyful') {
      oy += Math.sin(now / 600 + b.floatPhase) * 2;
    }
    if (b.drift && b.drift.t > 0) {
      const k = b.drift.t / b.drift.dur;
      const ease = k * k;
      ox += b.drift.fromX * ease;
      oy += b.drift.fromY * ease;
    }
    return [ox, oy];
  }

  function drawWord(b, ox, oy) {
    if (!b.word) return;
    const cx = b.rect.x + b.rect.w / 2 + ox;
    const cy = b.rect.y + b.rect.h / 2 + oy + 1;
    ctx.font = wordFont(b.fontSize);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = b.positive || b.kind === 'joyful' ? COLORS.wordInkDark : COLORS.wordInk;
    if (b.wordScaleX < 1) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(b.wordScaleX, 1);
      ctx.fillText(b.word, 0, 0);
      ctx.restore();
    } else {
      ctx.fillText(b.word, cx, cy);
    }
  }

  function drawBrick(b, now) {
    if (b.elite === 'denial' && !b.revealed) return; // it's there. it's just not ready to admit it.

    const r = b.rect;
    const [ox, oy] = brickOffset(b, now);
    let alpha = 1;
    if (b.elite === 'denial' && b.revealT > 0) {
      alpha = 1 - b.revealT / 0.4;
    }

    ctx.save();
    if (alpha < 1) ctx.globalAlpha = alpha;

    // anxiety pulses before it spawns another worry
    if (b.elite === 'anxiety' && b.spawnTimer < CONFIG.elites.anxiety.pulseWindow && b.spawned < CONFIG.elites.anxiety.cap) {
      const k = 1 + 0.05 * Math.sin(now / 55);
      ctx.translate(r.x + r.w / 2 + ox, r.y + r.h / 2 + oy);
      ctx.scale(k, k);
      ctx.translate(-(r.x + r.w / 2 + ox), -(r.y + r.h / 2 + oy));
    }

    if (b.kind === 'joyful') {
      const pulse = 0.7 + 0.3 * Math.sin(now / 350 + b.floatPhase);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = pulse * alpha;
      ctx.drawImage(positiveGlow, r.x + r.w / 2 + ox - 40, r.y + oy + r.h / 2 - 40, 80, 80);
      ctx.globalAlpha = alpha;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = COLORS.positive;
    } else if (b.positive) {
      const pulse = 0.75 + 0.25 * Math.sin(now / 420 + b.floatPhase);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = pulse * alpha;
      ctx.drawImage(positiveGlow, r.x + r.w / 2 + ox - 48, r.y + oy + r.h / 2 - 48, 96, 96);
      ctx.globalAlpha = alpha;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = COLORS.positive;
    } else if (b.kind === 'feedmini') {
      ctx.fillStyle = '#3D4B66';
    } else if (b.kind === 'spawned') {
      ctx.fillStyle = '#5A5577';
    } else {
      ctx.fillStyle = tierFill[b.tier] ?? COLORS.tier1;
    }

    ctx.beginPath();
    ctx.roundRect(r.x + ox, r.y + oy, r.w, r.h, 3);
    ctx.fill();

    const damage = b.maxHp - b.hp;
    if (damage > 0 && !b.positive && b.kind !== 'joyful') {
      ctx.fillStyle = `rgba(0, 0, 0, ${0.16 * damage})`;
      ctx.beginPath();
      ctx.roundRect(r.x + ox, r.y + oy, r.w, r.h, 3);
      ctx.fill();
      drawCracks(b, damage, ox, oy);
    }

    // elite signifier: magenta edge glow (§11)
    if (b.kind === 'elite') {
      ctx.strokeStyle = 'rgba(255, 107, 157, 0.65)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(r.x + ox + 0.75, r.y + oy + 0.75, r.w - 1.5, r.h - 1.5, 3);
      ctx.stroke();
    }

    // per-elite face treatments
    if (b.elite === 'perfectionism') {
      // mirror-polish: a moving specular band
      const band = ((now / 14) % (r.w * 2)) - r.w / 2;
      const grad = ctx.createLinearGradient(r.x + band - 14, r.y, r.x + band + 14, r.y + r.h);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.28)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(r.x + ox, r.y + oy, r.w, r.h, 3);
      ctx.clip();
      ctx.fillStyle = grad;
      ctx.fillRect(r.x + ox, r.y + oy, r.w, r.h);
      ctx.restore();
    } else if (b.elite === 'burnout') {
      const flicker = 0.2 + 0.1 * Math.sin(now / 90 + b.floatPhase * 7);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = flicker * alpha;
      ctx.drawImage(fireGlow, r.x + ox + r.w / 2 - 30, r.y + oy + r.h / 2 - 30, 60, 60);
      ctx.globalAlpha = alpha;
      ctx.globalCompositeOperation = 'source-over';
    } else if (b.elite === 'rabbithole') {
      // the well: rotating spiral arcs around the brick
      const cx = r.x + ox + r.w / 2;
      const cy = r.y + oy + r.h / 2;
      ctx.strokeStyle = 'rgba(180, 140, 255, 0.35)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        const a0 = now / 700 + (i * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.arc(cx, cy, 26 + i * 9, a0, a0 + 1.8);
        ctx.stroke();
      }
    } else if (b.elite === 'distraction') {
      // shimmer field — barely perceptible, but fair (§4.2)
      const cx = r.x + ox + r.w / 2;
      const cy = r.y + oy + r.h / 2;
      ctx.strokeStyle = `rgba(255, 107, 157, ${0.05 + 0.025 * Math.sin(now / 300)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, CONFIG.elites.distraction.radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.10)';
    ctx.fillRect(r.x + ox + 2, r.y + oy + 1.5, r.w - 4, 2);

    drawWord(b, ox, oy);

    if (b.flash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${(b.flash / 0.08) * 0.85})`;
      ctx.beginPath();
      ctx.roundRect(r.x + ox, r.y + oy, r.w, r.h, 3);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawCracks(b, stages, ox, oy) {
    const r = b.rect;
    const seed = ((b.col ?? 0) * 31 + (b.row ?? 0) * 53 + (b.letterIndex ?? 0) * 17) % 4;
    ctx.strokeStyle = 'rgba(8, 10, 20, 0.6)';
    ctx.lineWidth = 1.5;
    for (let s = 0; s < stages; s++) {
      const fx = 0.2 + (((seed + s * 2) % 4) / 4) * 0.55;
      const x = r.x + ox + fx * r.w;
      const wob = s % 2 === 0 ? 6 : -6;
      ctx.beginPath();
      ctx.moveTo(x, r.y + oy);
      ctx.lineTo(x + wob, r.y + oy + r.h * 0.45);
      ctx.lineTo(x - wob * 0.6, r.y + oy + r.h * 0.7);
      ctx.lineTo(x + wob * 0.4, r.y + oy + r.h);
      ctx.stroke();
    }
  }

  // Boss letters: armored segment clusters with the giant glyph clipped to the
  // surviving segments — destroying segments visibly eats the word (§7.3).
  function drawBoss(field, now) {
    let jx = 0;
    let jy = 0;
    if (field.bossType === 'fear' && field.descendTimer < CONFIG.boss.fear.descendWarn
        && field.descents < CONFIG.boss.fear.maxDescents && field.segmentsAlive > 0) {
      jx = (Math.random() - 0.5) * 2.4; // the dread clock rumbles
      jy = (Math.random() - 0.5) * 1.6;
    }

    for (const letter of field.letters) {
      const aliveSegs = letter.segments.filter((s) => s.alive);

      // regen ghosts: LATER's segments grow back — show it coming
      for (const seg of letter.segments) {
        if (!seg.alive && seg.regenTimer > 0) {
          const k = 1 - seg.regenTimer / CONFIG.boss.later.regenDelay;
          ctx.fillStyle = `rgba(139, 58, 74, ${k * 0.3})`;
          ctx.fillRect(seg.rect.x + jx, seg.rect.y + jy, seg.rect.w, seg.rect.h);
        }
      }

      if (aliveSegs.length === 0) continue;

      ctx.save();
      ctx.beginPath();
      for (const seg of aliveSegs) {
        ctx.rect(seg.rect.x + jx, seg.rect.y + jy, seg.rect.w, seg.rect.h);
      }
      ctx.clip();

      const b = letter.bounds;
      ctx.fillStyle = COLORS.tier3;
      ctx.fillRect(b.x + jx, b.y + jy, b.w, b.h);
      if (field.bossType === 'burnout') {
        const flick = 0.12 + 0.08 * Math.sin(now / 110 + letter.bounds.x);
        ctx.fillStyle = `rgba(255, 140, 60, ${flick})`;
        ctx.fillRect(b.x + jx, b.y + jy, b.w, b.h);
      }
      ctx.font = `${b.h * 1.05}px 'Archivo Black', 'Arial Black', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(244, 247, 255, 0.22)';
      ctx.fillText(letter.char, b.x + b.w / 2 + jx, b.y + b.h / 2 + 3 + jy);
      ctx.restore();

      for (const seg of letter.segments) {
        if (!seg.alive) continue;
        const r = seg.rect;
        ctx.strokeStyle = 'rgba(255, 107, 157, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(r.x + jx + 0.5, r.y + jy + 0.5, r.w - 1, r.h - 1);
        const damage = seg.maxHp - seg.hp;
        if (damage > 0) {
          ctx.fillStyle = `rgba(0, 0, 0, ${0.18 * damage})`;
          ctx.fillRect(r.x + jx, r.y + jy, r.w, r.h);
        }
        if (seg.flash > 0) {
          ctx.fillStyle = `rgba(255, 255, 255, ${(seg.flash / 0.08) * 0.85})`;
          ctx.fillRect(r.x + jx, r.y + jy, r.w, r.h);
        }
      }
    }

    // BURNOUT's embers — unmistakably hostile-coded (§7.3)
    for (const e of field.embers) {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.wobble);
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(fireGlow, -14, -14, 28, 28);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#FF5A3C';
      const s = CONFIG.boss.burnout.emberSize;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.7, 0);
      ctx.lineTo(0, s);
      ctx.lineTo(-s * 0.7, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function drawPaddle(p, alpha, isBT) {
    const x = lerp(p.px, p.x, alpha) - p.w / 2;
    const stretch = p.hitT > 0 ? 1 + (p.hitT / CONFIG.juice.paddleHitTime) * 0.22 : 1;
    const ph = p.h * stretch;
    const py = p.y - (ph - p.h);

    const grad = ctx.createLinearGradient(0, py, 0, py + ph);
    grad.addColorStop(0, isBT ? '#9FFFE0' : COLORS.paddle);
    grad.addColorStop(1, isBT ? '#3DDCB0' : COLORS.paddleDark);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, py, p.w, ph, ph / 2);
    ctx.fill();

    ctx.fillStyle = COLORS.paddleEdge;
    ctx.fillRect(x + 8, py + 1.5, p.w - 16, 2);

    // FOCUS: twin laser emitters
    if (powerups.has('laser')) {
      ctx.fillStyle = '#BFF1FF';
      ctx.fillRect(x + 4, py - 7, 6, 8);
      ctx.fillRect(x + p.w - 10, py - 7, 6, 8);
    }

    if (p.flareT > 0) {
      const fa = p.flareT / 0.25;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = fa;
      ctx.drawImage(ballGlow, lerp(p.px, p.x, alpha) + p.flareX - 16, py - 14, 32, 32);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  function drawEchoPaddle(echo) {
    const r = echo.rect();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = COLORS.paddle;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, r.h / 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawBall(ball, alpha, isBT) {
    if (ball.heldBy) {
      // swallowed by a rabbit hole — swirling, about to be spat out
      const brick = ball.heldBy;
      const cx = brick.rect.x + brick.rect.w / 2;
      const cy = brick.rect.y + brick.rect.h / 2;
      const a = performance.now() / 130;
      const rr = 10 + 4 * Math.sin(a * 2);
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = COLORS.ball;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, ball.r * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }

    const fireball = isBT || powerups.has('freedom');
    const glow = fireball ? fireGlow : ballGlow;
    const x = lerp(ball.px, ball.x, alpha);
    const y = lerp(ball.py, ball.y, alpha);

    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < ball.trail.length; i++) {
      const t = ball.trail[i];
      const k = (i + 1) / ball.trail.length;
      ctx.globalAlpha = k * (fireball ? 0.32 : 0.22);
      const s = 10 + k * (fireball ? 22 : 16);
      ctx.drawImage(glow, t.x - s / 2, t.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
    const gs = isBT ? 64 : 48;
    ctx.drawImage(glow, x - gs / 2, y - gs / 2, gs, gs);
    ctx.globalCompositeOperation = 'source-over';

    ctx.fillStyle = fireball && !isBT ? '#FFEDD9' : COLORS.ball;
    ctx.save();
    ctx.translate(x, y);
    if (ball.squashT > 0) {
      const k = (ball.squashT / CONFIG.juice.ballSquashTime) * 0.16;
      ctx.rotate(Math.atan2(ball.squashNy, ball.squashNx));
      ctx.scale(1 - k, 1 + k);
    }
    ctx.beginPath();
    ctx.arc(0, 0, ball.r * (isBT ? 1.18 : 1), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // CLARITY: dotted trajectory preview including the first wall bounce
  function drawTrajectory(ball) {
    if (!ball.served || ball.stuck || ball.heldBy) return;
    let x = ball.x;
    let y = ball.y;
    let vx = ball.vx;
    let vy = ball.vy;
    const mag = Math.hypot(vx, vy) || 1;
    vx /= mag;
    vy /= mag;
    let budget = CONFIG.powerups.clarity.previewLength;
    let bounces = 0;

    ctx.strokeStyle = 'rgba(61, 220, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 9]);
    ctx.beginPath();
    ctx.moveTo(x, y);
    while (budget > 0 && bounces <= 1) {
      const tx = vx > 0 ? (w - ball.r - x) / vx : vx < 0 ? (ball.r - x) / vx : Infinity;
      const ty = vy < 0 ? (CONFIG.hud.height + ball.r - y) / vy : Infinity;
      const step = Math.min(budget, Math.max(0, Math.min(tx, ty)));
      x += vx * step;
      y += vy * step;
      ctx.lineTo(x, y);
      budget -= step;
      if (step === tx && tx <= ty) vx = -vx;
      else if (ty < Infinity) vy = -vy;
      else break;
      bounces++;
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawCapsules(now) {
    for (const c of powerups.capsules) {
      const cw = CONFIG.powerups.capsule.w;
      const ch = CONFIG.powerups.capsule.h;
      const x = c.x - cw / 2 + Math.sin(c.wobble) * 3;
      const y = c.y - ch / 2;

      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5 + 0.2 * Math.sin(now / 200);
      ctx.drawImage(positiveGlow, c.x - 40, c.y - 40, 80, 80);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      ctx.fillStyle = COLORS.positive;
      ctx.beginPath();
      ctx.roundRect(x, y, cw, ch, ch / 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(124, 255, 203, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.font = wordFont(c.fontSize);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = COLORS.wordInkDark;
      ctx.fillText(c.word, c.x + Math.sin(c.wobble) * 3, c.y + 1);
    }
  }

  function drawLetterTokens(now) {
    const ts = CONFIG.joyful.tokenSize;
    for (const t of powerups.letterTokens) {
      const x = t.x + Math.sin(t.wobble) * 4;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.6 + 0.25 * Math.sin(now / 180);
      ctx.drawImage(positiveGlow, x - 34, t.y - 34, 68, 68);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = COLORS.positive;
      ctx.beginPath();
      ctx.roundRect(x - ts / 2, t.y - ts / 2, ts, ts, 6);
      ctx.fill();
      ctx.font = "800 16px 'Archivo Black', 'Arial Black', sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = COLORS.wordInkDark;
      ctx.fillText(t.letter, x, t.y + 1);
    }
  }

  function drawBolts() {
    const { boltW, boltH } = CONFIG.powerups.laser;
    for (const b of powerups.bolts) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(ballGlow, b.x - 10, b.y - 10, 20, 20);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#BFF1FF';
      ctx.fillRect(b.x - boltW / 2, b.y - boltH / 2, boltW, boltH);
    }
  }

  function drawNet(now) {
    if (!powerups.netActive && powerups.netFade <= 0) return;
    const y = CONFIG.powerups.net.y;
    const alpha = powerups.netActive
      ? 0.55 + 0.25 * Math.sin(now / 180)
      : Math.max(0, powerups.netFade / 0.5);
    ctx.strokeStyle = `rgba(124, 255, 203, ${alpha})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(14, y);
    ctx.lineTo(w - 14, y);
    ctx.stroke();
    ctx.strokeStyle = `rgba(124, 255, 203, ${alpha * 0.35})`;
    ctx.lineWidth = 8;
    ctx.stroke();
  }

  function drawD20(now) {
    const d = powerups.d20;
    if (!d) return;
    const rolling = d.t > 0;
    const settleK = rolling ? 0 : 1 - Math.max(0, d.settleT) / 0.8;
    const bounce = rolling ? Math.abs(Math.sin(now / 70)) * 14 : 0;
    const num = rolling ? 1 + ((now / 55) % 20 | 0) : d.roll;
    const size = rolling ? 24 : 30 - settleK * 4;

    ctx.save();
    ctx.translate(d.x, d.y - bounce);
    if (rolling) ctx.rotate(Math.sin(now / 90) * 0.4);
    const nat20 = !rolling && d.roll === 20;
    const nat1 = !rolling && d.roll === 1;
    ctx.fillStyle = nat20 ? COLORS.positive : nat1 ? '#6B4A55' : '#1B3A4A';
    ctx.strokeStyle = nat20 ? '#FFE9B0' : COLORS.paddle;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 3;
      const px = Math.cos(a) * size;
      const py = Math.sin(a) * size;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.font = "800 20px 'Archivo Black', 'Arial Black', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = nat20 ? COLORS.wordInkDark : COLORS.ball;
    ctx.fillText(String(num), 0, 1);
    ctx.restore();
  }

  function drawCountdown(serve, now) {
    if (!serve) return;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (serve.ready) {
      const pulse = 0.5 + 0.4 * Math.sin(now / 360);
      ctx.globalAlpha = pulse;
      ctx.font = "30px 'Archivo Black', 'Arial Black', sans-serif";
      ctx.fillStyle = COLORS.ball;
      ctx.fillText('PRESS SPACE TO LAUNCH', w / 2, CONFIG.paddle.y - 122);
      ctx.globalAlpha = 1;
      ctx.font = '500 14px Inter, system-ui, sans-serif';
      ctx.fillStyle = 'rgba(138, 147, 178, 0.75)';
      ctx.fillText('or click / tap', w / 2, CONFIG.paddle.y - 86);
      return;
    }

    const k = serve.t / CONFIG.serve.tickSeconds;
    const scale = 1 + (1 - k) * 0.3;
    const alpha = 0.35 + k * 0.65;
    ctx.save();
    ctx.translate(w / 2, CONFIG.paddle.y - 120);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;
    ctx.font = "64px 'Archivo Black', 'Arial Black', sans-serif";
    ctx.fillStyle = COLORS.ball;
    ctx.fillText(String(serve.count), 0, 0);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  return {
    draw(run, alpha, inPlay) {
      const now = performance.now();
      const isBT = flow.mode.active;

      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      if (isBT) {
        ctx.fillStyle = warmBloom; // the background warms during Breakthrough
        ctx.fillRect(0, 0, w, h);
      }

      ctx.save();
      effects.applyShake(ctx);

      if (run.field.boss) {
        drawBoss(run.field, now);
        for (const b of run.field.flat) {
          if (b.alive && !b.isBossSegment) drawBrick(b, now);
        }
      } else {
        for (const b of run.field.flat) {
          if (b.alive) drawBrick(b, now);
        }
      }

      drawNet(now);
      drawCapsules(now);
      drawLetterTokens(now);
      drawBolts();

      const clarityOn = powerups.has('clarity');
      for (const ball of run.balls) {
        if (clarityOn) drawTrajectory(ball);
      }

      if (run.echo) drawEchoPaddle(run.echo);
      drawPaddle(run.paddle, alpha, isBT);
      for (const ball of run.balls) drawBall(ball, alpha, isBT);

      particles.draw(ctx);
      drawD20(now);
      if (inPlay) drawCountdown(run.serve, now);

      ctx.restore();

      effects.drawOverlays(ctx, w, h);

      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);

      if (settings.crt) {
        ctx.fillStyle = scanlines;
        ctx.fillRect(0, 0, w, h);
      }

      drawHUD(ctx, run, powerups, debug, flow, joyful);
    },
  };
}
