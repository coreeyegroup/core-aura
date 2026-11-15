import { describe, it, expect } from "vitest";
import {
  compareVersion,
  compatible,
  parsePack,
  validateWav,
} from "../src/packs/catalog";
// @ts-ignore: shared worker renderer
import { renderWav } from "../public/render-wav.js";
import { channel } from "../src/model";
const pack = {
  id: "study",
  title: "Study",
  description: "Original synthesis",
  tradition: "Original synthesis",
  creator: "Core-aura",
  license: "CC0-1.0",
  attribution: "Core-aura",
  provenance: "Generated study",
  version: "1.0.0",
  minimum_engine: "2.0",
  assets: [
    {
      id: "tone",
      title: "Tone",
      url: "/packs/study/1.0.0/tone.wav",
      sha256: "a".repeat(64),
      bytes: 88244,
      seconds: 1,
    },
  ],
};
describe("pack manifests and audio validation", () => {
  it("compares numeric engine versions and accepts bounded original assets", () => {
    expect(compareVersion("1.10.0", "1.9.0")).toBe(1);
    expect(compatible(parsePack(pack))).toBe(true);
    expect(compatible({ ...pack, minimum_engine: "3.0" })).toBe(false);
  });
  it("rejects cross-origin, traversal, duplicate, malformed and oversized files", () => {
    for (const url of [
      "https://example.com/a.wav",
      "/packs/a/../tone.wav",
      "/packs/a/%2e%2e/tone.wav",
      "/packs/a/1.0.0/tone.wav?token=x",
    ])
      expect(() =>
        parsePack({ ...pack, assets: [{ ...pack.assets[0], url }] }),
      ).toThrow();
    expect(() =>
      parsePack({ ...pack, assets: [pack.assets[0], pack.assets[0]] }),
    ).toThrow();
    expect(() =>
      parsePack({
        ...pack,
        assets: [{ ...pack.assets[0], bytes: 30 * 1024 * 1024 }],
      }),
    ).toThrow();
    expect(() =>
      parsePack({ ...pack, assets: [{ ...pack.assets[0], sha256: "wrong" }] }),
    ).toThrow();
  });
  it("requires decodable canonical PCM with the declared duration", () => {
    const iterator = renderWav([channel()], 0.5, 1);
    let next = iterator.next();
    while (!next.done) next = iterator.next();
    expect(() => validateWav(next.value, pack.assets[0])).not.toThrow();
    expect(() =>
      validateWav(next.value, { ...pack.assets[0], seconds: 3 }),
    ).toThrow();
    new DataView(next.value).setUint16(20, 3, true);
    expect(() => validateWav(next.value, pack.assets[0])).toThrow();
  });
});
