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
