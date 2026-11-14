import assert from 'node:assert/strict';
import {playVoice} from '../web/engine.js';
function param() {
  return {targets: [], setValueAtTime(v,t) {this.targets.push([v,t]);},
    setTargetAtTime(v,t) {this.targets.push([v,t]);}, linearRampToValueAtTime() {}};
}
function node() {
  return {connect(other) {return other;}, gain:param(), frequency:param(), detune:param(),
    setPeriodicWave() {}, addEventListener() {}, start() {}, stop(t) {this.end=t;}};
}
const ctx = {currentTime:2, createOscillator:node,createGain:node,createPeriodicWave() {}};
for (const seconds of [60,300,600]) {
  const a=playVoice(ctx,'yaman',216,0.15,seconds);
  const b=playVoice(ctx,'yaman',240,0.15,seconds);
  assert.equal(a.source.frequency.value,216);
  assert.equal(b.source.frequency.value,240);
  assert.deepEqual(a.source.detune.targets,b.source.detune.targets);
  assert.deepEqual(a.source.detune.targets.slice(0,3).map(([v])=>v),[-100,200,400]);
  assert.ok(a.source.detune.targets.some(([v])=>v===600));
  assert.equal(a.source.end,2+seconds);
  a.tune(432); assert.deepEqual(a.source.frequency.targets.at(-1),[432,2]);
}
console.log('Yaman phrase, transposition, retuning and duration checks passed');
