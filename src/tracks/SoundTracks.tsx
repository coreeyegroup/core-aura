import { confirmSourceDeletion } from "../playlists/store";
import {prepareSound} from "../workbench/actions";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Play, Pause, Square, Plus, Volume2, VolumeX } from "lucide-react";
import { engine } from "../audio/engine";
import { deliverFile } from "../files/deliver";
import { audioDuration, changeTrack, importTrack, tracks, Track, trackBlob, trackEvent, validateTrackFile } from "./storage";
const clock = (n: number) => Math.floor(Math.max(0, n) / 60) + ":" + String(Math.floor(Math.max(0, n) % 60)).padStart(2, "0");
export function SoundTracks({ defaultOpen = false }: { defaultOpen?: boolean } = {}) {
    const [rows, setRows] = useState<Track[]>([]), [message, setMessage] = useState(""), [busy, setBusy] = useState("");
    const [editing, setEditing] = useState(""), [title, setTitle] = useState("");
    const input = useRef<HTMLInputElement>(null), alive = useRef(true), states = useSyncExternalStore(engine.subscribe, engine.snapshot);
    useEffect(() => {
        alive.current = true;
        const refresh = () => tracks().then(rows => {
            if (alive.current) {
                setRows(rows);
            }
        }).catch(e => { if (alive.current) setMessage(e.message); });
        const error = (event: Event) => setMessage((event as CustomEvent<string>).detail);
        void refresh();
        addEventListener(trackEvent, refresh);
        addEventListener("core-aura-track-error", error);
        return () => { alive.current = false; removeEventListener(trackEvent, refresh); removeEventListener("core-aura-track-error", error); };
    }, []);
    async function add(files: File[]) {
        if (busy)
            return;
        setBusy("import");
        setMessage("Checking audio files…");
        let added = 0;
        const errors: string[] = [];
        for (const file of files.slice(0, 30)) {
            try {
                validateTrackFile(file);
                const duration = await audioDuration(file);
                await importTrack(file, duration);
                added++;
            }
            catch (e) {
                errors.push(file.name + ": " + (e as Error).message);
            }
        }
        if (files.length > 30)
            errors.push("Select at most 30 files per import.");
        if (alive.current) {
            setBusy("");
            setMessage(added + " track(s) added." + (errors.length ? " " + errors.join(" ") : ""));
        }
    }
    async function run(action: () => Promise<unknown>, key: string) {
        setBusy(key);
        setMessage("");
        try {
            const result = await action();
            if (alive.current && typeof result === "string")
                setMessage(result);
        }
        catch (e) {
            if (alive.current)
                setMessage((e as Error).message);
        }
        finally {
            if (alive.current)
                setBusy("");
        }
    }
    async function patch(row: Track, patch: Partial<Track>) {
        try {
            const updated = await changeTrack(row.id, patch);
            if (updated) engine.patchSoundtrack(row.id, updated);
        }
        catch (e) {
            setMessage((e as Error).message);
        }
    }
    return <details className="soundtrack-panel" id="soundtracks" open={defaultOpen || undefined}>
    <summary>{defaultOpen ? "Your tracks" : "Sound tracks"} <span>{rows.length} on device · {states.filter(s => s.id.startsWith("track:") && !s.id.startsWith("track:queue:") && s.status === "playing").length} playing</span></summary>
    <div className="track-toolbar">
      <button onClick={() => input.current?.click()} disabled={Boolean(busy)}><Plus size={17}/> Add audio</button>
      <button disabled={!states.some(s => s.id.startsWith("track:") && !s.id.startsWith("track:queue:"))} onClick={() => states.filter(s => s.id.startsWith("track:") && !s.id.startsWith("track:queue:")).forEach(s => engine.stop(s.id))}><Square size={16}/> Stop tracks</button>
    </div>
    <input ref={input} className="sr-only" aria-label="Import sound tracks" type="file" multiple accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac" onChange={e => { const files = Array.from(e.target.files || []); e.target.value = ""; if (files.length)
        void add(files); }}/>
    <p className="content-note">Mix up to 3 audio files with chakra or generated layers.</p>
    {!rows.length && <p className="content-note">No sound tracks yet. Add music, nature sounds or a recording from your device.</p>}
    <div className="track-list">{rows.map(row => {
            const state = states.find(s => s.id === row.id), playing = state?.status === "playing", position = state?.time || 0;
            return <article className="soundtrack-row" key={row.id} aria-label={row.title + " sound track"}>
        <div className="track-head"><div><strong>{row.title}</strong><small>{clock(row.duration)} · {(row.bytes / 1024 / 1024).toFixed(1)} MB · {row.muted ? "Muted" : state ? state.status : "Ready"}{row.loop ? " · Repeat" : ""}</small></div>
          <button className="icon-button primary" disabled={Boolean(busy)} aria-label={(playing ? "Pause " : state ? "Resume " : "Play ") + row.title} onClick={() => {if(!state&&!prepareSound([row.id],true))return;void run(() => engine.toggleSoundtrack(row.id, () => trackBlob(row.id), row), row.id);}}>{playing ? <Pause size={19}/> : <Play size={19}/>}</button>
          <button className="icon-button" aria-label={"Stop " + row.title} disabled={!state && busy !== row.id} onClick={() => engine.stop(row.id)}><Square size={17}/></button>
        </div>
        <label className="track-seek"><span className="sr-only">{row.title + " position"}</span><input aria-label={row.title + " position"} type="range" min="0" max={row.duration} step="0.1" value={Math.min(row.duration, position)} disabled={!state} onChange={e => engine.seekSoundtrack(row.id, Number(e.target.value))}/><output>{clock(position)} / {clock(row.duration)}</output></label>
        <div className="track-levels"><label><span className="sr-only">{row.title + " volume"}</span><input aria-label={row.title + " volume"} type="range" min="0" max="100" value={Math.round(row.volume * 100)} onChange={e => void patch(row, { volume: Number(e.target.value) / 100 })}/><output>{Math.round(row.volume * 100)}%</output></label>
          <button className="icon-button" aria-label={(row.muted ? "Unmute " : "Mute ") + row.title} aria-pressed={row.muted} onClick={() => void patch(row, { muted: !row.muted })}>{row.muted ? <VolumeX size={18}/> : <Volume2 size={18}/>}</button>
          <button aria-pressed={row.loop} aria-label={"Repeat " + row.title} onClick={() => void patch(row, { loop: !row.loop })}>Repeat</button>
        </div>
        <details className="track-options"><summary aria-label={row.title + " track options"}>Track options</summary><div className="track-toolbar">
          <button disabled={!state} aria-label={"Back 10 seconds " + row.title} onClick={() => engine.seekSoundtrack(row.id, position - 10)}>−10 sec</button>
          <button disabled={!state} aria-label={"Forward 10 seconds " + row.title} onClick={() => engine.seekSoundtrack(row.id, position + 10)}>+10 sec</button>
          <button onClick={() => { setEditing(row.id); setTitle(row.title); }}>Rename</button>
          <button disabled={Boolean(busy)} onClick={() => void run(async () => deliverFile(await trackBlob(row.id), row.filename), row.id)}>Export original</button>
          <button disabled={Boolean(busy)} onClick={() => { if (confirmSourceDeletion("track", [{id: row.id, name: row.title}], "Export its original first if you need a backup."))
                void run(async () => { await changeTrack(row.id, null); engine.stop(row.id); setEditing(""); }, row.id); }}>Delete track</button>
        </div>
        <p className="content-note">Files and settings stay on this device. Supported formats depend on the device. Export original for a backup; generated-session exports do not include imported audio.</p>
        {editing === row.id && <form className="track-rename" onSubmit={e => { e.preventDefault(); void run(async () => { await changeTrack(row.id, { title }); setEditing(""); }, row.id); }}><label>Track name<input aria-label="Track name" maxLength={80} value={title} onChange={e => setTitle(e.target.value)}/></label><button disabled={Boolean(busy)}>Save name</button><button type="button" onClick={() => setEditing("")}>Cancel</button></form>}
        </details>
      </article>;
        })}</div>
    <p className="content-note">Tracks run separately from the session timer. Stop tracks when finished.</p>
    {message && <p role="status" className="track-message">{message}</p>}
  </details>;
}
