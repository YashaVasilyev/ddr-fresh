// assets.js — manifest mapping asset files (md5ext names in assets/) to logical
// names, plus loadAssets() which returns { images: {name: HTMLImageElement},
// audio: {name: HTMLAudioElement} }. Every manifest entry is verified on disk.

const BASE = 'assets/';

// md5ext file -> logical name. Kind inferred from extension.
export const MANIFEST = {
  // ---- Backdrops (stage costumes, 960x720 = 2x stage) ----
  '93fd539ce299e2dbd9c2340f24e2a2cc.png': 'backdrop-game',
  'cf8a91db1d7dd87ff89a7887529c1583.png': 'backdrop-menu',
  '532b888a89e21ca8f6e63abe7f58821f.png': 'backdrop-results',
  'd45291f4c004685f627cb86a5f888143.png': 'backdrop-blank',

  // ---- Song + stage sounds ----
  '55bc1042af448fc5b7a82117c931e379.wav': 'song',            // "Destiny Eclipse" (167 BPM)
  '83a9787d4cb6f3b7632b4ddfebf74367.wav': 'pop',
  '22875637bbb23dfea9382d4fe901054c.mp3': 'stage-fail',      // fail sting
  '714de24da7f04f5ba8cca39eefe63e9f.mp3': 'cleared-cheer',

  // ---- Arrows: receptors, notes, flashes, jumps ----
  '52ef5a65cd88cdd26ee963b779906fc5.png': 'receptor-note',   // template regarrownote
  'f1d88593148a1f6d470b7ff4390bd2f8.png': 'note-arrow',      // falling arrow notes
  '7efe1656958123d6c762a810ba2b2c1c.png': 'flash-marvelous', // receptor flashes
  '97f834f81ddfd43d3b0bda8271b167f6.png': 'flash-perfect',
  '64724a1f8e5dea8b30e457cf3c49cbc5.png': 'flash-great',
  'f64a1a10874be0ed9306055a461dc3ac.png': 'note-jump-lr',    // 476x124, spans 2 lanes
  '78123f041cc4b17aa366ce9a727e0f23.png': 'note-jump-ud',    // 248x124

  // ---- Judgment word art (png word + alt + svg list per tier) ----
  '7457fa7f24a5de70ab417e115069dc20.png': 'judge-marvelous',
  '9ff4981fe78ca0f92b15e200c1b4ce44.png': 'judge-marvelous-alt',
  '01272a00c8efb7fe8dfc13b9f0d14c61.svg': 'judge-marvelous-list',
  '0247cae48b46f3250dd987b70bb5c460.png': 'judge-perfect',
  '1d960b29ae9959fe3ff12db454673e7b.svg': 'judge-perfect-list',
  '12cb5f6a8c5e4a8316909507f8c3271c.png': 'judge-great',
  '262fc3ba296870b91a1733f733e41ab7.png': 'judge-great-alt',
  'b7facd8a9d5e8f1d715e253eaa9bdecf.svg': 'judge-great-list',
  '950dad60235d817c84b1aef028a0e527.png': 'judge-good',
  '98c036e46fd6d2caa3452177f1307be0.svg': 'judge-good-list',
  'a3c06bc2f8df38e2a6db48f703b8c4d2.png': 'judge-boo',
  'f27a7b77aefbfe3998a92e3bf56d0db4.png': 'judge-boo-alt',
  'f6af60a2ef8f200b47321b145c11be5b.svg': 'judge-boo-list',
  'b289215cb3eaaebad0416f224a23943c.png': 'judge-miss',
  '20c1bf394433be766532f2b08ed83523.png': 'judge-miss-alt',
  '670cb497459ddc7170cfd344200c0be7.svg': 'judge-miss-list',

  // ---- Score / combo digits, comma, combo label + dot ----
  'b1ac880337ba8360fdff1fc0711c1217.png': 'digit-0',
  '44664f32ddb3517811d5ee2fcbfba2ce.png': 'digit-1',
  '565b81d537ad8db853796977a5bcafbd.png': 'digit-2',
  '5d142bfce411e39cc38a0d0a0f9c6b.png': 'digit-3',
  'b2233ee743de4d2bf3cb9e00f6a4b39c.png': 'digit-4',
  '494888ed28118469c8f3c6079c833ae5.png': 'digit-5',
  'f2ec43a0b1f087dc15b97e183ce50601.png': 'digit-6',
  'f533971dd168421ca90211ad63992b39.png': 'digit-7',
  '242012d3daaf37640bdd19cb9e1f6e73.png': 'digit-8',
  'efdb142194a4a56fb408cddea13d3b66.png': 'digit-9',
  '5a97a0be471921f41ee52153750ba350.png': 'comma',
  '85f15102559f31593e9ab92bfc26f53b.png': 'combo-label',
  '8e34036e933c914f6b8d167f38b6a77e.png': 'combo-dot',

  // ---- Health bar: fill, rainbow (full), frame, black clip, blocker ----
  '16f6dbaeeb810b76b90ed8c832ddfc5a.png': 'health-bar',
  'e8276d762ca78786e007f2c64fd35382.png': 'health-bar-rainbow',
  '019d7c7ce2d6340cda267612f8e128e3.png': 'health-frame',
  '4ddf9b260f581c14a655d1146908463b.png': 'health-clip',   // covers x in [-261, -101]
  'd79f9b5b91aad4a313040d13c68c69e7.png': 'health-blocker',

  // ---- Menu difficulty svgs ----
  '053579acd07949d4f4d3932add8b7b2f.svg': 'menu-easy',
  'bf88d267f4c6732ae0ed854c894b8816.svg': 'menu-medium',
  '03240dc31a122f2706855c8c0a473cd8.svg': 'menu-hard',

  // ---- Buttons ----
  'ac9f0a4dda016b327d3482e1626dd1b0.png': 'button-ok',
  '2cf69af279563e8287a955f17886c940.png': 'button-play',
  'b27ed24fc84dd1fffa75b2d64548e262.png': 'button-stages',

  // ---- Results: panel, grade costumes, full-combo badges ----
  'f920cab2b8d0606d31c055051f169f08.png': 'results-panel',
  '0a7cf4c24ea903cd8edf3828705d0278.png': 'grade-e',
  '42cb462cfd05dfa97d1d009680265d5c.png': 'grade-d',
  '0a3b99d12be579d60aa86e65a95cb88c.png': 'grade-c',
  '0814fc7d6e376b814d337b51aebf0381.png': 'grade-b',
  'e501692ccdfd170d3c2de51ae4e48a56.png': 'grade-a',
  '2d9ca1046a0e30596e4ab8c8001e0172.png': 'grade-aa',
  '5b47424b49573fa11cc692fab34cda51.png': 'grade-aaa',
  '32a0eceff9c929e8ef730fb943532b61.png': 'grade-aaaa',
  '3f32a9c5c3e6d863bf3ed04a3c67b432.png': 'fullcombo-marvelous',
  '265bc9c25b83352df7470c511c2bb0d4.png': 'fullcombo-perfect',
  'cd491924dc9caaa2c7be664af54bef43.png': 'fullcombo-great',

  // ---- Flow art: doors, gate, ready/go/fail/clear messages ----
  '5bd860183c69410da225a2eb667e3fd3.png': 'door',
  '7dde846dda8a7e88d213f902f77a65fa.png': 'gate',
  'd18dd7c934c3e466b91591810edf3dbe.png': 'msg-ready',
  '46026161c104af52b072483179aa2149.png': 'msg-go',
  'de7a272afe932f922e791f4dd995519a.png': 'msg-fail',
  '0cbe64041aee1d31db8e306b0b97bc00.png': 'msg-clear',

  // ---- SFX: voices / stings (mp3) ----
  '3666857e532eb909047ba35cfcc125bc.mp3': 'voice-ready',
  '343f5a0de51e1bd960fa12d14c8e11d9.mp3': 'voice-go',
  'd6563bca03d30b28e55ac1f663aaf7b5.mp3': 'card-0557',       // button click
  '86b6507d7ddf09c5dd21bb106f618514.mp3': 'card-0222',       // grade card sting
  '196124ade2458faf36f71607ecd0e6b1.mp3': 'voice-80',        // AAAA / AAA grade voice
  '7b6c55936394a2777500326983872581.mp3': 'voice-127',       // AA grade voice
  '03101601304b97f6445728f528ef1168.mp3': 'voice-128',       // C grade voice
  '5f35237cc56ab14f0b984ba0e3437636.mp3': 'voice-129',       // A grade voice
  '0d3e259ac5bd2c2f82a1edb823a08f28.mp3': 'voice-130',       // B grade voice
  '360e784e276cf109ea8feb7dfc1f2bff.mp3': 'voice-131',       // D grade voice
};

