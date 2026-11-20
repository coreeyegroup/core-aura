import { verifyPractice } from "../playlists/readiness";
import { confirmSourceDeletion } from "../playlists/store";
import {LibraryLabels,matchesItem} from "../workbench/LibraryLabels";
import {PinButton} from "../workbench/PinButton";
import {Presets} from "../workbench/Presets";
import {HistoryPanel} from "../workbench/HistoryPanel";
import { LibraryLayers } from "../components/LibraryLayers";
import type { Track } from "../tracks/storage";
import { BackgroundControls } from "./BackgroundControls";
import { Session } from "../model";
import { BookOpen, Download, Mic, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import {
  FormEvent,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { confirmDraftReplacement, isPreview, practiceActive } from "./flow";
import { affirmationLibrary } from "./library";
import { LibraryEditor, EditLibrary } from "./LibraryEditor";
import { manifestationStore as store } from "./store";
import {
  Line,
  nextOccurrence,
  parsePlan,
  Plan,
  position,
  Reminder,
} from "./model";
import { manifestPlayer } from "./player";
import { VoicePanel } from "./VoicePanel";
import { calendarFile, enableReminders, syncPhoneReminders } from "./reminders";
import { PreviewButton, RecordSentence, PersonalVoices, DefaultVoiceList, ImportRecording } from "./VoiceControls";
import { recordings, withoutRecordings, type PersonalRecording } from "./recordings";
import { exportVoice } from "./voice-files";
import { pushStatus, disablePushReminders } from "./push";
import { deliverFile } from "../files/deliver";
function download(text: string, name: string, type: string) {
  return deliverFile(new Blob([text], { type }), name);
}
function labelTime(seconds: number) {
  return (
    Math.floor(seconds / 60) +
    ":" +
    String(Math.floor(seconds % 60)).padStart(2, "0")
  );
}
function NumberField({
  value,
  min,
  max,
  onValue,
  integer = false,
}: {
  value: number;
  min: number;
  max: number;
  onValue: (n: number) => void;
  integer?: boolean;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <input
      type="number"
      inputMode={integer ? "numeric" : "decimal"}
      min={min}
      max={max}
      step={integer ? 1 : 0.1}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const n = e.target.valueAsNumber;
        if (
          Number.isFinite(n) &&
          n >= min &&
          n <= max &&
          (!integer || Number.isInteger(n))
        )
          onValue(n);
      }}
      onBlur={() => setText(String(value))}
    />
  );
}
export function Manifestation({
  queueActive = false,
  onLibrary,
  onOpenPractice,
  onPlaylists,
  onBackgrounds,
  sessions = [],
  tracks = [],
  initialView = "practice",
  onView,
}: {
  onLibrary: () => void;
  onOpenPractice: (id: string) => void;
  onPlaylists: () => void;
  onBackgrounds: () => void;
  sessions?: Session[];
  tracks?: Track[];
  queueActive?: boolean;
  initialView?: string;
  onView?: (view: "practices" | "practice" | "schedule") => void;
}) {
  const { data, error } = useSyncExternalStore(store.subscribe, store.snapshot),
    state = useSyncExternalStore(
      manifestPlayer.subscribe,
      manifestPlayer.snapshot,
    );
  const [view, setView] = useState(initialView),
    [custom, setCustom] = useState(() => {
      try {
        return (
          localStorage.getItem("core-aura.composer.v1")?.slice(0, 300) || ""
        );
      } catch {
        return "";
      }
    }),
    [message, setMessage] = useState("");
  useEffect(() => setView(initialView), [initialView]);
  const [practiceSearch, setPracticeSearch] = useState("");
  const [practiceSort, setPracticeSort] = useState("recent");
  const [recordLine, setRecordLine] = useState<Line>();
  const [selectedLines,setSelectedLines]=useState<string[]>([]);
  const dock = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = dock.current;
    if (!element) return;
    const observer = new ResizeObserver(() =>
      document.documentElement.style.setProperty(
        "--dock-height",
        element.getBoundingClientRect().height + "px",
      ),
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--dock-height");
    };
  }, [view, queueActive, state.status]);
  const active = practiceActive(state),
    p = active && state.plan ? state.plan : data.draft;
  function composer(value: string) {
    setCustom(value);
    try {
      localStorage.setItem("core-aura.composer.v1", value);
    } catch {
      setMessage(
        "This sentence is only available for this visit because device storage is unavailable.",
      );
    }
  }
  const change = (patch: Partial<Plan>) => {
    try {
      store.draft({ ...p, ...patch });
      setMessage("");
      return true;
    } catch (e) {
      setMessage((e as Error).message);
      return false;
    }
  };
  const current =
    state.plan && state.plan.lines.length
      ? position(state.plan, state.step)
      : null;
  function newPractice() {
    if (!confirmDraftReplacement(data.draft, data.plans)) return;
    try {
      store.fresh();
      setMessage("");
      setView("practice");
      onView?.("practice");
    } catch (error) { setMessage((error as Error).message); }
  }
  async function start() {
    try {
      if (active && state.status === "playing") manifestPlayer.pause();
      else if (active && state.status === "paused") manifestPlayer.resume();
      else {
        await verifyPractice(p);
        manifestPlayer.start(p);
      }
      setMessage("");
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return (
    <section className="manifest-workspace" data-view={view}>
      <div className="section-heading">
        <h1>Manifestation</h1>
      </div>
      <div className="segmented" aria-label="Manifestation workspace">
        <button aria-pressed={view === "practices"} onClick={() => {
          setView("practices");
          onView?.("practices");
        }}>Practices</button>
        <button
          aria-pressed={view === "practice"}
          onClick={() => {
            setView("practice");
            onView?.("practice");
          }}
        >
          Practice
        </button>
        <button
          aria-pressed={view === "schedule"}
          onClick={() => {
            setView("schedule");
            onView?.("schedule");
          }}
        >
          Schedule
        </button>
      </div>
      {view === "practices" ? <>
        <div className="home-actions">
          <button className="primary" disabled={active} onClick={newPractice}>New practice</button>
          <button onClick={onPlaylists}>Playlists</button>
        </div>
        <div className="fields">
          <label>Search saved practices
            <input type="search" aria-label="Search library" value={practiceSearch} onChange={event => setPracticeSearch(event.target.value)} />
          </label>
          <label>Sort saved practices
            <select value={practiceSort} onChange={event => setPracticeSort(event.target.value)}>
              <option value="recent">Recently saved</option><option value="name">Name A–Z</option>
            </select>
          </label>
        </div>
        <ManifestLibrary section="saved" search={practiceSearch} sort={practiceSort}
          onPractice={id => id && onOpenPractice(id)} focusOnEntry={false} />
      </> : view === "practice" ? (
        <>
          {(active ||
            (!isPreview(state) &&
              (state.status === "completed" || state.status === "error"))) && (
            <div className="manifest-now" aria-live="polite">
              <span className="eyebrow">
                {active
                  ? state.plan?.name
                  : state.status === "completed"
                    ? "Practice complete"
                    : "Your practice"}
              </span>
              <p className="manifest-sentence">
                {current && state.status !== "idle"
                  ? state.plan!.lines[current.line].text
                  : p.lines[0]?.text ||
                    "Select affirmations from the library or add your own sentence."}
              </p>
              {current && state.status !== "idle" && (
                <p className="content-note">
                  Sentence {current.line + 1}/{state.plan!.lines.length} ·
                  Repetition {current.repeat}/{state.plan!.repeats} ·{" "}
                  {labelTime(state.elapsed)}
                </p>
              )}
              {state.error && <p role="status">{state.error}</p>}
            </div>
          )}
          <div className="practice-grid">
            <div className="practice-editor">
              <fieldset className="manifest-fields">
                <legend>1. Practice details</legend>
                <label>Practice name
                  <input disabled={active} value={p.name} maxLength={80}
                    onChange={event => change({ name: event.target.value })} />
                </label>
                <Presets onOpen={()=>{setView("practice");onView?.("practice");}}/>
              </fieldset>
              <fieldset className="manifest-fields sentence-fields">
                <legend>2. Sentences ({p.lines.length}/50)</legend>
                <button onClick={onLibrary}>Choose affirmations</button>
                <details className="custom-sentence">
                  <summary>Write your own affirmation</summary>
                  <label>
                    Your own sentence
                    <textarea
                      aria-label="Your own sentence"
                      disabled={active}
                      rows={2}
                      value={custom}
                      maxLength={300}
                      placeholder="Write the words you want to repeat"
                      onChange={(e) => composer(e.target.value)}
                    />
                  </label>
                  <div className="admin-actions">
                    <button
                      disabled={
                        active || !custom.trim() || p.lines.length >= 50
                      }
                      onClick={() => {
                        const added = change({
                          lines: [
                            ...p.lines,
                            { id: crypto.randomUUID(), text: custom.trim() },
                          ],
                        });
                        if (added) composer("");
                      }}
                    >
                      Add sentence
                    </button>
                  </div>
                </details>
                <details className="bulk-sentences"><summary>Sentence selection tools</summary><div className="home-actions"><button disabled={active} onClick={()=>setSelectedLines(p.lines.map(l=>l.id))}>Select all sentences</button><button onClick={()=>setSelectedLines([])}>Clear sentence selection</button><button disabled={active||!selectedLines.length} onClick={()=>{if(confirm("Remove selected sentences?")){change({lines:p.lines.filter(l=>!selectedLines.includes(l.id))});setSelectedLines([]);}}}>Remove selected sentences</button></div></details>
                <div className="manifest-lines">
                  {p.lines.map((line, i) => (
                    <article className="manifest-line" key={line.id}>
                      <div className="sentence-queue-head">
                        <input aria-label={"Select sentence "+(i+1)} type="checkbox" disabled={active} checked={selectedLines.includes(line.id)} onChange={e=>setSelectedLines(e.target.checked?[...selectedLines,line.id]:selectedLines.filter(id=>id!==line.id))}/>
                        <span className="queue-index">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <div className="queue-copy">
                          <p>{line.text}</p>
                          <small>
                            {line.audioAffirmation ? "Audio affirmation" : line.recordingId
                              ? "Personal voice"
                              : "Selected voice"}
                          </small>
                        </div>
                        <PreviewButton
                          line={line}
                          id={line.id}
                          recorded={p.useRecordings}
                        />
                      </div>
                      <details className="sentence-editor">
                        <summary
                          aria-label={"Edit sentence " + (i + 1)}
                          title={"Edit sentence " + (i + 1)}
                        >
                          <Pencil size={16} />
                        </summary>
                        <label>
                          Sentence {i + 1}
                          <textarea
                            rows={2}
                            aria-label={"Sentence " + (i + 1)}
                            disabled={active || !!line.audioAffirmation}
                            value={line.text}
                            maxLength={300}
                            onChange={(e) =>
                              change({
                                lines: p.lines.map((l, n) =>
                                  n === i
                                    ? { id: l.id, text: e.target.value }
                                    : l,
                                ),
                              })
                            }
                          />
                        </label>
                        <div className="line-actions">
                          {!line.audioAffirmation && <button
                            disabled={active || !line.text.trim()}
                            onClick={() => setRecordLine(line)}
                          >
                            {line.recordingId ? "Record again" : "Record voice"}
                          </button>}
                          {line.recordingId && !line.audioAffirmation && (
                            <span className="content-note">
                              Personal voice saved
                            </span>
                          )}
                          <button
                            disabled={active || i === 0}
                            aria-label={"Move sentence " + (i + 1) + " up"}
                            onClick={() => {
                              const lines = [...p.lines];
                              [lines[i - 1], lines[i]] = [
                                lines[i],
                                lines[i - 1],
                              ];
                              change({ lines });
                            }}
                          >
                            ↑
                          </button>
                          <button
                            disabled={active || i === p.lines.length - 1}
                            aria-label={"Move sentence " + (i + 1) + " down"}
                            onClick={() => {
                              const lines = [...p.lines];
                              [lines[i + 1], lines[i]] = [
                                lines[i],
                                lines[i + 1],
                              ];
                              change({ lines });
                            }}
                          >
                            ↓
                          </button>
                          <button
                            disabled={active}
                            aria-label={"Remove sentence " + (i + 1)}
                            onClick={() =>
                              change({
                                lines: p.lines.filter((_, n) => n !== i),
                              })
                            }
                          >
                            Remove
                          </button>
                          <button disabled={active||p.lines.length>=50} aria-label={"Duplicate sentence "+(i+1)} onClick={()=>change({lines:[...p.lines.slice(0,i+1),{...line,id:crypto.randomUUID()},...p.lines.slice(i+1)]})}>Duplicate sentence</button>
                        </div>
                      </details>
                    </article>
                  ))}
                </div>
                {!p.lines.length && (
                  <div className="queue-empty">
                    <BookOpen size={21} />
                    <p>
                      Choose affirmations from the library or write your own.
                    </p>
                  </div>
                )}
                {!p.lines.length && (
                  <button
                    onClick={() => {
                      const sample = {
                        ...p,
                        name: p.name.trim() || "Sample practice",
                        lines: [
                          {
                            id: crypto.randomUUID(),
                            text: "I take one clear step toward my goals today.",
                          },
                        ],
                        mode: "speech" as const,
                        volume: p.volume || 0.7,
                        repeats: 1,
                        background: null,
                        backgroundMix: null,
                      };
                      change(sample);
                      manifestPlayer.start(sample);
                    }}
                  >
                    Play sample affirmation
                  </button>
                )}
              </fieldset>
            </div>
            <div className="practice-settings">
              <fieldset
                disabled={active}
                className="manifest-fields repeat-fields"
              >
                <legend>3. Playback options</legend>
                <div className="practice-mode">
                  <label>
                    Practice mode
                    <select
                      aria-label="Practice mode"
                      value={p.mode}
                      onChange={(e) =>
                        change({ mode: e.target.value as Plan["mode"] })
                      }
                    >
                      <option value="speech">Spoken voice</option>
                      <option value="read">Silent reading</option>
                    </select>
                  </label>
                </div>
                <div className="fields">
                  <label>
                    Repeat order
                    <select
                      aria-label="Repeat order"
                      value={p.order}
                      onChange={(e) =>
                        change({ order: e.target.value as Plan["order"] })
                      }
                    >
                      <option value="sequence">Whole sequence</option>
                      <option value="each">Each sentence</option>
                    </select>
                  </label>
                  <label>
                    Repetitions
                    <NumberField
                      integer
                      min={1}
                      max={108}
                      value={p.repeats}
                      onValue={(repeats) => change({ repeats })}
                    />
                  </label>
                </div>
                <p className="content-note">
                  {p.order === "sequence"
                    ? "Repeat all selected sentences in order, then begin the next round."
                    : "Repeat each sentence the chosen number of times before moving to the next."}
                </p>
                <div className="fields">
                  <label>
                    Maximum session
                    <select
                      aria-label="Maximum session"
                      value={p.seconds}
                      onChange={(e) =>
                        change({ seconds: Number(e.target.value) })
                      }
                    >
                      {[...new Set([p.seconds, 60, 300, 600, 900, 1800, 3600])]
                        .sort((a, b) => a - b)
                        .map((n) => (
                          <option value={n} key={n}>
                            {n / 60} min
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
                <div className="fields">
                  <label>
                    Gap between sentences (sec)
                    <NumberField
                      min={0}
                      max={30}
                      value={p.gap}
                      onValue={(gap) => change({ gap })}
                    />
                  </label>
                  {p.mode === "read" && (
                    <label>
                      Reading time (sec)
                      <NumberField
                        min={2}
                        max={30}
                        value={p.readSeconds}
                        onValue={(readSeconds) => change({ readSeconds })}
                      />
                    </label>
                  )}
                </div>

              </fieldset>
              <VoicePanel />
              <LibraryLayers prefix="Manifest" tracks={tracks} value={p.accompaniment} disabled={active}
                onChange={accompaniment => change({ accompaniment })} />
              <BackgroundControls plan={p} sessions={sessions} active={active} onChange={patch=>{
                try { if(active) manifestPlayer.updateBackground(patch); else change(patch); }
                catch(error){setMessage((error as Error).message);}
              }}/>
              <button className="text-button" onClick={onBackgrounds}>Manage background library</button>
              <details className="workbench-panel practice-summary">
                <summary>Practice summary</summary>
          <div
            className="workspace-summary"
            aria-label="Practice configuration summary"
          >
            <div>
              <small>Sentences</small>
              <strong>{p.lines.length}/50</strong>
            </div>
            <div>
              <small>Repetitions</small>
              <strong>{p.repeats} rounds</strong>
            </div>
            <div>
              <small>Session limit</small>
              <strong>{p.seconds / 60} min</strong>
            </div>
            <div>
              <small>Voice level</small>
              <strong>{Math.round(p.volume * 100)}%</strong>
            </div>
          </div>
              </details>
            </div>
          </div>
              <div className="admin-actions practice-actions">
                <button
                  className="primary"
                  disabled={active || !p.lines.length}
                  onClick={() => {
                    try {
                      store.save();
                      setMessage("Practice saved.");
                    } catch (e) {
                      setMessage((e as Error).message);
                    }
                  }}
                >
                  Save practice
                </button>
                <button disabled={active||!p.lines.length} onClick={()=>{try{store.copy();setMessage("Practice copied and saved.");}catch(e){setMessage((e as Error).message);}}}>Save as copy</button>
                <button
                  disabled={active}
                  onClick={newPractice}
                >
                  New practice
                </button>
                {data.plans.some((plan) => plan.id === p.id) && (
                  <button
                    disabled={active}
                    onClick={() => {
                      setView("schedule");
                      onView?.("schedule");
                    }}
                  >
                    Schedule practice
                  </button>
                )}
              </div>
        </>
      ) : (
        <Schedules
          onCreate={() => {
            setView("practice");
            onView?.("practice");
          }}
        />
      )}
      {recordLine && (
        <RecordSentence
          line={recordLine}
          onClose={() => setRecordLine(undefined)}
          onSave={(clip) => {
            change({
              useRecordings: true,
              lines: p.lines.map((l) =>
                l.id === recordLine.id
                  ? { ...l, recordingId: clip.id, recordedText: l.text }
                  : l,
              ),
            });
            setRecordLine(undefined);
          }}
        />
      )}
      {!queueActive&&(view !== "practices" || active)&&<section
        ref={dock}
        className="player-dock manifest-player-dock"
        aria-label="Manifestation player"
      >
        <p className="dock-caption">
          {active ? state.plan?.name : p.name} ·{" "}
          {active ? labelTime(state.elapsed) : p.lines.length + " sentences"}
        </p>
        <div className="transport">
          <button
            className="primary"
            disabled={!p.lines.length && !active}
            onClick={start}
          >
            {active && state.status === "playing"
              ? "Pause"
              : active && state.status === "paused"
                ? "Resume"
                : "Play practice"}
          </button>
          <button disabled={!active} onClick={() => manifestPlayer.stop()}>
            Stop practice
          </button>
        </div>
        {state.status === "paused" && (
          <p className="content-note">
            Resume repeats the current sentence from its beginning.
          </p>
        )}
      </section>}
      {(message || error) && (
        <p role="status" className="notice">
          {message || error}
        </p>
      )}
    </section>
  );
}
export function ManifestLibrary({
  onPractice,
  search = "",
  sort = "recent",
  section = "all",
  focusOnEntry = true,
}: {
  onPractice?: (id?: string) => void;
  section?: "all" | "saved" | "recordings";
  focusOnEntry?: boolean;
  search?:string;
  sort?:string;
}) {
  const { data, error } = useSyncExternalStore(store.subscribe, store.snapshot),
    state = useSyncExternalStore(
      manifestPlayer.subscribe,
      manifestPlayer.snapshot,
    );
  const catalog = useSyncExternalStore(
    affirmationLibrary.subscribe,
    affirmationLibrary.snapshot,
  );
  const [editing, setEditing] = useState<EditLibrary>();
  const libraryInput = useRef<HTMLInputElement>(null);
  const audioInput = useRef<HTMLInputElement>(null);
  const [audioFile, setAudioFile] = useState<File>();
  const [recordAudio, setRecordAudio] = useState(false);
  const [audioClips, setAudioClips] = useState<PersonalRecording[]>([]);
  const [audioError, setAudioError] = useState("");
  useEffect(() => {
    if (section !== "all") return;
    let alive = true;
    const read = () => void recordings("affirmation").then(clips => {
      if (alive) {
        setAudioClips(clips);
        setAudioError("");
      }
    }).catch(error => { if (alive) setAudioError(error.message); });
    read();
    addEventListener("core-aura-recordings-changed", read);
    return () => {
      alive = false;
      removeEventListener("core-aura-recordings-changed", read);
    };
  }, [section]);
  const savedSection = useRef<HTMLElement>(null);
  const recordingsSection = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!focusOnEntry) return;
    if (section === "saved") {
      savedSection.current?.focus({ preventScroll: true });
    } else if (section === "recordings") {
      recordingsSection.current?.focus({ preventScroll: true });
    }
  }, [section, focusOnEntry]);
  const [query, setQuery] = useState(""),
    [selectedPlans,setSelectedPlans]=useState<string[]>([]),
    [message, setMessage] = useState("");
  const visiblePlans = data.plans.filter(plan => matchesItem(plan.name, "practice", plan.id, search));
  if (sort === "name") visiblePlans.sort((a, b) => a.name.localeCompare(b.name));
  else visiblePlans.reverse();
  const chosenPlans = visiblePlans.filter(plan => selectedPlans.includes(plan.id));
  const needle = query.trim().toLowerCase();
  const matchingAffirmations = catalog.data.affirmations.filter(
    affirmation => affirmation.text.toLowerCase().includes(needle),
  );
  const matchingAudio = audioClips.filter(clip => (clip.title ?? clip.text).toLowerCase().includes(needle));
  const selectedCount = data.draft.lines.length;
  useEffect(() => setSelectedPlans([]), [search]);
  const input = useRef<HTMLInputElement>(null);
  const active = practiceActive(state);
  function selectedLine(line: Line) {
    return data.draft.lines.find(candidate => line.audioAffirmation
      ? candidate.recordingId === line.recordingId
      : !candidate.audioAffirmation && candidate.text === line.text);
  }
  function select(line: Line) {
    try {
      const selected = selectedLine(line);
      if (!selected && data.draft.lines.length >= 50)
        throw Error("Choose up to 50 sentences.");
      store.draft({
        ...data.draft,
        lines: selected
          ? data.draft.lines.filter(candidate => candidate.id !== selected.id)
          : [...data.draft.lines, {
            ...line,
            id: data.draft.lines.some(candidate => candidate.id === line.id) ? crypto.randomUUID() : line.id,
          }],
      });
      setMessage("");
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  async function importPlan(file?: File) {
    if (!file) return;
    try {
      if (file.size > 100000)
        throw Error("Choose a practice file under 100 KB.");
      const value = JSON.parse(await file.text());
      if(value.kind!=="core-aura-practice-collection")parsePlan(value);
      if (!confirmDraftReplacement(data.draft, data.plans)) return;
      manifestPlayer.stop();
      store.import(value);
      setMessage("Practice imported.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      if (input.current) input.current.value = "";
    }
  }
  return (
    <section className="manifest-workspace" aria-label="Manifestation library">
      {section === "all" && <>
        <div className="home-actions">
          <button className="primary" disabled={active} onClick={() => setEditing({ kind: "affirmation-add" })}><Plus size={16} aria-hidden="true" /> Add affirmation</button>
          <button disabled={active} onClick={() => setRecordAudio(true)}><Mic size={16} aria-hidden="true" /> Record audio affirmation</button>
        </div>
        <label>Search affirmations<input type="search" value={query} onChange={e => setQuery(e.target.value)} /></label>
        <input ref={libraryInput} type="file" accept="application/json,.json" className="sr-only"
          aria-label="Import affirmation JSON" onChange={e => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            if (file.size > 2 * 1024 * 1024) { setMessage("Choose an affirmations JSON file under 2 MB."); return; }
            void file.text().then(text => {
              const count = affirmationLibrary.importTexts(JSON.parse(text));
              setMessage(count === 1 ? "1 affirmation imported." : count + " affirmations imported.");
            }).catch(error => setMessage(error.message));
          }} />
        <input ref={audioInput} type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac" className="sr-only"
          aria-label="Import affirmation audio from device" onChange={event => {
            setAudioFile(event.target.files?.[0]);
            event.target.value = "";
          }} />
        {audioFile && <ImportRecording file={audioFile} audioAffirmation onCancel={() => setAudioFile(undefined)}
          onSave={() => { setAudioFile(undefined); setMessage("Audio affirmation imported."); }} />}
        {recordAudio && <RecordSentence line={{ id: "new-audio-affirmation", text: "" }} audioAffirmation
          saveLabel="Save audio affirmation" closeLabel="Back to affirmations" onClose={() => setRecordAudio(false)}
          onSave={() => { setRecordAudio(false); setMessage("Audio affirmation saved."); }} />}
        {audioError && <p role="status">{audioError}</p>}
        {editing && <LibraryEditor edit={editing} onClose={() => setEditing(undefined)} />}
        {catalog.error && <p role="status">{catalog.error}</p>}
        {onPractice && <button disabled={!selectedCount} onClick={() => onPractice()}>Use selection ({selectedCount})</button>}
        <div className="affirmation-list">
          {!matchingAffirmations.length && !matchingAudio.length && <p role="status">{needle ? "No matching affirmations." : "No affirmations yet."}</p>}
          {matchingAudio.map(clip => {
            const name = clip.title ?? clip.text;
            const line: Line = { id: clip.id, text: name, recordedText: name, recordingId: clip.id, audioAffirmation: true };
            const label = <span className="affirmation-audio-title">{name}<small>Audio · {Math.max(1, Math.round(clip.seconds))} sec</small></span>;
            return <article className="affirmation-row" key={clip.id}>
              {onPractice ? <label className="affirmation-choice"><input type="checkbox" disabled={active}
                checked={!!selectedLine(line)} onChange={() => select(line)} />{label}</label> : label}
              <div className="library-row-actions">
                <PreviewButton line={line} id={clip.id} label={"Test play: " + name} catalog iconOnly />
                <button className="icon-button" title="Edit affirmation" disabled={active} aria-label={"Edit affirmation: " + name}
                  onClick={() => setEditing({ kind: "audio-edit", clip })}><Pencil size={16} aria-hidden="true" /></button>
                <button className="icon-button" title="Export audio" aria-label={"Export audio: " + name}
                  onClick={() => void exportVoice(clip).then(blob => deliverFile(blob, `core-aura-affirmation-${clip.id}.wav`))
                    .then(setMessage).catch(error => setMessage(error.message))}><Download size={16} aria-hidden="true" /></button>
                <button className="icon-button" title="Delete affirmation" disabled={active} aria-label={"Delete affirmation: " + name}
                  onClick={() => setEditing({ kind: "audio-delete", clip })}><Trash2 size={16} aria-hidden="true" /></button>
              </div>
            </article>;
          })}
          {matchingAffirmations.map(item => (
            <article className="affirmation-row" key={item.id}>
              {onPractice ? <label className="affirmation-choice"><input type="checkbox" disabled={active}
                checked={!!selectedLine(item)}
                onChange={() => select({ id: item.id, text: item.text })} /><span>{item.text}</span></label> : <p>{item.text}</p>}
              <div className="library-row-actions">
                <PreviewButton line={item} id={item.id} label={"Test play: " + item.text} catalog iconOnly />
                <button className="icon-button" title="Edit affirmation" disabled={active} aria-label={"Edit affirmation: " + item.text}
                  onClick={() => setEditing({ kind: "affirmation-edit", item })}><Pencil size={16} aria-hidden="true" /></button>
                <button className="icon-button" title="Delete affirmation" disabled={active} aria-label={"Delete affirmation: " + item.text}
                  onClick={() => setEditing({ kind: "affirmation-delete", item })}><Trash2 size={16} aria-hidden="true" /></button>
              </div>
            </article>
          ))}
        </div>
        <div className="catalog-footer">
          <button disabled={active} onClick={() => audioInput.current?.click()}><Upload size={16} aria-hidden="true" /> Import audio affirmation</button>
          <button disabled={active} onClick={() => libraryInput.current?.click()}><Upload size={16} aria-hidden="true" /> Import affirmations</button>
          <button disabled={!!catalog.error} onClick={() => void download(
            JSON.stringify({ schemaVersion: 1, affirmations: catalog.data.affirmations.map(item => item.text) }, null, 2),
            "core-aura-affirmations.json", "application/json",
          ).then(setMessage).catch(error => setMessage(error.message))}><Download size={16} aria-hidden="true" /> Export affirmations</button>
        </div>
      </>}
      {section === "recordings" && <div ref={recordingsSection} tabIndex={-1} className="recordings-section">
        <DefaultVoiceList />
        <PersonalVoices initiallyOpen allowAttach={Boolean(onPractice)} />
      </div>}
      {section === "saved" && <section
        className="saved-practices-section"
        ref={savedSection}
        tabIndex={-1}
        aria-label="Saved practices"
      >
        <div className="section-heading">
          <h2>Saved practices</h2>
          {onPractice && !focusOnEntry && <button disabled={active} onClick={() => onPractice()}>Add practice</button>}
        </div>
        <input
          className="sr-only"
          ref={input}
          type="file"
          accept="application/json,.json"
          aria-label="Import manifestation practice"
          onChange={(e) => void importPlan(e.target.files?.[0])}
        />
        <div className="home-actions">
          <button disabled={!visiblePlans.length} onClick={() => setSelectedPlans(visiblePlans.map(plan => plan.id))}>Select shown practices</button>
          <button disabled={!chosenPlans.length} onClick={() => setSelectedPlans([])}>Clear practice selection</button>
          <button disabled={!chosenPlans.length} onClick={() => {
            const text = JSON.stringify({kind: "core-aura-practice-collection", schemaVersion: 1, practices: chosenPlans.map(withoutRecordings)});
            if (text.length > 100000) { setMessage("Select fewer practices or use a full backup ZIP."); return; }
            void download(text, "core-aura-practices.json", "application/json").then(setMessage).catch(error => setMessage(error.message));
          }}>Export selected practices</button>
          <button disabled={!chosenPlans.length} onClick={() => {
            if (!confirmSourceDeletion("practice", chosenPlans, "Schedules for these practices will also be removed.")) return;
            try {
              if (chosenPlans.some(plan => state.plan?.id === plan.id)) manifestPlayer.stop();
              store.removeMany(chosenPlans.map(plan => plan.id));
              setSelectedPlans([]);
              void syncPhoneReminders().then(setMessage).catch(error => setMessage(error.message));
            } catch (error) { setMessage((error as Error).message); }
          }}>Delete selected practices</button>
        </div>
        {chosenPlans.length > 0 && <p className="content-note">{chosenPlans.length} selected</p>}
        {data.plans.length > 0 && !visiblePlans.length && <p role="status">No practices match this search.</p>}
        {!data.plans.length && (
          <p className="content-note">
            {onPractice ? "Save your selected sentences as a practice to schedule them." : "Import a practice backup to get started."}
          </p>
        )}
        {visiblePlans.map((plan) => (
          <article className="saved-card" key={plan.id}>
            <label className="check"><input aria-label={"Select practice "+plan.name} type="checkbox" checked={selectedPlans.includes(plan.id)} onChange={e=>setSelectedPlans(e.target.checked?[...selectedPlans,plan.id]:selectedPlans.filter(id=>id!==plan.id))}/> Select</label>
            <div>
              <h3>{plan.name}</h3>
              <p>
                {plan.lines.length} sentences · {plan.repeats} repetitions ·{" "}
                {plan.mode === "speech" ? "spoken" : "reading"}
              </p>
            </div>
            {onPractice && <button
              className="primary"
              onClick={() => {
                try {
                  onPractice(plan.id);
                } catch (e) {
                  setMessage((e as Error).message);
                }
              }}
            >
              Edit practice
            </button>}
            <div className="saved-actions">
              <button
                aria-label={`${state.plan?.id === plan.id && state.status === "playing" ? "Pause" : state.plan?.id === plan.id && state.status === "paused" ? "Resume" : "Play"} practice: ${plan.name}`}
                onClick={async () => {
                  try {
                    if (
                      state.plan?.id === plan.id &&
                      state.status === "playing"
                    )
                      manifestPlayer.pause();
                    else if (
                      state.plan?.id === plan.id &&
                      state.status === "paused"
                    )
                      manifestPlayer.resume();
                    else {
                      await verifyPractice(plan);
                      manifestPlayer.start(plan);
                    }
                  } catch (e) {
                    setMessage((e as Error).message);
                  }
                }}
              >
                {state.plan?.id === plan.id && state.status === "playing"
                  ? "Pause"
                  : state.plan?.id === plan.id && state.status === "paused"
                    ? "Resume"
                    : "Play"}
              </button>
              <button
                onClick={() => {
                  if (!confirmSourceDeletion("practice", [plan], "Schedules for this practice will also be removed.")) return;
                  try {
                    if (state.plan?.id === plan.id) manifestPlayer.stop();
                    store.remove(plan.id);
                    void syncPhoneReminders().catch(() =>
                      setMessage(
                        "Practice removed. Phone reminder cancellation needs another attempt.",
                      ),
                    );
                  } catch (e) {
                    setMessage((e as Error).message);
                  }
                }}
              >
                Delete practice
              </button>
            </div>
            <details className="practice-actions">
              <summary>More options</summary>
              <div className="saved-actions">
                <PinButton item={{kind:"practice",id:plan.id}}/><LibraryLabels item={{kind:"practice",id:plan.id}}/>
                <button onClick={()=>{try{if(!confirmDraftReplacement(data.draft,data.plans))return;store.copy(plan.id);setMessage("Practice duplicated.");}catch(e){setMessage((e as Error).message);}}}>Duplicate practice</button>
                <button onClick={()=>{const name=prompt("Practice name",plan.name);if(!name?.trim())return;try{store.rename(plan.id,name);setMessage("Practice renamed.");}catch(e){setMessage((e as Error).message);}}}>Rename practice</button>
                <button
                  onClick={() =>
                    download(
                      JSON.stringify(withoutRecordings(plan), null, 2),
                      "core-aura-practice.json",
                      "application/json",
                    )
                      .then(setMessage)
                      .catch((e) => setMessage(e.message))
                  }
                >
                  Export practice
                </button>
              </div>
            </details>
          </article>
        ))}
        <div className="catalog-footer">          <button onClick={() => input.current?.click()}>
            Import practice
          </button>
</div>
      </section>}
      {(message || error) && (
        <p role="status" className="notice">
          {message || error}
        </p>
      )}
    </section>
  );
}
function Schedules({ onCreate }: { onCreate: () => void }) {
  const pushMessage = useSyncExternalStore(
    pushStatus.subscribe,
    pushStatus.snapshot,
  );
  const { data } = useSyncExternalStore(store.subscribe, store.snapshot);
  const [planId, setPlanId] = useState(
      data.plans.find((plan) => plan.id === data.draft.id)?.id ||
        data.plans[0]?.id ||
        "",
    ),
    [time, setTime] = useState("07:00"),
    [days, setDays] = useState([0, 1, 2, 3, 4, 5, 6]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const [autoStart, setAutoStart] = useState(false);
  const [editingId,setEditingId]=useState<string|null>(null);
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  async function update(rows: Reminder[]) {
    setBusy(true);
    try {
      store.reminders(rows);
      setMessage(await syncPhoneReminders());
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function add(event: FormEvent) {
    event.preventDefault();
    const slot = editingId ? data.reminders.find(r=>r.id===editingId)?.slot : Array.from({ length: 8 }, (_, i) => i).find(
      (n) => !data.reminders.some((r) => r.slot === n),
    );
    if (slot === undefined) {
      setMessage("Up to eight schedules are supported.");
      return;
    }
    void update([
      ...data.reminders.filter(r=>r.id!==editingId),
      {
        id: editingId??crypto.randomUUID(),
        slot,
        planId,
        time,
        days,
        enabled: true,
        autoStart,
      },
    ]);
    setEditingId(null);
  }
  return (
    <section
      className="manifest-workspace"
      aria-label="Manifestation schedules"
    >
      <h2>Schedule your practice</h2>
      {!data.plans.length && (
        <div className="notice">
          <span>Save a practice before adding a reminder.</span>
          <button onClick={onCreate}>Create a practice</button>
        </div>
      )}
      {!Capacitor.isNativePlatform() && (
        <>
          <p role="status" className="content-note">
            {pushMessage}
          </p>
          <button
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void disablePushReminders()
                .then(setMessage)
                .finally(() => setBusy(false));
            }}
          >
            Disable closed-app reminders
          </button>
        </>
      )}
      <p className="content-note">
        Times follow this device’s timezone:{" "}
        {Intl.DateTimeFormat().resolvedOptions().timeZone}. Choose a reminder or
        opt into automatic start while the app is visible and idle.
      </p>
      <p className="content-note">
        Enable closed-app reminders to receive web/PWA notifications while away.
        Internet and browser permission are required. On iPhone, use the
        installed Home Screen app. Native builds use device notifications.
        Delivery timing depends on device settings.
      </p>
      <button
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void enableReminders()
            .then(setMessage)
            .catch((e) =>
              setMessage(
                e instanceof Error
                  ? e.message
                  : "Notifications could not be enabled. Check device permissions.",
              ),
            )
            .finally(() => setBusy(false));
        }}
      >
        Enable reminders
      </button>
      {data.plans.length > 0 && (
        <form onSubmit={add} className="manifest-fields">
          <div className="fields">
            <label>
              Saved practice
              <select
                required
                aria-label="Saved practice"
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
              >
                <option value="" disabled>
                  Choose a practice
                </option>
                {data.plans.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Reminder time
              <input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </label>
          </div>
          <div className="day-choices" aria-label="Days of week">
            {dayNames.map((d, i) => (
              <label key={d}>
                <input
                  type="checkbox"
                  checked={days.includes(i)}
                  onChange={(e) =>
                    setDays(
                      e.target.checked
                        ? [...days, i].sort()
                        : days.filter((day) => day !== i),
                    )
                  }
                />
                {d}
              </label>
            ))}
          </div>
          <label className="affirmation-choice">
            <input
              type="checkbox"
              checked={autoStart}
              onChange={(e) => setAutoStart(e.target.checked)}
            />
            <span>Auto-start while this app is visible and idle</span>
          </label>
          <p className="content-note">
            Automatic start does not interrupt other audio or unsaved edits.
            Closed/locked apps and missed times use a reminder; browser speech
            may still require a tap.
          </p>
          <button
            className="primary"
            disabled={busy || !days.length || !planId}
          >
            {editingId?"Save schedule":"Add schedule"}
          </button>
          {editingId&&<button type="button" onClick={()=>setEditingId(null)}>Cancel editing</button>}
        </form>
      )}
      {data.reminders.map((r) => {
        const name =
            data.plans.find((p) => p.id === r.planId)?.name || "Practice",
          next = nextOccurrence(r, new Date());
        return (
          <article className="saved-card" key={r.id}>
            <div>
              <h3>
                {name} · {r.time}
              </h3>
              <p>
                {r.days.map((d) => dayNames[d]).join(", ")}
                {next ? " · Next " + next.toLocaleString() : " · Disabled"}
              </p>
            </div>
            <button
              disabled={busy}
              aria-pressed={r.enabled}
              onClick={() =>
                void update(
                  data.reminders.map((row) =>
                    row.id === r.id ? { ...row, enabled: !row.enabled } : row,
                  ),
                )
              }
            >
              {r.enabled ? "Disable" : "Enable"}
            </button>
            <div className="saved-actions">
              <button disabled={busy} onClick={()=>{setEditingId(r.id);setPlanId(r.planId);setTime(r.time);setDays([...r.days]);setAutoStart(!!r.autoStart);document.querySelector('[aria-label="Saved practice"]')?.scrollIntoView({block:"center"});}}>Edit schedule</button>
              <button disabled={busy||data.reminders.length>=8} onClick={()=>{const slot=Array.from({length:8},(_,i)=>i).find(i=>!data.reminders.some(r=>r.slot===i));if(slot!==undefined)void update([...data.reminders,{...r,id:crypto.randomUUID(),slot,enabled:false}]);}}>Duplicate schedule</button>
              <button disabled={busy||data.reminders.length>=8} onClick={()=>{const slot=Array.from({length:8},(_,i)=>i).find(i=>!data.reminders.some(r=>r.slot===i)),date=new Date(Date.now()+600000);if(slot!==undefined)void update([...data.reminders,{id:crypto.randomUUID(),slot,planId:r.planId,time:date.toTimeString().slice(0,5),days:[date.getDay()],enabled:true,oneOff:date.toISOString()}]);}}>Remind in 10 min</button>
              <button disabled={busy||!next||Capacitor.isNativePlatform()||!!r.oneOff} title={Capacitor.isNativePlatform()?"Skip-next exceptions are supported by in-app/web push; disable the native schedule instead.":undefined} onClick={()=>{if(!next)return;const date=next.getFullYear()+"-"+String(next.getMonth()+1).padStart(2,"0")+"-"+String(next.getDate()).padStart(2,"0");void update(data.reminders.map(v=>v.id===r.id?{...v,skipDates:[...(v.skipDates??[]).filter(d=>d>=date),date].slice(-30)}:v));}}>Skip next</button>
              <button
                onClick={() =>
                  download(
                    calendarFile(r, name),
                    "core-aura-reminder.ics",
                    "text/calendar",
                  )
                    .then(setMessage)
                    .catch((e) => setMessage(e.message))
                }
              >
                Export calendar reminder
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  void update(data.reminders.filter((row) => row.id !== r.id))
                }
              >
                Delete schedule
              </button>
            </div>
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
