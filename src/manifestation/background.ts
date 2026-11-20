import { Channel, parseSession, Session } from "../model";
import type { Plan } from "./model";

export function attachMix(value: Session): NonNullable<Plan["backgroundMix"]> {
  const session = parseSession(value);
  if (session.channels.length > 8) throw Error("A practice background supports up to eight generated layers.");
  return { name: session.name, channels: session.channels.map(c=>({...c})), master: session.master, volume: .4 };
}
export function backgroundChannels(plan: Plan, speaking = false): Channel[] {
  const factor = pMuted(plan) ? 0 : speaking && (plan.backgroundDucking ?? true) ? (plan.backgroundDuckLevel ?? .25) : 1;
  const channels: Channel[] = plan.backgroundMix
    ? plan.backgroundMix.channels.map((c, index) => ({...c, id: "manifest-background:" + index,
      seconds: plan.seconds, volume: c.volume * plan.backgroundMix!.master * plan.backgroundMix!.volume * factor }))
    : plan.background ? [{...plan.background, id: "manifest-background", muted: false,
      seconds: plan.seconds, volume: plan.background.volume * factor }] : [];
  const sources = [plan.accompaniment, ...(plan.additionalLayers ?? [])];
  sources.forEach((layers, index) => {
    if (!layers?.tone && !layers?.ambience && !layers?.audio) return;
    channels.push({
      id: index === 0 ? "manifest-background:layers" : "manifest-background:layers:" + index,
      sound: "sine", hz: 432, volume: 0, muted: false, seconds: plan.seconds,
      accompaniment: {
        tone: layers.tone && { ...layers.tone, volume: layers.tone.volume * factor },
        ambience: layers.ambience && { ...layers.ambience, volume: layers.ambience.volume * factor },
        audio: layers.audio && { ...layers.audio, volume: layers.audio.volume * factor },
      },
    });
  });
  return channels;
}

function pMuted(plan:Plan){return plan.backgroundMuted??false;}
