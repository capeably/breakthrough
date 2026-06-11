# Roadmap — Breakthrough

Priority order: **Now → Next → P1 → P2 → P3 → Someday/Maybe.**
Maintenance rules live in `CLAUDE.md` (§ROADMAP workflow): completed tasks are removed
(git history is the record), new tasks default to **P3**, and starting a task moves it to **Now**.

Design source of truth: `_Workbench/GAME-DESIGN.md` (kept local — gitignored, not published).
Live build: https://capeably.github.io/breakthrough/ · Repo: https://github.com/capeably/breakthrough

The game is feature-complete (MVP → P3) and deployed. Initial commit captures the whole build;
git history is now the record of completed work.

## Now
_(nothing in progress)_

## Next
- **Playtest balance pass:** play all 4 chapters and tune from real feel — flow-meter fill rate,
  elite densities, per-chapter drop weights, and boss timers (esp. FEAR's descend clock and
  chapter-4 difficulty). Note: the recent world-timer-freeze-during-serve and DENIAL soft-lock
  fixes shift the math toward "fairer," so re-judge from scratch.

## P1

## P2

## P3

## Someday / Maybe
- Endless mode (procedural walls, rising intensity)
- The Debrief (end-of-run stats card)
- Hard Thing of the Day (daily seed challenge, streak counter)
- Beat the Estimate (per-level par time, bonus only — never a penalty)
- Hourly Reboot reminder (opt-in, between levels)
- Coach Mode voice lines (opt-in; maybe never)
- More elite bricks (SCOPE CREEP, TIME BLINDNESS — need playtest)
- Anti-frustration rail: highlight + gentle magnet-assist when 1–3 *visible* bricks linger in
  hard-to-reach spots (design doc §3)
- Level editor (the ASCII level format makes this nearly free)
- Shareable screenshot of boss-finish moments

## Non-goals (for now)
- Frameworks, bundlers, or any build step
- Multiplayer / online features
- Asset files (art/audio) — everything is code-drawn and synthesized
- Self-help content: no advice, quotes, or affirmations (one sanctioned exception: the JOYFUL
  letter phrases — design doc §2/§6)
- Overt faith content, literal brand names on bricks, real-world productivity features
