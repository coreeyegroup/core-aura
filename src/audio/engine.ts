import { Channel } from "../model";
export type VoiceState = {
  id: string;
  status: "playing" | "paused" | "pausing" | "stopping";
  time: number;
};
export class AudioEngine {
  private context?: AudioContext;
  private node?: AudioWorkletNode;
  private analyser?: AnalyserNode;
  private connecting?: Promise<void>;
  private listeners = new Set<() => void>();
  private states: VoiceState[] = [];
  private generation = 0;
  public master = 0.5;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  snapshot = () => this.states;
  private notify() {
    for (const fn of this.listeners) fn();
  }
  private async connect() {
    if (this.node) {
      await this.context!.resume();
      return;
    }
    if (this.connecting) return this.connecting;
    this.connecting = (async () => {
      const context = new AudioContext({ latencyHint: "playback" });
      this.context = context;
      try {
        await context.resume();
        await context.audioWorklet.addModule("/mixer-worklet.js");
        const node = new AudioWorkletNode(context, "core-aura-mixer", {
          numberOfInputs: 0,
          numberOfOutputs: 1,
          outputChannelCount: [1],
        });
        const analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        node.connect(analyser).connect(context.destination);
        this.analyser = analyser;
        node.port.onmessage = ({ data }) => {
          this.states = data;
          this.notify();
        };
        this.node = node;
        this.setMaster(this.master);
      } catch (error) {
        await context.close();
        this.context = undefined;
        throw error;
      } finally {
        this.connecting = undefined;
      }
    })();
    return this.connecting;
  }
  async play(channel: Channel) {
    const token = this.generation;
    await this.connect();
    if (token !== this.generation) return;
    const state = this.states.find((s) => s.id === channel.id);
    if (state) this.node!.port.postMessage({ type: "resume", id: channel.id });
    else {
      this.node!.port.postMessage({ type: "start", channel });
      this.states = [
        ...this.states,
        { id: channel.id, status: "playing", time: 0 },
      ];
    }
    this.notify();
  }
  async toggle(channels: Channel[]) {
    if (
      channels.some(
        (c) => this.states.find((s) => s.id === c.id)?.status === "playing",
      )
    ) {
      channels.forEach((c) => this.pause(c.id));
    } else {
      await Promise.all(channels.map((c) => this.play(c)));
    }
  }
  pause(id: string) {
    this.node?.port.postMessage({ type: "pause", id });
  }
  stop(id: string) {
    this.node?.port.postMessage({ type: "stop", id });
  }
  stopAll() {
    this.generation++;
    this.node?.port.postMessage({ type: "clear" });
  }
  patch(channel: Channel) {
    this.node?.port.postMessage({
      type: "patch",
      id: channel.id,
      patch: { hz: channel.hz, volume: channel.volume, muted: channel.muted },
    });
  }
  readWaveform(data: Float32Array<ArrayBuffer>) {
    if (this.analyser) this.analyser.getFloatTimeDomainData(data);
    else data.fill(0);
  }
  setMaster(value: number) {
    this.master = value;
    this.node?.port.postMessage({ type: "master", value });
  }
}
export const engine = new AudioEngine();
