export const VERSION = "0.18.0";
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
  | "mohanam";
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
};
export type Session = {
  schemaVersion: 2;
  engineVersion: string;
  id: string;
  name: string;
  kind: "studio" | "chakras";
  channels: Channel[];
  master: number;
  createdAt: string;
};
export const sounds: Record<
  Sound,
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
};
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
  return {
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
    !["studio", "chakras"].includes(s.kind) ||
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
        !["sine", "triangle", "bowl"].includes(c.sound),
    )
  )
    throw Error("This chakra session uses unsupported settings.");
  return { ...s, channels: s.channels.map((c) => ({ ...c })) };
}
