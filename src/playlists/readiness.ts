import { useEffect, useState } from "react";
import { allRecordings, type PersonalRecording } from "../manifestation/recordings";
import { chooseDeviceVoice, speech, type Voice } from "../manifestation/speech";
import type { Line, Plan } from "../manifestation/model";
import { tracks } from "../tracks/storage";
import { resolveItems, type PlayItem } from "./model";

type Clip = Pick<PersonalRecording, "id" | "kind" | "text">;
type Inventory = { clips?: Map<string, Clip> | null; voices?: Voice[] | null };
export type Readiness = {
  status: "ready" | "checking" | "connection" | "repair";
  message: string;
};
const ready: Readiness = { status: "ready", message: "Ready offline" };

function clipId(line: Line, plan: Plan) {
  return line.audioAffirmation || plan.useRecordings ? line.recordingId : undefined;
}

export function playbackReadiness(items: PlayItem[], inventory: Inventory): Readiness {
  let result = ready;
  for (const item of items) {
    if (item.kind !== "practice" || item.plan.mode === "read") continue;
    const { plan } = item;
    for (const line of plan.lines) {
      const id = clipId(line, plan);
      if (id) {
        if (inventory.clips === undefined) {
          result = { status: "checking", message: "Checking offline playback…" };
          continue;
        }
        const clip = inventory.clips?.get(id);
        if (!clip || (line.audioAffirmation ? clip.kind !== "affirmation" : clip.text !== line.text)) {
          return { status: "repair", message: `“${item.name}” has an unavailable recording. Open the practice in Manifest to replace it or choose a voice.` };
        }
      } else if (inventory.voices === undefined) {
        result = { status: "checking", message: "Checking offline playback…" };
      } else if (result.status === "ready") {
        try {
          chooseDeviceVoice(inventory.voices ?? [], plan.voice, true);
        } catch {
          result = { status: "connection", message: `“${item.name}” needs an installed offline voice for its language. Connect or choose a voice in Manifest.` };
        }
      }
    }
  }
  return result;
}

async function readInventory(clips: boolean, voices: boolean): Promise<Inventory> {
  const [recordings, device] = await Promise.allSettled([
    clips ? allRecordings() : [],
    voices ? speech.voices() : [],
  ]);
  return {
    clips: recordings.status === "fulfilled" ? new Map(recordings.value.map(clip => [clip.id, clip])) : null,
    voices: device.status === "fulfilled" ? device.value : null,
  };
}

export async function verifyPracticeAudio(items: PlayItem[]) {
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  const spoken = items.flatMap(item => item.kind === "practice" && item.plan.mode === "speech" ? [item.plan] : []);
  const needsClips = spoken.some(plan => plan.lines.some(line => clipId(line, plan)));
  const needsVoices = offline && spoken.some(plan => plan.lines.some(line => !clipId(line, plan)));
  if (!needsClips && !needsVoices) return;
  const result = playbackReadiness(items, await readInventory(needsClips, needsVoices));
  if (result.status === "repair" || (result.status === "connection" && offline && navigator.onLine === false)) {
    throw Error(result.message);
  }
}

export async function verifyPractice(plan: Plan) {
  const hasLayers = plan.accompaniment?.audio ||
    plan.backgroundMix?.channels.some(channel => channel.accompaniment?.audio);
  await verifyPracticeAudio(resolveItems([{ kind: "practice", id: plan.id }], [plan], [], hasLayers ? await tracks() : []));
}

export function usePlaybackInventory() {
  const [inventory, setInventory] = useState<Inventory>({});
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    let generation = 0;
    const refresh = async () => {
      const request = ++generation;
      setOnline(navigator.onLine);
      const next = await readInventory(true, true);
      if (request === generation) setInventory(next);
    };
    void refresh();
    const events = ["online", "offline", "focus", "core-aura-recordings-changed"];
    events.forEach(event => addEventListener(event, refresh));
    window.speechSynthesis?.addEventListener("voiceschanged", refresh);
    return () => {
      generation++;
      events.forEach(event => removeEventListener(event, refresh));
      window.speechSynthesis?.removeEventListener("voiceschanged", refresh);
    };
  }, []);
  return { inventory, online };
}
