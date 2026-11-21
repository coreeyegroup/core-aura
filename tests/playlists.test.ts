import { it, expect, vi, afterEach } from "vitest";
import { parsePlaylists, resolveItems } from "../src/playlists/model";
import { playbackReadiness } from "../src/playlists/readiness";
import { QueuePlayer } from "../src/playlists/player";
import { newPlan } from "../src/manifestation/model";
import { channel } from "../src/model";
afterEach(() => vi.useRealTimers());
const practice = { ...newPlan(), id: "practice", name: "Quiet morning", mode: "read" as const, lines: [{ id: "line", text: "I return to this moment." }] };
const session = { schemaVersion: 2 as const, engineVersion: "2.0", id: "mix", name: "Evening bowl", kind: "studio" as const, channels: [{ ...channel("bowl", 432), seconds: 1 }], master: .3, createdAt: new Date().toISOString() };
const refs = [{ kind: "practice" as const, id: practice.id }, { kind: "session" as const, id: session.id }];
function harness() { let voice: {
    status: string;
    elapsed: number;
    error?: string;
} = { status: "idle", elapsed: 0 }, states: {
    id: string;
    status: string;
    time: number;
}[] = []; const audio = { stopAll: vi.fn(() => { states = []; }), play: vi.fn(async (c: any) => { states.push({ id: c.id, status: "playing", time: 0 }); }), pause: vi.fn((id: string) => { states = states.map(s => s.id === id ? { ...s, status: "paused" } : s); }), resume: vi.fn(async (id: string) => { states = states.map(s => s.id === id ? { ...s, status: "playing" } : s); }), snapshot: () => states, setMaster: vi.fn() }, manifest = { start: vi.fn(() => { voice = { status: "playing", elapsed: 0 }; }), stop: vi.fn(() => { voice = { status: "idle", elapsed: 0 }; }), pause: vi.fn(() => { voice.status = "paused"; }), resume: vi.fn(() => { voice.status = "playing"; }), snapshot: () => voice }; return { audio, manifest, preview: () => { voice = { status: "playing", elapsed: 0, plan: { id: "preview-line" } } as any; }, end: () => { voice.status = "completed"; states = []; }, player: new QueuePlayer(audio, manifest) }; }
it("validates named ordered mixed playlists and resolves isolated run snapshots", () => { const p = { schemaVersion: 1, playlists: [{ id: "list", name: "My ritual", items: refs }] }; expect(parsePlaylists(p).playlists[0].items).toEqual(refs); for (const bad of [{ ...p, playlists: [{ ...p.playlists[0], name: " " }] }, { ...p, playlists: [{ ...p.playlists[0], items: [{ kind: "unknown", id: "a" }] }] }, { ...p, playlists: [p.playlists[0], p.playlists[0]] }])
    expect(() => parsePlaylists(bad)).toThrow(); const resolved = resolveItems(refs, [practice], [session]); resolved[0].name = "Changed"; expect(practice.name).toBe("Quiet morning"); expect(() => resolveItems([...refs, { kind: "session", id: "gone" }], [practice], [session])).toThrow(/unavailable/i); });
