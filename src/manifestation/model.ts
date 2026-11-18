import { Channel, validChannel } from "../model";
export type Category =
  | "Health"
  | "Wealth"
  | "Success"
  | "Confidence"
  | "Relationships"
  | "Calm"
  | "Gratitude"
  | "Purpose";
const content: Record<Category, string[]> = {
  Health: [
    "I care for my body with patience and consistency.",
    "I give myself time to rest and recover.",
    "I choose habits that support my wellbeing.",
    "I listen to my body and seek support when I need it.",
    "I welcome progress one small step at a time.",
  ],
  Wealth: [
    "I make thoughtful decisions with the resources I have.",
    "I build useful skills and create value.",
    "I take steady steps toward financial stability.",
    "I can learn to manage money with clarity.",
    "I recognise opportunities and assess them carefully.",
  ],
  Success: [
    "I take one clear step toward my goals today.",
    "I learn from setbacks and keep improving.",
    "My consistent effort builds meaningful progress.",
    "I focus on the actions within my control.",
    "I make time for the work that matters to me.",
  ],
  Confidence: [
    "I can speak with clarity and respect.",
    "I trust myself to learn as I go.",
    "I do not need to be perfect to begin.",
    "I can set boundaries and honour my needs.",
    "I meet challenges with courage and curiosity.",
  ],
  Relationships: [
    "I listen with attention and speak with kindness.",
    "I make space for honest and respectful connection.",
    "I can give and receive support.",
    "I respect my boundaries and the boundaries of others.",
    "I show care through small, consistent actions.",
  ],
  Calm: [
    "I can return my attention to this moment.",
    "I allow myself to pause before responding.",
    "I take one thing at a time.",
    "I can make room for my feelings without judging them.",
    "I notice the support available around me.",
  ],
  Gratitude: [
    "I notice small moments of goodness today.",
    "I appreciate the people who support me.",
    "I acknowledge the effort I have already made.",
    "I can value what I have while working toward change.",
    "I make space for appreciation in my day.",
  ],
  Purpose: [
    "I choose actions that reflect my values.",
    "I can move forward without knowing every answer.",
    "I make time for reflection and meaningful work.",
    "I bring care and intention to what I do.",
    "I can build a life that matters to me.",
  ],
};
export const categories = Object.keys(content) as Category[];
export const affirmations = Object.entries(content).flatMap(
  ([category, lines]) =>
    lines.map((text, i) => ({
      id: category.toLowerCase() + "-" + i,
      text,
      category: category as Category,
    })),
);
export type Line = {
  id: string;
  text: string;
  recordingId?: string;
  recordedText?: string;
};
export type Plan = {
  schemaVersion: 1;
  id: string;
  name: string;
  lines: Line[];
  order: "sequence" | "each";
  repeats: number;
  gap: number;
  readSeconds: number;
  mode: "speech" | "read";
  voice: string;
  useRecordings?: boolean;
  rate: number;
  volume: number;
  seconds: number;
  backgroundMix?: {
    name: string;
    channels: Channel[];
    master: number;
    volume: number;
  } | null;
  backgroundDucking?: boolean;
  backgroundDuckLevel?: number;
  background: null | {
    sound: "sine" | "bowl" | "tanpura";
    hz: number;
    volume: number;
  };
};
export type Reminder = {
  id: string;
  slot: number;
  planId: string;
  time: string;
  days: number[];
  enabled: boolean;
  autoStart?: boolean;
};
export function newPlan(): Plan {
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    name: "My manifestation",
    lines: [],
    order: "sequence",
    repeats: 3,
    gap: 2,
    readSeconds: 5,
    mode: "speech",
    voice: "",
    rate: 0.9,
    volume: 0.7,
    seconds: 600,
    background: null,
  };
}
const finite = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
export function parsePlan(value: unknown, allowEmpty = false): Plan {
  const p = value as Plan;
  if (
    !p ||
    p.schemaVersion !== 1 ||
    typeof p.id !== "string" ||
    !p.id ||
    p.id.length > 100 ||
    typeof p.name !== "string" ||
    (!allowEmpty && !p.name.trim()) ||
    p.name.length > 80 ||
    !Array.isArray(p.lines) ||
    p.lines.length > 50 ||
    (!allowEmpty && !p.lines.length) ||
    !p.lines.every(
      (l) =>
        l &&
        typeof l.id === "string" &&
        l.id.length > 0 &&
        l.id.length < 100 &&
        typeof l.text === "string" &&
        (allowEmpty || l.text.trim().length > 0) &&
        l.text.length <= 300,
    ) ||
    new Set(p.lines.map((l) => l.id)).size !== p.lines.length ||
    !["sequence", "each"].includes(p.order) ||
    !Number.isInteger(p.repeats) ||
    !finite(p.repeats, 1, 108) ||
    !finite(p.gap, 0, 30) ||
    !finite(p.readSeconds, 2, 30) ||
    !["speech", "read"].includes(p.mode) ||
    typeof p.voice !== "string" ||
    p.voice.length > 300 ||
    !finite(p.rate, 0.5, 1.5) ||
    !finite(p.volume, 0, 1) ||
    !Number.isInteger(p.seconds) ||
    !finite(p.seconds, 60, 3600)
  )
    throw Error(
      "This manifestation practice has invalid or unsupported settings.",
    );
  if (
    p.background !== null &&
    (!p.background ||
      !["sine", "bowl", "tanpura"].includes(p.background.sound) ||
      !finite(p.background.volume, 0, 0.3) ||
      !finite(
        p.background.hz,
        p.background.sound === "sine" ? 20 : 100,
        p.background.sound === "sine"
          ? 12000
          : p.background.sound === "bowl"
            ? 1000
            : 600,
      ))
  )
    throw Error("The background sound settings are unsupported.");
  if (p.backgroundMix != null) {
    const m = p.backgroundMix;
    if (p.background !== null || typeof m.name !== "string" || !m.name.trim() || m.name.length > 80 ||
        !Array.isArray(m.channels) || !m.channels.length || m.channels.length > 8 ||
        !m.channels.every(validChannel) || new Set(m.channels.map(c=>c.id)).size !== m.channels.length ||
        !finite(m.master,0,1) || !finite(m.volume,0,1))
      throw Error("The attached background mix has invalid settings.");
  }
  if ((p.backgroundDucking !== undefined && typeof p.backgroundDucking !== "boolean") ||
      (p.backgroundDuckLevel !== undefined && !finite(p.backgroundDuckLevel,0,1)))
    throw Error("Invalid background voice-reduction settings.");
  if (p.useRecordings !== undefined && typeof p.useRecordings !== "boolean")
    throw Error("Invalid personal voice setting.");
  if (
    p.lines.some(
      (l) =>
        l.recordingId !== undefined &&
        (typeof l.recordingId !== "string" ||
          !/^[a-zA-Z0-9-]{1,100}$/.test(l.recordingId) ||
          l.recordedText !== l.text),
    )
  )
    throw Error("A personal recording no longer matches its sentence.");
  return structuredClone(p);
}
export function parseReminders(value: unknown, plans: Plan[]): Reminder[] {
  if (!Array.isArray(value) || value.length > 8)
    throw Error("Up to eight schedules are supported.");
  const rows = value as Reminder[];
  if (
    rows.some(
      (r) =>
        !r ||
        typeof r.id !== "string" ||
        !/^[a-z0-9-]{1,100}$/i.test(r.id) ||
        !Number.isInteger(r.slot) ||
        r.slot < 0 ||
        r.slot > 7 ||
        !plans.some((p) => p.id === r.planId) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time) ||
        typeof r.enabled !== "boolean" ||
        (r.autoStart !== undefined && typeof r.autoStart !== "boolean") ||
        !Array.isArray(r.days) ||
        r.days.length < 1 ||
        r.days.length > 7 ||
        r.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6) ||
        new Set(r.days).size !== r.days.length,
    ) ||
    new Set(rows.map((r) => r.slot)).size !== rows.length ||
    new Set(rows.map((r) => r.id)).size !== rows.length
  )
    throw Error("The manifestation schedules are invalid.");
  return structuredClone(rows);
}
export function position(plan: Plan, step: number) {
  const count = plan.lines.length;
  return plan.order === "sequence"
    ? { line: step % count, repeat: Math.floor(step / count) + 1 }
    : {
        line: Math.floor(step / plan.repeats),
        repeat: (step % plan.repeats) + 1,
      };
}
export function occurrence(reminder: Reminder, now: Date) {
  if (!reminder.enabled || !reminder.days.includes(now.getDay())) return null;
  const [h, m] = reminder.time.split(":").map(Number),
    due = new Date(now);
  due.setHours(h, m, 0, 0);
  const age = now.getTime() - due.getTime();
  if (age < 0 || age > 15 * 60000) return null;
  return {
    key:
      reminder.id +
      "|" +
      now.getFullYear() +
      "-" +
      (now.getMonth() + 1) +
      "-" +
      now.getDate() +
      "|" +
      reminder.time,
    due,
  };
}
export function nextOccurrence(reminder: Reminder, now: Date) {
  if (!reminder.enabled) return null;
  for (let offset = 0; offset < 8; offset++) {
    const date = new Date(now);
    date.setDate(date.getDate() + offset);
    const [h, m] = reminder.time.split(":").map(Number);
    date.setHours(h, m, 0, 0);
    if (reminder.days.includes(date.getDay()) && date > now) return date;
  }
  return null;
}
