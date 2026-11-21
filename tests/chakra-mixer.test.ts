import {it,expect,vi} from "vitest";
import {chakras,chakraSounds,parseSession,ENGINE_VERSION} from "../src/model";
it("accepts every supported chakra timbre across all seven fixed frequencies",()=>{
 for(const sound of chakraSounds) expect(()=>parseSession({schemaVersion:2,engineVersion:ENGINE_VERSION,id:"mix",name:"Mix",kind:"chakras",master:.5,channels:chakras.map(c=>({id:c.id,hz:c.hz,sound,seconds:300,volume:.25,muted:false}))})).not.toThrow();
});
it("paused voices do not attenuate an audible chakra",async()=>{
 let Mixer:any;
 vi.stubGlobal("sampleRate",48000);
 vi.stubGlobal("AudioWorkletProcessor",class{port={onmessage:undefined as any,postMessage:vi.fn()};});
 vi.stubGlobal("registerProcessor",(_:string,p:any)=>{Mixer=p;});
 // @ts-expect-error Shared browser worklet.
 await import("../public/mixer-worklet.js");
 const a=new Mixer(), b=new Mixer();
 const start=(m:any,id:string)=>m.port.onmessage({data:{type:"start",channel:{id,sound:"sine",hz:396,seconds:5,volume:1,muted:false}}});
 start(a,"root");start(b,"root");
 for(let i=0;i<6;i++){start(b,"paused-"+i);b.channels.get("paused-"+i).status="paused";}
 let energyA=0,energyB=0;
 for(let i=0;i<80;i++){const x=new Float32Array(128),y=new Float32Array(128);a.process([],[[x]]);b.process([],[[y]]);for(let j=0;j<128;j++){energyA+=x[j]*x[j];energyB+=y[j]*y[j];}}
 expect(energyA).toBeGreaterThan(0);expect(energyB).toBeCloseTo(energyA,6);
 vi.unstubAllGlobals();
});

it("matches the saved sequence order for a selected subset and appends new selections", async () => {
  const { orderChakras } = await import("../src/workbench/sequence");
  const channels = chakras.slice(0, 4).map(chakra => ({
    id: chakra.id, hz: chakra.hz, sound: "sine" as const, seconds: 300, volume: .25, muted: false,
  }));
  expect(orderChakras(channels, ["crown", "solar", "root"]).map(channel => channel.id))
    .toEqual(["solar", "root", "sacral", "heart"]);
  expect(channels.map(channel => channel.id)).toEqual(["root", "sacral", "solar", "heart"]);
});

it("starts the seven frequencies on one clock and softens a layered strike", async () => {
  // @ts-expect-error Browser DSP shared by live playback and export.
  const { createGroupVoice, createState, sample } = await import("../public/dsp.js");
  const rate = 48000;
  const channels = chakras.map(chakra => ({
    id: chakra.id, hz: chakra.hz, sound: "bell", volume: .3, muted: false, seconds: 3,
  }));
  const plain = channels.map(createState);
  const group = channels.map((channel, index) => createGroupVoice(channel, index, channels.length));
  let plainPeak = 0, groupPeak = 0;
  for (let i = 0; i < rate; i++) {
    plainPeak = Math.max(plainPeak, Math.abs(plain.reduce((sum, state) => sum + sample(state, rate), 0)));
    groupPeak = Math.max(groupPeak, Math.abs(group.reduce((sum, state) =>
      sum + sample(state, rate) * state.headroom * state.left, 0)));
  }
  expect(group.map(state => state.currentHz)).toEqual(chakras.map(chakra => chakra.hz));
  expect(group.every(state => state.time === group[0].time)).toBe(true);
  expect(group[0].left).toBeGreaterThan(group[0].right);
  expect(group[6].right).toBeGreaterThan(group[6].left);
  expect(groupPeak).toBeGreaterThan(0);
  expect(groupPeak).toBeLessThan(plainPeak * .7);
});
