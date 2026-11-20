import { resolveItems } from "./playlists/model";
import { Track, tracks, trackEvent, trackCollection } from "./tracks/storage";
import { confirmSourceDeletion } from "./playlists/store";
import {queuePlayer, startQueue} from "./playlists/runtime";
import {QueueTransport} from "./playlists/QueueTransport";
import {PlaylistLibrary} from "./playlists/PlaylistLibrary";
import {chakraSequence} from "./workbench/sequence";
import {SequenceTransport} from "./workbench/SequenceControls";
import {BackgroundControls} from "./manifestation/BackgroundControls";
import {SettingsTools} from "./workbench/SettingsTools";
import {LibraryLabels,matchesItem} from "./workbench/LibraryLabels";
import {HomeControls} from "./workbench/HomeControls";
import {preferences, remember} from "./workbench/preferences";
import {observeHistory} from "./workbench/history";
import {PinButton} from "./workbench/PinButton";
import {prepareSound} from "./workbench/actions";
import { NatureLibrary } from "./nature/NatureLibrary";
import { isNature } from "./nature/catalog";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  AudioLines,
  House,
  Flower2,
  Library,
  Settings,
  X,
  Plus,
  Download,
  Upload,
  Heart,
  ArrowRight,
  WifiOff,
  Sparkles,
} from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { deliverFile, cleanupExports, fileSharing } from "./files/deliver";
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
  sessionDuration,
  sounds,
  validChannel,
} from "./model";
import { engine } from "./audio/engine";
import { favorites, readSessions, writeSessions } from "./storage";
import { ChannelEditor, Transport } from "./components/Controls";
import { LibraryStarters } from "./components/LibraryStarters";
import { collections, LibraryOverview } from "./components/LibraryOverview";
import { ChakraMixer } from "./components/ChakraMixer";
import { SoundTracks } from "./tracks/SoundTracks";
import { AndroidUpdates } from "./android/AndroidUpdates";
import { ConnectionPanel } from "./components/ConnectionPanel";
import { readWorkspace, saveWorkspace } from "./workspace";
import { Dashboard, Tool } from "./components/Dashboard";
import { Route, defaultRoute, parseRoute, routeHash } from "./navigation";
import {
  confirmDraftReplacement,
  draftChanged,
  isPreview,
  practiceActive,
} from "./manifestation/flow";
import { Waveform } from "./components/Waveform";
import { PacksPanel } from "./packs/PacksPanel";
import { Admin } from "./admin/Admin";
import { Manifestation, ManifestLibrary } from "./manifestation/Workspace";
import { LibrarySounds } from "./components/LibrarySounds";
import { manifestationStore } from "./manifestation/store";
import { manifestPlayer } from "./manifestation/player";
import { observePushReminders } from "./manifestation/push";
import { Due, observeReminders } from "./manifestation/reminders";
import {
  readAppearance,
  saveAppearance,
  applyAppearance,
  defaultCustomColor,
  Appearance,
} from "./appearance";

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
  ["home", "Home", House],
  ["manifest", "Manifest", Sparkles],
  ["studio", "Sounds", AudioLines],
  ["chakras", "Chakras", Flower2],
  ["library", "Library", Library],
] as const;

// Add each rebuilt screen here as it is ready. Explore shares the Sounds tab.
const rebuiltScreens: ReadonlySet<(typeof tabs)[number][0]> = new Set(["home", "library", "studio", "manifest", "chakras"]);