it("advances practice to sound, pauses without advancing, completes and supports replay", async () => { vi.useFakeTimers(); const h = harness(); try {
    await h.player.start(resolveItems(refs, [practice], [session]), "My ritual");
    expect(h.manifest.start).toHaveBeenCalledOnce();
    h.player.pause();
    h.end();
    await vi.advanceTimersByTimeAsync(500);
    expect(h.audio.play).not.toHaveBeenCalled();
    h.player.resume();
    h.end();
    await vi.advanceTimersByTimeAsync(250);
    expect(h.audio.play).toHaveBeenCalledOnce();
    expect(h.player.snapshot().index).toBe(1);
    h.player.pause();
    expect(h.audio.pause).toHaveBeenCalled();
    await h.player.resume();
    h.end();
    await vi.advanceTimersByTimeAsync(250);
    expect(h.player.snapshot().status).toBe("completed");
    expect(h.player.snapshot().items).toHaveLength(2);
}
finally {
    h.player.dispose();
} });
it("cancels queue ownership on external audio and does not advance after Stop", async () => { vi.useFakeTimers(); const h = harness(); try {
    await h.player.start(resolveItems(refs, [practice], [session]), "Ritual");
    h.player.interrupt();
    h.end();
    await vi.advanceTimersByTimeAsync(500);
    expect(h.audio.play).not.toHaveBeenCalled();
    expect(h.player.snapshot().status).toBe("idle");
    await h.player.start(resolveItems([refs[1]], [practice], [session]), "Sound");
    h.player.stop();
    await vi.advanceTimersByTimeAsync(500);
    expect(h.player.snapshot().status).toBe("idle");
}
finally {
    h.player.dispose();
} });
it("keeps a queue paused when an asynchronous audio start finishes after Pause", async () => { const h = harness(); let done!: () => void; h.audio.play.mockImplementation(async (c: any) => { await new Promise<void>(r => done = r); }); try {
    const pending = h.player.start(resolveItems([refs[1]], [practice], [session]), "Sound");
    h.player.pause();
    done();
    await pending;
    expect(h.player.snapshot().status).toBe("paused");
    expect(h.audio.pause).toHaveBeenCalled();
}
finally {
    h.player.dispose();
} });
it("surfaces audio errors and handles previous/next without replaying stopped asynchronous work", async () => { const h = harness(); try {
    await h.player.start(resolveItems(refs, [practice], [session]), "Ritual");
    await h.player.next();
    expect(h.player.snapshot().index).toBe(1);
    await h.player.previous();
    expect(h.player.snapshot().index).toBe(0);
    h.audio.play.mockRejectedValueOnce(Error("Unavailable output"));
    await h.player.next();
    expect(h.player.snapshot().status).toBe("error");
    expect(h.player.snapshot().error).toContain("Unavailable output");
}
finally {
    h.player.dispose();
} });
it("relinquishes a practice queue when a sentence preview takes over without stopping the preview", async () => { vi.useFakeTimers(); const h = harness(); try {
    await h.player.start(resolveItems(refs, [practice], [session]), "Ritual");
    h.preview();
    const stops = h.manifest.stop.mock.calls.length;
    await vi.advanceTimersByTimeAsync(250);
    expect(h.player.snapshot().status).toBe("idle");
    expect(h.manifest.stop.mock.calls.length).toBe(stops);
    expect(h.audio.play).not.toHaveBeenCalled();
}
finally {
    h.player.dispose();
} });
it("prepares a skipped item silently while paused and starts it only on Resume", async () => { const h = harness(); try {
    await h.player.start(resolveItems(refs, [practice], [session]), "Ritual");
    h.player.pause();
    await h.player.next();
    expect(h.audio.play).not.toHaveBeenCalled();
    expect(h.player.snapshot().status).toBe("paused");
    await h.player.resume();
    expect(h.audio.play).toHaveBeenCalledOnce();
    h.player.pause();
    const starts = h.manifest.start.mock.calls.length;
    await h.player.previous();
    expect(h.manifest.start.mock.calls.length).toBe(starts);
    await h.player.resume();
    expect(h.manifest.start.mock.calls.length).toBe(starts + 1);
}
finally {
    h.player.dispose();
} });
it("preserves corrupt playlist storage and refuses writes until recovery", async () => { const values = new Map([["core-aura.playlists.v1", "broken data"]]); vi.stubGlobal("localStorage", { getItem: (k: string) => values.get(k) || null, setItem: (k: string, v: string) => values.set(k, v) }); try {
    vi.resetModules();
    const { playlistStore } = await import("../src/playlists/store");
    expect(playlistStore.snapshot().error).toContain("preserved");
    expect(() => playlistStore.save({ id: "p", name: "Morning", items: refs })).toThrow();
    expect(values.get("core-aura.playlists.v1")).toBe("broken data");
}
finally {
    vi.unstubAllGlobals();
    vi.resetModules();
} });

it("plays saved chakra channels in order and keeps the transition gap paused", async () => {
    vi.useFakeTimers();
    const h = harness();
    const root = { ...channel("sine", 396), id: "root", seconds: 1 };
    const sacral = { ...channel("sine", 417), id: "sacral", seconds: 1 };
    const sequence = {
        ...session, id: "chakra-sequence", kind: "chakras" as const,
        channels: [root, sacral], sequenceGap: 1,
    };
    try {
        await h.player.start(resolveItems([{ kind: "session", id: sequence.id }], [], [sequence]), "Chakras");
        expect(h.audio.play.mock.calls.map(([value]) => value.hz)).toEqual([396]);
        h.end();
        await vi.advanceTimersByTimeAsync(600);
        h.player.pause();
        await vi.advanceTimersByTimeAsync(1500);
        expect(h.audio.play).toHaveBeenCalledTimes(1);
        await h.player.resume();
        await vi.advanceTimersByTimeAsync(800);
        expect(h.audio.play.mock.calls.map(([value]) => value.hz)).toEqual([396, 417]);
        h.end();
        await vi.advanceTimersByTimeAsync(250);
        expect(h.player.snapshot()).toMatchObject({ status: "completed", elapsed: 3 });
    } finally {
        h.player.dispose();
    }
});

