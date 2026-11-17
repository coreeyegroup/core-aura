import { Channel, ENGINE_VERSION, Session, parseSession } from "../model";
export type NatureDraft={channels:Channel[];seconds:number};
const key="core-aura.nature.draft.v1";
export function parseNatureDraft(value:unknown):NatureDraft {
 const d=value as NatureDraft;
 if(!d || !Array.isArray(d.channels) || d.channels.length>8 || !Number.isInteger(d.seconds)||d.seconds<1||d.seconds>7200)throw Error("Invalid nature mix.");
 if(d.channels.length)parseSession({schemaVersion:2,engineVersion:ENGINE_VERSION,id:"draft",name:"Draft",kind:"nature",channels:d.channels,master:.5});
 return {channels:d.channels.map(c=>({...c})),seconds:d.seconds};
}
export function readNatureDraft(){
 try{const raw=localStorage.getItem(key);return{draft:raw?parseNatureDraft(JSON.parse(raw)):{channels:[],seconds:300} as NatureDraft,error:""};}
 catch{return{draft:{channels:[],seconds:300} as NatureDraft,error:"The previous nature mix could not be restored. Its data was kept. Load a saved mix, or reset this draft."};}
}
export function writeNatureDraft(value:NatureDraft){localStorage.setItem(key,JSON.stringify(parseNatureDraft(value)));}
export function natureSession(name:string,draft:NatureDraft,master:number):Session {
 return parseSession({schemaVersion:2,engineVersion:ENGINE_VERSION,id:crypto.randomUUID(),name:name.trim(),kind:"nature",channels:draft.channels.map(c=>({...c,seconds:draft.seconds})),master,createdAt:new Date().toISOString()});
}
