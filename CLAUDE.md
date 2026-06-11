# Breakthrough — Project Context

Brick-breaking arcade game (Breakout/Arkanoid-style) built with vanilla HTML/CSS/JavaScript, no build step. Theme: bricks are life obstacles (doubt, procrastination...), power-ups are positive traits (courage, focus...). **Fun first, metaphor second — never preachy.**

**Design source of truth: `_Workbench/GAME-DESIGN.md`** — read it before gameplay/visual/audio work. All tuning constants belong in `js/config.js`.

## Project layout

```
/
├── index.html            # entry point
├── style.css             # shell, HUD, menu screens (DOM); canvas does gameplay
├── js/                   # ES modules (main, config, physics, bricks, levels,
│                         #   powerups, flow, particles, effects, audio, render, ...)
├── _Workbench/           # design docs & working notes
│   └── GAME-DESIGN.md    # full game design document
├── ROADMAP.md            # task list (tiered priority)
└── CLAUDE.md             # this file
```

## Run

Double-click **`Play Breakthrough.bat`** (Windows) — starts a static server on
`http://localhost:8787` and opens the browser once it's ready.
Or manually: `npx serve .` (or VS Code Live Server) and open the served URL.
ES modules require http — opening `index.html` via `file://` will NOT work.

## Tech

- Vanilla JS ES modules + Canvas 2D + Web Audio (no frameworks, no bundler, no asset files)
- Fixed-timestep physics (120 Hz) with render interpolation; swept circle-vs-AABB collision
- Internal resolution 1280×720, letterboxed scale; localStorage for saves/settings
- Target: modern desktop browsers first, mobile touch supported

---

## ROADMAP workflow

Living task list: `ROADMAP.md`, in priority order
**Now → Next → P1 → P2 → P3 → Someday/Maybe**.

- **Start a task** → add / move it to **Now**.
- **After a push** → remove completed tasks from the ROADMAP (the git commit/push is the
  completion record), then list the next 1–3 tasks (priority order) so the user knows what's next.
- **User asks to add a task** → default it to **P3** unless they specify a tier.
- **If Next, P1, and P2 are all empty** → prompt the user to prioritize next steps.
