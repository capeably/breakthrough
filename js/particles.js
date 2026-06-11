// Pooled particles (design doc §9): brick-face shards plus the signature
// word-shatter — destroyed words break into their letters, which tumble with
// physics. Negative words fall; positive words drift up. Letters draw from a
// pre-rasterized glyph atlas, never per-frame fillText.

import { CONFIG } from './config.js';
import { wordFont } from './words.js';

const ATLAS_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ.!\'';
const ATLAS_CELL = 22;
const ATLAS_FONT_PX = 16;

let atlas = null;

function getAtlas() {
  if (atlas) return atlas;
  const c = document.createElement('canvas');
  c.width = ATLAS_CELL * ATLAS_CHARS.length;
  c.height = ATLAS_CELL;
  const g = c.getContext('2d');
  g.font = wordFont(ATLAS_FONT_PX);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#F4F7FF';
  for (let i = 0; i < ATLAS_CHARS.length; i++) {
    g.fillText(ATLAS_CHARS[i], i * ATLAS_CELL + ATLAS_CELL / 2, ATLAS_CELL / 2 + 1);
  }
  atlas = c;
  return atlas;
}

export function createParticles() {
  const pool = [];
  for (let i = 0; i < CONFIG.particles.poolSize; i++) {
    pool.push({ active: false });
  }
  let cursor = 0;

  function take() {
    // reuse the oldest slot if the pool is saturated — never allocate
    for (let i = 0; i < pool.length; i++) {
      cursor = (cursor + 1) % pool.length;
      if (!pool[cursor].active) return pool[cursor];
    }
    cursor = (cursor + 1) % pool.length;
    return pool[cursor];
  }

  function spawn(props) {
    const p = take();
    p.active = true;
    p.kind = props.kind;
    p.x = props.x;
    p.y = props.y;
    p.vx = props.vx;
    p.vy = props.vy;
    p.rot = props.rot ?? 0;
    p.vrot = props.vrot ?? 0;
    p.life = props.life;
    p.maxLife = props.life;
    p.size = props.size ?? 6;
    p.color = props.color ?? '#F4F7FF';
    p.char = props.char ?? null;
    p.gravity = props.gravity ?? CONFIG.particles.gravity;
  }

  return {
    // brick-face fragments, biased along the impact direction
    shatterShards(rect, color, dirX, dirY) {
      const n = CONFIG.particles.shardsPerBrick;
      for (let i = 0; i < n; i++) {
        spawn({
          kind: 'shard',
          x: rect.x + Math.random() * rect.w,
          y: rect.y + Math.random() * rect.h,
          vx: dirX * 60 + (Math.random() - 0.5) * 240,
          vy: dirY * 60 - Math.random() * 140,
          rot: Math.random() * Math.PI,
          vrot: (Math.random() - 0.5) * 10,
          life: 0.55 + Math.random() * 0.3,
          size: 3 + Math.random() * 5,
          color,
        });
      }
    },

    // the word breaks into its letters
    shatterWord(word, rect, fontSize, positive) {
      if (!word) return;
      const step = rect.w / (word.length + 1);
      for (let i = 0; i < word.length; i++) {
        const ch = word[i];
        if (ch === ' ') continue;
        spawn({
          kind: 'letter',
          char: ch,
          x: rect.x + step * (i + 1),
          y: rect.y + rect.h / 2,
          vx: (Math.random() - 0.5) * (positive ? 50 : 160),
          vy: positive ? -30 - Math.random() * 50 : -60 - Math.random() * 120,
          rot: 0,
          vrot: positive ? (Math.random() - 0.5) * 2 : (Math.random() - 0.5) * 8,
          life: positive ? 1.1 : 0.9,
          size: fontSize,
          gravity: positive
            ? CONFIG.particles.letterGravityUp
            : CONFIG.particles.letterGravityDown,
        });
      }
    },

    burst(x, y, color, count = 14, speed = 320) {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = speed * (0.4 + Math.random() * 0.6);
        spawn({
          kind: 'shard',
          x, y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s - 80,
          rot: Math.random() * Math.PI,
          vrot: (Math.random() - 0.5) * 12,
          life: 0.6 + Math.random() * 0.4,
          size: 3 + Math.random() * 4,
          color,
        });
      }
    },

    update(dt) {
      for (const p of pool) {
        if (!p.active) continue;
        p.life -= dt;
        if (p.life <= 0) {
          p.active = false;
          continue;
        }
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vrot * dt;
      }
    },

    draw(ctx) {
      const img = getAtlas();
      for (const p of pool) {
        if (!p.active) continue;
        const a = Math.max(0, p.life / p.maxLife);
        ctx.globalAlpha = a;
        if (p.kind === 'letter') {
          const idx = ATLAS_CHARS.indexOf(p.char);
          if (idx < 0) continue;
          const scale = p.size / ATLAS_FONT_PX;
          const half = (ATLAS_CELL * scale) / 2;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.drawImage(
            img, idx * ATLAS_CELL, 0, ATLAS_CELL, ATLAS_CELL,
            -half, -half, ATLAS_CELL * scale, ATLAS_CELL * scale,
          );
          ctx.restore();
        } else {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
          ctx.restore();
        }
      }
      ctx.globalAlpha = 1;
    },
  };
}
