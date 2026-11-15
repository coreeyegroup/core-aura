import { createState, sample } from "./dsp.js";
class CoreAuraMixer extends AudioWorkletProcessor {
  constructor() {
    super();
    this.channels = new Map();
    this.master = 0.5;
    this.report = 0;
    this.port.onmessage = ({ data }) => {
      if (data.type === "start")
        this.channels.set(data.channel.id, createState(data.channel));
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
    const out = outputs[0][0];
    if (!out) return true;
    let weight = 0;
    for (const c of this.channels.values()) weight += c.muted ? 0 : c.volume;
    const scale = (this.master * 0.65) / Math.max(1, weight);
    for (let i = 0; i < out.length; i++) {
      let sum = 0;
      for (const c of this.channels.values()) {
        const value = sample(c, sampleRate);
        if (!c.muted) sum += value * c.volume;
      }
      out[i] = Math.max(-0.95, Math.min(0.95, sum * scale));
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
