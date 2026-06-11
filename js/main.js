import { CONFIG, COLORS } from './config.js';
import { createInput } from './input.js';
import { stepBall, setSpeed, paddleOffset, circleOverlapsRect } from './physics.js';
import { Ball } from './ball.js';
import { Paddle, EchoPaddle } from './paddle.js';
import { BrickField, BossField } from './bricks.js';
import { CHAPTERS } from './levels.js';
import { createParticles } from './particles.js';
import { createEffects } from './effects.js';
import { createPowerups } from './powerups.js';
import { createFlow } from './flow.js';
import { createJoyful } from './joyful.js';
import { createRenderer } from './render.js';
import { Screens } from './screens.js';
import { pickPositive, d20Effect, wordForEffect, JOYFUL_LETTERS } from './words.js';
import { loadProfile, saveProfile } from './save.js';
import * as audio from './audio.js';

const State = {
  TITLE: 'title',
  PLAYING: 'playing',
  PAUSED: 'paused',
  CLEAR: 'clear',
  GAMEOVER: 'gameover',
};

const DT = 1 / CONFIG.physicsHz;
const MAX_BALLS = 6;

const frame = document.getElementById('frame');
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function setupCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = CONFIG.width * dpr;
  canvas.height = CONFIG.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function fit() {
  const scale = Math.min(window.innerWidth / CONFIG.width, window.innerHeight / CONFIG.height);
  frame.style.width = `${Math.floor(CONFIG.width * scale)}px`;
  frame.style.height = `${Math.floor(CONFIG.height * scale)}px`;
  input.refreshRect();
}

const profile = loadProfile();
const settings = profile.settings;

const input = createInput(frame, canvas, () => run?.paddle.x ?? CONFIG.width / 2);
const particles = createParticles();
const effects = createEffects(settings);
const powerups = createPowerups();
const flow = createFlow();
const joyful = createJoyful();
const debug = { infiniteLives: false }; // dev toggles (L lives · N skip level)
const renderer = createRenderer(ctx, { particles, effects, powerups, debug, flow, joyful, settings });

// Walls live just outside the playfield so the swept-collision code treats them
// like any other rect. Top wall plane sits at the bottom of the HUD bar.
const WALL = 64;
const walls = [
  { x: -WALL, y: -WALL, w: WALL, h: CONFIG.height + WALL * 2, side: 'left' },
  { x: CONFIG.width, y: -WALL, w: WALL, h: CONFIG.height + WALL * 2, side: 'right' },
  { x: -WALL, y: CONFIG.hud.height - WALL, w: CONFIG.width + WALL * 2, h: WALL, side: 'top' },
];

let state = State.TITLE;
let run = null;
let fireworks = null; // { count, t } — NEW BEST ceremony bursts

function newRun(chapterIndex = 0) {
  run = {
    chapterIndex,
    levelIndex: 0,
    score: 0,
    chapterStartScore: 0,
    displayScore: 0,
    lives: CONFIG.rules.lives,
    levelName: '',
    time: 0,
    balls: [],
    paddle: new Paddle(),
    echo: null,
    field: null,
    serve: null, // { ready, count, t } — the LIFTOFF launch ritual
    levelDeaths: 0,
    pityArmed: false,
    pendingMulti: false,
    chainQueue: [], // BURNOUT's staggered neighbor-ignition
    joyfulSeq: null, // { value, t } — the 5-4-3-2-1 → GO! jackpot
    d20TickT: 0,
    clearTimer: -1,
    clearMode: 'level',
    clearJinglePlayed: false,
    gameOverTimer: -1,
    bossFinishFired: false,
  };
  flow.reset();
  joyful.reset();
  loadLevel(0);
}

function loadLevel(index) {
  const chapter = CHAPTERS[run.chapterIndex];
  const spec = chapter.levels[index];
  run.levelIndex = index;
  run.levelName = spec.name;
  run.field = spec.boss
    ? new BossField(spec.boss, spec.bossType, run.chapterIndex)
    : BrickField.fromAscii(spec.map, run.chapterIndex);
  run.time = 0;
  run.levelDeaths = 0;
  run.pityArmed = false;
  run.pendingMulti = false;
  run.chainQueue.length = 0;
  run.clearTimer = -1;
  run.clearJinglePlayed = false;
  run.gameOverTimer = -1;
  run.bossFinishFired = false;
  run.echo = null;
  powerups.reset();
  flow.chain = 0;
  beginServe();
}

