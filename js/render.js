// render.js — canvas renderer for DDR Fresh (see DESIGN.md "Presentation").
// Pure presentation: no game logic. Stage is 480x360, Scratch-style y-up
// coordinates (x in [-240,240], y in [-180,180]); canvasY = 180 - y.
// All images arrive as a map md5ext -> HTMLImageElement via the `assets` param.
//
// Costumes are bitmapResolution 2, so natural stage size = px / 2.

export const STAGE_W = 480;
export const STAGE_H = 360;

// ---- asset md5exts ----------------------------------------------------------
const IMG = {
  // backdrops (full-stage 960x720)
  backdropMenu:    'cf8a91db1d7dd87ff89a7887529c1583.png',
  backdropGame:    '93fd539ce299e2dbd9c2340f24e2a2cc.png',
  backdropResults: '532b888a89e21ca8f6e63abe7f58821f.png',
  backdropBlank:   'd45291f4c004685f627cb86a5f888143.png',
  backdropGate:    '7dde846dda8a7e88d213f902f77a65fa.png',
  // arrows (natural orientation points RIGHT/east; rotate per lane)
  note:            'f1d88593148a1f6d470b7ff4390bd2f8.png', // 124x124px -> 62x62u
  receptor:        '52ef5a65cd88cdd26ee963b779906fc5.png', // 124x124px -> 62x62u
  jumpLR:          'f64a1a10874be0ed9306055a461dc3ac.png', // 476x124px -> 238x62u
  jumpUD:          '78123f041cc4b17aa366ce9a727e0f23.png', // 248x124px -> 124x62u
  // receptor flash costumes (single arrow, natural points right)
  flashMarvelous:  '7efe1656958123d6c762a810ba2b2c1c.png',
  flashPerfect:    '97f834f81ddfd43d3b0bda8271b167f6.png',
  flashGreat:      '64724a1f8e5dea8b30e457cf3c49cbc5.png',
  // health gauge (centered layout, DESIGN.md)
  healthBar:       '16f6dbaeeb810b76b90ed8c832ddfc5a.png', // 406x42px  -> 203x21u
  healthBarFull:   'e8276d762ca78786e007f2c64fd35382.png', // rainbow variant
  healthFrame:     '019d7c7ce2d6340cda267612f8e128e3.png', // 482x116px -> 241x58u
  // judgment word art
  jMarvelous: '7457fa7f24a5de70ab417e115069dc20.png',
  jPerfect:   '0247cae48b46f3250dd987b70bb5c460.png',
  jGreat:     '12cb5f6a8c5e4a8316909507f8c3271c.png',
  jGood:      '950dad60235d817c84b1aef028a0e527.png',
  jBoo:       'a3c06bc2f8df38e2a6db48f703b8c4d2.png',
  jMiss:      'b289215cb3eaaebad0416f224a23943c.png',
  // score digits 0..9 (82x82px -> 41x41u) + commas
  digits: [
    'b1ac880337ba8360fdff1fc0711c1217.png', '44664f32ddb3517811d5ee2fcbfba2ce.png',
    '565b81d537ad8db853796977a5bcafbd.png', '5d142bfce411e39cc38a0d0a0f0f9c6b.png',
    'b2233ee743de4d2bf3cb9e00f6a4b39c.png', '494888ed28118469c8f3c6079c833ae5.png',
    'f2ec43a0b1f087dc15b97e183ce50601.png', 'f533971dd168421ca90211ad63992b39.png',
    '242012d3daaf37640bdd19cb9e1f6e73.png', 'efdb142194a4a56fb408cddea13d3b66.png',
  ],
  comma:      '5a97a0be471921f41ee52153750ba350.png', // 50x80px -> 25x40u
  comboLabel: '85f15102559f31593e9ab92bfc26f53b.png', // 214x66px -> 107x33u
  // menu difficulty svgs (480x360 -> 240x180u at size 1)
  menuEasy:   '053579acd07949d4f4d3932add8b7b2f.svg',
  menuMedium: 'bf88d267f4c6732ae0ed854c894b8816.svg',
  menuHard:   '03240dc31a122f2706855c8c0a473cd8.svg',
  // results
  resultsPanel: 'f920cab2b8d0606d31c055051f169f08.png', // 344x518px -> 172x259u
  grades: {
    AAAA: '32a0eceff9c929e8ef730fb943532b61.png',
    AAA:  '5b47424b49573fa11cc692fab34cda51.png',
    AA:   '2d9ca1046a0e30596e4ab8c8001e0172.png',
    A:    'e501692ccdfd170d3c2de51ae4e48a56.png',
    B:    '0814fc7d6e376b814d337b51aebf0381.png',
    C:    '0a3b99d12be579d60aa86e65a95cb88c.png',
    D:    '42cb462cfd05dfa97d1d009680265d5c.png',
    E:    '0a7cf4c24ea903cd8edf3828705d0278.png',
  },
  fc: {
    marvelous: '3f32a9c5c3e6d863bf3ed04a3c67b432.png',
    perfect:   '265bc9c25b83352df7470c511c2bb0d4.png',
    great:     'cd491924dc9caaa2c7be664af54bef43.png',
  },
};

