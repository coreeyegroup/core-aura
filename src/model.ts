import { AmbienceSound, natureCatalog, isNature } from "./nature/catalog";
export const VERSION = "0.34.0";
export const ENGINE_VERSION = "2.0";
export type Sound =
  | "sine"
  | "triangle"
  | "flute"
  | "drum"
  | "bell"
  | "bowl"
  | "tanpura"
  | "yaman"
  | "mohanam"
  | "hum" | "shruti" | "harp" | "chime"
  | AmbienceSound;
export type Tab =
  | "home"
  | "manifest"
  | "explore"
  | "studio"
  | "chakras"
  | "library"
  | "admin";
export type Channel = {
  id: string;
  sound: Sound;
  hz: number;
  volume: number;
  muted: boolean;
  seconds: number;
  intensity?: number;
  focus?: boolean;
  focusQ?: number;
  interval?: number;
  fadeSeconds?: number;
};
export type Session = {
  schemaVersion: 2;
  engineVersion: string;
  id: string;
  name: string;
  kind: "studio" | "chakras" | "nature";
  channels: Channel[];
  master: number;
  createdAt: string;
  sequenceGap?: number;
};
const instrumentSounds: Record<
  Exclude<Sound, AmbienceSound>,
  { name: string; detail: string; min: number; max: number; type: string }
