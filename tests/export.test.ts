import { describe, it, expect } from "vitest";
// @ts-ignore: shared pure JS renderer is also loaded by the export worker.
import { renderWav } from "../public/render-wav.js";
import { channel } from "../src/model";
function render(channels: unknown[], master = 0.5, seconds = 1) {
  const iterator = renderWav(channels, master, seconds);
  let next = iterator.next();
  while (!next.done) next = iterator.next();
  return new DataView(next.value);
}
describe("WAV export", () => {
  it("writes playable PCM with the intended frequency, duration and safe mix", () => {
    const wav = render([{ ...channel(), volume: 1 }]);
    expect(wav.byteLength).toBe(44 + 44100 * 2);
    expect(wav.getUint32(24, true)).toBe(44100);
    expect(wav.getUint16(34, true)).toBe(16);
    let crossings = 0,
      peak = 0;
    for (let i = 4410; i < 22050; i++) {
      const value = wav.getInt16(44 + i * 2, true);
      peak = Math.max(peak, Math.abs(value));
      if (value > 0 && wav.getInt16(44 + (i - 1) * 2, true) <= 0) crossings++;
    }
    expect(crossings / 0.4).toBeCloseTo(432, -1);
    expect(peak).toBeGreaterThan(10000);
    expect(peak).toBeLessThan(10700);
    const mixed = render(
      Array.from({ length: 7 }, () => ({ ...channel(), volume: 1 })),
      1,
    );
    for (let i = 44; i < mixed.byteLength; i += 2)
      expect(Math.abs(mixed.getInt16(i, true))).toBeLessThan(31130);
  });
  it("respects mute, master silence and individual channel duration", () => {
    for (const wav of [
      render([{ ...channel(), muted: true }]),
      render([channel()], 0),
    ]) {
      for (let i = 44; i < wav.byteLength; i += 2)
        expect(wav.getInt16(i, true)).toBe(0);
    }
    const short = render([{ ...channel(), seconds: 1 }], 1, 2);
    expect(short.getInt16(44 + 66000 * 2, true)).toBe(0);
  });
  it("rejects unbounded export allocations", () => {
    expect(() => render([channel()], 1, 601)).toThrow();
    expect(() => render([], 1)).toThrow();
  });
});