export default function App() {
  const [route, setRoute] = useState<Route>(() =>
    parseRoute(location.hash || "#" + preferences.snapshot().value.start),
  );
  const routeRef = useRef(route);
  routeRef.current = route;
  const {
    tab,
    manifestSection,
    libraryView,
    librarySection,
    exploreView,
  } = route;
  const primaryTab = tab === "explore" ? "studio" : tab;
  const showWorkspace = primaryTab === "admin" || rebuiltScreens.has(primaryTab);
  const screenName = tabs.find(([id]) => id === primaryTab)?.[1];
  const playlistView = librarySection === "playlists";
  const backgroundsView = libraryView === "backgrounds";
  const mixesView = libraryView === "mixes";
  const collection = collections.find(item => item.libraryView === libraryView && item.librarySection === librarySection);
  const manifestReady = rebuiltScreens.has("manifest");
  const [lastSoundTab, setLastSoundTab] = useState<"explore" | "studio">(() => {
    if (route.tab === "studio" || route.tab === "explore") return route.tab;
    try {
      return localStorage.getItem("core-aura.last-sound-view") === "studio"
        ? "studio"
        : "explore";
    } catch {
      return "explore";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("core-aura.last-sound-view", lastSoundTab);
    } catch {}
  }, [lastSoundTab]);
  useEffect(() => {
    const restore = () => {
      const next = parseRoute(location.hash, routeRef.current);
      if (next.tab === "home" && location.hash && !location.hash.startsWith("#home")) {
        history.replaceState(history.state, "", "#home");
      }
      routeRef.current = next;
      setRoute(next);
      if (next.tab === "studio" || next.tab === "explore")
        setLastSoundTab(next.tab);
      setMessage("");
      window.scrollTo({ top: 0 });
    };
    if (location.hash && !/^#(?:home|manifest|explore|studio|chakras|library|admin)(?:$|[/?])/.test(location.hash)) {
      history.replaceState(history.state, "", "#home");
    }
    addEventListener("popstate", restore);
    addEventListener("hashchange", restore);
    return () => {
      removeEventListener("popstate", restore);
      removeEventListener("hashchange", restore);
    };
  }, []);
  const headingMounted = useRef(false);
  useEffect(() => {
    const firstRender = !headingMounted.current;
    headingMounted.current = true;
    if (firstRender && tab === "library" && libraryView === "overview" && librarySection === "all") return;
    const heading = document.querySelector<HTMLElement>("#main h1");
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }, [tab, libraryView, librarySection]);
  const queue=useSyncExternalStore(queuePlayer.subscribe,queuePlayer.snapshot);
  const queueBusy=["playing","paused","error"].includes(queue.status);
  const [due, setDue] = useState<Due | null>(null);
  const practice = useSyncExternalStore(
    manifestPlayer.subscribe,
    manifestPlayer.snapshot,
  );
  useEffect(
    () => {
      if (rebuiltScreens.has("manifest") && !Capacitor.isNativePlatform()) {
        return observePushReminders();
      }
    },
    [],
  );
  useEffect(() => {
    void cleanupExports();
  }, []);
  function openManifest(id: string) {
    if (!rebuiltScreens.has("manifest")) {
      navigate("manifest");
      return false;
    }
    try {
      const playing = manifestPlayer.snapshot();
      if (
        playing.plan?.id !== id ||
        !["playing", "paused"].includes(playing.status)
      ) {
        const { draft, plans } = manifestationStore.snapshot().data;
        if (!confirmDraftReplacement(draft, plans)) return false;
        manifestPlayer.stop();
        manifestationStore.open(id);
      }
      navigate("manifest", { manifestSection: "practice" });
      setDue(null);
      window.scrollTo({ top: 0 });
      return true;
    } catch {
      setMessage(
        "The scheduled practice is unavailable. Check your saved practices.",
      );
    }
  }
  useEffect(() => {
    if (!rebuiltScreens.has("manifest")) return;
    return observeReminders((reminder) => {
      const { draft, plans } = manifestationStore.snapshot().data;
      const scheduled = plans.find((p) => p.id === reminder.planId);
      const unsaved = draftChanged(draft, plans);
      const playing = manifestPlayer.snapshot().status;
      if (
        scheduled &&
        reminder.autoStart &&
        document.visibilityState === "visible" &&
        location.hash !== "#admin" &&
        !unsaved &&
        !document.querySelector("dialog[open], [role=dialog]") &&
        !fileSharing() &&
        !["playing", "paused"].includes(playing) &&
        engine.snapshot().length === 0
      ) {
        try {
          if (openManifest(reminder.planId)) manifestPlayer.start(scheduled);
          return;
        } catch {}
      }
      setDue(reminder);
    }, openManifest);
  }, []);
  useEffect(() => {
    const url = new URL(location.href);
    const id = url.searchParams.get("manifestPlan");
    if (id) {
      if (openManifest(id)) {
        url.searchParams.delete("manifestPlan");
        history.replaceState(
          null,
          "",
          url.pathname + url.search + routeHash(routeRef.current),
        );
      }
    }
  }, []);
  const [workspace] = useState(readWorkspace);
  const [layers, setLayers] = useState<Channel[]>(
    () => workspace.data?.layers || [channel()],
  );
  const [chakraChannels, setChakraChannels] = useState<Channel[]>(
    () =>
      workspace.data?.chakraChannels ||
      chakras.map((c) => ({
        ...channel("sine", c.hz),
        id: c.id,
        volume: 0.25,
      })),
  );
  const [chakraFocus, setChakraFocus] = useState<string>();
  const [selected, setSelected] = useState<string[]>(
    workspace.data?.selected || [],
  );
  const [mixTarget, setMixTarget] = useState<"all" | "selected">(
    workspace.data?.mixTarget || "selected",
  );
  const [studioSeconds,setStudioSeconds]=useState(workspace.data?.seconds||300);
  const [chakraSeconds,setChakraSeconds]=useState(()=>{try{const n=Number(localStorage.getItem("core-aura.chakra-timer"));return Number.isInteger(n)&&n>=1&&n<=7200?n:workspace.data?.seconds||300;}catch{return workspace.data?.seconds||300;}});
  const seconds=tab==="chakras"?chakraSeconds:studioSeconds;
  const setSeconds=tab==="chakras"?setChakraSeconds:setStudioSeconds;
  useEffect(()=>{try{localStorage.setItem("core-aura.chakra-timer",String(chakraSeconds));}catch{}},[chakraSeconds]);
  useEffect(()=>observeHistory(),[]);
  const [master, setMaster] = useState(workspace.data?.master ?? 0.5);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [openedSoundName,setOpenedSoundName]=useState("");
  const [natureSessionToLoad,setNatureSessionToLoad] = useState<Session>();
  const [starred, setStarred] = useState<Sound[]>(favorites);
  const [message, setMessage] = useState(workspace.error);
  useEffect(() => {
    if (workspace.error || ![...layers, ...chakraChannels].every(validChannel))
      return;
    if (
      !saveWorkspace({
        schemaVersion: 1,
        layers,
        chakraChannels,
        selected,
        mixTarget,
        seconds:studioSeconds,
        master,
      })
    )
      setMessage(
        "Sound settings are only available for this visit because device storage is unavailable.",
      );
  }, [layers, chakraChannels, selected, mixTarget, studioSeconds, chakraSeconds, master]);
  const [settings, setSettings] = useState(false);
  const modalOpener = useRef<HTMLElement | null>(null);
  const [appearance, setAppearance] = useState(readAppearance);
  useEffect(() => {
    applyAppearance(appearance);
    const media = matchMedia("(prefers-color-scheme: dark)");
    const changed = () => applyAppearance(appearance);
    media.addEventListener("change", changed);
    return () => media.removeEventListener("change", changed);
  }, [appearance]);
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
          const blob = new Blob([data.buffer], { type: "audio/wav" }),
            name =
              "core-aura-" +
              row.name.replace(/[^a-z0-9_-]/gi, "-").slice(0, 60) +
              ".wav";
          worker.terminate();
          exportWorker.current = null;
          setExportProgress(null);
          void deliverFile(blob, name)
            .then(setExportError)
            .catch((e) => setExportError(e.message));
        }
      };
      worker.postMessage({
        channels: row.channels,
        master: row.master,
        seconds: exportSeconds,
        sequenceGap: row.sequenceGap,
      });
    } catch {
      setExportError("This session cannot be exported.");
      setExportProgress(null);
    }
  }
  const [saveName, setSaveName] = useState("");
  const [editingMix, setEditingMix] = useState<Session | undefined>();
  const [saveAsSequence, setSaveAsSequence] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [localTracks, setLocalTracks] = useState<Track[]>([]);
  const [trackReadError, setTrackReadError] = useState("");
  useEffect(() => {
    let generation = 0;
    const refresh = () => {
      const token = ++generation;
      void tracks().then(rows => {
        if (token === generation) { setLocalTracks(rows); setTrackReadError(""); }
      }).catch(error => {
        if (token === generation) setTrackReadError(error instanceof Error ? error.message : String(error));
      });
    };
    refresh();
    addEventListener(trackEvent, refresh);
    return () => { generation++; removeEventListener(trackEvent, refresh); };
  }, []);
  const [libraryQuery,setLibraryQuery]=useState("");
  const [librarySort,setLibrarySort]=useState("recent");
  const [selectedSessions,setSelectedSessions]=useState<string[]>([]);
  const librarySessions = sessions;
  const visibleSessions = librarySessions
    .filter(row => matchesItem(row.name + " " + row.kind, "session", row.id, libraryQuery))
    .sort((a, b) => librarySort === "name" ? a.name.localeCompare(b.name)
      : (b.createdAt || "").localeCompare(a.createdAt || ""));
  const chosenSessions = visibleSessions.filter(row => selectedSessions.includes(row.id));
  useSyncExternalStore(preferences.subscribe,preferences.snapshot);
  const [online, setOnline] = useState(navigator.onLine);
  const [offlineReady, setOfflineReady] = useState(false);
  const [updateStatus, setUpdateStatus] = useState("");
  const states = useSyncExternalStore(engine.subscribe, engine.snapshot);
  const sequence=useSyncExternalStore(chakraSequence.subscribe,chakraSequence.snapshot);
  const recentPractice = !queueBusy && practice.status === "playing" && !isPreview(practice) ? practice.plan?.id : undefined;
  useEffect(() => {
    if (recentPractice && manifestationStore.snapshot().data.plans.some(plan => plan.id === recentPractice)) {
      remember({ kind: "practice", id: recentPractice });
    }
  }, [recentPractice]);
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
  const isNatureView = tab === "explore" && exploreView === "nature";
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
  }, [tab, practice.status, states.length > 0]);
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
    if (!settings && !saving && !exporting) {
      const opener = modalOpener.current;
      modalOpener.current = null;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
      return;
    }
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
          '[role="dialog"] button:not(:disabled), [role="dialog"] input:not(:disabled):not([type="file"]), [role="dialog"] select:not(:disabled), [role="dialog"] summary, [role="dialog"] a[href], [role="dialog"] textarea:not(:disabled)',
        ),
      ].filter(element => element.getClientRects().length > 0);
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
    const handlers: Partial<Record<MediaSessionAction, MediaSessionActionHandler>> = {
      play: () => {
        if (queuePlayer.snapshot().status === "paused") { void queuePlayer.resume(); return; }
        if (chakraSequence.snapshot().status === "paused") { chakraSequence.resume(); return; }
        if (manifestPlayer.snapshot().status === "paused") manifestPlayer.resume();
        engine.snapshot().filter(sound => sound.status === "paused" && !sound.id.startsWith("manifest-background"))
          .forEach(sound => void engine.resume(sound.id).catch(() => setMessage("Audio could not resume. Try Play in Core-aura.")));
      },
      pause: () => {
        if (queuePlayer.snapshot().status === "playing") { queuePlayer.pause(); return; }
        if (chakraSequence.snapshot().status === "playing") { chakraSequence.pause(); return; }
        manifestPlayer.pause();
        engine.snapshot().forEach(sound => engine.pause(sound.id));
      },
      stop: () => {
        queuePlayer.stop();
        chakraSequence.stop();
        manifestPlayer.stop();
        engine.stopAll();
      },
      nexttrack: () => { void queuePlayer.next(); },
      previoustrack: () => {
        if (queuePlayer.snapshot().index > 0) void queuePlayer.previous();
      },
    };
    const registered: MediaSessionAction[] = [];
    for (const [action, handler] of Object.entries(handlers)) {
      try {
        navigator.mediaSession.setActionHandler(action as MediaSessionAction, handler);
        registered.push(action as MediaSessionAction);
      } catch { /* Some platforms expose only a subset of media actions. */ }
    }
    return () => registered.forEach(action => navigator.mediaSession.setActionHandler(action, null));
  }, []);
  useEffect(() => {
    if (!("mediaDevices" in navigator)) return;
    const changed = () => {
      manifestPlayer.pause();
      engine.stopAll();
      setMessage("Audio output changed. Check the volume, then press Play.");
    };
    navigator.mediaDevices.addEventListener("devicechange", changed);
    return () =>
      navigator.mediaDevices.removeEventListener("devicechange", changed);
  }, []);
  function navigate(value: Tab, patch: Partial<Route> = {}) {
    if (value === "explore" || value === "studio") setLastSoundTab(value);
    if ("libraryView" in patch || "librarySection" in patch) {
      setLibraryQuery("");
      setSelectedSessions([]);
    }
    const next = { ...routeRef.current, tab: value, ...patch };
    if (value === "library" && next.librarySection === "playlists") next.libraryView = "overview";
    const hash = routeHash(next);
    if (location.hash !== hash) history.pushState({ coreAuraFrom: location.hash || routeHash(routeRef.current) }, "", hash);
    routeRef.current = next;
    setRoute(next);
    setMessage("");
    window.scrollTo({ top: 0 });
  }
  function openTool(tool: Tool) {
    if (tool === "display") {
      setSettings(true);
      return;
    }
    if (tool === "schedule") {
      navigate("manifest", { manifestSection: "schedule" });
      return;
    }
    if (tool === "packs") {
      navigate("explore", { exploreView: "packs" });
      return;
    }
    if (
      ["affirmations", "recordings", "sessions", "practices"].includes(tool)
    ) {
      navigate("library", {
        libraryView: tool === "sessions" ? "mixes" : "manifestation",
        librarySection:
          tool === "recordings"
            ? "recordings"
            : tool === "practices"
              ? "saved"
              : "all",
      });
      return;
    }
    navigate(tool as Tab);
  }
  function patch(updated: Channel) {
    const spec = sounds[updated.sound];
    if (updated.hz >= spec.min && updated.hz <= spec.max) engine.patch(updated);
    const setter = chakras.some((c) => c.id === updated.id)
      ? setChakraChannels
      : setLayers;
    setter((rows) => rows.map((c) => (c.id === updated.id ? updated : c)));
  }
  function replaceSoundDraft() {
    const normalized=(rows:Channel[],timer:number)=>JSON.stringify(rows.map(({id,...c})=>({...c,seconds:timer})));
    const untouched=master===.5&&layers.length===1&&layers[0].sound==="sine"&&layers[0].hz===432&&layers[0].volume===.3&&!layers[0].muted&&studioSeconds===300;
    const saved=sessions.some(s=>s.kind!=="chakras"&&s.master===master&&normalized(s.channels,s.channels[0].seconds)===normalized(layers,studioSeconds));
    return untouched||saved||confirm("Replace the unfinished sound workspace? Save it in Library first if you want to keep it.");
  }
  function configureSound(sound:Sound,frequency?:number) {
    if(!replaceSoundDraft())return;
    setEditingMix(undefined);
    layers.forEach(c=>engine.stop(c.id));
    const hz=frequency??(isNature(sound)?1000:["tanpura","yaman","mohanam","shruti"].includes(sound)?216:sound==="hum"?144:432);
    setOpenedSoundName(sounds[sound].name);setLayers([channel(sound,hz)]);
  }
  function openSound(sound: Sound, frequency?: number) {
    if(!replaceSoundDraft())return;
    setEditingMix(undefined);
    layers.forEach((c) => engine.stop(c.id));
    const hz =
      frequency ??
      (["yaman", "mohanam", "tanpura"].includes(sound) ? 216 : 432);
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
  function save(asCopy = false) {
    try {
      const ordered = [...currentWithTime];
      const sequential = isChakras && saveAsSequence;
      if (sequential) {
        const order = sequence.order.concat(ordered.map(channel => channel.id));
        ordered.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
      }
      const original = !asCopy && editingMix?.kind === (isChakras ? "chakras" : "studio")
        ? sessions.find(session => session.id === editingMix.id) : undefined;
      const row = parseSession({
        schemaVersion: 2,
        engineVersion: ENGINE_VERSION,
        id: original?.id ?? crypto.randomUUID(),
        name: saveName.trim(),
        kind: isChakras ? "chakras" : "studio",
        channels: sequential ? ordered.map(channel => ({ ...channel, seconds: sequence.seconds })) : currentWithTime,
        sequenceGap: sequential ? sequence.gap : undefined,
        master,
        createdAt: original?.createdAt ?? new Date().toISOString(),
      });
      if (storeRows(original ? sessions.map(item => item.id === row.id ? row : item) : [...sessions, row])) {
        setEditingMix(undefined);
        setSaving(false);
        setSaveName("");
        setMessage("Session saved in Library.");
      }
    } catch (error) {
      setMessage((error as Error).message);
    }
  }
  function load(row: Session, edit = false) {
    if(row.kind!=="chakras"&&!replaceSoundDraft())return;
    if(!prepareSound(row.channels.map(c=>c.id),false,true))return;
    setEditingMix(edit ? row : undefined);
    if (edit) setSaveName(row.name);
    setOpenedSoundName(row.name);
    engine.stopAll();
    setMaster(row.master);
    if(row.kind==="chakras")setChakraSeconds(row.channels[0].seconds);else setStudioSeconds(row.channels[0].seconds);
    if (row.kind === "nature") {
      setNatureSessionToLoad(row);navigate("explore",{exploreView:"nature"});
    } else if (row.kind === "chakras") {
      const map = new Map(row.channels.map((c) => [c.id, c]));
      setChakraChannels(
        chakras.map(
          (c) => map.get(c.id) || { ...channel("sine", c.hz), id: c.id },
        ),
      );
      setSelected(row.channels.map((c) => c.id));
      if (row.sequenceGap !== undefined) {
        try {
          chakraSequence.configure({ order: row.channels.map(channel => channel.id), seconds: row.channels[0].seconds, gap: row.sequenceGap });
        } catch (error) { setMessage((error as Error).message); }
      }
      setMixTarget("selected");
      navigate("chakras");
    } else {
      setLayers(row.channels.map((c) => ({ ...c })));
      navigate("studio");
    }
    setMessage("Loaded " + row.name + (row.sequenceGap === undefined
      ? ". Press Play to begin." : ". Open Sequential chakra playback and press Start sequence."));
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
    void deliverFile(
      new Blob([JSON.stringify(row, null, 2)], { type: "application/json" }),
      "core-aura-session.json",
    )
      .then(setMessage)
      .catch((e) => setMessage(e.message));
  }
  async function importSession(file?: File) {
    if (importInput.current) importInput.current.value = "";
    if (!file) return;
    if (file.size > 100000) {
      setMessage("Choose a session file smaller than 100 KB.");
      return;
    }
    try {
      const value=JSON.parse(await file.text());
      const incoming=value.kind==="core-aura-session-collection"&&value.schemaVersion===1?value.sessions:[value];
      if(!Array.isArray(incoming)||!incoming.length||incoming.length>100)throw Error("Invalid collection.");
      const rows=incoming.map(v=>({...parseSession(v),id:crypto.randomUUID()}));
      if(storeRows([...sessions,...rows]))setMessage(rows.length+" session(s) imported.");
    } catch {
      setMessage(
        "This file has invalid settings or an unsupported session version.",
      );
    }
  }
  async function update() {
    if (queueBusy || states.length || ["playing", "paused"].includes(practice.status)) {
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
  useEffect(()=>{if(!queueBusy)queuePlayer.setOutput(master);},[queueBusy,master]);
  const focus = layers[0];
  const activeCount = states.filter((s) => s.status === "playing").length;
  const errorInvalid = currentWithTime.some((c) => !validChannel(c));
  const practiceBusy = ["playing", "paused"].includes(practice.status);
  const soundStates = states.filter(
    (state) => state.id !== "manifest-background" && !state.id.startsWith("manifest-background:"),
  );
  const showPlaybackBar = practiceBusy
    ? tab !== "manifest"
    : (soundStates.length > 0 || ["playing", "paused"].includes(sequence.status))
      && !isStudio && !isChakras
      && (!isNatureView || soundStates.some(state => !state.id.startsWith("nature:")));
  const playingSounds = sequence.status==="playing" || soundStates.some((state) => state.status === "playing");
  function openPlayingSound() {
    if (soundStates.some(state => state.id.startsWith("library:preview:"))) {
      const id = soundStates.find(state => state.id.startsWith("library:preview:"))!.id.slice("library:preview:".length);
      navigate("library", { libraryView: isNature(id) ? "backgrounds" : "sounds", librarySection: "all" });
      return;
    }
    if (soundStates.some(state => state.id.startsWith("nature:"))) {
      navigate("explore", { exploreView: "nature" });
      return;
    }
    if (soundStates.some(state => state.id.startsWith("pack:")))
      navigate("library", { libraryView: "packs", librarySection: "all" });
    else if (soundStates.some(state => state.id.startsWith("track:"))) {
      const track = localTracks.find(row => soundStates.some(state => state.id === row.id));
      navigate("library", { libraryView: track ? trackCollection(track) : "audio", librarySection: "all" });
    }
    else
      navigate(
        soundStates.some((state) =>
          chakras.some((chakra) => chakra.id === state.id),
        )
          ? "chakras"
          : "studio",
      );
  }
  async function toggleSoundPlayback() {
    try {
      if(["playing","paused"].includes(sequence.status)){if(sequence.status==="playing")chakraSequence.pause();else chakraSequence.resume();return;}
      if (playingSounds) soundStates.forEach((state) => engine.pause(state.id));
      else {
        await Promise.all(soundStates.map(state=>engine.resume(state.id)));
      }
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  const playbackBar = (
    <div
      ref={miniRef}
      className={
        isStudio || isChakras || isNatureView || tab === "manifest"
          ? "playback-banner"
          : "mini-player"
      }
      aria-label="Active playback"
    >
      <button
        className="playback-location"
        onClick={() =>
          practiceBusy
            ? manifestReady
              ? navigate("manifest", { manifestSection: "practice" })
              : navigate("library", { libraryView: "manifestation", librarySection: "saved" })
            : openPlayingSound()
        }
      >
        {practiceBusy
          ? isPreview(practice)
            ? "Sentence preview"
            : practice.plan?.name
          : ["playing","paused"].includes(sequence.status)?"Chakra sequence · "+(sequence.index+1)+"/"+sequence.channels.length
          : soundStates.some((s) => s.id.startsWith("nature:"))
            ? "Nature mix"
            : soundStates.some((s) => s.id.startsWith("track:"))
            ? "Sound tracks"
            : soundStates.some((s) => s.id.startsWith("pack:"))
              ? "Downloaded audio"
            : openedSoundName || `${soundStates.length} sound layers`}
        <small>
          {practiceBusy
            ? practice.status
            : playingSounds
              ? "Playing"
              : "Paused"}{" "}
          · Open player
        </small>
      </button>
      <button
        onClick={() =>
          practiceBusy
            ? practice.status === "playing"
              ? manifestPlayer.pause()
              : manifestPlayer.resume()
            : void toggleSoundPlayback()
        }
      >
        {practiceBusy
          ? practice.status === "playing"
            ? "Pause practice"
            : "Resume practice"
          : playingSounds
            ? "Pause audio"
            : "Resume audio"}
      </button>
      <button
        onClick={() => {
          manifestPlayer.stop();
          engine.stopAll();
        }}
      >
        {practiceBusy ? "Stop practice" : "Stop all"}
      </button>
      {tab !== "library" && <details className="global-levels"><summary>Levels</summary><label className="range-label">Sound output <output>{Math.round(master*100)}%</output><input aria-label="Player sound output" type="range" min="0" max="100" value={master*100} onChange={e=>setMaster(Number(e.target.value)/100)}/></label>{practiceBusy&&practice.plan&&<><label className="range-label">Voice · next sentence <output>{Math.round(practice.plan.volume*100)}%</output><input aria-label="Player voice level" type="range" min="0" max="100" value={practice.plan.volume*100} onChange={e=>manifestPlayer.setVoiceLevel(Number(e.target.value)/100)}/></label><BackgroundControls plan={practice.plan} sessions={sessions} active onChange={patch=>manifestPlayer.updateBackground(patch)}/></>}<p className="content-note">{soundStates.length} sound sources · Open player for individual controls.</p><button onClick={()=>{manifestPlayer.stop();engine.stopAll();}}>Stop all audio</button></details>}
    </div>
  );
  const natureLibrary = (
    <NatureLibrary
      favorites={starred}
      onFavorite={favorite}
      master={master}
      onMaster={setMaster}
      sessions={sessions}
      editingName={editingMix?.kind === "nature" ? editingMix.name : undefined}
      onEndEdit={() => setEditingMix(undefined)}
      onSave={(row, asCopy) => {
        const original = editingMix?.kind === "nature" && !asCopy ? editingMix : undefined;
        if (original && !sessions.some(item => item.id === original.id)) {
          throw Error("This mix was removed. Use Save as copy to keep your edits.");
        }
        const saved = storeRows(original ? sessions.map(item => item.id === original.id
          ? { ...row, id: original.id, createdAt: original.createdAt } : item) : [...sessions, row]);
        if (saved) setEditingMix(undefined);
        return saved;
      }}
      initialSession={natureSessionToLoad}
      onLoaded={() => setNatureSessionToLoad(undefined)}
      onLibrary={() => navigate("library", { libraryView: "mixes", librarySection: "all" })}
    />
  );
  return (
    <div className="app" data-screen={tab}>
      <header className="app-header">
        <a
          href="#home"
          onClick={(e) => {
            e.preventDefault();
            navigate("home");
          }}
          className="brand"
        >
          <span className="brand-mark" aria-hidden="true">
            <AudioLines size={21} />
          </span>
          <span className="brand-name">
            Core Aura
          </span>
        </a>
        <div className="header-actions">
          {showWorkspace && (
            <span className={"connection-status " + (online ? "connected" : "")}>
              <i aria-hidden="true" />
              {online ? "Online" : "Offline"}
            </span>
          )}
          {showWorkspace && !Capacitor.isNativePlatform() && (
            <a
              className="header-download"
              href="/download.html"
              target="_blank"
              rel="noopener"
              aria-label="Download Android app"
            >
              <Download size={20} />
            </a>
          )}
          <button
            className="icon-button"
            onClick={(event) => { modalOpener.current = event.currentTarget; setSettings(true); }}
            aria-label="Settings"
          >
            <Settings size={22} />
          </button>
        </div>
      </header>
      <main id="main" tabIndex={-1} inert={settings||saving||!!exporting ? true : undefined}>
        {showWorkspace ? <>
        {!queueBusy && showPlaybackBar &&
          (isStudio || isChakras || isNatureView || (tab === "manifest" && !practiceBusy)) &&
          playbackBar}
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
        {tab === "home" && (
          <Dashboard>
            <HomeControls
              sessions={sessions}
              tracks={localTracks}
              onPractice={openManifest}
              onSession={load}
              onDownloads={() => navigate("library", { libraryView: "packs", librarySection: "all" })}
              onOpen={(page) => {
                if (page === "manifest") navigate("manifest", { manifestSection: "practice" });
                else if (page === "schedule") openTool("schedule");
                else if (page === "library") navigate("library", { librarySection: "playlists" });
                else navigate(page);
              }}
              tools={
                <div className="home-actions">
                  <button onClick={() => openTool("affirmations")}>Affirmations</button>
                  <button onClick={() => openTool("recordings")}>Recordings</button>
                  <button onClick={() => openTool("packs")}>Sound packs</button>
                  <button onClick={() => openTool("sessions")}>Saved sessions</button>
                  <button onClick={() => openTool("schedule")}>Schedule</button>
                </div>
              }
            />
          </Dashboard>
        )}
        {tab === "manifest" && (
          <Manifestation
            sessions={sessions}
            tracks={localTracks}
            queueActive={queueBusy}
            initialView={manifestSection}
            onView={(view) => navigate("manifest", { manifestSection: view })}
            onLibrary={() => openTool("affirmations")}
            onOpenPractice={openManifest}
            onPlaylists={() => navigate("library", { librarySection: "playlists" })}
            onBackgrounds={() => navigate("library", { libraryView: "backgrounds", librarySection: "all" })}
          />
        )}
        {(tab === "explore" || tab === "studio") && (
          <div className="segmented" aria-label="Sound workspace">
            <button
              aria-pressed={tab === "explore" && (exploreView === "sounds" || exploreView === "nature")}
              onClick={() => navigate("explore", { exploreView: "sounds" })}
            >
              Explore
            </button>
            <button
              aria-pressed={tab === "studio"}
              onClick={() => navigate("studio")}
            >
              Studio
            </button>
            <button aria-pressed={tab==="explore"&&exploreView==="tracks"} onClick={()=>navigate("explore",{exploreView:"tracks"})}>Tracks</button>
            <button aria-label="Sound packs" aria-pressed={tab==="explore"&&exploreView==="packs"} onClick={()=>navigate("explore",{exploreView:"packs"})}>Packs</button>
          </div>
        )}
        {tab === "admin" && <Admin />}
        {tab === "explore" && (
          <>
            {(exploreView === "sounds" || exploreView === "tracks") && <>
            <div className="page-heading">
              <h1>{exploreView === "tracks" ? "Sound tracks" : "Sound catalog"}</h1>
              {exploreView === "sounds" && <p>
                {Object.keys(sounds).length} generated sounds and studies ·
                adjustable tuning · layered playback
              </p>}
            </div>
            </>}
            {(exploreView === "sounds" || exploreView === "nature") && <div className="segmented" aria-label="Explore collection">
              <button
                aria-pressed={exploreView === "sounds"}
                onClick={() => navigate("explore", { exploreView: "sounds" })}
              >
                Sounds
              </button>

              <button aria-pressed={exploreView === "nature"} onClick={()=>navigate("explore",{exploreView:"nature"})}>Nature library</button>
            </div>}
            {exploreView === "tracks" ? <SoundTracks defaultOpen/> : exploreView === "packs" ? (
              <PacksPanel online={online} />
            ) : exploreView === "nature" ? (
              natureLibrary
            ) : (
              <>
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
                  <span>{Object.keys(sounds).filter(id=>!isNature(id)).length} sounds</span>
                </div>
                <div className="sound-grid">
                  {(Object.entries(sounds) as [Sound, (typeof sounds)[Sound]][])
                    .filter(([id]) => !isNature(id))
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
                <p className="eyebrow">
                  {layers.length}/8 layers · {seconds / 60} min
                </p>
                <h1>Sound Studio</h1>
              </div>
              <button
                className="text-button"
                onClick={(event) => {
                  modalOpener.current = event.currentTarget;
                  setSaving(true);
                  setMessage("");
                }}
              >
                Save
              </button>
            </div>
            <section className="studio-monitor" aria-label="Sound monitor">
              <div>
                <span className="eyebrow">{sounds[focus.sound].name}</span>
                <strong className="monitor-hz">
                  {isNature(focus.sound) && !focus.focus ? "Natural" : focus.hz}
                  {(!isNature(focus.sound) || focus.focus) && <small> Hz</small>}
                </strong>
                <p>{isNature(focus.sound) ? (focus.focus ? "Frequency-focus filter" : "Full texture · frequency focus off") : note(focus.hz)}</p>
              </div>
              <div>
                <Waveform />
                <span className="monitor-status">
                  {activeCount
                    ? `${activeCount} layers playing`
                    : "Ready to play"}{" "}
                  · {Math.round(master * 100)}% master
                </span>
              </div>
            </section>
            {!isNature(focus.sound) && <details className="tuner">
              <summary id="tuner-heading">
                Visual tuning · {focus.hz} Hz <span>{note(focus.hz)}</span>
              </summary>
              <div className="tuner-content">
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
            </details>}
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
                <p className="eyebrow">
                  {selected.length}/7 selected · {seconds / 60} min
                </p>
                <h1>Chakra meditation</h1>
              </div>
              <button
                className="text-button"
                disabled={!current.length}
                onClick={(event) => {
                  modalOpener.current = event.currentTarget;
                  setSaveAsSequence(editingMix?.kind === "chakras" && editingMix.sequenceGap !== undefined);
                  setSaving(true);
                }}
              >
                Save
              </button>
            </div>
            <ChakraMixer tracks={localTracks} focusId={chakraFocus} channels={chakraChannels} states={states} selected={selected} target={mixTarget} seconds={seconds} master={master} onSelect={setSelected} onTarget={setMixTarget} onSeconds={setSeconds} onMaster={setMaster} onChange={patch} onError={setMessage}/>
          </>
        )}
        {tab === "library" && (
          <>
            {collection ? (
              <header className="library-collection-header">
                <button onClick={() => {
                  if (typeof history.state?.coreAuraFrom === "string") history.back();
                  else navigate("library", { libraryView: "overview", librarySection: "all" });
                }}>
                  Back
                </button>
                <div>
                  <h1>{collection.label}</h1>
                  <p className="content-note">{collection.description}</p>
                </div>
              </header>
            ) : <LibraryOverview onOpen={route => navigate("library", route)} />}
            {(libraryView === "sounds" || backgroundsView || libraryView === "audio") && (
              <SoundTracks key={"imports-" + libraryView} collection={backgroundsView ? "backgrounds" : libraryView === "sounds" ? "sounds" : "audio"}>
                {libraryView !== "audio" && <LibrarySounds
              key={"built-in-" + libraryView}
              backgrounds={backgroundsView}
              favorites={starred}
              onFavorite={favorite}
              onExport={(name, sample, control) => {
                modalOpener.current = control;
                setExporting({
                  schemaVersion: 2, engineVersion: ENGINE_VERSION, kind: "studio",
                  id: sample.id, name, channels: [sample], master, createdAt: "",
                });
                setExportSeconds(sample.seconds);
                setExportError("");
              }}
            />}
              </SoundTracks>
            )}
            {playlistView && <LibraryStarters section="playlists" />}
            {librarySection === "saved" && <LibraryStarters section="practices" query={libraryQuery} />}
            {mixesView && <h2>Saved mixes on this device</h2>}
            {mixesView && <div className="home-actions">
              <button onClick={() => navigate("explore", { exploreView: "nature" })}>
                Open Sounds
              </button>
            </div>}
            {(mixesView || librarySection === "saved") && <div className="fields">
              <label>{mixesView ? "Search saved mixes" : "Search saved practices"}
                <input aria-label="Search library" type="search" value={libraryQuery}
                  onChange={event => { setLibraryQuery(event.target.value); setSelectedSessions([]); }}
                  placeholder="Name, tag or collection"/>
              </label>
              <label>Sort saved items <select aria-label="Sort library" value={librarySort} onChange={event => setLibrarySort(event.target.value)}>
                <option value="recent">Recently saved</option><option value="name">Name A–Z</option>
              </select></label>
            </div>}
            {mixesView && <LibraryStarters
              key={"starters-" + libraryView}
              section="mixes"
              query={libraryQuery}
              onSaveMix={session => storeRows([...sessions, {
                ...session, id: crypto.randomUUID(), createdAt: new Date().toISOString(),
              }])}
            />}
            {mixesView && <LibraryStarters section="backgrounds" query={libraryQuery}
              onSaveMix={session => storeRows([...sessions, { ...session, id: crypto.randomUUID(), createdAt: new Date().toISOString() }])} />}
            {libraryView === "chakras" && <section className="library-starters" aria-label="Library chakras">
              {chakras.map(chakra => <article className="library-starter" key={chakra.id}>
                <div><h3>{chakra.name}</h3><small>{chakraChannels.find(row => row.id === chakra.id)?.hz ?? chakra.hz} Hz</small></div>
                <button aria-label={"Configure " + chakra.name} onClick={() => {
                  setChakraFocus(chakra.id);
                  navigate("chakras");
                }}><Settings size={16} aria-hidden="true" /> Configure</button>
              </article>)}
            </section>}
            {libraryView === "packs" && <>
              <PacksPanel embedded online={online} offlineReady={offlineReady} />
              <PacksPanel library />
            </>}
            {playlistView ? <PlaylistLibrary sessions={sessions} tracks={localTracks} trackError={trackReadError}/> : libraryView === "manifestation" ? (
              <ManifestLibrary
                search={libraryQuery}
                sort={librarySort}
                section={librarySection}
                onPractice={librarySection === "saved" ? (id) => {
                  if (id) { openManifest(id); return; }
                  const { draft, plans } = manifestationStore.snapshot().data;
                  if (!confirmDraftReplacement(draft, plans)) return;
                  try {
                    manifestationStore.fresh();
                    navigate("manifest", { manifestSection: "practice" });
                  } catch (error) { setMessage((error as Error).message); }
                } : librarySection === "all" && history.state?.coreAuraFrom === "#manifest"
                  ? () => history.back() : undefined}
                focusOnEntry={false}
              />
            ) : mixesView ? (
              <>
                <input
                  ref={importInput}
                  type="file"
                  accept=".json,application/json"
                  className="sr-only"
                  onChange={(e) => importSession(e.target.files?.[0])}
                  aria-label="Import session file"
                />
                {visibleSessions.length > 0 && <details className="library-more">
                  <summary>Manage multiple mixes</summary>
                  <div className="saved-actions">
                    <button disabled={!visibleSessions.length} onClick={() => setSelectedSessions(visibleSessions.map(row => row.id))}>Select shown mixes</button>
                    <button disabled={!chosenSessions.length} onClick={() => setSelectedSessions([])}>Clear mix selection</button>
                    <button disabled={!chosenSessions.length} onClick={() => {
                      const text = JSON.stringify({kind: "core-aura-session-collection", schemaVersion: 1, sessions: chosenSessions});
                      if (text.length > 100000) { setMessage("Select fewer mixes or use a full backup ZIP."); return; }
                      void deliverFile(new Blob([text], {type: "application/json"}), "core-aura-mixes.json").then(setMessage).catch(error => setMessage(error.message));
                    }}>Export selected mixes</button>
                    <button disabled={!chosenSessions.length} onClick={() => {
                      if (confirmSourceDeletion("session", chosenSessions, "Practices keep their attached copies.")) {
                        if (storeRows(sessions.filter(row => !chosenSessions.some(chosen => chosen.id === row.id)))) setSelectedSessions([]);
                      }
                    }}>Delete selected mixes</button>
                  </div>
                </details>}
                {chosenSessions.length > 0 && <p className="content-note">{chosenSessions.length} {chosenSessions.length === 1 ? "mix" : "mixes"} selected</p>}
                {librarySessions.length > 0 && !visibleSessions.length && <p role="status">No mixes match this search.</p>}
                {!librarySessions.length && (
                  <div className="empty">
                    <Library size={36} />
                    <h3>No saved mixes</h3>
                    <p>Create a mix from Sounds or import its settings file.</p>
                  </div>
                )}
                {visibleSessions.map((row) => (
                  <article className="saved-card" key={row.id}>
                    <label className="check"><input type="checkbox" aria-label={"Select mix "+row.name} checked={selectedSessions.includes(row.id)} onChange={e=>setSelectedSessions(e.target.checked?[...selectedSessions,row.id]:selectedSessions.filter(id=>id!==row.id))}/> Select</label>
                    <div>
                      <h3>{row.name}</h3>
                      <p>
                        {row.channels.length} layers ·{" "}
                        {time(sessionDuration(row))} · {row.sequenceGap === undefined ? row.kind : "chakra sequence"}
                      </p>
                    </div>

                    <div className="saved-actions">
                      <button aria-label={"Test play " + row.name} onClick={() => {
                        void Promise.resolve().then(() =>
                          startQueue(resolveItems([{ kind: "session", id: row.id }], [], sessions, localTracks), row.name)
                        ).catch(error => setMessage(error.message));
                      }}>Test play</button>
                      {row.kind === "nature" ? <button onClick={() => {
                        if (!prepareSound(row.channels.map(channel => channel.id), false, true)) return;
                        setEditingMix(row);
                        setNatureSessionToLoad(row);
                        navigate("explore", { exploreView: "nature" });
                      }}>Edit in Sounds</button> : rebuiltScreens.has(row.kind === "chakras" ? "chakras" : "studio") &&
                        <button onClick={() => load(row, true)}>Edit in Sounds</button>}
                    </div>
                    <details className="library-more library-card-more">
                      <summary aria-label={"More options for " + row.name}>More options</summary>
                      <div className="saved-actions">
                        <PinButton item={{kind:"session",id:row.id}}/>
                        <LibraryLabels item={{kind:"session",id:row.id}}/>
                        <button onClick={()=>{try{storeRows([...sessions,{...row,id:crypto.randomUUID(),name:(row.name+" copy").slice(0,80)}]);}catch(e){setMessage((e as Error).message);}}}>Duplicate</button>
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
                          onClick={(event) => {
                            modalOpener.current = event.currentTarget;
                            setExporting(row);
                            setExportSeconds(
                              Math.min(
                                60,
                                sessionDuration(row),
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
                            if (confirmSourceDeletion("session", [row], "Practices keep their attached copies."))
                              storeRows(sessions.filter((s) => s.id !== row.id));
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </details>
                  </article>
                ))}
                <div className="catalog-footer"><button onClick={() => importInput.current?.click()}><Upload size={16} /> Import mix settings</button></div>
              </>
            ) : null}
          </>
        )}
        {(isStudio || isChakras) && <button className="wide" onClick={()=>navigate("explore",{exploreView:"nature"})}>Nature &amp; sound library</button>}
        {(isStudio || isChakras || (tab === "explore" && exploreView === "nature")) && <SoundTracks />}
        {isChakras && <details className="generated-track-panel">
          <summary>Generated sound layers <span>{layers.length} in Studio</span></summary>
          <p className="content-note">These use the same layers as Studio and can accompany chakra sounds and imported tracks. Each layer has its own controls.</p>
          {layers.map((value,i)=><ChannelEditor allowMix key={value.id} title={"Generated layer "+(i+1)} value={{...value,seconds:studioSeconds}} states={states} onChange={patch} onError={setMessage} remove={layers.length>1 ? ()=>{engine.stop(value.id);setLayers(rows=>rows.filter(c=>c.id!==value.id));} : undefined}/>)}
          <button disabled={layers.length>=8} onClick={()=>setLayers(rows=>[...rows,channel("bowl",432)])}>Add generated layer</button>
        </details>}
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
        </> : <h1 className="sr-only">{screenName}</h1>}
      </main>
      {showWorkspace && <>
      {!queueBusy && (isStudio || isChakras) && (
        <section
          ref={dockRef}
          className="player-dock"
          aria-label="Session player"
        >
          {isStudio && <details className="session-options">
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
                  {[...new Set([seconds, 60, 300, 600, 1800])]
                    .sort((a, b) => a - b)
                    .map((value) => (
                      <option key={value} value={value}>
                        {value % 60 === 0 ? value / 60 + " min" : time(value)}
                      </option>
                    ))}
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
          </details>}
          {isChakras&&["playing","paused"].includes(sequence.status)?<SequenceTransport/>:errorInvalid ? (
            <p role="alert">Enter a frequency within the instrument’s range.</p>
          ) : (
            <Transport
              channels={currentWithTime}
              stopChannels={isChakras ? chakraChannels : undefined}
              exclusive={isChakras}
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
      {!queueBusy && showPlaybackBar &&
        !isStudio &&
        !isChakras &&
        !isNatureView &&
        tab !== "manifest" &&
        playbackBar}
      <QueueTransport/>
      </>}
      <nav className="bottom-nav" aria-label="Main navigation" inert={settings || saving || !!exporting ? true : undefined}>
        {tabs.map(([id, label, Icon]) => (
          <button
            key={id}
            aria-current={
              tab === id || (id === "studio" && tab === "explore")
                ? "page"
                : undefined
            }
            onClick={() => {
              if (id === "manifest") navigate(id, { manifestSection: "practices" });
              else if (id === "library") navigate(id, { libraryView: "overview", librarySection: "all" });
              else if (id === "studio" && lastSoundTab === "explore") navigate("explore", { exploreView: "nature" });
              else navigate(id);
            }}
          >
            <span className="nav-icon" aria-hidden="true"><Icon size={21} /></span>
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {settings && (
        <div className="modal-backdrop">
          <section
            className="sheet settings-sheet"
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
            <p className="content-note">
              Keep your device volume comfortable. Stop if listening feels
              uncomfortable.
            </p>
            <fieldset className="appearance-controls">
              <legend>Display</legend>
              <label>
                Theme
                <select
                  aria-label="Theme"
                  value={appearance.theme}
                  onChange={(e) =>
                    changeAppearance({
                      ...appearance,
                      theme: e.target.value as Appearance["theme"],
                    })
                  }
                >
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="green">Green</option>
                  <option value="yellow">Yellow</option>
                  <option value="custom">Custom</option>
                </select>
              </label>

              {appearance.theme === "custom" && <label className="custom-colour">
                Custom colour
                <input
                  type="color"
                  value={appearance.customColor ?? defaultCustomColor}
                  onChange={event => changeAppearance({ ...appearance, customColor: event.target.value })}
                />
              </label>}
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
              <button
                onClick={() =>
                  changeAppearance({
                    textSize: 100,
                    density: "compact",
                    theme: "system",
                  })
                }
              >
                Reset display
              </button>
            </fieldset>
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
            <SettingsTools onPractice={id=>{setSettings(false);openManifest(id);}}/>
            <ConnectionPanel online={online} offlineReady={offlineReady} />
            {Capacitor.getPlatform() === "android" ? (
              <AndroidUpdates
                audioActive={
                  states.length > 0 ||
                  ["playing", "paused"].includes(practice.status)
                }
              />
            ) : (
              <button className="wide" onClick={update}>
                Check for updates
              </button>
            )}
            {!Capacitor.isNativePlatform() && (
              <a
                className="apk-download-link"
                href="/download.html"
                target="_blank"
                rel="noopener"
              >
                Download Android APK
              </a>
            )}
            {updateStatus && <p role="status">{updateStatus}</p>}

            <button
              className="wide"
              onClick={() => {
                manifestPlayer.stop();
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
            <p className="content-note">Core-aura · v{VERSION}</p>
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
            {exporting.channels.some(channel => channel.accompaniment?.audio) && (
              <p className="content-note">This WAV contains the generated layers. Export imported files separately from Library.</p>
            )}
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
                {Capacitor.isNativePlatform() ? "Share WAV" : "Download WAV"}
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
              <h2 id="save-title">{editingMix?.kind === (isChakras ? "chakras" : "studio") ? "Update saved mix" : "Save session"}</h2>
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
            {isChakras && <label className="check">
              <input type="checkbox" checked={saveAsSequence} onChange={event => setSaveAsSequence(event.target.checked)} />
              Save as a sequence
            </label>}
            <p>
              {current.length} layers · {time(isChakras && saveAsSequence
                ? current.length * sequence.seconds + Math.max(0, current.length - 1) * sequence.gap
                : seconds)}
            </p>
            <button
              className="primary wide"
              disabled={!saveName.trim() || !current.length}
              onClick={() => save()}
            >
              {editingMix?.kind === (isChakras ? "chakras" : "studio") ? "Save changes" : "Save to Library"}
            </button>
            {editingMix?.kind === (isChakras ? "chakras" : "studio") && (
              <button disabled={!saveName.trim() || !current.length} onClick={() => save(true)}>Save as copy</button>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
