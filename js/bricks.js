// Brick types, elite behaviors, and the grid (design doc §4).
// Elites are the signature mechanic: each one's behavior is a playable joke
// about the obstacle it names. Intrinsic state (healing, splitting, spawning,
// scrolling) lives here; ball-context reactions (capture, chains, speed
// boosts) are routed by main via brick.elite.

import { CONFIG, COLORS } from './config.js';
import { pickBrickWord, pickPositive, fitWithScale, FEED_WORDS } from './words.js';

const E = CONFIG.elites;

export const ELITE_TOKENS = {
  R: 'procrastination',
  D: 'doubt',
  A: 'anxiety',
  O: 'overthinking',
  X: 'distraction',
  F: 'perfectionism',
  N: 'denial',
  S: 'shame',
  B: 'burnout',
  H: 'rabbithole',
  E: 'feedheader',
};

const ELITE_WORDS = {
  procrastination: 'PROCRASTINATION',
  doubt: 'DOUBT',
  anxiety: 'ANXIETY',
  overthinking: 'OVERTHINKING',
  distraction: 'DISTRACTION',
  perfectionism: 'PERFECTIONISM',
  denial: 'DENIAL',
  shame: 'SHAME',
  burnout: 'BURNOUT',
  rabbithole: 'RABBIT HOLE',
  feedheader: 'THE FEED',
};

let nextId = 1;

function baseBrick(rect, hp) {
  return {
    id: nextId++,
    rect,
    hp,
    maxHp: hp,
    tier: Math.min(3, hp),
    alive: true,
    flash: 0,
    kind: 'normal',
    elite: null,
    word: null,
    fontSize: 11,
    wordScaleX: 1,
    positive: false,
    effect: null,
    col: -1,
    row: -1,
    floatPhase: Math.random() * Math.PI * 2,
    drift: null, // { fromX, fromY, t, dur } spawn-drift animation
  };
}

function fitWord(brick, word) {
  const fit = fitWithScale(word, brick.rect.w - CONFIG.words.padX * 2);
  brick.word = word;
  brick.fontSize = fit.fontSize;
  brick.wordScaleX = fit.scaleX;
}

export function makeStandardBrick(col, row, tier, rect) {
  const b = baseBrick(rect, tier);
  b.col = col;
  b.row = row;
  b.tier = tier;
  const fit = pickBrickWord(tier, rect.w);
  b.word = fit.word;
  b.fontSize = fit.fontSize;
  return b;
}

export function makePositiveBrick(col, row, rect, chapterIndex = 0) {
  const b = baseBrick(rect, 1);
  b.col = col;
  b.row = row;
  b.kind = 'positive';
  b.positive = true;
  const drop = pickPositive(chapterIndex);
  b.effect = drop.effect;
  fitWord(b, drop.word);
  return b;
}

export function makeJoyfulToken(col, row, cellRect) {
  const size = CONFIG.joyful.tokenSize;
  const b = baseBrick({
    x: cellRect.x + cellRect.w / 2 - size,
    y: cellRect.y + cellRect.h / 2 - size / 2 - 1,
    w: size * 2,
    h: size,
  }, 1);
  b.col = col;
  b.row = row;
  b.kind = 'joyful';
  b.word = '✦'; // ✦ — the letter resolves to "next needed" at collect time
  b.fontSize = 13;
  return b;
}

function makeEliteBrick(col, row, elite, rect) {
  const cfg = E[elite] ?? { hp: 2 };
  const b = baseBrick(rect, cfg.hp ?? 2);
  b.col = col;
  b.row = row;
  b.kind = 'elite';
  b.elite = elite;
  b.tier = Math.min(3, b.maxHp);
  fitWord(b, ELITE_WORDS[elite]);

  switch (elite) {
    case 'procrastination':
      b.healTimer = -1;
      break;
    case 'anxiety':
      b.spawnTimer = E.anxiety.interval;
      b.spawned = 0;
      break;
    case 'overthinking':
      b.dynamic = true;
      b.orbit = {
        cx: rect.x, cy: rect.y,
        angle: Math.random() * Math.PI * 2,
      };
      break;
    case 'denial':
      b.revealed = false;
      b.revealT = 0;
      break;
    case 'feedheader':
      b.hp = E.feed.headerHp;
      b.maxHp = E.feed.headerHp;
      b.tier = 3;
      break;
  }
  return b;
}

