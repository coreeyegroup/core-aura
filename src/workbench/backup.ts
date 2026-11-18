import {parsePlaylists} from "../playlists/model";
import {parseSequenceConfig} from "./sequence";
import {parseSession,sounds} from "../model";
import {parsePlan,parseReminders} from "../manifestation/model";
import {parseLibrary} from "../manifestation/library";
import {parseWorkspace} from "../workspace";
import {parseNatureDraft} from "../nature/storage";
import {parsePreferences} from "./preferences";
import {parseHistory} from "./history";
import {parsePack,validateWav} from "../packs/catalog";
import {trackSettings,validateTrackFile} from "../tracks/storage";
import {zipStored,unzipStored} from "./archive";
export const backupKeys=["core-aura.playlists.v1","core-aura.chakra-sequence.v1","core-aura.audio-defaults.v1","core-aura.voice-defaults.v1","core-aura.sessions.v2","core-aura.manifestation.v1","core-aura.affirmation-library.v1","core-aura.workspace.v1","core-aura.nature.draft.v1","core-aura.appearance","core-aura.favorites","core-aura.workbench.v1","core-aura.history.v1","core-aura.chakra-timer","core-aura.composer.v1","core-aura.last-sound-view","core-aura.library-view"];
const sources={tracks:{db:"core-aura-soundtracks",store:"tracks"},recordings:{db:"core-aura-personal-voice",store:"recordings"},packs:{db:"core-aura-packs",store:"packs"}};
export type MediaKind=keyof typeof sources;
export async function mediaRows(kind:MediaKind):Promise<any[]>{const {db:name,store}=sources[kind];const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(name,1);r.onupgradeneeded=()=>r.result.createObjectStore(store,{keyPath:"id"});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error("Media storage unavailable."));r.onblocked=()=>reject(Error("Close other Core-aura windows."));});return new Promise((resolve,reject)=>{const tx=db.transaction(store,"readonly"),request=tx.objectStore(store).getAll();tx.oncomplete=()=>{db.close();resolve(request.result);};tx.onabort=tx.onerror=()=>{db.close();reject(Error("Media could not be read."));};});}
async function writeRows(kind:MediaKind,rows:any[]){const {db:name,store}=sources[kind];await new Promise<void>((resolve,reject)=>{const r=indexedDB.open(name,1);r.onsuccess=()=>{const db=r.result,tx=db.transaction(store,"readwrite"),s=tx.objectStore(store);s.clear();rows.forEach(row=>s.put(row));tx.oncomplete=()=>{db.close();resolve();};tx.onerror=tx.onabort=()=>{db.close();reject(Error("Media restore failed; recovery will be attempted."));};};r.onerror=()=>reject(Error("Media storage unavailable."));});}
export function validateSettings(value:unknown):Record<string,string>{
 const input=value as Record<string,string>;if(!input||typeof input!=="object"||Array.isArray(input)||Object.keys(input).length>backupKeys.length)throw Error("Invalid settings backup.");const clean:Record<string,string>={};for(const [key,raw]of Object.entries(input)){if(!backupKeys.includes(key)||typeof raw!=="string"||raw.length>5*1024*1024)throw Error("Unsupported backup setting.");
 if(key.endsWith("playlists.v1"))parsePlaylists(JSON.parse(raw));
 else if(key.endsWith("chakra-sequence.v1"))parseSequenceConfig(JSON.parse(raw));
 else if(key.endsWith("audio-defaults.v1")){const d=JSON.parse(raw);if(!Number.isFinite(d.fadeSeconds)||d.fadeSeconds<.01||d.fadeSeconds>5)throw Error("Invalid fade default.");}
 else if(key.endsWith("voice-defaults.v1")){const d=JSON.parse(raw);if(typeof d.voice!=="string"||d.voice.length>300||!Number.isFinite(d.rate)||d.rate<.5||d.rate>1.5||!Number.isFinite(d.volume)||d.volume<0||d.volume>1)throw Error("Invalid voice defaults.");}
 else if(key.endsWith("sessions.v2")){const rows=JSON.parse(raw);if(!Array.isArray(rows)||rows.length>1000)throw Error("Invalid sessions.");rows.forEach(parseSession);}
 else if(key.endsWith("manifestation.v1")){const d=JSON.parse(raw);if(d.schemaVersion!==1||!Array.isArray(d.plans)||d.plans.length>100)throw Error("Invalid practices.");parsePlan(d.draft,true);d.plans.forEach((p:unknown)=>parsePlan(p));parseReminders(d.reminders,d.plans);}
 else if(key.endsWith("affirmation-library.v1"))parseLibrary(JSON.parse(raw));
 else if(key.endsWith("workspace.v1"))parseWorkspace(JSON.parse(raw));
 else if(key.endsWith("nature.draft.v1"))parseNatureDraft(JSON.parse(raw));
 else if(key.endsWith("workbench.v1"))parsePreferences(JSON.parse(raw));
 else if(key.endsWith("history.v1"))parseHistory(JSON.parse(raw));
 else if(key.endsWith("appearance")){const p=JSON.parse(raw);if(!["system","light","dark","contrast"].includes(p.theme)||!["compact","comfortable"].includes(p.density)||!Number.isFinite(p.textSize)||p.textSize<90||p.textSize>140)throw Error("Invalid display settings.");}
 else if(key.endsWith("favorites")){const p=JSON.parse(raw);if(!Array.isArray(p)||p.length>100||p.some(s=>typeof s!=="string"||!Object.prototype.hasOwnProperty.call(sounds,s)))throw Error("Invalid favourites.");}
 else if(key.endsWith("chakra-timer")){const n=Number(raw);if(!Number.isInteger(n)||n<1||n>7200)throw Error("Invalid timer.");}
 else if(key.endsWith("composer.v1")&&raw.length>300)throw Error("Invalid unfinished sentence.");
 else if(key.endsWith("last-sound-view")&&!["explore","studio"].includes(raw))throw Error("Invalid sound view.");
 else if(key.endsWith("library-view")&&!["audio","manifestation"].includes(raw))throw Error("Invalid library view.");clean[key]=raw;
 }return clean;
}
const hash=async(data:ArrayBuffer)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",data)),n=>n.toString(16).padStart(2,"0")).join("");
export async function makeBackup(selected:{kind:MediaKind;id:string}[],progress:(s:string)=>void=()=>{}){
 const settings:Record<string,string>={};for(const k of backupKeys){const raw=localStorage.getItem(k);if(raw!==null)settings[k]=raw;}validateSettings(settings);
 const files:{name:string;data:Uint8Array}[]=[],media:{kind:MediaKind;row:any}[]=[];let size=0;
 async function encode(value:any):Promise<any>{if(value instanceof Blob){size+=value.size;if(size>50*1024*1024)throw Error("Select up to 50 MB of media per bundle. Export additional bundles separately.");const data=await value.arrayBuffer(),name="media/"+files.length+".bin";files.push({name,data:new Uint8Array(data)});return {__file:name,mime:value.type,sha:await hash(data)};}if(Array.isArray(value))return Promise.all(value.map(encode));if(value&&typeof value==="object"){const out:Record<string,any>={};for(const [key,v]of Object.entries(value))out[key]=await encode(v);return out;}return value;}
 for(const kind of Object.keys(sources)as MediaKind[]){for(const row of await mediaRows(kind)){if(selected.some(s=>s.kind===kind&&s.id===row.id)){progress("Preparing "+kind+" · "+(row.title||row.text||row.id));media.push({kind,row:await encode(row)});}}}
 const manifest={schemaVersion:1,application:"Core-aura",createdAt:new Date().toISOString(),settings,media};const manifestBytes=new TextEncoder().encode(JSON.stringify(manifest));if(manifestBytes.length>8*1024*1024)throw Error("Settings are too large for one backup bundle. Export collections separately.");files.unshift({name:"manifest.json",data:manifestBytes});progress("Building backup bundle…");return zipStored(files);
}
async function validateMedia(kind:MediaKind,row:any){if(!row||typeof row.id!=="string"||row.id.length>100)throw Error("Invalid media identity.");if(kind==="tracks"){if(typeof row.title!=="string"||!row.title.trim()||row.title.length>80||typeof row.filename!=="string"||row.filename.length>160||typeof row.muted!=="boolean"||typeof row.loop!=="boolean"||!Number.isFinite(row.volume)||row.volume<0||row.volume>1||!Number.isFinite(Date.parse(row.createdAt)))throw Error("Invalid track metadata.");validateTrackFile({name:row.filename,size:row.blob?.size});trackSettings(row);if(!/^track:[a-f0-9]{64}$/.test(row.id)||!(row.blob instanceof Blob)||row.bytes!==row.blob.size||!Number.isFinite(row.duration)||row.duration<=0||row.duration>7200||await hash(await row.blob.arrayBuffer())!==row.id.slice(6))throw Error("Invalid track backup.");}
 if(kind==="recordings"&&(typeof row.mime!=="string"||row.mime.length>150||!Number.isFinite(Date.parse(row.createdAt))||!/^[a-zA-Z0-9-]{1,100}$/.test(row.id)||typeof row.text!=="string"||row.text.length>300||!(row.blob instanceof Blob)||row.blob.size<128||row.blob.size>5*1024*1024||!Number.isFinite(row.seconds)||row.seconds<=0||row.seconds>65))throw Error("Invalid recording backup.");
 if(kind==="packs"){const pack=parsePack(row.manifest);if(row.id!==pack.id||!Array.isArray(row.files)||row.files.length!==pack.assets.length)throw Error("Invalid pack backup.");for(const asset of pack.assets){const file=row.files.find((f:any)=>f.id===asset.id);if(!(file?.blob instanceof Blob))throw Error("Pack file missing.");const data=await file.blob.arrayBuffer();if(await hash(data)!==asset.sha256)throw Error("Pack hash mismatch.");validateWav(data,asset);}}
}
export async function restoreBackup(buffer:ArrayBuffer){
 const files=unzipStored(buffer),bytes=files.get("manifest.json")!;if(bytes.length>8*1024*1024)throw Error("Backup manifest is too large.");const m=JSON.parse(new TextDecoder().decode(bytes));if(m.schemaVersion!==1||m.application!=="Core-aura"||!Array.isArray(m.media)||m.media.length>300)throw Error("Unsupported backup bundle.");const settings=validateSettings(m.settings),incoming:Record<MediaKind,any[]>={tracks:[],recordings:[],packs:[]};
 async function decode(v:any):Promise<any>{if(v&&typeof v==="object"&&typeof v.__file==="string"){const data=files.get(v.__file);if(!data||typeof v.mime!=="string"||v.mime.length>150||await hash(data.buffer as ArrayBuffer)!==v.sha)throw Error("Backup media checksum mismatch.");return new Blob([data as Uint8Array<ArrayBuffer>],{type:v.mime});}if(Array.isArray(v))return Promise.all(v.map(decode));if(v&&typeof v==="object"){const o:Record<string,any>={};for(const [k,x]of Object.entries(v)){if(["__proto__","constructor","prototype"].includes(k))throw Error("Invalid backup metadata.");o[k]=await decode(x);}return o;}return v;}
 for(const item of m.media){if(!Object.prototype.hasOwnProperty.call(sources,item.kind))throw Error("Unsupported media type.");const kind=item.kind as MediaKind,row=await decode(item.row);await validateMedia(kind,row);if(incoming[kind].some(r=>r.id===row.id))throw Error("Duplicate backup media.");incoming[kind].push(row);}
 const old:Record<MediaKind,any[]>={tracks:await mediaRows("tracks"),recordings:await mediaRows("recordings"),packs:await mediaRows("packs")},merged={} as Record<MediaKind,any[]>;for(const kind of Object.keys(sources)as MediaKind[])merged[kind]=[...old[kind].filter(r=>!incoming[kind].some(v=>v.id===r.id)),...incoming[kind]];
 if(merged.tracks.length>30||merged.tracks.reduce((n,r)=>n+r.blob.size,0)>200*1024*1024||merged.recordings.length>100||merged.recordings.reduce((n,r)=>n+r.blob.size,0)>50*1024*1024)throw Error("Restore exceeds on-device media limits. Remove unused files first.");
 if(settings["core-aura.manifestation.v1"]){const d=JSON.parse(settings["core-aura.manifestation.v1"]);d.reminders=d.reminders.map((r:any)=>({...r,enabled:false}));const ids=new Set(merged.recordings.map(r=>r.id));for(const p of [d.draft,...d.plans])if(p.lines.some((l:any)=>l.recordingId&&!ids.has(l.recordingId)))p.useRecordings=false;settings["core-aura.manifestation.v1"]=JSON.stringify(d);}
 const previous=Object.fromEntries(backupKeys.map(k=>[k,localStorage.getItem(k)]));let written:MediaKind[]=[];
 try{for(const kind of Object.keys(sources)as MediaKind[]){if(incoming[kind].length){await writeRows(kind,merged[kind]);written.push(kind);}}for(const [k,v]of Object.entries(settings))localStorage.setItem(k,v);}
 catch(error){let failed=false;for(const kind of written.reverse())try{await writeRows(kind,old[kind]);}catch{failed=true;}for(const [k,v]of Object.entries(previous))try{if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v);}catch{failed=true;}if(failed)throw Error("Restore failed and recovery was incomplete. Keep your backup bundle; do not clear device data.");throw error;}
 return "Backup restored. Reminders are disabled until reviewed. Missing recordings use the selected voice. Reload to apply restored settings.";
}
