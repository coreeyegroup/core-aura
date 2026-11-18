export const moduleIds=["manifest","sound","chakra","schedule","pinned","tools"] as const;
export type ModuleId=(typeof moduleIds)[number];
export type ItemRef={kind:"practice"|"session";id:string};
export type Preferences={order:ModuleId[];collapsed:ModuleId[];pins:ItemRef[];recent:ItemRef[];start:"home"|"manifest"|"studio"|"chakras"|"library";history:boolean;labels:Record<string,{tags:string;folder:string}>};
const key="core-aura.workbench.v1";
const initial=():Preferences=>({order:[...moduleIds],collapsed:[],pins:[],recent:[],start:"home",history:false,labels:{}});
export function parsePreferences(v:unknown):Preferences {
 const p=v as Preferences;if(!p||!Array.isArray(p.order)||p.order.length!==6||new Set(p.order).size!==6||p.order.some(x=>!moduleIds.includes(x))||!Array.isArray(p.collapsed)||p.collapsed.some(x=>!moduleIds.includes(x))||!["home","manifest","studio","chakras","library"].includes(p.start)||typeof p.history!=="boolean")throw Error("Invalid workspace preferences.");
 for(const list of [p.pins,p.recent])if(!Array.isArray(list)||list.length>100||list.some(r=>!r||!["practice","session"].includes(r.kind)||typeof r.id!=="string"||!r.id||r.id.length>100)||new Set(list.map(r=>r.kind+":"+r.id)).size!==list.length)throw Error("Invalid saved shortcuts.");
 if(!p.labels||typeof p.labels!=="object"||Object.keys(p.labels).length>1000||Object.entries(p.labels).some(([k,x])=>k.length>120||!x||typeof x.tags!=="string"||x.tags.length>200||typeof x.folder!=="string"||x.folder.length>80))throw Error("Invalid library labels.");return structuredClone(p);
}
let error="",value=initial();try{const raw=localStorage.getItem(key);if(raw)value=parsePreferences(JSON.parse(raw));}catch{error="Workspace preferences could not be restored. The original data was kept; export a backup before resetting.";}
let snapshot={value,error};const listeners=new Set<()=>void>();
export const preferences={snapshot:()=>snapshot,subscribe:(f:()=>void)=>{listeners.add(f);return()=>{listeners.delete(f);};},update:(patch:Partial<Preferences>)=>{if(snapshot.error)throw Error(snapshot.error);const next=parsePreferences({...snapshot.value,...patch});localStorage.setItem(key,JSON.stringify(next));snapshot={value:next,error:""};listeners.forEach(f=>f());},reset:()=>{localStorage.setItem(key,JSON.stringify(initial()));snapshot={value:initial(),error:""};listeners.forEach(f=>f());}};
export function remember(ref:ItemRef){const p=preferences.snapshot().value;try{preferences.update({recent:[ref,...p.recent.filter(r=>r.kind!==ref.kind||r.id!==ref.id)].slice(0,20)});}catch{/* A shortcut must not prevent playback. */}}
export function togglePin(ref:ItemRef){const p=preferences.snapshot().value,has=p.pins.some(r=>r.kind===ref.kind&&r.id===ref.id);preferences.update({pins:has?p.pins.filter(r=>r.kind!==ref.kind||r.id!==ref.id):[...p.pins,ref]});}
