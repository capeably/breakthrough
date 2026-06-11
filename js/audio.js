// All-synthesized audio via Web Audio (design doc §10) — zero asset files.
// SFX palette plus a minimal generative music loop: a pentatonic bass arp with
// pad and plink layers that build with Flow; Breakthrough Mode lifts the whole
// thing an octave and opens the filter. Unlocks on the first user gesture.

import { CONFIG } from './config.js';

let ac = null;
let master = null;
let musicBus = null;
let musicFilter = null;
let muted = false;
let volume = CONFIG.audio.masterGain;

let musicEnabled = false;
let musicTimer = null;
let musicStep = 0;
let nextNoteTime = 0;
let musicIntensity = 1; // 1 bass · 2 +pad · 3 +plinks
let musicBT = false; // breakthrough mode lift

export function unlock() {
  if (!ac) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    ac = new Ctx();
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 6;
    master = ac.createGain();
    master.gain.value = muted ? 0 : volume;
    master.connect(comp);
    comp.connect(ac.destination);

    musicFilter = ac.createBiquadFilter();
    musicFilter.type = 'lowpass';
    musicFilter.frequency.value = 900;
    musicBus = ac.createGain();
    musicBus.gain.value = CONFIG.audio.musicGain;
    musicBus.connect(musicFilter);
    musicFilter.connect(master);
  }
  if (ac.state === 'suspended') ac.resume();
  if (musicEnabled && !musicTimer) startMusicScheduler();
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : volume;
  return muted;
}

export function setVolume(v) {
  volume = v;
  if (master && !muted) master.gain.value = v;
}

export function setMusicEnabled(on) {
  musicEnabled = on;
  if (on && ac && !musicTimer) startMusicScheduler();
  if (!on && musicTimer) {
    clearInterval(musicTimer);
    musicTimer = null;
  }
}

export function setMusicIntensity(level) {
  musicIntensity = level;
}

export function setMusicBreakthrough(on) {
  musicBT = on;
  if (musicFilter && ac) {
    musicFilter.frequency.setTargetAtTime(on ? 4200 : 900, ac.currentTime, 0.2);
  }
}

