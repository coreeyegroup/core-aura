import {prepareSound} from "../workbench/actions";
import { isNature } from "../nature/catalog";
import { useState } from "react";
import { Pause, Play, Square, Volume2, VolumeX } from "lucide-react";
import { Channel, sounds } from "../model";
import { engine, VoiceState } from "../audio/engine";
export function Transport({
  channels,
  states,
  onError,
  compact = false,
  stopChannels = channels,
  exclusive = false,
  allowMix = false,
  balancedGroup = false,
}: {
  channels: Channel[];
  states: VoiceState[];
  onError: (s: string) => void;
  compact?: boolean;
  stopChannels?: Channel[];
  exclusive?: boolean;
  allowMix?: boolean;
  balancedGroup?: boolean;
}) {
  const [busy,setBusy] = useState(false);
  const stoppable = stopChannels.some(c=>states.some(s=>s.id===c.id));
  const active = channels.some((c) => states.some((s) => s.id === c.id));
  const playing = (exclusive ? stopChannels : channels).some((c) =>
    states.some((s) => s.id === c.id && s.status === "playing"),
  );
  return (
    <div className={"transport" + (compact ? " compact-transport" : "")}>
      <button
        className="primary"
        onClick={async () => {
          if (busy) return;
          if(!playing&&!active&&!prepareSound(channels.map(c=>c.id),allowMix))return;
          setBusy(true);
          if (!playing && channels.length) {
            if (exclusive) stopChannels.filter(c=>!channels.some(target=>target.id===c.id)).forEach(c=>engine.stop(c.id));
            engine
              .snapshot()
              .filter(
                (state) =>
                  state.id.startsWith("pack:"),
              )
              .forEach((state) => engine.stop(state.id));
          }
          if (playing && exclusive) {
            stopChannels.forEach(c=>engine.pause(c.id));
            setBusy(false);
            return;
          }
          return (balancedGroup && !playing ? engine.playGroup(channels) : engine.toggle(channels))
            .catch(() =>
              onError(
                "Audio could not start. Check your connection or downloaded player and try again.",
              ),
            ).finally(()=>setBusy(false));
        }}
        disabled={busy || (!channels.length && !playing)}
        aria-label={playing ? "Pause" : active ? "Resume" : "Play"}
      >
        {playing ? <Pause size={20} /> : <Play size={20} />}{" "}
        <span className={compact ? "sr-only" : undefined}>
          {playing ? "Pause" : active ? "Resume" : "Play"}
        </span>
      </button>
      <button
        disabled={!stoppable}
        onClick={() => stopChannels.forEach((c) => engine.stop(c.id))}
      >
        <Square size={18} />{" "}
        <span className={compact ? "sr-only" : undefined}>Stop</span>
      </button>
    </div>
  );
}
export function ChannelEditor({
  value,
  onChange,
  states,
  onError,
  remove,
  title,
  showTransport = true,
  allowMix = false,
}: {
  value: Channel;
  onChange: (c: Channel) => void;
  states: VoiceState[];
  onError: (s: string) => void;
  remove?: () => void;
  title: string;
  showTransport?: boolean;
  allowMix?: boolean;
}) {
  const spec = sounds[value.sound];
  const state = states.find((s) => s.id === value.id);
  return (
    <article className="layer">
      <div className="layer-title">
        <strong>{title}</strong>
        <button
          className="icon-button"
          aria-label={value.muted ? "Unmute layer" : "Mute layer"}
          aria-pressed={value.muted}
          onClick={() => onChange({ ...value, muted: !value.muted })}
        >
          {value.muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>

        {remove && (
          <button className="text-button" onClick={remove}>
            Remove
          </button>
        )}
      </div>
      <div className="fields">
        <label>
          Sound
          <select
            value={value.sound}
            disabled={Boolean(state)}
            onChange={(e) => {
              const sound = e.target.value as Channel["sound"];
              const s = sounds[sound];
              onChange({
                ...value,
                sound,
                hz: Math.max(s.min, Math.min(s.max, value.hz)),
              });
            }}
          >
            {Object.entries(sounds).map(([id, s]) => (
              <option key={id} value={id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {isNature(value.sound) ? "Filter centre (Hz)" : ["yaman", "mohanam", "tanpura", "shruti"].includes(value.sound)
            ? "Tonic · Sa (Hz)"
            : value.sound === "bell" ||
                value.sound === "bowl" || value.sound === "chime" ||
                value.sound === "drum"
              ? "Resonance (Hz)"
              : "Frequency (Hz)"}
          <input
            type="number"
            inputMode="decimal"
            min={spec.min}
            max={spec.max}
            step="0.01"
            disabled={isNature(value.sound) && !value.focus}
            value={value.hz}
            onChange={(e) => {
              const hz = e.target.valueAsNumber;
              if (Number.isFinite(hz)) onChange({ ...value, hz });
            }}
            onBlur={() =>
              onChange({
                ...value,
                hz: Math.max(spec.min, Math.min(spec.max, value.hz)),
              })
            }
          />
        </label>
      </div>
      {isNature(value.sound) && <>
        <label className="check"><input type="checkbox" checked={value.focus ?? false} onChange={e=>onChange({...value,focus:e.target.checked})}/> Enable frequency focus</label>
        <label className="range-label">Texture intensity <output>{Math.round((value.intensity ?? .5)*100)}%</output><input type="range" min="0" max="100" value={(value.intensity ?? .5)*100} onChange={e=>onChange({...value,intensity:Number(e.target.value)/100})}/></label>
        <p className="content-note">The Hz value controls a filter when frequency focus is enabled. Add a pure-tone layer for a separate exact frequency.</p>
      </>}
      <label className="range-label">
        Volume <output>{Math.round(value.volume * 100)}%</output>
        <input
          type="range"
          min="0"
          max="100"
          value={Math.round(value.volume * 100)}
          onChange={(e) =>
            onChange({ ...value, volume: Number(e.target.value) / 100 })
          }
        />
      </label>
      {showTransport && (
        <div className="layer-actions">
          <Transport allowMix={allowMix} channels={[value]} states={states} onError={onError} />
        </div>
      )}
    </article>
  );
}
