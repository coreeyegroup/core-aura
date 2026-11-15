import { Channel } from "../model";
import { signalOtherAudio } from "./activity";
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
  private voiceGeneration = new Map<string, number>();
  private recording?: {
    id: string;
    buffer: AudioBuffer;
    offset: number;
    startedAt: number;
    source?: AudioBufferSourceNode;
    gain: GainNode;
  };
  private voiceStates: VoiceState[] = [];
  private refresh() {
    const r = this.recording;
    this.states = [
      ...this.voiceStates,
      ...(r
        ? [
            {
              id: r.id,
              status: r.source ? ("playing" as const) : ("paused" as const),
              time:
                r.offset +
                (r.source ? this.context!.currentTime - r.startedAt : 0),
            },
          ]
        : []),
    ];
    this.notify();
  }
  private stopRecording() {
    const r = this.recording;
    if (!r) return;
    this.recording = undefined;
    if (r.source) {
      const source = r.source;
      r.gain.gain.cancelScheduledValues(this.context!.currentTime);
      r.gain.gain.setTargetAtTime(0, this.context!.currentTime, 0.006);
      source.onended = () => {
        source.disconnect();
        r.gain.disconnect();
      };
      source.stop(this.context!.currentTime + 0.035);
    } else r.gain.disconnect();
    this.refresh();
  }
  private startRecording() {
    const r = this.recording;
    if (!r || !this.context || r.source) return;
    const source = this.context.createBufferSource();
    source.buffer = r.buffer;
    source.connect(r.gain);
    r.source = source;
    r.startedAt = this.context.currentTime;
    r.gain.gain.cancelScheduledValues(this.context.currentTime);
    r.gain.gain.setValueAtTime(0, this.context.currentTime);
    r.gain.gain.linearRampToValueAtTime(
      this.master,
      this.context.currentTime + 0.03,
    );
    source.onended = () => {
      if (this.recording === r && r.source === source) {
        this.recording = undefined;
        source.disconnect();
        r.gain.disconnect();
        this.refresh();
      }
    };
    source.start(0, r.offset);
    this.refresh();
  }
  async toggleRecording(id: string, load: () => Promise<ArrayBuffer>) {
    if (this.recording?.id === id) {
      if (this.recording.source) this.pause(id);
      else {
        await this.context!.resume();
        this.startRecording();
      }
      return;
    }
    this.stopAll();
    const token = this.generation;
    await this.connect();
    const buffer = await this.context!.decodeAudioData(await load());
    if (token !== this.generation) return;
    const gain = this.context!.createGain();
    gain.gain.value = this.master;
    gain.connect(this.analyser!);
    this.recording = { id, buffer, offset: 0, startedAt: 0, gain };
    this.startRecording();
  }
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
          this.voiceStates = data;
          this.refresh();
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
    if (channel.id !== "manifest-background") signalOtherAudio();
    const token = this.generation;
    const voiceToken = this.voiceGeneration.get(channel.id) || 0;
    await this.connect();
    if (
      token !== this.generation ||
      voiceToken !== (this.voiceGeneration.get(channel.id) || 0)
    )
      return;
    this.stopRecording();
    const state = this.states.find((s) => s.id === channel.id);
    if (state) this.node!.port.postMessage({ type: "resume", id: channel.id });
    else {
      this.node!.port.postMessage({ type: "start", channel });
      this.voiceStates = [
        ...this.voiceStates,
        { id: channel.id, status: "playing", time: 0 },
      ];
    }
    this.refresh();
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
    const r = this.recording;
    if (r?.id === id && r.source) {
      r.offset += this.context!.currentTime - r.startedAt;
      const source = r.source;
      r.gain.gain.cancelScheduledValues(this.context!.currentTime);
      r.gain.gain.setTargetAtTime(0, this.context!.currentTime, 0.006);
      source.onended = () => source.disconnect();
      source.stop(this.context!.currentTime + 0.035);
      r.source = undefined;
      this.refresh();
      return;
    }
    this.node?.port.postMessage({ type: "pause", id });
  }
  stop(id: string) {
    this.voiceGeneration.set(id, (this.voiceGeneration.get(id) || 0) + 1);
    if (this.recording?.id === id) {
      this.stopRecording();
      return;
    }
    this.node?.port.postMessage({ type: "stop", id });
  }
  stopAll() {
    signalOtherAudio();
    this.generation++;
    this.voiceGeneration.clear();
    this.stopRecording();
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
    if (this.recording)
      this.recording.gain.gain.setTargetAtTime(
        value,
        this.context!.currentTime,
        0.02,
      );
    this.node?.port.postMessage({ type: "master", value });
  }
}
export const engine = new AudioEngine();
