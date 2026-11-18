import type { Track } from "../tracks/storage";
import { ReactNode, useEffect, useState, useSyncExternalStore } from "react";
import {
  ArrowDownRight, ArrowRight, AudioLines, BookOpen, Clock3,
  Flower2, Heart, ListMusic, Play, Plus,
} from "lucide-react";
import { Session, sessionDuration } from "../model";
import { manifestationStore as store } from "../manifestation/store";
import { nextOccurrence } from "../manifestation/model";
import { ItemRef, ModuleId, preferences } from "./preferences";
import { playlistStore } from "../playlists/store";
import { durationLabel, PlaylistRef, resolveItems } from "../playlists/model";
import { queuePlayer, startQueue } from "../playlists/runtime";

type Props = {
  sessions: Session[];
  tracks: Track[];
  onPractice: (id: string) => unknown;
  onSession: (session: Session) => void;
  onOpen: (page: "manifest" | "studio" | "chakras" | "schedule" | "library") => void;
  tools: ReactNode;
};

const sections = {
  manifest: { title: "Manifestation", icon: BookOpen },
  sound: { title: "Sound mixes", icon: AudioLines },
  chakra: { title: "Chakra sessions", icon: Flower2 },
  schedule: { title: "Next session", icon: Clock3 },
  pinned: { title: "Favorites & recent", icon: Heart },
  tools: { title: "Practice tools", icon: ArrowDownRight },
};

type SavedChoice = {
  id: string;
  name: string;
  detail: string;
};

