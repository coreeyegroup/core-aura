import {afterEach,expect,it,vi} from "vitest";
import {channel,ENGINE_VERSION,Session} from "../src/model";
import {attachMix,backgroundChannels} from "../src/manifestation/background";
import {newPlan,parsePlan} from "../src/manifestation/model";
import {ManifestPlayer} from "../src/manifestation/player";
import {signalOtherAudio} from "../src/audio/activity";
const source=():Session=>({schemaVersion:2,engineVersion:ENGINE_VERSION,id:"mix",name:"Rain and 432",kind:"nature",master:.5,createdAt:"",channels:[{...channel("rain",1000),id:"nature:rain",focus:true,focusQ:2,intensity:.8},{...channel("sine",432),id:"nature:tone",volume:.1,muted:true}]});
const plan=()=>({...newPlan(),lines:[{id:"a",text:"I take one clear step."},{id:"b",text:"I keep learning."}],gap:2,repeats:1,seconds:60,backgroundMix:attachMix(source())});
afterEach(()=>vi.useRealTimers());
it("attaches a portable validated snapshot, preserves tuning/mute/filter and follows the practice timer",()=>{
 const original=source(),mix=attachMix(original),p={...plan(),backgroundMix:mix};original.channels[0].hz=8000;expect(mix.channels[0].hz).toBe(1000);
 const normal=backgroundChannels(p),ducked=backgroundChannels(p,true);expect(normal.map(c=>c.id)).toEqual(["manifest-background:0","manifest-background:1"]);expect(normal[0]).toMatchObject({seconds:60,hz:1000,focus:true,focusQ:2,intensity:.8});expect(normal[1].muted).toBe(true);expect(ducked[0].volume).toBeCloseTo(normal[0].volume*.25);
 expect(parsePlan(JSON.parse(JSON.stringify(p))).backgroundMix).toEqual(mix);
 for(const patch of [{background:{sound:"sine",hz:432,volume:.1}},{backgroundDuckLevel:2},{backgroundDucking:"yes"},{backgroundMix:{...mix,channels:Array(9).fill(mix.channels[0])}},{backgroundMix:{...mix,master:-1}}])expect(()=>parsePlan({...p,...patch})).toThrow();
 expect(()=>parsePlan({...p,backgroundMix:undefined,background:{sound:"bowl",hz:432,volume:.12}})).not.toThrow();
});
it("ducks during speech, restores in gaps, changes live levels and pauses/stops every attached layer",async()=>{
 vi.useFakeTimers();const waiting:(()=>void)[]=[],voice={voices:async()=>[],stop:vi.fn(),speak:vi.fn(()=>new Promise<void>(r=>waiting.push(r)))},audio={stopAll:vi.fn(),play:vi.fn(async()=>{}),patch:vi.fn(),pause:vi.fn(),stop:vi.fn()};
 const player=new ManifestPlayer(voice,audio);try{
  player.start(plan());expect(audio.play).toHaveBeenCalledTimes(2);expect(audio.play.mock.calls[0][0].volume).toBeCloseTo(.3*.5*.4*.25);
  waiting.shift()!();await vi.advanceTimersByTimeAsync(1);expect(audio.patch.mock.calls.at(-2)![0].volume).toBeCloseTo(.3*.5*.4);
  await vi.advanceTimersByTimeAsync(2000);expect(audio.patch.mock.calls.at(-2)![0].volume).toBeCloseTo(.3*.5*.4*.25);
  player.updateBackground({backgroundMix:{...player.snapshot().plan!.backgroundMix!,volume:.8}});expect(audio.patch.mock.calls.at(-2)![0].volume).toBeCloseTo(.3*.5*.8*.25);
  player.updateBackground({backgroundDucking:false});expect(audio.patch.mock.calls.at(-2)![0].volume).toBeCloseTo(.3*.5*.8);
  player.pause();expect(audio.pause.mock.calls.map(c=>c[0])).toEqual(["manifest-background:0","manifest-background:1"]);
  waiting.shift()!();await vi.advanceTimersByTimeAsync(5000);expect(player.snapshot().status).toBe("paused");player.resume();expect(audio.play).toHaveBeenCalledTimes(4);
  signalOtherAudio();expect(player.snapshot().status).toBe("idle");expect(audio.stop.mock.calls.map(c=>c[0])).toContain("manifest-background:1");
  waiting.shift()!();await vi.advanceTimersByTimeAsync(100);expect(player.snapshot().status).toBe("idle");
 }finally{player.dispose();}
});
it("keeps silent reading at full background level and stops layers on completion or voice failure",async()=>{
 vi.useFakeTimers();const audio={stopAll:vi.fn(),play:vi.fn(async()=>{}),patch:vi.fn(),pause:vi.fn(),stop:vi.fn()},voice={voices:async()=>[],stop:vi.fn(),speak:vi.fn(async()=>{throw Error("Voice failed");})};const player=new ManifestPlayer(voice,audio);
 try{player.start({...plan(),mode:"read",readSeconds:2,gap:0});expect(audio.play.mock.calls[0][0].volume).toBeCloseTo(.3*.5*.4);await vi.advanceTimersByTimeAsync(4500);expect(player.snapshot().status).toBe("completed");expect(audio.stop.mock.calls.map(c=>c[0])).toContain("manifest-background:1");player.start(plan());await vi.advanceTimersByTimeAsync(1);expect(player.snapshot().status).toBe("error");expect(player.snapshot().error).toBe("Voice failed");}finally{player.dispose();}
});
