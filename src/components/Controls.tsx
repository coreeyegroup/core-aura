import { Pause, Play, Square, Volume2, VolumeX } from "lucide-react";
import { Channel, sounds } from "../model";
import { engine, VoiceState } from "../audio/engine";
export function Transport({
  channels,
  states,
  onError,
}: {
  channels: Channel[];
  states: VoiceState[];
  onError: (s: string) => void;
}) {
  const active = channels.some((c) => states.some((s) => s.id === c.id));
  const playing = channels.some((c) =>
    states.some((s) => s.id === c.id && s.status === "playing"),
  );
  return (
    <div className="transport">
      <button
        className="primary"
        onClick={() =>
          engine
            .toggle(channels)
            .catch(() =>
              onError(
                "Audio could not start. Check your connection or downloaded player and try again.",
              ),
            )
        }
        disabled={!channels.length}
        aria-label={playing ? "Pause" : active ? "Resume" : "Play"}
      >
        {playing ? <Pause size={20} /> : <Play size={20} />}{" "}
        {playing ? "Pause" : active ? "Resume" : "Play"}
      </button>
      <button
        disabled={!active}
        onClick={() => channels.forEach((c) => engine.stop(c.id))}
      >
        <Square size={18} /> Stop
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
}: {
  value: Channel;
  onChange: (c: Channel) => void;
  states: VoiceState[];
  onError: (s: string) => void;
  remove?: () => void;
}) {
  const spec = sounds[value.sound];
  const state = states.find((s) => s.id === value.id);
  return (
    <article className="layer">
      <div className="layer-title">
        <strong>{spec.name}</strong>
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
          {["yaman", "mohanam", "tanpura"].includes(value.sound)
            ? "Tonic · Sa (Hz)"
            : value.sound === "bell" ||
                value.sound === "bowl" ||
                value.sound === "drum"
              ? "Resonance (Hz)"
              : "Frequency (Hz)"}
          <input
            type="number"
            inputMode="decimal"
            min={spec.min}
            max={spec.max}
            step="0.01"
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
      <div className="layer-actions">
        <button
          className="icon-button"
          aria-label={value.muted ? "Unmute layer" : "Mute layer"}
          aria-pressed={value.muted}
          onClick={() => onChange({ ...value, muted: !value.muted })}
        >
          {value.muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
        <Transport channels={[value]} states={states} onError={onError} />
      </div>
    </article>
  );
}
