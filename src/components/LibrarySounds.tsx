import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Download, Heart, Play, Square } from "lucide-react";
import { engine } from "../audio/engine";
import { channel, sounds, type Channel, type Sound } from "../model";
import { isNature, natureCatalog } from "../nature/catalog";
import { queuePlayer } from "../playlists/runtime";
import { preparePreview } from "../workbench/actions";

const prefix = "library:preview:";
const entries = Object.entries(sounds) as [Sound, (typeof sounds)[Sound]][];
const family = (id: Sound) => isNature(id) ? natureCatalog[id].family : sounds[id].type;

function previewChannel(id: Sound): Channel {
  const { min, max } = sounds[id];
  const hz = Math.min(max, Math.max(min, isNature(id) ? 1000 : 432));
  return { ...channel(id, hz), id: prefix + id, seconds: 8, volume: 0.25 };
}

export function LibrarySounds({ favorites, onFavorite, onExport, backgrounds = false }: {
  favorites: Sound[];
  onFavorite: (sound: Sound) => void;
  backgrounds?: boolean;
  onExport: (name: string, sample: Channel, control: HTMLButtonElement) => void;
}) {
  const [query, setQuery] = useState("");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const states = useSyncExternalStore(engine.subscribe, engine.snapshot);
  const pendingKey = useRef<string>(undefined);
  useEffect(() => () => {
    if (pendingKey.current) engine.stop(pendingKey.current);
  }, []);
  const term = query.trim().toLowerCase();
  const visible = entries.filter(([id, sound]) =>
    isNature(id) === backgrounds && (!onlyFavorites || favorites.includes(id)) &&
    (sound.name + " " + family(id)).toLowerCase().includes(term),
  );

  async function preview(id: Sound) {
    const key = prefix + id;
    const active = engine.snapshot().filter(state => state.id.startsWith(prefix) && state.status !== "stopping");
    active.forEach(state => engine.stop(state.id));
    if (active.some(state => state.id === key)) return;
    setPending(true);
    setError("");
    try {
      pendingKey.current = key;
      if (queuePlayer.snapshot().status === "playing") queuePlayer.pause();
      preparePreview();
      await engine.play(previewChannel(id), { preview: true });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="library-starters" aria-label={backgrounds ? "Built-in background sounds" : "Sound catalog"}>
      <h2>{backgrounds ? "Built-in background sounds" : "Built-in raw sounds"}</h2>
      <div className="fields">
        <label>{backgrounds ? "Search background sounds" : "Search sounds"}<input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label>
        <label className="check"><input type="checkbox" checked={onlyFavorites}
          onChange={event => setOnlyFavorites(event.target.checked)} /> Favorites only</label>
      </div>
      {error && <p role="status">{error}</p>}
      {!visible.length && <p role="status">No matching sounds.</p>}
      {visible.map(([id, sound]) => {
        const active = states.some(state => state.id === prefix + id && state.status !== "stopping");
        return <article className="library-starter" key={id}>
          <div><h3>{sound.name}</h3><small>{family(id)} · Built in</small></div>
          <div className="library-starter-actions">
            <button disabled={pending} aria-label={(active ? "Stop test " : "Test play ") + sound.name}
              onClick={() => void preview(id)}>
              {active ? <Square size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
              {active ? "Stop test" : "Test play"}
            </button>
            <button className="icon-button" aria-label={"Export WAV " + sound.name}
              onClick={event => onExport(sound.name, previewChannel(id), event.currentTarget)}>
              <Download size={16} aria-hidden="true" />
            </button>
            <button className="icon-button" aria-label={"Favorite " + sound.name}
              aria-pressed={favorites.includes(id)} onClick={() => onFavorite(id)}>
              <Heart size={16} aria-hidden="true" />
            </button>
          </div>
        </article>;
      })}
    </section>
  );
}