> = {
  sine: {
    name: "Pure tone",
    detail: "A single continuous frequency",
    min: 20,
    max: 12000,
    type: "Tone",
  },
  triangle: {
    name: "Soft triangle",
    detail: "A fundamental with gentle odd harmonics",
    min: 20,
    max: 4000,
    type: "Tone",
  },
  flute: {
    name: "Bamboo flute",
    detail: "Original flute-style synthesis",
    min: 180,
    max: 1200,
    type: "Instrument",
  },
  drum: {
    name: "Tuned drum",
    detail: "Resonant strikes at a steady pulse",
    min: 60,
    max: 600,
    type: "Instrument",
  },
  bell: {
    name: "Bell",
    detail: "Bright strikes with a decaying ring",
    min: 180,
    max: 1200,
    type: "Instrument",
  },
  bowl: {
    name: "Singing bowl",
    detail: "Long resonance with beating partials",
    min: 100,
    max: 1000,
    type: "Instrument",
  },
  tanpura: {
    name: "Tanpura drone",
    detail: "Four plucked strings, Pa–Sa–Sa–low Sa",
    min: 100,
    max: 600,
    type: "Drone",
  },
  yaman: {
    name: "Yaman study",
    detail: "Hindustani · four original phrase studies",
    min: 100,
    max: 600,
    type: "Raga",
  },
  mohanam: {
    name: "Mohanam study",
    detail: "Carnatic · pentatonic phrase study",
    min: 100,
    max: 600,
    type: "Raga",
  },
  hum: {name:"Harmonic hum",detail:"Original sustained vocal-like synthesis",min:80,max:600,type:"Voice"},
  shruti: {name:"Shruti-style drone",detail:"Original sustained reed-like drone",min:80,max:600,type:"Drone"},
  harp: {name:"Soft harp",detail:"Original gentle plucked-string synthesis",min:100,max:1200,type:"Instrument"},
  chime: {name:"Tuned chime",detail:"Original slowly struck chime resonance",min:100,max:2000,type:"Instrument"},

};
export const sounds = {
  ...instrumentSounds,
  ...Object.fromEntries(Object.entries(natureCatalog).map(([id,spec])=>[id,{name:spec.name,detail:spec.detail,min:80,max:8000,type:"Nature"}]))
} as Record<Sound,{name:string;detail:string;min:number;max:number;type:string}>;
export const chakraSounds: Sound[] = ["sine", "triangle", "bowl", "flute", "bell"];
export const chakras = [
  {
    id: "root",
    name: "Root",
    hz: 396,
    color: "#a93546",
    focus: "Grounding",
    prompt: "Notice the support beneath your feet.",
  },
  {
    id: "sacral",
    name: "Sacral",
    hz: 417,
    color: "#ab541b",
    focus: "Flow",
    prompt: "Allow your breathing to settle into its own rhythm.",
  },
  {
    id: "solar",
    name: "Solar plexus",
    hz: 528,
    color: "#856811",
    focus: "Intention",
    prompt: "Bring one simple intention to mind.",
  },
  {
    id: "heart",
    name: "Heart",
    hz: 639,
    color: "#28734a",
    focus: "Compassion",
    prompt: "Recall a moment of kindness.",
  },
  {
    id: "throat",
    name: "Throat",
    hz: 741,
    color: "#256a89",
    focus: "Expression",
    prompt: "Listen closely to the space around the sound.",
  },
  {
    id: "third-eye",
    name: "Third eye",
    hz: 852,
    color: "#635291",
    focus: "Attention",
    prompt: "Let your attention return gently to the present.",
  },
  {
    id: "crown",
    name: "Crown",
    hz: 963,
    color: "#87528c",
    focus: "Reflection",
    prompt: "Spend a few breaths in quiet reflection.",
  },
];
export function channel(sound: Sound = "sine", hz = 432): Channel {
  let fadeSeconds=.03;try{const value=JSON.parse(localStorage.getItem("core-aura.audio-defaults.v1")||"{}").fadeSeconds;if(Number.isFinite(value)&&value>=.01&&value<=5)fadeSeconds=value;}catch{}
  return {
    fadeSeconds,
    id: crypto.randomUUID(),
    sound,
    hz,
    volume: 0.3,
    muted: false,
    seconds: 300,
  };
}
export function validChannel(value: unknown): value is Channel {
  if (!value || typeof value !== "object") return false;
  const c = value as Channel;
  const spec = sounds[c.sound];
  return Boolean(
    spec &&
      typeof c.id === "string" &&
      c.id.length < 100 &&
      Number.isFinite(c.hz) &&
      c.hz >= spec.min &&
      c.hz <= spec.max &&
      Number.isFinite(c.volume) &&
      c.volume >= 0 &&
      c.volume <= 1 &&
      typeof c.muted === "boolean" &&
      (c.fadeSeconds===undefined || (Number.isFinite(c.fadeSeconds)&&c.fadeSeconds>=.01&&c.fadeSeconds<=5)) &&
      (c.interval === undefined || (Number.isFinite(c.interval) && c.interval>=.25 && c.interval<=30)) &&
      (c.intensity === undefined || (Number.isFinite(c.intensity) && c.intensity >= 0 && c.intensity <= 1)) &&
      (c.focus === undefined || typeof c.focus === "boolean") &&
      (c.focusQ === undefined || (Number.isFinite(c.focusQ) && c.focusQ >= .3 && c.focusQ <= 8)) &&
      Number.isInteger(c.seconds) &&
      c.seconds >= 1 &&
      c.seconds <= 7200,
  );
}
export function parseSession(value: unknown): Session {
  const s = value as Session;
  if (
    !s ||
    s.schemaVersion !== 2 ||
    s.engineVersion !== ENGINE_VERSION ||
    typeof s.name !== "string" ||
    !s.name.trim() ||
    s.name.length > 80 ||
    typeof s.id !== "string" ||
    s.id.length > 100 ||
    !["studio", "chakras", "nature"].includes(s.kind) ||
    !Array.isArray(s.channels) ||
    s.channels.length < 1 ||
    s.channels.length > 12 ||
    !s.channels.every(validChannel) ||
    new Set(s.channels.map((c) => c.id)).size !== s.channels.length ||
    !Number.isFinite(s.master) ||
    s.master < 0 ||
    s.master > 1
  )
    throw Error("This session has unsupported or invalid settings.");
  if (
    s.kind === "chakras" &&
    s.channels.some(
      (c) =>
        !chakras.some((k) => k.id === c.id && k.hz === c.hz) ||
        !chakraSounds.includes(c.sound),
    )
  )
    throw Error("This chakra session uses unsupported settings.");
  if (s.sequenceGap !== undefined && (s.kind !== "chakras" ||
      !Number.isFinite(s.sequenceGap) || s.sequenceGap < 0 || s.sequenceGap > 30 ||
      s.channels.some(channel => channel.seconds !== s.channels[0].seconds))) {
    throw Error("This chakra sequence has invalid timing.");
  }
  if (s.kind === "nature" && (s.channels.length>8 || s.channels.some(c=>!/^nature:[a-zA-Z0-9-]{1,80}$/.test(c.id))))
    throw Error("This nature mix uses unsupported channel identifiers.");
  return { ...s, channels: s.channels.map((c) => ({ ...c })) };
}

export function sessionDuration(session: Session) {
  return session.sequenceGap === undefined
    ? Math.max(...session.channels.map(channel => channel.seconds))
    : session.channels.reduce((total, channel) => total + channel.seconds, 0)
      + (session.channels.length - 1) * session.sequenceGap;
}
