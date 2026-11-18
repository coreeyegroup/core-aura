import { useEffect, useState } from "react";
import { Plan } from "./model";
import { Session, sounds } from "../model";
import { attachMix } from "./background";

function BackgroundFrequency({value,min,max,disabled,onChange}:{value:number;min:number;max:number;disabled:boolean;onChange:(hz:number)=>void}) {
  const [text,setText]=useState(String(value));
  useEffect(()=>setText(String(value)),[value]);
  return <input aria-label="Background frequency (Hz)" type="number" inputMode="decimal" min={min} max={max} step=".1" disabled={disabled} value={text} onChange={e=>{setText(e.target.value);const hz=e.target.valueAsNumber;if(Number.isFinite(hz)&&hz>=min&&hz<=max)onChange(hz);}} onBlur={()=>setText(String(value))}/>;
}

export function BackgroundControls({plan:p,sessions,active,onChange}:{plan:Plan;sessions:Session[];active:boolean;onChange:(patch:Partial<Plan>)=>unknown}) {
  const mixes=sessions.filter(s=>s.channels.length<=8);
  const source=p.backgroundMix?"saved":p.background?.sound??"none";
  const enabled=!!(p.background||p.backgroundMix),level=p.backgroundMix?.volume??p.background?.volume??0;
  const setLevel=(volume:number)=>onChange(p.backgroundMix?{backgroundMix:{...p.backgroundMix,volume}}:{background:{...p.background!,volume}});
  const silent=p.backgroundMix && (p.backgroundMix.master===0 || p.backgroundMix.channels.every(c=>c.muted||c.volume===0));
  return <details className="manifest-background-controls">
    <summary>Background sound <span className="content-note">{p.backgroundMix?.name??(p.background?sounds[p.background.sound].name:"None")}{enabled?" · "+Math.round(level*100)+"%":""}</span></summary>
    <div className="fields">
      <label>Background sound<select aria-label="Background sound" disabled={active} value={source} onChange={e=>{
        const value=e.target.value;
        if(value==="saved"){if(mixes[0])onChange({background:null,backgroundMix:attachMix(mixes[0])});}
        else onChange({backgroundMix:null,background:value==="none"?null:{sound:value as "sine"|"bowl"|"tanpura",hz:value==="tanpura"?216:432,volume:.12}});
      }}><option value="none">None</option><option value="saved" disabled={!mixes.length&&!p.backgroundMix}>Saved sound mix</option><option value="sine">Pure tone</option><option value="bowl">Singing bowl</option><option value="tanpura">Tanpura drone</option></select></label>
      {p.backgroundMix?<label>Saved sound mix<select aria-label="Saved sound mix" disabled={active} value="attached" onChange={e=>{const found=mixes.find(s=>s.id===e.target.value);if(found)onChange({background:null,backgroundMix:attachMix(found)});}}><option value="attached">Attached: {p.backgroundMix.name}</option>{mixes.map(s=><option key={s.id} value={s.id}>{s.name} · {s.channels.length} layers</option>)}</select></label>:p.background?<label>Background frequency (Hz)<BackgroundFrequency min={sounds[p.background.sound].min} max={sounds[p.background.sound].max} disabled={active} value={p.background.hz} onChange={hz=>onChange({background:{...p.background!,hz}})}/></label>:null}
    </div>
    {!enabled&&!mixes.length&&<p className="content-note">Save a generated mix in Sounds → Nature library or Studio, then attach it here.</p>}
    {enabled&&<>
      <label className="range-label">Background level <output>{Math.round(level*100)}%</output><input aria-label="Background level" type="range" min="0" max={p.backgroundMix?100:30} value={Math.round(level*100)} onChange={e=>setLevel(Number(e.target.value)/100)}/></label>
      <div className="background-voice-controls"><label className="check"><input aria-label="Reduce background during speech" type="checkbox" checked={p.backgroundDucking??true} onChange={e=>onChange({backgroundDucking:e.target.checked})}/> Reduce during speech</label><label>While speaking<select aria-label="Background remaining during speech" disabled={!(p.backgroundDucking??true)} value={p.backgroundDuckLevel??.25} onChange={e=>onChange({backgroundDuckLevel:Number(e.target.value)})}>{![0,.1,.25,.5,1].includes(p.backgroundDuckLevel??.25)&&<option value={p.backgroundDuckLevel}>Custom</option>}<option value="0">Silent</option><option value="0.1">10% of level</option><option value="0.25">25% of level</option><option value="0.5">50% of level</option><option value="1">Full level</option></select></label></div>
      {p.backgroundMix&&<p className="content-note">{p.backgroundMix.channels.length} attached layers · original level balance and tuning · follows practice timer. Imported files are separate. {active?"Live adjustments apply to this run.":"Save practice to keep this mix, even if its source is later deleted."}</p>}
      {silent&&<p role="status" className="content-note">This attached mix is silent: its master is zero or all layers are muted/zero. Adjust the original mix and attach it again.</p>}
    </>}
  </details>;
}
