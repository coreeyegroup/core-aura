import { parseSession, Session, sessionDuration } from "../model";
import { parsePlan, Plan, practiceTrackIds } from "../manifestation/model";
import type { Track } from "../tracks/storage";
import type { ItemRef } from "../workbench/preferences";
export type PlaylistRef = ItemRef | { kind: "track"; id: string };
export type Playlist = {
    id: string;
    name: string;
    items: PlaylistRef[];
    scope?: "chakras";
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
        if (p.scope !== undefined && (p.scope !== "chakras" || p.items.some(item => item.kind === "practice")))
            throw Error("Invalid chakra playlist.");
        ids.add(p.id);
    }
    return structuredClone(v);
}
export function chakraPlaylists(playlists: Playlist[], sessions: Session[]) {
    const ids = new Set(sessions.filter(row => row.kind === "chakras").map(row => row.id));
    const isChakra = (item: PlaylistRef) => item.kind === "session" && ids.has(item.id);
    return playlists.filter(playlist => playlist.scope === "chakras" ||
        playlist.items.some(isChakra) && playlist.items.every(item => item.kind === "track" || isChakra(item)));
}

export function resolveItems(refs: PlaylistRef[], plans: Plan[], sessions: Session[], tracks: Track[] = []): PlayItem[] {
    if (!refs.length || refs.length > 100)
        throw Error("Choose 1–100 saved items.");
    const trackIds = new Set(tracks.map(track => track.id));
    function checkAudio(name: string, ids: (string | undefined)[], section: string) {
        if (ids.some(id => id && !trackIds.has(id))) {
            throw Error(`“${name}” uses a missing audio file. Reimport it in Library or replace the layer in ${section}.`);
        }
    }
    return refs.map(ref => {
        if (ref.kind === "practice") {
            const plan = plans.find(plan => plan.id === ref.id);
            if (!plan) throw Error("A practice is unavailable. Edit the playlist to replace it.");
            checkAudio(plan.name, practiceTrackIds(plan), "Manifest");
            return { kind: "practice", id: ref.id, name: plan.name, plan: parsePlan(plan) };
        }
        if (ref.kind === "track") {
            const track = tracks.find(track => track.id === ref.id);
            if (!track) throw Error("An imported track is unavailable. Edit the playlist to replace it.");
            return { kind: "track", id: ref.id, name: track.title, track: { ...track } };
        }
        if (ref.kind !== "session") throw Error("Unsupported playlist item.");
        const session = sessions.find(session => session.id === ref.id);
        if (!session) throw Error("A sound session is unavailable. Edit the playlist to replace it.");
        checkAudio(session.name, [...(session.additionalLayers ?? []), ...session.channels.map(channel => channel.accompaniment)].map(layer => layer?.audio?.id),
            session.kind === "chakras" ? "Chakras" : "Sounds");
        return { kind: "session", id: ref.id, name: session.name, session: parseSession(structuredClone(session)) };
    });
}

export function itemDuration(item: PlayItem) { return item.kind === "practice" ? item.plan.seconds : item.kind === "track" ? item.track.duration : sessionDuration(item.session); }
export function durationLabel(seconds: number) { return seconds < 60 ? Math.round(seconds) + " sec" : Math.ceil(seconds / 60) + " min"; }
