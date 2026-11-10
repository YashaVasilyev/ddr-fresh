// chart.js — loads assets/chart.json and provides difficulty filtering.
// Chart format: { bpm, duration, notes: [{ t, lane, jump }] }

export async function loadChart() {
  const res = await fetch('assets/chart.json');
  if (!res.ok) {
    throw new Error('failed to load assets/chart.json: HTTP ' + res.status);
  }
  const data = await res.json();
  const notes = data.notes.map((n) => ({
    t: Number(n.t),
    lane: n.lane & 3,
    jump: n.jump ? 1 : 0,
  }));
  const chart = {
    bpm: Number(data.bpm),
    duration: Number(data.duration),
    notes,
    spawnList: spawnList(notes),
  };
  return chart;
}

// Density rules per DESIGN.md:
//   Easy   — every 2nd note, no jumps
//   Medium — all non-jump notes
//   Hard   — all notes including jumps
export function filterDifficulty(notes, difficulty) {
  const sorted = [...notes].sort((a, b) => a.t - b.t);
  if (difficulty === 'Easy') {
    return sorted
      .filter((n) => !n.jump)
      .filter((_, i) => i % 2 === 0)
      .map((n) => ({ t: n.t, lane: n.lane, jump: 0 }));
  }
  if (difficulty === 'Medium') {
    return sorted
      .filter((n) => !n.jump)
      .map((n) => ({ t: n.t, lane: n.lane, jump: 0 }));
  }
  // Hard (and any unknown label): full chart including jumps
  return sorted.map((n) => ({ t: n.t, lane: n.lane, jump: n.jump ? 1 : 0 }));
}

// Notes sorted by hit time — the order the game spawns them in.
export function spawnList(notes) {
  return [...notes].sort((a, b) => a.t - b.t);
}
