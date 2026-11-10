// audio.js — WebAudio playback for DDR Fresh (see DESIGN.md "Presentation").
// Decodes the song + all sfx/voices up front in init(), then:
//   playSong() / getSongTime()  — song transport with a seconds clock
//   play(name)                  — one-shot sfx / grade voice
//   stopAll()                   — silence everything
// baseUrl defaults to 'assets/'.

const BASE_URL = 'assets/';

// name -> file in assets/ (md5ext from project.json)
const FILES = {
  song:          '55bc1042af448fc5b7a82117c931e379.wav', // "Destiny Eclipse"
  StageFail:     '22875637bbb23dfea9382d4fe901054c.mp3',
  cleared:       '714de24da7f04f5ba8cca39eefe63e9f.mp3',
  Ready:         '3666857e532eb909047ba35cfcc125bc.mp3',
  OkayHereWeGo:  '343f5a0de51e1bd960fa12d14c8e11d9.mp3',
  CARD_0557:     'd6563bca03d30b28e55ac1f663aaf7b5.mp3',
  CARD_0222:     '86b6507d7ddf09c5dd21bb106f618514.mp3',
  pop:           '83a9787d4cb6f3b7632b4ddfebf74367.wav',
  // grade voices (Voice (80)/(127)/(128)/(129)/(130)/(131))
  AAAA: '196124ade2458faf36f71607ecd0e6b1.mp3', // Voice (80)
  AAA:  '196124ade2458faf36f71607ecd0e6b1.mp3', // Voice (80)
  AA:   '7b6c55936394a2777500326983872581.mp3', // Voice (127)
  A:    '5f35237cc56ab14f0b984ba0e3437636.mp3', // Voice (129)
  B:    '0d3e259ac5bd2c2f82a1edb823a08f28.mp3', // Voice (130)
  C:    '03101601304b97f6445728f528ef1168.mp3', // Voice (128)
  D:    '360e784e276cf109ea8feb7dfc1f2bff.mp3', // Voice (131)
  E:    '03101601304b97f6445728f528ef1168.mp3', // reuse Voice (128)
};

// Decode a RIFF/WAVE PCM buffer manually into an AudioBuffer. Some browsers
// (notably Safari) reject certain PCM WAVs in decodeAudioData, so WAVs are
// decoded by hand instead. Supports 8/16/24/32-bit int PCM and 32-bit float.
function decodeWavPcm(ctx, ab) {
  const dv = new DataView(ab);
  const readU32 = (o) => dv.getUint32(o, true);
  const readU16 = (o) => dv.getUint16(o, true);
  if (dv.getUint32(0, false) !== 0x52494646 || dv.getUint32(8, false) !== 0x57415645) { // 'RIFF' 'WAVE'
    throw new Error('not a RIFF/WAVE file');
  }
  let fmt = null, dataOff = -1, dataLen = 0;
  for (let o = 12; o + 8 <= ab.byteLength; o += 8 + readU32(o + 4)) {
    const id = dv.getUint32(o, false);
    if (id === 0x666d7420) { // 'fmt '
      fmt = {
        format: readU16(o + 8),
        channels: readU16(o + 10),
        sampleRate: readU32(o + 12),
        bits: readU16(o + 22),
      };
    } else if (id === 0x64617461) { // 'data'
      dataOff = o + 8;
      dataLen = Math.min(readU32(o + 4), ab.byteLength - dataOff);
    }
  }
  if (!fmt || dataOff < 0) throw new Error('missing fmt/data chunk');
  const bytesPerSample = fmt.bits / 8;
  const frames = Math.floor(dataLen / (bytesPerSample * fmt.channels));
  const buf = ctx.createBuffer(fmt.channels, frames, fmt.sampleRate);
  for (let ch = 0; ch < fmt.channels; ch++) {
    const out = buf.getChannelData(ch);
    for (let i = 0; i < frames; i++) {
      const o = dataOff + (i * fmt.channels + ch) * bytesPerSample;
      if (fmt.format === 3 && fmt.bits === 32) out[i] = dv.getFloat32(o, true);
      else if (fmt.bits === 8) out[i] = (dv.getUint8(o) - 128) / 128;
      else if (fmt.bits === 16) out[i] = dv.getInt16(o, true) / 32768;
      else if (fmt.bits === 24) out[i] = (dv.getUint8(o) | (dv.getUint8(o + 1) << 8) | (dv.getInt8(o + 2) << 16)) / 8388608;
      else if (fmt.bits === 32) out[i] = dv.getInt32(o, true) / 2147483648;
      else throw new Error('unsupported bit depth ' + fmt.bits);
    }
  }
  return buf;
}