const BACKDROPS = {
  menu:    IMG.backdropMenu,
  game:    IMG.backdropGame,
  results: IMG.backdropResults,
  blank:   IMG.backdropBlank,
  gate:    IMG.backdropGate,
};

// lane -> canvas rotation (deg, clockwise positive; arrow art points east)
const LANE_ROT = { left: 180, down: 90, up: -90, right: 0 };
const LANE_ROT_IDX = [180, 90, -90, 0]; // 0=left 1=down 2=up 3=right

const HIT_LINE_Y = -120;          // DESIGN.md: receptors sit at stage y = -120
const HEALTH_Y = 149;             // centered health gauge layout

const JUDGE_POP = {
  marvelous: { img: IMG.jMarvelous, x: 0, y: 30 },
  perfect:   { img: IMG.jPerfect,   x: 0, y: 30 },
  great:     { img: IMG.jGreat,     x: 0, y: 30 },
  good:      { img: IMG.jGood,      x: 0, y: 30 },
  boo:       { img: IMG.jBoo,       x: 0, y: 30 },
  miss:      { img: IMG.jMiss,      x: 0, y: -6 },
};
const FLASH_IMG = {
  marvelous: IMG.flashMarvelous,
  perfect:   IMG.flashPerfect,
  great:     IMG.flashGreat,
};
const POP_SETTLE = 0.03;   // s to shrink 125% -> 100%
const POP_HIDE = 0.5;      // s before fade-out starts
const POP_FADE = 0.15;     // fade-out duration

const SCORE_DIGIT_X = [-220, -190, -168, -146, -117, -95, -73]; // Score1000000..Score1
const SCORE_Y = -157;
const COMMA_POS = [{ x: -197, y: -162 }, { x: -123, y: -162 }];
const COMBO_DIGIT_X = [-165, -143, -121]; // Combo100, Combo10, Combo1
const COMBO_Y = -30;
const COMBO_LABEL_POS = { x: -45, y: -30 };

