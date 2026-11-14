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
    if (droneToggle.checked) {
      drone = playVoice(context, 'tanpura', sa.valueAsNumber, mix.valueAsNumber / 100, Number(duration.value));
    }
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
      clearInterval(clockTimer);
      $('#clock').textContent = '';
      droneToggle.disabled = false;
      refresh();
      instrument.disabled = false; duration.disabled = false; $('#play').disabled = false; $('#stop').disabled = true;
      $('#status').textContent = 'Session ended';
    };
  } catch {
    for (const voice of [tone, drone].filter(Boolean)) {
      voice.source.stop(); voice.source.disconnect(); voice.gain.disconnect(); voice.envelope.disconnect();
    }
    tone = null; drone = null;
    $('#status').textContent = 'Audio could not start. Check browser audio support and try again.';
    $('#play').disabled = false;
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
    const settings = {name, instrument: instrument.value, hz: freq.value, volume: volume.value,
      seconds: duration.value, drone: droneToggle.checked, sa: sa.value, mix: mix.value};
    localStorage.setItem(key, JSON.stringify([...rows.filter(row => row.name !== name), settings]));
    refresh(name); notice.textContent = 'Saved on this device.';
  } catch { notice.textContent = 'This browser could not save the session.'; }
};
$('#load').onclick = () => {
  try {
    const row = sessions().find(row => row.name === saved.value);
    if (!row) { refresh(); return; }
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
  if ($('#play').disabled) {
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
