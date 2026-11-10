// main.js — boot + wiring for ddr-fresh (original mechanics, reused assets).
window.__errs = [];
window.addEventListener('error', (e) => window.__errs.push(String(e.message)));
window.addEventListener('unhandledrejection', (e) => window.__errs.push('rej:' + String(e.reason && e.reason.message || e.reason)));

import { FPS, STAGE_W, STAGE_H, LANE_X, LANES, HIT_LINE_Y, DIFFICULTIES } from './config.js';
import { MANIFEST, loadAssets } from './assets.js';
import { Renderer } from './render.js';
import { audio } from './audio.js';
import { loadChart, filterDifficulty, spawnList } from './chart.js';
import { createGame } from './game.js';
import { createInput } from './input.js';

async function boot() {
  window.__bootStage = 'assets';
  const canvas = document.getElementById('stage');
  canvas.width = STAGE_W;
  canvas.height = STAGE_H;

  const loaded = await loadAssets();
  const byFile = {}; // md5ext -> HTMLImageElement
  for (const [file, name] of Object.entries(MANIFEST)) {
    if (loaded.images[name]) byFile[file] = loaded.images[name];
  }

  window.__bootStage = 'render';
  const render = new Renderer(canvas, byFile);

  window.__bootStage = 'audio';
  await audio.init();
  const chart = await loadChart();

  // --- game + input -----------------------------------------------------------
  const popups = [];        // { tier, age }
  const flashUntil = {};    // lane -> performance.now() ms timestamp
  let difficulty = 'Medium';

  const game = createGame({
    onJudgment: (tier, lane) => {
      popups.push({ tier, age: 0 });
      if (lane != null) flashUntil[lane] = performance.now() + 100;
      if (tier === 'miss') audio.play('pop');
    },
    onPhase: (phase, results) => {
      if (phase === 'results') {
        audio.stopAll();
        audio.play(results && results.failed ? 'StageFail' : 'cleared');
        if (results && results.grade) audio.play('grade' + results.grade);
      }
    },
  });

  const input = createInput();
  input.on('lanePress', (lane) => {
    if (game.phase === 'play') game.judge(lane, game.songTime);
  });
  input.on('up', () => { if (game.phase === 'menu') startPlay(); });
  input.on('left', () => { if (game.phase === 'menu') cycleDifficulty(-1); });
  input.on('right', () => { if (game.phase === 'menu') cycleDifficulty(1); });
  input.on('ok', () => { if (game.phase === 'results') toMenu(); });

  function cycleDifficulty(dir) {
    const keys = Object.keys(DIFFICULTIES);
    const i = keys.indexOf(difficulty);
    difficulty = keys[(i + dir + keys.length) % keys.length];
  }

  function startPlay() {
    const notes = spawnList(filterDifficulty(chart.notes, difficulty));
    game.start(difficulty, { bpm: chart.bpm, duration: chart.duration, notes });
    audio.playSong(0);
    audio.play('Ready');
  }

  function toMenu() {
    audio.stopAll();
    game.reset();
  }

  // --- main loop ---------------------------------------------------------------
  window.__bootStage = 'loop';
  const dt = 1 / FPS;
  let last = performance.now();
  let acc = 0;

  function frame(now) {
    let elapsed = (now - last) / 1000;
    last = now;
    if (elapsed > 0.25) elapsed = 0.25;
    acc += elapsed;
    while (acc >= dt) {
      try {
        if (game.phase === 'play') game.update(dt, audio.getSongTime());
        for (let i = popups.length - 1; i >= 0; i--) {
          popups[i].age += dt;
          if (popups[i].age > 0.6) popups.splice(i, 1);
        }
      } catch (e) { console.warn('update error:', e); }
      acc -= dt;
    }

    try {
      render.clear();
      if (game.phase === 'menu') {
        render.drawBackdrop('menu');
        render.drawMenu(difficulty);
      } else if (game.phase === 'play') {
        render.drawBackdrop('game');
        // notes
        for (const n of game.notes) {
          if (n.hit || n.missed) continue;
          if (game.songTime < n.t - game.leadTime() - 0.1) continue;
          if (n.jump !== null && n.jump !== undefined) {
            if (n.lane > n.jump) continue; // partner entry draws the pair once
            const lanes = [n.lane, n.jump].sort((a, b) => a - b);
            const midX = (LANE_X[LANES[lanes[0]]] + LANE_X[LANES[lanes[1]]]) / 2;
            const pairType = (lanes[0] === 0 && lanes[1] === 3) ? 'LR' : 'UD';
            render.drawNote({ jump: pairType, x: midX, y: game.noteY(n) });
            continue;
          }
          render.drawNote({ lane: n.lane, x: LANE_X[LANES[n.lane]], y: game.noteY(n) });
        }
        // receptors
        for (let l = 0; l < 4; l++) render.drawReceptor(l, LANE_X[LANES[l]], flashUntil[l] || 0, popups.length ? popups[popups.length - 1].tier : null);
        // HUD
        render.drawHealth(game.health, game.songTime);
        render.drawScore(game.score);
        render.drawCombo(game.combo);
        for (const p of popups) render.drawJudgmentPopup(p.tier, p.age);
      } else if (game.phase === 'results') {
        render.drawBackdrop('results');
        const r = game.results || {};
        render.drawResults(game.score, r.grade, r.fullCombo, { ...game.counts, maxCombo: game.maxCombo });
      }
    } catch (e) { console.warn('draw error:', e); }

    requestAnimationFrame(frame);
  }

  window.__game = game;
  window.__render = render;
  window.__bootDone = true;
  requestAnimationFrame(frame);
}

boot().catch((err) => {
  console.error('boot failed:', err);
  window.__errs.push('boot: ' + String(err && err.message || err));
  const wrap = document.getElementById('stage-wrap');
  if (wrap) {
    const msg = document.createElement('div');
    msg.style.cssText = 'color:#0f0;font:14px monospace;position:absolute;top:8px;left:8px;z-index:10;';
    msg.textContent = 'boot failed: ' + err.message;
    wrap.appendChild(msg);
  }
});
