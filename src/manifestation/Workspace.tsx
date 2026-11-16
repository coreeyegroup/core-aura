import { BookOpen, Pencil } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import {
  FormEvent,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { affirmationLibrary } from "./library";
import { LibraryEditor, EditLibrary } from "./LibraryEditor";
import { manifestationStore as store } from "./store";
import { Line, nextOccurrence, Plan, position, Reminder } from "./model";
import { manifestPlayer } from "./player";
import { VoicePanel } from "./VoicePanel";
import { calendarFile, enableReminders, syncPhoneReminders } from "./reminders";
import { PreviewButton, RecordSentence, PersonalVoices } from "./VoiceControls";
import { withoutRecordings } from "./recordings";
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
  onLibrary,
  initialView = "practice",
}: {
  onLibrary: () => void;
  initialView?: string;
}) {
  const { data, error } = useSyncExternalStore(store.subscribe, store.snapshot),
    state = useSyncExternalStore(
      manifestPlayer.subscribe,
      manifestPlayer.snapshot,
    );
  const [view, setView] = useState(initialView),
    [custom, setCustom] = useState(""),
    [message, setMessage] = useState("");
  useEffect(() => setView(initialView), [initialView]);
  const [recordLine, setRecordLine] = useState<Line>();
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
  }, []);
  const p = data.draft,
    active = ["playing", "paused"].includes(state.status);
  const change = (patch: Partial<Plan>) => {
    try {
      store.draft({ ...p, ...patch });
      setMessage("");
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  const current =
    state.plan && state.plan.lines.length
      ? position(state.plan, state.step)
      : null;
  function start() {
    try {
      if (state.status === "playing") manifestPlayer.pause();
      else if (state.status === "paused") manifestPlayer.resume();
      else manifestPlayer.start(p);
      setMessage("");
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return (
    <section className="manifest-workspace" data-view={view}>
      <div className="section-heading">
        <h1>Manifestation</h1>
        <button onClick={onLibrary}>Choose affirmations</button>
      </div>
      <div className="segmented" aria-label="Manifestation workspace">
        <button
          aria-pressed={view === "practice"}
          onClick={() => setView("practice")}
        >
          Practice
        </button>
        <button
          aria-pressed={view === "schedule"}
          onClick={() => setView("schedule")}
        >
          Schedule
        </button>
      </div>
      {view === "practice" ? (
        <>
          {(active ||
            state.status === "completed" ||
            state.status === "error") && (
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
          <VoicePanel />
          <div className="practice-grid">
            <div className="practice-editor">
              <fieldset className="manifest-fields sentence-fields">
                <legend>Sentences ({p.lines.length}/50)</legend>
                <label>
                  Practice name
                  <input
                    disabled={active}
                    value={p.name}
                    maxLength={80}
                    onChange={(e) => change({ name: e.target.value })}
                  />
                </label>
                <div className="manifest-lines">
                  {p.lines.map((line, i) => (
                    <article className="manifest-line" key={line.id}>
                      <div className="sentence-queue-head">
                        <span className="queue-index">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <div className="queue-copy">
                          <p>{line.text}</p>
                          <small>
                            {line.recordingId
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
                            disabled={active}
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
                          <button
                            disabled={active || !line.text.trim()}
                            onClick={() => setRecordLine(line)}
                          >
                            {line.recordingId ? "Record again" : "Record voice"}
                          </button>
                          {line.recordingId && (
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
                        </div>
                      </details>
                    </article>
                  ))}
                </div>
                {!p.lines.length && (
                  <div className="queue-empty">
                    <BookOpen size={21} />
                    <p>
                      Your sequence is empty. Choose affirmations from the
                      library or write your own below.
                    </p>
                  </div>
                )}
                <details className="custom-sentence">
                  <summary>Write your own affirmation</summary>
                  <label>
                    Your own sentence
                    <textarea
                      disabled={active}
                      rows={2}
                      value={custom}
                      maxLength={300}
                      placeholder="Write the words you want to repeat"
                      onChange={(e) => setCustom(e.target.value)}
                    />
                  </label>
                  <div className="admin-actions">
                    <button
                      disabled={
                        active || !custom.trim() || p.lines.length >= 50
                      }
                      onClick={() => {
                        change({
                          lines: [
                            ...p.lines,
                            { id: crypto.randomUUID(), text: custom.trim() },
                          ],
                        });
                        setCustom("");
                      }}
                    >
                      Add sentence
                    </button>
                  </div>
                </details>
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
                      };
                      change(sample);
                      manifestPlayer.start(sample);
                    }}
                  >
                    Play sample affirmation
                  </button>
                )}
              </fieldset>
              <div className="admin-actions practice-actions">
                <button
                  className="primary"
                  disabled={active || !p.lines.length}
                  onClick={() => {
                    try {
                      store.save();
                      setMessage("Practice saved in Library.");
                    } catch (e) {
                      setMessage((e as Error).message);
                    }
                  }}
                >
                  Save practice
                </button>
                <button
                  disabled={active}
                  onClick={() => {
                    if (
                      p.lines.length &&
                      !confirm(
                        "Start a new practice? Saved practices remain in Library.",
                      )
                    )
                      return;
                    try {
                      store.fresh();
                      setMessage("");
                    } catch (e) {
                      setMessage((e as Error).message);
                    }
                  }}
                >
                  New practice
                </button>
              </div>
            </div>
            <div className="practice-settings">
              <fieldset
                disabled={active}
                className="manifest-fields repeat-fields"
              >
                <legend>Repetition</legend>
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
                <details>
                  <summary>Background sound</summary>
                  <label>
                    Background sound
                    <select
                      aria-label="Background sound"
                      value={p.background?.sound || "none"}
                      onChange={(e) =>
                        change({
                          background:
                            e.target.value === "none"
                              ? null
                              : {
                                  sound: e.target.value as
                                    | "sine"
                                    | "bowl"
                                    | "tanpura",
                                  hz: e.target.value === "tanpura" ? 216 : 432,
                                  volume: 0.12,
                                },
                        })
                      }
                    >
                      <option value="none">None</option>
                      <option value="sine">Pure tone</option>
                      <option value="bowl">Singing bowl</option>
                      <option value="tanpura">Tanpura drone</option>
                    </select>
                  </label>
                  {p.background && (
                    <>
                      <label>
                        Background frequency (Hz)
                        <NumberField
                          min={p.background.sound === "sine" ? 20 : 100}
                          max={
                            p.background.sound === "sine"
                              ? 12000
                              : p.background.sound === "bowl"
                                ? 1000
                                : 600
                          }
                          value={p.background.hz}
                          onValue={(hz) =>
                            change({ background: { ...p.background!, hz } })
                          }
                        />
                      </label>
                      <label className="range-label">
                        Background level{" "}
                        <output>
                          {Math.round(p.background.volume * 100)}%
                        </output>
                        <input
                          type="range"
                          aria-label="Background level"
                          min="0"
                          max="30"
                          value={p.background.volume * 100}
                          onChange={(e) =>
                            change({
                              background: {
                                ...p.background!,
                                volume: Number(e.target.value) / 100,
                              },
                            })
                          }
                        />
                      </label>
                    </>
                  )}
                </details>
              </fieldset>
            </div>
          </div>
        </>
      ) : (
        <Schedules />
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
      <section
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
            {state.status === "playing"
              ? "Pause"
              : state.status === "paused"
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
      </section>
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
  initialCategory = "Health",
  recordingsOpen = false,
}: {
  onPractice: () => void;
  initialCategory?: string;
  recordingsOpen?: boolean;
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
  const [editing, setEditing] = useState<EditLibrary>(),
    [manage, setManage] = useState(false);
  const libraryInput = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<string>(initialCategory),
    [query, setQuery] = useState(""),
    [message, setMessage] = useState("");
  useEffect(() => {
    if (!catalog.data.categories.includes(category))
      setCategory(catalog.data.categories[0] || "");
  }, [catalog.data, category]);
  const input = useRef<HTMLInputElement>(null);
  const active = ["playing", "paused"].includes(state.status);
  function select(id: string, text: string) {
    try {
      const selected = data.draft.lines.some((l) => l.text === text);
      if (!selected && data.draft.lines.length >= 50)
        throw Error("Choose up to 50 sentences.");
      store.draft({
        ...data.draft,
        lines: selected
          ? data.draft.lines.filter((l) => l.text !== text)
          : [
              ...data.draft.lines,
              {
                id: data.draft.lines.some((l) => l.id === id)
                  ? crypto.randomUUID()
                  : id,
                text,
              },
            ],
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
      manifestPlayer.stop();
      store.import(JSON.parse(await file.text()));
      setMessage("Practice imported.");
    } catch (e) {
      setMessage((e as Error).message);
    }
    if (input.current) input.current.value = "";
  }
  return (
    <section className="manifest-workspace" aria-label="Manifestation library">
      <div className="section-heading">
        <h2>Affirmation library</h2>
        <button
          className="primary"
          disabled={!data.draft.lines.length}
          onClick={onPractice}
        >
          Use selection ({data.draft.lines.length})
        </button>
      </div>
      <VoicePanel />
      <div className="fields">
        <label>
          Category
          <select
            aria-label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {catalog.data.categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Find a sentence
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      {active && (
        <p className="content-note">
          Stop the current practice before changing its sentences.
        </p>
      )}
      <details
        className="library-management"
        onToggle={(e) => setManage(e.currentTarget.open)}
      >
        <summary>Manage categories &amp; affirmations</summary>
        <p className="content-note">
          Changes are saved on this device. Export your library to back it up or
          move it to another device.
        </p>
        <div className="admin-actions">
          <button
            disabled={active}
            onClick={() => setEditing({ kind: "category-add", category })}
          >
            Add category
          </button>
          <button
            disabled={active || !category}
            onClick={() => setEditing({ kind: "category-edit", category })}
          >
            Rename category
          </button>
          <button
            disabled={active || !category}
            onClick={() => setEditing({ kind: "category-delete", category })}
          >
            Delete category
          </button>
          <button
            disabled={active || !category}
            onClick={() => setEditing({ kind: "affirmation-add", category })}
          >
            Add affirmation
          </button>
          <button
            disabled={!!catalog.error}
            onClick={() =>
              void download(
                JSON.stringify(catalog.data, null, 2),
                "core-aura-affirmation-library.json",
                "application/json",
              )
                .then(setMessage)
                .catch((e) => setMessage(e.message))
            }
          >
            Export library
          </button>
          <button
            disabled={active}
            onClick={() => libraryInput.current?.click()}
          >
            Import library
          </button>
        </div>
      </details>
      <input
        ref={libraryInput}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        aria-label="Import affirmation library"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          if (file.size > 2 * 1024 * 1024) {
            setMessage("Choose a library JSON file under 2 MB.");
            return;
          }
          void file
            .text()
            .then((text) => {
              if (
                !confirm(
                  "Replace this device’s affirmation library with this backup? Saved practices remain available.",
                )
              )
                return;
              affirmationLibrary.restore(JSON.parse(text));
              setMessage("Affirmation library restored.");
            })
            .catch((e) => setMessage(e.message));
        }}
      />
      {editing && (
        <LibraryEditor
          edit={editing}
          onClose={() => setEditing(undefined)}
          onCategory={setCategory}
        />
      )}
      {catalog.error && <p role="status">{catalog.error}</p>}
      {!catalog.data.categories.length && (
        <p className="notice">
          Add a category to start your affirmation library.
        </p>
      )}
      <div className="affirmation-list">
        {catalog.data.affirmations
          .filter(
            (a) =>
              a.category === category &&
              a.text.toLowerCase().includes(query.toLowerCase()),
          )
          .map((a) => (
            <div className="affirmation-row" key={a.id}>
              <label className="affirmation-choice">
                <input
                  type="checkbox"
                  disabled={active}
                  checked={data.draft.lines.some((l) => l.text === a.text)}
                  onChange={() => select(a.id, a.text)}
                />
                <span>{a.text}</span>
              </label>
              <PreviewButton line={a} id={a.id} />
              {manage && (
                <div className="library-row-actions">
                  <button
                    disabled={active}
                    aria-label={"Edit affirmation: " + a.text}
                    onClick={() =>
                      setEditing({
                        kind: "affirmation-edit",
                        category,
                        item: a,
                      })
                    }
                  >
                    Edit / Move
                  </button>
                  <button
                    disabled={active}
                    aria-label={"Delete affirmation: " + a.text}
                    onClick={() =>
                      setEditing({
                        kind: "affirmation-delete",
                        category,
                        item: a,
                      })
                    }
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
      </div>
      <PersonalVoices initiallyOpen={recordingsOpen} />
      <div className="section-heading">
        <h2>Saved practices</h2>
        <button onClick={() => input.current?.click()}>Import practice</button>
      </div>
      <input
        className="sr-only"
        ref={input}
        type="file"
        accept="application/json,.json"
        aria-label="Import manifestation practice"
        onChange={(e) => void importPlan(e.target.files?.[0])}
      />
      {!data.plans.length && (
        <p className="content-note">
          Save your selected sentences as a practice to schedule them. Practices
          stay on this device; export backups to keep a copy.
        </p>
      )}
      {data.plans.map((plan) => (
        <article className="saved-card" key={plan.id}>
          <div>
            <h3>{plan.name}</h3>
            <p>
              {plan.lines.length} sentences · {plan.repeats} repetitions ·{" "}
              {plan.mode === "speech" ? "spoken" : "reading"}
            </p>
          </div>
          <button
            className="primary"
            onClick={() => {
              try {
                manifestPlayer.stop();
                store.open(plan.id);
                onPractice();
              } catch (e) {
                setMessage((e as Error).message);
              }
            }}
          >
            Open practice
          </button>
          <div className="saved-actions">
            <button
              aria-label={`${state.plan?.id === plan.id && state.status === "playing" ? "Pause" : state.plan?.id === plan.id && state.status === "paused" ? "Resume" : "Play"} practice: ${plan.name}`}
              onClick={() => {
                try {
                  if (state.plan?.id === plan.id && state.status === "playing")
                    manifestPlayer.pause();
                  else if (
                    state.plan?.id === plan.id &&
                    state.status === "paused"
                  )
                    manifestPlayer.resume();
                  else manifestPlayer.start(plan);
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
            <button
              onClick={() => {
                if (
                  !confirm(
                    "Delete " +
                      plan.name +
                      " and its schedules from this device?",
                  )
                )
                  return;
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
        </article>
      ))}
      {(message || error) && (
        <p role="status" className="notice">
          {message || error}
        </p>
      )}
    </section>
  );
}
function Schedules() {
  const pushMessage = useSyncExternalStore(
    pushStatus.subscribe,
    pushStatus.snapshot,
  );
  const { data } = useSyncExternalStore(store.subscribe, store.snapshot);
  const [planId, setPlanId] = useState(data.plans[0]?.id || ""),
    [time, setTime] = useState("07:00"),
    [days, setDays] = useState([0, 1, 2, 3, 4, 5, 6]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const [autoStart, setAutoStart] = useState(false);
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
    const slot = Array.from({ length: 8 }, (_, i) => i).find(
      (n) => !data.reminders.some((r) => r.slot === n),
    );
    if (slot === undefined) {
      setMessage("Up to eight schedules are supported.");
      return;
    }
    void update([
      ...data.reminders,
      {
        id: crypto.randomUUID(),
        slot,
        planId,
        time,
        days,
        enabled: true,
        autoStart,
      },
    ]);
  }
  return (
    <section
      className="manifest-workspace"
      aria-label="Manifestation schedules"
    >
      <h2>Schedule your practice</h2>
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
      {!data.plans.length ? (
        <p className="notice">Save a practice before creating a schedule.</p>
      ) : (
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
            Add schedule
          </button>
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
