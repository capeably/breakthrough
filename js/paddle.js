import { CONFIG } from './config.js';

export class Paddle {
  constructor() {
    this.baseW = CONFIG.paddle.width;
    this.w = this.baseW;
    this.h = CONFIG.paddle.height;
    this.x = CONFIG.width / 2;
    this.y = CONFIG.paddle.y; // top edge
    this.px = this.x;
    this.keyVel = 0;
    this.hitT = 0; // stretch-squash timer on ball impact
    this.flareX = 0; // impact point for the top-edge flare (offset from center)
    this.flareT = 0;
    this.debuffT = 0; // BURNOUT ember shrink
    // width modifiers compose multiplicatively: base × each active mod
    this.widthMods = { wide: 1, breakthrough: 1, assist: 1, debuff: 1 };
  }

  rect() {
    return { x: this.x - this.w / 2, y: this.y, w: this.w, h: this.h };
  }

  onBallHit(offset) {
    this.hitT = CONFIG.juice.paddleHitTime;
    this.flareX = offset * (this.w / 2);
    this.flareT = 0.25;
  }

  applyEmberDebuff() {
    this.debuffT = CONFIG.boss.burnout.debuffTime;
  }

  update(dt, input) {
    if (input.pointerMoved) {
      // Pointer maps 1:1 — responsiveness is sacred, no smoothing.
      // Touch drags apply a grab-offset so the finger needn't cover the paddle.
      this.x = input.pointerX + (input.touchOffset || 0);
      this.keyVel = 0;
    } else {
      const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      const target = dir * CONFIG.paddle.keySpeed;
      const maxDelta = CONFIG.paddle.keyAccel * dt;
      this.keyVel += Math.max(-maxDelta, Math.min(maxDelta, target - this.keyVel));
      this.x += this.keyVel * dt;
    }

    if (this.debuffT > 0) this.debuffT -= dt;
    this.widthMods.debuff = this.debuffT > 0 ? CONFIG.boss.burnout.debuffWidthMult : 1;

    const m = this.widthMods;
    const targetW = this.baseW * m.wide * m.breakthrough * m.assist * m.debuff;
    // width changes ease, never snap (§5.2)
    this.w += (targetW - this.w) * Math.min(1, dt * CONFIG.paddle.widthEase);

    if (this.hitT > 0) this.hitT -= dt;
    if (this.flareT > 0) this.flareT -= dt;

    const half = this.w / 2;
    this.x = Math.max(half, Math.min(CONFIG.width - half, this.x));
  }
}

// CONNECTION's body double: a translucent echo paddle that mirrors the real
// one from a fixed height above — working alongside you, wordlessly.
export class EchoPaddle {
  constructor(paddle) {
    this.paddle = paddle;
  }

  get w() { return this.paddle.w * CONFIG.powerups.connection.widthFrac; }
  get h() { return this.paddle.h * 0.85; }
  get x() { return this.paddle.x; }
  get y() { return this.paddle.y - CONFIG.powerups.connection.offsetY; }

  rect() {
    return { x: this.x - this.w / 2, y: this.y, w: this.w, h: this.h };
  }
}
