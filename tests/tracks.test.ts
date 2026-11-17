import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { MAX_TRACK_BYTES, trackSettings, validateTrackFile } from "../src/tracks/storage";
import { TrackPlayer } from "../src/audio/tracks";
const level = { volume: .5, muted: false, loop: false };
let audios: any[] = [];
class Media {
    paused = true;
    currentTime = 0;
    duration = 30;
    loop = false;
    src = "";
    preload = "";
    onplay?: () => void;
    onpause?: () => void;
    onended?: () => void;
    constructor() { audios.push(this); }
    async play() { this.paused = false; this.onplay?.(); }
    pause() { this.paused = true; this.onpause?.(); }
    removeAttribute() { this.src = ""; }
    load() { }
}
function player() {
    const gains: any[] = [];
    const context: any = { currentTime: 0, createGain: () => { const gain: any = { context, gain: { setTargetAtTime: vi.fn() }, disconnect: vi.fn(), connect: vi.fn() }; gains.push(gain); return gain; }, createMediaElementSource: () => ({ connect: (gain: any) => ({ connect: vi.fn() }), disconnect: vi.fn() }) };
    return { player: new TrackPlayer(async () => ({ context, analyser: {} as any }), vi.fn()), gains };
}
beforeEach(() => { audios = []; vi.stubGlobal("Audio", Media); vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:track"); vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => { }); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it("validates file bounds, codecs and editable fields", () => {
    for (const name of ["music.mp3", "bowl.wav", "recording.m4a", "wind.ogg", "rain.flac", "voice.aac"])
        expect(() => validateTrackFile({ name, size: 100 })).not.toThrow();
    for (const size of [0, MAX_TRACK_BYTES + 1])
        expect(() => validateTrackFile({ name: "x.mp3", size })).toThrow();
    expect(() => validateTrackFile({ name: "x.exe", size: 100 })).toThrow();
    expect(trackSettings({ title: " Rain ", volume: .3, loop: true, muted: false, id: "ignored" })).toEqual({ title: "Rain", volume: .3, loop: true, muted: false });
    expect(() => trackSettings({ volume: NaN })).toThrow();
    expect(() => trackSettings({ title: " " })).toThrow();
});
it("preserves position on pause/resume, bounds seek, applies master/mute/repeat and releases resources", async () => {
    const { player: p, gains } = player();
    await p.toggle("track:one", async () => new Blob(["audio"]), level);
    expect(p.snapshot()[0].status).toBe("playing");
    p.seek("track:one", 7);
    p.pause("track:one");
    expect(p.snapshot()[0]).toMatchObject({ status: "paused", time: 7 });
    await p.resume("track:one");
    expect(p.snapshot()[0].time).toBe(7);
    p.patch("track:one", { ...level, loop: true, muted: true });
    expect(audios[0].loop).toBe(true);
    expect(gains[0].gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 0, .025);
    p.setMaster(.2);
    p.patch("track:one", level);
    expect(gains[0].gain.setTargetAtTime.mock.lastCall[0]).toBeCloseTo(.02, 10);
    p.seek("track:one", 999);
    expect(p.snapshot()[0].time).toBeLessThan(30);
    p.seek("track:one", -10);
    expect(p.snapshot()[0].time).toBe(0);
    p.stopAll();
    expect(p.snapshot()).toEqual([]);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:track");
    expect(gains[0].disconnect).toHaveBeenCalled();
});
it("bounds concurrent tracks and cancels an import load when Stop all is used", async () => {
    const { player: p } = player();
    for (let i = 0; i < 3; i++)
        await p.toggle("track:" + i, async () => new Blob(["a"]), level);
    await expect(p.toggle("track:four", async () => new Blob(["a"]), level)).rejects.toThrow("three");
    p.stopAll();
    let finish!: (blob: Blob) => void;
    const deferred = new Promise<Blob>(resolve => finish = resolve);
    const pending = p.toggle("track:pending", () => deferred, level);
    await Promise.resolve();
    p.stopAll();
    finish(new Blob(["audio"]));
    await pending;
    expect(p.snapshot()).toEqual([]);
});
