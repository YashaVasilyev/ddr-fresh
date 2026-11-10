#!/usr/bin/env python3
"""Generate assets/chart.json for DDR Fresh from the "Destiny Eclipse" WAV.

Stdlib only (wave, struct, json, math, random, pathlib).

Pipeline:
  1. Decode PCM WAV -> mono float samples in [-1, 1].
  2. Frame energy: 512-sample windows, hop 256.
  3. Onset detection: positive energy flux (spectral-flux-lite) above an
     adaptive local-mean threshold, with peak picking + refractory period.
  4. Snap onsets to the 167 BPM grid (song starts at t=0) by quantizing
     each onset to the nearest 8th note (beat = 60/167 s).
  5. Skip onsets in the first 1.5 s; dedupe per 8th-note slot.
  6. Assign lanes with a seeded random pattern, with occasional jumps
     (two lanes at the same t, jump=1). Cap at ~250 notes.
  7. Write assets/chart.json: {"bpm", "duration", "notes": [{t, lane, jump}]}.
"""

import json
import random
import struct
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WAV_PATH = ROOT / "assets" / "55bc1042af448fc5b7a82117c931e379.wav"
OUT_PATH = ROOT / "assets" / "chart.json"

BPM = 167
BEAT = 60.0 / BPM            # seconds per beat
EIGHTH = BEAT / 2.0          # seconds per 8th note
WINDOW = 512                 # energy window size (samples)
HOP = 256                    # energy hop (samples)
SKIP_INTRO = 1.5             # ignore onsets before this time (s)
FLUX_LOCAL = 20              # frames each side for adaptive threshold mean
FLUX_MULT = 1.5              # adaptive threshold multiplier
MIN_GAP = EIGHTH * 0.5       # refractory period between raw onsets (s)
JUMP_PROB = 0.08             # probability a slot becomes a 2-lane jump
MAX_NOTES = 250              # cap on total notes (jump pairs count as 2)
SEED = 1670167               # seeded RNG for reproducible lane pattern


def read_mono_float(path):
    """Decode a PCM WAV into (mono float samples, sample rate)."""
    with wave.open(str(path), "rb") as w:
        nch = w.getnchannels()
        sw = w.getsampwidth()
        sr = w.getframerate()
        nframes = w.getnframes()
        raw = w.readframes(nframes)
    if sw == 2:
        count = len(raw) // 2
        ints = struct.unpack("<%dh" % count, raw[: count * 2])
        scale = 32768.0
    elif sw == 4:
        count = len(raw) // 4
        ints = struct.unpack("<%di" % count, raw[: count * 4])
        scale = 2147483648.0
    elif sw == 1:
        ints = [b - 128 for b in raw]
        scale = 128.0
    else:
        raise ValueError("unsupported sample width: %d" % sw)
    if nch == 1:
        mono = [s / scale for s in ints]
    else:
        mono = [
            sum(ints[i : i + nch]) / (nch * scale)
            for i in range(0, len(ints) - nch + 1, nch)
        ]
    return mono, sr


def frame_energies(samples, window, hop):
    """Mean-square energy per frame."""
    energies = []
    n = len(samples)
    for start in range(0, n - window + 1, hop):
        acc = 0.0
        for i in range(start, start + window):
            x = samples[i]
            acc += x * x
        energies.append(acc / window)
    return energies


def detect_onsets(energies, window, hop, sr):
    """Energy-flux onset detection with adaptive threshold.

    Returns a list of (time_seconds, strength) sorted by time.
    """
    n = len(energies)
    flux = [0.0] * n
    for i in range(1, n):
        d = energies[i] - energies[i - 1]
        flux[i] = d if d > 0.0 else 0.0

    raw = []
    for i in range(1, n - 1):
        # local peak
        if not (flux[i] >= flux[i - 1] and flux[i] > flux[i + 1]):
            continue
        # adaptive threshold: local mean around i
        lo = max(0, i - FLUX_LOCAL)
        hi = min(n, i + FLUX_LOCAL + 1)
        mean = sum(flux[lo:hi]) / (hi - lo)
        if flux[i] > mean * FLUX_MULT + 1e-12:
            t = (i * hop + window / 2.0) / sr  # window center time
            raw.append((t, flux[i]))

    # refractory: keep the strongest onset within each MIN_GAP window
    onsets = []
    for t, strength in raw:
        if onsets and t - onsets[-1][0] < MIN_GAP:
            if strength > onsets[-1][1]:
                onsets[-1] = (t, strength)
            continue
        onsets.append((t, strength))
    return onsets