function tone({ freq, end, type = 'sine', dur = 0.1, vol = 0.3, attack = 0.003, delay = 0, bus = null }) {
  if (!ac || ac.state !== 'running') return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (end) osc.frequency.exponentialRampToValueAtTime(Math.max(1, end), t0 + dur);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(vol, t0 + attack);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain);
  gain.connect(bus ?? master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise({ dur = 0.1, vol = 0.25, freq = 2000, end, q = 1, delay = 0, bus = null }) {
  if (!ac || ac.state !== 'running') return;
  const t0 = ac.currentTime + delay;
  const len = Math.max(1, (dur + 0.05) * ac.sampleRate);
  const buffer = ac.createBuffer(1, len, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(freq, t0);
  if (end) filter.frequency.exponentialRampToValueAtTime(Math.max(1, end), t0 + dur);
  filter.Q.value = q;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(bus ?? master);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

// --- generative music -------------------------------------------------------

// A-minor pentatonic over two bars of 16ths (32 steps). null = rest.
const BASS_PATTERN = [
  0, null, null, 3, null, null, 5, null,
  7, null, null, 5, null, 3, null, null,
  0, null, null, 3, null, null, 5, null,
  10, null, 7, null, 5, null, 3, null,
];
const PAD_CHORDS = [[0, 7, 12], [-2, 5, 10]]; // Am-ish, G-ish
const PENTA = [0, 3, 5, 7, 10, 12];
const A2 = 110;

function semiFreq(semi) {
  return A2 * Math.pow(2, semi / 12) * (musicBT ? 2 : 1);
}

function scheduleMusicStep(step, time) {
  const stepDur = 60 / CONFIG.audio.bpm / 4;
  const delay = Math.max(0, time - ac.currentTime);

  const bassSemi = BASS_PATTERN[step % 32];
  if (bassSemi !== null) {
    tone({ freq: semiFreq(bassSemi), type: 'triangle', dur: 0.16, vol: 0.5, delay, bus: musicBus });
  }
  if (musicIntensity >= 2 && step % 16 === 0) {
    const chord = PAD_CHORDS[(step / 16) % 2 | 0];
    for (const semi of chord) {
      tone({ freq: semiFreq(semi + 12), type: 'sawtooth', dur: stepDur * 15, vol: 0.05, attack: 0.4, delay, bus: musicBus });
    }
  }
  if (musicIntensity >= 3 && step % 2 === 0 && Math.random() < 0.22) {
    const semi = 24 + PENTA[(Math.random() * PENTA.length) | 0];
    tone({ freq: semiFreq(semi), type: 'sine', dur: 0.25, vol: 0.09, delay, bus: musicBus });
  }
  if (musicBT && step % 2 === 1) {
    noise({ dur: 0.03, vol: 0.05, freq: 8000, delay, bus: musicBus });
  }
}

function startMusicScheduler() {
  if (!ac) return;
  nextNoteTime = ac.currentTime + 0.06;
  musicTimer = setInterval(() => {
    if (!ac || ac.state !== 'running') return;
    const stepDur = 60 / CONFIG.audio.bpm / 4;
    while (nextNoteTime < ac.currentTime + 0.28) {
      scheduleMusicStep(musicStep, nextNoteTime);
      musicStep = (musicStep + 1) % 32;
      nextNoteTime += stepDur;
    }
  }, 90);
}

// --- SFX palette ------------------------------------------------------------

// pitch follows impact offset — edge hits sound sharper (teaches angle by ear)
export function paddleHit(offset) {
  tone({ freq: 300 + Math.abs(offset) * 340, type: 'triangle', dur: 0.06, vol: 0.3 });
}

export function wallTap() {
  tone({ freq: 620, type: 'sine', dur: 0.025, vol: 0.08 });
}

export function brickChip() {
  noise({ dur: 0.04, vol: 0.16, freq: 2600 });
  tone({ freq: 240, type: 'square', dur: 0.035, vol: 0.1 });
}

export function brickBreak(tier) {
  const base = { 1: 520, 2: 392, 3: 262 }[tier] ?? 392;
  noise({ dur: 0.09, vol: 0.3, freq: 1800, end: 600 });
  tone({ freq: base, end: base * 0.7, type: 'square', dur: 0.1, vol: 0.22 });
  if (tier === 3) tone({ freq: 90, end: 50, type: 'sine', dur: 0.18, vol: 0.4 });
}

// positive bricks resolve a major third upward (§10)
export function positiveBreak() {
  tone({ freq: 523, type: 'sine', dur: 0.18, vol: 0.3 });
  tone({ freq: 659, type: 'sine', dur: 0.24, vol: 0.3, delay: 0.07 });
}

export function capsuleCatch() {
  tone({ freq: 392, type: 'triangle', dur: 0.1, vol: 0.3 });
  tone({ freq: 523, type: 'triangle', dur: 0.16, vol: 0.3, delay: 0.08 });
}

// disappointed, not punishing
export function setback() {
  tone({ freq: 380, end: 110, type: 'sawtooth', dur: 0.45, vol: 0.22 });
  noise({ dur: 0.3, vol: 0.1, freq: 500, end: 150 });
}

export function countdownTick(n) {
  const freq = 330 * Math.pow(1.13, 6 - n);
  tone({ freq, type: 'square', dur: 0.07, vol: 0.18 });
}

export function liftoff() {
  noise({ dur: 0.35, vol: 0.3, freq: 250, end: 3800, q: 2 });
  tone({ freq: 262, end: 523, type: 'triangle', dur: 0.3, vol: 0.25 });
}

export function netSave() {
  tone({ freq: 160, end: 330, type: 'sine', dur: 0.14, vol: 0.35 });
}

export function laserShoot() {
  tone({ freq: 1400, end: 500, type: 'square', dur: 0.08, vol: 0.14 });
}

export function perfectionismPing() {
  tone({ freq: 1980, type: 'sine', dur: 0.12, vol: 0.22 });
}

export function rabbitSwallow() {
  tone({ freq: 500, end: 90, type: 'sine', dur: 0.35, vol: 0.3 });
}

export function rabbitSpit() {
  tone({ freq: 120, end: 700, type: 'sine', dur: 0.18, vol: 0.3 });
}

export function burnoutChain() {
  noise({ dur: 0.25, vol: 0.35, freq: 900, end: 200, q: 0.8 });
  tone({ freq: 110, end: 60, type: 'sawtooth', dur: 0.3, vol: 0.3 });
}

export function procrastinationHeal() {
  tone({ freq: 700, end: 980, type: 'sine', dur: 0.16, vol: 0.12 }); // smug
}

export function anxietySpawn() {
  tone({ freq: 460, end: 380, type: 'square', dur: 0.09, vol: 0.1 });
}

// the JOYFUL chime climbs the same pentatonic the music uses, resolving on L
export function joyfulLetter(index) {
  const freq = 392 * Math.pow(2, PENTA[Math.min(index, 5)] / 12);
  tone({ freq, type: 'sine', dur: 0.3, vol: 0.32 });
  tone({ freq: freq * 2, type: 'sine', dur: 0.22, vol: 0.1, delay: 0.03 });
}

export function joyfulGo() {
  for (let i = 0; i < 3; i++) {
    tone({ freq: 523 * Math.pow(2, PENTA[i + 2] / 12), type: 'triangle', dur: 0.7, vol: 0.22, delay: i * 0.08 });
  }
  noise({ dur: 0.5, vol: 0.25, freq: 600, end: 5000, q: 1.5 });
}

export function breakthroughTrigger() {
  noise({ dur: 0.7, vol: 0.32, freq: 300, end: 4500, q: 1.2 });
  tone({ freq: 262, end: 1046, type: 'sawtooth', dur: 0.6, vol: 0.18 });
  tone({ freq: 523, type: 'sine', dur: 0.9, vol: 0.2, delay: 0.25 });
}

export function secondWind() {
  tone({ freq: 392, type: 'sine', dur: 0.5, vol: 0.25 });
  tone({ freq: 494, type: 'sine', dur: 0.5, vol: 0.22, delay: 0.1 });
  tone({ freq: 587, type: 'sine', dur: 0.7, vol: 0.22, delay: 0.2 });
}

export function d20Tick() {
  tone({ freq: 900 + Math.random() * 500, type: 'square', dur: 0.025, vol: 0.07 });
}

export function d20Settle(good) {
  if (good) {
    tone({ freq: 659, type: 'triangle', dur: 0.15, vol: 0.3 });
    tone({ freq: 988, type: 'triangle', dur: 0.25, vol: 0.3, delay: 0.09 });
  } else {
    tone({ freq: 220, end: 150, type: 'sawtooth', dur: 0.3, vol: 0.2 }); // sad trombone-ish
  }
}

export function emberHiss() {
  noise({ dur: 0.3, vol: 0.08, freq: 5000, end: 2500 });
}

export function emberHit() {
  noise({ dur: 0.2, vol: 0.3, freq: 1500, end: 300 });
  tone({ freq: 200, end: 80, type: 'sawtooth', dur: 0.25, vol: 0.25 });
}

export function fearRumble() {
  tone({ freq: 55, end: 38, type: 'sawtooth', dur: 0.9, vol: 0.35 });
  noise({ dur: 0.8, vol: 0.12, freq: 200, end: 80 });
}

export function bossSegmentBreak() {
  noise({ dur: 0.12, vol: 0.35, freq: 1200, end: 300 });
  tone({ freq: 196, end: 120, type: 'square', dur: 0.16, vol: 0.3 });
  tone({ freq: 70, end: 45, type: 'sine', dur: 0.25, vol: 0.45 });
}

export function bossFinish() {
  noise({ dur: 1.2, vol: 0.4, freq: 400, end: 60, q: 0.7 });
  tone({ freq: 523, type: 'sine', dur: 1.0, vol: 0.2 });
  tone({ freq: 659, type: 'sine', dur: 1.0, vol: 0.2, delay: 0.12 });
  tone({ freq: 784, type: 'sine', dur: 1.2, vol: 0.2, delay: 0.24 });
  tone({ freq: 55, end: 38, type: 'sine', dur: 0.5, vol: 0.5 });
}

export function levelClear() {
  tone({ freq: 392, type: 'triangle', dur: 0.12, vol: 0.25 });
  tone({ freq: 523, type: 'triangle', dur: 0.12, vol: 0.25, delay: 0.1 });
  tone({ freq: 659, type: 'triangle', dur: 0.22, vol: 0.25, delay: 0.2 });
}

export function newBest() {
  for (let i = 0; i < 4; i++) {
    tone({ freq: 523 * Math.pow(2, PENTA[i] / 12), type: 'triangle', dur: 0.18, vol: 0.25, delay: i * 0.09 });
  }
  noise({ dur: 0.4, vol: 0.15, freq: 1000, end: 6000 });
}