const IMAGE_EXT = /\.(png|svg|jpg|jpeg|gif)$/i;
const AUDIO_EXT = /\.(wav|mp3|ogg)$/i;

// Load every manifest entry.
// Returns { images: {name: HTMLImageElement}, audio: {name: HTMLAudioElement} }.
// Missing/failed entries become null so boot never hard-crashes.
export async function loadAssets(onProgress) {
  const images = {};
  const audio = {};
  const entries = Object.entries(MANIFEST);
  let done = 0;
  const tick = () => {
    done++;
    if (onProgress) onProgress(done, entries.length);
  };

  const jobs = entries.map(([file, name]) => {
    const url = BASE + file;
    if (AUDIO_EXT.test(file)) {
      return new Promise((resolve) => {
        const a = new Audio();
        a.preload = 'auto';
        const finish = (ok) => {
          if (audio[name] === undefined) {
            audio[name] = ok ? a : null;
            tick();
            resolve();
          }
        };
        a.addEventListener('canplaythrough', () => finish(true), { once: true });
        a.addEventListener('error', () => finish(false), { once: true });
        a.src = url;
        // Don't block boot forever on slow audio:
        setTimeout(() => finish(true), 8000);
      });
    }
    // image (default)
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { images[name] = img; tick(); resolve(); };
      img.onerror = () => { images[name] = null; tick(); resolve(); };
      img.src = url;
    });
  });

  await Promise.all(jobs);

  // Optional custom playfield background: assets/background.png or .jpg.
  // Not part of the manifest — absent file is fine.
  for (const f of ['background.png', 'background.jpg']) {
    const ok = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = BASE + f;
    });
    if (ok) { images['background'] = ok; break; }
  }
  return { images, audio };
}

export const assetUrl = (file) => BASE + file;
