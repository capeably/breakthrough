// Swept circle-vs-AABB collision (design doc §13): find the earliest time of
// impact t in [0,1] along the motion vector, reflect, re-sweep the remainder.
// The swept shape is the rect expanded by the ball radius — flat faces plus
// quarter-circle corners (Minkowski sum), so corner bounces are accurate.
// Fireball balls (Breakthrough Mode / FREEDOM) skip brick reflection entirely:
// they sweep only walls and paddles, then deal pass-through damage to every
// brick they overlap.

const EPS_PUSH = 0.05; // separation applied along the normal after resolving

function segVsCircle(px, py, dx, dy, cx, cy, r) {
  const fx = px - cx;
  const fy = py - cy;
  const a = dx * dx + dy * dy;
  if (a === 0) return null;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  if (c < 0) return null; // already inside the corner radius; face tests own this
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}

export function sweepCircleVsRect(px, py, dx, dy, r, rect) {
  const x0 = rect.x;
  const y0 = rect.y;
  const x1 = rect.x + rect.w;
  const y1 = rect.y + rect.h;
  let best = null;

  if (dx > 0) {
    const t = (x0 - r - px) / dx;
    if (t >= 0 && t <= 1) {
      const y = py + dy * t;
      if (y >= y0 && y <= y1) best = { t, nx: -1, ny: 0 };
    }
  } else if (dx < 0) {
    const t = (x1 + r - px) / dx;
    if (t >= 0 && t <= 1) {
      const y = py + dy * t;
      if (y >= y0 && y <= y1) best = { t, nx: 1, ny: 0 };
    }
  }
  if (dy > 0) {
    const t = (y0 - r - py) / dy;
    if (t >= 0 && t <= 1 && (best === null || t < best.t)) {
      const x = px + dx * t;
      if (x >= x0 && x <= x1) best = { t, nx: 0, ny: -1 };
    }
  } else if (dy < 0) {
    const t = (y1 + r - py) / dy;
    if (t >= 0 && t <= 1 && (best === null || t < best.t)) {
      const x = px + dx * t;
      if (x >= x0 && x <= x1) best = { t, nx: 0, ny: 1 };
    }
  }

  const corners = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]];
  for (const [cx, cy] of corners) {
    const t = segVsCircle(px, py, dx, dy, cx, cy, r);
    if (t !== null && (best === null || t < best.t)) {
      best = { t, nx: (px + dx * t - cx) / r, ny: (py + dy * t - cy) / r };
    }
  }
  return best;
}

export function circleOverlapsRect(cx, cy, r, rect) {
  const nx = Math.max(rect.x, Math.min(rect.x + rect.w, cx));
  const ny = Math.max(rect.y, Math.min(rect.y + rect.h, cy));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy <= r * r;
}

export function setSpeed(ball, speed) {
  const mag = Math.hypot(ball.vx, ball.vy);
  if (mag === 0) return;
  const k = speed / mag;
  ball.vx *= k;
  ball.vy *= k;
}

export function paddleOffset(ball, paddle) {
  const half = paddle.w / 2 + ball.r;
  return Math.max(-1, Math.min(1, (ball.x - paddle.x) / half));
}

export function paddleRebound(ball, paddle, cfg) {
  // Exit angle comes from where the ball strikes the paddle — the skill core.
  const off = paddleOffset(ball, paddle);
  const angle = off * (cfg.paddle.maxBounceAngleDeg * Math.PI / 180);
  ball.vx = Math.sin(angle) * ball.speed;
  ball.vy = -Math.cos(angle) * ball.speed;
  ball.y = Math.min(ball.y, paddle.y - ball.r - 0.5);
  return off;
}

function antiStallNudge(ball, cfg) {
  ball.wallStreak++;
  const minVy = cfg.ball.minVerticalRatio * ball.speed;
  if (ball.wallStreak >= cfg.ball.wallBouncesBeforeNudge && Math.abs(ball.vy) < minVy) {
    ball.vy = (ball.vy === 0 ? -1 : Math.sign(ball.vy)) * minVy;
    ball.wallStreak = 0;
  }
}

