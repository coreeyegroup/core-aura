import { Capacitor } from "@capacitor/core";
import { TextToSpeech } from "@capacitor-community/text-to-speech";
import { Line, Plan } from "./model";
import { recording } from "./recordings";
import { engine } from "../audio/engine";
import { serverSpeech } from "./server-voice";
export type Voice = {
  name: string;
  lang: string;
  voiceURI: string;
  localService: boolean;
};
export interface SpeechDriver {
  voices(): Promise<Voice[]>;
  speak(text: string, plan: Plan): Promise<void>;
  stop(): void;
  speakLine?(line: Line, plan: Plan): Promise<void>;
}
let stopping = Promise.resolve();
let generation = 0;
let overlay: AbortController | undefined;
let pending:
  | { utterance: SpeechSynthesisUtterance; cancel: () => void }
  | undefined;
export const speech: SpeechDriver = {
  async voices() {
    if (Capacitor.isNativePlatform())
      return (await TextToSpeech.getSupportedVoices()).voices;
    if (typeof window === "undefined" || !("speechSynthesis" in window))
      return [];
    return speechSynthesis.getVoices();
  },
  stop() {
    generation++;
    pending?.cancel();
    pending = undefined;
    overlay?.abort();
    overlay = undefined;
    if (Capacitor.isNativePlatform())
      stopping = stopping.then(() => TextToSpeech.stop()).catch(() => {});
    else if (typeof window !== "undefined" && "speechSynthesis" in window)
      speechSynthesis.cancel();
  },
  async speakLine(line, plan) {
    if (plan.useRecordings && line.recordingId) {
      overlay?.abort();
      const controller = new AbortController();
      overlay = controller;
      try {
        const clip = await recording(line.recordingId);
        if (clip.text !== line.text)
          throw Error("Record this sentence again: its words changed.");
        await engine.playOverlay(
          () => clip.blob.arrayBuffer(),
          plan.volume,
          controller.signal,
        );
      } finally {
        if (overlay === controller) overlay = undefined;
      }
    } else await speech.speak(line.text, plan);
  },
  async speak(text, plan) {
    const token = generation;
    if (plan.voice.startsWith("core:")) {
      overlay?.abort();
      const controller = new AbortController();
      overlay = controller;
      try {
        await engine.playOverlay(
          () => serverSpeech(text, plan.voice, plan.rate, controller.signal),
          plan.volume,
          controller.signal,
        );
      } finally {
        if (overlay === controller) overlay = undefined;
      }
      return;
    }
    if (Capacitor.isNativePlatform()) {
      await stopping;
      if (token !== generation) return;
      const voices = (await TextToSpeech.getSupportedVoices()).voices;
      if (token !== generation) return;
      const index = voices.findIndex((v) => v.voiceURI === plan.voice);
      await TextToSpeech.speak({
        text,
        lang: index >= 0 ? voices[index].lang : "en-US",
        voice: index >= 0 ? index : undefined,
        rate: plan.rate,
        volume: plan.volume,
        category: "ambient",
      });
      return;
    }
    if (typeof window === "undefined" || !("speechSynthesis" in window))
      throw Error(
        "Speech is unavailable on this device. Choose silent reading.",
      );
    return new Promise<void>((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      const voice = speechSynthesis
        .getVoices()
        .find((v) => v.voiceURI === plan.voice);
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else utterance.lang = "en-US";
      utterance.rate = plan.rate;
      utterance.volume = plan.volume;
      let settled = false;
      let startup: ReturnType<typeof setTimeout>,
        deadline: ReturnType<typeof setTimeout>;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(startup);
        clearTimeout(deadline);
        if (pending?.utterance === utterance) pending = undefined;
        if (error) reject(error);
        else resolve();
      };
      pending = {
        utterance,
        cancel: () =>
          finish(new DOMException("Speech cancelled", "AbortError")),
      };
      utterance.onstart = () => clearTimeout(startup);
      utterance.onend = () => finish();
      utterance.onerror = (e) =>
        finish(
          Error(
            "Device speech failed (" +
              e.error +
              "). Select a Core-aura voice, refresh device voices, or use a personal recording.",
          ),
        );
      startup = setTimeout(
        () =>
          finish(
            Error(
              "The device voice did not start. Select a Core-aura voice or refresh device voices, then tap Play again.",
            ),
          ),
        8000,
      );
      deadline = setTimeout(
        () =>
          finish(
            Error(
              "The device voice stopped responding. Try a shorter sentence or a Core-aura voice.",
            ),
          ),
        70000,
      );
      try {
        speechSynthesis.resume?.();
        speechSynthesis.speak(utterance);
      } catch (e) {
        finish(e as Error);
      }
    });
  },
};
