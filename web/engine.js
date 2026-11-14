export function createTone(context, hz, volume, seconds) {
  const start = context.currentTime;
  const end = start + seconds;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const envelope = context.createGain();
  oscillator.frequency.value = hz;
  gain.gain.value = volume * 0.15;
  envelope.gain.setValueAtTime(0, start);
  envelope.gain.linearRampToValueAtTime(1, start + 0.025);
  envelope.gain.setValueAtTime(1, end - 0.03);
  envelope.gain.linearRampToValueAtTime(0, end);
  oscillator.connect(gain).connect(envelope).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(end);
  return { oscillator, gain, envelope };
}

// Each row contains a frequency ratio, relative level and decay time in seconds.
// These are original synthesis presets for the listening pilot.
export const instruments = {
  sine: {label: 'Pure tone', tuning: 'Frequency', min: 20, max: 12000},
  flute: {label: 'Bansuri-style flute', tuning: 'Fundamental', min: 180, max: 1200, period: 3, attack: 0.12,
    modes: [[1, 0.76, Infinity], [2, 0.15, Infinity], [3, 0.065, Infinity]]},
  drum: {label: 'Tuned drum', tuning: 'Drum resonance', min: 60, max: 600, period: 0.9, attack: 0.004,
    modes: [[1, 0.62, 0.19], [1.5, 0.23, 0.08], [2.38, 0.15, 0.035]]},
  bell: {label: 'Bell', tuning: 'Bell resonance', min: 180, max: 1200, period: 3, attack: 0.006,
    modes: [[1, 0.53, 0.82], [2.4, 0.28, 0.57], [3.01, 0.12, 0.42], [4.18, 0.07, 0.23]]},
  bowl: {label: 'Struck singing bowl', tuning: 'Bowl resonance', min: 100, max: 850, period: 5, attack: 0.035,
    modes: [[1, 0.48, 2.2], [1.006, 0.29, 2.1], [2.71, 0.16, 1.1], [4.12, 0.07, 0.75]]}
};

export function renderInstrument(id, sampleRate) {
  if (id === "tanpura") return renderDrone(sampleRate);
  const spec = instruments[id];
  const samples = new Float32Array(Math.round(sampleRate * spec.period));
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate;
    const release = id === 'flute' ? 0.32 : 0.08;
    const edge = Math.min(1, t / spec.attack, (samples.length - 1 - i) / (sampleRate * release));
    const phase = 2 * Math.PI * 432 * t;
    const breath = id === 'flute' ? 0.18 * Math.sin(2 * Math.PI * 4.8 * t) : 0;
    let value = 0;
    for (const [ratio, level, decay] of spec.modes) {
      value += level * Math.exp(-t / decay) * Math.sin((phase + breath) * ratio);
    }
    samples[i] = value * edge;
  }
  return samples;
}

export function playVoice(context, id, hz, volume, seconds) {
  let source, gain, envelope, pitch, reference;
  if (id === 'sine') {
    const tone = createTone(context, hz, volume, seconds);
    source = tone.oscillator;
    ({gain, envelope} = tone);
    pitch = source.frequency;
    reference = 1;
  } else {
    const samples = renderInstrument(id, context.sampleRate);
    const buffer = context.createBuffer(1, samples.length, context.sampleRate);
    buffer.copyToChannel(samples, 0);
    source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    reference = 432;
    pitch = source.playbackRate;
    pitch.value = hz / reference;
    gain = context.createGain();
    gain.gain.value = volume * 0.15;
    envelope = context.createGain();
    source.connect(gain).connect(envelope).connect(context.destination);
    const start = context.currentTime;
    envelope.gain.setValueAtTime(1, start + seconds - 0.03);
    envelope.gain.linearRampToValueAtTime(0, start + seconds);
    source.start(start);
    source.stop(start + seconds);
  }
  return {
    source, gain, envelope,
    tune(value) { pitch.setTargetAtTime(value / reference, context.currentTime, 0.012); }
  };
}

// A four-pluck cycle. The reference Sa is 432 Hz, and the last string is low Sa.
function renderDrone(sampleRate) {
  const spacing = 0.85;
  const ratios = [0.75, 1, 1, 0.5];
  const samples = new Float32Array(Math.round(sampleRate * spacing * ratios.length));
  for (const [string, ratio] of ratios.entries()) {
    const offset = Math.round(string * spacing * sampleRate);
    for (let i = 0; i < samples.length; i++) {
      const time = i / sampleRate;
      const phase = 2 * Math.PI * 432 * ratio * time;
      const shape = Math.min(1, time / 0.018, (samples.length - 1 - i) / (sampleRate * 0.08));
      const body = Math.sin(phase) + 0.38 * Math.sin(2 * phase) + 0.2 * Math.sin(3 * phase);
      samples[(offset + i) % samples.length] += 0.29 * shape * Math.exp(-1.75 * time) * body;
    }
  }
  return samples;
}
