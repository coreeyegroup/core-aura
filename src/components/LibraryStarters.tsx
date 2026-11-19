import { useState, useSyncExternalStore } from "react";
import { Pause, Play, Plus } from "lucide-react";
import { affirmations, type Category, type Plan } from "../manifestation/model";
import { manifestationStore } from "../manifestation/store";
import { chakras, ENGINE_VERSION, type Channel, type Session } from "../model";
import { durationLabel, itemDuration, resolveItems, type PlaylistRef } from "../playlists/model";
import { queuePlayer, startQueue } from "../playlists/runtime";

function practice(id: string, name: string, category: Category): Plan {
  const lines = affirmations.filter(item => item.category === category).slice(0, 3)
    .map(({ id, text }) => ({ id, text }));
  return {
    schemaVersion: 1, id, name, lines, mode: "read", order: "sequence",
    repeats: 2, gap: 1, readSeconds: 8, voice: "", rate: 0.9, volume: 0.7,
    seconds: 60, background: null,
  };
}

function mix(id: string, name: string, channels: Channel[], kind: Session["kind"] = "nature"): Session {
  return { id, name, channels, kind, schemaVersion: 2, engineVersion: ENGINE_VERSION, master: 0.45, createdAt: "" };
}

const practices = [
  practice("included-quiet-moment", "A quiet moment", "Calm"),
  practice("included-gratitude", "A moment of gratitude", "Gratitude"),
  practice("included-steady-start", "Steady confidence", "Confidence"),
];
const backgrounds = [
  mix("included-gentle-rain", "Gentle rain", [
    { id: "nature:included-rain", sound: "rain", hz: 1000, volume: 0.34, muted: false, seconds: 180 },
  ]),
  mix("included-stream-and-breeze", "Stream and breeze", [
    { id: "nature:included-stream", sound: "stream", hz: 1000, volume: 0.28, muted: false, seconds: 180 },
    { id: "nature:included-breeze", sound: "breeze", hz: 1000, volume: 0.12, muted: false, seconds: 180 },
  ]),
];
const mixes = [
  mix("included-shore-bowl", "Shore and singing bowl", [
    { id: "nature:included-shore", sound: "shore", hz: 1000, volume: 0.25, muted: false, seconds: 180 },
    { id: "nature:included-bowl", sound: "bowl", hz: 432, volume: 0.2, muted: false, seconds: 180, interval: 9 },
  ]),
  {
    ...mix("included-chakra-sequence", "Seven chakra tones", chakras.map(({ id, hz }) => ({
      id, hz, sound: "sine", volume: 0.18, muted: false, seconds: 12,
    })), "chakras"),
    sequenceGap: 1,
  },
];

const sessionRef = ({ id }: Session): PlaylistRef => ({ kind: "session", id });
const practiceRef = ({ id }: Plan): PlaylistRef => ({ kind: "practice", id });
type StarterEntry = { name: string; refs: PlaylistRef[]; plan?: Plan; session?: Session };
type StarterGroup = "practices" | "backgrounds" | "mixes" | "playlists";
const entries: Record<StarterGroup, StarterEntry[]> = {
  practices: practices.map(plan => ({ name: plan.name, refs: [practiceRef(plan)], plan })),
  backgrounds: backgrounds.map(session => ({ name: session.name, refs: [sessionRef(session)], session })),
  mixes: mixes.map(session => ({ name: session.name, refs: [sessionRef(session)], session })),
  playlists: [
    { name: "Morning pause", refs: [practiceRef(practices[0]), sessionRef(backgrounds[1])] },
    { name: "Evening wind-down", refs: [sessionRef(backgrounds[0]), practiceRef(practices[1])] },
  ],
};

export function LibraryStarters({ section, onSaveMix, query = "" }: {
  section: StarterGroup;
  onSaveMix?: (session: Session) => boolean;
  query?: string;
}) {
  const [message, setMessage] = useState("");
  const playback = useSyncExternalStore(queuePlayer.subscribe, queuePlayer.snapshot);
  const rows = entries[section].filter(entry => entry.name.toLowerCase().includes(query.trim().toLowerCase()));
  if (!rows.length) return null;
  return (
    <section className="library-starters" aria-label="Starter collection">
      <h2>Built-in items</h2>
      {rows.map(entry => {
        const items = resolveItems(entry.refs, practices, [...backgrounds, ...mixes]);
        const length = durationLabel(items.reduce((total, item) => total + itemDuration(item), 0));
        const current = playback.name === entry.name && playback.items.length === items.length &&
          items.every((item, i) => item.id === playback.items[i].id);
        const playing = current && playback.status === "playing";
        const paused = current && playback.status === "paused";
        const verb = playing ? "Pause" : paused ? "Resume" : "Play";
        const { plan, session } = entry;
        return (
          <article className="library-starter" key={entry.name}>
            <div>
              <h3>{entry.name}</h3>
              <small>{plan ? "Silent practice · " : items.length > 1 ? items.length + " items · " : ""}{length}</small>
            </div>
            <div className="library-starter-actions">
              <button className="primary" aria-label={(verb === "Play" ? "Test play" : verb) + " " + entry.name} onClick={() => {
                setMessage("");
                if (playing) queuePlayer.pause();
                else {
                  const action = paused ? queuePlayer.resume() : startQueue(items, entry.name);
                  void action.catch(error => setMessage(error.message));
                }
              }}>
                {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />} {verb === "Play" ? "Test play" : verb}
              </button>
              {(plan || (session && onSaveMix)) && (
                <button aria-label={"Save a copy of " + entry.name} onClick={() => {
                  try {
                    if (plan) manifestationStore.addCopy(plan);
                    if (session && !onSaveMix?.(session)) return;
                    setMessage("Saved a copy of " + entry.name + ".");
                  } catch (error) {
                    setMessage((error as Error).message);
                  }
                }}><Plus size={16} aria-hidden="true" /> Save copy</button>
              )}
            </div>
          </article>
        );
      })}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
