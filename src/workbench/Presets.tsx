import {useState,useSyncExternalStore} from "react";
import {newPlan,parsePlan,Plan,affirmations} from "../manifestation/model";
import {channel,chakras} from "../model";
import {manifestationStore as store} from "../manifestation/store";
import {confirmDraftReplacement} from "../manifestation/flow";
import {manifestPlayer} from "../manifestation/player";
export const practicePresets=[
 {name:"Calm with rain",category:"Calm",sound:"rain",minutes:5},
 {name:"Focused next step",category:"Success",sound:"stream",minutes:5},
 {name:"Healthy daily habits",category:"Health",sound:"breeze",minutes:10},
 {name:"Thoughtful wealth",category:"Wealth",sound:"shore",minutes:5},
 {name:"Confidence and clarity",category:"Confidence",sound:"bowl",minutes:5},
 {name:"Evening gratitude",category:"Gratitude",sound:"flute",minutes:10},
 {name:"Kind relationships",category:"Relationships",sound:"hum",minutes:5},
 {name:"Purpose and direction",category:"Purpose",sound:"shruti",minutes:5},
] as const;
export function presetPlan(index:number,voice=""):Plan{const preset=practicePresets[index];if(!preset)throw Error("Preset unavailable.");const list=affirmations.filter(a=>a.category===preset.category).slice(0,3);return parsePlan({...newPlan(),name:preset.name,voice,seconds:preset.minutes*60,lines:list.map(a=>({id:crypto.randomUUID(),text:a.text})),backgroundMix:{name:preset.name+" background",channels:[{...channel(preset.sound,preset.sound==="hum"?144:preset.sound==="shruti"?216:preset.sound==="bowl"?216:432),id:"preset-layer",seconds:preset.minutes*60}],master:.5,volume:.4},backgroundDucking:true,backgroundDuckLevel:.25});}
export function Presets({onOpen}:{onOpen:()=>void}){const player=useSyncExternalStore(manifestPlayer.subscribe,manifestPlayer.snapshot),active=["playing","paused"].includes(player.status)&&!player.plan?.id.startsWith("preview-");const [query,setQuery]=useState(""),[message,setMessage]=useState("");return <details className="workbench-panel"><summary>Practice presets <span>8 editable starting points</span></summary><label>Find preset<input type="search" aria-label="Find preset" value={query} onChange={e=>setQuery(e.target.value)}/></label>{practicePresets.map((p,i)=>({p,i})).filter(({p})=>(p.name+" "+p.category).toLowerCase().includes(query.toLowerCase())).map(({p,i})=><div className="workbench-row" key={p.name}><span><strong>{p.name}</strong><small>{p.category} · 3 affirmations · {p.minutes} min</small></span><button onClick={()=>{try{manifestPlayer.preview({...presetPlan(i,store.snapshot().data.draft.voice),id:"preview-preset-"+i,lines:presetPlan(i).lines.slice(0,1),repeats:1});}catch(e){setMessage((e as Error).message);}}}>Preview</button><button disabled={active} onClick={()=>{try{const {draft,plans}=store.snapshot().data;if(!confirmDraftReplacement(draft,plans))return;const plan=presetPlan(i,draft.voice);store.draft(plan);onOpen();setMessage("Preset loaded as an editable draft. Save it to keep a personal preset.");}catch(e){setMessage((e as Error).message);}}}>Use preset</button></div>)}<p className="content-note">Generated backgrounds and original prompts. Choose your available voice before playing. Saved personal practices are your editable presets.</p>{message&&<p role="status">{message}</p>}</details>;}
