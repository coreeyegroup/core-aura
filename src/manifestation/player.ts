import { AudioEngine, engine } from "../audio/engine";
import { onOtherAudio } from "../audio/activity";
import { parsePlan, Plan, position } from "./model";
import { backgroundChannels } from "./background";
import { Channel } from "../model";
import { speech, SpeechDriver } from "./speech";
export type PracticeState = {
  status: "idle" | "playing" | "paused" | "completed" | "error";
  plan: Plan | null;
  step: number;
  elapsed: number;
  error: string;
};
export class ManifestPlayer {
  private state: PracticeState = {
    status: "idle",
    plan: null,
    step: 0,
    elapsed: 0,
    error: "",
  };
  private listeners = new Set<() => void>();
  private token = 0;
  private speaking = false;
  private clock?: ReturnType<typeof setInterval>;
  private wait?: ReturnType<typeof setTimeout>;
  private started = 0;
  private accumulated = 0;
  private unsubscribe: () => void;
  constructor(
    private voice: SpeechDriver = speech,
    private audio: Pick<AudioEngine, "stopAll" | "play" | "pause" | "stop"> & {
      unlock?: () => Promise<void>;
      patch?: (channel: Channel) => void;
    } = engine,
  ) {
    this.unsubscribe = onOtherAudio(() => this.stop());
  }
  snapshot = () => this.state;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  private update(patch: Partial<PracticeState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((f) => f());
  }
  private clear() {
    if (this.clock) clearInterval(this.clock);
    if (this.wait) clearTimeout(this.wait);
    this.clock = undefined;
    this.wait = undefined;
  }
  private clockStart() {
    this.started = Date.now();
    this.clock = setInterval(() => {
      const elapsed = this.accumulated + (Date.now() - this.started) / 1000;
      this.update({ elapsed });
      if (elapsed >= this.state.plan!.seconds) this.finish();
    }, 250);
  }
  start(value: Plan) {
    const plan = parsePlan(value);
    this.audio.stopAll();
    this.stop();
    this.accumulated = 0;
    this.update({ status: "playing", plan, step: 0, elapsed: 0, error: "" });
    this.speaking = plan.mode === "speech";
    if (plan.voice.startsWith("core:") || plan.useRecordings || plan.background || plan.backgroundMix)
      void this.audio.unlock?.().catch(() => {});
    this.clockStart();
    this.background();
    void this.run(this.token);
  }
  private background() {
    const p = this.state.plan, token = this.token;
    if (!p) return;
    for (const c of backgroundChannels(p,this.speaking)) {
      void this.audio.play(c).then(()=>{
        if (token === this.token && this.state.status === "playing") this.backgroundLevel();
      }).catch(()=>{
        if (token === this.token && this.state.status === "playing") {
          this.stopBackground();
          this.update({error:"The background sound could not start; the practice can continue."});
        }
      });
    }
  }
  private backgroundLevel() {
    if (this.state.plan) for (const c of backgroundChannels(this.state.plan,this.speaking)) this.audio.patch?.(c);
  }
  private stopBackground() {
    if (this.state.plan) for (const c of backgroundChannels(this.state.plan)) this.audio.stop(c.id);
    this.speaking = false;
  }
  updateBackground(patch: Partial<Plan>) {
    const current = this.state.plan;
    if (!current || !["playing","paused"].includes(this.state.status)) return;
    const next = parsePlan({...current,
      background:current.background ? {...current.background,volume:patch.background?.volume ?? current.background.volume} : null,
      backgroundMix:current.backgroundMix ? {...current.backgroundMix,volume:patch.backgroundMix?.volume ?? current.backgroundMix.volume} : null,
      backgroundDucking:patch.backgroundDucking ?? current.backgroundDucking,
      backgroundDuckLevel:patch.backgroundDuckLevel ?? current.backgroundDuckLevel});
    this.update({plan:next});
    this.backgroundLevel();
  }
  private async run(token: number) {
    const p = this.state.plan;
    if (!p || token !== this.token || this.state.status !== "playing") return;
    const current = position(p, this.state.step);
    try {
      this.speaking = p.mode === "speech";
      this.backgroundLevel();
      if (p.mode === "speech") {
        if (this.voice.speakLine)
          await this.voice.speakLine(p.lines[current.line], p);
        else await this.voice.speak(p.lines[current.line].text, p);
      } else
        await new Promise<void>((resolve) => {
          this.wait = setTimeout(resolve, p.readSeconds * 1000);
        });
      if (token !== this.token || this.state.status !== "playing") return;
      this.speaking = false;
      this.backgroundLevel();
      if (this.state.step + 1 >= p.lines.length * p.repeats) {
        this.finish();
        return;
      }
      this.wait = setTimeout(() => {
        if (token === this.token && this.state.status === "playing") {
          this.update({ step: this.state.step + 1 });
          void this.run(token);
        }
      }, p.gap * 1000);
    } catch (e) {
      if (token !== this.token) return;
      this.token++;
      this.clear();
      this.voice.stop();
      this.stopBackground();
      this.update({ status: "error", error: (e as Error).message });
    }
  }
  pause() {
    if (this.state.status !== "playing") return;
    this.accumulated += (Date.now() - this.started) / 1000;
    this.token++;
    this.clear();
    this.voice.stop();
    if (this.state.plan) for (const c of backgroundChannels(this.state.plan)) this.audio.pause(c.id);
    this.update({ status: "paused", elapsed: this.accumulated });
  }
  resume() {
    if (this.state.status !== "paused") return;
    this.update({ status: "playing" });
    this.clockStart();
    this.speaking = this.state.plan?.mode === "speech";
    this.background();
    void this.run(this.token);
  }
  stop() {
    if (this.state.status === "idle") return;
    this.token++;
    this.clear();
    this.voice.stop();
    this.stopBackground();
    this.accumulated = 0;
    this.update({ status: "idle", elapsed: 0, step: 0, error: "" });
  }
  private finish() {
    this.token++;
    this.clear();
    this.voice.stop();
    this.stopBackground();
    this.update({
      status: "completed",
      elapsed: Math.min(
        this.state.plan!.seconds,
        this.accumulated + (Date.now() - this.started) / 1000,
      ),
    });
  }
  dispose() {
    this.stop();
    this.unsubscribe();
  }
}
export const manifestPlayer = new ManifestPlayer();
