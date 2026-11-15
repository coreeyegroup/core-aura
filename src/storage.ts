import {
  ENGINE_VERSION,
  Session,
  Sound,
  channel,
  parseSession,
  sounds,
} from "./model";
const key = "core-aura.sessions.v2";
export function readSessions(): Session[] {
  const raw = localStorage.getItem(key);
  if (raw) {
    const rows: unknown = JSON.parse(raw);
    if (!Array.isArray(rows))
      throw Error("The saved session library cannot be read.");
    return rows.map(parseSession);
  }
  const legacy = JSON.parse(
    localStorage.getItem("core-aura.sessions.v1") || "[]",
  );
  if (!Array.isArray(legacy))
    throw Error("The previous session library cannot be read.");
  const migrated: Session[] = legacy.map((r: Record<string, unknown>) => {
    const sound = (
      typeof r.instrument === "string" && r.instrument in sounds
        ? r.instrument
        : "sine"
    ) as Sound;
    const c = {
      ...channel(sound, Number(r.hz)),
      volume: Number(r.volume) / 100,
      seconds: Number(r.seconds),
    };
    const channels = [c];
    if (r.drone)
      channels.push({
        ...channel("tanpura", Number(r.sa)),
        volume: Number(r.mix) / 100,
        seconds: c.seconds,
      });
    return parseSession({
      schemaVersion: 2,
      engineVersion: ENGINE_VERSION,
      id: crypto.randomUUID(),
      name: String(r.name),
      kind: "studio",
      channels,
      master: 0.5,
      createdAt: new Date().toISOString(),
    });
  });
  if (migrated.length) localStorage.setItem(key, JSON.stringify(migrated));
  return migrated;
}
export function writeSessions(rows: Session[]) {
  rows.forEach(parseSession);
  localStorage.setItem(key, JSON.stringify(rows));
}
export function favorites(): Sound[] {
  try {
    return JSON.parse(
      localStorage.getItem("core-aura.favorites") || "[]",
    ).filter((s: string) => s in sounds);
  } catch {
    return [];
  }
}
