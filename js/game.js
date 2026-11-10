// game.js — DDR Fresh game logic: phase state machine, note spawning, judging,
// score / combo / health. Dependency-free except for optional overrides from
// ./config.js (all DESIGN.md constants are built in as defaults).
import * as CFG from './config.js';

const C = (name, fallback) => (CFG && CFG[name] !== undefined ? CFG[name] : fallback);

// ---- Constants (config.js names first, DESIGN.md defaults as fallback) ------
const LANE_NAMES = C('LANES', ['left', 'down', 'up', 'right']); // lane index = position
const LANE_X_RAW = C('LANE_X', { left: -90, down: -30, up: 30, right: 90 });
const LANE_COUNT = LANE_NAMES.length;
const LANE_X = LANE_NAMES.map((n, i) => (Array.isArray(LANE_X_RAW) ? LANE_X_RAW[i] : LANE_X_RAW[n]));
const HIT_Y = C('HIT_LINE_Y', C('HIT_Y', -120));             // hit line, y-up stage coords
const SPAWN_Y = C('SPAWN_Y', 220);                           // notes spawn here, fall downward
const BASE_SPEED = C('SCROLL_SPEED', 260);                   // stage units / second
const SPEED_COMBO_RAMP = C('SCROLL_COMBO_RAMP', C('SPEED_COMBO_RAMP', 0.002)); // +20% at combo 100
const SPEED_COMBO_CAP = C('SCROLL_COMBO_CAP', C('SPEED_COMBO_CAP', 100));
const WINDOWS = (() => {                                     // seconds, |dt| at keypress
  const ms = C('WINDOWS_MS', null);
  if (ms) { const o = {}; for (const k of Object.keys(ms)) o[k] = ms[k] / 1000; return o; }
  return C('JUDGE_WINDOWS', { marvelous: 0.045, perfect: 0.090, great: 0.135, good: 0.180, miss: 0.220 });
})();
const SCORE_BASE = C('TIER_SCORE', C('SCORE_BASE', { marvelous: 300, perfect: 200, great: 100, good: 50 }));
const COMBO_DIVISOR = C('COMBO_MULT_DIV', C('COMBO_DIVISOR', 50)); // multiplier = 1 + combo/50
const COMBO_KEEP_TIERS = C('COMBO_KEEP_TIERS', ['marvelous', 'perfect', 'great']);
const HEALTH_START = C('HEALTH_START', 50);
const HEALTH_MAX = C('HEALTH_MAX', 100);
const HEALTH_DELTA = C('HEALTH_DELTA', {
  marvelous: 2, perfect: 1.5, great: 1, good: -4, miss: -10,
});
const CLEAR_PAD = C('CLEAR_PAD', 1);                          // clear at duration + 1s
const GRADES = C('GRADES', C('GRADE_THRESHOLDS', [           // by score%, descending
  { min: 95, grade: 'AAAA' }, { min: 90, grade: 'AAA' }, { min: 85, grade: 'AA' },
  { min: 70, grade: 'A' }, { min: 55, grade: 'B' }, { min: 40, grade: 'C' },
  { min: 0, grade: 'D' },
])).map(g => ({ min: g.min > 1 ? g.min / 100 : g.min, grade: g.grade })); // accept % or fraction

export const TIERS = C('TIERS', ['marvelous', 'perfect', 'great', 'good', 'miss']);
export const LANES = Object.freeze({ left: 0, down: 1, up: 2, right: 3 });

// Chart lanes may be indices (0..3) or names ('left'|'down'|'up'|'right').
const laneIndex = (l) => (typeof l === 'string' ? Math.max(0, LANE_NAMES.indexOf(l)) : l);

