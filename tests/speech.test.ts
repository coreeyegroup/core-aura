import { afterEach, describe, it, expect, vi } from "vitest";
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => false },
}));
import { speech } from "../src/manifestation/speech";
import { newPlan } from "../src/manifestation/model";
afterEach(() => {
  speech.stop();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function setup(speak: (u: any) => void) {
  const mock = { getVoices: () => [], speak, cancel: vi.fn(), resume: vi.fn() };
  vi.stubGlobal("window", {});
  Object.assign(window, { speechSynthesis: mock });
  vi.stubGlobal("speechSynthesis", mock);
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class {
      constructor(public text: string) {}
    },
  );
  return mock;
}
describe("device speech diagnostics", () => {
  it("reports a stalled device voice instead of silently showing playback", async () => {
    vi.useFakeTimers();
    setup(() => {});
    const result = speech.speak("Hello", newPlan());
    const failed = expect(result).rejects.toThrow("did not start");
    await vi.advanceTimersByTimeAsync(8001);
    await failed;
  });
  it("keeps an utterance alive, resumes the engine and exposes the real error", async () => {
    let current: any;
    const driver = setup((u) => (current = u));
    const result = speech.speak("Hello", newPlan());
    expect(driver.resume).toHaveBeenCalled();
    current.onerror({ error: "not-allowed" });
    await expect(result).rejects.toThrow("not-allowed");
  });
  it("cancels delayed events on Stop and handles normal completion", async () => {
    let current: any;
    setup((u) => (current = u));
    const result = speech.speak("Hello", newPlan());
    const stopped = expect(result).rejects.toMatchObject({
      name: "AbortError",
    });
    speech.stop();
    await stopped;
    current.onend();
    const next = speech.speak("Again", newPlan());
    current.onstart();
    current.onend();
    await next;
  });
  it("plays a same-language device voice for online speech when offline", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    let current: any;
    const driver = setup(utterance => { current = utterance; });
    const local = { name: "Hindi", lang: "hi-IN", localService: true, voiceURI: "hindi-local" };
    const remote = { ...local, localService: false, voiceURI: "hindi-cloud" };
    vi.spyOn(driver, "getVoices").mockReturnValue([remote, local] as never[]);
    const plan = { ...newPlan(), voice: "core:hi+f2" };
    const result = speech.speak("नमस्ते", plan);
    expect(current.voice).toEqual(local);
    current.onend();
    await result;
    await expect(speech.speak("Bonjour", { ...plan, voice: "core:fr-fr" })).rejects.toThrow("No offline voice");
  });
});