// The player must cross the activation threshold: a serve waits on a "ready"
// prompt until they press to begin. Then the 3-2-1 countdown runs and the ball
// fires itself at zero — once committed, no renegotiating, no skipping.
function beginServe() {
  const ball = new Ball();
  run.balls = [ball];
  ball.resetOnPaddle(run.paddle);
  run.serve = { ready: true, count: CONFIG.serve.count, t: 0 };
}

function doLaunch() {
  const ball = run.balls[0];
  ball.launch();
  run.serve = null;
  audio.liftoff();
  effects.popText('LIFTOFF!', ball.x, CONFIG.paddle.y - 96, { size: 30, color: COLORS.ball });
  if (run.pendingMulti) {
    run.pendingMulti = false;
    doMultiball();
  }
}

function rotate(vx, vy, rad) {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [vx * c - vy * s, vx * s + vy * c];
}

function doMultiball() {
  const source = run.balls.find((b) => b.served && !b.stuck && !b.dead && !b.heldBy);
  if (!source) {
    run.pendingMulti = true;
    return;
  }
  const a = CONFIG.powerups.multiball.splitAngleDeg * Math.PI / 180;
  for (const sign of [-1, 1]) {
    if (run.balls.length >= MAX_BALLS) break;
    const clone = source.clone();
    [clone.vx, clone.vy] = rotate(source.vx, source.vy, a * sign);
    run.balls.push(clone);
  }
}

const world = {
  cfg: CONFIG,
  walls,
  get field() { return run.field; },
  get paddle() { return run.paddle; },
  get magnetActive() { return powerups.has('magnet'); },
  isFireball: () => flow.mode.active || powerups.has('freedom'),
  echoPaddle: () => run.echo,
};

function ballDir(ball) {
  const mag = Math.hypot(ball.vx, ball.vy) || 1;
  return [ball.vx / mag, ball.vy / mag];
}

function scorePoints(pts) {
  const mult = (powerups.has('joy') ? CONFIG.powerups.joy.scoreMult : 1)
    * (flow.mode.active ? CONFIG.flow.breakthrough.scoreMult : 1);
  run.score += Math.round(pts * mult);
}

const TIER_COLOR = { 1: COLORS.tier1, 2: COLORS.tier2, 3: COLORS.tier3 };