function makeSpawnedMini(col, row, rect, word) {
  const b = baseBrick(rect, 1);
  b.col = col;
  b.row = row;
  b.kind = 'spawned';
  fitWord(b, word);
  return b;
}

function makeFeedMini(headerBrick, x, w, y) {
  const b = baseBrick({ x, y, w, h: E.feed.miniHeight }, E.feed.miniHp);
  b.kind = 'feedmini';
  b.dynamic = true;
  b.feedHeader = headerBrick;
  fitWord(b, FEED_WORDS[(Math.random() * FEED_WORDS.length) | 0]);
  return b;
}

const EMPTY = [];

export class BrickField {
  constructor(grid, rows, chapterIndex) {
    const { cols, top, height, gap } = CONFIG.bricks;
    this.boss = false;
    this.chapterIndex = chapterIndex;
    this.cols = cols;
    this.rows = rows;
    this.top = top;
    this.cellW = CONFIG.width / cols;
    this.pitch = height + gap;
    this.bottom = top + rows * this.pitch;
    this.grid = grid;
    this.flat = [];
    this.dynamic = []; // moving bricks: orbiters, feed minis
    this.feeds = []; // feed header bricks (for lane bookkeeping)
    for (const row of grid) {
      for (const b of row) {
        if (!b) continue;
        this.flat.push(b);
        if (b.dynamic) this.dynamic.push(b);
        if (b.elite === 'feedheader') this.feeds.push(b);
      }
    }
    this.aliveCount = this.flat.length;
    this.setupFeeds();
    this.revealStrandedHidden(); // guard the degenerate all-hidden start
  }

  // Tokens: `.` empty · 1/2/3 tiers · P positive · @ JOYFUL token ·
  // elite letters per ELITE_TOKENS.
  static fromAscii(map, chapterIndex = 0) {
    const { cols, top, height, gap } = CONFIG.bricks;
    const cellW = CONFIG.width / cols;
    const pitch = height + gap;
    const lines = map.trim().split('\n').map((l) => l.trim()).filter(Boolean);
    const grid = [];
    for (let row = 0; row < lines.length; row++) {
      const tokens = lines[row].split(/\s+/);
      if (tokens.length !== cols) {
        console.warn(`Level row ${row} has ${tokens.length} columns, expected ${cols}`);
      }
      const out = [];
      for (let col = 0; col < cols; col++) {
        const token = tokens[col];
        const rect = {
          x: col * cellW + gap / 2,
          y: top + row * pitch,
          w: cellW - gap,
          h: height,
        };
        if (token === 'P') {
          out.push(makePositiveBrick(col, row, rect, chapterIndex));
        } else if (token === '@') {
          out.push(makeJoyfulToken(col, row, rect));
        } else if (ELITE_TOKENS[token]) {
          out.push(makeEliteBrick(col, row, ELITE_TOKENS[token], rect));
        } else {
          const tier = parseInt(token, 10);
          out.push(tier >= 1 && tier <= 3 ? makeStandardBrick(col, row, tier, rect) : null);
        }
      }
      grid.push(out);
    }
    return new BrickField(grid, lines.length, chapterIndex);
  }

  setupFeeds() {
    for (const header of this.feeds) {
      const laneTop = header.rect.y + header.rect.h + CONFIG.bricks.gap;
      const laneBottom = Math.max(this.bottom, laneTop + 160);
      const laneLen = laneBottom - laneTop;
      const w = this.cellW * 0.72;
      const x = header.col * this.cellW + (this.cellW - w) / 2;
      header.feed = { laneTop, laneBottom, laneLen, stopped: false, minis: [] };
      for (let i = 0; i < E.feed.minis; i++) {
        const mini = makeFeedMini(header, x, w, laneTop + (laneLen / E.feed.minis) * i);
        header.feed.minis.push(mini);
        this.flat.push(mini);
        this.dynamic.push(mini);
        this.aliveCount++;
      }
    }
  }

  get cleared() {
    return this.aliveCount === 0;
  }

  // If the only bricks left alive are unrevealed DENIAL, surface them. The
  // board must never look clear while secretly holding invisible bricks — that
  // soft-locks the level (it appears finished, but aliveCount never reaches 0
  // and the player can't see what's left to hit).
  revealStrandedHidden() {
    const hidden = [];
    for (const b of this.flat) {
      if (!b.alive) continue;
      if (b.elite === 'denial' && !b.revealed) hidden.push(b);
      else return; // a visible brick remains — nothing is stranded
    }
    for (const b of hidden) {
      b.revealed = true;
      b.revealT = 0.4;
      b.flash = 0.12;
    }
  }

