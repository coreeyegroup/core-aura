import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  AudioLines,
  Flower2,
  Library,
  Settings,
  X,
  Plus,
  Download,
  Upload,
  Heart,
  Check,
  ArrowRight,
  WifiOff,
  Sparkles,
} from "lucide-react";
import { Capacitor } from "@capacitor/core";
import {
  Channel,
  Session,
  Sound,
  Tab,
  VERSION,
  ENGINE_VERSION,
  channel,
  chakras,
  parseSession,
  sounds,
  validChannel,
} from "./model";
import { engine } from "./audio/engine";
import { favorites, readSessions, writeSessions } from "./storage";
import { ChannelEditor, Transport } from "./components/Controls";
import { Waveform } from "./components/Waveform";
import { PacksPanel } from "./packs/PacksPanel";
import { Admin } from "./admin/Admin";
import { Manifestation, ManifestLibrary } from "./manifestation/Workspace";
import { manifestationStore } from "./manifestation/store";
import { manifestPlayer } from "./manifestation/player";
import { observePushReminders } from "./manifestation/push";
import { Due, observeReminders } from "./manifestation/reminders";
import { readAppearance, saveAppearance, Appearance } from "./appearance";

function time(seconds: number) {
  return (
    Math.floor(seconds / 60) +
    ":" +
    String(Math.floor(seconds % 60)).padStart(2, "0")
  );
}
function note(hz: number) {
  if (hz <= 0) return "Enter a supported frequency";
  const value = 69 + 12 * Math.log2(hz / 440),
    nearest = Math.round(value);
  return (
    ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"][
      ((nearest % 12) + 12) % 12
    ] +
    (Math.floor(nearest / 12) - 1) +
    " · " +
    Math.round((value - nearest) * 100) +
    " cents"
  );
}
const tabs = [
  ["manifest", "Manifest", Sparkles],
  ["studio", "Sounds", AudioLines],
  ["chakras", "Chakras", Flower2],
  ["library", "Library", Library],
] as const;
export default function App() {
  const [tab, setTab] = useState<Tab>(() => {
    const route = location.hash.slice(1);
    return [
      "manifest",
      "explore",
      "studio",
      "chakras",
      "library",
      "admin",
    ].includes(route)
      ? (route as Tab)
      : "manifest";
  });
  const [lastSoundTab, setLastSoundTab] = useState<"explore" | "studio">(
    "explore",
  );
  const [libraryView, setLibraryView] = useState(() => {
    try {
      return localStorage.getItem("core-aura.library-view") === "audio"
        ? "audio"
        : "manifestation";
    } catch {
      return "manifestation";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("core-aura.library-view", libraryView);
    } catch {}
  }, [libraryView]);
  const [due, setDue] = useState<Due | null>(null);
  const practice = useSyncExternalStore(
    manifestPlayer.subscribe,
    manifestPlayer.snapshot,
  );
  useEffect(
    () => (Capacitor.isNativePlatform() ? undefined : observePushReminders()),
    [],
  );
  function openManifest(id: string) {
    try {
      const playing = manifestPlayer.snapshot();
      if (
        playing.plan?.id !== id ||
        !["playing", "paused"].includes(playing.status)
      ) {
        manifestPlayer.stop();
        manifestationStore.open(id);
      }
      setTab("manifest");
      history.replaceState(null, "", "#manifest");
      setDue(null);
      window.scrollTo({ top: 0 });
    } catch {
      setMessage(
        "The scheduled practice is unavailable. Check your saved practices.",
      );
    }
  }
  useEffect(
    () =>
      observeReminders((reminder) => {
        const { draft, plans } = manifestationStore.snapshot().data;
        const saved = plans.find((p) => p.id === draft.id);
        const scheduled = plans.find((p) => p.id === reminder.planId);
        const unsaved = saved
          ? JSON.stringify(saved) !== JSON.stringify(draft)
          : draft.lines.length > 0 || draft.name !== "My manifestation";
        const playing = manifestPlayer.snapshot().status;
        if (
          scheduled &&
          reminder.autoStart &&
          document.visibilityState === "visible" &&
          location.hash !== "#admin" &&
          !unsaved &&
          !["playing", "paused"].includes(playing) &&
          engine.snapshot().length === 0
        ) {
          try {
            openManifest(reminder.planId);
            manifestPlayer.start(scheduled);
            return;
          } catch {}
        }
        setDue(reminder);
      }, openManifest),
    [],
  );
  useEffect(() => {
    const url = new URL(location.href);
    const id = url.searchParams.get("manifestPlan");
    if (id) {
      openManifest(id);
      url.searchParams.delete("manifestPlan");
      history.replaceState(null, "", url.pathname + url.search + "#manifest");
    }
  }, []);
  const [layers, setLayers] = useState<Channel[]>(() => [channel()]);
  const [chakraChannels, setChakraChannels] = useState<Channel[]>(() =>
    chakras.map((c) => ({ ...channel("sine", c.hz), id: c.id, volume: 0.25 })),
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [mixTarget, setMixTarget] = useState("selected");
  const [seconds, setSeconds] = useState(300);
  const [master, setMaster] = useState(0.5);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [starred, setStarred] = useState<Sound[]>(favorites);
  const [message, setMessage] = useState("");
  const [settings, setSettings] = useState(false);
  const [appearance, setAppearance] = useState(readAppearance);
  const [exporting, setExporting] = useState<Session | null>(null);
  const [exportSeconds, setExportSeconds] = useState(60);
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [exportError, setExportError] = useState("");
  const exportWorker = useRef<Worker | null>(null);
  useEffect(() => () => exportWorker.current?.terminate(), []);
  function changeAppearance(next: Appearance) {
    setAppearance(next);
    if (!saveAppearance(next))
      setUpdateStatus(
        "Display changed for this visit; device storage is unavailable.",
      );
  }
  function closeExport() {
    exportWorker.current?.terminate();
    exportWorker.current = null;
    setExportProgress(null);
    setExporting(null);
    setExportError("");
  }
  function renderAudio() {
    if (!exporting || exportWorker.current) return;
    if (Capacitor.isNativePlatform()) {
      setExportError(
        "Use the website or installed web app to download WAV files. Native file sharing is not available yet.",
      );
      return;
    }
    try {
      const row = parseSession(exporting);
      setExportError("");
      setExportProgress(0);
      const worker = new Worker("/wav-worker.js", { type: "module" });
      exportWorker.current = worker;
      const failed = () => {
        worker.terminate();
        exportWorker.current = null;
        setExportProgress(null);
        setExportError("Audio export failed. Try a shorter duration.");
      };
      worker.onerror = failed;
      worker.onmessage = ({ data }) => {
        if (data.error) {
          failed();
          return;
        }
        if (typeof data.progress === "number") setExportProgress(data.progress);
        if (data.buffer) {
          const url = URL.createObjectURL(
            new Blob([data.buffer], { type: "audio/wav" }),
          );
          const link = document.createElement("a");
          link.href = url;
          link.download =
            "core-aura-" +
            row.name.replace(/[^a-z0-9_-]/gi, "-").slice(0, 60) +
            ".wav";
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 60000);
          worker.terminate();
          exportWorker.current = null;
          setExportProgress(null);
          setExportError("WAV file prepared. Check your downloads.");
        }
      };
      worker.postMessage({
        channels: row.channels,
        master: row.master,
        seconds: exportSeconds,
      });
    } catch {
      setExportError("This session cannot be exported.");
      setExportProgress(null);
    }
  }
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [exploreView, setExploreView] = useState("sounds");
  const [online, setOnline] = useState(navigator.onLine);
  const [offlineReady, setOfflineReady] = useState(false);
  const [updateStatus, setUpdateStatus] = useState("");
  const states = useSyncExternalStore(engine.subscribe, engine.snapshot);
  const importInput = useRef<HTMLInputElement>(null);
  const current =
    tab === "chakras"
      ? chakraChannels.filter(
          (c) => mixTarget === "all" || selected.includes(c.id),
        )
      : layers;
  const currentWithTime = current.map((c) => ({ ...c, seconds }));
  const isStudio = tab === "studio",
    isChakras = tab === "chakras";
  const miniRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = miniRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() =>
      document.documentElement.style.setProperty(
        "--mini-height",
        element.getBoundingClientRect().height + "px",
      ),
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--mini-height");
    };
  }, [tab, practice.status, states.some((s) => s.status === "playing")]);
  const dockRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const dock = dockRef.current;
    if (!dock) return;
    const observer = new ResizeObserver(([entry]) => {
      document.documentElement.style.setProperty(
        "--dock-height",
        entry.contentRect.height +
          parseFloat(getComputedStyle(dock).paddingTop) +
          parseFloat(getComputedStyle(dock).paddingBottom) +
          1 +
          "px",
      );
    });
    observer.observe(dock);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--dock-height");
    };
  }, [isStudio, isChakras]);
  useEffect(() => {
    try {
      setSessions(readSessions());
    } catch {
      setMessage(
        "Saved sessions could not be read. Export a backup before resetting browser storage.",
      );
    }
    const changed = () => setOnline(navigator.onLine);
    addEventListener("online", changed);
    addEventListener("offline", changed);
    if ("serviceWorker" in navigator && !Capacitor.isNativePlatform()) {
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then(() => navigator.serviceWorker.ready)
        .then(() => setOfflineReady(true))
        .catch(() =>
          setMessage(
            "Offline player could not be prepared. Reconnect and try again.",
          ),
        );
    } else if (Capacitor.isNativePlatform()) setOfflineReady(true);
    return () => {
      removeEventListener("online", changed);
      removeEventListener("offline", changed);
    };
  }, []);
  useEffect(() => {
    engine.setMaster(master);
  }, [master]);
  useEffect(() => {
    if (!settings && !saving && !exporting) return;
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSettings(false);
        setSaving(false);
        closeExport();
        return;
      }
      if (event.key !== "Tab") return;
      const items = [
        ...document.querySelectorAll<HTMLElement>(
          '[role="dialog"] button:not(:disabled), [role="dialog"] input:not(:disabled), [role="dialog"] select:not(:disabled), [role="dialog"] summary',
        ),
      ];
      const first = items[0],
        last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", keyboard);
    return () => document.removeEventListener("keydown", keyboard);
  }, [settings, saving, exporting]);
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: "Core-aura",
      artist: "Personal listening session",
    });
    navigator.mediaSession.setActionHandler("pause", () => {
      manifestPlayer.pause();
      engine.snapshot().forEach((s) => engine.pause(s.id));
    });
    navigator.mediaSession.setActionHandler("stop", () => engine.stopAll());
    return () => {
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("stop", null);
    };
  }, []);
  useEffect(() => {
    if (!("mediaDevices" in navigator)) return;
    const changed = () => {
      engine.stopAll();
      setMessage("Audio output changed. Check the volume, then press Play.");
    };
    navigator.mediaDevices.addEventListener("devicechange", changed);
    return () =>
      navigator.mediaDevices.removeEventListener("devicechange", changed);
  }, []);
  function navigate(value: Tab) {
    if (value === "explore" || value === "studio") setLastSoundTab(value);
    setTab(value);
    history.replaceState(null, "", "#" + value);
    setMessage("");
    window.scrollTo({ top: 0 });
  }
  function patch(updated: Channel) {
    const spec = sounds[updated.sound];
    if (updated.hz >= spec.min && updated.hz <= spec.max) engine.patch(updated);
    const setter = chakras.some((c) => c.id === updated.id)
      ? setChakraChannels
      : setLayers;
    setter((rows) => rows.map((c) => (c.id === updated.id ? updated : c)));
  }
  function openSound(sound: Sound) {
    layers.forEach((c) => engine.stop(c.id));
    const hz = ["yaman", "mohanam", "tanpura"].includes(sound) ? 216 : 432;
    setLayers([channel(sound, hz)]);
    navigate("studio");
  }
  function storeRows(rows: Session[]) {
    try {
      writeSessions(rows);
      setSessions(rows);
      return true;
    } catch {
      setMessage(
        "The library could not be saved. Free device storage or export a backup.",
      );
      return false;
    }
  }
  function save() {
    try {
      const row = parseSession({
        schemaVersion: 2,
        engineVersion: ENGINE_VERSION,
        id: crypto.randomUUID(),
        name: saveName.trim(),
        kind: isChakras ? "chakras" : "studio",
        channels: currentWithTime,
        master,
        createdAt: new Date().toISOString(),
      });
      if (storeRows([...sessions, row])) {
        setSaving(false);
        setSaveName("");
        setMessage("Session saved in Library.");
      }
    } catch (error) {
      setMessage((error as Error).message);
    }
  }
  function load(row: Session) {
    engine.stopAll();
    setMaster(row.master);
    setSeconds(row.channels[0].seconds);
    if (row.kind === "chakras") {
      const map = new Map(row.channels.map((c) => [c.id, c]));
      setChakraChannels(
        chakras.map(
          (c) => map.get(c.id) || { ...channel("sine", c.hz), id: c.id },
        ),
      );
      setSelected(row.channels.map((c) => c.id));
      setMixTarget("selected");
      navigate("chakras");
    } else {
      setLayers(row.channels.map((c) => ({ ...c })));
      navigate("studio");
    }
    setMessage("Loaded " + row.name + ". Press Play to begin.");
  }
  function favorite(sound: Sound) {
    const rows = starred.includes(sound)
      ? starred.filter((s) => s !== sound)
      : [...starred, sound];
    try {
      localStorage.setItem("core-aura.favorites", JSON.stringify(rows));
      setStarred(rows);
    } catch {
      setMessage("Favorites could not be saved.");
    }
  }
  function exportSession(row: Session) {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(row, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "core-aura-session.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importSession(file?: File) {
    if (!file) return;
    if (file.size > 100000) {
      setMessage("Choose a session file smaller than 100 KB.");
      return;
    }
    try {
      const row = parseSession(JSON.parse(await file.text()));
      row.id = crypto.randomUUID();
      if (storeRows([...sessions, row])) setMessage("Session imported.");
    } catch {
      setMessage(
        "This file has invalid settings or an unsupported session version.",
      );
    }
    if (importInput.current) importInput.current.value = "";
  }
  async function update() {
    if (states.length) {
      setUpdateStatus("Stop all audio before updating.");
      return;
    }
    if (Capacitor.isNativePlatform()) {
      setUpdateStatus(
        "Native app updates arrive through your app distribution channel. Content updates will appear in Explore.",
      );
      return;
    }
    if (!online) {
      setUpdateStatus("Connect to the internet to check for updates.");
      return;
    }
    setUpdateStatus("Checking…");
    try {
      const response = await fetch("/health.json?t=" + Date.now(), {
        cache: "no-store",
      });
      if (!response.ok) throw Error();
      const result = await response.json();
      if (result.version === VERSION)
        setUpdateStatus("You have the latest version.");
      else location.href = "/update.html";
    } catch {
      setUpdateStatus("Could not reach the update service. Please try again.");
    }
  }
  const focus = layers[0];
  const activeCount = states.filter((s) => s.status === "playing").length;
  const errorInvalid = currentWithTime.some((c) => !validChannel(c));
  return (
    <div className="app">
      <header className="app-header">
        <a
          href="#manifest"
          onClick={(e) => {
            e.preventDefault();
            navigate("manifest");
          }}
          className="brand"
        >
          <span aria-hidden="true">◉</span> core-aura
        </a>
        <div className="header-actions">
          {!online && <WifiOff aria-label="Offline" size={18} />}
          <button
            className="icon-button"
            onClick={() => setSettings(true)}
            aria-label="Settings"
          >
            <Settings size={22} />
          </button>
        </div>
      </header>
      <main id="main">
        {due && (
          <div className="notice" role="status">
            <span>
              {due.name} · {due.time}
            </span>
            <button onClick={() => openManifest(due.planId)}>
              Open practice
            </button>
            <button
              aria-label="Dismiss manifestation reminder"
              onClick={() => setDue(null)}
            >
              Dismiss
            </button>
          </div>
        )}
        {tab === "manifest" && (
          <Manifestation
            onLibrary={() => {
              setLibraryView("manifestation");
              navigate("library");
            }}
          />
        )}
        {(tab === "explore" || tab === "studio") && (
          <div className="segmented" aria-label="Sound workspace">
            <button
              aria-pressed={tab === "explore"}
              onClick={() => navigate("explore")}
            >
              Explore
            </button>
            <button
              aria-pressed={tab === "studio"}
              onClick={() => navigate("studio")}
            >
              Studio
            </button>
          </div>
        )}
        {tab === "admin" && <Admin />}
        {tab === "explore" && (
          <>
            <div className="page-heading">
              <p className="eyebrow">Your listening practice</p>
              <h1>
                Make room
                <br />
                for a little stillness.
              </h1>
              <p>Choose a sound. Find your own rhythm.</p>
            </div>
            <div className="segmented" aria-label="Explore collection">
              <button
                aria-pressed={exploreView === "sounds"}
                onClick={() => setExploreView("sounds")}
              >
                Sounds
              </button>
              <button
                aria-pressed={exploreView === "packs"}
                onClick={() => setExploreView("packs")}
              >
                Sound packs
              </button>
            </div>
            {exploreView === "packs" ? (
              <PacksPanel />
            ) : (
              <>
                <button
                  className="feature-card"
                  onClick={() => navigate("chakras")}
                >
                  <div className="orb" aria-hidden="true">
                    <Flower2 size={52} />
                  </div>
                  <div>
                    <span className="eyebrow">Seven frequencies</span>
                    <h2>Chakra meditation</h2>
                    <span>
                      Create your own combination <ArrowRight size={16} />
                    </span>
                  </div>
                </button>
                <label className="search">
                  <span>Find a sound</span>
                  <input
                    type="search"
                    placeholder="Flute, bowl, raga…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <div className="section-heading">
                  <h2>Sounds &amp; studies</h2>
                  <span>{Object.keys(sounds).length} sounds</span>
                </div>
                <div className="sound-grid">
                  {(Object.entries(sounds) as [Sound, (typeof sounds)[Sound]][])
                    .filter(([id, s]) =>
                      (s.name + " " + s.type)
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                    )
                    .map(([id, s]) => (
                      <article className="sound-card" key={id}>
                        <div className="sound-top">
                          <span
                            className={"sound-symbol " + id}
                            aria-hidden="true"
                          >
                            <AudioLines size={28} />
                          </span>
                          <button
                            className="icon-button"
                            aria-label={
                              (starred.includes(id)
                                ? "Unfavorite "
                                : "Favorite ") + s.name
                            }
                            aria-pressed={starred.includes(id)}
                            onClick={() => favorite(id)}
                          >
                            <Heart
                              size={19}
                              fill={
                                starred.includes(id) ? "currentColor" : "none"
                              }
                            />
                          </button>
                        </div>
                        <button
                          className="sound-open"
                          onClick={() => openSound(id)}
                        >
                          <small>{s.type}</small>
                          <strong>{s.name}</strong>
                          <span>{s.detail}</span>
                        </button>
                      </article>
                    ))}
                </div>
                <p className="content-note">
                  Instrument sounds are original synthesis studies. Raga studies
                  use approximate tuning and await practitioner review.
                </p>
              </>
            )}
          </>
        )}
        {isStudio && (
          <>
            <div className="section-heading">
              <div>
                <p className="eyebrow">Create a session</p>
                <h1>Sound Studio</h1>
              </div>
              <button
                className="text-button"
                onClick={() => {
                  setSaving(true);
                  setMessage("");
                }}
              >
                Save
              </button>
            </div>
            <details className="tuner">
              <summary id="tuner-heading">
                Visual tuning · {focus.hz} Hz <span>{note(focus.hz)}</span>
              </summary>
              <div className="tuner-content">
                <Waveform />
                <label className="sr-only" htmlFor="visual-tuning">
                  Tune frequency
                </label>
                <input
                  id="visual-tuning"
                  type="range"
                  min={sounds[focus.sound].min}
                  max={sounds[focus.sound].max}
                  step=".1"
                  value={focus.hz}
                  onChange={(e) =>
                    patch({ ...focus, hz: Number(e.target.value) })
                  }
                />
                <div className="fine-tune">
                  <button
                    onClick={() =>
                      patch({
                        ...focus,
                        hz: Math.max(
                          sounds[focus.sound].min,
                          Math.round((focus.hz - 1) * 100) / 100,
                        ),
                      })
                    }
                    aria-label="Decrease frequency by 1 Hz"
                  >
                    −1 Hz
                  </button>
                  <span>Fine tuning</span>
                  <button
                    onClick={() =>
                      patch({
                        ...focus,
                        hz: Math.min(
                          sounds[focus.sound].max,
                          Math.round((focus.hz + 1) * 100) / 100,
                        ),
                      })
                    }
                    aria-label="Increase frequency by 1 Hz"
                  >
                    +1 Hz
                  </button>
                </div>
              </div>
            </details>
            {layers.map((c, i) => (
              <ChannelEditor
                key={c.id}
                value={{ ...c, seconds }}
                title={"Layer " + (i + 1)}
                showTransport={layers.length > 1}
                onChange={patch}
                states={states}
                onError={setMessage}
                remove={
                  i
                    ? () => {
                        engine.stop(c.id);
                        setLayers((rows) =>
                          rows.filter((row) => row.id !== c.id),
                        );
                      }
                    : undefined
                }
              />
            ))}
            <button
              className="add-layer"
              disabled={layers.length >= 8}
              onClick={() =>
                setLayers((rows) => [
                  ...rows,
                  { ...channel("tanpura", 216), seconds },
                ])
              }
            >
              <Plus size={20} /> Add sound layer
            </button>
            <details className="info-panel">
              <summary>About tuning &amp; sound</summary>
              <p>
                A flute follows a fundamental pitch. Bells and bowls tune their
                lowest selected resonance. A raga uses Sa as its tonic. Changing
                pitch preserves the pulse and session duration.
              </p>
            </details>
          </>
        )}
        {isChakras && (
          <>
            <div className="section-heading">
              <div>
                <p className="eyebrow">Choose your focus</p>
                <h1>Chakra meditation</h1>
              </div>
              <button
                className="text-button"
                disabled={!current.length}
                onClick={() => setSaving(true)}
              >
                Save
              </button>
            </div>
            <div className="segmented" aria-label="Mix selection">
              <button
                aria-pressed={mixTarget === "selected"}
                onClick={() => setMixTarget("selected")}
              >
                Selected ({selected.length})
              </button>
              <button
                aria-pressed={mixTarget === "all"}
                onClick={() => setMixTarget("all")}
              >
                All seven
              </button>
            </div>
            <div className="chakra-list">
              {chakras.map((c, i) => {
                const value = chakraChannels[i],
                  state = states.find((s) => s.id === c.id);
                return (
                  <article
                    className={"chakra-row " + (state ? "active" : "")}
                    style={{ "--chakra": c.color } as React.CSSProperties}
                    key={c.id}
                  >
                    <div className="chakra-head">
                      <label className="chakra-select">
                        <input
                          type="checkbox"
                          checked={selected.includes(c.id)}
                          onChange={(e) =>
                            setSelected((rows) =>
                              e.target.checked
                                ? [...rows, c.id]
                                : rows.filter((id) => id !== c.id),
                            )
                          }
                        />
                        <span className="chakra-dot" aria-hidden="true" />
                        <span>
                          <strong>{c.name}</strong>
                          <small>{c.focus}</small>
                        </span>
                      </label>
                      <div className="chakra-hz">
                        {c.hz}
                        <small> Hz</small>
                      </div>
                    </div>
                    <div className="chakra-controls">
                      <label className="chakra-type">
                        <span>Sound</span>
                        <select
                          aria-label={c.name + " sound type"}
                          value={value.sound}
                          disabled={Boolean(state)}
                          onChange={(e) =>
                            patch({ ...value, sound: e.target.value as Sound })
                          }
                        >
                          <option value="sine">Pure sine tone</option>
                          <option value="triangle">Soft triangle</option>
                          <option value="bowl">Singing bowl</option>
                        </select>
                      </label>
                      <div className="chakra-transport">
                        <Transport
                          compact
                          channels={[{ ...value, seconds }]}
                          states={states}
                          onError={setMessage}
                        />
                      </div>
                    </div>
                    <details>
                      <summary>
                        {state
                          ? state.status + " · " + time(state.time)
                          : "Volume & focus"}
                      </summary>
                      <div className="focus-controls">
                        <p>{c.prompt}</p>{" "}
                        <button
                          className="icon-button"
                          aria-label={
                            (value.muted ? "Unmute " : "Mute ") + c.name
                          }
                          aria-pressed={value.muted}
                          onClick={() =>
                            patch({ ...value, muted: !value.muted })
                          }
                        >
                          {value.muted ? "Off" : "On"}
                        </button>
                      </div>
                      <label className="range-label">
                        {c.name} volume{" "}
                        <output>{Math.round(value.volume * 100)}%</output>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={value.volume * 100}
                          onChange={(e) =>
                            patch({
                              ...value,
                              volume: Number(e.target.value) / 100,
                            })
                          }
                        />
                      </label>
                    </details>
                  </article>
                );
              })}
            </div>
            <details className="info-panel">
              <summary>About the frequency mapping</summary>
              <p>
                396, 417, 528, 639, 741, 852 and 963 Hz follow a modern
                Solfeggio meditation mapping. Associations differ across
                practices. The sounds support a personal spiritual listening
                practice.
              </p>
            </details>
          </>
        )}
        {tab === "library" && (
          <>
            <div className="section-heading">
              <div>
                <p className="eyebrow">Your personal collection</p>
                <h1>Library</h1>
              </div>
              {libraryView === "audio" && (
                <button onClick={() => importInput.current?.click()}>
                  <Upload size={18} /> Import
                </button>
              )}
            </div>
            <div className="segmented" aria-label="Library collection">
              <button
                aria-pressed={libraryView === "manifestation"}
                onClick={() => setLibraryView("manifestation")}
              >
                Affirmations
              </button>
              <button
                aria-pressed={libraryView === "audio"}
                onClick={() => setLibraryView("audio")}
              >
                Audio library
              </button>
            </div>
            {libraryView === "manifestation" ? (
              <ManifestLibrary onPractice={() => navigate("manifest")} />
            ) : (
              <>
                <input
                  ref={importInput}
                  type="file"
                  accept=".json,application/json"
                  className="sr-only"
                  onChange={(e) => importSession(e.target.files?.[0])}
                  aria-label="Import session file"
                />
                <section className="offline-card">
                  <Check size={22} />
                  <div>
                    <strong>
                      {offlineReady
                        ? "Player ready offline"
                        : "Preparing offline player"}
                    </strong>
                    <p>All built-in sounds are generated on this device.</p>
                  </div>
                </section>
                <PacksPanel library master={master} onMaster={setMaster} />
                <h2>Saved sessions</h2>
                {!sessions.length && (
                  <div className="empty">
                    <Library size={36} />
                    <h3>Your practice, saved.</h3>
                    <p>Build a session in Studio or Chakras, then tap Save.</p>
                    <button onClick={() => navigate("studio")}>
                      Open Studio <ArrowRight size={18} />
                    </button>
                  </div>
                )}
                {sessions.map((row) => (
                  <article className="saved-card" key={row.id}>
                    <div>
                      <h3>{row.name}</h3>
                      <p>
                        {row.channels.length} layers ·{" "}
                        {time(row.channels[0].seconds)} · {row.kind}
                      </p>
                    </div>
                    <button className="primary" onClick={() => load(row)}>
                      Open
                    </button>
                    <div className="saved-actions">
                      <button
                        onClick={() => {
                          const name = prompt("Session name", row.name);
                          if (name?.trim() && name.length <= 80)
                            storeRows(
                              sessions.map((s) =>
                                s.id === row.id
                                  ? { ...s, name: name.trim() }
                                  : s,
                              ),
                            );
                        }}
                      >
                        Rename
                      </button>
                      <button
                        onClick={() => {
                          setExporting(row);
                          setExportSeconds(
                            Math.min(
                              60,
                              Math.max(...row.channels.map((c) => c.seconds)),
                            ),
                          );
                          setExportError("");
                        }}
                      >
                        WAV audio
                      </button>
                      <button onClick={() => exportSession(row)}>
                        <Download size={16} /> Settings JSON
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Delete " + row.name + "?"))
                            storeRows(sessions.filter((s) => s.id !== row.id));
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
                <h2>Favorites</h2>
                <div className="favorite-list">
                  {starred.length ? (
                    starred.map((id) => (
                      <button key={id} onClick={() => openSound(id)}>
                        {sounds[id].name}
                        <ArrowRight size={18} />
                      </button>
                    ))
                  ) : (
                    <p className="content-note">
                      Tap a heart in Explore to keep a sound here.
                    </p>
                  )}
                </div>
              </>
            )}
          </>
        )}
        {message && (
          <div role="status" className="notice">
            <span>{message}</span>
            <button
              className="icon-button"
              aria-label="Dismiss message"
              onClick={() => setMessage("")}
            >
              <X size={18} />
            </button>
          </div>
        )}
      </main>
      {(isStudio || isChakras) && (
        <section
          ref={dockRef}
          className="player-dock"
          aria-label="Session player"
        >
          <details className="session-options">
            <summary>
              Session · {seconds / 60} min · Volume {Math.round(master * 100)}%
            </summary>
            <div className="dock-settings">
              <label>
                Timer
                <select
                  aria-label="Session duration"
                  value={seconds}
                  disabled={states.some((s) =>
                    current.some((c) => c.id === s.id),
                  )}
                  onChange={(e) => setSeconds(Number(e.target.value))}
                >
                  <option value="60">1 min</option>
                  <option value="300">5 min</option>
                  <option value="600">10 min</option>
                  <option value="1800">30 min</option>
                </select>
              </label>
              <label>
                Master <output>{Math.round(master * 100)}%</output>
                <input
                  aria-label="Master volume"
                  type="range"
                  min="0"
                  max="100"
                  value={master * 100}
                  onChange={(e) => setMaster(Number(e.target.value) / 100)}
                />
              </label>
            </div>
          </details>
          {errorInvalid ? (
            <p role="alert">Enter a frequency within the instrument’s range.</p>
          ) : (
            <Transport
              channels={currentWithTime}
              states={states}
              onError={setMessage}
            />
          )}
          {!current.length && (
            <p className="dock-caption">
              Select a chakra above or choose All seven.
            </p>
          )}
        </section>
      )}
      {["playing", "paused"].includes(practice.status) &&
        tab !== "manifest" && (
          <div ref={miniRef} className="mini-player">
            <span>{practice.plan?.name}</span>
            <button
              onClick={() =>
                practice.status === "playing"
                  ? manifestPlayer.pause()
                  : manifestPlayer.resume()
              }
            >
              {practice.status === "playing"
                ? "Pause practice"
                : "Resume practice"}
            </button>
            <button onClick={() => manifestPlayer.stop()}>Stop practice</button>
          </div>
        )}
      {!["playing", "paused"].includes(practice.status) &&
        activeCount > 0 &&
        tab !== "studio" &&
        tab !== "chakras" && (
          <div ref={miniRef} className="mini-player">
            <AudioLines size={20} />
            <span>{activeCount} layers playing</span>
            <button onClick={() => engine.stopAll()}>Stop all</button>
          </div>
        )}
      <nav className="bottom-nav" aria-label="Main navigation">
        {tabs.map(([id, label, Icon]) => (
          <button
            key={id}
            aria-current={
              tab === id || (id === "studio" && tab === "explore")
                ? "page"
                : undefined
            }
            onClick={() => navigate(id === "studio" ? lastSoundTab : id)}
          >
            <Icon size={22} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {settings && (
        <div className="modal-backdrop">
          <section
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
          >
            <div className="section-heading">
              <h2 id="settings-title">Settings</h2>
              <button
                autoFocus
                className="icon-button"
                onClick={() => setSettings(false)}
                aria-label="Close settings"
              >
                <X />
              </button>
            </div>
            <p>Core-aura · v{VERSION}</p>
            <p className="content-note">
              Keep your device volume comfortable. Stop if listening feels
              uncomfortable.
            </p>
            {!Capacitor.isNativePlatform() && (
              <button
                className="wide"
                onClick={() => {
                  setSettings(false);
                  navigate("admin");
                }}
              >
                Manage content
              </button>
            )}
            <button className="wide" onClick={update}>
              Check for updates
            </button>
            {updateStatus && <p role="status">{updateStatus}</p>}
            <fieldset className="appearance-controls">
              <legend>Display</legend>
              <label>
                Text size <output>{appearance.textSize}%</output>
                <input
                  aria-label="Text size"
                  type="range"
                  min="90"
                  max="140"
                  step="5"
                  value={appearance.textSize}
                  onChange={(e) =>
                    changeAppearance({
                      ...appearance,
                      textSize: Number(e.target.value),
                    })
                  }
                />
              </label>
              <label>
                Spacing
                <select
                  aria-label="Spacing"
                  value={appearance.density}
                  onChange={(e) =>
                    changeAppearance({
                      ...appearance,
                      density: e.target.value as Appearance["density"],
                    })
                  }
                >
                  <option value="compact">Compact</option>
                  <option value="comfortable">Comfortable</option>
                </select>
              </label>
              <button
                onClick={() =>
                  changeAppearance({ textSize: 100, density: "compact" })
                }
              >
                Reset display
              </button>
            </fieldset>
            <button
              className="wide"
              onClick={() => {
                engine.stopAll();
                setUpdateStatus("All audio stopped.");
              }}
            >
              Stop all audio
            </button>
            <details className="info-panel">
              <summary>Display information</summary>
              <pre>
                {JSON.stringify(
                  {
                    screen: [screen.width, screen.height],
                    page: document.documentElement.clientWidth,
                    zoom: getComputedStyle(document.documentElement).zoom,
                  },
                  null,
                  2,
                )}
              </pre>
            </details>
            <p className="content-note">
              Built-in sounds are synthesis studies. Clinical claims and
              cultural content require their respective review.
            </p>
          </section>
        </div>
      )}
      {exporting && (
        <div className="modal-backdrop">
          <section
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-title"
          >
            <div className="section-heading">
              <h2 id="export-title">Export audio</h2>
              <button
                autoFocus
                className="icon-button"
                aria-label="Close audio export"
                onClick={closeExport}
              >
                <X />
              </button>
            </div>
            <p>{exporting.name} · mono WAV · 44.1 kHz · 16-bit</p>
            <label>
              Export duration
              <select
                disabled={exportProgress !== null}
                aria-label="Export duration"
                value={exportSeconds}
                onChange={(e) => setExportSeconds(Number(e.target.value))}
              >
                {[
                  ...new Set([
                    Math.min(
                      60,
                      Math.max(...exporting.channels.map((c) => c.seconds)),
                    ),
                    15,
                    30,
                    60,
                    300,
                    600,
                  ]),
                ]
                  .filter(
                    (n) =>
                      n <=
                      Math.max(...exporting.channels.map((c) => c.seconds)),
                  )
                  .sort((a, b) => a - b)
                  .map((n) => (
                    <option key={n} value={n}>
                      {n < 60 ? n + " sec" : n / 60 + " min"}
                    </option>
                  ))}
              </select>
            </label>
            <p className="content-note">
              Renders saved settings from the beginning. No microphone
              recording. Maximum 10 minutes per export.
            </p>
            {exportProgress !== null ? (
              <>
                <label>
                  Rendering {exportProgress}%
                  <progress
                    aria-label="Audio export progress"
                    max="100"
                    value={exportProgress}
                  />
                </label>
                <button onClick={closeExport}>Cancel export</button>
              </>
            ) : (
              <button className="primary" onClick={renderAudio}>
                Download WAV
              </button>
            )}
            {exportError && <p role="status">{exportError}</p>}
          </section>
        </div>
      )}
      {saving && (
        <div className="modal-backdrop">
          <section
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="save-title"
          >
            <div className="section-heading">
              <h2 id="save-title">Save session</h2>
              <button
                className="icon-button"
                onClick={() => setSaving(false)}
                aria-label="Close save dialog"
              >
                <X />
              </button>
            </div>
            <label>
              Session name
              <input
                autoFocus
                maxLength={80}
                value={saveName}
                placeholder="Evening practice"
                onChange={(e) => setSaveName(e.target.value)}
              />
            </label>
            <p>
              {current.length} layers · {time(seconds)}
            </p>
            <button
              className="primary wide"
              disabled={!saveName.trim() || !current.length}
              onClick={save}
            >
              Save to Library
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
