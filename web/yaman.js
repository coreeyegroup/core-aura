// Original timed phrase study. Steps are semitones relative to the listener's Sa.
// Lower Ni, Re, Ga; tivra Ma is six semitones above Sa.
const phrases = [
  [[-1, 0.8], [2, 0.55], [4, 1.75], [2, 0.55], [0, 1.1]],
  [[-1, 0.55], [2, 0.5], [4, 0.9], [6, 0.8], [7, 1.25]],
  [[6, 0.6], [9, 0.6], [11, 1.3], [12, 0.9], [11, 1.1]],
  [[9, 0.55], [7, 0.85], [6, 0.6], [4, 1.4], [2, 0.65], [0, 1.75]]
];

export function playYaman(context, sa, volume, seconds) {
  const source = context.createOscillator();
  const real = new Float32Array(4);
  source.setPeriodicWave(context.createPeriodicWave(real, Float32Array.of(0, 1, 0.17, 0.075)));
  source.frequency.value = sa;
  const gain = context.createGain();
  gain.gain.value = volume * 0.15;
  const breath = context.createGain();
  const envelope = context.createGain();
  source.connect(breath).connect(gain).connect(envelope).connect(context.destination);
  const start = context.currentTime;
  const end = start + seconds;
  let time = start;
  let phraseIndex = 0;
  while (time < end) {
    const phrase = phrases[phraseIndex++ % phrases.length];
    breath.gain.setValueAtTime(0, time);
    breath.gain.linearRampToValueAtTime(0.85, time + 0.055);
    for (const [index, [step, duration]] of phrase.entries()) {
      if (index === 0) source.detune.setValueAtTime(step * 100, time);
      else source.detune.setTargetAtTime(step * 100, time, 0.045);
      time += duration;
    }
    breath.gain.setValueAtTime(0.85, time - 0.12);
    breath.gain.linearRampToValueAtTime(0, time);
    time += 0.45;
  }
  envelope.gain.setValueAtTime(1, end - 0.05);
  envelope.gain.linearRampToValueAtTime(0, end);
  source.addEventListener('ended', () => breath.disconnect(), {once: true});
  source.start(start);
  source.stop(end);
  return {source, gain, envelope, tune(value) {
    source.frequency.setTargetAtTime(value, context.currentTime, 0.012);
  }};
}
