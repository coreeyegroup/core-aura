import { createState, sample } from "./dsp.js";
export function* renderWav(channels, master, seconds, rate = 44100) {
  if (
    !Array.isArray(channels) ||
    channels.length < 1 ||
    channels.length > 12 ||
    !Number.isFinite(master) ||
    master < 0 ||
    master > 1 ||
    !Number.isInteger(seconds) ||
    seconds < 1 ||
    seconds > 600 ||
    ![44100, 48000].includes(rate)
  )
    throw Error("Unsupported export");
  const frames = seconds * rate;
  const buffer = new ArrayBuffer(44 + frames * 2);
  const view = new DataView(buffer);
  const text = (offset, s) =>
    [...s].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, buffer.byteLength - 8, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, frames * 2, true);
  const states = channels.map((c) =>
    createState({ ...c, seconds: Math.min(c.seconds, seconds) }),
  );
  for (let start = 0; start < frames; start += 8192) {
    // Match the live mixer's normalization at each rendering block.
    const weight = states.reduce(
      (n, c) => n + (c.muted || c.status === "ended" ? 0 : c.volume),
      0,
    );
    const scale = (master * 0.65) / Math.max(1, weight);
    for (let i = start; i < Math.min(start + 8192, frames); i++) {
      let sum = 0;
      for (const state of states) {
        const value = sample(state, rate);
        if (!state.muted) sum += value * state.volume;
      }
      const value = Math.max(-0.95, Math.min(0.95, sum * scale));
      view.setInt16(44 + i * 2, Math.round(value * 32767), true);
    }
    yield Math.min(
      100,
      Math.round((Math.min(start + 8192, frames) / frames) * 100),
    );
  }
  return buffer;
}
