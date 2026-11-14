import {player as chakraPlayer, stopChakras} from './chakra.js';
import {playVoice, instruments} from './engine.js';
const $ = selector => document.querySelector(selector);
const freq = $('#freq'), volume = $('#volume'), duration = $('#duration');
const instrument = $('#instrument');
for (const [id, spec] of Object.entries(instruments)) {
  instrument.add(new Option(spec.label, id));
}
instrument.value = 'sine';
instrument.onchange = () => {
  const spec = instruments[instrument.value];
  const raga = instrument.value === 'yaman';
  $('#raga-info').hidden = !raga;
  if (raga) {
    freq.value = sa.validity.valid && sa.valueAsNumber >= 100 && sa.valueAsNumber <= 600 ? sa.value : 216;
    droneToggle.checked = true;
  }
  droneToggle.onchange();
  freq.min = spec.min;
  freq.max = spec.max;
  if (!freq.validity.valid) freq.value = 432;
  $('#tone').textContent = spec.label;
  $('#tuning').textContent = spec.tuning + ' (Hz)';
  updateFrequency();
};
let context, tone, drone, clockTimer;
const droneToggle = $('#drone'), sa = $('#sa'), mix = $('#mix');
droneToggle.onchange = () => {
  $('#drone-controls').hidden = !droneToggle.checked;
  sa.disabled = !droneToggle.checked || instrument.value === 'yaman';
};
sa.oninput = () => { if (drone && sa.validity.valid) drone.tune(sa.valueAsNumber); };
mix.oninput = () => {
  $('#mix-level').textContent = mix.value + '%';
  if (drone) drone.gain.gain.setTargetAtTime(mix.valueAsNumber / 100 * 0.15, context.currentTime, 0.015);
};
function updateFrequency() {
  if (!freq.validity.valid) return;
  const hz = freq.valueAsNumber;
  $('#readout').textContent = String(hz);
  if (instrument.value === 'yaman') {
    sa.value = freq.value;
    if (drone) drone.tune(hz);
  }
  if (tone) tone.tune(hz);
  const dial = $('#dial');
  dial.min = freq.min; dial.max = freq.max; dial.step = '0.1'; dial.value = hz;
  const midi = 69 + 12 * Math.log2(hz / 440);
  const nearest = Math.round(midi);
  const names = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
  const cents = Math.round((midi - nearest) * 100);
  $('#note').textContent = names[nearest % 12] + (Math.floor(nearest / 12) - 1) +
    ' · ' + (cents > 0 ? '+' : '') + cents + ' cents · set pitch';
  if (!tone) drawWave();
}
let scope, samples, frame;
function drawWave() {
  const canvas = $('canvas'), pen = canvas.getContext('2d');
  if (canvas.width !== 800) { canvas.width = 800; canvas.height = 120; }
  pen.clearRect(0, 0, canvas.width, canvas.height);
  if (scope) scope.getFloatTimeDomainData(samples);
  let peak = 0.02;
  if (scope) for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  pen.beginPath(); pen.strokeStyle = '#c8dfa5'; pen.lineWidth = 3;
  for (let x = 0; x < canvas.width; x++) {
    const y = 60 - (scope ? 48 * samples[Math.floor(x * samples.length / 800)] / peak : 0);
    if (x === 0) pen.moveTo(x,y); else pen.lineTo(x,y);
  }
  pen.stroke();
  if (scope) frame = requestAnimationFrame(drawWave);
}
$('#dial').oninput = () => { freq.value = $('#dial').value; updateFrequency(); };
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
  $('#play').disabled = true; $('#chakra').disabled = true;
  try {
    context ??= new AudioContext();
    await context.resume();
    tone = playVoice(context, instrument.value, freq.valueAsNumber, volume.valueAsNumber / 100, Number(duration.value));
    if (droneToggle.checked) {
      drone = playVoice(context, 'tanpura', sa.valueAsNumber, mix.valueAsNumber / 100, Number(duration.value));
    }
    scope = context.createAnalyser();
    scope.fftSize = 2048;
    samples = new Float32Array(scope.fftSize);
    tone.envelope.connect(scope);
    if (drone) drone.envelope.connect(scope);
    drawWave();
    const end = context.currentTime + Number(duration.value);
    const tick = () => {
      const remaining = Math.max(0, Math.ceil(end - context.currentTime));
      $('#clock').textContent = Math.floor(remaining / 60) + ':' + String(remaining % 60).padStart(2, '0');
    };
    tick();
    clockTimer = setInterval(tick, 250);
    droneToggle.disabled = true;
    $('#load').disabled = true;
    instrument.disabled = true; duration.disabled = true; $('#stop').disabled = false;
    $('#status').textContent = instrument.value === 'sine' ? 'Playing sine tone' : 'Playing ' + instruments[instrument.value].label;
    tone.source.onended = () => {
      for (const voice of [tone, drone].filter(Boolean)) {
        voice.source.disconnect(); voice.gain.disconnect(); voice.envelope.disconnect();
      }
      tone = null; drone = null;
      cancelAnimationFrame(frame);
      scope.disconnect(); scope = null; drawWave();
      clearInterval(clockTimer);
      $('#clock').textContent = '';
      droneToggle.disabled = false;
      refresh();
      instrument.disabled = false; duration.disabled = false; $('#play').disabled = false; $('#chakra').disabled = false; $('#stop').disabled = true;
      $('#status').textContent = 'Session ended';
    };
  } catch {
    for (const voice of [tone, drone].filter(Boolean)) {
      voice.source.stop(); voice.source.disconnect(); voice.gain.disconnect(); voice.envelope.disconnect();
    }
    tone = null; drone = null;
    $('#status').textContent = 'Audio could not start. Check browser audio support and try again.';
    $('#play').disabled = false; $('#chakra').disabled = false;
  }
};
$('#stop').onclick = () => {
  if (!tone) return;
  const now = context.currentTime;
  for (const voice of [tone, drone].filter(Boolean)) {
    voice.envelope.gain.cancelScheduledValues(now);
    voice.envelope.gain.setTargetAtTime(0, now, 0.004);
    voice.source.stop(now + 0.025);
  }
  $('#stop').disabled = true;
};
updateFrequency();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js', {updateViaCache: 'none'}).catch(() => {});

