import { Channel, parseSession, Session } from "../model";
import type { Plan } from "./model";

export function attachMix(value: Session): NonNullable<Plan["backgroundMix"]> {
  const session = parseSession(value);
  if (session.channels.length > 8) throw Error("A practice background supports up to eight generated layers.");
  return { name: session.name, channels: session.channels.map(c=>({...c})), master: session.master, volume: .4 };
}
export function backgroundChannels(plan: Plan, speaking = false): Channel[] {
  const factor = pMuted(plan) ? 0 : speaking && (plan.backgroundDucking ?? true) ? (plan.backgroundDuckLevel ?? .25) : 1;
  if (plan.backgroundMix) {
    const mix = plan.backgroundMix;
    return mix.channels.map((c,index)=>({...c,id:"manifest-background:"+index,seconds:plan.seconds,
      volume:c.volume*mix.master*mix.volume*factor}));
  }
  return plan.background ? [{...plan.background,id:"manifest-background",muted:false,seconds:plan.seconds,volume:plan.background.volume*factor}] : [];
}

function pMuted(plan:Plan){return plan.backgroundMuted??false;}
