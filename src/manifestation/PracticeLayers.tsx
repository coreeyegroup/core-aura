import { ChevronDown, Play, Plus, Square } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { LibraryLayers, type LayerKind } from "../components/LibraryLayers";
import { sounds, type Accompaniment, type Session } from "../model";
import type { Track } from "../tracks/storage";
import { attachMix } from "./background";
import { BackgroundControls } from "./BackgroundControls";
import { newPlan, practiceLayerLimit, type Plan } from "./model";
import { manifestPlayer } from "./player";

const layerKinds = [
  { key: "tone", action: "Add sound", name: "Sound", label: "Sound layer" },
  { key: "ambience", action: "Add background", name: "Background", label: "Background layer" },
  { key: "audio", action: "Add audio", name: "Audio", label: "Audio layer" },
] as const;

const percent = (volume: number) => Math.round(volume * 100) + "%";
const previewPrefix = "preview-practice-layer-";

export function PracticeLayers({ plan, sessions, tracks, active, queueActive, onAudioLibrary, onChange, onBackgroundChange }: {
  plan: Plan;
  sessions: Session[];
  tracks: Track[];
  active: boolean;
  queueActive: boolean;
  onAudioLibrary: () => void;
  onChange: (patch: Partial<Plan>) => boolean;
  onBackgroundChange: (patch: Partial<Plan>) => void | boolean;
}) {
  const [picker, setPicker] = useState<LayerKind | "mix">();
  const [pending, setPending] = useState<Accompaniment>({});
  const [mixId, setMixId] = useState("");
  const availableMixes = sessions.filter(session => session.channels.length <= 8);
  const panel = useRef<HTMLElement>(null);
  const pickerPanel = useRef<HTMLDivElement>(null);
  const addButtons = useRef<Partial<Record<LayerKind | "mix", HTMLButtonElement>>>({});
  const lastAdded = useRef<number | null>(null);
  const state = useSyncExternalStore(manifestPlayer.subscribe, manifestPlayer.snapshot);
  const layers = plan.additionalLayers ?? [];
  const canAdd = !active && layers.length < practiceLayerLimit;

  useEffect(() => {
    if (picker && (picker === "mix" ? !active : canAdd)) pickerPanel.current?.querySelector("select")?.focus();
  }, [picker, canAdd, active]);

  useEffect(() => {
    if (lastAdded.current === null) return;
    panel.current?.querySelector<HTMLButtonElement>(
      '[data-layer-preview="' + lastAdded.current + '"]',
    )?.focus();
    lastAdded.current = null;
  }, [layers.length]);

  useEffect(() => () => {
    if (manifestPlayer.snapshot().plan?.id.startsWith(previewPrefix)) manifestPlayer.endPreview();
  }, []);

  function closePicker() {
    stopPreview("pending");
    if (picker) addButtons.current[picker]?.focus();
    setPicker(undefined);
  }

  function togglePicker(kind: LayerKind | "mix") {
    if (picker === kind) { closePicker(); return; }
    stopPreview("pending");
    setPending({});
    setMixId("");
    setPicker(kind);
  }

  function stopPreview(id: string) {
    if (manifestPlayer.snapshot().plan?.id === previewPrefix + id) manifestPlayer.endPreview();
  }

  function previewButton(id: string, description: string, patch: Partial<Plan>, unavailable = false) {
    const selected = state.plan?.id === previewPrefix + id;
    const playing = selected && (state.status === "playing" || state.status === "paused") && !state.error;
    const label = (playing ? "Stop preview: " : "Test play: ") + description;
    return <button type="button" className="icon-button practice-layer-preview" aria-label={label}
      title={label} data-layer-preview={id} disabled={active || queueActive || unavailable}
      onClick={() => {
        if (playing) { stopPreview(id); return; }
        manifestPlayer.preview({
          ...newPlan(), ...patch, id: previewPrefix + id,
          name: description.slice(0, 80), seconds: 60, mode: "read",
        });
      }}>
      {playing ? <Square size={14} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
    </button>;
  }

  function layerRow(id: string, prefix: string, layer: Accompaniment, kind: LayerKind,
    update: (next: Accompaniment) => boolean, remove: () => void) {
    const source = layer[kind];
    if (!source) return null;
    const title = layerKinds.find(item => item.key === kind)!.label;
    const track = layer.audio && tracks.find(item => item.id === layer.audio?.id);
    const name = "sound" in source ? sounds[source.sound].name : track?.title ?? "Audio unavailable";
    const tuning = "hz" in source ? source.hz + " Hz" + (kind === "ambience" ? " filter" : "") + " · " : "";
    return <div className="practice-layer" key={id}>
      <details>
        <summary>
          <ChevronDown size={15} aria-hidden="true" />
          <span className="practice-layer-copy"><strong>{name}</strong><small>{tuning}{percent(source.volume)} · {title}</small></span>
        </summary>
        <LibraryLayers inline only={kind} prefix={prefix} tracks={tracks} value={layer} disabled={active}
          onRemove={remove} onChange={next => {
            if (!next[kind]) { remove(); return; }
            if (!update(next)) return false;
            stopPreview(id);
          }}
          onSourceChange={select => {
            const details = select.closest("details");
            if (!details) return;
            details.open = false;
            details.querySelector("summary")?.focus();
          }} />
      </details>
      {previewButton(id, name, { accompaniment: { [kind]: source } }, kind === "audio" && !track)}
    </div>;
  }

  const selectedMix = availableMixes.find(mix => mix.id === mixId);
  const selectedTone = (["sine", "bowl", "tanpura"] as const).find(sound => "tone:" + sound === mixId);
  const selectedBackground = selectedMix ? { background: null, backgroundMix: attachMix(selectedMix) } :
    selectedTone ? { backgroundMix: null, background: { sound: selectedTone, hz: selectedTone === "tanpura" ? 216 : 432, volume: .12 } } : undefined;
  const selectedBackgroundName = selectedMix?.name ?? (selectedTone ? sounds[selectedTone].name : "");
  const savedBackground = plan.backgroundMix ?? plan.background;
  const backgroundName = plan.backgroundMix?.name ?? (plan.background && sounds[plan.background.sound].name);
  const backgroundFrequency = plan.background ? " · " + plan.background.hz + " Hz" : "";
  return <section ref={panel} className="practice-step practice-layers" aria-labelledby="practice-layers-heading">
    <h2 id="practice-layers-heading">3. Audio, sounds and backgrounds</h2>
    <div className="home-actions practice-layer-actions">
      {layerKinds.map(({ key, action, name }) => <button key={key} type="button"
        ref={node => { if (node) addButtons.current[key] = node; }}
        disabled={!canAdd}
        aria-label={action} aria-expanded={picker === key && canAdd} aria-controls="practice-layer-picker"
        onClick={() => togglePicker(key)}>
        <Plus size={15} aria-hidden="true" /> {name}
      </button>)}
      {!savedBackground && <button type="button" ref={node => { if (node) addButtons.current.mix = node; }}
        disabled={active} aria-expanded={picker === "mix"} aria-controls="practice-layer-picker"
        onClick={() => togglePicker("mix")}><Plus size={15} aria-hidden="true" /> Saved mix</button>}
    </div>
    <div id="practice-layer-picker" ref={pickerPanel} hidden={!picker || active || (picker !== "mix" && !canAdd)}>
      {picker === "mix" && !active && <>
        <label>Saved mix or tone
          <select value={mixId} onChange={event => { stopPreview("pending"); setMixId(event.target.value); }}>
            <option value="">Choose a mix</option>
            {availableMixes.length > 0 && <optgroup label="Saved mixes">
              {availableMixes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </optgroup>}
            <optgroup label="Tones">
              <option value="tone:sine">Pure tone</option><option value="tone:bowl">Singing bowl</option>
              <option value="tone:tanpura">Tanpura drone</option>
            </optgroup>
          </select>
        </label>
        {!availableMixes.length && <p className="content-note">Save a mix in Sounds to add it here.</p>}
        <div className="home-actions">
          {selectedBackground && <>
            {previewButton("pending", selectedBackgroundName, selectedBackground)}
            <button type="button" className="primary" onClick={() => {
              if (onChange(selectedBackground)) closePicker();
            }}>{selectedMix ? "Add mix" : "Add tone"}</button>
          </>}
          <button type="button" onClick={closePicker}>Cancel</button>
        </div>
      </>}
      {picker && picker !== "mix" && canAdd && <>
        {picker === "audio" && !tracks.length ? <p className="content-note">Import audio in Library to add a recording or track.</p> :
          <LibraryLayers key={picker} inline only={picker} prefix="New layer" tracks={tracks} value={pending}
            disabled={active} onChange={next => { stopPreview("pending"); setPending(next); }} />}
        <div className="home-actions">
          {picker === "audio" && <button type="button" onClick={() => { closePicker(); onAudioLibrary(); }}>Import audio</button>}
          <button type="button" onClick={closePicker}>Cancel</button>
          {pending[picker] && <>
            {previewButton("pending", "new layer", { accompaniment: pending })}
            <button type="button" className="primary" onClick={() => {
              if (!onChange({ additionalLayers: [...layers, pending] })) return;
              lastAdded.current = layers.length;
              closePicker();
            }}>Add layer</button>
          </>}
        </div>
      </>}
    </div>
    {layerKinds.map(({ key }) => {
      const source = plan.accompaniment?.[key];
      if (!source) return null;
      const id = "attached-" + key;
      const update = (next: Accompaniment) => onChange({ accompaniment: { ...plan.accompaniment, [key]: next[key] } });
      return layerRow(id, "Attached layer", { [key]: source }, key, update, () => {
        if (update({})) stopPreview(id);
      });
    })}
    {layers.map((layer, index) => {
      const id = String(index);
      const kind = layer.tone ? "tone" : layer.ambience ? "ambience" : "audio";
      return layerRow(id, "Layer " + (index + 1), layer, kind,
        next => onChange({ additionalLayers: layers.map((original, i) => i === index ? { ...original, [kind]: next[kind] } : original) }),
        () => {
          if (onChange({ additionalLayers: layers.filter((_, i) => i !== index) }) &&
              manifestPlayer.snapshot().plan?.id.startsWith(previewPrefix)) manifestPlayer.endPreview();
        });
    })}
    {savedBackground && <div className="practice-layer">
      <BackgroundControls plan={plan} sessions={sessions} active={active} onChange={patch => {
        stopPreview("mix");
        return onBackgroundChange(patch);
      }} summary={<span className="practice-layer-copy"><strong>{backgroundName}</strong><small>Background layer{backgroundFrequency} · {percent(savedBackground.volume)}{plan.backgroundMuted ? " · Muted" : ""}</small></span>} />
      {savedBackground && backgroundName && previewButton("mix", backgroundName, {
        background: plan.background, backgroundMix: plan.backgroundMix, backgroundMuted: plan.backgroundMuted,
      })}
    </div>}
    {state.plan?.id.startsWith(previewPrefix) && state.error && <p role="status">{state.error}</p>}
  </section>;
}