function makeEmitter() {
  const map = new Map();
  return {
    on(name, fn) {
      if (!map.has(name)) map.set(name, []);
      map.get(name).push(fn);
      return this;
    },
    emit(name, ...args) {
      const list = map.get(name);
      if (list) for (const fn of list.slice()) fn(...args);
      return this;
    },
  };
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function tierForDt(dt) {
  const a = Math.abs(dt);
  if (a < WINDOWS.marvelous) return 'marvelous';
  if (a < WINDOWS.perfect) return 'perfect';
  if (a < WINDOWS.great) return 'great';
  if (a < WINDOWS.good) return 'good';
  return 'miss'; // found within the ±220 ms window but past Good
}

/**
 * createGame({ bus?, onJudgment?, onScore?, onHealth?, onPhase? })
 *   bus      — optional emitter with .emit(name, ...args); an internal one is
 *              created and exposed as game.bus when omitted.
 *   onXxx    — optional direct callbacks; fired in addition to the bus.
 * Events: onJudgment(tier, lane, x), onScore(score, delta),
 *         onHealth(health), onPhase(phase, results?)
 */
export function createGame(opts = {}) {
  const bus = opts.bus && typeof opts.bus.emit === 'function' ? opts.bus : makeEmitter();

  function emit(name, ...args) {
    bus.emit(name, ...args);
    const h = opts[name];
    if (typeof h === 'function') h(...args);
  }

  const game = {
    bus,
    phase: 'menu',            // 'menu' | 'play' | 'results'
    difficulty: null,
    chart: null,
    health: HEALTH_START,
    score: 0,
    combo: 0,
    maxCombo: 0,
    counts: { marvelous: 0, perfect: 0, great: 0, good: 0, miss: 0 },
    songTime: 0,
    notes: [],                // [{t, lane, jump, hit, missed}]
    spawnedIdx: 0,
    speed: BASE_SPEED,
    maxScore: 0,
    results: null,
  };

  function speedForCombo(combo) {
    const ramp = Math.min(Math.max(combo, 0), SPEED_COMBO_CAP) * SPEED_COMBO_RAMP;
    return BASE_SPEED * (1 + ramp);
  }

  // Max achievable score: every note Marvelous (combo grows per note, multiplier
  // uses the combo value before the current note increments it).
  function maxScoreFor(notes) {
    let s = 0, c = 0;
    for (let i = 0; i < notes.length; i++) {
      s += SCORE_BASE.marvelous * (1 + c / COMBO_DIVISOR);
      c++;
    }
    return s;
  }

  function applyJudgment(note, tier, lane) {
    note.hit = true;                 // consumes the note (jump pair = same object)
    if (tier === 'miss') note.missed = true;
    game.counts[tier] = (game.counts[tier] || 0) + 1;

    const base = SCORE_BASE[tier] || 0;
    const delta = Math.round(base * (1 + game.combo / COMBO_DIVISOR));
    game.score += delta;

    if (COMBO_KEEP_TIERS.includes(tier)) {
      game.combo++;
      if (game.combo > game.maxCombo) game.maxCombo = game.combo;
    } else {
      game.combo = 0;
    }

    game.health = clamp(game.health + (HEALTH_DELTA[tier] || 0), 0, HEALTH_MAX);
    game.speed = speedForCombo(game.combo);

    const x = LANE_X[lane] !== undefined ? LANE_X[lane] : (lane - (LANE_COUNT - 1) / 2) * 60;
    emit('onJudgment', tier, lane, x);
    emit('onScore', game.score, delta);
    emit('onHealth', game.health);

    if (game.health <= 0) finish(false);
  }

  function finish(cleared) {
    if (game.phase !== 'play') return;
    const maxScore = game.maxScore || maxScoreFor(game.notes);
    const pct = maxScore > 0 ? game.score / maxScore : 0;
    let grade = 'D';
    for (const g of GRADES) {
      if (pct >= g.min) { grade = g.grade; break; }
    }
    game.results = {
      cleared,
      failed: !cleared,
      grade,
      scorePct: pct,
      score: game.score,
      maxCombo: game.maxCombo,
      counts: { ...game.counts },
      difficulty: game.difficulty,
    };
    game.phase = 'results';
    emit('onPhase', 'results', game.results);
  }

  /** Begin play. difficulty: 'Easy'|'Medium'|'Hard'; chart: {bpm, duration, notes:[{t,lane,jump}]}. */
  function start(difficulty, chart) {
    game.phase = 'play';
    game.difficulty = difficulty;
    game.chart = chart;
    game.health = HEALTH_START;
    game.score = 0;
    game.combo = 0;
    game.maxCombo = 0;
    game.counts = { marvelous: 0, perfect: 0, great: 0, good: 0, miss: 0 };
    game.songTime = 0;
    game.notes = chart.notes.map(n => ({
      t: n.t, lane: laneIndex(n.lane),
      jump: n.jump ? 'pending' : null,   // resolved to partner lane below
      hit: false, missed: false,
    }));
    game.notes.sort((a, b) => a.t - b.t);
    // Jump notes arrive as pairs at identical t (chart flag jump=1 on both).
    // Each note's `jump` = the partner's lane, so the pair is hit by either key.
    const byT = new Map();
    for (const n of game.notes) {
      if (n.jump !== 'pending') continue;
      if (!byT.has(n.t)) byT.set(n.t, []);
      byT.get(n.t).push(n);
    }
    for (const group of byT.values()) {
      if (group.length === 2) {
        group[0].jump = group[1].lane;
        group[1].jump = group[0].lane;
      } else {
        for (const n of group) n.jump = null;
      }
    }
    game.spawnedIdx = 0;
    game.speed = speedForCombo(0);
    game.maxScore = maxScoreFor(game.notes);
    game.results = null;
    emit('onPhase', 'play');
    emit('onScore', game.score, 0);
    emit('onHealth', game.health);
    return game;
  }

  /** Advance the song: songTime, spawning, misses, fail/clear. No-op outside 'play'.
   *  Pass `now` (seconds into the song from the audio clock) to lock gameplay
   *  to the music; otherwise songTime advances by dt. */
  function update(dt, now) {
    if (game.phase !== 'play') return;
    game.songTime = (now === undefined || now === null) ? game.songTime + dt : now;
    game.speed = speedForCombo(game.combo);

    // Spawn: note becomes visible when songTime >= t - (spawnY - hitY) / speed.
    const lead = (SPAWN_Y - HIT_Y) / game.speed;
    while (game.spawnedIdx < game.notes.length &&
           game.notes[game.spawnedIdx].t - lead <= game.songTime) {
      game.spawnedIdx++;
    }

    // Miss: passed the hit line by more than the miss window, still unhit.
    for (const n of game.notes) {
      if (!n.hit && !n.missed && game.songTime > n.t + WINDOWS.miss) {
        applyJudgment(n, 'miss', n.lane);
        if (game.phase !== 'play') return; // failed mid-sweep
      }
    }

    if (game.chart && game.songTime > game.chart.duration + CLEAR_PAD) finish(true);
  }

  /**
   * Judge a lane press. Finds the nearest unhit note in `lane` (a jump note
   * matches when lane === note.lane or lane === note.jump) within ±220 ms of
   * atTime (defaults to songTime). Returns the tier ('marvelous'|'perfect'|
   * 'great'|'good'|'miss') or null if nothing is in range.
   */
  function judge(lane, atTime) {
    if (game.phase !== 'play') return null;
    lane = laneIndex(lane);
    const t = atTime !== undefined ? atTime : game.songTime;
    let best = null, bestAbs = Infinity;
    for (const n of game.notes) {
      if (n.hit || n.missed) continue;
      if (n.lane !== lane && n.jump !== lane) continue;
      const a = Math.abs(n.t - t);
      if (a <= WINDOWS.miss && a < bestAbs) { best = n; bestAbs = a; }
    }
    if (!best) return null;
    const tier = tierForDt(best.t - t);
    applyJudgment(best, tier, lane);
    return tier;
  }

  /** Back to the menu. */
  function reset() {
    game.phase = 'menu';
    game.results = null;
    emit('onPhase', 'menu');
    return game;
  }

  // ---- Renderer helpers ------------------------------------------------------
  const leadTime = () => (SPAWN_Y - HIT_Y) / game.speed;
  const noteY = (note, atTime) => {
    const t = atTime !== undefined ? atTime : game.songTime;
    return HIT_Y + (note.t - t) * game.speed; // SPAWN_Y at spawn, HIT_Y at hit time
  };

  game.start = start;
  game.update = update;
  game.judge = judge;
  game.reset = reset;
  game.speedForCombo = speedForCombo;
  game.leadTime = leadTime;
  game.noteY = noteY;
  game.tierForDt = tierForDt;
  game.HIT_Y = HIT_Y;
  game.SPAWN_Y = SPAWN_Y;
  game.LANE_X = LANE_X;
  return game;
}

export default createGame;
