import { ChevronDown, ChevronUp, Pause, Play, Square } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Channel, chakras } from "../model";
import { chakraSequence, orderChakras } from "./sequence";

function durationLabel(seconds: number) {
  return seconds % 60 === 0 ? seconds / 60 + " min" : seconds + " sec";
}

export function SequenceTransport() {
  const sequence = useSyncExternalStore(chakraSequence.subscribe, chakraSequence.snapshot);
  const playing = sequence.status === "playing";
  const name = chakras.find(chakra => chakra.id === sequence.channels[sequence.index]?.id)?.name;
  return <>
    <p className="dock-caption">{name} · {sequence.index + 1}/{sequence.channels.length} · {Math.round(sequence.elapsed)} / {sequence.seconds} sec</p>
    <div className="transport">
      <button className="primary" onClick={() => playing ? chakraSequence.pause() : chakraSequence.resume()}>
        {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
        {playing ? "Pause sequence" : "Resume sequence"}
      </button>
      <button onClick={() => chakraSequence.stop()}><Square size={14} aria-hidden="true" /> Stop sequence</button>
    </div>
  </>;
}

export function SequenceSetup({ channels, disabled, onError }: {
  channels: Channel[];
  disabled: boolean;
  onError: (message: string) => void;
}) {
  const { seconds, gap, order } = useSyncExternalStore(chakraSequence.subscribe, chakraSequence.snapshot);
  const ordered = orderChakras(channels, order);
  function configure(patch: Parameters<typeof chakraSequence.configure>[0]) {
    try { chakraSequence.configure(patch); }
    catch (error) { onError((error as Error).message); }
  }
  function move(index: number, offset: number) {
    const ids = ordered.map(channel => channel.id);
    [ids[index], ids[index + offset]] = [ids[index + offset], ids[index]];
    configure({ order: ids });
  }
  return <div className="chakra-sequence-settings">
    <div className="fields">
      <label>Time per chakra
        <select aria-label="Sequence chakra duration" disabled={disabled} value={seconds}
          onChange={event => configure({ seconds: Number(event.target.value) })}>
          {[...new Set([1, 15, 30, 60, 120, 300, 600, seconds])].sort((a, b) => a - b)
            .map(value => <option key={value} value={value}>{durationLabel(value)}</option>)}
        </select>
      </label>
      <label>Gap between chakras
        <select aria-label="Transition gap" disabled={disabled} value={gap}
          onChange={event => configure({ gap: Number(event.target.value) })}>
          {[...new Set([0, 1, 2, 5, 10, 30, gap])].sort((a, b) => a - b)
            .map(value => <option key={value} value={value}>{value ? durationLabel(value) : "No gap"}</option>)}
        </select>
      </label>
    </div>
    {ordered.length > 1 && <details className="chakra-order">
      <summary>Sequence order</summary>
      <ol>{ordered.map((channel, index) => {
        const name = chakras.find(chakra => chakra.id === channel.id)?.name ?? channel.id;
        return <li key={channel.id}>
          <span>{index + 1}. {name}</span>
          <button type="button" className="icon-button" aria-label={"Move " + name + " up"}
            disabled={disabled || index === 0} onClick={() => move(index, -1)}><ChevronUp size={17} aria-hidden="true" /></button>
          <button type="button" className="icon-button" aria-label={"Move " + name + " down"}
            disabled={disabled || index === ordered.length - 1} onClick={() => move(index, 1)}><ChevronDown size={17} aria-hidden="true" /></button>
        </li>;
      })}</ol>
    </details>}
  </div>;
}
