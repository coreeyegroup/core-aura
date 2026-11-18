import {parseSession, Session} from "../model";
import {parsePlan, Plan} from "../manifestation/model";
import type {ItemRef} from "../workbench/preferences";
export type Playlist={id:string;name:string;items:ItemRef[]};
export type PlaylistData={schemaVersion:1;playlists:Playlist[]};
export type PlayItem={kind:"practice";id:string;name:string;plan:Plan}|{kind:"session";id:string;name:string;session:Session};
export function parsePlaylists(value:unknown):PlaylistData {
 const v=value as PlaylistData;
 if(!v||v.schemaVersion!==1||!Array.isArray(v.playlists)||v.playlists.length>50)throw Error("Invalid playlist library.");
 const ids=new Set<string>();
 for(const p of v.playlists){if(!p||typeof p.id!=="string"||!p.id||p.id.length>100||ids.has(p.id)||typeof p.name!=="string"||!p.name.trim()||p.name.length>80||!Array.isArray(p.items)||!p.items.length||p.items.length>100||p.items.some(r=>!r||!["practice","session"].includes(r.kind)||typeof r.id!=="string"||!r.id||r.id.length>100))throw Error("A playlist needs a name and 1–100 saved items.");ids.add(p.id);}
 return structuredClone(v);
}
export function resolveItems(refs:ItemRef[],plans:Plan[],sessions:Session[]):PlayItem[]{
 if(!refs.length||refs.length>100)throw Error("Choose 1–100 saved items.");
 return refs.map(r=>{if(r.kind==="practice"){const p=plans.find(p=>p.id===r.id);if(!p)throw Error("A practice is unavailable. Edit the playlist to replace it.");return{kind:"practice",id:r.id,name:p.name,plan:parsePlan(structuredClone(p))};}if(r.kind!=="session")throw Error("Unsupported playlist item.");const s=sessions.find(s=>s.id===r.id);if(!s)throw Error("A sound session is unavailable. Edit the playlist to replace it.");return{kind:"session",id:r.id,name:s.name,session:parseSession(structuredClone(s))};});
}
export function itemDuration(item:PlayItem){return item.kind==="practice"?item.plan.seconds:Math.max(...item.session.channels.map(c=>c.seconds));}
export function durationLabel(seconds:number){return seconds<60?Math.round(seconds)+" sec":Math.ceil(seconds/60)+" min";}
