import {parsePlaylists,Playlist,PlaylistData} from "./model";
const key="core-aura.playlists.v1";
let state:{data:PlaylistData;error:string}={data:{schemaVersion:1,playlists:[]},error:""};
function restore(){try{const raw=localStorage.getItem(key);state={data:raw?parsePlaylists(JSON.parse(raw)):{schemaVersion:1,playlists:[]},error:""};}catch{state={data:{schemaVersion:1,playlists:[]},error:"Saved playlists could not be read. Original data was preserved; restore a backup before making changes."};}}
restore();const listeners=new Set<()=>void>();
function commit(data:PlaylistData){if(state.error)throw Error(state.error);const clean=parsePlaylists(data);try{localStorage.setItem(key,JSON.stringify(clean));}catch{throw Error("Playlists could not be saved. Free device storage and try again.");}state={data:clean,error:""};listeners.forEach(f=>f());}
export const playlistStore={snapshot:()=>state,subscribe:(f:()=>void)=>{listeners.add(f);return()=>{listeners.delete(f);};},save:(p:Playlist)=>commit({...state.data,playlists:[...state.data.playlists.filter(v=>v.id!==p.id),p]}),remove:(id:string)=>commit({...state.data,playlists:state.data.playlists.filter(p=>p.id!==id)})};
if(typeof window!=="undefined")addEventListener("storage",e=>{if(e.key===key){restore();listeners.forEach(f=>f());}});
