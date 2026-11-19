import { useState } from "react";
import { Play, Plus } from "lucide-react";
import { affirmations, type Category, type Plan } from "../manifestation/model";
import { manifestationStore } from "../manifestation/store";
import { chakras, ENGINE_VERSION, type Channel, type Session } from "../model";
import { durationLabel, itemDuration, resolveItems, type PlaylistRef } from "../playlists/model";
import { startQueue } from "../playlists/runtime";

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
const entries = {
  practices: practices.map(plan => ({ name: plan.name, refs: [practiceRef(plan)], plan })),
  backgrounds: backgrounds.map(session => ({ name: session.name, refs: [sessionRef(session)], session })),
  mixes: mixes.map(session => ({ name: session.name, refs: [sessionRef(session)], session })),
  playlists: [
    { name: "Morning pause", refs: [practiceRef(practices[0]), sessionRef(backgrounds[1])] },
    { name: "Evening wind-down", refs: [sessionRef(backgrounds[0]), practiceRef(practices[1])] },
  ],
} satisfies Record<string, { name: string; refs: PlaylistRef[]; plan?: Plan; session?: Session }[]>;

export function LibraryStarters({ section, onSaveMix }: {
  section: keyof typeof entries;
  onSaveMix?: (session: Session) => boolean;
}) {
  const [message, setMessage] = useState("");
  return (
    <section className="library-starters" aria-label="Starter collection">
      <h2>Included with Core-aura</h2>
      {entries[section].map(entry => {
        const items = resolveItems(entry.refs, practices, [...backgrounds, ...mixes]);
        const length = durationLabel(items.reduce((total, item) => total + itemDuration(item), 0));
        const plan = "plan" in entry ? entry.plan : undefined;
        const session = "session" in entry ? entry.session : undefined;
        return (
          <article className="library-starter" key={entry.name}>
            <div>
              <h3>{entry.name}</h3>
              <small>{plan ? "Silent practice · " : items.length > 1 ? "2 items · " : ""}{length}</small>
            </div>
            <div className="library-starter-actions">
              <button className="primary" aria-label={"Play " + entry.name} onClick={() => {
                setMessage("");
                void startQueue(items, entry.name).catch(error => setMessage(error.message));
              }}><Play size={16} aria-hidden="true" /> Play</button>
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
            {items.length > 1 && <small className="library-starter-order">{items.map(item => item.name).join(" → ")}</small>}
          </article>
        );
      })}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
