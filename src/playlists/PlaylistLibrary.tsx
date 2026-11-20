import { useRef, useState, useSyncExternalStore } from "react";
import { Plus, Play, ChevronUp, ChevronDown, Trash2, ListMusic } from "lucide-react";
import { Session } from "../model";
import { manifestationStore } from "../manifestation/store";
import type { Track } from "../tracks/storage";
import { deliverFile } from "../files/deliver";
import { playlistStore } from "./store";
import { Playlist, PlaylistRef, resolveItems, durationLabel, itemDuration } from "./model";
import { startQueue } from "./runtime";
export function PlaylistLibrary({ sessions, tracks, trackError }: {
    sessions: Session[];
    tracks: Track[];
    trackError: string;
}) {
    const { data, error } = useSyncExternalStore(playlistStore.subscribe, playlistStore.snapshot), { data: manifest } = useSyncExternalStore(manifestationStore.subscribe, manifestationStore.snapshot);
    const [editing, setEditing] = useState<Playlist | null>(null), [source, setSource] = useState(""), [message, setMessage] = useState("");
    const importInput = useRef<HTMLInputElement>(null);
    const choices = [...manifest.plans.map(p => ({ ref: { kind: "practice" as const, id: p.id }, name: p.name, type: "Manifestation" })), ...sessions.map(s => ({ ref: { kind: "session" as const, id: s.id }, name: s.name, type: s.kind === "chakras" ? "Chakra" : "Sound" })), ...tracks.map(track => ({ ref: { kind: "track" as const, id: track.id }, name: track.title, type: "Imported track" }))];
    const title = (ref: PlaylistRef) => choices.find(c => c.ref.kind === ref.kind && c.ref.id === ref.id)?.name;
    const attempt = (f: () => unknown) => { setMessage(""); try {
        void Promise.resolve(f()).catch(e => setMessage((e as Error).message));
    }
    catch (e) {
        setMessage((e as Error).message);
    } };
    function move(index: number, offset: number) { if (!editing)
        return; const items = [...editing.items]; [items[index], items[index + offset]] = [items[index + offset], items[index]]; setEditing({ ...editing, items }); }
    return <section className="playlist-library" aria-label="Playlist library"><div className="module-title"><h2><ListMusic size={18} aria-hidden="true"/> Playlists <span className="count-tag">{data.playlists.length}</span></h2><button disabled={!!editing || !!error || data.playlists.length >= 50} onClick={() => { setEditing({ id: crypto.randomUUID(), name: "", items: [] }); setSource(""); setMessage(""); }}><Plus size={16} aria-hidden="true"/> New playlist</button></div>
 <p className="content-note">Arrange saved manifestation practices, sound mixes and chakra sessions and imported tracks. Items play one after another.</p>
 {editing && <form className="playlist-editor" onSubmit={e => { e.preventDefault(); attempt(() => { playlistStore.save({ ...editing, name: editing.name.trim() }); setEditing(null); setMessage("Playlist saved."); }); }}><label>Playlist name<input aria-label="Playlist name" required maxLength={80} value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}/></label><div className="playlist-add"><label>Saved item<select aria-label="Playlist saved item" value={source} onChange={e => setSource(e.target.value)}><option value="">Choose a saved item</option>{choices.map((c, i) => <option value={i} key={c.ref.kind + c.ref.id}>{c.name} · {c.type}</option>)}</select></label><button type="button" disabled={source === "" || editing.items.length >= 100} onClick={() => { const c = choices[Number(source)]; if (c)
            setEditing({ ...editing, items: [...editing.items, c.ref] }); }}>Add item</button></div>
 {!choices.length && <p className="content-note">Save a practice in Manifest, or a mix in Sound / Chakra, then add it here.</p>}
 <ol className="playlist-items">{editing.items.map((ref, i) => <li key={i}><span><strong>{title(ref) || "Unavailable item"}</strong><small>{ref.kind === "practice" ? "Manifestation" : ref.kind === "track" ? "Imported track" : "Sound / Chakra"}</small></span><button type="button" className="icon-button" aria-label={"Move playlist item " + (i + 1) + " up"} disabled={!i} onClick={() => move(i, -1)}><ChevronUp size={17}/></button><button type="button" className="icon-button" aria-label={"Move playlist item " + (i + 1) + " down"} disabled={i === editing.items.length - 1} onClick={() => move(i, 1)}><ChevronDown size={17}/></button><button type="button" className="icon-button" aria-label={"Remove playlist item " + (i + 1)} onClick={() => setEditing({ ...editing, items: editing.items.filter((_, j) => i !== j) })}><Trash2 size={16}/></button></li>)}</ol>
 <div className="home-actions"><button className="primary" disabled={!editing.name.trim() || !editing.items.length}>Save playlist</button><button type="button" onClick={() => { if ((editing.name || editing.items.length) && !confirm("Discard unfinished playlist edits?"))
            return; setEditing(null); }}>Cancel editing</button></div></form>}
 {!data.playlists.length && !editing && <p className="content-note">No playlists yet. Create a routine from your saved content.</p>}
 {data.playlists.map(p => { let duration = 0, missing = ""; try {
        duration = resolveItems(p.items, manifest.plans, sessions, tracks).reduce((n, v) => n + itemDuration(v), 0);
    }
    catch (error) {
        missing = (error as Error).message;
    } return <article className="home-list-row" aria-label={p.name + " playlist"} key={p.id}><div><strong>{p.name}</strong><small>{p.items.length} items · {missing ? missing : durationLabel(duration) + " maximum"}</small></div><button className="icon-button primary" disabled={Boolean(missing)} aria-label={"Play playlist " + p.name} onClick={() => attempt(() => startQueue(resolveItems(p.items, manifest.plans, sessions, tracks), p.name))}><Play size={18}/></button><button disabled={!!editing} onClick={() => { setEditing(structuredClone(p)); setSource(""); }}>{missing ? "Repair playlist" : "Edit"}</button><button className="icon-button" aria-label={"Delete playlist " + p.name} onClick={() => { if (confirm("Delete this playlist? Saved practices and sound sessions remain."))
        attempt(() => playlistStore.remove(p.id)); }}><Trash2 size={16}/></button></article>; })}
 <div className="catalog-footer">
   <button disabled={!!editing || !!error} onClick={() => importInput.current?.click()}>Import playlists</button>
   <button disabled={!data.playlists.length} onClick={() => attempt(async () => {
     setMessage(await deliverFile(new Blob([JSON.stringify(data)], { type: "application/json" }), "core-aura-playlists.json"));
   })}>Export playlists</button>
   <input ref={importInput} className="sr-only" type="file" accept=".json,application/json" aria-label="Import playlist JSON"
     onChange={event => {
       const file = event.target.files?.[0];
       event.target.value = "";
       if (file) attempt(async () => {
         if (file.size > 1024 * 1024) throw Error("Choose a playlist JSON under 1 MB.");
         playlistStore.importCopies(JSON.parse(await file.text()));
         setMessage("Playlists imported. Reconnect any unavailable source items using Edit.");
       });
     }} />
 </div>
 {(message || error || trackError) && <p role="status">{message || error || trackError}</p>}
 </section>;
}
