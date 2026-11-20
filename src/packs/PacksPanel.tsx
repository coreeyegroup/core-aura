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
  embedded = false,
  online = navigator.onLine,
  offlineReady = Capacitor.isNativePlatform(),
  master = 0.5,
  onMaster,
}: {
  library?: boolean;
  embedded?: boolean;
  online?: boolean;
  offlineReady?: boolean;
  master?: number;
  onMaster?: (n: number) => void;
}) {
  const [rows, setRows] = useState<SoundPack[]>([]),
    [installed, setInstalled] = useState<InstalledPack[]>([]);
  const [installedReady, setInstalledReady] = useState(false);
  const [catalogState, setCatalogState] = useState<"loading" | "complete" | "partial" | "unavailable">("loading");
  const [message, setMessage] = useState(""),
    [status, setStatus] = useState("Loading catalog…");
  const [query, setQuery] = useState(""),
    [download, setDownload] = useState<{
      id: string | null;
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
          if (alive.current) {
            setInstalled(p);
            setInstalledReady(true);
          }
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
  const refreshId = useRef(0);
  async function refresh() {
    const id = ++refreshId.current;
    setStatus("Loading catalog…");
    setCatalogState("loading");
    const [built, published] = await Promise.allSettled([
      catalog("/catalog-packs.json"),
      online ? catalog(server() + "/api/catalog") : Promise.resolve([]),
    ]);
    if (!alive.current || id !== refreshId.current) return;
    const merged = new Map(published.status === "fulfilled" ? published.value.map(pack => [pack.id, pack]) : []);
    if (built.status === "fulfilled") built.value.forEach(pack => merged.set(pack.id, pack));
    const complete = online && built.status === "fulfilled" && published.status === "fulfilled";
    setRows([...merged.values()]);
    setCatalogState(complete ? "complete" : merged.size ? "partial" : "unavailable");
    setStatus(complete ? "Built-in and published catalog"
      : !online ? "Offline · Showing downloads and any available built-in packs"
      : merged.size ? "Part of the catalog is unavailable. Refresh to try again"
      : "Catalog unavailable. Reconnect and try again");
  }
  useEffect(() => {
    if (!library) void refresh();
    return () => { refreshId.current++; };
  }, [library, online]);
  const needsDownload = (pack: SoundPack) => {
    const local = installed.find(item => item.id === pack.id);
    return compatible(pack) && (!local || compareVersion(pack.version, local.manifest.version) > 0);
  };
  const available = rows.filter(pack => needsDownload(pack) && (online || (Capacitor.isNativePlatform() && pack.id === "core-resonance")));
  const availableBytes = available.reduce((total, pack) => total + packBytes(pack), 0);
  const installedBytes = installed.reduce((total, pack) => total + pack.files.reduce((bytes, file) => bytes + file.blob.size, 0), 0);
  async function downloadPacks(packs: SoundPack[], bulk = false) {
    if (controller.current) return;
    const c = new AbortController();
    controller.current = c;
    setMessage("");
    const total = packs.reduce((size, pack) => size + packBytes(pack), 0);
    const id = bulk ? null : packs[0].id;
    setDownload({ id, loaded: 0, total });
    let completedBytes = 0, completedPacks = 0;
    const errors: string[] = [];
    try {
      for (const pack of packs) {
        if (c.signal.aborted) break;
        try {
          await installPack(
            pack,
            pack.id === "core-resonance" ? location.origin : server(),
            c.signal,
            loaded => {
              if (alive.current) setDownload({ id, loaded: completedBytes + loaded, total });
            },
          );
          completedPacks++;
        } catch (error) {
          if (!c.signal.aborted) errors.push(bulk ? pack.title + ": " + (error as Error).message : (error as Error).message);
        }
        completedBytes += packBytes(pack);
      }
      if (!alive.current) return;
      const result = bulk
        ? `${completedPacks} of ${packs.length} packs are ready offline in Downloaded packs.`
        : `${packs[0].title} is ready offline. Open Downloaded packs to play it.`;
      if (c.signal.aborted) setMessage("Download cancelled. Existing downloads were kept.");
      else setMessage([...(bulk || !errors.length ? [result] : []), ...errors].join(" "));
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
  const downloadProgress = download && <div className="pack-download-progress">
    <label>Downloading {Math.round(download.loaded / download.total * 100)}%
      <progress aria-label="Pack download progress" value={download.loaded} max={download.total} />
    </label>
    <button onClick={() => controller.current?.abort()}>Cancel download</button>
  </div>;
  return (
    <section
      className="packs-panel"
      aria-label={library ? "Downloaded packs" : "Sound pack catalog"}
    >
      <div className="section-heading">
        {library ? <h2>Downloaded packs</h2> : embedded ? <h2>Available packs</h2> : <h1>Sound packs</h1>}
        {!library && (
          <button onClick={refresh} disabled={Boolean(download)}>
            Refresh catalog
          </button>
        )}
      </div>
      {!library && (
        <>
          <p className="content-note">
            {status}. Stay on this screen until downloads finish.
          </p>
          {embedded && <div className="offline-pack-controls">
            <p className="content-note">
              {offlineReady ? "Player ready offline." : "Preparing the offline player. Keep Core-aura open."}{" "}
              Generated sounds and files you import are already on this device.
            </p>
            <button className="primary" disabled={!installedReady || catalogState === "loading" || !available.length || Boolean(download)}
              onClick={() => void downloadPacks(available, true)}>
              {catalogState === "complete" ? "Download all packs for offline use" : "Download available packs for offline use"}
            </button>
            <p className="content-note" role="status">{available.length ? `${available.length} to download · ${megabytes(availableBytes)}`
              : !online && !Capacitor.isNativePlatform() ? "Go online to download packs."
                : catalogState === "complete" && installedReady ? "All compatible packs are up to date."
                  : ""}</p>
            {download?.id === null && downloadProgress}
          </div>}
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
          other audio. {installed.length} on this device · {megabytes(installedBytes)}.
          On the web, clearing site storage removes downloaded packs.
        </p>
      )}
      {library && onMaster && installed.length > 0 && (
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
          No packs downloaded.
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
                      !available.includes(pack)
                    }
                    onClick={() => void downloadPacks([pack])}
                  >
                    {!compatible(pack)
                      ? "App update required"
                      : newer
                        ? "Download update"
                        : local
                          ? "Downloaded"
                          : "Download pack"}
                  </button>
                  {download?.id === pack.id && downloadProgress}
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
