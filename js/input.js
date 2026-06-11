import { CONFIG } from './config.js';

// Unifies mouse / touch (pointer events) / keyboard into one intent object.
// `launch` is a pending edge consumed by the serve logic (and discarded each
// step while the ball is in play, so stale clicks never auto-serve).
// `pause` is an edge consumed once per frame by the state machine.
// Touch drags grab the paddle with an offset so the finger needn't cover it.

export function createInput(frame, canvas, getPaddleX) {
  const state = {
    pointerX: CONFIG.width / 2,
    pointerMoved: false,
    touchOffset: 0,
    left: false,
    right: false,
    launch: false,
    pause: false,
  };

  let rect = canvas.getBoundingClientRect();
  const refreshRect = () => { rect = canvas.getBoundingClientRect(); };

  const toInternal = (clientX) => {
    if (!rect.width) return state.pointerX; // hidden/zero-sized canvas: keep last
    const x = (clientX - rect.left) * (CONFIG.width / rect.width);
    return Math.max(0, Math.min(CONFIG.width, x));
  };

  frame.addEventListener('pointermove', (e) => {
    state.pointerX = toInternal(e.clientX);
    state.pointerMoved = true;
  });

  frame.addEventListener('pointerdown', (e) => {
    const x = toInternal(e.clientX);
    if (e.pointerType === 'touch' && getPaddleX) {
      // grab-offset: keep the paddle where it is relative to the finger
      const dx = getPaddleX() - x;
      state.touchOffset = Math.abs(dx) < 220 ? dx : 0;
    } else {
      state.touchOffset = 0;
    }
    state.pointerX = x;
    state.pointerMoved = true;
    state.launch = true;
  });

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        state.left = true;
        break;
      case 'ArrowRight':
      case 'KeyD':
        state.right = true;
        break;
      case 'Space':
        state.launch = true;
        e.preventDefault();
        break;
      case 'KeyP':
      case 'Escape':
        state.pause = true;
        break;
    }
  });

  window.addEventListener('keyup', (e) => {
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        state.left = false;
        break;
      case 'ArrowRight':
      case 'KeyD':
        state.right = false;
        break;
    }
  });

  return {
    state,
    refreshRect,
    consumePause() {
      const v = state.pause;
      state.pause = false;
      return v;
    },
    clearEdges() {
      state.launch = false;
      state.pause = false;
    },
    endFrame() {
      state.pointerMoved = false;
    },
  };
}
