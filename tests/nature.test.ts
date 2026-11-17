import {afterEach,expect,it,vi} from "vitest";
import {channel,ENGINE_VERSION,parseSession,validChannel} from "../src/model";
import {natureCatalog} from "../src/nature/catalog";
import {natureSession,parseNatureDraft,readNatureDraft,writeNatureDraft} from "../src/nature/storage";
// @ts-expect-error Shared offline DSP implementation.
import {createState,sample} from "../public/dsp.js";
// @ts-expect-error Shared WAV rendering worker.
import {renderWav} from "../public/render-wav.js";
afterEach(()=>vi.unstubAllGlobals());
it("generates finite, bounded, non-silent audio for every nature texture at both sample rates",()=>{
 for(const id of Object.keys(natureCatalog))for(const rate of [44100,48000]){
  const state=createState({...channel(id as any,1000),id:"nature:test",seconds:2,intensity:.7});let power=0,peak=0;
  for(let n=0;n<rate*.4;n++){const value=sample(state,rate);power+=value*value;peak=Math.max(peak,Math.abs(value));}
  expect(Number.isFinite(power),id).toBe(true);expect(power,id).toBeGreaterThan(.001);expect(peak,id).toBeLessThanOrEqual(1);
 }
});
it("retains the natural texture timing when a different filter frequency is selected",()=>{
 const a=createState({...channel("shore",432),id:"nature:seed",seconds:2}),b=createState({...channel("shore",741),id:"nature:seed",seconds:2});
 for(let n=0;n<12000;n++)expect(sample(a,48000)).toBe(sample(b,48000));
 const c=createState({...channel("stream",432),id:"nature:seed",seconds:2,focus:true}),d=createState({...channel("stream",741),id:"nature:seed",seconds:2,focus:true});
 let difference=0;for(let n=0;n<12000;n++)difference+=Math.abs(sample(c,48000)-sample(d,48000));
 expect(difference).toBeGreaterThan(.01);expect(c.ambience.next).toBe(d.ambience.next);expect(c.time).toBe(d.time);
});
it("emphasizes the selected frequency band rather than relabeling all noise as one tone",()=>{
 const state=createState({...channel("white",432),id:"nature:filter",seconds:2,focus:true,focusQ:5});const data=[];
 for(let i=0;i<24000;i++){const x=sample(state,48000);if(i>4800)data.push(x);}
 const energy=(hz:number)=>{let re=0,im=0;for(let i=0;i<data.length;i++){re+=data[i]*Math.cos(2*Math.PI*hz*i/48000);im+=data[i]*Math.sin(2*Math.PI*hz*i/48000);}return re*re+im*im;};
 const near=[400,420,440,460].reduce((n,hz)=>n+energy(hz),0),far=[1800,2000,2200,2400].reduce((n,hz)=>n+energy(hz),0);
 expect(near).toBeGreaterThan(far*4);
});
it("round-trips generated mixes and rejects invalid filter, intensity and identifier settings",()=>{
 const draft={channels:[{...channel("rain",432),id:"nature:rain",focus:true,focusQ:2,intensity:.8},{...channel("sine",432),id:"nature:tone"}],seconds:300};
 const saved=natureSession("Rain + tone",draft,.4);expect(parseSession(JSON.parse(JSON.stringify(saved)))).toEqual(saved);expect(parseNatureDraft(draft)).toEqual(draft);
 expect(()=>parseSession({...saved,channels:[{...saved.channels[0],id:"root"}]})).toThrow();
 for(const patch of [{intensity:2},{focusQ:0},{focus:"yes"},{interval:0}])expect(validChannel({...draft.channels[0],...patch})).toBe(false);
 expect(()=>parseNatureDraft({...draft,channels:Array(9).fill(draft.channels[0])})).toThrow();
 expect(()=>parseSession({schemaVersion:2,engineVersion:ENGINE_VERSION,id:"old",name:"Old tone",kind:"studio",master:.5,channels:[channel()]})).not.toThrow();
});
it("preserves unreadable draft data until a deliberate reset and stores a valid draft without autoplay",()=>{
 const values=new Map<string,string>();vi.stubGlobal("localStorage",{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value)});
 values.set("core-aura.nature.draft.v1","broken");expect(readNatureDraft().error).toBeTruthy();expect(values.get("core-aura.nature.draft.v1")).toBe("broken");
 writeNatureDraft({channels:[{...channel("rain",1000),id:"nature:saved"}],seconds:60});expect(readNatureDraft().draft.channels[0].sound).toBe("rain");
});
it("renders generated nature and a frequency tone into an offline WAV",()=>{
 const iterator=renderWav([{...channel("stream",1000),id:"nature:water",seconds:1},{...channel("sine",432),id:"nature:tone",seconds:1}],.4,1);
 let value=iterator.next();while(!value.done)value=iterator.next();const bytes=new DataView(value.value);expect(bytes.byteLength).toBe(44+44100*2);expect(bytes.getUint32(24,true)).toBe(44100);
 let energy=0;for(let n=44;n<bytes.byteLength;n+=2)energy+=Math.abs(bytes.getInt16(n,true));expect(energy).toBeGreaterThan(10000);
});
