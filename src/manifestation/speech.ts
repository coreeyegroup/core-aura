import { Capacitor } from "@capacitor/core";
import { TextToSpeech } from "@capacitor-community/text-to-speech";
import { Plan } from "./model";
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
}
let stopping = Promise.resolve();
export const speech: SpeechDriver = {
  async voices() {
    if (Capacitor.isNativePlatform())
      return (await TextToSpeech.getSupportedVoices()).voices;
    if (typeof window === "undefined" || !("speechSynthesis" in window))
      return [];
    return speechSynthesis.getVoices();
  },
  stop() {
    if (Capacitor.isNativePlatform())
      stopping = stopping.then(() => TextToSpeech.stop()).catch(() => {});
    else if (typeof window !== "undefined" && "speechSynthesis" in window)
      speechSynthesis.cancel();
  },
  async speak(text, plan) {
    if (Capacitor.isNativePlatform()) {
      await stopping;
      const voices = (await TextToSpeech.getSupportedVoices()).voices;
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
      utterance.onend = () => resolve();
      utterance.onerror = () =>
        reject(
          Error(
            "Speech could not continue. Check the installed voice or choose silent reading.",
          ),
        );
      speechSynthesis.speak(utterance);
    });
  },
};
