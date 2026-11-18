import {prepareSound} from "../workbench/actions";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Capacitor } from "@capacitor/core";
import { engine } from "../audio/engine";
import {
  compatible,
  compareVersion,
  megabytes,
  packBytes,
  parseCatalog,
  SoundPack,
} from "./catalog";
import {
  installedPacks,
  InstalledPack,
  installPack,
  removePack,
} from "./storage";
const server = () =>
  Capacitor.isNativePlatform()
    ? "https://core-aura.coreeye.in"
    : location.origin;
async function catalog(url: string) {
  const r = await fetch(url, {
    signal: AbortSignal.timeout(6000),
    cache: "no-store",
  });
  if (!r.ok) throw Error("Catalog unavailable");
  const text = await r.text();
  if (text.length > 1024 * 1024) throw Error("Catalog too large");
  return parseCatalog(JSON.parse(text));
}
export function PacksPanel({
  library = false,
  master = 0.5,
  onMaster,
}: {
  library?: boolean;
  master?: number;
  onMaster?: (n: number) => void;
}) {
  const [rows, setRows] = useState<SoundPack[]>([]),
    [installed, setInstalled] = useState<InstalledPack[]>([]);
  const [message, setMessage] = useState(""),
    [status, setStatus] = useState("Loading catalog…");
  const [query, setQuery] = useState(""),
    [download, setDownload] = useState<{
      id: string;
      loaded: number;
      total: number;
    } | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const states = useSyncExternalStore(engine.subscribe, engine.snapshot);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    const read = () =>
      installedPacks()
        .then((p) => {
          if (alive.current) setInstalled(p);
        })
        .catch((e) => {
          if (alive.current) setMessage(e.message);
        });
    read();
    addEventListener("core-aura-packs-changed", read);
    addEventListener("pageshow", read);
    return () => {
      alive.current = false;
      controller.current?.abort();
      removeEventListener("core-aura-packs-changed", read);
      removeEventListener("pageshow", read);
    };
  }, []);
  async function refresh() {
    setStatus("Loading catalog…");
    let built: SoundPack[] = [];
    try {
      built = await catalog("/catalog-packs.json");
      if (alive.current) setRows(built);
    } catch {
      if (alive.current)
        setStatus(
          "The built-in catalog is unavailable. Reconnect and update the app.",
        );
    }
    try {
      const published = await catalog(server() + "/api/catalog");
      const merged = new Map(published.map((p) => [p.id, p]));
      built.forEach((p) => merged.set(p.id, p));
      if (alive.current) {
        setRows([...merged.values()]);
        setStatus("Built-in and published catalog");
      }
    } catch {
      if (alive.current && built.length)
        setStatus("Built-in catalog · Server catalog unavailable");
    }
  }
  useEffect(() => {
    if (!library) refresh();
  }, [library]);
  async function downloadPack(pack: SoundPack) {
    if (controller.current) return;
    const c = new AbortController();
    controller.current = c;
    setMessage("");
    setDownload({ id: pack.id, loaded: 0, total: packBytes(pack) });
    try {
      await installPack(
        pack,
        Capacitor.isNativePlatform() && pack.id === "core-resonance"
          ? location.origin
          : server(),
        c.signal,
        (loaded, total) => {
          if (alive.current) setDownload({ id: pack.id, loaded, total });
        },
      );
      if (alive.current)
        setMessage(pack.title + " is ready offline. Open Library to play it.");
    } catch (e) {
      if (alive.current)
        setMessage(
          c.signal.aborted
            ? "Download cancelled. Existing downloads were kept."
            : (e as Error).message,
        );
    } finally {
      controller.current = null;
      if (alive.current) setDownload(null);
    }
  }
  async function play(pack: InstalledPack, assetId: string) {
    const id = "pack:" + pack.id + ":" + assetId;
    if(!engine.snapshot().some(s=>s.id===id)&&!prepareSound([id]))return;
    setLoading(id);
    setMessage("");
    try {
      const file = pack.files.find((f) => f.id === assetId);
      if (!file)
        throw Error("The file is unavailable. Download the pack again.");
      await engine.toggleRecording(id, () => file.blob.arrayBuffer());
    } catch {
      if (alive.current)
        setMessage(
          "Audio could not start. Download the pack again or try another file.",
        );
    } finally {
      if (alive.current) setLoading(null);
    }
  }
  async function remove(row: InstalledPack) {
    if (!confirm("Remove " + row.manifest.title + " from this device?")) return;
    states
      .filter((s) => s.id.startsWith("pack:" + row.id + ":"))
      .forEach((s) => engine.stop(s.id));
    try {
      await removePack(row.id);
      setMessage("Pack removed from this device.");
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  const shown = library ? installed.map((p) => p.manifest) : rows;
  return (
    <section
      className="packs-panel"
      aria-label={library ? "Downloaded packs" : "Sound pack catalog"}
    >
      <div className="section-heading">
        <h2>{library ? "Downloaded packs" : "Sound packs"}</h2>
        {!library && (
          <button onClick={refresh} disabled={Boolean(download)}>
            Refresh catalog
          </button>
        )}
      </div>
      {!library && (
        <>
          <p className="content-note">
            {status}. Downloads are optional. Stay on this screen until
            complete.
          </p>
          <label>
            Find a pack
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, instrument or tradition"
            />
          </label>
        </>
      )}
      {library && (
        <p className="content-note">
          Downloaded audio plays at its recorded tuning. Starting a file stops
          other audio. Downloads stay on this device and can be cleared by
          browser storage cleanup.{" "}
        </p>
      )}
      {library && installed.length > 0 && (
        <label className="range-label">
          Playback volume <output>{Math.round(master * 100)}%</output>
          <input
            aria-label="Pack playback volume"
            type="range"
            min="0"
            max="100"
            value={master * 100}
            onChange={(e) => onMaster?.(Number(e.target.value) / 100)}
          />
        </label>
      )}
      {library && !installed.length && (
        <p className="content-note">
          No packs downloaded. Find them in Explore → Sound packs.
        </p>
      )}
      {shown
        .filter((p) =>
          (p.title + " " + p.description + " " + p.tradition)
            .toLowerCase()
            .includes(query.toLowerCase()),
        )
        .map((pack) => {
          const local = installed.find((p) => p.id === pack.id),
            newer =
              local && compareVersion(pack.version, local.manifest.version) > 0;
          return (
            <article className="pack-card" key={pack.id}>
              <div className="section-heading">
                <h3>{pack.title}</h3>
                <small>v{pack.version}</small>
              </div>
              <p>
                {pack.tradition} · {pack.assets.length} files ·{" "}
                {megabytes(packBytes(pack))}
              </p>
              <p className="content-note">{pack.description}</p>
              <details>
                <summary>Credits &amp; source</summary>
                <p>
                  Creator: {pack.creator} · License: {pack.license}
                </p>
                <p>{pack.attribution}</p>
                <p>{pack.provenance}</p>
              </details>
              {!library && (
                <>
                  <button
                    className="primary"
                    disabled={
                      Boolean(download) ||
                      !compatible(pack) ||
                      Boolean(local && !newer)
                    }
                    onClick={() => downloadPack(pack)}
                  >
                    {!compatible(pack)
                      ? "App update required"
                      : newer
                        ? "Download update"
                        : local
                          ? "Downloaded"
                          : "Download pack"}
                  </button>
                  {download?.id === pack.id && (
                    <div>
                      <label>
                        Downloading{" "}
                        {Math.round((download.loaded / download.total) * 100)}%
                        <progress
                          aria-label="Pack download progress"
                          value={download.loaded}
                          max={download.total}
                        />
                      </label>
                      <button onClick={() => controller.current?.abort()}>
                        Cancel download
                      </button>
                    </div>
                  )}
                </>
              )}
              {library && local && (
                <>
                  {pack.assets.map((a) => {
                    const id = "pack:" + pack.id + ":" + a.id,
                      state = states.find((s) => s.id === id);
                    return (
                      <div className="pack-track" key={a.id}>
                        <span>
                          <strong>{a.title}</strong>
                          <small>
                            {a.seconds} sec
                            {state
                              ? " · " + Math.floor(state.time) + " sec elapsed"
                              : ""}
                          </small>
                        </span>
                        <button
                          disabled={loading !== null}
                          onClick={() => play(local, a.id)}
                          aria-label={
                            (state?.status === "playing"
                              ? "Pause "
                              : state
                                ? "Resume "
                                : "Play ") + a.title
                          }
                        >
                          {state?.status === "playing"
                            ? "Pause"
                            : state
                              ? "Resume"
                              : "Play"}
                        </button>
                        <button
                          disabled={!state}
                          onClick={() => engine.stop(id)}
                          aria-label={"Stop " + a.title}
                        >
                          Stop
                        </button>
                      </div>
                    );
                  })}
                  <button onClick={() => remove(local)}>Remove download</button>
                </>
              )}
            </article>
          );
        })}
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
    </section>
  );
}
