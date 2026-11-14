import {playVoice, instruments} from './engine.js';
const $ = selector => document.querySelector(selector);
const freq = $('#freq'), volume = $('#volume'), duration = $('#duration');
const instrument = $('#instrument');
for (const [id, spec] of Object.entries(instruments)) {
  instrument.add(new Option(spec.label, id));
}
instrument.onchange = () => {
  const spec = instruments[instrument.value];
  freq.min = spec.min;
  freq.max = spec.max;
  if (!freq.validity.valid) freq.value = 432;
  $('#tone').textContent = spec.label;
  $('#tuning').textContent = spec.tuning + ' (Hz)';
  updateFrequency();
};
let context, tone;
function updateFrequency() {
  if (!freq.validity.valid) return;
  const hz = freq.valueAsNumber;
  $('#readout').textContent = String(hz);
  if (tone) tone.tune(hz);
  const canvas = $('canvas'), pen = canvas.getContext('2d');
  canvas.width = 800; canvas.height = 120;
  pen.beginPath(); pen.strokeStyle = '#c8dfa5'; pen.lineWidth = 3;
  for (let x = 0; x < canvas.width; x++) {
    const y = 60 + 42 * Math.sin(x / 800 * 2 * Math.PI * (2 + Math.log2(hz / 20)));
    if (x === 0) pen.moveTo(x,y); else pen.lineTo(x,y);
  }
  pen.stroke();
}
freq.oninput = updateFrequency;
for (const preset of document.querySelectorAll('[data-hz]')) {
  preset.onclick = () => { freq.value = preset.dataset.hz; updateFrequency(); };
}
volume.oninput = () => {
  $('#level').textContent = volume.value + '%';
  if (tone) tone.gain.gain.setTargetAtTime(volume.valueAsNumber / 100 * 0.15, context.currentTime, 0.015);
};
$('form').onsubmit = async event => {
  event.preventDefault();
  if ($('#play').disabled) return;
  $('#play').disabled = true;
  try {
    context ??= new AudioContext();
    await context.resume();
    tone = playVoice(context, instrument.value, freq.valueAsNumber, volume.valueAsNumber / 100, Number(duration.value));
    instrument.disabled = true; duration.disabled = true; $('#stop').disabled = false;
    $('#status').textContent = instrument.value === 'sine' ? 'Playing sine tone' : 'Playing ' + instruments[instrument.value].label;
    tone.source.onended = () => {
      tone.source.disconnect(); tone.gain.disconnect(); tone.envelope.disconnect(); tone = null;
      instrument.disabled = false; duration.disabled = false; $('#play').disabled = false; $('#stop').disabled = true;
      $('#status').textContent = 'Session ended';
    };
  } catch {
    $('#status').textContent = 'Audio could not start. Check browser audio support and try again.';
    $('#play').disabled = false;
  }
};
$('#stop').onclick = () => {
  if (!tone) return;
  const now = context.currentTime;
  tone.envelope.gain.cancelScheduledValues(now);
  tone.envelope.gain.setTargetAtTime(0, now, 0.004);
  tone.source.stop(now + 0.025);
  $('#stop').disabled = true;
};
updateFrequency();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
