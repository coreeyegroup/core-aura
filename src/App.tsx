import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  AudioLines,
  Compass,
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
  SlidersHorizontal,
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
  ["explore", "Explore", Compass],
  ["studio", "Studio", AudioLines],
  ["chakras", "Chakras", Flower2],
  ["library", "Library", Library],
] as const;
export default function App() {
  const [tab, setTab] = useState<Tab>(() => {
    const route = location.hash.slice(1);
    return ["studio", "chakras", "library"].includes(route)
      ? (route as Tab)
      : "explore";
  });
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
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
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
    if (!settings && !saving) return;
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSettings(false);
        setSaving(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = [
        ...document.querySelectorAll<HTMLElement>(
          '[role="dialog"] button:not(:disabled), [role="dialog"] input, [role="dialog"] summary',
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
  }, [settings, saving]);
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: "Core-aura",
      artist: "Personal listening session",
    });
    navigator.mediaSession.setActionHandler("pause", () =>
      engine.snapshot().forEach((s) => engine.pause(s.id)),
    );
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
          href="#explore"
          onClick={(e) => {
            e.preventDefault();
            navigate("explore");
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
                      <span className={"sound-symbol " + id} aria-hidden="true">
                        <AudioLines size={28} />
                      </span>
                      <button
                        className="icon-button"
                        aria-label={
                          (starred.includes(id) ? "Unfavorite " : "Favorite ") +
                          s.name
                        }
                        aria-pressed={starred.includes(id)}
                        onClick={() => favorite(id)}
                      >
                        <Heart
                          size={19}
                          fill={starred.includes(id) ? "currentColor" : "none"}
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
              Instrument sounds are original synthesis studies. Raga studies use
              approximate tuning and await practitioner review.
            </p>
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
            <section className="tuner" aria-labelledby="tuner-heading">
              <div className="tuner-top">
                <h2 id="tuner-heading">{sounds[focus.sound].name}</h2>
                <span>
                  {states.some((s) => s.id === focus.id) ? "Active" : "Ready"}
                </span>
              </div>
              <div className="frequency">
                {focus.hz.toFixed(focus.hz % 1 ? 2 : 0)}
                <span> Hz</span>
              </div>
              <p>
                {["yaman", "mohanam", "tanpura"].includes(focus.sound)
                  ? "Tonic · Sa"
                  : note(focus.hz)}
              </p>
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
            </section>
            {layers.map((c, i) => (
              <ChannelEditor
                key={c.id}
                value={c}
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
            <p className="lead">
              Listen to one frequency or create a combination.
            </p>
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
                        channels={[{ ...value, seconds }]}
                        states={states}
                        onError={setMessage}
                      />
                      <button
                        className="icon-button"
                        aria-label={
                          (value.muted ? "Unmute " : "Mute ") + c.name
                        }
                        aria-pressed={value.muted}
                        onClick={() => patch({ ...value, muted: !value.muted })}
                      >
                        {value.muted ? "Off" : "On"}
                      </button>
                    </div>
                    <details>
                      <summary>
                        {state
                          ? state.status + " · " + time(state.time)
                          : "Volume & focus"}
                      </summary>
                      <p>{c.prompt}</p>
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
              <button onClick={() => importInput.current?.click()}>
                <Upload size={18} /> Import
              </button>
            </div>
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
                            s.id === row.id ? { ...s, name: name.trim() } : s,
                          ),
                        );
                    }}
                  >
                    Rename
                  </button>
                  <button onClick={() => exportSession(row)}>
                    <Download size={16} /> Export
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
        <section className="player-dock" aria-label="Session player">
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
      {activeCount > 0 && tab !== "studio" && tab !== "chakras" && (
        <div className="mini-player">
          <AudioLines size={20} />
          <span>{activeCount} layers playing</span>
          <button onClick={() => engine.stopAll()}>Stop all</button>
        </div>
      )}
      <nav className="bottom-nav" aria-label="Main navigation">
        {tabs.map(([id, label, Icon]) => (
          <button
            key={id}
            aria-current={tab === id ? "page" : undefined}
            onClick={() => navigate(id)}
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
            <button className="wide" onClick={update}>
              Check for updates
            </button>
            {updateStatus && <p role="status">{updateStatus}</p>}
            <button
              className="wide"
              onClick={() => {
                const next =
                  localStorage.getItem("core-aura.display") === "phone"
                    ? "auto"
                    : "phone";
                localStorage.setItem("core-aura.display", next);
                location.reload();
              }}
            >
              <SlidersHorizontal size={19} /> Change phone display size
            </button>
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
