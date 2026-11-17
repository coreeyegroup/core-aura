import type { VoiceState } from "./engine";
export type TrackLevel = {
    volume: number;
    muted: boolean;
    loop: boolean;
};
type Running = {
    audio: HTMLAudioElement;
    source: MediaElementAudioSourceNode;
    gain: GainNode;
    url: string;
    level: TrackLevel;
};
export class TrackPlayer {
    private running = new Map<string, Running>();
    private pending = new Map<string, symbol>();
    master = .5;
    constructor(private connect: () => Promise<{
        context: AudioContext;
        analyser: AnalyserNode;
    }>, private changed: () => void) { }
    snapshot(): VoiceState[] {
        return [...this.running].map(([id, r]) => ({ id, status: r.audio.paused ? "paused" : "playing", time: r.audio.currentTime, duration: Number.isFinite(r.audio.duration) ? r.audio.duration : 0 }));
    }
    private apply(r: Running) {
        r.audio.loop = r.level.loop;
        r.gain.gain.setTargetAtTime(r.level.muted ? 0 : r.level.volume * this.master * .2, r.gain.context.currentTime, .025);
    }
    patch(id: string, level: TrackLevel) {
        const r = this.running.get(id);
        if (r) {
            r.level = level;
            this.apply(r);
            this.changed();
        }
    }
    setMaster(value: number) {
        this.master = value;
        this.running.forEach(r => this.apply(r));
    }
    async toggle(id: string, load: () => Promise<Blob>, level: TrackLevel) {
        const r = this.running.get(id);
        if (r && !r.audio.paused) {
            this.pause(id);
            return;
        }
        if (r) {
            await this.resume(id);
            return;
        }
        if (this.pending.has(id))
            return;
        if (this.running.size + this.pending.size >= 3)
            throw Error("Up to three imported tracks can play together. Stop another track first.");
        const token = Symbol(id);
        this.pending.set(id, token);
        try {
            const { context, analyser } = await this.connect();
            const blob = await load();
            if (this.pending.get(id) !== token)
                return;
            const audio = new Audio(), url = URL.createObjectURL(blob), gain = context.createGain();
            let source: MediaElementAudioSourceNode;
            try {
                source = context.createMediaElementSource(audio);
            }
            catch (error) {
                URL.revokeObjectURL(url);
                gain.disconnect();
                throw error;
            }
            source.connect(gain).connect(analyser);
            const current: Running = { audio, url, source, gain, level };
            this.running.set(id, current);
            this.pending.delete(id);
            audio.preload = "auto";
            audio.src = url;
            this.apply(current);
            audio.ontimeupdate = audio.onplay = audio.onpause = () => this.changed();
            audio.onended = () => this.stop(id);
            audio.onerror = () => {
                if (this.running.get(id) !== current)
                    return;
                this.stop(id);
                dispatchEvent(new CustomEvent("core-aura-track-error", { detail: "An audio track could not continue. Try its original file or another format." }));
            };
            try {
                await audio.play();
            }
            catch (error) {
                if (this.running.get(id) !== current)
                    return;
                this.stop(id);
                throw error;
            }
            if (this.running.get(id) === current)
                this.changed();
        }
        finally {
            if (this.pending.get(id) === token)
                this.pending.delete(id);
        }
    }
    async resume(id: string) {
        const r = this.running.get(id);
        if (!r)
            return;
        await this.connect();
        if (this.running.get(id) !== r)
            return;
        await r.audio.play();
        this.changed();
    }
    pause(id: string) { const r = this.running.get(id); if (r) {
        r.audio.pause();
        this.changed();
    } }
    seek(id: string, time: number) {
        const r = this.running.get(id);
        if (r && Number.isFinite(time) && Number.isFinite(r.audio.duration)) {
            r.audio.currentTime = Math.max(0, Math.min(r.audio.duration - .01, time));
            this.changed();
        }
    }
    stop(id: string) {
        this.pending.delete(id);
        const r = this.running.get(id);
        if (!r)
            return;
        this.running.delete(id);
        r.audio.ontimeupdate = r.audio.onplay = r.audio.onpause = r.audio.onended = r.audio.onerror = null;
        r.audio.pause();
        r.audio.removeAttribute("src");
        r.audio.load();
        r.source.disconnect();
        r.gain.disconnect();
        URL.revokeObjectURL(r.url);
        this.changed();
    }
    stopAll() { this.pending.clear(); [...this.running.keys()].forEach(id => this.stop(id)); }
}
