import { playlistStore } from "../playlists/store";
import { readSessions } from "../storage";
import { chakraScheduleTarget } from "./recurrence";

export function scheduledChakraName(targetId: string) {
  const target = chakraScheduleTarget(targetId);
  if (!target) return undefined;
  try {
    return target.kind === "playlist"
      ? playlistStore.snapshot().data.playlists.find(row => row.id === target.id)?.name
      : readSessions().find(row => row.kind === "chakras" && row.id === target.id)?.name;
  } catch {
    return undefined;
  }
}
