// config.js — every tuning constant for DDR Fresh (see DESIGN.md).
// Stage uses Scratch-style y-up coordinates with origin at center:
// x in [-240, 240], y in [-180, 180].

// ---- Stage / frame rate ----------------------------------------------------
export const STAGE_W = 480;
export const STAGE_H = 360;
export const FPS = 30;                    // fixed timestep
export const FRAME_DT = 1 / FPS;          // seconds per frame

// ---- Lanes / receptors / note motion ---------------------------------------
export const LANES = ['left', 'down', 'up', 'right'];
export const LANE_X = { left: -90, down: -30, up: 30, right: 90 };
export const HIT_LINE_Y = -120;           // receptors sit on the hit line
export const SPAWN_Y = 220;               // notes spawn here, fall downward
export const SCROLL_SPEED = 260;          // stage units per second
export const SCROLL_COMBO_RAMP = 0.002;   // +0.2% scroll per combo point...
export const SCROLL_COMBO_CAP = 100;      // ...capped at 100 combo
export const scrollSpeed = (combo) =>
  SCROLL_SPEED * (1 + SCROLL_COMBO_RAMP * Math.min(combo, SCROLL_COMBO_CAP));

// ---- Keys ------------------------------------------------------------------
export const KEY_TO_LANE = {
  ArrowLeft: 'left',
  ArrowDown: 'down',
  ArrowUp: 'up',
  ArrowRight: 'right',
};

// ---- Judgment windows (ms of |dt| at keypress vs the note's hit time) ------
export const WINDOWS_MS = {
  marvelous: 45,
  perfect: 90,
  great: 135,
  good: 180,
  miss: 220,        // a note passing the line unhit within ±220 ms is a Miss
};
export const TIERS = ['marvelous', 'perfect', 'great', 'good', 'miss'];

// ---- Scoring ---------------------------------------------------------------
export const TIER_SCORE = { marvelous: 300, perfect: 200, great: 100, good: 50 };
export const COMBO_MULT_DIV = 50;         // multiplier = 1 + combo / 50
export const comboMultiplier = (combo) => 1 + combo / COMBO_MULT_DIV;

// Combo increments on marvelous/perfect/great, resets on good/miss.
export const COMBO_KEEP_TIERS = ['marvelous', 'perfect', 'great'];

// ---- Health ----------------------------------------------------------------
export const HEALTH_START = 50;
export const HEALTH_MAX = 100;
export const HEALTH_DELTA = {
  marvelous: 2,
  perfect: 1.5,
  great: 1,
  good: -4,
  miss: -10,
};
// Fail when health <= 0 (gate drop + fail sting, then results).

// ---- Grades (by score % of the maximum possible score) ---------------------
export const GRADES = [
  { min: 95, grade: 'AAAA' },
  { min: 90, grade: 'AAA' },
  { min: 85, grade: 'AA' },
  { min: 70, grade: 'A' },
  { min: 55, grade: 'B' },
  { min: 40, grade: 'C' },
  { min: 0,  grade: 'D' },
];

// ---- Chart / difficulty ----------------------------------------------------
// chart.json: { bpm, duration, notes: [{ t, lane, jump }] }, t in seconds.
export const CHART_BPM = 167;
export const DIFFICULTIES = {
  Easy:   { label: 'Easy',   step: 2, jumps: false }, // every 2nd note, no jumps
  Medium: { label: 'Medium', step: 1, jumps: false }, // every note, no jumps
  Hard:   { label: 'Hard',   step: 1, jumps: true },  // all notes + jumps
};

// ---- Health bar layout (centered, y-up; layers bar < clip < frame) ---------
export const HEALTH_BAR = {
  y: 149,                                  // vertical center of the bar row
  frameX: 0,
  frameY: 149,                             // frame image centered at (0, 149)
  scale: 2.03,
  offset: -203,
  barX: (health) => 2.03 * health - 203,   // health 100 -> 0, health 0 -> -203
  clipX0: -261,                            // black clip covers x in [-261, -101]
  clipX1: -101,
  clipY: 149,
  layerBar: 43,
  layerClip: 45,
  layerFrame: 46,
};

// ---- Asset md5 file names --------------------------------------------------
// All asset file names live in the MANIFEST in js/assets.js (keyed by md5ext).
