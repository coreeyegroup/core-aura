import { preferences, remember } from "../workbench/preferences";
import { engine } from "../audio/engine";
import { onOtherAudio } from "../audio/activity";
import { manifestPlayer } from "../manifestation/player";
import { QueuePlayer } from "./player";
import { PlayItem } from "./model";
export const queuePlayer = new QueuePlayer(engine, manifestPlayer, (item) => {
    if (item.kind !== "track") remember({ kind: item.kind, id: item.id });
});
onOtherAudio(() => queuePlayer.interrupt());
export async function startQueue(items: PlayItem[], name: string, saveReplay = true) {
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