// The one damage routine — balls, lasers, fireballs, and chain-ignitions all
// come through here so every brick reacts consistently.
function hitBrick(brick, dirX, dirY, opts = {}) {
  if (!brick.alive) return;
  const field = run.field;

  if (brick.kind === 'joyful') {
    field.damage(brick);
    const cx = brick.rect.x + brick.rect.w / 2;
    const cy = brick.rect.y + brick.rect.h / 2;
    powerups.spawnLetterToken(cx, cy, joyful.nextLetter() ?? 'J');
    particles.burst(cx, cy, COLORS.positive, 10, 200);
    audio.positiveBreak();
    flow.addBreak('positive');
    return;
  }

  if (brick.positive) {
    field.damage(brick);
    scorePoints(CONFIG.rules.pointsPositive);
    flow.addBreak('positive');
    audio.positiveBreak();
    particles.shatterWord(brick.word, brick.rect, brick.fontSize + 2, true);
    particles.burst(
      brick.rect.x + brick.rect.w / 2,
      brick.rect.y + brick.rect.h / 2,
      COLORS.positiveGlow, 10, 200,
    );
    let { effect, word } = brick;
    if (run.pityArmed) { // after a rough level, the next drop is a strong one
      const pity = pickPositive(run.chapterIndex, CONFIG.powerups.pityEffects);
      effect = pity.effect;
      word = pity.word;
      run.pityArmed = false;
    }
    powerups.spawnCapsule(
      brick.rect.x + brick.rect.w / 2,
      brick.rect.y + brick.rect.h / 2,
      effect, word,
    );
    return;
  }

  if (brick.isBossSegment) {
    const destroyed = field.damage(brick);
    if (destroyed) {
      scorePoints(CONFIG.rules.pointsBossSegment);
      const chain = flow.addBreak('boss');
      audio.bossSegmentBreak();
      particles.shatterShards(brick.rect, COLORS.tier3, dirX, dirY);
      effects.hitStop(CONFIG.juice.hitStopBossSegment);
      effects.shake(CONFIG.juice.shakeBossSegment, dirX, dirY);
      if (joyful.rollEliteDrop()) {
        powerups.spawnLetterToken(
          brick.rect.x + brick.rect.w / 2, brick.rect.y, joyful.nextLetter() ?? 'J',
        );
      }
      maybeChainText(chain, brick);
    } else {
      audio.brickChip();
    }
    return;
  }

  const isElite = brick.kind === 'elite';
  const destroyed = field.damage(brick);

  if (!destroyed) {
    audio.brickChip();
    return;
  }

  scorePoints(isElite ? CONFIG.rules.pointsElite : CONFIG.rules.pointsByTier[brick.tier] ?? 50);
  const chain = flow.addBreak(isElite ? 'elite' : 'tier', brick.tier);
  audio.brickBreak(brick.tier);
  particles.shatterShards(brick.rect, TIER_COLOR[brick.tier] ?? COLORS.tier1, dirX, dirY);
  particles.shatterWord(brick.word, brick.rect, brick.fontSize + 2, false);
  if (brick.tier === 3 || isElite) {
    effects.hitStop(CONFIG.juice.hitStopAnchor);
    if (brick.tier === 3) effects.shake(CONFIG.juice.shakeAnchor, dirX, dirY);
  }
  maybeChainText(chain, brick);

  if (brick.elite === 'burnout') {
    // chain-ignition: destroying burnout helps you (§4.2)
    audio.burnoutChain();
    effects.shake(3, dirX, dirY);
    const neighbors = field.neighborsOf ? field.neighborsOf(brick) : [];
    neighbors.forEach((n, i) => {
      run.chainQueue.push({ brick: n, t: CONFIG.elites.burnout.chainStagger * (i + 1), dirX, dirY });
    });
  }

  if (brick.elite === 'rabbithole') {
    audio.rabbitSpit();
    for (const b of run.balls) {
      if (b.heldBy === brick) releaseHeldBall(b);
    }
    particles.burst(
      brick.rect.x + brick.rect.w / 2,
      brick.rect.y + brick.rect.h / 2,
      '#B48CFF', 16, 300,
    );
  }

  if (isElite && joyful.rollEliteDrop()) {
    powerups.spawnLetterToken(
      brick.rect.x + brick.rect.w / 2, brick.rect.y, joyful.nextLetter() ?? 'J',
    );
  }
}

function maybeChainText(chain, brick) {
  if (chain >= 3) {
    effects.popText(`×${chain}`, brick.rect.x + brick.rect.w / 2, brick.rect.y - 6, {
      size: 16, life: 0.6, color: COLORS.paddle,
    });
  }
}

function releaseHeldBall(ball) {
  ball.heldBy = null;
  let dx = 0;
  let dy = -1;
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2;
    dx = Math.cos(a);
    dy = Math.sin(a);
    if (dy < 0.82) break; // not straight down at the paddle
  }
  ball.vx = dx * ball.speed;
  ball.vy = dy * ball.speed;
}

const events = {
  onBrickHit(brick, ball, nx, ny) {
    ball.squash(nx, ny);
    const [dx, dy] = ballDir(ball);

    if (brick.elite === 'perfectionism') {
      // mirror-polish: reflects you back harder than you arrived
      ball.speedBoost = CONFIG.elites.perfectionism.speedBoost;
      audio.perfectionismPing();
    }

    hitBrick(brick, dx, dy, { ball });

    if (brick.alive && brick.elite === 'rabbithole' && !world.isFireball(ball)) {
      ball.heldBy = brick;
      ball.holdT = CONFIG.elites.rabbithole.holdTime;
      ball.vx = 0;
      ball.vy = 0;
      audio.rabbitSwallow();
    }
  },

  onFireballHit(brick, ball) {
    const [dx, dy] = ballDir(ball);
    hitBrick(brick, dx, dy, { ball, pierce: true });
  },

  onPaddleHit(ball, off, isEcho) {
    flow.onPaddleTouch();
    if (!isEcho) run.paddle.onBallHit(off);
    ball.squash(0, -1);
    audio.paddleHit(off);
  },

  onWallHit(side, ball, nx, ny) {
    ball.squash(nx, ny);
    audio.wallTap();
  },

  onMagnetCatch(ball) {
    ball.stuck = true;
    ball.stuckOffset = ball.x - run.paddle.x;
    ball.stuckT = 0;
    flow.onPaddleTouch();
    audio.paddleHit(0);
  },

  onBallLost(ball) {
    if (powerups.consumeNet()) {
      ball.y = CONFIG.powerups.net.y - ball.r - 1;
      ball.vy = -Math.abs(ball.vy);
      ball.squash(0, -1);
      audio.netSave();
      effects.popText('SAVED!', ball.x, CONFIG.powerups.net.y - 34, {
        size: 20, color: COLORS.positiveGlow,
      });
      return;
    }
    ball.dead = true;
  },
};

