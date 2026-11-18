import { it, expect, vi, afterEach } from "vitest";
import { parsePlaylists, resolveItems } from "../src/playlists/model";
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
