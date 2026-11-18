import { parseSession, Session, sessionDuration } from "../model";
import { parsePlan, Plan } from "../manifestation/model";
import type { Track } from "../tracks/storage";
import type { ItemRef } from "../workbench/preferences";
export type PlaylistRef = ItemRef | { kind: "track"; id: string };
export type Playlist = {
    id: string;
    name: string;
    items: PlaylistRef[];
};
export type PlaylistData = {
    schemaVersion: 1;
    playlists: Playlist[];
};
export type PlayItem = {
    kind: "practice";
    id: string;
    name: string;
    plan: Plan;
} | {
    kind: "session";
    id: string;
    name: string;
    session: Session;
} | {
    kind: "track";
    id: string;
    name: string;
    track: Track;
};
export function parsePlaylists(value: unknown): PlaylistData {
    const v = value as PlaylistData;
    if (!v || v.schemaVersion !== 1 || !Array.isArray(v.playlists) || v.playlists.length > 50)
        throw Error("Invalid playlist library.");
    const ids = new Set<string>();
    for (const p of v.playlists) {
        if (!p || typeof p.id !== "string" || !p.id || p.id.length > 100 || ids.has(p.id) || typeof p.name !== "string" || !p.name.trim() || p.name.length > 80 || !Array.isArray(p.items) || !p.items.length || p.items.length > 100 || p.items.some(r => !r || !["practice", "session", "track"].includes(r.kind) || typeof r.id !== "string" || !r.id || r.id.length > 100))
            throw Error("A playlist needs a name and 1–100 saved items.");
        ids.add(p.id);
    }
    return structuredClone(v);
}
export function resolveItems(refs: PlaylistRef[], plans: Plan[], sessions: Session[], tracks: Track[] = []): PlayItem[] {
    if (!refs.length || refs.length > 100)
        throw Error("Choose 1–100 saved items.");
    return refs.map(r => { if (r.kind === "practice") {
        const p = plans.find(p => p.id === r.id);
        if (!p)
            throw Error("A practice is unavailable. Edit the playlist to replace it.");
        return { kind: "practice", id: r.id, name: p.name, plan: parsePlan(structuredClone(p)) };
    } if (r.kind === "track") {
        const track = tracks.find(item => item.id === r.id);
        if (!track) throw Error("An imported track is unavailable. Edit the playlist to replace it.");
        return { kind: "track", id: r.id, name: track.title, track: { ...track } };
    } if (r.kind !== "session")
        throw Error("Unsupported playlist item."); const s = sessions.find(s => s.id === r.id); if (!s)
        throw Error("A sound session is unavailable. Edit the playlist to replace it."); return { kind: "session", id: r.id, name: s.name, session: parseSession(structuredClone(s)) }; });
}
export function itemDuration(item: PlayItem) { return item.kind === "practice" ? item.plan.seconds : item.kind === "track" ? item.track.duration : sessionDuration(item.session); }
export function durationLabel(seconds: number) { return seconds < 60 ? Math.round(seconds) + " sec" : Math.ceil(seconds / 60) + " min"; }
