import { useEffect, useState, type FormEvent } from "react";
import { ExternalLink, Link2, Play, Plus, Trash2, X } from "lucide-react";
import type { Track } from "./storage";
import { parseYouTubeLinks, youtubeLinkLimit, youtubeLinksKey, youtubeVideoId, type YouTubeLink } from "./youtube";

function readLinks() {
  return parseYouTubeLinks(JSON.parse(localStorage.getItem(youtubeLinksKey) ?? "[]"));
}

export function YouTubeLinks({ tracks }: { tracks: Track[] }) {
  const [library, setLibrary] = useState(() => {
    try { return { rows: readLinks(), error: "" }; }
    catch { return { rows: [] as YouTubeLink[], error: "Saved links could not be read. Your original data was kept." }; }
  });
  const [playerId, setPlayerId] = useState<string>();
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    function reload(event: StorageEvent) {
      if (event.key !== youtubeLinksKey && event.key !== null) return;
      try { setLibrary({ rows: readLinks(), error: "" }); }
      catch { setLibrary({ rows: [], error: "Saved links could not be read. Your original data was kept." }); }
    }
    window.addEventListener("storage", reload);
    return () => window.removeEventListener("storage", reload);
  }, []);

  function update(change: (rows: YouTubeLink[]) => YouTubeLink[], feedback: string) {
    try {
      const rows = parseYouTubeLinks(change(readLinks()));
      localStorage.setItem(youtubeLinksKey, JSON.stringify(rows));
      setLibrary({ rows, error: "" });
      setMessage(feedback);
      return true;
    } catch (error) {
      setMessage((error as Error).name === "QuotaExceededError" ? "Device storage is full." : (error as Error).message);
      return false;
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const id = youtubeVideoId(url);
      if (!update(rows => {
        if (rows.some(row => row.id === id)) throw Error("This video is already saved.");
        if (rows.length >= youtubeLinkLimit) throw Error("The YouTube link list is full.");
        return [...rows, { id, title: title.trim() || "YouTube video " + id }];
      }, "YouTube link saved.")) return;
      setTitle("");
      setUrl("");
      setAdding(false);
    } catch (error) { setMessage((error as Error).message); }
  }

  return <section className="soundtrack-panel" aria-labelledby="youtube-links-heading">
    <div className="module-title">
      <h2 id="youtube-links-heading"><Link2 size={18} aria-hidden="true" /> YouTube links <span className="count-tag">{library.rows.length}</span></h2>
      <button type="button" aria-expanded={adding} aria-controls="youtube-link-form" disabled={!!library.error || library.rows.length >= youtubeLinkLimit}
        onClick={() => setAdding(!adding)}><Plus size={16} aria-hidden="true" /> Add link</button>
    </div>
    <p className="content-note">Play saved links here with the YouTube player. Streaming requires internet. For offline playback in Core-aura, link an imported audio file.</p>
    <form id="youtube-link-form" hidden={!adding} onSubmit={save}>
      <div className="fields">
        <label>YouTube link<input type="url" required maxLength={2048} value={url} onChange={event => setUrl(event.target.value)} placeholder="https://youtu.be/…" /></label>
        <label>Title (optional)<input maxLength={80} value={title} onChange={event => setTitle(event.target.value)} /></label>
      </div>
      <button className="primary" type="submit">Save link</button>
    </form>
    {!library.error && !library.rows.length && <p className="content-note">No YouTube links saved.</p>}
    <div className="track-list">{library.rows.map(row => {
      const audio = tracks.find(track => track.id === row.trackId);
      const playerOpen = playerId === row.id;
      const playerPanel = "youtube-player-" + row.id;
      return <article className="soundtrack-row" key={row.id}>
        <div className="track-head"><div><strong>{row.title}</strong><small>
          {audio ? "Offline audio linked · " + audio.title : row.trackId ? "Linked audio unavailable on this device" : "YouTube link"}
        </small></div>
          <button className="icon-button" type="button" aria-label={"Remove link " + row.title} onClick={() => {
            if (confirm("Remove this saved YouTube link?") &&
                update(rows => rows.filter(item => item.id !== row.id), "YouTube link removed.") &&
                playerOpen) setPlayerId(undefined);
          }}><Trash2 size={16} aria-hidden="true" /></button>
        </div>
        <div className="home-actions">
          <button className={playerOpen ? undefined : "primary"} type="button" aria-expanded={playerOpen}
            aria-controls={playerPanel} onClick={() => setPlayerId(current => current === row.id ? undefined : row.id)}>
            {playerOpen ? <X size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
            {playerOpen ? "Close player" : "Play here"}
          </button>
          {audio && <button type="button" onClick={() => {
            setPlayerId(undefined);
            document.getElementById("local-player-" + audio.id)?.focus();
          }}>Go to offline player</button>}
        </div>
        <div id={playerPanel} hidden={!playerOpen}>
          {playerOpen && <>
            <iframe className="youtube-player-frame" title={"YouTube player for " + row.title}
              src={"https://www.youtube-nocookie.com/embed/" + row.id + "?playsinline=1"}
              referrerPolicy="strict-origin-when-cross-origin" allow="encrypted-media; picture-in-picture"
              allowFullScreen />
            <p className="content-note">If the video can’t play here, <a href={"https://www.youtube.com/watch?v=" + row.id}
              target="_blank" rel="noopener noreferrer">open it in YouTube <ExternalLink size={14} aria-hidden="true" /></a>.</p>
          </>}
        </div>
        {(tracks.length > 0 || row.trackId) && <details className="track-options">
          <summary>Link offline audio</summary>
          <label>Imported audio for {row.title}
            <select value={row.trackId ?? ""} onChange={event => {
              const trackId = event.target.value || undefined;
              update(rows => rows.map(item => item.id === row.id ? { ...item, trackId } : item), "Offline audio link updated.");
            }}>
              <option value="">Choose imported audio</option>
              {row.trackId && !audio && <option value={row.trackId} disabled>File unavailable</option>}
              {tracks.map(track => <option key={track.id} value={track.id}>{track.title}</option>)}
            </select>
          </label>
        </details>}
      </article>;
    })}</div>
    {(message || library.error) && <p role="status" className="track-message">{message || library.error}</p>}
  </section>;
}