export class Renderer {
  constructor(canvas, assets) {
    this.canvas = canvas;
    // Render at device resolution (capped 2x) so the CSS-upscaled stage stays
    // crisp instead of blocky; all drawing code keeps using 480x360 units.
    const dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 2);
    this.dpr = dpr;
    canvas.width = STAGE_W * dpr;
    canvas.height = STAGE_H * dpr;
    this.ctx = canvas.getContext('2d');
    this.ctx.scale(dpr, dpr);
    this.assets = assets || {}; // md5ext -> HTMLImageElement
  }

  // ---- coordinate mapping ---------------------------------------------------
  cx(x) { return STAGE_W / 2 + x; }   // stage x -> canvas x
  cy(y) { return STAGE_H / 2 - y; }   // stage y (up) -> canvas y (down): canvasY = 180 - y

  img(key) {
    if (!key) return null;
    if (typeof key !== 'string') return key; // already an image element
    return this.assets[key] || this.assets[key.replace(/\.(png|svg)$/, '')] || null;
  }

  clear() {
    const ctx = this.ctx;
    ctx.save();
    ctx.clearRect(0, 0, STAGE_W, STAGE_H);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);
    ctx.restore();
  }

  // ---- primitives -----------------------------------------------------------
  // Full-stage backdrop image, stretched to 480x360. `name` is a backdrop alias
  // ('menu' | 'game' | 'results' | ...) or a raw md5ext.
  drawBackdrop(name) {
    const key = BACKDROPS[name] || name;
    // A custom assets/background.(png|jpg) replaces the playfield backdrop.
    const im = (name === 'game' && this.assets['background']) || this.img(key);
    if (im && im.complete && im.naturalWidth > 0) {
      this.ctx.drawImage(im, 0, 0, STAGE_W, STAGE_H);
    } else {
      this.ctx.fillStyle = '#000';
      this.ctx.fillRect(0, 0, STAGE_W, STAGE_H);
    }
  }

  // Generic centered sprite.
  // { img, x, y, size=1, alpha=1, hue=0, rotation=0 }
  // size is a multiplier on natural stage size (px/2); rotation in canvas deg (cw).
  drawSprite({ img, x = 0, y = 0, size = 1, alpha = 1, hue = 0, rotation = 0 }) {
    const im = this.img(img);
    if (!im || !im.complete || im.naturalWidth === 0) return;
    const w = (im.naturalWidth / 2) * size;
    const h = (im.naturalHeight / 2) * size;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    if (hue) ctx.filter = `hue-rotate(${hue}deg)`;
    ctx.translate(this.cx(x), this.cy(y));
    if (rotation) ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(im, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  // ---- gameplay -------------------------------------------------------------
  // note: { lane: 0..3 | 'left'|'down'|'up'|'right', x, y, jump?: 'LR'|'UD', alpha?, size? }
  drawNote(note) {
    if (!note) return;
    if (note.jump === 'LR' || note.jump === 'UD') {
      this.drawSprite({
        img: note.jump === 'LR' ? IMG.jumpLR : IMG.jumpUD,
        x: note.x, y: note.y, size: note.size || 1, alpha: note.alpha == null ? 1 : note.alpha,
      });
      return;
    }
    const rot = typeof note.lane === 'number' ? LANE_ROT_IDX[note.lane] : LANE_ROT[note.lane];
    this.drawSprite({
      img: IMG.note, x: note.x, y: note.y,
      size: note.size || 1, alpha: note.alpha == null ? 1 : note.alpha,
      rotation: rot || 0,
    });
  }

  // Receptor on the hit line (y = -120). flashUntil is a performance.now()-clock
  // timestamp in ms; while now < flashUntil the tier flash costume is shown.
  drawReceptor(lane, x, flashUntil, tier) {
    const rot = typeof lane === 'number' ? LANE_ROT_IDX[lane] : LANE_ROT[lane];
    const now = (typeof performance !== 'undefined' ? performance.now() : 0);
    const flashing = flashUntil && now < flashUntil && FLASH_IMG[tier];
    this.drawSprite({
      img: flashing ? FLASH_IMG[tier] : IMG.receptor,
      x, y: HIT_LINE_Y, size: 1, rotation: rot || 0,
    });
  }

  // Centered health gauge (DESIGN.md): fill bar at x = 2.03*health-203, y = 149;
  // black clip rect covering x in [-261,-101]; frame image on top (bar < clip < frame).
  // At health 100 the rainbow bar cycles hue with songTime.
  // Vector health bar: 241x10 px with a 5 px outline. The fill is painted
  // full-height first, then the stroke is centered on the edge — with H=10
  // that leaves a 5 px fill stripe between the 5 px outline bands.
  drawHealth(health, songTime) {
    const h = Math.max(0, Math.min(100, Number(health) || 0));
    const ctx = this.ctx;
    const W = 241, H = 10, T = 5;              // outer width/height, outline thickness (px)
    const yC = HEALTH_Y;                       // centered at (0, 149)
    const left = this.cx(-W / 2), top = this.cy(yC + H / 2);
    const full = h >= 100;
    const barImg = full ? this.img(IMG.healthBarFull) : this.img(IMG.healthBar);
    // fill across the full bar height, clipped to the health fraction
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.fillRect(left, top, W, H);
    const fw = W * (h / 100);
    if (barImg && barImg.complete && barImg.naturalWidth > 0 && fw > 0.5) {
      ctx.beginPath();
      ctx.rect(left, top, fw, H);
      ctx.clip();
      if (full) ctx.filter = `hue-rotate(${((songTime || 0) * 120) % 360}deg)`;
      ctx.drawImage(barImg, left, top, W, H);
    }
    ctx.restore();
    // outline (centered on the rect edge), opaque white
    ctx.save();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = T;
    ctx.strokeRect(left, top, W, H);
    ctx.restore();
  }

  // Judgment word popup. age = seconds since the judgment was shown.
  // Pops in at 125% -> 100% (half size), fades out after 0.5 s.
  drawJudgmentPopup(tier, age) {
    const j = JUDGE_POP[tier];
    if (!j || age == null || age < 0) return;
    if (age > POP_HIDE + POP_FADE) return;
    const scale = age < POP_SETTLE ? 1.25 - (age / POP_SETTLE) * 0.25 : 1.0;
    const alpha = age <= POP_HIDE ? 1 : Math.max(0, 1 - (age - POP_HIDE) / POP_FADE);
    this.drawSprite({ img: j.img, x: j.x, y: j.y, size: scale, alpha });
  }

  // 7-digit score with commas along the bottom edge.
  drawScore(score) {
    const s = String(Math.max(0, Math.floor(Number(score) || 0))).padStart(7, '0').slice(-7);
    for (let i = 0; i < 7; i++) {
      this.drawSprite({ img: IMG.digits[+s[i]], x: SCORE_DIGIT_X[i], y: SCORE_Y, size: 1 });
    }
    for (const c of COMMA_POS) this.drawSprite({ img: IMG.comma, x: c.x, y: c.y, size: 1 });
  }

  // Combo counter (hundreds/tens/ones + label), shown at combo >= 2.
  drawCombo(combo) {
    const c = Math.max(0, Math.floor(Number(combo) || 0));
    if (c < 2) return;
    const s = String(c).padStart(3, '0').slice(-3);
    for (let i = 0; i < 3; i++) {
      this.drawSprite({ img: IMG.digits[+s[i]], x: COMBO_DIGIT_X[i], y: COMBO_Y, size: 1 });
    }
    this.drawSprite({ img: IMG.comboLabel, x: COMBO_LABEL_POS.x, y: COMBO_LABEL_POS.y, size: 1 });
  }

  // ---- screens --------------------------------------------------------------
  // Menu: backdrop + full-stage difficulty svg ('Easy' | 'Medium' | 'Hard' or md5).
  drawMenu(difficulty) {
    this.drawBackdrop('menu');
    const svg = { Easy: IMG.menuEasy, Medium: IMG.menuMedium, Hard: IMG.menuHard }[difficulty] || difficulty;
    // svgs are 480x360 -> natural 240x180u; size 2 fills the stage
    this.drawSprite({ img: svg, x: 0, y: 0, size: 2 });
  }

  // Results screen: backdrop + panel + grade + FC badge + judgment counts.
  // counts: { marvelous, perfect, great, good, boo?, miss }
  drawResults(score, grade, fc, counts) {
    this.drawBackdrop('results');
    this.drawSprite({ img: IMG.resultsPanel, x: 0, y: -45, size: 1 });
    const g = IMG.grades[String(grade || '').toUpperCase()];
    if (g) this.drawSprite({ img: g, x: -118, y: 62, size: 1 });
    const f = fc && IMG.fc[String(fc).toLowerCase()];
    if (f) this.drawSprite({ img: f, x: -118, y: -20, size: 1 });
    if (counts) {
      // Fixed row per panel label — never filter, or the counts shift up a row.
      const rows = [
        counts.marvelous, counts.perfect, counts.great, counts.good,
        counts.almost, counts.miss, counts.maxCombo,
      ];
      const ctx = this.ctx;
      ctx.save();
      ctx.font = '16px monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#111';
      rows.forEach((v, i) => {
        const y = 56 - i * 22;
        ctx.fillText(String(v == null ? 0 : v), this.cx(80), this.cy(y));
      });
      ctx.restore();
    }
    this.drawScore(score);
  }
}

export default Renderer;
