import { createGroupVoice, createState, sample } from "./dsp.js";
export function* renderWav(channels, master, seconds, rate = 44100, sequenceGap, additionalLayers = [], balancedGroup = false) {
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
    ![44100, 48000].includes(rate) ||
    (sequenceGap !== undefined && (!Number.isFinite(sequenceGap) || sequenceGap < 0 || sequenceGap > 30))
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
  const states = [], starts = [];
  let offset = 0;
  for (const [index, channel] of channels.entries()) {
    const layers = [channel, ...[channel.accompaniment?.tone, channel.accompaniment?.ambience]
      .flatMap((source, index) => source ? [{ ...source, focus: index === 1, muted: channel.muted }] : [])];
    for (const [layerIndex, layer] of layers.entries()) {
      const config = { ...layer, seconds: Math.min(channel.seconds, seconds) };
      states.push(balancedGroup && channels.length > 1 && layerIndex === 0
        ? createGroupVoice(config, index, channels.length) : createState(config));
      starts.push(offset);
    }
    if (sequenceGap !== undefined) offset += Math.round((channel.seconds + sequenceGap) * rate);
  }
  const duration = sequenceGap === undefined ? Math.max(...channels.map(channel => channel.seconds)) :
    offset / rate - sequenceGap;
  for (const layer of additionalLayers) {
    for (const [source, focus] of [[layer.tone, false], [layer.ambience, true]]) {
      if (!source) continue;
      states.push(createState({ ...source, focus, seconds: Math.min(duration, seconds) }));
      starts.push(0);
    }
  }
  for (let start = 0; start < frames; start += 8192) {
    // Match the live mixer's normalization at each rendering block.
    const weight = sequenceGap === undefined ? states.reduce(
      (n, c) => n + (c.muted || c.status === "ended" ? 0 : c.volume), 0,
    ) : 1;
    const scale = (master * 0.65) / Math.max(1, weight);
    for (let i = start; i < Math.min(start + 8192, frames); i++) {
      let sum = 0;
      for (let index = 0; index < states.length; index++) {
        if (i < starts[index]) continue;
        const state = states[index];
        const value = sample(state, rate);
        if (!state.muted) sum += value * state.volume * (state.headroom ?? 1) * ((state.left ?? 1) + (state.right ?? 1)) / 2;
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
