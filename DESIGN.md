# DDR Fresh — design (mechanics built from scratch, assets reused)

Reuses art/audio from `ddr-standalone/assets` (arrows, judgment words, grades, health
frame, "Destiny Eclipse" song). Mechanics are original, NOT a port of the Scratch logic.

## Core loop (original mechanics)
- 4 lanes (left/down/up/right), notes **fall downward** onto a hit line near the bottom.
- Hit line at stage y = -120; receptors sit on it. Notes spawn at y = +220 and fall at
  scroll speed 260 u/s (speed ramps slightly with combo).
- Keys: arrow keys. Judgment by |dt| at keypress vs note's hit time:
  Marvelous < 45 ms, Perfect < 90, Great < 135, Good < 180, else Miss when note passes
  the line unhit (window ±220 ms).
- Score: base per tier (Marvelous 300, Perfect 200, Great 100, Good 50) × (1 + combo/50).
- Combo increments on Marvelous/Perfect/Great, resets on Good/Miss. Max combo tracked.
- Health 0-100, starts 50: +2 Marvelous, +1.5 Perfect, +1 Great, -4 Good, -10 Miss.
  Fail at health <= 0 (gate drop + fail sting, then results). Clear at song end.
- Grades by score%: AAAA >= 95%, AAA >= 90%, AA >= 85%, A >= 70%, B >= 55%, C >= 40%, else D.

## Chart (generated from scratch)
- `tools/make_chart.py` analyzes `assets/55bc1042....wav` (PCM, stdlib wave) with a
  simple energy-onset detector at 167 BPM grid, emits `assets/chart.json`:
  `{ bpm, duration, notes: [{t, lane, jump}] }` (jump = simultaneous 2-lane note).
- Difficulty select (Easy/Medium/Hard) filters note density (every 2nd / 1st / all + jumps).

## Presentation (reuses original assets)
- Stage 480x360, 30fps fixed timestep, Scratch-style y-up coords, black page, centered
  canvas, cursor hidden.
- Health bar: SAME centered layout as the fixed original — frame `019d7c7c...png` at
  (0,149), fill bar `16f6dbae...png` at x = 2.03*health-203, black clip covering
  x in [-261,-101] between them (layers bar < clip < frame).
- Judgment popups reuse word art; receptor flash reuses flash costumes.
- Menu: Easy/Medium/Hard svgs; results: panel + grade costumes + FC badges; voices/stings
  via WebAudio.

## File layout
```
ddr-fresh/
  index.html, css/style.css, serve.py (PORT env, default 8897, no-store)
  assets/ (copied art + song + chart.json generated)
  tools/make_chart.py
  js/main.js      — boot + fixed-timestep loop + wiring
  js/config.js    — constants (lanes, speeds, windows, health layout)
  js/assets.js    — manifest + loader
  js/chart.js     — loads chart.json, difficulty filtering
  js/game.js      — state machine + note spawning + judging + score/combo/health
  js/input.js     — keyboard/mouse
  js/render.js    — canvas renderer (backdrop, sprites, hud, popups)
  js/audio.js     — WebAudio song + sfx
```
Each agent owns a disjoint subset; integrate in main.js.
