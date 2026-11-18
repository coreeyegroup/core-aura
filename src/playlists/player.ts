import type {Plan} from "../manifestation/model";
import type {Channel} from "../model";
import {PlayItem,itemDuration} from "./model";
type Audio={stop?:(id:string)=>void;stopAll:()=>void;play:(c:Channel)=>Promise<void>;pause:(id:string)=>void;resume:(id:string)=>Promise<void>;snapshot:()=>{id:string;status:string;time:number}[];setMaster:(v:number)=>void};
type Manifest={start:(p:Plan,options:{replace:boolean})=>void;stop:()=>void;pause:()=>void;resume:()=>void;snapshot:()=>{status:string;elapsed:number;error?:string;plan?:{id:string}|null}};
export type QueueState={status:"idle"|"playing"|"paused"|"completed"|"error";name:string;items:PlayItem[];index:number;elapsed:number;error:string;output:number};
export class QueuePlayer {
 private state:QueueState={status:"idle",name:"",items:[],index:0,elapsed:0,error:"",output:.5};
 private listeners=new Set<()=>void>();private timer?:ReturnType<typeof setInterval>;private generation=0;private ids:string[]=[];private seen=false;private loading=false;
 acting=false;
 constructor(private audio:Audio,private manifest:Manifest){}
 snapshot=()=>this.state;
 subscribe=(f:()=>void)=>{this.listeners.add(f);return()=>{this.listeners.delete(f);};};
 private update(p:Partial<QueueState>){this.state={...this.state,...p};this.listeners.forEach(f=>f());}
 private own<T>(f:()=>T):T {const previous=this.acting;this.acting=true;try{return f();}finally{this.acting=previous;}}
 setOutput(value:number){if(!Number.isFinite(value)||value<0||value>1)return;this.audio.setMaster(value);this.update({output:value});}
 private clear(){if(this.timer)clearInterval(this.timer);this.timer=undefined;}
 private halt(){this.generation++;this.loading=false;this.clear();this.own(()=>{this.ids.forEach(id=>this.audio.pause(id));this.manifest.stop();this.audio.stopAll();});this.ids=[];}
 async start(items:PlayItem[],name:string){if(!items.length)throw Error("Choose a saved item to play.");this.halt();this.update({items:structuredClone(items),name,index:0,status:"playing",elapsed:0,error:""});await this.launch();}
 private async launch(){const item=this.state.items[this.state.index];if(!item)return;const token=++this.generation;this.seen=false;this.loading=true;
 try{if(item.kind==="practice"){this.own(()=>this.manifest.start(item.plan,{replace:true}));this.seen=true;}else{this.ids=item.session.channels.map((_,i)=>"queue:"+token+":"+i);this.setOutput(item.session.master);await Promise.all(item.session.channels.map((c,i)=>this.own(()=>this.audio.play({...c,id:this.ids[i]}))));if(token!==this.generation)return;this.seen=true;if(this.state.status==="paused")this.ids.forEach(id=>this.audio.pause(id));}
 if(token!==this.generation)return;this.loading=false;this.timer=setInterval(()=>this.tick(),200);
 }catch(e){if(token!==this.generation)return;this.halt();this.update({status:"error",error:(e as Error).message||"Playback could not start. Try again."});}}
 private tick(){if(this.state.status!=="playing"||this.loading)return;const item=this.state.items[this.state.index];if(!item)return;
 if(item.kind==="practice"){const p=this.manifest.snapshot();if(p.plan&&p.plan.id!==item.plan.id){this.generation++;this.clear();this.ids.forEach(id=>this.audio.stop?.(id));this.ids=[];this.update({status:"idle",elapsed:0});return;}this.update({elapsed:p.elapsed});if(p.status==="error"){this.halt();this.update({status:"error",error:p.error||"Practice playback failed."});return;}if(p.status==="completed")void this.next();else if(p.status==="idle")this.interrupt();else if(p.status==="paused")this.update({status:"paused"});}
 else{const voices=this.audio.snapshot().filter(v=>this.ids.includes(v.id)&&v.status!=="stopping");if(voices.length){this.update({elapsed:Math.max(...voices.map(v=>v.time))});if(voices.every(v=>v.status==="paused"))this.update({status:"paused"});}else if(this.seen)void this.next();}}
 pause(){if(this.state.status!=="playing")return;this.update({status:"paused"});this.own(()=>{if(this.state.items[this.state.index]?.kind==="practice")this.manifest.pause();else this.ids.forEach(id=>this.audio.pause(id));});}
 async resume(){if(this.state.status!=="paused")return;this.update({status:"playing"});try{if(this.state.items[this.state.index]?.kind==="practice")this.own(()=>this.manifest.resume());else await Promise.all(this.ids.map(id=>this.own(()=>this.audio.resume(id))));}catch(e){this.halt();this.update({status:"error",error:(e as Error).message});}}
 async next(){if(!["playing","paused"].includes(this.state.status))return;const index=this.state.index+1,paused=this.state.status==="paused";this.halt();if(index>=this.state.items.length){this.update({status:"completed",elapsed:itemDuration(this.state.items[this.state.index])});return;}this.update({index,elapsed:0,status:paused?"paused":"playing"});await this.launch();if(paused&&this.state.status==="paused")this.own(()=>{if(this.state.items[index]?.kind==="practice")this.manifest.pause();else this.ids.forEach(id=>this.audio.pause(id));});}
 async previous(){if(!["playing","paused"].includes(this.state.status))return;const index=Math.max(0,this.state.index-1),paused=this.state.status==="paused";this.halt();this.update({index,elapsed:0,status:paused?"paused":"playing"});await this.launch();if(paused)this.own(()=>{if(this.state.items[index]?.kind==="practice")this.manifest.pause();});}
 stop(){if(!["playing","paused","error"].includes(this.state.status))return;this.halt();this.update({status:"idle",elapsed:0});}
 interrupt(){if(this.acting||!["playing","paused"].includes(this.state.status))return;this.halt();this.update({status:"idle",elapsed:0});}
 dispose(){this.halt();this.listeners.clear();}
}