it("identifies missing audio layers before starting a practice or mix from a queue", () => {
    const id = "track:" + "a".repeat(64);
    const accompaniment = { audio: { id, volume: .2, loop: true } };
    const layered = { ...practice, accompaniment };
    expect(() => resolveItems([refs[0]], [layered], [])).toThrow(/Quiet morning.*missing audio file.*Manifest/);
    const layeredMix = { ...session, channels: [{ ...session.channels[0], accompaniment }] };
    expect(() => resolveItems([refs[1]], [], [layeredMix])).toThrow(/Evening bowl.*missing audio file.*Sounds/);
    const track = { id, title: "Rain", filename: "Rain.wav", duration: 30, bytes: 1000,
        createdAt: "2026-11-20T00:00:00Z", volume: .5, muted: false, loop: false };
    expect(resolveItems(refs, [layered], [layeredMix], [track])).toHaveLength(2);
});

it("distinguishes local recordings, silent reading and same-language device speech", () => {
    const line = { id: "line", text: "Stay present.", recordingId: "clip", recordedText: "Stay present.", audioAffirmation: true as const };
    const voice = { name: "Voice", lang: "fr-FR", voiceURI: "device-fr", localService: true };
    const english = { ...voice, lang: "en-US" };
    const spoken = { ...practice, mode: "speech" as const, voice: "core:fr-fr", lines: [line, { id: "text", text: "Texte" }] };
    const items = resolveItems([refs[0]], [spoken], []);
    const clip = { id: "clip", text: "Clip title", kind: "affirmation" as const };
    expect(playbackReadiness(items, {}).status).toBe("checking");
    expect(playbackReadiness(items, { clips: new Map(), voices: [voice] }).status).toBe("repair");
    const clips = new Map([[clip.id, clip]]);
    expect(playbackReadiness(items, { clips, voices: [english] }).status).toBe("connection");
    expect(playbackReadiness(items, { clips, voices: [voice] }).status).toBe("ready");
    expect(playbackReadiness(resolveItems([refs[0]], [practice], []), {}).status).toBe("ready");
});

it("checks imported audio inside an attached practice background mix", () => {
    const id = "track:" + "b".repeat(64);
    const backgroundMix = { name: "Rain bed", master: .5, volume: .3,
        channels: [{ ...session.channels[0], accompaniment: { audio: { id, volume: .2, loop: true } } }] };
    expect(() => resolveItems([refs[0]], [{ ...practice, backgroundMix }], [])).toThrow(/Quiet morning.*missing audio file/);
});

it("keeps session audio across chakra sequence gaps and stops it at completion", async () => {
    vi.useFakeTimers();
    const h = harness();
    const source = { id: "track:" + "a".repeat(64), volume: .2, loop: true };
    const chakraSession = {
        ...session, kind: "chakras" as const, sequenceGap: 1,
        channels: [
            { ...channel("sine", 396), id: "root", seconds: 1 },
            { ...channel("sine", 417), id: "sacral", seconds: 1 },
        ],
        additionalLayers: [{ audio: source }],
    };
    const selection = [{ kind: "session" as const, id: chakraSession.id }];
    expect(() => resolveItems(selection, [], [chakraSession])).toThrow(/missing audio file/);
    const items = resolveItems(selection, [], [chakraSession], [{
        ...source, title: "Background", filename: "background.wav", bytes: 100,
        duration: 1, muted: false, createdAt: session.createdAt,
    }]);
    try {
        await h.player.start(items, "Quiet chakras");
        const layer = h.audio.play.mock.calls.find(([voice]) => voice.accompaniment)?.[0];
        expect(layer.accompaniment.audio).toEqual(source);
        const expireChakra = () => {
            const voices = h.audio.snapshot();
            voices.splice(0, voices.length, ...voices.filter(voice => voice.id === layer.id));
        };
        expireChakra();
        await vi.advanceTimersByTimeAsync(200);
        h.player.pause();
        expect(h.audio.snapshot()).toEqual([{ id: layer.id, status: "paused", time: 0 }]);
        await vi.advanceTimersByTimeAsync(1200);
        expect(h.audio.play).toHaveBeenCalledTimes(2);
        await h.player.resume();
        await vi.advanceTimersByTimeAsync(1000);
        expect(h.audio.play).toHaveBeenCalledTimes(3);
        expect(h.audio.snapshot().some(voice => voice.id === layer.id)).toBe(true);
        expireChakra();
        await vi.advanceTimersByTimeAsync(300);
        expect(h.player.snapshot().status).toBe("completed");
        expect(h.audio.snapshot()).toEqual([]);
    } finally { h.player.dispose(); }
});
