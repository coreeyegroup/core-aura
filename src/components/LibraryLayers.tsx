import { SlidersHorizontal } from "lucide-react";
import { sounds, type Accompaniment, type GeneratedLayer, type Sound } from "../model";
import { isNature } from "../nature/catalog";
import { trackCollection, type Track, type TrackCollection } from "../tracks/storage";

export const rawSounds = (Object.keys(sounds) as Sound[]).filter(id => !isNature(id));
const ambientSounds = (Object.keys(sounds) as Sound[]).filter(isNature);
const sources: { key: TrackCollection; label: string }[] = [
  { key: "audio", label: "Audio" },
  { key: "sounds", label: "Imported sounds" },
  { key: "backgrounds", label: "Imported backgrounds" },
];

export function FrequencyField({ value, sound, label, disabled, onChange }: {
  value: number; sound: Sound; label: string; disabled: boolean; onChange: (value: number) => void;
}) {
  const { min, max } = sounds[sound];
  return <label>{label}
    <input key={sound + ":" + value} aria-label={label} type="number" inputMode="decimal" step="any"
      min={min} max={max} defaultValue={value} disabled={disabled} onBlur={event => {
        const next = event.currentTarget.valueAsNumber;
        if (Number.isFinite(next) && next >= min && next <= max) onChange(next);
        else event.currentTarget.value = String(value);
      }} />
  </label>;
}

export function LibraryLayers({ value = {}, tracks, disabled, prefix, onChange }: {
  value?: Accompaniment; tracks: Track[]; disabled: boolean; prefix: string;
  onChange: (value: Accompaniment) => void;
}) {
  function editSource(key: "tone" | "ambience", patch: Partial<GeneratedLayer>) {
    const source = value[key];
    if (source) onChange({ ...value, [key]: { ...source, ...patch } });
  }

  return <details className="library-mix-settings">
    <summary><SlidersHorizontal size={16} aria-hidden="true" /> Library layers</summary>
    <fieldset disabled={disabled} className="fields">
      {(["tone", "ambience"] as const).map(key => {
        const ambient = key === "ambience";
        const source = value[key];
        const label = ambient ? "background sound" : "extra sound";
        return <div className="library-layer-field" key={key}>
          <label>{ambient ? "Background sound" : "Extra sound"}
            <select aria-label={prefix + " " + label} value={source?.sound ?? ""} onChange={event => {
              const id = event.target.value as Sound;
              if (!id) { onChange({ ...value, [key]: undefined }); return; }
              const { min, max } = sounds[id];
              onChange({ ...value, [key]: { sound: id,
                hz: Math.min(max, Math.max(min, source?.hz ?? (ambient ? 1000 : 432))), volume: source?.volume ?? .2 } });
            }}>
              <option value="">None</option>
              {(ambient ? ambientSounds : rawSounds).map(id => <option value={id} key={id}>{sounds[id].name}</option>)}
            </select>
          </label>
          {source && <>
            <FrequencyField label={prefix + (ambient ? " background filter (Hz)" : " extra sound frequency (Hz)")}
              disabled={disabled} sound={source.sound} value={source.hz} onChange={hz => editSource(key, { hz })} />
            <label>Level <output>{Math.round(source.volume * 100)}%</output>
              <input aria-label={prefix + " " + label + " level"} type="range" min={0} max={100}
                value={Math.round(source.volume * 100)} onChange={event => editSource(key, { volume: Number(event.target.value) / 100 })} />
            </label>
          </>}
        </div>;
      })}
      <div className="library-layer-field">
        <label>Audio file
          <select aria-label={prefix + " audio file"} value={value.audio?.id ?? ""} onChange={event => {
            const id = event.target.value;
            onChange({ ...value, audio: id ? { id, volume: value.audio?.volume ?? .35, loop: value.audio?.loop ?? true } : undefined });
          }}>
            <option value="">None</option>
            {value.audio && !tracks.some(track => track.id === value.audio?.id) && (
              <option value={value.audio.id} disabled>File unavailable on this device</option>
            )}
            {sources.map(({ key, label }) => {
              const matches = tracks.filter(track => trackCollection(track) === key);
              return matches.length ? <optgroup key={key} label={label}>
                {matches.map(track => <option key={track.id} value={track.id}>{track.title}</option>)}
              </optgroup> : null;
            })}
          </select>
        </label>
        {value.audio && <>
          <label>Audio level <output>{Math.round(value.audio.volume * 100)}%</output>
            <input aria-label={prefix + " audio level"} type="range" min={0} max={100}
              value={Math.round(value.audio.volume * 100)} onChange={event => onChange({ ...value,
                audio: { ...value.audio!, volume: Number(event.target.value) / 100 } })} />
          </label>
          <label className="check"><input type="checkbox" checked={value.audio.loop} onChange={event => onChange({
            ...value, audio: { ...value.audio!, loop: event.target.checked },
          })} /> Loop audio</label>
        </>}
      </div>
    </fieldset>
  </details>;
}
