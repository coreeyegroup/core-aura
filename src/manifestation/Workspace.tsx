import { dayNames, RecurrenceFields } from "../scheduling/RecurrenceFields";
import { chakraScheduleTarget, scheduleClock, scheduleDate, scheduleFrequency, scheduleTimePattern, scheduleTimes, type Frequency } from "../scheduling/recurrence";
import { playbackReadiness, usePlaybackInventory, verifyPractice } from "../playlists/readiness";
import { resolveItems } from "../playlists/model";
import { confirmSourceDeletion, playlistStore } from "../playlists/store";
import {LibraryLabels,matchesItem} from "../workbench/LibraryLabels";
import {PinButton} from "../workbench/PinButton";
import {Presets} from "../workbench/Presets";
import {HistoryPanel} from "../workbench/HistoryPanel";
import type { Track } from "../tracks/storage";
import { PracticeLayers } from "./PracticeLayers";
import { AffirmationPicker } from "./AffirmationPicker";
import { Session } from "../model";
import { Download, Ellipsis, Mic, Pause, Pencil, Play, Plus, Square, Trash2, Upload } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import {
  FormEvent,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { confirmDraftReplacement, draftChanged, isPreview, practiceActive } from "./flow";
import { affirmationLibrary } from "./library";
import { LibraryEditor, EditLibrary } from "./LibraryEditor";
import { manifestationStore as store } from "./store";
import {
  Line,
  hasPracticeContent,
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
  onAudioLibrary,
  onListen,
  onOpenPractice,
  onPlaylists,
  sessions = [],
  tracks = [],
  initialView = "practice",
  onView,
}: {
  onLibrary: () => void;
  onAudioLibrary: () => void;
  onListen: (playlistId: string) => void;
  onOpenPractice: (id: string) => void;
  onPlaylists: () => void;
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
  const [selectSentences, setSelectSentences] = useState(false);
  const [writeAffirmation, setWriteAffirmation] = useState(false);
  const [sentencesOpen, setSentencesOpen] = useState(true);
  const [choosingAffirmations, setChoosingAffirmations] = useState(false);
  const [playlistTarget, setPlaylistTarget] = useState("");
  const [playlistName, setPlaylistName] = useState("");
  const [addedPlaylist, setAddedPlaylist] = useState<{ id: string; name: string }>();
  const { data: playlists, error: playlistError } = useSyncExternalStore(playlistStore.subscribe, playlistStore.snapshot);
  const { inventory, online } = usePlaybackInventory();
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
  useEffect(() => {
    setSelectSentences(false);
    setSelectedLines([]);
    setChoosingAffirmations(false);
    setWriteAffirmation(false);
    setAddedPlaylist(undefined);
    setPlaylistTarget("");
    setPlaylistName("");
  }, [p.id]);
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
  function addSentence() {
    const text = custom.trim();
    if (active || !text || p.lines.length >= 50) return;
    const { affirmations } = affirmationLibrary.snapshot().data;
    const existing = affirmations.find(item => item.text.trim().toLowerCase() === text.toLowerCase());
    try {
      if (!existing) affirmationLibrary.saveText(crypto.randomUUID(), text);
    } catch (error) {
      setMessage((error as Error).message);
      return;
    }
    if (change({ lines: [...p.lines, { id: crypto.randomUUID(), text }] })) {
      composer("");
      setMessage("Affirmation added to the practice and library.");
    } else {
      setMessage("The affirmation is in your library. The practice draft could not be updated. Check device storage and try again.");
    }
  }
  const canPlay = hasPracticeContent(p);
  let readiness: ReturnType<typeof playbackReadiness> | undefined;
  if (!active && canPlay && p.name.trim()) {
    try {
      readiness = playbackReadiness(resolveItems([{ kind: "practice", id: p.id }], [p], sessions, tracks), inventory);
    } catch (error) {
      readiness = { status: "repair", message: (error as Error).message };
    }
  }
  const savedPractice = data.plans.find(plan => plan.id === p.id);
  const unsaved = active || !savedPractice || draftChanged(p, data.plans);
  const needsRepair = readiness?.status === "repair";
  const offlineBlocked = !online && readiness?.status === "connection";
  const pickerAvailable = !active && !queueActive;
  const auditionId = "preview-audition-" + p.id.slice(0, 80);
  const auditioning = state.plan?.id === auditionId && state.status === "playing";
  const auditionRequest = useRef(0);
  const [checkingAudition, setCheckingAudition] = useState(false);
  useEffect(() => () => {
    auditionRequest.current++;
    if (manifestPlayer.snapshot().plan?.id === auditionId) manifestPlayer.endPreview();
  }, [auditionId, view]);
  async function audition() {
    if (auditioning) { manifestPlayer.endPreview(); return; }
    const request = ++auditionRequest.current;
    setCheckingAudition(true);
    setMessage("");
    try {
      await verifyPractice(p);
      if (request !== auditionRequest.current) return;
      manifestPlayer.preview({ ...p, id: auditionId, seconds: Math.min(p.seconds, 60), repeats: 1,
        lines: p.lines.slice(0, 1) });
    } catch (error) {
      if (request === auditionRequest.current) setMessage((error as Error).message);
    } finally {
      setCheckingAudition(false);
    }
  }
  function addToPlaylist(event: FormEvent) {
    event.preventDefault();
    if (unsaved || !savedPractice) return;
    try {
      const currentLists = playlistStore.snapshot().data.playlists;
      const existing = currentLists.find(item => item.id === playlistTarget);
      if (playlistTarget && !existing) throw Error("Choose an available playlist.");
      if (existing?.items.some(item => item.kind === "practice" && item.id === savedPractice.id)) {
        setAddedPlaylist(existing);
        setMessage("This practice is already in “" + existing.name + "”.");
        return;
      }
      const target = existing ?? { id: crypto.randomUUID(), name: playlistName.trim(), items: [] };
      playlistStore.save({ ...target, items: [...target.items, { kind: "practice", id: savedPractice.id }] });
      setAddedPlaylist(target);
      setPlaylistTarget(target.id);
      setPlaylistName("");
      setMessage("Practice added to “" + target.name + "”.");
    } catch (error) {
      setMessage((error as Error).message);
    }
  }
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
          onPractice={id => id ? onOpenPractice(id) : newPractice()} focusOnEntry={false} />
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
                    "Playing your audio and sound layers."}
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
          <div className="practice-editor">
              <section className="practice-step" aria-labelledby="practice-details">
                <h2 id="practice-details">1. Practice details</h2>
                <label>Practice name
                  <input disabled={active} value={p.name} maxLength={80}
                    onChange={event => change({ name: event.target.value })} />
                </label>
              </section>
              <section className="practice-step sentence-fields" aria-labelledby="practice-sentences">
                <div className="practice-step-heading">
                  <h2 id="practice-sentences">2. Sentences or audio</h2>
                  <small aria-label={p.lines.length + " of 50 items"}>{p.lines.length}/50</small>
                  <button type="button" className="icon-button sentence-disclosure"
                    aria-controls="practice-sentence-content" aria-expanded={sentencesOpen}
                    aria-label={sentencesOpen ? "Minimise sentences or audio" : "Expand sentences or audio"}
                    onClick={() => setSentencesOpen(open => !open)}>
                    {sentencesOpen ? "−" : "+"}
                  </button>
                </div>
                <div id="practice-sentence-content" hidden={!sentencesOpen}>
                <div className="practice-sentences">
                  <div className="practice-step-heading">
                    <h3>2.1 Choose from library</h3>
                    {p.lines.length > 0 && <button type="button" className="text-button" aria-pressed={selectSentences}
                      disabled={active} onClick={() => {
                        setSelectSentences(!selectSentences);
                        setSelectedLines([]);
                      }}>{selectSentences ? "Done" : "Select sentences"}</button>}
                  </div>
                  <div className="practice-source-actions">
                    <button disabled={!pickerAvailable || p.lines.length >= 50} onClick={() => setChoosingAffirmations(true)}>Choose affirmations</button>
                    <button type="button" aria-expanded={writeAffirmation} aria-controls="practice-composer"
                      disabled={active || p.lines.length >= 50} onClick={() => setWriteAffirmation(!writeAffirmation)}>
                      Write your own affirmation
                    </button>
                  </div>
                  <div id="practice-composer" className="practice-composer" hidden={!writeAffirmation}>
                      <label className="sr-only" htmlFor="practice-custom-sentence">Your own sentence</label>
                      <textarea id="practice-custom-sentence" disabled={active} rows={2} value={custom}
                        maxLength={300} placeholder="Write an affirmation"
                        onChange={event => composer(event.target.value)} />
                      <div className="admin-actions">
                        <button disabled={active || !custom.trim() || p.lines.length >= 50} onClick={addSentence}>
                          <Plus size={15} aria-hidden="true" /> Add sentence
                        </button>
                        <small>Also saved to your library</small>
                      </div>
                  </div>
                  {selectSentences && <div className="home-actions practice-bulk-actions">
                    <button disabled={active} onClick={() => setSelectedLines(p.lines.map(line => line.id))}>Select all sentences</button>
                    <button disabled={!selectedLines.length} onClick={() => setSelectedLines([])}>Clear sentence selection</button>
                    <button disabled={active || !selectedLines.length} onClick={() => {
                      if (confirm("Remove selected sentences?") && change({ lines: p.lines.filter(line => !selectedLines.includes(line.id)) })) {
                        setSelectedLines([]);
                        setSelectSentences(false);
                      }
                    }}>Remove selected sentences</button>
                  </div>}
                  <div className="manifest-lines">
                    {p.lines.map((line, i) => (
                      <article className="manifest-line" key={line.id}>
                        <div className="sentence-queue-head">
                          {selectSentences ? <input aria-label={"Select sentence " + (i + 1)} type="checkbox"
                            disabled={active} checked={selectedLines.includes(line.id)} onChange={event =>
                              setSelectedLines(event.target.checked
                                ? [...selectedLines, line.id]
                                : selectedLines.filter(id => id !== line.id))} />
                            : <span className="queue-index">{i + 1}.</span>}
                          <div className="queue-copy">
                            <p>{line.text}</p>
                            {(line.audioAffirmation || line.recordingId) && <small>
                              {line.audioAffirmation ? "Audio affirmation" : "Personal voice"}
                            </small>}
                          </div>
                          <PreviewButton
                            line={line}
                            id={line.id}
                            recorded={p.useRecordings}
                            iconOnly
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
                </div>
                <details className="practice-playback">
                  <summary aria-labelledby="practice-playback">
                    <h3 id="practice-playback">2.2 Playback options</h3>
                    <small>{p.lines.length > 0 && (p.mode === "speech" ? "Spoken" : "Reading") + " · "}{p.seconds / 60} min max</small>
                  </summary>
                  <fieldset className="practice-playback-fields" disabled={active} aria-labelledby="practice-playback">
                    {p.lines.length > 0 && <>
                      <label>Practice mode
                        <select aria-label="Practice mode" value={p.mode}
                          onChange={event => change({ mode: event.target.value as Plan["mode"] })}>
                          <option value="speech">Spoken voice</option>
                          <option value="read">Silent reading</option>
                        </select>
                      </label>
                      <label>Repeat order
                        <select aria-label="Repeat order" value={p.order}
                          onChange={event => change({ order: event.target.value as Plan["order"] })}>
                          <option value="sequence">Whole sequence</option>
                          <option value="each">Each sentence</option>
                        </select>
                      </label>
                      <label>Repetitions
                        <NumberField integer min={1} max={108} value={p.repeats}
                          onValue={repeats => change({ repeats })} />
                      </label>
                      <label>Gap between sentences (sec)
                        <NumberField min={0} max={30} value={p.gap} onValue={gap => change({ gap })} />
                      </label>
                      {p.mode === "read" && <label>Reading time (sec)
                        <NumberField min={2} max={30} value={p.readSeconds}
                          onValue={readSeconds => change({ readSeconds })} />
                      </label>}
                    </>}
                    <label>Maximum session
                      <select aria-label="Maximum session" value={p.seconds}
                        onChange={event => change({ seconds: Number(event.target.value) })}>
                        {[...new Set([p.seconds, 60, 300, 600, 900, 1800, 3600])]
                          .sort((a, b) => a - b)
                          .map(seconds => <option key={seconds} value={seconds}>{seconds / 60} min</option>)}
                      </select>
                    </label>
                  </fieldset>
                  {p.lines.length > 0 && <VoicePanel />}
                </details>
                </div>
              </section>
              <PracticeLayers key={p.id} plan={p} sessions={sessions} tracks={tracks} active={active}
                onAudioLibrary={onAudioLibrary} queueActive={queueActive} onChange={change} onBackgroundChange={patch => {
                  try {
                    if (active) manifestPlayer.updateBackground(patch);
                    else return change(patch);
                  }
                  catch (error) { setMessage((error as Error).message); return false; }
                }} />
              {canPlay && <div className="practice-review" aria-label="Playback review">
                <div>
                  <strong>Playback review</strong>
                  <small>{p.mode === "read" && p.lines.length ? "Silent reading" : p.lines.length ? "Spoken affirmations" : "Audio and sound layers"}
                    {" · "}{p.seconds / 60} min maximum</small>
                </div>
                <button type="button" disabled={!pickerAvailable || needsRepair || offlineBlocked || !p.name.trim() || checkingAudition}
                  onClick={() => void audition()}>
                  {auditioning ? <Square size={14} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
                  {auditioning ? "Stop audition" : checkingAudition ? "Checking audio…" : "Audition practice"}
                </button>
                {state.plan?.id === auditionId && state.error && <p role="status">{state.error}</p>}
                {p.mode === "read" && p.lines.some(line => line.audioAffirmation) &&
                  <p className="content-note">Silent reading skips recorded affirmations. Choose Spoken voice to hear them.</p>}
                {readiness && <p className="content-note" role={needsRepair || offlineBlocked ? "status" : undefined}>{readiness.message}</p>}
              </div>}
              <div className="practice-footer">
                <button
                  className="primary"
                  disabled={active || !canPlay || !p.name.trim()}
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
                <details className="practice-more">
                  <summary>Playlist</summary>
                  {unsaved ? <p className="content-note">Save this practice before adding it.</p> :
                    <form className="playlist-add-practice" onSubmit={addToPlaylist}>
                      <label>Playlist
                        <select value={playlistTarget} onChange={event => { setPlaylistTarget(event.target.value); setAddedPlaylist(undefined); }}>
                          <option value="">Create a playlist</option>
                          {playlists.playlists.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                      </label>
                      {!playlistTarget && <label>Playlist name
                        <input required maxLength={80} value={playlistName} onChange={event => setPlaylistName(event.target.value)} />
                      </label>}
                      <div className="home-actions">
                        <button type="submit" disabled={Boolean(playlistError) || (!playlistTarget && !playlistName.trim())}>Add to playlist</button>
                        {addedPlaylist && <button type="button" onClick={() => onListen(addedPlaylist.id)}>Open on Home</button>}
                      </div>
                      {playlistError && <p role="status">{playlistError}</p>}
                    </form>}
                </details>
                <details className="practice-more">
                  <summary>More practice actions</summary>
                  <div className="home-actions">
                    <button disabled={active || !canPlay || !p.name.trim()} onClick={() => {
                      try { store.copy(); setMessage("Practice copied and saved."); }
                      catch (error) { setMessage((error as Error).message); }
                    }}>Save as copy</button>
                    <button disabled={active} onClick={newPractice}>New practice</button>
                    {data.plans.some(plan => plan.id === p.id) && <button disabled={active} onClick={() => {
                      setView("schedule");
                      onView?.("schedule");
                    }}>Schedule practice</button>}
                  </div>
                  <Presets onOpen={() => { setView("practice"); onView?.("practice"); }} />
                  <p className="content-note" aria-label="Practice configuration summary">
                    {p.lines.length}/50 sentences · {p.repeats} repetitions · {p.seconds / 60} min max · {Math.round(p.volume * 100)}% voice
                  </p>
                </details>
              </div>
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
      {view === "practice" && choosingAffirmations && pickerAvailable && <AffirmationPicker
        lines={p.lines} onClose={() => setChoosingAffirmations(false)} onManage={onLibrary}
        onAdd={items => {
          const ids = new Set(p.lines.map(line => line.id));
          const selected = items.map(line => {
            const id = ids.has(line.id) ? crypto.randomUUID() : line.id;
            ids.add(id);
            return { ...line, id };
          });
          return change({ lines: [...p.lines, ...selected] });
        }} />}
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
          {active ? labelTime(state.elapsed) : p.lines.length ? p.lines.length + " sentences" : "Audio and sound layers"}
        </p>
        <div className="transport">
          <button
            className="primary"
            disabled={(!canPlay || !p.name.trim() || needsRepair || offlineBlocked) && !active}
            onClick={start}
          >
            {active && state.status === "playing" ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
            {active && state.status === "playing"
              ? "Pause"
              : active && state.status === "paused"
                ? "Resume"
                : "Play practice"}
          </button>
          <button disabled={!active} onClick={() => manifestPlayer.stop()}>
            <Square size={14} aria-hidden="true" /> Stop practice
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
  const [selectPractices, setSelectPractices] = useState(false);
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
          <div className="home-actions">
            {onPractice && <button className="primary" disabled={active} onClick={() => onPractice()}>New practice</button>}
            <button type="button" onClick={() => input.current?.click()}>Import practice</button>
            {visiblePlans.length > 0 && <button type="button" aria-pressed={selectPractices} onClick={() => {
              setSelectPractices(!selectPractices);
              setSelectedPlans([]);
            }}>{selectPractices ? "Done" : "Select practices"}</button>}
          </div>
        </div>
        <input
          className="sr-only"
          ref={input}
          type="file"
          accept="application/json,.json"
          aria-label="Import manifestation practice"
          onChange={(e) => void importPlan(e.target.files?.[0])}
        />
        {selectPractices && <div className="home-actions">
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
        </div>}
        {chosenPlans.length > 0 && <p className="content-note">{chosenPlans.length} selected</p>}
        {data.plans.length > 0 && !visiblePlans.length && <p role="status">No practices match this search.</p>}
        {!data.plans.length && (
          <p className="content-note">
            {onPractice ? "Save your selected sentences as a practice to schedule them." : "Import a practice backup to get started."}
          </p>
        )}
        {visiblePlans.map((plan) => (
          <article className="saved-card saved-practice-row" key={plan.id}>
            <div className="saved-practice-copy">
              {selectPractices && <input aria-label={"Select practice " + plan.name} type="checkbox"
                checked={selectedPlans.includes(plan.id)} onChange={event => setSelectedPlans(event.target.checked
                  ? [...selectedPlans, plan.id]
                  : selectedPlans.filter(id => id !== plan.id))} />}
              <div>
                <h3>{plan.name}</h3>
                <p>{plan.lines.length ? plan.lines.length + (plan.lines.length === 1 ? " sentence" : " sentences") : "Audio and sound layers"} · {plan.seconds / 60} min max</p>
              </div>
            </div>
            {onPractice && <button
              className="icon-button"
              aria-label="Edit practice"
              title="Edit practice"
              onClick={() => {
                try {
                  onPractice(plan.id);
                } catch (e) {
                  setMessage((e as Error).message);
                }
              }}
            >
              <Pencil size={16} aria-hidden="true" />
            </button>}
              <button className="icon-button" title={state.plan?.id === plan.id && state.status === "playing" ? "Pause" : state.plan?.id === plan.id && state.status === "paused" ? "Resume" : "Play"}
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
                  ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
              </button>
            <details className="saved-practice-more">
              <summary aria-label={"More options for " + plan.name} title="More options">
                <Ellipsis size={18} aria-hidden="true" />
              </summary>
              <div className="saved-actions">
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
      </section>}
      {(message || error) && (
        <p role="status" className="notice">
          {message || error}
        </p>
      )}
    </section>
  );
}
export function Schedules({ onCreate, chakraSources, initialTarget }: {
  onCreate: () => void;
  chakraSources?: { id: string; name: string }[];
  initialTarget?: string;
}) {
  const pushMessage = useSyncExternalStore(pushStatus.subscribe, pushStatus.snapshot);
  const { data } = useSyncExternalStore(store.subscribe, store.snapshot);
  const sources = chakraSources ?? data.plans;
  const isChakra = !!chakraSources;
  const [planId, setPlanId] = useState(initialTarget ??
    (isChakra ? sources[0]?.id : data.plans.find(plan => plan.id === data.draft.id)?.id ?? data.plans[0]?.id) ?? "");
  const visibleRules = data.reminders.filter(rule => !!chakraScheduleTarget(rule.planId) === isChakra);
  const [frequency, setFrequency] = useState<Frequency | "once">("daily");
  const [times, setTimes] = useState(["07:00"]);
  const [days, setDays] = useState([1]);
  const [monthDay, setMonthDay] = useState(1);
  const [date, setDate] = useState(() => scheduleDate(new Date()));
  const [autoStart, setAutoStart] = useState(false);
  const [editing, setEditing] = useState<Reminder>();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const native = Capacitor.isNativePlatform();
  const freeSlot = () => Array.from({ length: 8 }, (_, i) => i)
    .find(slot => !store.snapshot().data.reminders.some(row => row.slot === slot));

  async function run(action: () => Promise<string>) {
    setBusy(true);
    try { setMessage(await action()); }
    catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }

  function update(rows: Reminder[]) {
    return run(async () => {
      store.reminders(rows);
      return syncPhoneReminders();
    });
  }

  function add(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    if (!sources.some(source => source.id === planId)) {
      setMessage("Choose an available saved item.");
      return;
    }
    const slot = editing?.slot ?? freeSlot();
    if (slot === undefined) { setMessage("Up to eight schedules are supported."); return; }
    const sorted = (frequency === "once" ? times.slice(0, 1) : [...times]).sort();
    if (sorted.some(time => !scheduleTimePattern.test(time)) || new Set(sorted).size !== sorted.length) {
      setMessage("Enter a different time for each reminder.");
      return;
    }
    const [time] = sorted;
    const previousOnce = editing?.oneOff ? new Date(editing.oneOff) : undefined;
    const unchangedOnce = previousOnce && scheduleDate(previousOnce) === date && scheduleClock(previousOnce) === time;
    const once = frequency === "once" ? unchangedOnce ? previousOnce : new Date(date + "T" + time + ":00") : undefined;
    if (once && (!Number.isFinite(+once) || (+once <= Date.now() && !unchangedOnce) || scheduleClock(once) !== time)) {
      setMessage("Choose a valid future date and time.");
      return;
    }
    const row: Reminder = {
      id: editing?.id ?? crypto.randomUUID(), slot, planId, time,
      days: frequency === "weekly" ? days : [0, 1, 2, 3, 4, 5, 6],
      enabled: editing?.enabled ?? true, autoStart,
      ...(once ? { oneOff: once.toISOString() } : {
        frequency: frequency as Frequency, times: sorted,
        ...(frequency === "monthly" ? { monthDay } : {}),
        skipDates: editing?.skipDates, skipOccurrences: editing?.skipOccurrences,
      }),
    };
    void run(async () => {
      store.reminders([...store.snapshot().data.reminders.filter(item => item.id !== row.id), row]);
      setEditing(undefined);
      return syncPhoneReminders();
    });
  }

  function edit(rule: Reminder) {
    setEditing(rule);
    setPlanId(rule.planId);
    setFrequency(scheduleFrequency(rule));
    setTimes([...scheduleTimes(rule)]);
    setDays([...rule.days]);
    setMonthDay(rule.monthDay ?? 1);
    if (rule.oneOff) {
      const occurrence = new Date(rule.oneOff);
      setDate(scheduleDate(occurrence));
      setTimes([scheduleClock(occurrence)]);
    }
    setAutoStart(!!rule.autoStart);
    form.current?.scrollIntoView({ block: "start" });
    form.current?.querySelector("select")?.focus({ preventScroll: true });
  }

  function copy(rule: Reminder, quick = false) {
    const slot = freeSlot();
    if (slot === undefined) return;
    const at = new Date(Date.now() + 600000);
    const shared = { id: crypto.randomUUID(), slot, planId: rule.planId };
    void update([...data.reminders, quick ? {
      ...shared, time: scheduleClock(at), days: [at.getDay()], enabled: true, oneOff: at.toISOString(),
    } : { ...rule, ...shared, enabled: false }]);
  }

  function describe(rule: Reminder) {
    switch (scheduleFrequency(rule)) {
      case "daily": return "Daily";
      case "monthly": return "Monthly on day " + rule.monthDay;
      case "once": return "One time · " + new Date(rule.oneOff!).toLocaleDateString();
      case "weekly": return "Weekly · " + rule.days.map(day => dayNames[day]).join(", ");
    }
  }

  return <section className="manifest-workspace schedule-workspace" aria-label={isChakra ? "Chakra schedules" : "Manifestation schedules"}>
    <div className="section-heading"><h2>{isChakra ? "Schedule a chakra session or playlist" : "Schedule your practice"}</h2></div>
    {!sources.length && <div className="notice">
      <span>{isChakra ? "Save a chakra session or playlist before adding a reminder." : "Save a practice before adding a reminder."}</span><button onClick={onCreate}>{isChakra ? "Go to session setup" : "Create a practice"}</button>
    </div>}
    {sources.length > 0 && <form ref={form} className="manifest-fields schedule-form" onSubmit={add}>
      <div className="fields">
        <label>{isChakra ? "Saved session or playlist" : "Saved practice"}
          <select required value={sources.some(source => source.id === planId) ? planId : ""} onChange={event => setPlanId(event.target.value)}>
            <option value="" disabled>Choose a saved item</option>
            {sources.map(plan => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
          </select>
        </label>
        <RecurrenceFields frequency={frequency} setFrequency={setFrequency}
          days={days} setDays={setDays} times={times} setTimes={setTimes}
          monthDay={monthDay} setMonthDay={setMonthDay} date={date} setDate={setDate} />
      </div>
      <small>Device time · {Intl.DateTimeFormat().resolvedOptions().timeZone}</small>
      <label>When due
        <select value={autoStart ? "play" : "notify"} onChange={event => setAutoStart(event.target.value === "play")}>
          <option value="notify">Remind me</option><option value="play">Auto-play while open and idle</option>
        </select>
      </label>
      {autoStart && <small>While the app is closed, locked, or busy, you’ll receive a reminder if notifications are enabled.</small>}
      <div className="home-actions">
        <button className="primary" disabled={busy || !planId || frequency === "weekly" && !days.length}>
          {editing ? "Save schedule" : "Add schedule"}
        </button>
        {editing && <button type="button" onClick={() => setEditing(undefined)}>Cancel editing</button>}
      </div>
    </form>}
    {message && <p role="status" className="notice">{message}</p>}
    {visibleRules.map(rule => {
      const name = sources.find(plan => plan.id === rule.planId)?.name ?? "Saved item unavailable";
      const next = nextOccurrence(rule, new Date());
      return <article className="saved-card schedule-card" key={rule.id}>
        <div><h3>{name}</h3><p>{describe(rule)} · {scheduleTimes(rule).join(", ")}</p>
          <p>{next ? "Next " + next.toLocaleString() : rule.enabled ? "No upcoming occurrence" : "Paused"}</p>
        </div>
        <button disabled={busy} aria-pressed={rule.enabled} onClick={() =>
          void update(data.reminders.map(item => item.id === rule.id ? { ...item, enabled: !item.enabled } : item))}>
          {rule.enabled ? "Pause" : "Enable"}
        </button>
        <details className="practice-actions">
          <summary>Schedule actions</summary>
          <div className="saved-actions">
            <button disabled={busy} onClick={() => edit(rule)}>Edit schedule</button>
            <button disabled={busy || data.reminders.length >= 8} onClick={() => copy(rule)}>Duplicate schedule</button>
            <button disabled={busy || data.reminders.length >= 8} onClick={() => copy(rule, true)}>Remind in 10 min</button>
            <button disabled={busy || !next || native || !!rule.oneOff} onClick={() => {
              if (!next) return;
              const key = scheduleDate(next) + "T" + scheduleClock(next);
              const skipOccurrences = [...(rule.skipOccurrences ?? []).filter(value => value >= scheduleDate(new Date())), key].slice(-30);
              void update(data.reminders.map(item => item.id === rule.id ? { ...item, skipOccurrences } : item));
            }}>Skip next</button>
            <button disabled={busy} onClick={() => void run(async () =>
              download(calendarFile(rule, name), "core-aura-reminder.ics", "text/calendar"))}>Export calendar reminder</button>
            <button disabled={busy} onClick={() => {
              if (confirm("Delete this schedule?")) {
                void update(data.reminders.filter(item => item.id !== rule.id));
                if (editing?.id === rule.id) setEditing(undefined);
              }
            }}>Delete schedule</button>
          </div>
        </details>
      </article>;
    })}
    <details className="workbench-panel">
      <summary>Notification delivery</summary>
      {!native && <p role="status">{pushMessage}</p>}
      <p className="content-note">{native ? "Device permissions and power settings affect notification delivery." :
        "Closed-app notifications require internet and browser permission. On iPhone, open Core-aura from the Home Screen."}</p>
      <div className="home-actions">
        <button disabled={busy} onClick={() => void run(enableReminders)}>Enable reminders</button>
        {!native && <button disabled={busy} onClick={() => void run(disablePushReminders)}>Disable closed-app reminders</button>}
      </div>
    </details>
  </section>;
}
