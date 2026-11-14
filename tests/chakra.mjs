import assert from 'node:assert/strict';
import {ChakraPlayer,chakras} from '../web/chakra-audio.js';
let contexts = [];
function fakeContext() {
 const param = () => ({value:0,setValueAtTime(){},linearRampToValueAtTime(){},setTargetAtTime(v){this.value=v;}});
 const node = () => ({connect(v){return v;},frequency:param(),gain:param(),start(){},stop(t){this.endsAt=t;}});
 const ctx={currentTime:0,state:'suspended',createGain:node,createOscillator:node,
 async resume(){this.state='running';},async suspend(){this.state='suspended';},async close(){this.state='closed';}};
 contexts.push(ctx); return ctx;
}
const player = new ChakraPlayer(fakeContext);
await Promise.all(chakras.map((_,i)=>player.play(i,'sine',60)));
assert.equal(player.voices.size,7);
assert.deepEqual([...player.voices.values()].map(v=>v.oscillator.frequency.value),[396,417,528,639,741,852,963]);
const root=player.voices.get(0);
await player.pause(0);
assert.equal(root.context.state,'suspended');
await player.play(0,'sine',60);
assert.equal(player.voices.get(0),root);
assert.equal(root.context.state,'running');
assert.equal(contexts.length,7);
player.setVolume(1);
assert.ok([...player.voices.values()].reduce((sum,v)=>sum+v.gain.gain.value,0)<=0.120001);
await player.stopAll();
assert.equal(player.voices.size,0);
assert.ok(contexts.every(c=>c.state==='closed'));
await Promise.all([player.play(0,'triangle',60), player.stop(0)]);
assert.equal(player.voices.size,0);
assert.equal(contexts.at(-1).state,'closed');
console.log('Seven frequencies, mixed gain, pause/resume, stop all and pending-start cancellation passed.');