// Advances the ball through one fixed step, resolving every collision along
// the way (max 4 sub-resolutions).
export function stepBall(ball, dt, world, events) {
  const cfg = world.cfg;
  if (ball.heldBy) return; // rabbit hole has it — main runs the hold timer

  const fireball = world.isFireball?.(ball) ?? false;
  let remaining = dt;

  for (let iter = 0; iter < 4 && remaining > 1e-6; iter++) {
    const dx = ball.vx * remaining;
    const dy = ball.vy * remaining;
    let best = null;
    let kind = null;
    let brick = null;
    let hitPaddle = null;

    for (const wall of world.walls) {
      const h = sweepCircleVsRect(ball.x, ball.y, dx, dy, ball.r, wall);
      if (h && (!best || h.t < best.t)) { best = h; kind = wall.side; brick = null; }
    }
    if (!fireball) {
      for (const b of world.field.candidates(ball.x, ball.y, dx, dy, ball.r)) {
        const h = sweepCircleVsRect(ball.x, ball.y, dx, dy, ball.r, b.rect);
        if (h && (!best || h.t < best.t)) { best = h; kind = 'brick'; brick = b; }
      }
    }
    if (ball.vy > 0) {
      const h = sweepCircleVsRect(ball.x, ball.y, dx, dy, ball.r, world.paddle.rect());
      if (h && (!best || h.t < best.t)) {
        best = h; kind = 'paddle'; brick = null; hitPaddle = world.paddle;
      }
      const echo = world.echoPaddle?.();
      if (echo) {
        const he = sweepCircleVsRect(ball.x, ball.y, dx, dy, ball.r, echo.rect());
        if (he && (!best || he.t < best.t)) {
          best = he; kind = 'paddle'; brick = null; hitPaddle = echo;
        }
      }
    }

    if (!best) {
      ball.x += dx;
      ball.y += dy;
      break;
    }

    ball.x += dx * best.t + best.nx * EPS_PUSH;
    ball.y += dy * best.t + best.ny * EPS_PUSH;
    remaining *= 1 - best.t;

    if (kind === 'paddle') {
      ball.wallStreak = 0;
      if (world.magnetActive && hitPaddle === world.paddle) {
        ball.vx = 0;
        ball.vy = 0;
        ball.y = world.paddle.y - ball.r - 0.5;
        events.onMagnetCatch?.(ball);
        return; // stuck — no more motion this step
      }
      const off = paddleRebound(ball, hitPaddle, cfg);
      events.onPaddleHit?.(ball, off, hitPaddle !== world.paddle);
    } else {
      const dot = ball.vx * best.nx + ball.vy * best.ny;
      ball.vx -= 2 * dot * best.nx;
      ball.vy -= 2 * dot * best.ny;
      if (kind === 'brick') {
        ball.wallStreak = 0;
        events.onBrickHit?.(brick, ball, best.nx, best.ny);
        if (ball.heldBy) return; // a rabbit hole swallowed it mid-step
      } else {
        if (kind === 'left' || kind === 'right') antiStallNudge(ball, cfg);
        events.onWallHit?.(kind, ball, best.nx, best.ny);
      }
    }
    setSpeed(ball, ball.speed);
  }

  // fireball: pass-through damage to everything the ball now overlaps
  if (fireball) {
    const cands = world.field.candidates(ball.x, ball.y, 0, 0, ball.r + 2);
    for (const b of cands) {
      if (circleOverlapsRect(ball.x, ball.y, ball.r + 1, b.rect)) {
        if (!ball.piercing.has(b.id)) {
          ball.piercing.add(b.id);
          events.onFireballHit?.(b, ball);
        }
      }
    }
    // forget bricks we've fully passed
    for (const id of ball.piercing) {
      const still = cands.some((b) => b.id === id && circleOverlapsRect(ball.x, ball.y, ball.r + 3, b.rect));
      if (!still) ball.piercing.delete(id);
    }
  }

  if (ball.y - ball.r > cfg.height) events.onBallLost?.(ball);
}