const fieldFx = {
  onProcrastinationHeal: () => audio.procrastinationHeal(),
  onAnxietySpawn: () => audio.anxietySpawn(),
  onSmolder: (b) => particles.burst(
    b.rect.x + Math.random() * b.rect.w, b.rect.y + 4, COLORS.fire, 1, 60,
  ),
  onFearWarn: () => {
    audio.fearRumble();
    effects.shake(2, 0, 1);
  },
  onFearDescend: () => {
    audio.fearRumble();
    effects.shake(5, 0, 1);
  },
  onEmber: () => audio.emberHiss(),
};

function triggerBreakthrough() {
  flow.trigger();
  audio.breakthroughTrigger();
  audio.setMusicBreakthrough(true);
  effects.hitStop(CONFIG.flow.breakthrough.hitStop);
  effects.flash(0.3);
  effects.shake(5, 0, 1);
  effects.popText('BREAKTHROUGH!', CONFIG.width / 2, 300, {
    size: 52, life: 1.4, color: COLORS.positiveGlow,
  });
}

// applies a power-up effect from any source (capsule, d20, debug)
function applyEffect(effect, x, y) {
  switch (effect) {
    case 'multiball':
      doMultiball();
      break;
    case 'hope':
      run.lives = Math.min(CONFIG.joyful.livesCap, run.lives + 1);
      audio.secondWind();
      effects.flash(0.25);
      effects.popText('+1 SETBACK', x, y - 40, { size: 22, color: COLORS.positive });
      break;
    case 'wonder':
      powerups.startD20(x, y);
      break;
    case 'dud':
      scorePoints(100);
      particles.burst(x, y, COLORS.hudDim, 8, 140);
      effects.toast('well, that happened', x, y - 40, { color: COLORS.hudDim, life: 1.2 });
      break;
    case 'breakthrough':
      effects.popText('NAT 20!', x, y - 44, { size: 26, color: COLORS.positive, life: 1.2 });
      triggerBreakthrough();
      break;
    default:
      powerups.apply(effect);
  }
}

function onCapsuleCatch(c) {
  audio.capsuleCatch();
  effects.popText(c.word, c.x, c.y - 20, { size: 18, color: COLORS.positive, life: 0.7 });
  applyEffect(c.effect, c.x, c.y);
}

function onLetterCatch(t) {
  const res = joyful.collect();
  if (!res) return;
  const idx = JOYFUL_LETTERS.indexOf(res.letter);
  scorePoints(CONFIG.joyful.tokenPoints);
  audio.joyfulLetter(idx);
  effects.toast(`${res.letter} — ${res.phrase}`, CONFIG.width / 2, 92, {
    color: COLORS.positive,
  });
  if (res.completed) {
    // L's line IS the launch announcement — the game enacts it (§6)
    effects.hitStop(0.18);
    run.joyfulSeq = { value: 5, t: 0.24 };
  }
}

function onD20Resolve(roll) {
  const effect = d20Effect(roll);
  audio.d20Settle(roll >= 10);
  const d = powerups.d20;
  const x = d?.x ?? run.paddle.x;
  const y = d?.y ?? 400;
  if (effect !== 'dud' && effect !== 'breakthrough') {
    effects.popText(wordForEffect(effect), x, y - 44, {
      size: 20, color: COLORS.positive, life: 1,
    });
  }
  applyEffect(effect, x, y);
}

