import { Channel, generatedAccompaniment } from "../model";
import { trackBlob } from "../tracks/storage";
import { TrackPlayer, TrackLevel } from "./tracks";
import { signalOtherAudio } from "./activity";
export type VoiceState = {
  id: string;
  status: "playing" | "paused" | "pausing" | "stopping";
  time: number;
  duration?: number;
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
  private tracks = new TrackPlayer(async () => {
    await this.connect();
    return {context: this.context!, analyser: this.analyser!};
  }, () => this.refresh());
  async toggleSoundtrack(id: string, load: () => Promise<Blob>, level: TrackLevel) {
    signalOtherAudio();
    await this.tracks.toggle(id, load, level);
  }
  resumeSoundtrack(id: string) { return this.tracks.resume(id); }
  patchSoundtrack(id: string, level: TrackLevel) { this.tracks.patch(id,level); }
  seekSoundtrack(id: string, seconds: number) { this.tracks.seek(id,seconds); }
  private voiceStates: VoiceState[] = [];
  private linked = new Map<string, { seen: boolean; parts: string[]; file?: string; paused: boolean }>();

  private stopLinked(id: string) {
    const linked = this.linked.get(id);
    if (!linked) return;
    this.linked.delete(id);
    linked.parts.forEach(part => this.stop(part));
    if (linked.file) this.tracks.stop(linked.file);
  }

  private async playLinked(parent: Channel) {
    const parts = generatedAccompaniment(parent), file = parent.accompaniment?.audio;
    if (!parts.length && !file) return;
    const linked = this.linked.get(parent.id) ?? {
      seen: false, paused: false, parts: parts.map(part => part.id),
      file: file ? "track:linked:" + parent.id : undefined,
    };
    linked.paused = false;
    this.linked.set(parent.id, linked);
    try {
      await Promise.all([
        ...parts.map(part => this.play(part, { preview: true })),
        ...(file && linked.file ? [this.tracks.play(linked.file, () => trackBlob(file.id),
          { ...file, muted: parent.muted })] : []),
      ]);
      if (this.linked.get(parent.id) === linked && linked.paused)
        linked.parts.forEach(part => this.pause(part));
      if (this.linked.get(parent.id) === linked && linked.paused && linked.file)
        this.tracks.pause(linked.file);
    } catch (e) {
      if (this.linked.get(parent.id) !== linked) return;
      this.stopLinked(parent.id);
      this.stop(parent.id);
      throw e;
    }
  }

  private refresh() {
    const r = this.recording;
    this.states = [
      ...this.voiceStates,
      ...this.tracks.snapshot(),
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
    ].filter(state => !state.id.startsWith("linked:") && !state.id.startsWith("track:linked:"));
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
  async playOverlay(
    load: () => Promise<ArrayBuffer>,
    volume: number,
    signal: AbortSignal,
  ) {
    signal.throwIfAborted();
    await this.connect();
    signal.throwIfAborted();
    const buffer = await this.context!.decodeAudioData(await load());
    signal.throwIfAborted();
    if (buffer.duration > 65)
      throw Error("Personal recordings must be at most 60 seconds.");
    const context = this.context!,
      source = context.createBufferSource(),
      gain = context.createGain();
    source.buffer = buffer;
    gain.gain.setValueAtTime(0, context.currentTime);
    gain.gain.linearRampToValueAtTime(
      Math.max(0, Math.min(1, volume)) * 0.65,
      context.currentTime + 0.02,
    );
    source.connect(gain);
    gain.connect(this.analyser!);
    return new Promise<void>((resolve, reject) => {
      let done = false;
      const abort = () => {
        if (done) return;
        done = true;
        gain.gain.cancelScheduledValues(context.currentTime);
        gain.gain.setTargetAtTime(0, context.currentTime, 0.006);
        source.stop(context.currentTime + 0.035);
        reject(new DOMException("Playback cancelled", "AbortError"));
      };
      source.onended = () => {
        signal.removeEventListener("abort", abort);
        source.disconnect();
        gain.disconnect();
        if (!done) {
          done = true;
          resolve();
        }
      };
      signal.addEventListener("abort", abort, { once: true });
      source.start();
      if (signal.aborted) abort();
    });
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
  unlock() {
    return this.connect();
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
        const limiter = context.createDynamicsCompressor();
        limiter.threshold.value = -3;
        limiter.knee.value = 6;
        limiter.ratio.value = 20;
        limiter.attack.value = .003;
        limiter.release.value = .15;
        node.connect(analyser).connect(limiter).connect(context.destination);
        this.analyser = analyser;
        node.port.onmessage = ({ data }) => {
          this.voiceStates = data;
          for (const [id, linked] of this.linked) {
            if (this.voiceStates.some(state => state.id === id)) linked.seen = true;
            else if (linked.seen) this.stopLinked(id);
          }
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
  async play(channel: Channel, options: {preview?:boolean} = {}) {
    if (!options.preview && channel.id !== "manifest-background" && !channel.id.startsWith("manifest-background:")) signalOtherAudio();
    const token = this.generation;
    const voiceToken = this.voiceGeneration.get(channel.id) || 0;
    await this.connect();
    if (
      token !== this.generation ||
      voiceToken !== (this.voiceGeneration.get(channel.id) || 0)
    )
      return;
    this.stopRecording();
    const state = this.voiceStates.find((s) => s.id === channel.id);
    if (state && state.status !== "stopping") {
      this.node!.port.postMessage({ type: "resume", id: channel.id });
      this.voiceStates = this.voiceStates.map(s=>s.id===channel.id ? {...s,status:"playing"} : s);
    }
    else {
      this.node!.port.postMessage({ type: "start", channel });
      this.voiceStates = [
        ...this.voiceStates.filter(s=>s.id!==channel.id),
        { id: channel.id, status: "playing", time: 0 },
      ];
    }
    this.refresh();
    if (channel.accompaniment) await this.playLinked(channel);
  }
  async resume(id: string) {
    const token=this.generation, voice=this.voiceGeneration.get(id)||0;
    await this.connect();
    if(token!==this.generation || voice!==(this.voiceGeneration.get(id)||0) || !this.states.some(s=>s.id===id && s.status!=="stopping"))return;
    if(id.startsWith("track:")) {await this.tracks.resume(id);return;}
    if(this.recording?.id===id) {this.startRecording();return;}
    this.node!.port.postMessage({type:"resume",id});
    this.voiceStates=this.voiceStates.map(s=>s.id===id?{...s,status:"playing"}:s);this.refresh();
    const linked = this.linked.get(id);
    if (linked) {
      linked.paused = false;
      for (const part of linked.parts) {
        if (this.voiceStates.some(state => state.id === part)) this.node!.port.postMessage({ type: "resume", id: part });
      }
      if (linked.file) await this.tracks.resume(linked.file);
    }
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
    const linked = this.linked.get(id);
    if (linked) {
      linked.paused = true;
      linked.parts.forEach(part => this.pause(part));
      if (linked.file) this.tracks.pause(linked.file);
    }
    if (id.startsWith("track:")) { this.tracks.pause(id); return; }
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
    this.voiceGeneration.set(id, (this.voiceGeneration.get(id) || 0) + 1);
    this.node?.port.postMessage({ type: "pause", id });
  }
  stop(id: string) {
    this.stopLinked(id);
    if (id.startsWith("track:")) { this.tracks.stop(id); return; }
    this.voiceGeneration.set(id, (this.voiceGeneration.get(id) || 0) + 1);
    if (this.recording?.id === id) {
      this.stopRecording();
      return;
    }
    this.voiceStates=this.voiceStates.map(s=>s.id===id?{...s,status:"stopping"}:s);
    this.refresh();
    this.node?.port.postMessage({ type: "stop", id });
  }
  stopAll() {
    signalOtherAudio();
    this.tracks.stopAll();
    this.linked.clear();
    this.generation++;
    this.voiceGeneration.clear();
    this.stopRecording();
    this.voiceStates=this.voiceStates.map(s=>({...s,status:"stopping"}));
    this.refresh();
    this.node?.port.postMessage({ type: "clear" });
  }
  patch(channel: Channel) {
    if (channel.accompaniment) {
      generatedAccompaniment(channel).forEach(part => this.patch(part));
      const audio = channel.accompaniment.audio;
      if (audio) this.tracks.patch("track:linked:" + channel.id, { ...audio, muted: channel.muted });
    }
    this.node?.port.postMessage({
      type: "patch",
      id: channel.id,
      patch: { hz: channel.hz, volume: channel.volume, muted: channel.muted, intensity: channel.intensity ?? .5, focus: channel.focus ?? false, focusQ: channel.focusQ ?? .7, interval: channel.interval },
    });
  }
  readWaveform(data: Float32Array<ArrayBuffer>) {
    if (this.analyser) this.analyser.getFloatTimeDomainData(data);
    else data.fill(0);
  }
  setMaster(value: number) {
    this.master = value;
    this.tracks.setMaster(value);
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
