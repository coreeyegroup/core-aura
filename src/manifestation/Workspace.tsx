import { Capacitor } from "@capacitor/core";
import {
  FormEvent,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { manifestationStore as store } from "./store";
import {
  affirmations,
  categories,
  Category,
  Line,
  nextOccurrence,
  Plan,
  position,
  Reminder,
} from "./model";
import { manifestPlayer } from "./player";
import { speech, Voice } from "./speech";
import { calendarFile, enableReminders, syncPhoneReminders } from "./reminders";
import { PreviewButton, RecordSentence, PersonalVoices } from "./VoiceControls";
import { withoutRecordings } from "./recordings";
import { pushStatus, disablePushReminders } from "./push";
function download(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
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
export function Manifestation({ onLibrary }: { onLibrary: () => void }) {
  const { data, error } = useSyncExternalStore(store.subscribe, store.snapshot),
    state = useSyncExternalStore(
      manifestPlayer.subscribe,
      manifestPlayer.snapshot,
    );
  const [view, setView] = useState("practice"),
    [custom, setCustom] = useState(""),
    [message, setMessage] = useState(""),
    [voices, setVoices] = useState<Voice[]>([]);
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
  useEffect(() => {
    let alive = true;
    const read = () =>
      speech
        .voices()
        .then((v) => {
          if (alive) setVoices(v);
        })
        .catch(() => {});
    void read();
    if ("speechSynthesis" in window)
      speechSynthesis.addEventListener("voiceschanged", read);
    return () => {
      alive = false;
      if ("speechSynthesis" in window)
        speechSynthesis.removeEventListener("voiceschanged", read);
    };
  }, []);
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
    <section className="manifest-workspace">
      <div className="section-heading">
        <h1>Manifestation</h1>
        <button onClick={onLibrary}>Choose affirmations</button>
      </div>
      <p className="lead">Choose your words. Build a daily practice.</p>
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
          <fieldset className="manifest-fields">
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
                  <label>
                    Sentence {i + 1}
                    <textarea
                      disabled={active}
                      value={line.text}
                      maxLength={300}
                      onChange={(e) =>
                        change({
                          lines: p.lines.map((l, n) =>
                            n === i ? { id: l.id, text: e.target.value } : l,
                          ),
                        })
                      }
                    />
                  </label>
                  <div className="line-actions">
                    <PreviewButton
                      line={line}
                      id={line.id}
                      recorded={p.useRecordings}
                    />
                    <button
                      disabled={active || !line.text.trim()}
                      onClick={() => setRecordLine(line)}
                    >
                      {line.recordingId ? "Record again" : "Record voice"}
                    </button>
                    {line.recordingId && (
                      <span className="content-note">Personal voice saved</span>
                    )}
                    <button
                      disabled={active || i === 0}
                      aria-label={"Move sentence " + (i + 1) + " up"}
                      onClick={() => {
                        const lines = [...p.lines];
                        [lines[i - 1], lines[i]] = [lines[i], lines[i - 1]];
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
                        [lines[i + 1], lines[i]] = [lines[i], lines[i + 1]];
                        change({ lines });
                      }}
                    >
                      ↓
                    </button>
                    <button
                      disabled={active}
                      aria-label={"Remove sentence " + (i + 1)}
                      onClick={() =>
                        change({ lines: p.lines.filter((_, n) => n !== i) })
                      }
                    >
                      Remove
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <label>
              Your own sentence
              <textarea
                disabled={active}
                value={custom}
                maxLength={300}
                placeholder="Write the words you want to repeat"
                onChange={(e) => setCustom(e.target.value)}
              />
            </label>
            <div className="admin-actions">
              <button
                disabled={active || !custom.trim() || p.lines.length >= 50}
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
          </fieldset>
          <fieldset disabled={active} className="manifest-fields">
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
                  onChange={(e) => change({ seconds: Number(e.target.value) })}
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
            {p.mode === "speech" && (
              <details>
                <summary>Voice &amp; volume</summary>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={!!p.useRecordings}
                    onChange={(e) =>
                      change({ useRecordings: e.target.checked })
                    }
                  />
                  Use my recordings when available
                </label>
                <p className="content-note">
                  Other sentences use the selected device voice. Speech speed
                  applies to the device voice; personal recordings keep their
                  original speed.
                </p>
                <label>
                  Voice
                  <select
                    aria-label="Voice"
                    value={p.voice}
                    onChange={(e) => change({ voice: e.target.value })}
                  >
                    <option value="">Device default · English</option>
                    {voices.map((v, i) => (
                      <option key={v.voiceURI + ":" + i} value={v.voiceURI}>
                        {v.name} · {v.lang}
                        {v.localService
                          ? " · on device"
                          : " · network may be needed"}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="content-note">
                  Languages and offline speech depend on installed voices. A
                  network voice may send text to its voice provider.
                </p>
                <label className="range-label">
                  Speech speed <output>{p.rate.toFixed(2)}×</output>
                  <input
                    type="range"
                    aria-label="Speech speed"
                    min="0.5"
                    max="1.5"
                    step="0.05"
                    value={p.rate}
                    onChange={(e) => change({ rate: Number(e.target.value) })}
                  />
                </label>
                <label className="range-label">
                  Voice volume <output>{Math.round(p.volume * 100)}%</output>
                  <input
                    type="range"
                    aria-label="Voice volume"
                    min="0"
                    max="100"
                    value={p.volume * 100}
                    onChange={(e) =>
                      change({ volume: Number(e.target.value) / 100 })
                    }
                  />
                </label>
              </details>
            )}
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
                    <output>{Math.round(p.background.volume * 100)}%</output>
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
          <div className="admin-actions">
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
export function ManifestLibrary({ onPractice }: { onPractice: () => void }) {
  const { data, error } = useSyncExternalStore(store.subscribe, store.snapshot),
    state = useSyncExternalStore(
      manifestPlayer.subscribe,
      manifestPlayer.snapshot,
    );
  const [category, setCategory] = useState<Category>("Health"),
    [query, setQuery] = useState(""),
    [message, setMessage] = useState("");
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
      <div className="fields">
        <label>
          Category
          <select
            aria-label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
          >
            {categories.map((c) => (
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
      <p className="content-note">
        Select one or more sentences. Edit their words and order in your
        practice.
      </p>
      {active && (
        <p className="content-note">
          Stop the current practice before changing its sentences.
        </p>
      )}
      <div className="affirmation-list">
        {affirmations
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
            </div>
          ))}
      </div>
      <PersonalVoices />
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
              disabled={Capacitor.isNativePlatform()}
              title={
                Capacitor.isNativePlatform()
                  ? "Native file sharing is pending; exports are available in web/PWA builds."
                  : undefined
              }
              onClick={() =>
                download(
                  JSON.stringify(withoutRecordings(plan), null, 2),
                  "core-aura-practice.json",
                  "application/json",
                )
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
                disabled={Capacitor.isNativePlatform()}
                title={
                  Capacitor.isNativePlatform()
                    ? "Use native phone reminders; calendar export is available in web/PWA builds."
                    : undefined
                }
                onClick={() =>
                  download(
                    calendarFile(r, name),
                    "core-aura-reminder.ics",
                    "text/calendar",
                  )
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