function fixedUpdate(dt) {
  const paddle = run.paddle;

  for (const ball of run.balls) {
    ball.px = ball.x;
    ball.py = ball.y;
  }
  paddle.px = paddle.x;
  paddle.widthMods.wide = powerups.has('wide') ? CONFIG.powerups.wide.widthMult : 1;
  paddle.widthMods.breakthrough = flow.mode.active ? CONFIG.flow.breakthrough.paddleMult : 1;
  paddle.widthMods.assist = settings.assist ? 1.25 : 1;
  paddle.update(dt, input.state);

  run.echo = powerups.has('connection')
    ? (run.echo ?? new EchoPaddle(paddle))
    : null;

  const slowMult = powerups.has('clarity') ? CONFIG.powerups.clarity.slowMult : 1;
  const speedBase = Math.min(
    CONFIG.ball.baseSpeed + CONFIG.ball.speedRampPerSec * run.time,
    CONFIG.ball.maxSpeed,
  ) * slowMult;

  if (run.gameOverTimer >= 0) {
    run.gameOverTimer -= dt;
    if (run.gameOverTimer < 0) {
      state = State.GAMEOVER;
      const newBest = run.score > (profile.best.total ?? 0);
      if (newBest) {
        profile.best.total = run.score;
        saveProfile(profile);
        audio.newBest();
      }
      screens.showGameOver(run.score, newBest);
    }
  } else if (run.serve) {
    const ball = run.balls[0];
    ball.speed = speedBase;
    ball.followPaddle(paddle); // ball tracks the paddle the whole time

    if (run.serve.ready) {
      // waiting on the player to commit — nothing fires on its own
      if (input.state.launch) {
        input.state.launch = false;
        run.serve.ready = false;
        run.serve.t = CONFIG.serve.tickSeconds;
        audio.countdownTick(run.serve.count); // first beat: "3"
      }
    } else {
      // counting down — presses can't skip or cancel it; it fires at zero
      input.state.launch = false;
      run.serve.t -= dt;
      if (run.serve.t <= 0) {
        run.serve.count--;
        if (run.serve.count >= 1) {
          run.serve.t = CONFIG.serve.tickSeconds;
          audio.countdownTick(run.serve.count);
        } else {
          doLaunch();
        }
      }
    }
  } else {
    if (input.state.launch) {
      input.state.launch = false;
      if (run.balls.some((b) => b.stuck)) releaseStuckBalls();
      if (powerups.tryFireLaser(paddle)) audio.laserShoot();
    }

    run.time += dt;

    const sources = run.field.forceSources();
    for (const ball of run.balls) {
      if (ball.stuck) {
        ball.stuckT += dt;
        ball.followPaddle(paddle, ball.stuckOffset);
        if (ball.stuckT >= CONFIG.powerups.magnet.autoReleaseAfter) {
          const off = paddleOffset(ball, paddle);
          ball.launchAtAngle(off * (CONFIG.paddle.maxBounceAngleDeg * Math.PI / 180));
        }
        continue;
      }
      if (ball.heldBy) {
        // rabbit hole: swallowed, then spat out somewhere else
        if (!ball.heldBy.alive) {
          releaseHeldBall(ball);
        } else {
          ball.x = ball.heldBy.rect.x + ball.heldBy.rect.w / 2;
          ball.y = ball.heldBy.rect.y + ball.heldBy.rect.h / 2;
          ball.holdT -= dt;
          if (ball.holdT <= 0) {
            releaseHeldBall(ball);
            audio.rabbitSpit();
          }
        }
        continue;
      }

      // gravity wells and shimmer fields bend the path, never the speed
      if (sources.length) {
        for (const src of sources) {
          const cfgE = CONFIG.elites[src.elite];
          const cx = src.rect.x + src.rect.w / 2;
          const cy = src.rect.y + src.rect.h / 2;
          const ddx = cx - ball.x;
          const ddy = cy - ball.y;
          const dist = Math.hypot(ddx, ddy);
          if (dist > 1 && dist < cfgE.radius) {
            const pull = cfgE.pull * (1 - dist / cfgE.radius);
            ball.vx += (ddx / dist) * pull * dt;
            ball.vy += (ddy / dist) * pull * dt;
          }
        }
      }

      if (ball.speedBoost > 1) {
        ball.speedBoost = Math.max(1, ball.speedBoost - CONFIG.elites.perfectionism.boostDecayPerSec * dt);
      }
      ball.speed = Math.min(speedBase * ball.speedBoost, CONFIG.ball.maxSpeed * 1.2);
      setSpeed(ball, ball.speed);
      stepBall(ball, dt, world, events);
      ball.recordTrail();
      if (ball.squashT > 0) ball.squashT -= dt;
    }

    const before = run.balls.length;
    run.balls = run.balls.filter((b) => !b.dead);
    if (before > 0 && run.balls.length === 0) {
      run.levelDeaths++;
      if (run.levelDeaths >= 2) run.pityArmed = true;
      flow.onSetback();
      audio.setback();
      effects.shake(2, 0, 1);
      if (debug.infiniteLives) {
        beginServe(); // dev: never run out
      } else {
        run.lives--;
        if (run.lives <= 0) {
          run.lives = 0;
          run.gameOverTimer = CONFIG.rules.gameOverDelay;
        } else {
          beginServe();
        }
      }
    }
  }

  // World timers — Flow, elite & boss timers, power-up decay, falling capsules,
  // in-flight hazards — only advance while a ball is actually in play. During
  // the serve ready/countdown the world is frozen, so the downtime after a
  // Setback (or at level start) costs the player nothing.
  const worldActive = !run.serve;

  // BURNOUT's staggered chain-ignition
  if (worldActive) {
    for (let i = run.chainQueue.length - 1; i >= 0; i--) {
      const link = run.chainQueue[i];
      link.t -= dt;
      if (link.t <= 0) {
        run.chainQueue.splice(i, 1);
        if (link.brick.alive) hitBrick(link.brick, link.dirX, link.dirY, { chain: true });
      }
    }
  }

  // the JOYFUL jackpot countdown: 5-4-3-2-1 → GO!
  if (run.joyfulSeq) {
    const seq = run.joyfulSeq;
    seq.t -= dt;
    if (seq.t <= 0) {
      if (seq.value >= 1) {
        effects.popText(String(seq.value), CONFIG.width / 2, 250, {
          size: 48, life: 0.45, color: COLORS.positive,
        });
        audio.countdownTick(seq.value);
        seq.value--;
        seq.t = 0.24;
      } else {
        run.joyfulSeq = null;
        effects.popText('GO!', CONFIG.width / 2, 250, {
          size: 64, life: 1.2, color: COLORS.positive,
        });
        audio.joyfulGo();
        run.lives = Math.min(CONFIG.joyful.livesCap, run.lives + 1);
        run.score += CONFIG.joyful.completionPoints; // the jackpot is flat — no multipliers
        triggerBreakthrough();
      }
    }
  }

  // WONDER's d20 clatters while it rolls
  if (powerups.d20 && powerups.d20.t > 0) {
    run.d20TickT -= dt;
    if (run.d20TickT <= 0) {
      audio.d20Tick();
      run.d20TickT = 0.09;
    }
  }

  if (worldActive) powerups.update(dt, {
    paddleRect: paddle.rect(),
    onCatch: onCapsuleCatch,
    onLetterCatch,
    onD20: onD20Resolve,
  });

  // laser bolts vs bricks
  if (worldActive && powerups.bolts.length) {
    for (let i = powerups.bolts.length - 1; i >= 0; i--) {
      const bolt = powerups.bolts[i];
      const cands = run.field.candidates(bolt.x, bolt.y, 0, -20, 6);
      let hit = null;
      for (const b of cands) {
        if (circleOverlapsRect(bolt.x, bolt.y, 5, b.rect)) { hit = b; break; }
      }
      if (hit) {
        powerups.bolts.splice(i, 1);
        hitBrick(hit, 0, -1, { laser: true });
      }
    }
  }

  const wasBT = flow.mode.active;
  if (worldActive && flow.update(dt)) triggerBreakthrough();
  if (wasBT && !flow.mode.active) audio.setMusicBreakthrough(false);
  audio.setMusicIntensity(1 + (flow.value > 30 ? 1 : 0) + (flow.value > 65 ? 1 : 0));

  if (worldActive) run.field.update(dt, fieldFx);

  // BURNOUT boss embers vs paddle — unmistakably hostile (§7.3)
  if (worldActive && run.field.boss && run.field.embers.length) {
    const pr = paddle.rect();
    for (let i = run.field.embers.length - 1; i >= 0; i--) {
      const e = run.field.embers[i];
      if (circleOverlapsRect(e.x, e.y, 10, pr)) {
        run.field.embers.splice(i, 1);
        paddle.applyEmberDebuff();
        audio.emberHit();
        effects.shake(3, 0, 1);
        particles.burst(e.x, e.y, '#FF5A3C', 12, 220);
      }
    }
  }

  // Boss Breakthrough Finish: slow-mo shatter, then the tally (§7.3)
  if (run.field.boss && run.field.cleared && !run.bossFinishFired) {
    run.bossFinishFired = true;
    audio.bossFinish();
    effects.slowmo(CONFIG.juice.bossFinish.slowmoTime, CONFIG.juice.bossFinish.slowmo);
    effects.flash(CONFIG.juice.bossFinish.flashTime);
    effects.shake(CONFIG.juice.bossFinish.shake, 0, 1);
    effects.popText('BREAKTHROUGH!', CONFIG.width / 2, 320, { size: 56, life: 1.6 });
    for (const letter of run.field.letters) {
      particles.burst(
        letter.bounds.x + letter.bounds.w / 2,
        letter.bounds.y + letter.bounds.h / 2,
        COLORS.tier3, 18, 420,
      );
    }
    run.clearTimer = CONFIG.rules.bossClearDelay;
  }

  if (!run.field.boss && run.field.cleared
      && run.clearTimer < 0 && run.gameOverTimer < 0) {
    run.clearTimer = CONFIG.rules.levelClearDelay;
  }
  if (run.clearTimer >= 0) {
    if (!run.clearJinglePlayed && !run.field.boss) {
      run.clearJinglePlayed = true;
      audio.levelClear();
    }
    run.clearTimer -= dt;
    if (run.clearTimer < 0) showClearScreen();
  }

  run.displayScore += (run.score - run.displayScore) * Math.min(1, dt * 10);
  if (Math.abs(run.score - run.displayScore) < 1) run.displayScore = run.score;

  for (const b of run.field.flat) {
    if (b.flash > 0) b.flash -= dt;
  }
}

