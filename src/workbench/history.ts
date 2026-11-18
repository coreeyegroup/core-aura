import {preferences} from "./preferences";
import {engine} from "../audio/engine";
import {manifestPlayer} from "../manifestation/player";
export type HistoryRow={id:string;kind:"practice"|"sound";name:string;sourceId:string;startedAt:string;seconds:number;result:"completed"|"interrupted"};
const key="core-aura.history.v1";let rows:HistoryRow[]=[];let error="";
export function parseHistory(v:unknown):HistoryRow[]{if(!Array.isArray(v)||v.length>500||v.some(r=>!r||typeof r.id!=="string"||r.id.length>100||!["practice","sound"].includes(r.kind)||typeof r.name!=="string"||r.name.length>80||typeof r.sourceId!=="string"||r.sourceId.length>100||typeof r.startedAt!=="string"||!Number.isFinite(Date.parse(r.startedAt))||!Number.isFinite(r.seconds)||r.seconds<0||r.seconds>86400||!["completed","interrupted"].includes(r.result)))throw Error("Invalid listening history.");return structuredClone(v);}
try{rows=parseHistory(JSON.parse(localStorage.getItem(key)||"[]"));}catch{error="History could not be read. Its original data was preserved.";}
let state={rows,error};const listeners=new Set<()=>void>();
function commit(next:HistoryRow[]){if(state.error)throw Error(state.error);localStorage.setItem(key,JSON.stringify(next));state={rows:next,error:""};listeners.forEach(f=>f());}
export const historyStore={snapshot:()=>state,subscribe:(f:()=>void)=>{listeners.add(f);return()=>{listeners.delete(f);};},remove:(id:string)=>commit(state.rows.filter(r=>r.id!==id)),clear:()=>{localStorage.removeItem(key);state={rows:[],error:""};listeners.forEach(f=>f());}};
export function observeHistory(){
 let current:{row:HistoryRow;last:number;playing:boolean}|undefined;
 function tick(){const p=manifestPlayer.snapshot(),practice=!!p.plan&&!p.plan.id.startsWith("preview-")&&["playing","paused"].includes(p.status),voices=engine.snapshot().filter(s=>s.id!=="manifest-background"&&!s.id.startsWith("manifest-background:")&&!s.id.includes("preview"));
  const now=Date.now(),enabled=preferences.snapshot().value.history;
  if(current){if(current.playing)current.row.seconds+=Math.max(0,(now-current.last)/1000);current.last=now;}
  const kind=practice?"practice":voices.length?"sound":null,source=practice?p.plan!.id:"sound";
  if(current&&(!enabled||kind!==current.row.kind||source!==current.row.sourceId)){
   if(enabled&&current.row.seconds>=1)try{commit([{...current.row,seconds:Math.min(86400,Math.round(current.row.seconds)),result:current.row.kind==="practice"&&p.plan?.id===current.row.sourceId&&p.status==="completed"?"completed" as const:"interrupted" as const},...state.rows].slice(0,500));}catch{}current=undefined;
  }
  if(enabled&&kind&&!current)current={row:{id:crypto.randomUUID(),kind,name:practice?p.plan!.name:"Sound listening",sourceId:source,startedAt:new Date(now).toISOString(),seconds:0,result:"interrupted"},last:now,playing:false};
  if(current)current.playing=practice?p.status==="playing":voices.some(s=>s.status==="playing");
 }
 const unsub=[engine.subscribe(tick),manifestPlayer.subscribe(tick),preferences.subscribe(tick)],timer=setInterval(tick,1000);tick();return()=>{clearInterval(timer);unsub.forEach(f=>f());};
}
