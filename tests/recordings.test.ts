import { afterEach, describe, expect, it, vi } from "vitest";
import { AudioEngine } from "../src/audio/engine";
import { channel } from "../src/model";
let context: any;
class Source {
  onended: (() => void) | null = null;
  buffer: any;
  started: number[] = [];
  stopped = false;
  connect() {}
  disconnect() {}
  start(...args: number[]) {
    this.started = args;
  }
  stop() {
    this.stopped = true;
  }
}
class Context {
  currentTime = 0;
  destination = {};
  sources: Source[] = [];
  audioWorklet = { addModule: async () => {} };
  constructor() {
    context = this;
  }
  resume = async () => {};
  close = async () => {};
  createAnalyser = () => ({
    fftSize: 0,
    connect: (node: any) => node,
    getFloatTimeDomainData: () => {},
  });
  createDynamicsCompressor = () => ({threshold: {}, knee: {}, ratio: {}, attack: {}, release: {}, connect: () => ({})});
  createGain = () => ({
    gain: {
      value: 0,
      cancelScheduledValues: () => {},
      setValueAtTime: () => {},
      linearRampToValueAtTime: () => {},
      setTargetAtTime: () => {},
    },
    connect: () => {},
    disconnect: () => {},
  });
  createBufferSource = () => {
    const s = new Source();
    this.sources.push(s);
    return s;
  };
  decodeAudioData = async () => ({ duration: 15 });
}
class Worklet {
  port = { postMessage: () => {}, onmessage: null as any };
  connect(a: any) {
    return a;
  }
}
function setup() {
  vi.stubGlobal("AudioContext", Context);
  vi.stubGlobal("AudioWorkletNode", Worklet);
  return new AudioEngine();
}
afterEach(() => vi.unstubAllGlobals());
describe("recorded playback in the shared audio context", () => {
  it("pauses at the current position, resumes and ends without losing its state to worklet reports", async () => {
    const engine = setup();
    await engine.toggleRecording(
      "pack:study:tone",
      async () => new ArrayBuffer(44),
    );
    const firstContext = context;
    context.currentTime = 1.25;
    engine.pause("pack:study:tone");
    expect(engine.snapshot()[0]).toMatchObject({
      status: "paused",
      time: 1.25,
    });
    await engine.toggleRecording("pack:study:tone", async () => {
      throw Error("Must reuse decoded audio");
    });
    expect(context).toBe(firstContext);
    expect(context.sources[1].started).toEqual([0, 1.25]);
    context.sources[1].onended();
    expect(engine.snapshot()).toEqual([]);
  });
  it("cancels a pending decode and stops files when synthesis starts", async () => {
    const engine = setup();
    let ready!: (v: ArrayBuffer) => void;
    const waiting = engine.toggleRecording(
      "pack:pending",
      () => new Promise((r) => (ready = r)),
    );
    await vi.waitFor(() => expect(ready).toBeTypeOf("function"));
    engine.stopAll();
    ready(new ArrayBuffer(44));
    await waiting;
    expect(context.sources.length).toBe(0);
    await engine.toggleRecording(
      "pack:study:tone",
      async () => new ArrayBuffer(44),
    );
    await engine.play(channel());
    expect(context.sources[0].stopped).toBe(true);
    expect(engine.snapshot().some((s) => s.id === "pack:study:tone")).toBe(
      false,
    );
    expect(engine.snapshot().length).toBe(1);
  });
  it("does not start a tone stopped while its audio context is still connecting", async () => {
    const engine = setup();
    // Delay module loading rather than an output buffer; Stop must invalidate that pending voice.
    const pending = engine.play({ ...channel(), id: "manifest-background" });
    engine.stop("manifest-background");
    await pending;
    expect(engine.snapshot()).toEqual([]);
  });
});
