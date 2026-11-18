import {chakras} from "../model";
import {engine} from "../audio/engine";
import {manifestPlayer} from "../manifestation/player";
function group(id:string){return id.startsWith("nature:")?"nature":id.startsWith("pack:")?id:id.startsWith("track:")?"track":chakras.some(c=>c.id===id)?"chakra":"studio";}
export function prepareSound(ids:string[],add=false,force=false){
 const p=manifestPlayer.snapshot(),practice=["playing","paused"].includes(p.status),foreign=engine.snapshot().some(s=>s.status!=="stopping"&&!ids.includes(s.id)&&(force||!ids.some(id=>group(id)===group(s.id))));
 if(practice||(!add&&foreign)){
  if(!confirm("Replace current playback? This stops the active audio. Draft settings will be kept."))return false;
  manifestPlayer.stop();engine.stopAll();
 }
 return true;
}
export function preparePreview(){
 const p=manifestPlayer.snapshot();if(p.status==="playing")manifestPlayer.pause();
 engine.snapshot().filter(s=>s.status==="playing").forEach(s=>engine.pause(s.id));
}
