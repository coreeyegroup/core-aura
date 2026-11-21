import { preferences, remember } from "../workbench/preferences";
import { engine } from "../audio/engine";
import { onOtherAudio } from "../audio/activity";
import { manifestPlayer } from "../manifestation/player";
import { QueuePlayer } from "./player";
import { verifyPracticeAudio } from "./readiness";
import { PlayItem } from "./model";
export const queuePlayer = new QueuePlayer(engine, manifestPlayer, (item) => {
    if (item.kind !== "track" && item.id !== "chakra-draft") remember({ kind: item.kind, id: item.id });
});
onOtherAudio(() => queuePlayer.interrupt());
let requestId = 0;
export async function startQueue(items: PlayItem[], name: string, saveReplay = true) {
    const id = ++requestId;
    await verifyPracticeAudio(items);
    if (id !== requestId) return false;
    const busy = ["playing", "paused"].includes(queuePlayer.snapshot().status) || ["playing", "paused"].includes(manifestPlayer.snapshot().status) || engine.snapshot().some(v => v.status !== "stopping");
    if (busy && !confirm("Replace current playback? This stops the active audio. Draft settings will be kept."))
        return false;
    await queuePlayer.start(items, name);
    const started = queuePlayer.snapshot();
    if (started.status !== "playing" && started.status !== "paused") return false;
    if (saveReplay) {
        try {
            preferences.update({ lastQueue: { name, items: items.map(({ kind, id }) => ({ kind, id })) } });
        } catch {
            // Playback still works when device storage is unavailable.
        }
    }
    return true;
}

export async function startScheduledQueue(items: PlayItem[], name: string) {
    if (!engine.canAutoPlay()) return false;
    await verifyPracticeAudio(items);
    if (document.hidden || document.querySelector("dialog[open], [role=dialog]") ||
        ["playing", "paused"].includes(queuePlayer.snapshot().status) ||
        ["playing", "paused"].includes(manifestPlayer.snapshot().status) ||
        engine.snapshot().some(voice => voice.status !== "stopping")) return false;
    await queuePlayer.start(items, name);
    return queuePlayer.snapshot().status === "playing";
}
