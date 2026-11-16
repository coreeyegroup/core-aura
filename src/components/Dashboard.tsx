import { useEffect, useState, useSyncExternalStore } from "react";
import {
  AudioLines,
  Bell,
  BookOpen,
  ChevronRight,
  Clock3,
  Download,
  Flower2,
  Layers3,
  Mic,
  Palette,
  Play,
  Pause,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { affirmationLibrary } from "../manifestation/library";
import { manifestationStore } from "../manifestation/store";
import { manifestPlayer } from "../manifestation/player";
import { practiceActive } from "../manifestation/flow";
import { nextOccurrence } from "../manifestation/model";
export type Tool =
  | "affirmations"
  | "studio"
  | "chakras"
  | "schedule"
  | "recordings"
  | "packs"
  | "sessions"
  | "display"
  | "practices";
const tools = [
  ["affirmations", "Affirmations", BookOpen],
  ["studio", "Sound studio", SlidersHorizontal],
  ["chakras", "Chakras", Flower2],
  ["schedule", "Schedule", Bell],
  ["recordings", "Recordings", Mic],
  ["packs", "Sound packs", Download],
  ["sessions", "Sessions", Layers3],
  ["display", "Display", Palette],
] as const;
export function Dashboard({
  onTool,
  onCategory,
  onPractice,
  onContinue,
  onTone,
  sessions,
}: {
  onTool: (tool: Tool) => void;
  onCategory: (category: string) => void;
  onPractice: (id: string) => void;
  onContinue: () => void;
  onTone: (hz: number) => void;
  sessions: number;
}) {
  const { data, error } = useSyncExternalStore(
    manifestationStore.subscribe,
    manifestationStore.snapshot,
  );
  const catalog = useSyncExternalStore(
    affirmationLibrary.subscribe,
    affirmationLibrary.snapshot,
  );
  const player = useSyncExternalStore(
    manifestPlayer.subscribe,
    manifestPlayer.snapshot,
  );
  const [now, setNow] = useState(() => new Date()),
    [message, setMessage] = useState("");
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);
  const upcoming = data.reminders
    .flatMap((r) => {
      const date = nextOccurrence(r, now),
        plan = data.plans.find((p) => p.id === r.planId);
      return date && plan ? [{ ...r, date, name: plan.name }] : [];
    })
    .sort((a, b) => +a.date - +b.date);
  const active = practiceActive(player),
    current = active ? player.plan || data.draft : data.draft;
  return (
    <section className="dashboard" aria-label="Practice dashboard">
      <div className="dashboard-title">
        <h1>Overview</h1>
        <span>
          {now.toLocaleDateString(undefined, {
            weekday: "short",
            day: "numeric",
            month: "short",
          })}
        </span>
      </div>
      <section
        className="practice-overview"
        aria-label="Current practice overview"
      >
        <div className="overview-top">
          <span className="eyebrow">CURRENT PRACTICE</span>
          <span className={"status-tag " + (active ? "is-active" : "")}>
            {active
              ? player.status
              : current.lines.length
                ? "Draft ready"
                : "Not configured"}
          </span>
        </div>
        <div className="overview-value">
          <div>
            <h2>{current.name}</h2>
            <p>
              {current.lines.length} sentences <span>·</span> {current.repeats}{" "}
              rounds <span>·</span>{" "}
              {current.mode === "speech" ? "Spoken voice" : "Silent reading"}
            </p>
          </div>
          <div className="limit-value">
            {current.seconds / 60}
            <small>min limit</small>
          </div>
        </div>
        <div className="overview-actions">
          <button className="primary" onClick={onContinue}>
            <Sparkles size={16} />
            {active
              ? "Open player"
              : current.lines.length
                ? "Continue practice"
                : "Build a practice"}
            <ChevronRight size={16} />
          </button>
          <button onClick={() => onTool("affirmations")}>
            <BookOpen size={17} />
            Library
          </button>
        </div>
        <dl className="account-metrics">
          <div>
            <dt>Saved practices</dt>
            <dd>{data.plans.length}</dd>
          </div>
          <div>
            <dt>Active reminders</dt>
            <dd>{data.reminders.filter((r) => r.enabled).length}</dd>
          </div>
          <div>
            <dt>Sound sessions</dt>
            <dd>{sessions}</dd>
          </div>
        </dl>
      </section>
      <section className="tool-section" aria-labelledby="tools-title">
        <div className="module-title">
          <h2 id="tools-title">Your tools</h2>
          <span>Quick access</span>
        </div>
        <div className="tool-grid">
          {tools.map(([id, label, Icon]) => (
            <button key={id} onClick={() => onTool(id)}>
              <span className="tool-icon">
                <Icon size={21} />
              </span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </section>
      <div className="dashboard-columns">
        <section
          className="dashboard-module"
          aria-labelledby="intentions-title"
        >
          <div className="module-title">
            <h2 id="intentions-title">Affirmation categories</h2>
            <span>{catalog.data.affirmations.length} sentences</span>
          </div>
          <div className="intention-grid">
            {catalog.data.categories.slice(0, 8).map((category, i) => (
              <button key={category} onClick={() => onCategory(category)}>
                <span className="category-marker" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>
                  {category}
                  <small>
                    {
                      catalog.data.affirmations.filter(
                        (a) => a.category === category,
                      ).length
                    }{" "}
                    sentences
                  </small>
                </span>
                <ChevronRight size={14} />
              </button>
            ))}
          </div>
          {!catalog.data.categories.length && (
            <button className="wide" onClick={() => onTool("affirmations")}>
              Create your first category <ChevronRight size={16} />
            </button>
          )}
        </section>
        <div className="dashboard-stack">
          <section
            className="dashboard-module"
            aria-labelledby="saved-practices-title"
          >
            <div className="module-title">
              <h2 id="saved-practices-title">
                Saved practices{" "}
                <span className="count-tag">{data.plans.length}</span>
              </h2>
              <button
                className="text-button"
                onClick={() => onTool("practices")}
              >
                View all <ChevronRight size={14} />
              </button>
            </div>
            {data.plans
              .slice(-3)
              .reverse()
              .map((plan) => (
                <div className="practice-ticker" key={plan.id}>
                  <button
                    className="ticker-open"
                    onClick={() => onPractice(plan.id)}
                  >
                    <span className="ticker-symbol">
                      <Sparkles size={17} />
                    </span>
                    <span>
                      <strong>{plan.name}</strong>
                      <small>
                        {plan.lines.length} sentences · {plan.repeats} rounds ·{" "}
                        {plan.seconds / 60} min
                      </small>
                    </span>
                    <ChevronRight size={14} />
                  </button>
                  <button
                    className="ticker-play"
                    aria-label={`${player.plan?.id === plan.id && player.status === "playing" ? "Pause" : player.plan?.id === plan.id && player.status === "paused" ? "Resume" : "Play"} saved practice: ${plan.name}`}
                    onClick={() => {
                      try {
                        if (
                          player.plan?.id === plan.id &&
                          player.status === "playing"
                        )
                          manifestPlayer.pause();
                        else if (
                          player.plan?.id === plan.id &&
                          player.status === "paused"
                        )
                          manifestPlayer.resume();
                        else manifestPlayer.start(plan);
                        setMessage("");
                      } catch (e) {
                        setMessage((e as Error).message);
                      }
                    }}
                  >
                    {player.plan?.id === plan.id &&
                    player.status === "playing" ? (
                      <Pause size={18} />
                    ) : (
                      <Play size={18} />
                    )}
                  </button>
                </div>
              ))}
            {!data.plans.length && (
              <div className="module-empty">
                <BookOpen size={20} />
                <div>
                  <strong>No saved practices yet</strong>
                  <p>Choose sentences, set repetition and save.</p>
                </div>
                <button
                  className="text-button"
                  onClick={onContinue}
                  aria-label="Create a practice"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
          </section>
          <section
            className="dashboard-module"
            aria-labelledby="reminders-title"
          >
            <div className="module-title">
              <h2 id="reminders-title">Next reminder</h2>
              <button
                className="text-button"
                onClick={() => onTool("schedule")}
              >
                Manage <ChevronRight size={14} />
              </button>
            </div>
            {upcoming.length ? (
              upcoming.slice(0, 2).map((r) => (
                <button
                  className="reminder-ticker"
                  key={r.id}
                  onClick={() => onTool("schedule")}
                >
                  <Clock3 size={18} />
                  <span>
                    <strong>{r.name}</strong>
                    <small>
                      {r.date.toLocaleDateString(undefined, {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}{" "}
                      · Tap reminder to open practice
                    </small>
                  </span>
                  <b>{r.time}</b>
                </button>
              ))
            ) : (
              <div className="module-empty">
                <Clock3 size={20} />
                <div>
                  <strong>No upcoming reminders</strong>
                  <p>Schedule a saved practice for your routine.</p>
                </div>
              </div>
            )}
          </section>
          <section
            className="dashboard-module"
            aria-labelledby="quick-tones-title"
          >
            <div className="module-title">
              <h2 id="quick-tones-title">Quick tones</h2>
              <span>Opens in Studio</span>
            </div>
            <div className="tone-grid">
              {[432, 528, 639].map((hz) => (
                <button key={hz} onClick={() => onTone(hz)}>
                  <AudioLines size={17} />
                  <strong>
                    {hz}
                    <small> Hz</small>
                  </strong>
                  <ChevronRight size={14} />
                </button>
              ))}
            </div>
            <p className="module-footnote">
              Pure sine synthesis · Tune pitch, level and duration in Studio.
            </p>
          </section>
        </div>
      </div>
      {(message || error || catalog.error) && (
        <p className="notice" role="status">
          {message || error || catalog.error}
        </p>
      )}
    </section>
  );
}