function SavedPicker({ id, name, choices, selectedId, onSelect, onPlay, onEdit }: {
  id: string;
  name: string;
  choices: SavedChoice[];
  selectedId: string;
  onSelect: (id: string) => void;
  onPlay: (choice: SavedChoice) => void;
  onEdit: (choice?: SavedChoice) => void;
}) {
  const choice = choices.find((item) => item.id === selectedId) ?? choices[0];
  if (!choice) {
    return (
      <div className="home-section-meta home-empty">
        <small>Nothing saved yet</small>
        <button className="text-button" onClick={() => onEdit()}>
          <Plus size={15} aria-hidden="true" /> Create
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="home-select-play">
        <select id={"home-" + id} aria-label={"Home " + name} value={choice.id}
          onChange={(event) => onSelect(event.target.value)}>
          {choices.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <button className="primary" aria-label={"Play selected " + name}
          onClick={() => onPlay(choice)}>
          <Play size={15} aria-hidden="true" /> Play
        </button>
      </div>
      <div className="home-section-meta">
        <small>{choice.detail}</small>
        <button className="text-button" onClick={() => onEdit(choice)}>
          Open section <ArrowRight size={14} aria-hidden="true" />
        </button>
      </div>
    </>
  );
}

export function HomeControls({ sessions, tracks, onPractice, onSession, onOpen, tools }: Props) {
  const { data } = useSyncExternalStore(store.subscribe, store.snapshot);
  const { data: lists, error: listError } = useSyncExternalStore(playlistStore.subscribe, playlistStore.snapshot);
  const { value: prefs, error } = useSyncExternalStore(preferences.subscribe, preferences.snapshot);
  const queue = useSyncExternalStore(queuePlayer.subscribe, queuePlayer.snapshot);
  const [practiceId, setPracticeId] = useState("");
  const [soundId, setSoundId] = useState("");
  const [chakraId, setChakraId] = useState("");
  const [playlistId, setPlaylistId] = useState("");
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const playlist = lists.playlists.find((item) => item.id === playlistId) ?? lists.playlists[0];
  const itemFor = (ref: PlaylistRef) => ref.kind === "track"
    ? tracks.find(track => track.id === ref.id)
    : ref.kind === "practice"
    ? data.plans.find((plan) => plan.id === ref.id)
    : sessions.find((session) => session.id === ref.id);
  const playlistEntries = playlist?.items.map(itemFor);
  const missingItems = playlistEntries?.some((item) => !item) ?? false;
  const upcoming = data.reminders
    .map((reminder) => ({ reminder, date: nextOccurrence(reminder, now) }))
    .filter((entry) => entry.date)
    .sort((a, b) => +a.date! - +b.date!)[0];
  const nextPractice = upcoming && data.plans.find((plan) => plan.id === upcoming.reminder.planId);
  const active = queue.status === "playing" || queue.status === "paused";
  const replayItem = queue.items[queue.index]?.name || queue.name;

  async function attempt(action: () => unknown) {
    setMessage("");
    try {
      await action();
    } catch (failure) {
      setMessage(failure instanceof Error ? failure.message : String(failure));
    }
  }

  function play(refs: PlaylistRef[], name: string) {
    return attempt(() => startQueue(resolveItems(refs, data.plans, sessions, tracks), name));
  }

  const mixChoices = (kind: "sound" | "chakra") => sessions
    .filter((session) => (session.kind === "chakras") === (kind === "chakra"))
    .map((session) => {
      const count = session.channels.length;
      const unit = kind === "sound" ? (count === 1 ? "layer" : "layers") : (count === 1 ? "chakra" : "chakras");
      return { id: session.id, name: session.name, detail: `${count} ${unit} · ${durationLabel(sessionDuration(session))}` };
    });

  const modules: Record<ModuleId, ReactNode> = {
    manifest: (
      <SavedPicker id="manifest" name="manifestation" selectedId={practiceId} onSelect={setPracticeId}
        choices={data.plans.map((plan) => ({
          id: plan.id,
          name: plan.name,
          detail: `${plan.lines.length} ${plan.lines.length === 1 ? "sentence" : "sentences"} · ${plan.repeats}× · ≤${durationLabel(plan.seconds)}`,
        }))}
        onPlay={(choice) => void play([{ kind: "practice", id: choice.id }], choice.name)}
        onEdit={(choice) => choice ? onPractice(choice.id) : onOpen("manifest")} />
    ),
    sound: (
      <SavedPicker id="sound" name="sound mix" selectedId={soundId} onSelect={setSoundId}
        choices={mixChoices("sound")}
        onPlay={(choice) => void play([{ kind: "session", id: choice.id }], choice.name)}
        onEdit={(choice) => {
          const session = sessions.find(item => item.id === choice?.id);
          if (session) onSession(session); else onOpen("studio");
        }} />
    ),
    chakra: (
      <SavedPicker id="chakra" name="chakra session" selectedId={chakraId} onSelect={setChakraId}
        choices={mixChoices("chakra")}
        onPlay={(choice) => void play([{ kind: "session", id: choice.id }], choice.name)}
        onEdit={(choice) => {
          const session = sessions.find(item => item.id === choice?.id);
          if (session) onSession(session); else onOpen("chakras");
        }} />
    ),
    schedule: upcoming ? (
      <div className="home-list-row">
        <div>
          <strong>{nextPractice?.name || "Unavailable practice"}</strong>
          <small>{upcoming.date!.toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" })}</small>
        </div>
        <button className="icon-button" aria-label="Play next scheduled practice" disabled={!nextPractice}
          onClick={() => nextPractice && play([{ kind: "practice", id: nextPractice.id }], nextPractice.name)}>
          <Play size={16} aria-hidden="true" />
        </button>
        <button className="text-button" onClick={() => onOpen("schedule")}>Schedule</button>
      </div>
    ) : (
      <div className="home-section-meta home-empty">
        <small>No upcoming session</small>
        <button className="text-button" onClick={() => onOpen("schedule")}>Set schedule</button>
      </div>
    ),
    pinned: (
      <div className="home-shortcut-groups">
        {([{ name: "Favorites", key: "pins" }, { name: "Recently played", key: "recent" }] as const).map((group) => (
          <div className="home-shortcuts" key={group.key}>
            <h3>{group.name}</h3>
            {!prefs[group.key].length && <p>No {group.key === "pins" ? "favorites" : "playback history"} yet</p>}
            {prefs[group.key].slice(0, 4).map((ref) => {
              const item = itemFor(ref) as Session | typeof data.plans[number] | undefined;
              return (
                <div className="home-list-row" key={ref.kind + ref.id}>
                  <div>
                    <strong>{item?.name || "Unavailable item"}</strong>
                    <small>{ref.kind === "practice" ? "Manifestation" : (item as Session)?.kind === "chakras" ? "Chakra" : "Sound"}</small>
                  </div>
                  {item ? (
                    <button className="icon-button" aria-label={"Play " + group.name.toLowerCase() + " " + item.name}
                      onClick={() => void play([ref], item.name)}>
                      <Play size={16} aria-hidden="true" />
                    </button>
                  ) : (
                    <button className="text-button" onClick={() => void attempt(() => preferences.update({
                      [group.key]: prefs[group.key].filter((row) => row.id !== ref.id || row.kind !== ref.kind),
                    }))}>Remove</button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    ),
    tools,
  };

  return (
    <div className="home-listening">
      <section className="home-playlists" aria-label="Home playlists">
        <div className="home-playlist-intro">
          <div className="home-feature-mark"><ListMusic size={21} aria-hidden="true" /></div>
          <div>
            <h2>Playlists</h2>
            <p>{playlist ? `${playlist.items.length} ${playlist.items.length === 1 ? "item" : "items"} · Plays in order`
              : "Combine saved practices and sounds into a routine."}</p>
          </div>
        </div>
        <div className="home-playlist-actions">
          {playlist ? (
            <>
              <div className="home-select-play">
                <select aria-label="Home playlist" value={playlist.id} onChange={(event) => setPlaylistId(event.target.value)}>
                  {lists.playlists.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <button className="primary" disabled={missingItems} aria-label="Play selected playlist"
                  onClick={() => void play(playlist.items, playlist.name)}>
                  <Play size={16} aria-hidden="true" /> Play
                </button>
              </div>
              {missingItems && <p className="home-playlist-warning">Remove or replace unavailable items in Library.</p>}
              <div className="home-playlist-footer">
                <details className="home-playlist-preview">
                  <summary>View playlist</summary>
                  <ol>{playlistEntries?.map((item, index) => <li key={index}>{(item && ("title" in item ? item.title : item.name)) || "Unavailable item"}</li>)}</ol>
                </details>
                <button className="text-button" onClick={() => onOpen("library")}>
                  Manage <ArrowRight size={14} aria-hidden="true" />
                </button>
              </div>
            </>
          ) : (
            <button className="primary home-create-playlist" onClick={() => onOpen("library")}>
              Open playlist library <ArrowRight size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </section>

      {!active && queue.items.length > 0 && (
        <section className="home-continue" aria-label="Continue listening">
          <div><small>Last played</small><strong>{replayItem}</strong></div>
          <button className="text-button" onClick={() => void attempt(() => startQueue(queue.items, queue.name))}>
            <Play size={16} aria-hidden="true" /> Play again
          </button>
        </section>
      )}

      <section className="home-saved" aria-label="Practice and shortcuts">
        {prefs.order.map((id) => {
          const { icon: Icon, title } = sections[id];
          const collapsed = prefs.collapsed.includes(id);
          return (
            <details key={id} className="home-working-module home-play-section" data-module={id}
              open={!collapsed} onToggle={(event) => {
                const closed = !event.currentTarget.open;
                if (closed !== collapsed) {
                  void attempt(() => preferences.update({
                    collapsed: closed ? [...prefs.collapsed, id] : prefs.collapsed.filter((entry) => entry !== id),
                  }));
                }
              }}>
              <summary>
                <span className="home-module-icon"><Icon size={17} aria-hidden="true" /></span>
                <span>{title}</span>
              </summary>
              <div className="home-module-content">{modules[id]}</div>
            </details>
          );
        })}
      </section>
      {(message || error || listError) && <p className="notice" role="status">{message || error || listError}</p>}
    </div>
  );
}
