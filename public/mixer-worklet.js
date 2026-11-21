import { createGroupVoice, createState, sample } from "./dsp.js";
class CoreAuraMixer extends AudioWorkletProcessor {
  constructor() {
    super();
    this.channels = new Map();
    this.master = 0.5;
    this.report = 0;
    this.port.onmessage = ({ data }) => {
      if (data.type === "start")
        this.channels.set(data.channel.id, createState(data.channel));
      if (data.type === "start-group") {
        const count = data.channels.length;
        data.channels.forEach((channel, index) => this.channels.set(
          channel.id, count > 1 ? createGroupVoice(channel, index, count) : createState(channel),
        ));
      }
      if (data.type === "resume-group")
        for (const id of data.ids) {
          const voice = this.channels.get(id);
          if (voice) voice.status = "playing";
        }
      if (data.type === "master") this.master = data.value;
      if (data.type === "clear")
        for (const c of this.channels.values()) c.status = "stopping";
      const c = this.channels.get(data.id);
      if (!c) return;
      if (data.type === "pause" && c.status === "playing") c.status = "pausing";
      if (data.type === "resume") c.status = "playing";
      if (data.type === "stop") c.status = "stopping";
      if (data.type === "patch") Object.assign(c, data.patch);
    };
  }
  process(_, outputs) {
    const [out, right] = outputs[0];
    if (!out) return true;
    let weight = 0;
    for (const c of this.channels.values()) weight += c.muted || c.status === "paused" ? 0 : c.volume;
    const scale = (this.master * 0.65) / Math.max(1, weight);
    for (let i = 0; i < out.length; i++) {
      let leftSum = 0, rightSum = 0;
      for (const c of this.channels.values()) {
        const value = sample(c, sampleRate);
        c.mixGain = (c.mixGain ?? c.volume) + (c.volume - (c.mixGain ?? c.volume)) * Math.min(1, 1 / (sampleRate * .04));
        if (!c.muted) {
          const level = value * c.mixGain * (c.headroom ?? 1);
          leftSum += level * (c.left ?? 1);
          rightSum += level * (c.right ?? 1);
        }
      }
      out[i] = Math.max(-0.95, Math.min(0.95, (right ? leftSum : (leftSum + rightSum) / 2) * scale));
      if (right) right[i] = Math.max(-0.95, Math.min(0.95, rightSum * scale));
    }
    for (const [id, c] of this.channels)
      if (c.status === "ended") this.channels.delete(id);
    this.report += out.length;
    if (this.report >= sampleRate / 5) {
      this.report = 0;
      this.port.postMessage(
        [...this.channels.values()].map(({ id, status, time }) => ({
          id,
          status,
          time,
        })),
      );
    }
    return true;
  }
}
registerProcessor("core-aura-mixer", CoreAuraMixer);