def quantize_to_grid(t):
    """Quantize a time to the nearest 8th note of the 167 BPM grid."""
    return round(t / EIGHTH) * EIGHTH


def assign_lanes(times, rng):
    """Seeded random lane pattern with occasional 2-lane jumps."""
    notes = []
    for t in times:
        tq = round(t, 4)
        if rng.random() < JUMP_PROB:
            # Jump pairs only as left+right (0,3) or down+up (1,2) so they match
            # the wide jump-note art assets (jumpLR / jumpUD).
            a, b = (0, 3) if rng.random() < 0.5 else (1, 2)
            notes.append({"t": tq, "lane": a, "jump": 1})
            notes.append({"t": tq, "lane": b, "jump": 1})
        else:
            notes.append({"t": tq, "lane": rng.randrange(4), "jump": 0})
    return notes


def thin_to_cap(notes, cap):
    """Drop notes (closest temporal neighbor first) until <= cap.

    Jump pairs are removed together so the jump ratio stays sane.
    """
    notes = sorted(notes, key=lambda n: (n["t"], n["lane"]))
    while len(notes) > cap:
        best_i = -1
        best_d = None
        for i, note in enumerate(notes):
            # nearest neighbor at a *different* time (skip jump partner)
            d = None
            for j in range(len(notes)):
                if j == i or notes[j]["t"] == note["t"]:
                    continue
                nd = abs(note["t"] - notes[j]["t"])
                if d is None or nd < d:
                    d = nd
            if d is not None and (best_d is None or d < best_d):
                best_d = d
                best_i = i
        if best_i < 0:
            break
        t = notes[best_i]["t"]
        if notes[best_i]["jump"]:
            # remove the whole jump pair at this time
            notes = [n for n in notes if not (n["jump"] and n["t"] == t)]
        else:
            del notes[best_i]
    return notes


def main():
    samples, sr = read_mono_float(WAV_PATH)
    duration = len(samples) / sr
    print("samples=%d sr=%d duration=%.3fs" % (len(samples), sr, duration))

    energies = frame_energies(samples, WINDOW, HOP)
    onsets = detect_onsets(energies, WINDOW, HOP, sr)
    print("raw onsets detected: %d" % len(onsets))

    # skip intro, snap to 8th-note grid, dedupe per slot (keep strongest)
    slots = {}
    for t, strength in onsets:
        if t < SKIP_INTRO:
            continue
        q = quantize_to_grid(t)
        if q < SKIP_INTRO:
            continue
        if q not in slots or strength > slots[q]:
            slots[q] = strength
    times = sorted(slots)
    print("quantized 8th-note slots: %d (span %.2fs .. %.2fs)"
          % (len(times), times[0], times[-1]))

    rng = random.Random(SEED)
    notes = assign_lanes(times, rng)
    print("notes before cap: %d" % len(notes))
    notes = thin_to_cap(notes, MAX_NOTES)
    notes.sort(key=lambda n: (n["t"], n["lane"]))
    print("notes after cap: %d (jumps: %d)"
          % (len(notes), sum(1 for n in notes if n["jump"])))

    chart = {"bpm": BPM, "duration": round(duration, 4), "notes": notes}
    OUT_PATH.write_text(json.dumps(chart, separators=(",", ":")))
    print("wrote %s (%d bytes)" % (OUT_PATH, OUT_PATH.stat().st_size))


if __name__ == "__main__":
    main()