function showClearScreen() {
  const chapter = CHAPTERS[run.chapterIndex];
  const isBoss = run.levelIndex >= chapter.levels.length - 1;
  state = State.CLEAR;

  if (!isBoss) {
    run.clearMode = 'level';
    screens.showClear({ score: run.score, mode: 'level' });
    return;
  }

  // chapter complete: record best, unlock the next, ceremony if earned
  const chapterScore = run.score - run.chapterStartScore;
  const newBest = chapterScore > (profile.best[run.chapterIndex] ?? 0);
  if (newBest) profile.best[run.chapterIndex] = chapterScore;
  if (run.chapterIndex + 2 > profile.unlocked && run.chapterIndex + 1 < CHAPTERS.length) {
    profile.unlocked = run.chapterIndex + 2;
  }
  saveProfile(profile);
  screens.updateTitle(profile, CHAPTERS);
  screens.buildChapterCards(CHAPTERS, profile, onPickChapter);

  if (newBest) {
    audio.newBest();
    fireworks = { count: 6, t: 0.1 };
  }

  const isFinal = run.chapterIndex >= CHAPTERS.length - 1;
  run.clearMode = isFinal ? 'final' : 'chapter';
  screens.showClear({
    score: run.score,
    mode: run.clearMode,
    chapterName: `Chapter ${run.chapterIndex + 1} — ${chapter.name}`,
    nextChapterName: isFinal ? '' : CHAPTERS[run.chapterIndex + 1].name,
    newBest,
  });
}

