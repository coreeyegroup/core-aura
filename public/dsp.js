export const patterns = {
  yaman: [
    [-1, 0.8],
    [2, 0.55],
    [4, 1.75],
    [2, 0.55],
    [0, 1.1],
    [null, 0.45],
    [-1, 0.55],
    [2, 0.5],
    [4, 0.9],
    [6, 0.8],
    [7, 1.25],
    [null, 0.45],
    [6, 0.6],
    [9, 0.6],
    [11, 1.3],
    [12, 0.9],
    [11, 1.1],
    [null, 0.45],
    [9, 0.55],
    [7, 0.85],
    [6, 0.6],
    [4, 1.4],
    [2, 0.65],
    [0, 1.75],
    [null, 0.8],
  ],
  mohanam: [
    [0, 0.8],
    [2, 0.5],
    [4, 1.2],
    [7, 0.6],
    [9, 1],
    [7, 0.5],
    [4, 1],
    [null, 0.5],
    [4, 0.5],
    [2, 0.6],
    [0, 1.3],
    [2, 0.5],
    [4, 1.1],
    [null, 0.5],
    [7, 0.5],
    [9, 0.6],
    [12, 1.2],
    [9, 0.6],
    [7, 0.7],
    [4, 1.2],
    [null, 0.5],
    [9, 0.5],
    [7, 0.7],
    [4, 0.8],
    [2, 0.65],
    [0, 1.5],
    [null, 0.8],
  ],
};
export function createState(config) {
  return {
    ...config,
    phase: 0,
    time: 0,
    currentHz: config.hz,
    note: 0,
    noteAt: 0,
    fade: 0,
    status: "playing",
  };
}
function partials(phase, hz, rate, modes, age = 0) {
  let result = 0;
  for (const [ratio, level, decay] of modes) {
    if (hz * ratio < rate * 0.45)
      result += Math.sin(phase * ratio) * level * Math.exp(-age / decay);
  }
  return result;
}
export function sample(state, rate) {
  const dt = 1 / rate;
  if (state.status === "paused" || state.status === "ended") return 0;
  const stopping = state.status === "stopping";
  const pausing = state.status === "pausing";
  state.fade += (stopping || pausing ? -1 : 1) / (rate * 0.03);
  state.fade = Math.max(0, Math.min(1, state.fade));
  if (pausing && state.fade === 0) {
    state.status = "paused";
    return 0;
  }
  if (stopping && state.fade === 0) {
    state.status = "ended";
    return 0;
  }
  if (state.time >= state.seconds) {
    state.status = "stopping";
    return 0;
  }
  const s = state.sound;
  let target = state.hz,
    breath = 1;
  if (patterns[s]) {
    const pattern = patterns[s];
    while (state.time - state.noteAt >= pattern[state.note][1]) {
      state.noteAt += pattern[state.note][1];
      state.note = (state.note + 1) % pattern.length;
    }
    const [step, duration] = pattern[state.note];
    const age = state.time - state.noteAt;
    breath =
      step === null ? 0 : Math.min(1, age / 0.06, (duration - age) / 0.08);
    target = state.hz * 2 ** ((step ?? 0) / 12);
  }
  state.currentHz += (target - state.currentHz) * Math.min(1, dt / 0.025);
  state.phase =
    (state.phase + 2 * Math.PI * state.currentHz * dt) % (2 * Math.PI * 10000);
  const phase = state.phase;
  let value;
  if (s === "sine") value = Math.sin(phase);
  else if (s === "triangle") {
    value = 0;
    for (let n = 1; n <= 15 && n * target < rate * 0.45; n += 2)
      value +=
        ((8 / (Math.PI * Math.PI)) *
          (-1) ** ((n - 1) / 2) *
          Math.sin(n * phase)) /
        (n * n);
  } else if (s === "flute" || patterns[s]) {
    const vibrato = 0.09 * Math.sin(2 * Math.PI * 4.8 * state.time);
    value =
      partials(phase + vibrato, target, rate, [
        [1, 0.76, Infinity],
        [2, 0.15, Infinity],
        [3, 0.065, Infinity],
      ]) * breath;
  } else if (s === "tanpura") {
    value = 0;
    const ratios = [0.75, 1, 1, 0.5];
    for (let i = 0; i < 4; i++) {
      const age = (state.time - i * 0.85 + 3.4) % 3.4;
      const edge = Math.min(1, age / 0.018, (3.4 - age) / 0.08);
      value +=
        0.24 *
        edge *
        Math.exp(-age * 1.7) *
        partials(phase * ratios[i], target * ratios[i], rate, [
          [1, 1, Infinity],
          [2, 0.38, Infinity],
          [3, 0.2, Infinity],
        ]);
    }
  } else {
    const period = s === "drum" ? 0.9 : s === "bell" ? 3 : 5;
    const age = state.time % period;
    const edge = Math.min(
      1,
      age / (s === "bowl" ? 0.03 : 0.005),
      (period - age) / 0.05,
    );
    const modes =
      s === "drum"
        ? [
            [1, 0.62, 0.19],
            [1.5, 0.23, 0.08],
            [2.38, 0.15, 0.035],
          ]
        : s === "bell"
          ? [
              [1, 0.53, 0.82],
              [2.4, 0.28, 0.57],
              [3.01, 0.12, 0.42],
              [4.18, 0.07, 0.23],
            ]
          : [
              [1, 0.48, 2.2],
              [1.006, 0.29, 2.1],
              [2.71, 0.16, 1.1],
              [4.12, 0.07, 0.75],
            ];
    // Strike phase restarts with each hit. Rhythm remains independent of tuning.
    value =
      partials(2 * Math.PI * state.currentHz * age, target, rate, modes, age) *
      edge;
  }
  const tail = Math.min(1, Math.max(0, (state.seconds - state.time) / 0.06));
  state.time += dt;
  return value * state.fade * tail;
}
