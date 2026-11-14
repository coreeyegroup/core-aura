export const chakras = [
  ['Root',396,'#b23c45'], ['Sacral',417,'#b85a22'], ['Solar plexus',528,'#987513'],
  ['Heart',639,'#287c55'], ['Throat',741,'#27739a'], ['Third eye',852,'#6758a0'], ['Crown',963,'#925f9a']
];

export class ChakraPlayer {
  constructor(createContext = () => new AudioContext(), onChange = () => {}) {
    this.createContext = createContext;
    this.onChange = onChange;
    this.voices = new Map();
    this.volume = 0.15;
  }
  async play(index, type, seconds) {
    const existing = this.voices.get(index);
    if (existing) {
      await existing.context.resume();
      existing.state = 'playing';
      this.onChange();
      return;
    }
    const context = this.createContext();
    const voice = {context, state:'starting', type};
    this.voices.set(index, voice);
    try {
      await context.resume();
      // A stopped pending start must never create an orphan oscillator.
      if (this.voices.get(index) !== voice) return;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const envelope = context.createGain();
      oscillator.type = type;
      oscillator.frequency.value = chakras[index][1];
      gain.gain.value = this.volume * 0.12 / 7;
      const now = context.currentTime;
      envelope.gain.setValueAtTime(0, now);
      envelope.gain.linearRampToValueAtTime(1, now + 0.03);
      envelope.gain.setValueAtTime(1, now + seconds - 0.04);
      envelope.gain.linearRampToValueAtTime(0, now + seconds);
      oscillator.connect(gain).connect(envelope).connect(context.destination);
      Object.assign(voice,{oscillator,gain,envelope,state:'playing'});
      oscillator.onended = () => {
        context.close().catch(() => {});
        if (this.voices.get(index) === voice) this.voices.delete(index);
        this.onChange();
      };
      oscillator.start();
      oscillator.stop(now + seconds);
      this.onChange();
    } catch (error) {
      if (this.voices.get(index) === voice) this.voices.delete(index);
      context.close().catch(() => {});
      this.onChange();
      throw error;
    }
  }
  async pause(index) {
    const voice = this.voices.get(index);
    if (!voice || voice.state !== 'playing') return;
    await voice.context.suspend();
    if (this.voices.get(index) === voice) voice.state = 'paused';
    this.onChange();
  }
  async stop(index) {
    const voice = this.voices.get(index);
    if (!voice) return;
    this.voices.delete(index);
    await voice.context.close();
    this.onChange();
  }
  setVolume(value) {
    this.volume = value;
    for (const voice of this.voices.values()) {
      voice.gain?.gain.setTargetAtTime(value * 0.12 / 7, voice.context.currentTime, 0.02);
    }
  }
  async stopAll() {
    await Promise.all([...this.voices.keys()].map(index => this.stop(index)));
  }
}
