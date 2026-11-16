import { Channel, chakras, ENGINE_VERSION, parseSession } from "./model";
export type Workspace = {
  schemaVersion: 1;
  layers: Channel[];
  chakraChannels: Channel[];
  selected: string[];
  mixTarget: "all" | "selected";
  seconds: number;
  master: number;
};
const key = "core-aura.workspace.v1";
export function parseWorkspace(value: unknown): Workspace {
  const w = value as Workspace;
  if (
    !w ||
    w.schemaVersion !== 1 ||
    !Number.isInteger(w.seconds) ||
    w.seconds < 1 ||
    w.seconds > 7200 ||
    !["all", "selected"].includes(w.mixTarget) ||
    !Array.isArray(w.selected) ||
    w.selected.length > 7 ||
    new Set(w.selected).size !== w.selected.length ||
    w.selected.some((id) => !chakras.some((c) => c.id === id))
  )
    throw Error("Invalid workspace");
  const base = {
    schemaVersion: 2,
    engineVersion: ENGINE_VERSION,
    id: "workspace",
    name: "Workspace",
    master: w.master,
    createdAt: "",
  };
  const layers = parseSession({
    ...base,
    kind: "studio",
    channels: w.layers,
  }).channels;
  const chakraChannels = parseSession({
    ...base,
    kind: "chakras",
    channels: w.chakraChannels,
  }).channels;
  if (
    layers.length > 12 ||
    layers.some((c) => chakras.some((k) => k.id === c.id)) ||
    chakraChannels.length !== 7
  )
    throw Error("Invalid workspace channels");
  return {
    schemaVersion: 1,
    layers,
    chakraChannels,
    selected: [...w.selected],
    mixTarget: w.mixTarget,
    seconds: w.seconds,
    master: w.master,
  };
}
export function readWorkspace(): { data: Workspace | null; error: string } {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { data: null, error: "" };
    if (raw.length > 64000) throw Error();
    return { data: parseWorkspace(JSON.parse(raw)), error: "" };
  } catch {
    return {
      data: null,
      error:
        "The last sound workspace could not be restored. Its stored data was preserved; saved sessions remain available in Library.",
    };
  }
}
export function saveWorkspace(value: Workspace) {
  try {
    localStorage.setItem(key, JSON.stringify(parseWorkspace(value)));
    return true;
  } catch {
    return false;
  }
}
