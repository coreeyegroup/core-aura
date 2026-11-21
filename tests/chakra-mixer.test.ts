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

it("keeps Sacral at 417 Hz and softens its beat against Root in Together playback", async () => {
  let Mixer: any;
  const rate = 48000;
  vi.resetModules();
  vi.stubGlobal("sampleRate", rate);
  vi.stubGlobal("AudioWorkletProcessor", class {
    port = { onmessage: undefined as any, postMessage: vi.fn() };
  });
  vi.stubGlobal("registerProcessor", (_: string, processor: unknown) => { Mixer = processor; });
  try {
    // @ts-expect-error Shared browser worklet.
    await import("../public/mixer-worklet.js");
    const mixer = new Mixer();
    const send = (data: unknown) => mixer.port.onmessage({ data });
    send({ type: "start-group", channels: chakras.map(({ id, hz }) => ({
      id, hz, sound: "sine", volume: .25, muted: false, seconds: 6,
    })) });
    const renderSecond = () => {
      const samples = new Float32Array(rate);
      for (let start = 0; start < rate; start += 128)
        mixer.process([], [[samples.subarray(start, start + 128)]]);
      return samples;
    };
    const magnitude = (samples: Float32Array, hz: number) => {
      let sine = 0, cosine = 0;
      samples.forEach((value, i) => {
        const angle = 2 * Math.PI * hz * i / rate;
        sine += value * Math.sin(angle);
        cosine += value * Math.cos(angle);
      });
      return Math.hypot(sine, cosine);
    };
    renderSecond(); // Let the shared fade-in settle.
    const together = renderSecond();
    const balance = magnitude(together, 417) / magnitude(together, 396);
    expect(balance).toBeGreaterThan(.25);
    expect(balance).toBeLessThan(.55);
    send({ type: "patch", id: "root", patch: { muted: true } });
    renderSecond();
    const withoutRoot = renderSecond();
    const restored = magnitude(withoutRoot, 417) / magnitude(withoutRoot, 528);
    expect(restored).toBeGreaterThan(.9);
    expect(restored).toBeLessThan(1.1);
  } finally {
    vi.unstubAllGlobals();
  }
});
