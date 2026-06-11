// All tuning constants live here (design doc §13: game-feel iteration must be a
// one-file edit). Units: pixels, seconds, degrees where noted.

export const CONFIG = {
  width: 1280,
  height: 720,
  physicsHz: 120,
  maxAccumulatedTime: 0.25, // clamp after tab-restore so physics never spirals

  hud: {
    height: 56, // also the top wall plane — the ball bounces at this y
  },

  ball: {
    radius: 9,
    baseSpeed: 470,
    speedRampPerSec: 5, // anti-stall creep within a level; resets each level
    maxSpeed: 840,
    launchSpreadDeg: 10, // serve fires up within ±this of vertical
    minVerticalRatio: 0.18, // anti-horizontal-loop floor for |vy|/speed
    wallBouncesBeforeNudge: 3, // side-wall hits with no brick/paddle contact
    trailLength: 12, // samples kept for the motion trail
  },

  paddle: {
    width: 132,
    height: 18,
    y: 668, // top edge
    maxBounceAngleDeg: 60, // exit angle at the paddle's outer edge
    keySpeed: 1350,
    keyAccel: 9000,
    widthEase: 10, // 1/s — how fast width changes animate (never snap)
  },

  bricks: {
    cols: 13,
    top: 96,
    height: 32,
    gap: 5,
  },

  words: {
    maxFontPx: 13,
    minFontPx: 9, // below this a shorter word is picked instead (legibility floor)
    padX: 7, // horizontal padding inside the brick face
  },

  serve: {
    count: 3, // 3-2-1 on every serve; player presses to begin, fires at zero
    tickSeconds: 0.5, // per number; once started, auto-fires — no renegotiating
  },

  powerups: {
    maxTimedEffects: 2, // catching a third replaces the oldest
    warnTime: 2, // HUD blink window before an effect expires
    capsule: { w: 96, h: 26, fallSpeed: 150 },
    wide: { duration: 12, widthMult: 1.5 },
    magnet: { duration: 12, autoReleaseAfter: 3 },
    clarity: { duration: 8, slowMult: 0.8, previewLength: 460 },
    multiball: { clones: 2, splitAngleDeg: 22 },
    net: { y: 706 }, // one-save glowing line near the bottom
    laser: { duration: 8, shotInterval: 0.5, boltSpeed: 980, boltW: 4, boltH: 16 },
    freedom: { duration: 6 }, // fireball: pierce everything, 1 dmg per touch
    joy: { duration: 10, scoreMult: 2 },
    connection: { duration: 12, offsetY: 90, widthFrac: 0.6 }, // body-double echo paddle
    wonder: { rollTime: 1.1 }, // d20 suspense before the effect resolves
    pityEffects: ['multiball', 'net'], // guaranteed after 2 Setbacks in a level
  },

  flow: {
    max: 100,
    gainByTier: { 1: 3, 2: 5, 3: 8 },
    gainElite: 8,
    gainBossSegment: 8,
    gainPositive: 5,
    chainBonus: 1, // extra flow per chain step (bricks between paddle touches)
    chainCap: 8,
    decayPerSec: 3,
    decayIdleDelay: 2.5, // seconds without a break before decay starts
    setbackDrain: 0.5, // fraction of flow lost on a Setback
    breakthrough: {
      duration: 8,
      scoreMult: 2,
      paddleMult: 1.25,
      resetTo: 25, // momentum carries — flow doesn't restart from zero
      hitStop: 0.25,
    },
  },

  joyful: {
    tokenPoints: 250,
    completionPoints: 5000,
    eliteDropChance: 0.2, // divided by (cycle+1) on repeat collections
    tokenFallSpeed: 110,
    tokenSize: 26,
    livesCap: 5, // Second Wind / JOYFUL can stack Setbacks up to this
  },

  elites: {
    procrastination: { hp: 2, healAfter: 6 }, // heals to full if left cracked
    doubt: { hp: 1, splitCount: 2 }, // first hit splits into "WHAT IF?" minis
    anxiety: { hp: 2, interval: 10, cap: 3, pulseWindow: 1.5 },
    overthinking: { hp: 2, orbitRadius: 9, orbitSpeed: 0.9 }, // rad/s
    distraction: { hp: 2, radius: 140, pull: 130 }, // gentle path-bend field
    perfectionism: { hp: 3, speedBoost: 1.15, boostDecayPerSec: 0.1 },
    denial: { hp: 2 }, // invisible until struck
    shame: { hp: 3 }, // placement-only elite: always authored behind cover
    burnout: { hp: 3, chainDamage: 1, chainStagger: 0.06 }, // ignites neighbors
    rabbithole: { hp: 2, radius: 190, pull: 700, holdTime: 0.8 },
    feed: { headerHp: 3, miniHp: 1, minis: 4, scrollSpeed: 42, miniHeight: 22 },
  },

  juice: {
    ballSquashTime: 0.09,
    paddleHitTime: 0.12,
    hitStopAnchor: 0.016, // s frozen on a 3-HP (Anchor) kill
    hitStopBossSegment: 0.05,
    shakeAnchor: 3, // px, directional, decays fast
    shakeBossSegment: 4,
    bossFinish: { slowmo: 0.25, slowmoTime: 1.5, flashTime: 0.5, shake: 8 },
  },

  particles: {
    poolSize: 400,
    shardsPerBrick: 8,
    gravity: 950,
    letterGravityDown: 700, // negative-word letters tumble down
    letterGravityUp: -55, // positive-word letters drift up and fade
  },

  audio: {
    masterGain: 0.5,
    musicGain: 0.22,
    bpm: 90,
  },

  boss: {
    segW: 46,
    segH: 30,
    gap: 4,
    letterGap: 26,
    top: 150,
    segmentHp: 3,
    positives: 2, // help bricks seeded below the word (player aid)
    positiveY: 380,
    later: { regenDelay: 14, regenHp: 1 },
    doubt: { miniChance: 0.35, miniY: 330 }, // dead segments respawn as "WHAT IF?"
    fear: { descendEvery: 25, descendWarn: 3, maxDescents: 4 },
    burnout: {
      emberEvery: 6,
      emberSpeed: 130,
      emberSize: 11,
      debuffWidthMult: 0.8,
      debuffTime: 5,
    },
  },

  rules: {
    lives: 3,
    pointsByTier: { 1: 50, 2: 100, 3: 200 },
    pointsElite: 300,
    pointsPositive: 150,
    pointsBossSegment: 250,
    levelClearDelay: 0.55,
    bossClearDelay: 2.0, // covers the slow-mo Breakthrough Finish
    gameOverDelay: 0.8,
  },
};

export const SETTINGS_DEFAULTS = {
  volume: 0.5,
  music: true,
  shake: true,
  reducedFlash: false,
  crt: false,
  assist: false, // +25% paddle width, marked on the tally, no score penalty
};

export const COLORS = {
  bgTop: '#0B0E1A',
  bgBottom: '#11152A',
  ball: '#F4F7FF',
  paddle: '#3DDCFF',
  paddleDark: '#1B9BC4',
  paddleEdge: '#BFF1FF',
  tier1: '#4A5568',
  tier2: '#6B5B95',
  tier3: '#8B3A4A',
  positive: '#FFD166',
  positiveGlow: '#7CFFCB',
  eliteEdge: '#FF6B9D',
  fire: '#FFB36B',
  hudText: '#F4F7FF',
  hudDim: '#8A93B2',
  wordInk: 'rgba(244, 247, 255, 0.82)',
  wordInkDark: 'rgba(11, 14, 26, 0.8)',
};
