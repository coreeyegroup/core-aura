import {Channel} from "../model";
import {engine} from "../audio/engine";
import {onOtherAudio} from "../audio/activity";
export type SequenceState={status:"idle"|"playing"|"paused"|"completed";channels:Channel[];index:number;seconds:number;gap:number;elapsed:number;error:string};
export class ChakraSequence {
 private state:SequenceState={status:"idle",channels:[],index:0,seconds:60,gap:0,elapsed:0,error:""};private listeners=new Set<()=>void>();private timer?:ReturnType<typeof setInterval>;private own=false;private seen=false;private nextAt=0;private generation=0;
 constructor(){onOtherAudio(()=>{if(!this.own)this.stop();});}
 snapshot=()=>this.state;subscribe=(f:()=>void)=>{this.listeners.add(f);return()=>{this.listeners.delete(f);};};
 private update(p:Partial<SequenceState>){this.state={...this.state,...p};this.listeners.forEach(f=>f());}
 start(channels:Channel[],seconds:number,gap:number){if(!channels.length||channels.length>7||!Number.isInteger(seconds)||seconds<1||seconds>3600||!Number.isFinite(gap)||gap<0||gap>30)throw Error("Choose one to seven chakras and valid sequence timing.");this.stop();this.own=true;engine.stopAll();this.own=false;this.update({status:"playing",channels:channels.map(c=>({...c})),index:0,seconds,gap,elapsed:0,error:""});this.play();this.timer=setInterval(()=>this.tick(),100);}
 private play(){const c=this.state.channels[this.state.index];if(!c)return;this.seen=false;this.nextAt=0;this.own=true;const token=this.generation;const pending=engine.play({...c,seconds:this.state.seconds});this.own=false;void pending.then(()=>{if(token===this.generation)this.seen=engine.snapshot().some(s=>s.id===c.id);}).catch(()=>{if(token===this.generation){this.stop();this.update({error:"The sequence could not start. Check the audio player and retry."});}});}
 private tick(){if(this.state.status!=="playing")return;const voice=engine.snapshot().find(s=>s.id===this.state.channels[this.state.index]?.id);if(voice){this.seen=true;if(voice.status==="paused"){this.update({status:"paused"});return;}this.update({elapsed:voice.time});return;}if(this.nextAt){if(Date.now()>=this.nextAt)this.play();return;}if(this.seen){if(this.state.index+1>=this.state.channels.length){if(this.timer)clearInterval(this.timer);this.timer=undefined;this.update({status:"completed",elapsed:this.state.seconds});}else{this.seen=false;this.update({index:this.state.index+1,elapsed:0});this.nextAt=Date.now()+this.state.gap*1000;if(!this.state.gap)this.play();}}}
 pause(){if(this.state.status!=="playing")return;engine.pause(this.state.channels[this.state.index]?.id);this.update({status:"paused"});}
 resume(){if(this.state.status!=="paused")return;this.update({status:"playing"});if(this.nextAt)this.nextAt=Date.now()+this.state.gap*1000;else this.play();}
 stop(){this.generation++;if(this.timer)clearInterval(this.timer);this.timer=undefined;if(["playing","paused"].includes(this.state.status))this.state.channels.forEach(c=>engine.stop(c.id));if(this.state.status!=="idle")this.update({status:"idle",elapsed:0});}
}
export const chakraSequence=new ChakraSequence();