const key = 'core-aura.sessions.v1';
const saved = $('#saved'), notice = $('#notice');
function sessions() {
  return JSON.parse(localStorage.getItem(key) || '[]');
}
function refresh(selected) {
  try {
    const rows = sessions();
    saved.replaceChildren(...rows.map(row => new Option(row.name, row.name)));
    if (selected) saved.value = selected;
    $('#load').disabled = !saved.value || Boolean(tone);
    $('#remove').disabled = !saved.value;
  } catch { notice.textContent = 'Saved sessions are unavailable in this browser.'; }
}
$('#save').onclick = () => {
  const name = $('#name').value.trim();
  if (!name) { notice.textContent = 'Enter a session name.'; $('#name').focus(); return; }
  if (!$('form').reportValidity()) return;
  try {
    const rows = sessions();
    const existing = rows.find(row => row.name === name);
    if (existing && !confirm('Replace the settings for ' + name + '?')) return;
    const settings = {name, practice: activePractice, chakra: $('#chakra').value, instrument: instrument.value, hz: freq.value, volume: volume.value,
      seconds: duration.value, drone: droneToggle.checked, sa: sa.value, mix: mix.value};
    localStorage.setItem(key, JSON.stringify([...rows.filter(row => row.name !== name), settings]));
    refresh(name); notice.textContent = 'Saved on this device.';
  } catch { notice.textContent = 'This browser could not save the session.'; }
};
$('#load').onclick = () => {
  try {
    const row = sessions().find(row => row.name === saved.value);
    if (!row) { refresh(); return; }
    openPractice(row.practice === 'chakra' ? 'chakra' : 'studio', false);
    if (row.chakra && chakraNames.includes(row.chakra)) {
      $('#chakra').value = row.chakra;
      showFocus(false);
    }
    instrument.value = row.instrument; instrument.onchange();
    freq.value = row.hz; updateFrequency();
    volume.value = row.volume; volume.oninput(); duration.value = row.seconds;
    droneToggle.checked = row.drone; droneToggle.onchange(); sa.value = row.sa;
    mix.value = row.mix; mix.oninput(); $('#name').value = row.name;
    notice.textContent = 'Loaded ' + row.name + '. Press Play tone to begin.';
  } catch { notice.textContent = 'Unable to load these settings.'; }
};
$('#remove').onclick = () => {
  if (!confirm('Delete ' + saved.value + '?')) return;
  try {
    localStorage.setItem(key, JSON.stringify(sessions().filter(row => row.name !== saved.value)));
    refresh(); notice.textContent = 'Session deleted.';
  } catch { notice.textContent = 'Unable to delete this session.'; }
};
refresh();

$('#update').onclick = event => {
  if ($('#play').disabled || chakraPlayer.voices.size) {
    event.preventDefault();
    $('#status').textContent = 'Stop the session before updating.';
  }
};

const visited = new URL(location.href);
if (visited.searchParams.get('updated') === document.querySelector('.release span').textContent.slice(1)) {
  $('#status').textContent = 'App is up to date · ' + document.querySelector('.release span').textContent;
  visited.searchParams.delete('updated');
  history.replaceState(null, '', visited);
}

const chakraNames = ['Root', 'Sacral', 'Solar plexus', 'Heart', 'Throat', 'Third eye', 'Crown'];
const cues = [
  'Notice the contact between your feet and the floor.',
  'Follow one easy breath as you listen.',
  'Bring to mind one intention for today.',
  'Bring someone you care about to mind.',
  'Listen to the space after each sound.',
  'Let your attention rest on one point.',
  'Spend a few moments in quiet reflection.'
];
const steps = [0, 2, 4, 5, 7, 9, 11];
let activePractice = 'studio';
for (const name of chakraNames) $('#chakra').add(new Option(name,name));
function showFocus(setPitch) {
  const i = $('#chakra').selectedIndex;
  $('#reflection').textContent = cues[i];
  if (setPitch) {
    instrument.value = 'sine'; instrument.onchange();
    freq.value = (261.625565 * 2 ** (steps[i] / 12)).toFixed(2);
    updateFrequency();
  }
}
function openPractice(name, applyPreset = true) {
  if ($('#play').disabled) {
    $('#status').textContent = 'Stop playback to change practice.';
    history.replaceState(null, '', '#' + activePractice);
    return;
  }
  activePractice = name;
  const chakra = name === 'chakra';
  $('#chakra-panel').hidden = !chakra;
  for (const selector of ['.display', 'form', '.library']) $(selector).hidden = chakra;
  if (!chakra) stopChakras().catch(() => {});

  $('#mode-label').textContent = chakra ? 'Chakra meditation' : 'Sound Studio';
  document.body.classList.toggle('chakra', chakra);
  for (const link of document.querySelectorAll('nav a')) {
    if (link.hash === '#' + name) link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  }
  history.replaceState(null, '', '#' + name);

}
$('#chakra').onchange = () => showFocus(true);
for (const link of document.querySelectorAll('nav a')) {
  link.onclick = event => { event.preventDefault(); openPractice(link.hash.slice(1)); };
}
openPractice(location.hash === '#chakra' ? 'chakra' : 'studio');