  // Grid lookup over the swept motion's AABB, plus all dynamic bricks.
  candidates(px, py, dx, dy, r) {
    const minX = Math.min(px, px + dx) - r;
    const maxX = Math.max(px, px + dx) + r;
    const minY = Math.min(py, py + dy) - r;
    const maxY = Math.max(py, py + dy) + r;

    const out = [];
    if (maxY >= this.top && minY <= this.bottom) {
      const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
      const c0 = clamp(Math.floor(minX / this.cellW), 0, this.cols - 1);
      const c1 = clamp(Math.floor(maxX / this.cellW), 0, this.cols - 1);
      const r0 = clamp(Math.floor((minY - this.top) / this.pitch), 0, this.rows - 1);
      const r1 = clamp(Math.floor((maxY - this.top) / this.pitch), 0, this.rows - 1);
      for (let row = r0; row <= r1; row++) {
        for (let col = c0; col <= c1; col++) {
          const b = this.grid[row][col];
          if (b && b.alive && !b.dynamic) out.push(b);
        }
      }
    }
    for (const b of this.dynamic) {
      if (b.alive) out.push(b);
    }
    return out.length ? out : EMPTY;
  }

  emptyNeighborCells(brick) {
    const cells = [];
    for (const [dc, dr] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const col = brick.col + dc;
      const row = brick.row + dr;
      if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) continue;
      const occupant = this.grid[row][col];
      if (!occupant || !occupant.alive) cells.push({ col, row });
    }
    return cells;
  }

  cellRect(col, row) {
    const { gap, height } = CONFIG.bricks;
    return {
      x: col * this.cellW + gap / 2,
      y: this.top + row * this.pitch,
      w: this.cellW - gap,
      h: height,
    };
  }

  spawnMini(col, row, word, from) {
    const rect = this.cellRect(col, row);
    const b = makeSpawnedMini(col, row, rect, word);
    if (from) {
      b.drift = {
        fromX: from.x - rect.x,
        fromY: from.y - rect.y,
        t: 0.25,
        dur: 0.25,
      };
    }
    this.grid[row][col] = b;
    this.flat.push(b);
    this.aliveCount++;
    return b;
  }

  neighborsOf(brick) {
    const out = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const col = brick.col + dc;
        const row = brick.row + dr;
        if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) continue;
        const b = this.grid[row][col];
        if (b && b.alive) out.push(b);
      }
    }
    return out;
  }

  // bricks that bend ball trajectories (distraction fields, rabbit holes)
  forceSources() {
    const out = [];
    for (const b of this.flat) {
      if (b.alive && (b.elite === 'distraction' || b.elite === 'rabbithole')) out.push(b);
    }
    return out;
  }

  damage(brick) {
    if (brick.elite === 'denial' && !brick.revealed) {
      brick.revealed = true;
      brick.revealT = 0.4; // fade-in, cracked — it was there all along
    }

    brick.hp--;
    brick.flash = 0.08;

    if (brick.hp > 0) {
      // procrastination heals if you don't finish it (§4.2)
      if (brick.elite === 'procrastination') brick.healTimer = E.procrastination.healAfter;
      return false;
    }

    brick.alive = false;
    this.aliveCount--;

    if (brick.elite === 'doubt') {
      // splits into "what if?" minis that drift to adjacent cells
      const cells = this.emptyNeighborCells(brick);
      for (let i = 0; i < Math.min(E.doubt.splitCount, cells.length); i++) {
        const idx = (Math.random() * cells.length) | 0;
        const cell = cells.splice(idx, 1)[0];
        this.spawnMini(cell.col, cell.row, 'WHAT IF?', {
          x: brick.rect.x, y: brick.rect.y,
        });
      }
    }

    if (brick.elite === 'feedheader' && brick.feed) {
      // kill the source and the content stops
      brick.feed.stopped = true;
      for (const mini of brick.feed.minis) {
        if (mini.alive) {
          mini.alive = false;
          mini.flash = 0.1;
          this.aliveCount--;
        }
      }
    }

    this.revealStrandedHidden();
    return true;
  }

  update(dt, fx) {
    for (const b of this.flat) {
      if (b.drift && b.drift.t > 0) b.drift.t -= dt;

      if (!b.alive) continue;

      switch (b.elite) {
        case 'procrastination':
          if (b.hp < b.maxHp && b.healTimer > 0) {
            b.healTimer -= dt;
            if (b.healTimer <= 0) {
              b.hp = b.maxHp; // smug little shimmer
              b.flash = 0.14;
              fx?.onProcrastinationHeal?.(b);
            }
          }
          break;

        case 'anxiety':
          if (b.spawned < E.anxiety.cap) {
            b.spawnTimer -= dt;
            if (b.spawnTimer <= 0) {
              const cells = this.emptyNeighborCells(b);
              if (cells.length) {
                const cell = cells[(Math.random() * cells.length) | 0];
                this.spawnMini(cell.col, cell.row, 'WORRY', {
                  x: b.rect.x, y: b.rect.y,
                });
                b.spawned++;
                fx?.onAnxietySpawn?.(b);
              }
              b.spawnTimer = E.anxiety.interval;
            }
          }
          break;

        case 'overthinking': {
          b.orbit.angle += E.overthinking.orbitSpeed * dt;
          const r = E.overthinking.orbitRadius;
          b.rect.x = b.orbit.cx + Math.cos(b.orbit.angle) * r;
          b.rect.y = b.orbit.cy + Math.sin(b.orbit.angle) * r;
          break;
        }

        case 'burnout':
          if (Math.random() < dt * 2.2) fx?.onSmolder?.(b);
          break;

        case 'denial':
          if (b.revealed && b.revealT > 0) b.revealT -= dt;
          break;
      }
    }

    // THE FEED scrolls forever — until you kill the source
    for (const header of this.feeds) {
      if (!header.feed || header.feed.stopped) continue;
      const { laneTop, laneLen } = header.feed;
      for (const mini of header.feed.minis) {
        mini.rect.y += E.feed.scrollSpeed * dt;
        if (mini.rect.y > header.feed.laneBottom) {
          mini.rect.y = laneTop - mini.rect.h;
          fitWord(mini, FEED_WORDS[(Math.random() * FEED_WORDS.length) | 0]);
          if (!mini.alive) { // fresh content replaces what you cleared
            mini.alive = true;
            mini.hp = E.feed.miniHp;
            this.aliveCount++;
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Boss walls — a giant word in armored letter clusters (§7.3). Each boss has a
// chapter-themed behavior: LATER regenerates, DOUBT spawns "what if?" minis,
// FEAR descends on a 25s clock, BURNOUT drops paddle-shrinking embers.

function makeBossSegment(letterIndex, rect) {
  const b = baseBrick(rect, CONFIG.boss.segmentHp);
  b.kind = 'bossSegment';
  b.isBossSegment = true;
  b.letterIndex = letterIndex;
  b.tier = 3;
  b.regenTimer = -1;
  b.word = null;
  return b;
}

export class BossField {
  constructor(word, type, chapterIndex = 0) {
    const { segW, segH, gap, letterGap, top } = CONFIG.boss;
    this.boss = true;
    this.bossType = type;
    this.chapterIndex = chapterIndex;
    this.word = word;
    this.letters = [];
    this.flat = [];
    this.embers = []; // BURNOUT hazard drops
    this.descents = 0;
    this.descendTimer = CONFIG.boss.fear.descendEvery;
    this.emberTimer = CONFIG.boss.burnout.emberEvery;

    const letterW = segW * 2 + gap;
    const totalW = word.length * letterW + (word.length - 1) * letterGap;
    const x0 = (CONFIG.width - totalW) / 2;

    for (let i = 0; i < word.length; i++) {
      const lx = x0 + i * (letterW + letterGap);
      const segments = [];
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 2; col++) {
          const seg = makeBossSegment(i, {
            x: lx + col * (segW + gap),
            y: top + row * (segH + gap),
            w: segW,
            h: segH,
          });
          segments.push(seg);
          this.flat.push(seg);
        }
      }
      this.letters.push({
        char: word[i],
        segments,
        dead: false,
        bounds: { x: lx, y: top, w: letterW, h: segH * 3 + gap * 2 },
      });
    }
    this.segmentsAlive = this.flat.length; // the boss is beaten when this hits 0

    // help bricks below the word — without them a single ball can't keep pace
    const bw = CONFIG.width / CONFIG.bricks.cols - CONFIG.bricks.gap;
    const bh = CONFIG.bricks.height;
    const n = CONFIG.boss.positives;
    const band = 480;
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const cx = CONFIG.width / 2 + (t - 0.5) * band;
      const rect = { x: cx - bw / 2, y: CONFIG.boss.positiveY - bh / 2, w: bw, h: bh };
      this.flat.push(makePositiveBrick(0, 0, rect, chapterIndex));
    }
    this.aliveCount = this.flat.length;
  }

  // Cleared when every letter segment is gone — leftover positives/minis
  // never block the win.
  get cleared() {
    return this.segmentsAlive === 0;
  }

  candidates() {
    return this.flat.filter((s) => s.alive);
  }

  forceSources() {
    return EMPTY;
  }

  spawnWhatIf() {
    const bw = 70;
    const x = 200 + Math.random() * (CONFIG.width - 400);
    const b = makeSpawnedMini(-1, -1, {
      x: x - bw / 2,
      y: CONFIG.boss.doubt.miniY + (Math.random() * 40 - 20),
      w: bw,
      h: 24,
    }, 'WHAT IF?');
    this.flat.push(b);
    this.aliveCount++;
    return b;
  }

  damage(brick) {
    brick.hp--;
    brick.flash = 0.08;
    if (brick.hp > 0) return false;
    brick.alive = false;
    this.aliveCount--;
    if (brick.isBossSegment) {
      this.segmentsAlive--;
      const letter = this.letters[brick.letterIndex];
      if (letter.segments.every((s) => !s.alive)) {
        letter.dead = true; // letter finished — nothing regrows
        for (const s of letter.segments) s.regenTimer = -1;
      } else if (this.bossType === 'later') {
        brick.regenTimer = CONFIG.boss.later.regenDelay;
      } else if (this.bossType === 'doubt' && Math.random() < CONFIG.boss.doubt.miniChance) {
        this.spawnWhatIf();
      }
    }
    return true;
  }

  descend() {
    const dy = CONFIG.boss.segH + CONFIG.boss.gap;
    for (const letter of this.letters) {
      letter.bounds.y += dy;
      for (const seg of letter.segments) seg.rect.y += dy;
    }
    this.descents++;
  }

  update(dt, fx) {
    // LATER: destroyed segments regrow unless the whole letter is dead
    if (this.bossType === 'later') {
      for (const seg of this.flat) {
        if (seg.isBossSegment && !seg.alive && seg.regenTimer > 0) {
          seg.regenTimer -= dt;
          if (seg.regenTimer <= 0 && !this.letters[seg.letterIndex].dead) {
            seg.alive = true;
            seg.hp = CONFIG.boss.later.regenHp;
            seg.regenTimer = -1;
            seg.flash = 0.1;
            this.aliveCount++;
            this.segmentsAlive++;
          }
        }
      }
    }

    // FEAR: the whole word descends — a slow, readable dread clock
    if (this.bossType === 'fear' && this.segmentsAlive > 0
        && this.descents < CONFIG.boss.fear.maxDescents) {
      this.descendTimer -= dt;
      if (this.descendTimer <= CONFIG.boss.fear.descendWarn && !this.warnFired) {
        this.warnFired = true;
        fx?.onFearWarn?.();
      }
      if (this.descendTimer <= 0) {
        this.descend();
        this.descendTimer = CONFIG.boss.fear.descendEvery;
        this.warnFired = false;
        fx?.onFearDescend?.();
      }
    }

    // BURNOUT: smoldering letters shed embers — dodge them or shrink
    if (this.bossType === 'burnout' && this.segmentsAlive > 0) {
      this.emberTimer -= dt;
      if (this.emberTimer <= 0) {
        const aliveLetters = this.letters.filter((l) => !l.dead);
        if (aliveLetters.length) {
          const letter = aliveLetters[(Math.random() * aliveLetters.length) | 0];
          this.embers.push({
            x: letter.bounds.x + Math.random() * letter.bounds.w,
            y: letter.bounds.y + letter.bounds.h,
            vy: CONFIG.boss.burnout.emberSpeed,
            wobble: Math.random() * Math.PI * 2,
          });
          fx?.onEmber?.();
        }
        this.emberTimer = CONFIG.boss.burnout.emberEvery;
      }
      for (let i = this.embers.length - 1; i >= 0; i--) {
        const e = this.embers[i];
        e.y += e.vy * dt;
        e.wobble += dt * 5;
        e.x += Math.sin(e.wobble) * 18 * dt;
        if (e.y > CONFIG.height + 20) this.embers.splice(i, 1);
      }
    }
  }
}
