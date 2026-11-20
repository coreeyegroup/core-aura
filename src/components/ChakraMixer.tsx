import {prepareSound} from "../workbench/actions";
import {SequenceSetup} from "../workbench/SequenceControls";
import { useEffect, useState, type CSSProperties } from "react";
import { Volume2, VolumeX, SlidersHorizontal } from "lucide-react";
import { Channel, chakras, chakraSounds, Sound, sounds } from "../model";
import { engine, VoiceState } from "../audio/engine";
import { LibraryLayers, FrequencyField, rawSounds } from "./LibraryLayers";
import type { Track } from "../tracks/storage";
import { Transport } from "./Controls";

const clock = (n: number) => Math.floor(Math.max(0,n)/60)+":"+String(Math.floor(Math.max(0,n)%60)).padStart(2,"0");
export function ChakraMixer({ channels, states, selected, target, seconds, master, tracks = [], focusId, onSelect, onTarget, onSeconds, onMaster, onChange, onError }: {
  tracks?: Track[]; focusId?: string;
  channels: Channel[]; states: VoiceState[]; selected: string[]; target: "all"|"selected"; seconds: number; master: number;
  onSelect: (ids: string[])=>void; onTarget: (mode:"all"|"selected")=>void;
  onSeconds:(value:number)=>void; onMaster:(value:number)=>void; onChange:(value:Channel)=>void; onError:(message:string)=>void;
}) {
  const [allSound,setAllSound]=useState<Sound>("sine"), [soloBusy,setSoloBusy]=useState(false);
  const active = states.filter(s=>channels.some(c=>c.id===s.id));
  const playing = active.filter(s=>s.status==="playing").length;
  const changeSelection = (ids:string[]) => { onTarget("selected"); onSelect(ids); };
  useEffect(() => {
    if (!focusId) return;
    const row = document.getElementById("chakra-editor-" + focusId);
    const options = row?.querySelector<HTMLDetailsElement>(".chakra-row-menu");
    if (options) {
      options.open = true;
      options.querySelector("summary")?.focus();
    }
  }, [focusId]);
  function chooseSound(value: Channel, sound: Sound, defaultHz: number) {
    const hz = Math.min(sounds[sound].max, Math.max(sounds[sound].min, value.hz));
    onChange({ ...value, sound, hz, frequencyOverride: hz !== defaultHz });
  }
  async function solo(value:Channel) {
    if(!prepareSound([value.id]))return;
    setSoloBusy(true);
    try {
      engine.snapshot().filter(s=>s.id!==value.id).forEach(s=>engine.stop(s.id));
      if (value.muted) onChange({...value,muted:false});
      await engine.play({...value,muted:false,seconds});
    } catch { onError("Audio could not start. Try again after checking the player."); }
    finally { setSoloBusy(false); }
  }
  return <section className="chakra-mixer" aria-label="Chakra mixer">
    <div className="chakra-session">
      <label>Timer<select aria-label="Session duration" value={seconds} disabled={active.length>0} onChange={e=>onSeconds(Number(e.target.value))}>
        {[...new Set([seconds,60,180,300,600,900,1800,3600])].sort((a,b)=>a-b).map(n=><option key={n} value={n}>{n%60===0?n/60+" min":clock(n)}</option>)}
      </select></label>
      <label className="range-label">Master <output>{Math.round(master*100)}%</output><input aria-label="Master volume" type="range" min="0" max="100" value={Math.round(master*100)} onChange={e=>onMaster(Number(e.target.value)/100)}/></label>
    </div>
    <div className="segmented" aria-label="Mix selection">
      <button aria-pressed={target==="selected"} onClick={()=>onTarget("selected")}>Selected ({selected.length})</button>
      <button aria-pressed={target==="all"} onClick={()=>onTarget("all")}>All seven</button>
    </div>
    <div className="chakra-meter" role="status">{playing} playing · {active.filter(s=>s.status==="paused").length} paused · {target==="all"?7:selected.length} in mix</div>
    <details className="chakra-tools">
      <summary><SlidersHorizontal size={16}/> Mix tools</summary>
      <div className="chakra-tools-grid">
        <label>Sound for all<select aria-label="Sound for all chakras" value={allSound} disabled={active.length>0} onChange={e=>setAllSound(e.target.value as Sound)}>{chakraSounds.map(s=><option key={s} value={s}>{sounds[s].name}</option>)}</select></label>
        <button disabled={active.length>0} onClick={()=>channels.forEach(c=>chooseSound(c,allSound,chakras.find(k=>k.id===c.id)!.hz))}>Apply sound</button>
        <button onClick={()=>channels.forEach(c=>onChange({...c,volume:0.25,muted:false}))}>Reset levels</button>
        <button onClick={()=>{ channels.forEach(c=>engine.stop(c.id)); changeSelection([]); }}>Clear selection</button>
      </div>
      <p className="content-note">Stop the channels to change sound or timer. Selection changes apply on the next group Play. Group Stop reaches every chakra.</p>
    </details>
    <div className="chakra-list chakra-console">
      {chakras.map((c,index)=>{
        const value=channels.find(row=>row.id===c.id)!;
        const state=states.find(s=>s.id===c.id);
        const status=state ? state.status+" · "+clock(Math.max(0,seconds-state.time))+" left" : "Ready";
        return <article id={"chakra-editor-" + c.id} key={c.id} aria-label={c.name+" chakra"} className={"chakra-row "+(state?"active":"")} style={{"--chakra":c.color} as CSSProperties}>
          <div className="chakra-console-head">
            <label className="chakra-choice"><input type="checkbox" aria-label={"Select "+c.name} checked={selected.includes(c.id)} onChange={e=>changeSelection(e.target.checked?[...selected,c.id]:selected.filter(id=>id!==c.id))}/><span><strong><span className="chakra-number">{index+1}</span> {c.name}</strong><small>{value.hz} Hz · {sounds[value.sound].name}</small><small className="chakra-row-state">{value.muted?"Muted":value.volume===0?"Level is zero":status}</small></span></label>
            <Transport compact channels={[{...value,seconds}]} states={states} onError={onError}/>
          </div>
          <div className="chakra-console-controls">
            <label className="chakra-sound"><span className="sr-only">{c.name} sound type</span><select aria-label={c.name+" sound type"} value={value.sound} disabled={Boolean(state)} onChange={e=>chooseSound(value,e.target.value as Sound,c.hz)}>{rawSounds.map(s=><option key={s} value={s}>{sounds[s].name}</option>)}</select></label>
            <label className="chakra-level"><span className="sr-only">{c.name} volume</span><input aria-label={c.name+" volume"} type="range" min="0" max="100" value={Math.round(value.volume*100)} onChange={e=>onChange({...value,volume:Number(e.target.value)/100})}/><output>{Math.round(value.volume*100)}%</output></label>
            <button className="icon-button" aria-label={(value.muted?"Unmute ":"Mute ")+c.name} aria-pressed={value.muted} onClick={()=>onChange({...value,muted:!value.muted})}>{value.muted?<VolumeX size={18}/>:<Volume2 size={18}/>}</button>
            <details className="chakra-row-menu">
              <summary aria-label={c.name+" options"}><SlidersHorizontal size={18} aria-hidden="true" /></summary>
              <div>
                <FrequencyField label={c.name + " frequency (Hz)"} sound={value.sound} value={value.hz}
                  disabled={Boolean(state)} onChange={hz => onChange({ ...value, hz, frequencyOverride: hz !== c.hz })} />
                <button disabled={Boolean(state)} onClick={() => onChange({ ...value, sound: "sine", hz: c.hz, frequencyOverride: false })}>Reset frequency</button>
                <button disabled={soloBusy} aria-label={"Solo " + c.name} onClick={() => void solo(value)}>Solo {c.name}</button>
                <LibraryLayers prefix={c.name} value={value.accompaniment} tracks={tracks} disabled={Boolean(state)}
                  onChange={accompaniment => onChange({ ...value, accompaniment })} />
              </div>
            </details>
          </div>
        </article>;
      })}
    </div>
    <SequenceSetup showTransport={false} channels={channels.filter(c=>target==="all"||selected.includes(c.id))}/>
    <details className="info-panel"><summary>About these frequencies</summary><p>396, 417, 528, 639, 741, 852 and 963 Hz use a modern Solfeggio meditation mapping. These are spiritual listening associations, not established medical treatment frequencies. A pure tone contains one frequency; instruments include harmonics or resonant partials. Start at a comfortable low volume.</p></details>
  </section>;
}
