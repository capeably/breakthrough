import { CONFIG } from './config.js';

export class Ball {
  constructor() {
    this.r = CONFIG.ball.radius;
    this.x = CONFIG.width / 2;
    this.y = 0;
    this.px = this.x;
    this.py = this.y;
    this.vx = 0;
    this.vy = 0;
    this.speed = CONFIG.ball.baseSpeed;
    this.served = false;
    this.wallStreak = 0;
    this.stuck = false; // magnet hold
    this.stuckOffset = 0;
    this.stuckT = 0;
    this.heldBy = null; // rabbit hole capture
    this.holdT = 0;
    this.speedBoost = 1; // perfectionism reflections, decays back to 1
    this.piercing = new Set(); // bricks being passed through in fireball mode
    this.trail = []; // recent positions for the motion trail
    this.squashT = 0; // bounce squash timer + axis
    this.squashNx = 0;
    this.squashNy = -1;
  }

  followPaddle(paddle, offset = 0) {
    this.x = paddle.x + offset;
    this.y = paddle.y - this.r - 1;
  }

  resetOnPaddle(paddle) {
    this.served = false;
    this.stuck = false;
    this.heldBy = null;
    this.vx = 0;
    this.vy = 0;
    this.wallStreak = 0;
    this.speedBoost = 1;
    this.piercing.clear();
    this.trail.length = 0;
    this.followPaddle(paddle);
    this.px = this.x;
    this.py = this.y;
  }

  launch() {
    const spread = CONFIG.ball.launchSpreadDeg * Math.PI / 180;
    const angle = (Math.random() * 2 - 1) * spread;
    this.vx = Math.sin(angle) * this.speed;
    this.vy = -Math.cos(angle) * this.speed;
    this.served = true;
  }

  launchAtAngle(angle) {
    this.vx = Math.sin(angle) * this.speed;
    this.vy = -Math.cos(angle) * this.speed;
    this.served = true;
    this.stuck = false;
  }

  recordTrail() {
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > CONFIG.ball.trailLength) this.trail.shift();
  }

  squash(nx, ny) {
    this.squashT = CONFIG.juice.ballSquashTime;
    this.squashNx = nx;
    this.squashNy = ny;
  }

  clone() {
    const b = new Ball();
    b.x = this.x;
    b.y = this.y;
    b.px = this.x;
    b.py = this.y;
    b.speed = this.speed;
    b.served = true;
    return b;
  }
}
