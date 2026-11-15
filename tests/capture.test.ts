import { afterEach, describe, expect, it, vi } from "vitest";
import { captureVoice } from "../src/manifestation/capture";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function setup() {
  const stop = vi.fn(),
    stream = { getTracks: () => [{ stop }] };
  class Recorder {
    static isTypeSupported = () => true;
    static current: Recorder;
    state = "inactive";
    mimeType = "audio/webm";
    onstop?: () => void;
    ondataavailable?: (e: { data: Blob }) => void;
    constructor() {
      Recorder.current = this;
    }
    start() {
      this.state = "recording";
    }
    stop() {
      this.state = "inactive";
      this.ondataavailable?.({ data: new Blob([new Uint8Array(256)]) });
      this.onstop?.();
    }
  }
  const getUserMedia = vi.fn(async () => stream);
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  vi.stubGlobal("MediaRecorder", Recorder);
  return { stop, getUserMedia, Recorder, stream };
}
describe("microphone lifecycle", () => {
  it("stops tracks when a permission response arrives after cancellation", async () => {
    const { stop, getUserMedia, stream } = setup();
    let resolve!: (s: typeof stream) => void;
    getUserMedia.mockImplementation(() => new Promise((r) => (resolve = r)));
    const controller = new AbortController(),
      pending = captureVoice(controller.signal);
    controller.abort();
    resolve(stream);
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(stop).toHaveBeenCalled();
  });
  it("finishes at the 60-second limit and releases the microphone", async () => {
    vi.useFakeTimers();
    const { stop, Recorder } = setup(),
      session = await captureVoice(new AbortController().signal);
    await vi.advanceTimersByTimeAsync(60000);
    expect((await session.result).size).toBe(256);
    expect(Recorder.current.state).toBe("inactive");
    expect(stop).toHaveBeenCalled();
  });
  it("cancels and releases tracks without saving audio", async () => {
    const { stop } = setup(),
      controller = new AbortController(),
      session = await captureVoice(controller.signal);
    const rejected = expect(session.result).rejects.toThrow("cancelled");
    controller.abort();
    await rejected;
    expect(stop).toHaveBeenCalled();
  });
});