function releaseStuckBalls() {
  for (const ball of run.balls) {
    if (!ball.stuck) continue;
    const off = paddleOffset(ball, run.paddle);
    ball.launchAtAngle(off * (CONFIG.paddle.maxBounceAngleDeg * Math.PI / 180));
    audio.paddleHit(off);
  }
}

function startRun(chapterIndex = 0) {
  newRun(chapterIndex);
  state = State.PLAYING;
  screens.hideAll();
  input.clearEdges();
}

function resume() {
  state = State.PLAYING;
  screens.hideAll();
  input.clearEdges();
}

function pause() {
  state = State.PAUSED;
  screens.show('pause');
}

function nextLevel() {
  loadLevel(run.levelIndex + 1);
  state = State.PLAYING;
  screens.hideAll();
  input.clearEdges();
}

function advanceChapter() {
  run.chapterIndex++;
  run.chapterStartScore = run.score;
  loadLevel(0);
  state = State.PLAYING;
  screens.hideAll();
  input.clearEdges();
}

function toTitle() {
  newRun(0); // fresh wall as the title backdrop
  state = State.TITLE;
  screens.updateTitle(profile, CHAPTERS);
  screens.show('title');
}

function onPickChapter(i) {
  startRun(i);
}

const screens = new Screens({
  onStart: startRun,
  onContinueRun: () => startRun(Math.min(profile.unlocked, CHAPTERS.length) - 1),
  onResume: resume,
  onRestart: () => startRun(run?.chapterIndex ?? 0),
  onQuit: toTitle,
  onContinue: () => {
    if (run.clearMode === 'level') nextLevel();
    else if (run.clearMode === 'chapter') advanceChapter();
    else startRun(0);
  },
});

