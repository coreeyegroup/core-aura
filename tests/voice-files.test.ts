import { describe, it, expect } from "vitest";
import {
  encodeVoice,
  validateVoiceWav,
} from "../src/manifestation/voice-files";
function sound(channels = 1, seconds = 1) {
  const length = Math.round(seconds * 32000),
    wave = Float32Array.from(
      { length },
      (_, i) => 0.4 * Math.sin((2 * Math.PI * 220 * i) / 32000),
    );
  return {
    length,
    sampleRate: 32000,
    duration: seconds,
    numberOfChannels: channels,
    getChannelData: (i: number) =>
      i ? Float32Array.from(wave, (n) => -n) : wave,
  };
}
describe("portable personal voice WAV", () => {
  it("exports bounded 32 kHz mono PCM preserving pitch and duration", async () => {
    const bytes = await encodeVoice(sound()).arrayBuffer(),
      v = new DataView(bytes);
    expect(validateVoiceWav(bytes)).toBe(1);
    expect(v.getUint16(22, true)).toBe(1);
    expect(v.getUint32(24, true)).toBe(32000);
    let crossings = 0;
    for (let at = 46; at < bytes.byteLength; at += 2)
      if (v.getInt16(at, true) > 0 && v.getInt16(at - 2, true) <= 0)
        crossings++;
    expect(crossings).toBeCloseTo(220, 0);
  });
  it("mixes stereo without doubling levels and bounds non-finite samples", async () => {
    const v = new DataView(await encodeVoice(sound(2)).arrayBuffer());
    for (let at = 44; at < v.byteLength; at += 2)
      expect(v.getInt16(at, true)).toBe(0);
    const sample = sound();
    sample.getChannelData = () => new Float32Array(sample.length).fill(NaN);
    const silent = new DataView(await encodeVoice(sample).arrayBuffer());
    expect(silent.getInt16(44, true)).toBe(0);
  });
  it("rejects oversized, truncated, compressed, inconsistent and overlong imports", async () => {
    const good = await encodeVoice(sound()).arrayBuffer();
    expect(() =>
      validateVoiceWav(new ArrayBuffer(5 * 1024 * 1024 + 1)),
    ).toThrow();
    expect(() => validateVoiceWav(good.slice(0, -2))).toThrow();
    for (const [offset, value, width] of [
      [20, 3, 2],
      [22, 3, 2],
      [28, 1, 4],
      [32, 3, 2],
      [40, 1, 4],
    ]) {
      const bad = good.slice(0),
        v = new DataView(bad);
      if (width === 2) v.setUint16(offset, value, true);
      else v.setUint32(offset, value, true);
      expect(() => validateVoiceWav(bad)).toThrow();
    }
    const tooLong = sound(1, 66);
    expect(() => encodeVoice(tooLong)).toThrow();
  });
});
