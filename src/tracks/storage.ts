export const MAX_TRACK_BYTES = 50 * 1024 * 1024;
export const MAX_LIBRARY_BYTES = 200 * 1024 * 1024;
export type Track = {
    id: string;
    title: string;
    filename: string;
    bytes: number;
    duration: number;
    volume: number;
    muted: boolean;
    loop: boolean;
    createdAt: string;
};
type StoredTrack = Track & {
    blob: Blob;
};
export const trackEvent = "core-aura-tracks-changed";
export function validateTrackFile(file: {
    name: string;
    size: number;
}) {
    if (!/\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(file.name))
        throw Error("Choose MP3, WAV, M4A, AAC, OGG or FLAC audio supported by this device.");
    if (!file.size || file.size > MAX_TRACK_BYTES)
        throw Error("Each track must be between 1 byte and 50 MB.");
}
export function trackSettings(value: Partial<Track>) {
    const patch: Partial<Track> = {};
    if (value.title !== undefined) {
        if (!value.title.trim() || value.title.trim().length > 80)
            throw Error("Use a track name between 1 and 80 characters.");
        patch.title = value.title.trim();
    }
    if (value.volume !== undefined) {
        if (!Number.isFinite(value.volume) || value.volume < 0 || value.volume > 1)
            throw Error("Invalid track volume.");
        patch.volume = value.volume;
    }
    for (const key of ["muted", "loop"] as const) {
        if (value[key] !== undefined) {
            if (typeof value[key] !== "boolean")
                throw Error("Invalid track setting.");
            patch[key] = value[key];
        }
    }
    return patch;
}
function open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("core-aura-soundtracks", 1);
        request.onupgradeneeded = () => request.result.createObjectStore("tracks", { keyPath: "id" });
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(Error("Track storage is unavailable on this device."));
        request.onblocked = () => reject(Error("Close other Core-aura windows and retry."));
    });
}
async function read<T>(operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await open();
    return new Promise((resolve, reject) => {
        const tx = db.transaction("tracks", "readonly"), request = operation(tx.objectStore("tracks"));
        tx.oncomplete = () => { db.close(); resolve(request.result); };
        tx.onerror = tx.onabort = () => { db.close(); reject(Error("Tracks could not be read.")); };
    });
}
export async function tracks(): Promise<Track[]> {
    const rows = await read<StoredTrack[]>(store => store.getAll());
    return rows.map(({ blob: _blob, ...row }) => row).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
export async function trackBlob(id: string) {
    const row = await read<StoredTrack | undefined>(store => store.get(id));
    if (!row)
        throw Error("This track is no longer on the device. Import its original file again.");
    return row.blob;
}
export async function changeTrack(id: string, value: Partial<Track> | null) {
    const patch = value === null ? null : trackSettings(value), db = await open();
    return new Promise<void>((resolve, reject) => {
        const tx = db.transaction("tracks", "readwrite"), store = tx.objectStore("tracks");
        const request = store.get(id);
        request.onsuccess = () => {
            if (!request.result) {
                tx.abort();
                return;
            }
            if (patch === null)
                store.delete(id);
            else
                store.put({ ...request.result, ...patch });
        };
        tx.oncomplete = () => { db.close(); dispatchEvent(new Event(trackEvent)); resolve(); };
        tx.onabort = tx.onerror = () => { db.close(); reject(Error("Track changes could not be saved. The previous file was kept.")); };
    });
}
export async function importTrack(file: File, duration: number) {
    validateTrackFile(file);
    if (!Number.isFinite(duration) || duration <= 0 || duration > 7200)
        throw Error("Choose playable audio up to two hours long.");
    const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()));
    const id = "track:" + Array.from(hash, n => n.toString(16).padStart(2, "0")).join("");
    const row: StoredTrack = { id, title: file.name.replace(/\.[^.]+$/, "").slice(0, 80) || "Audio track", filename: file.name.slice(0, 160), bytes: file.size, duration, volume: .5, muted: false, loop: false, createdAt: new Date().toISOString(), blob: file };
    const db = await open();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("tracks", "readwrite"), store = tx.objectStore("tracks"), request = store.getAll();
        let reason = "Device storage is full or unavailable. Existing tracks were kept.";
        request.onsuccess = () => {
            const old = request.result as StoredTrack[];
            if (old.some(t => t.id === id)) {
                reason = "This audio file is already in your tracks.";
                tx.abort();
                return;
            }
            if (old.length >= 30 || old.reduce((n, t) => n + t.bytes, 0) + file.size > MAX_LIBRARY_BYTES) {
                reason = "Track library limit reached: 30 files or 200 MB. Export and remove unused tracks first.";
                tx.abort();
                return;
            }
            store.add(row);
        };
        tx.oncomplete = () => { db.close(); dispatchEvent(new Event(trackEvent)); resolve(); };
        tx.onabort = tx.onerror = () => { db.close(); reject(Error(reason)); };
    });
}
export function audioDuration(blob: Blob): Promise<number> {
    return new Promise((resolve, reject) => {
        const audio = new Audio(), url = URL.createObjectURL(blob);
        const cleanup = () => { clearTimeout(timer); audio.onloadedmetadata = audio.onerror = null; audio.removeAttribute("src"); audio.load(); URL.revokeObjectURL(url); };
        const timer = setTimeout(() => { cleanup(); reject(Error("Audio could not be read. Try another file or format.")); }, 15000);
        audio.preload = "metadata";
        audio.onloadedmetadata = () => { const duration = audio.duration; cleanup(); Number.isFinite(duration) && duration > 0 ? resolve(duration) : reject(Error("This file has no supported audio timeline.")); };
        audio.onerror = () => { cleanup(); reject(Error("This device cannot play that audio file. Try MP3 or WAV.")); };
        audio.src = url;
    });
}
