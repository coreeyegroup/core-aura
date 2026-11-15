import { describe, it, expect, vi, beforeEach } from "vitest";
import { channel, parseSession, ENGINE_VERSION } from "../src/model";
import { readSessions, writeSessions } from "../src/storage";
// @ts-expect-error DSP module also executes directly in the audio worklet.
import { createState, sample } from "../public/dsp.js";

class MemoryStorage {
  values = new Map<string, string>();
  getItem(k: string) {
    return this.values.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.values.set(k, v);
  }
}
beforeEach(() => vi.stubGlobal("localStorage", new MemoryStorage()));
describe("session compatibility", () => {
  it("migrates a previous flute and drone without losing tuning or duration", () => {
    localStorage.setItem(
      "core-aura.sessions.v1",
      JSON.stringify([
        {
          name: "Evening",
          instrument: "flute",
          hz: "432",
          volume: "15",
          seconds: "600",
          drone: true,
          sa: "216",
          mix: "12",
        },
      ]),
    );
    const [s] = readSessions();
    expect(s.channels.map((c) => [c.sound, c.hz, c.seconds])).toEqual([
      ["flute", 432, 600],
      ["tanpura", 216, 600],
    ]);
    writeSessions([s]);
    expect(readSessions()[0]).toEqual(s);
    expect(localStorage.getItem("core-aura.sessions.v1")).not.toBeNull();
  });
  it("rejects unsupported engine versions and invalid layer settings", () => {
    const session = {
      schemaVersion: 2,
      engineVersion: ENGINE_VERSION,
      id: "x",
      name: "test",
      kind: "studio",
      channels: [channel()],
      master: 0.5,
    };
    expect(() => parseSession(session)).not.toThrow();
    expect(() =>
      parseSession({ ...session, engineVersion: "unknown" }),
    ).toThrow();
    expect(() =>
      parseSession({ ...session, channels: [{ ...channel(), hz: Infinity }] }),
    ).toThrow();
    expect(() => parseSession({ ...session, kind: "chakras" })).toThrow();
  });
});
describe("audio rendering", () => {
  it("renders the requested fundamental at 44.1 and 48 kHz", () => {
    for (const rate of [44100, 48000]) {
      const state = createState({ ...channel("sine", 432), seconds: 2 });
      const crossings = [];
      let previous = 0;
      for (let i = 0; i < rate; i++) {
        const v = sample(state, rate);
        if (i > rate * 0.1 && previous <= 0 && v > 0) crossings.push(i);
        previous = v;
      }
      const hz =
        ((crossings.length - 1) * rate) / (crossings.at(-1) - crossings[0]);
      expect(hz).toBeCloseTo(432, 1);
    }
  });
  it("preserves pause position and stops after a faded release", () => {
    const s = createState({ ...channel(), seconds: 10 });
    for (let i = 0; i < 4800; i++) sample(s, 48000);
    s.status = "pausing";
    for (let i = 0; i < 2000; i++) sample(s, 48000);
    expect(s.status).toBe("paused");
    const t = s.time;
    for (let i = 0; i < 4800; i++) expect(sample(s, 48000)).toBe(0);
    expect(s.time).toBe(t);
    s.status = "playing";
    for (let i = 0; i < 4800; i++) sample(s, 48000);
    expect(s.time).toBeGreaterThan(t);
    s.status = "stopping";
    for (let i = 0; i < 2000; i++) sample(s, 48000);
    expect(s.status).toBe("ended");
  });
  it("keeps percussion timing independent of frequency", () => {
    const states = [216, 432, 852].map((hz) =>
      createState({ ...channel("bell", hz), seconds: 4 }),
    );
    let finite = true;
    for (let i = 0; i < 48000 * 4 + 2000; i++)
      for (const s of states)
        finite = Number.isFinite(sample(s, 48000)) && finite;
    expect(finite).toBe(true);
    expect(states.map((s) => s.status)).toEqual(["ended", "ended", "ended"]);
    expect(states[0].time).toBe(states[2].time);
  });
});

describe("shared audio worklet", () => {
  it("bounds the seven-channel mix and removes completed channels", async () => {
    let Mixer: any;
    vi.stubGlobal("sampleRate", 48000);
    vi.stubGlobal(
      "AudioWorkletProcessor",
      class {
        port = { onmessage: undefined as any, postMessage: vi.fn() };
      },
    );
    vi.stubGlobal("registerProcessor", (_: string, processor: any) => {
      Mixer = processor;
    });
    // @ts-expect-error Browser worklet is also exercised with a processor host here.
    await import("../public/mixer-worklet.js");
    const mixer = new Mixer();
    for (let i = 0; i < 7; i++)
      mixer.port.onmessage({
        data: {
          type: "start",
          channel: {
            ...channel("sine", 396 + i * 30),
            id: String(i),
            volume: 1,
            seconds: 1,
          },
        },
      });
    let peak = 0;
    for (let i = 0; i < 400; i++) {
      const block = new Float32Array(128);
      mixer.process([], [[block]]);
      peak = Math.max(peak, ...block.map(Math.abs));
    }
    expect(peak).toBeGreaterThan(0);
    expect(peak).toBeLessThanOrEqual(0.651);
    expect(mixer.channels.size).toBe(0);
  });
});
