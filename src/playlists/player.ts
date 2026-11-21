import { trackBlob } from "../tracks/storage";
import type { TrackLevel } from "../audio/tracks";
import type { Plan } from "../manifestation/model";
import type { Channel } from "../model";
import { sessionDuration } from "../model";
import { PlayItem, itemDuration } from "./model";
type Audio = {
    stop?: (id: string) => void;
    stopAll: () => void;
    toggleSoundtrack?: (id: string, load: () => Promise<Blob>, level: TrackLevel) => Promise<void>;
    play: (c: Channel) => Promise<void>;
    playGroup?: (channels: Channel[]) => Promise<void>;
    pause: (id: string) => void;
    resume: (id: string) => Promise<void>;
    snapshot: () => {
        id: string;
        status: string;
        time: number;
    }[];
    setMaster: (v: number) => void;
};
type Manifest = {
    start: (p: Plan, options: {
        replace: boolean;
    }) => void;
    stop: () => void;
    pause: () => void;
    resume: () => void;
    snapshot: () => {
        status: string;
        elapsed: number;
        error?: string;
        plan?: {
            id: string;
        } | null;
    };
};
export type QueueState = {
    status: "idle" | "playing" | "paused" | "completed" | "error";
    name: string;
    items: PlayItem[];
    index: number;
    elapsed: number;
    error: string;
    output: number;
};
export class QueuePlayer {
    private state: QueueState = { status: "idle", name: "", items: [], index: 0, elapsed: 0, error: "", output: .5 };
    private listeners = new Set<() => void>();
    private timer?: ReturnType<typeof setInterval>;
    private generation = 0;
    private ids: string[] = [];
    private accompanimentIds: string[] = [];
    private seen = false;
    private loading = false;
    private needsLaunch = false;
    private stage = 0;
    private stageOffset = 0;
    private gapRemaining = 0;
    private gapStarted = 0;
    acting = false;
    constructor(private audio: Audio, private manifest: Manifest, private onStarted?: (item: PlayItem) => void) { }
    snapshot = () => this.state;
    subscribe = (f: () => void) => { this.listeners.add(f); return () => { this.listeners.delete(f); }; };
    private update(p: Partial<QueueState>) { this.state = { ...this.state, ...p }; this.listeners.forEach(f => f()); }
    private own<T>(f: () => T): T { const previous = this.acting; this.acting = true; try {
        return f();
    }
    finally {
        this.acting = previous;
    } }
    setOutput(value: number) { if (!Number.isFinite(value) || value < 0 || value > 1)
        return; this.audio.setMaster(value); this.update({ output: value }); }
    private clear() { if (this.timer)
        clearInterval(this.timer); this.timer = undefined; }
    private halt() {
        this.generation++;
        this.loading = false;
        this.needsLaunch = false;
        this.stage = this.stageOffset = this.gapRemaining = this.gapStarted = 0;
        this.clear();
        this.own(() => {
            this.ids.forEach(id => this.audio.pause(id));
            this.manifest.stop();
            this.audio.stopAll();
        });
        this.ids = [];
        this.accompanimentIds = [];
    }
    async start(items: PlayItem[], name: string) { if (!items.length)
        throw Error("Choose a saved item to play."); this.halt(); this.update({ items: structuredClone(items), name, index: 0, status: "playing", elapsed: 0, error: "" }); await this.launch(); }
    private async launchStage(item: Extract<PlayItem, { kind: "session" }>, token: number) {
        const channels = item.session.sequenceGap === undefined
            ? item.session.channels : [item.session.channels[this.stage]];
        this.ids = channels.map((_, index) => "queue:" + token + ":" + this.stage + ":" + index);
        const voices = channels.map((channel, index) => ({ ...channel, id: this.ids[index] }));
        if (voices.length > 1 && item.session.kind === "chakras" && this.audio.playGroup)
            await this.own(() => this.audio.playGroup!(voices));
        else
            await Promise.all(voices.map(voice => this.own(() => this.audio.play(voice))));
        if (token !== this.generation) return;
        this.seen = true;
        if (this.state.status === "paused") this.ids.forEach(id => this.audio.pause(id));
    }
    private async launch() {
        const item = this.state.items[this.state.index];
        if (!item)
            return;
        const token = ++this.generation;
        this.seen = false;
        this.loading = true;
        try {
            if (item.kind === "practice") {
                this.own(() => this.manifest.start(item.plan, { replace: true }));
                this.seen = true;
            }
            else if (item.kind === "track") {
                if (!this.audio.toggleSoundtrack) throw Error("Imported track playback is unavailable.");
                this.ids = ["track:queue:" + token];
                await this.own(() => this.audio.toggleSoundtrack!(this.ids[0], () => trackBlob(item.id), {
                    volume: item.track.volume, muted: item.track.muted, loop: false,
                }));
                if (token !== this.generation) return;
                this.seen = true;
                if (this.state.status === "paused") this.audio.pause(this.ids[0]);
            }
            else {
                this.setOutput(item.session.master);
                const layers = item.session.additionalLayers ?? [];
                this.accompanimentIds = layers.map((_, index) => "queue:accompaniment:" + token + ":" + index);
                await Promise.all([
                    ...layers.map((accompaniment, index) => this.own(() => this.audio.play({
                        id: this.accompanimentIds[index], sound: "sine", hz: 432, volume: 0, muted: false,
                        // The queue stops these layers at the end, including time spent in sequence gaps.
                        seconds: Math.ceil(sessionDuration(item.session)) + 10, accompaniment,
                    }))),
                    this.launchStage(item, token),
                ]);
                if (token === this.generation && this.state.status === "paused")
                    this.accompanimentIds.forEach(id => this.audio.pause(id));
            }
            if (token !== this.generation)
                return;
            this.loading = false;
            this.onStarted?.(item);
            this.timer = setInterval(() => this.tick(), 200);
        }
        catch (e) {
            if (token !== this.generation)
                return;
            this.halt();
            this.update({ status: "error", error: (e as Error).message || "Playback could not start. Try again." });
        }
    }
    private tick() {
        if (this.state.status !== "playing" || this.loading)
            return;
        const item = this.state.items[this.state.index];
        if (!item)
            return;
        if (item.kind === "practice") {
            const p = this.manifest.snapshot();
            if (p.plan && p.plan.id !== item.plan.id) {
                this.generation++;
                this.clear();
                this.ids.forEach(id => this.audio.stop?.(id));
                this.ids = [];
                this.update({ status: "idle", elapsed: 0 });
                return;
            }
            this.update({ elapsed: p.elapsed });
            if (p.status === "error") {
                this.halt();
                this.update({ status: "error", error: p.error || "Practice playback failed." });
                return;
            }
            if (p.status === "completed")
                void this.next();
            else if (p.status === "idle")
                this.interrupt();
            else if (p.status === "paused")
                this.update({ status: "paused" });
        }
        else {
            if (this.gapRemaining > 0) {
                const passed = (Date.now() - this.gapStarted) / 1000;
                if (passed < this.gapRemaining) {
                    this.update({ elapsed: this.stageOffset - this.gapRemaining + passed });
                    return;
                }
                this.gapRemaining = 0;
                if (item.kind === "session") void this.advanceStage(item);
                return;
            }
            const voices = this.audio.snapshot().filter(v => this.ids.includes(v.id) && v.status !== "stopping");
            if (voices.length) {
                this.update({ elapsed: this.stageOffset + Math.max(...voices.map(v => v.time)) });
                if (voices.every(v => v.status === "paused"))
                    this.update({ status: "paused" });
            }
            else if (this.seen) {
                if (item.kind === "session" && item.session.sequenceGap !== undefined &&
                    this.stage + 1 < item.session.channels.length) {
                    this.stageOffset += item.session.channels[this.stage].seconds + item.session.sequenceGap;
                    this.stage++;
                    this.gapRemaining = item.session.sequenceGap;
                    this.gapStarted = Date.now();
                    if (!this.gapRemaining) void this.advanceStage(item);
                } else void this.next();
            }
        }
    }
    private async advanceStage(item: Extract<PlayItem, { kind: "session" }>) {
        const token = this.generation;
        this.loading = true;
        this.seen = false;
        try {
            await this.launchStage(item, token);
            if (token === this.generation) {
                this.loading = false;
                if (this.state.status === "paused") this.accompanimentIds.forEach(id => this.audio.pause(id));
            }
        } catch (error) {
            if (token !== this.generation) return;
            this.halt();
            this.update({ status: "error", error: (error as Error).message || "The chakra sequence could not continue." });
        }
    }
    pause() {
        if (this.state.status !== "playing") return;
        if (this.gapRemaining > 0) {
            this.gapRemaining = Math.max(.001, this.gapRemaining - (Date.now() - this.gapStarted) / 1000);
        }
        this.update({ status: "paused" });
        if (!this.loading) this.accompanimentIds.forEach(id => this.audio.pause(id));
        if (this.loading) return;
        this.own(() => {
            if (this.state.items[this.state.index]?.kind === "practice") this.manifest.pause();
            else this.ids.forEach(id => this.audio.pause(id));
        });
    }
    async resume() {
        if (this.state.status !== "paused") return;
        this.update({ status: "playing" });
        if (this.loading) return;
        if (this.needsLaunch) {
            this.needsLaunch = false;
            await this.launch();
            return;
        }

        const token = this.generation;
        const inGap = this.gapRemaining > 0;
        if (inGap) this.gapStarted = Date.now();
        try {
            if (this.accompanimentIds.length)
                await Promise.all(this.accompanimentIds.map(id => this.own(() => this.audio.resume(id))));
            if (token !== this.generation || this.snapshot().status !== "playing" || inGap) return;
            if (this.state.items[this.state.index]?.kind === "practice") {
                this.own(() => this.manifest.resume());
            } else {
                await Promise.all(this.ids.map(id => this.own(() => this.audio.resume(id))));
            }
        } catch (error) {
            if (token !== this.generation) return;
            this.halt();
            this.update({ status: "error", error: (error as Error).message });
        }
    }
    async next() { if (!["playing", "paused"].includes(this.state.status))
        return; const index = this.state.index + 1, paused = this.state.status === "paused"; this.halt(); if (index >= this.state.items.length) {
        this.update({ status: "completed", elapsed: itemDuration(this.state.items[this.state.index]) });
        return;
    } this.update({ index, elapsed: 0, status: paused ? "paused" : "playing" }); if (paused) {
        this.needsLaunch = true;
        return;
    } await this.launch(); }
    async previous() { if (!["playing", "paused"].includes(this.state.status))
        return; const index = Math.max(0, this.state.index - 1), paused = this.state.status === "paused"; this.halt(); this.update({ index, elapsed: 0, status: paused ? "paused" : "playing" }); if (paused) {
        this.needsLaunch = true;
        return;
    } await this.launch(); }
    stop() { if (!["playing", "paused", "error"].includes(this.state.status))
        return; this.halt(); this.update({ status: "idle", elapsed: 0 }); }
    interrupt() { if (this.acting || !["playing", "paused"].includes(this.state.status))
        return; this.halt(); this.update({ status: "idle", elapsed: 0 }); }
    dispose() { this.halt(); this.listeners.clear(); }
}