export class AudioEngine {
  constructor(baseUrl = BASE_URL) {
    this.baseUrl = baseUrl;
    this.ctx = null;
    this.buffers = {};        // name -> AudioBuffer
    this.songSource = null;   // current song BufferSource
    this.songStartCtx = 0;    // ctx.currentTime when the song (offset 0) started
    this.songPlaying = false;
    this.active = [];         // live one-shot sources (for stopAll)
  }

  // Create/resume the AudioContext and decode every file in FILES.
  async init() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') {
      // Never block boot on the autoplay policy: resume() may stay pending
      // until a user gesture, so race it with a short timeout.
      try { await Promise.race([this.ctx.resume(), new Promise((r) => setTimeout(r, 500))]); } catch (e) { /* autoplay policy */ }
    }
    await Promise.all(Object.entries(FILES).map(async ([name, file]) => {
      if (this.buffers[name]) return;
      const res = await fetch(this.baseUrl + file);
      if (!res.ok) throw new Error(name + ': HTTP ' + res.status + ' for ' + file);
      const ab = await res.arrayBuffer();
      try {
        this.buffers[name] = /\.wav$/i.test(file)
          ? decodeWavPcm(this.ctx, ab)
          : await this.ctx.decodeAudioData(ab);
      } catch (e) {
        // The song is essential; a broken sfx/voice must never kill boot.
        if (name === 'song') {
          throw new Error('Decoding failed for ' + name + ' (' + file + '): ' + (e && e.message || e));
        }
        console.warn('audio: skipping undecodable', name, file, e);
      }
    }));
    return this;
  }

  async _ensure() {
    if (!this.ctx) await this.init();
    if (this.ctx.state === 'suspended') {
      try { await Promise.race([this.ctx.resume(), new Promise((r) => setTimeout(r, 300))]); } catch (e) { /* ignore */ }
    }
  }

  _track(src) {
    this.active.push(src);
    src.onended = () => {
      const i = this.active.indexOf(src);
      if (i >= 0) this.active.splice(i, 1);
      if (src === this.songSource) this.songPlaying = false;
    };
    return src;
  }

  // Start the song from `offset` seconds. Returns the BufferSource.
  async playSong(offset = 0) {
    await this._ensure();
    this._stopSong();
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers.song;
    src.connect(this.ctx.destination);
    src.start(0, Math.max(0, offset || 0));
    this._track(src);
    this.songSource = src;
    this.songStartCtx = this.ctx.currentTime - (offset || 0);
    this.songPlaying = true;
    return src;
  }

  // Seconds into the song (0 before the first playSong). The clock keeps
  // running after the source ends so gameplay never snaps back to 0.
  getSongTime() {
    if (!this.ctx || !this.songSource) return 0;
    return this.ctx.currentTime - this.songStartCtx;
  }

  // One-shot sfx/voice by name (see FILES). Returns the BufferSource or null.
  async play(name) {
    await this._ensure();
    const buf = this.buffers[name];
    if (!buf) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.ctx.destination);
    src.start();
    this._track(src);
    return src;
  }

  _stopSong() {
    if (this.songSource) {
      try { this.songSource.onended = null; this.songSource.stop(); } catch (e) { /* already stopped */ }
      this.songSource = null;
    }
    this.songPlaying = false;
  }

  // Stop the song and every live one-shot.
  stopAll() {
    this._stopSong();
    for (const src of this.active.slice()) {
      try { src.onended = null; src.stop(); } catch (e) { /* already stopped */ }
    }
    this.active.length = 0;
  }
}

// Shared default instance for convenience.
export const audio = new AudioEngine();
export default audio;