screens.buildChapterCards(CHAPTERS, profile, onPickChapter);
screens.bindSettings(settings, (key) => {
  saveProfile(profile);
  if (key === 'volume') audio.setVolume(settings.volume);
  if (key === 'music') audio.setMusicEnabled(settings.music);
});

function handleFrameInput() {
  if (input.consumePause()) {
    if (state === State.PLAYING) pause();
    else if (state === State.PAUSED) resume();
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === State.PLAYING) pause();
});

window.addEventListener('keydown', (e) => {
  if (state === State.TITLE && (e.code === 'Space' || e.code === 'Enter')) {
    const visible = !document.getElementById('screen-title').classList.contains('hidden');
    if (visible) startRun(0);
  }
  if (e.code === 'KeyM') audio.toggleMute();
  if (e.code === 'KeyL') {
    debug.infiniteLives = !debug.infiniteLives;
    effects.popText(
      debug.infiniteLives ? '∞ LIVES: ON' : 'LIVES: NORMAL',
      CONFIG.width / 2, 150,
      { size: 22, life: 1.1, color: debug.infiniteLives ? COLORS.positiveGlow : COLORS.hudDim },
    );
  }
  if (e.code === 'KeyN' && (state === State.PLAYING || state === State.PAUSED)) {
    // dev: skip ahead — next level, then next chapter, wrapping at the end
    const chapter = CHAPTERS[run.chapterIndex];
    if (run.levelIndex < chapter.levels.length - 1) {
      loadLevel(run.levelIndex + 1);
    } else if (run.chapterIndex < CHAPTERS.length - 1) {
      run.chapterIndex++;
      run.chapterStartScore = run.score;
      loadLevel(0);
    } else {
      run.chapterIndex = 0;
      loadLevel(0);
    }
    state = State.PLAYING;
    screens.hideAll();
    effects.popText(
      `→ ${run.chapterIndex + 1}-${run.levelIndex + 1} ${run.levelName}`,
      CONFIG.width / 2, 150,
      { size: 20, life: 1.1, color: COLORS.hudDim },
    );
  }
});

// Web Audio unlocks on the first user gesture (and re-resumes if suspended)
window.addEventListener('pointerdown', audio.unlock);
window.addEventListener('keydown', audio.unlock);
audio.setMusicEnabled(settings.music);
audio.setVolume(settings.volume);

let last = performance.now();
let acc = 0;

function tick(elapsed) {
  const gameElapsed = effects.scaleElapsed(elapsed); // hit-stop & slow-mo
  acc = Math.min(acc + gameElapsed, CONFIG.maxAccumulatedTime);

  handleFrameInput();

  while (acc >= DT) {
    if (state === State.PLAYING) fixedUpdate(DT);
    acc -= DT;
  }

  // visual systems keep breathing on menus and during ceremonies
  particles.update(gameElapsed);
  if (fireworks) {
    fireworks.t -= elapsed;
    if (fireworks.t <= 0) {
      particles.burst(
        160 + Math.random() * (CONFIG.width - 320),
        120 + Math.random() * 240,
        Math.random() < 0.5 ? COLORS.positive : COLORS.positiveGlow,
        18, 380,
      );
      fireworks.count--;
      fireworks.t = 0.22;
      if (fireworks.count <= 0) fireworks = null;
    }
  }

  renderer.draw(run, acc / DT, state === State.PLAYING);
  input.endFrame();
}

function loop(now) {
  requestAnimationFrame(loop);
  tick((now - last) / 1000);
  last = now;
}

setupCanvas();
fit();
window.addEventListener('resize', fit);
newRun(0);
screens.updateTitle(profile, CHAPTERS);
screens.show('title');
requestAnimationFrame(loop);

// Debug handle for automated testing — not part of the game API.
window.__bt = {
  CONFIG,
  get run() { return run; },
  get state() { return state; },
  powerups,
  flow,
  joyful,
  input,
  debug,
  profile,
  step(n) {
    for (let i = 0; i < n; i++) fixedUpdate(DT);
  },
  tick(elapsed = 1 / 60) {
    tick(elapsed);
  },
  start: startRun,
  goto(chapterIndex, levelIndex = 0) {
    run.chapterIndex = chapterIndex;
    loadLevel(levelIndex);
    state = State.PLAYING;
    screens.hideAll();
  },
  hitBrick,
  applyEffect,
};
