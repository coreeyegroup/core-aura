import {chakras, ChakraPlayer} from './chakra-audio.js';
const panel = document.querySelector('#chakra-panel');
const cards = document.querySelector('#chakra-cards');
export const player = new ChakraPlayer(undefined, refresh);
for (const [index,[name,hz,color]] of chakras.entries()) {
  const card = document.createElement('article');
  card.className = 'chakra-card';
  card.style.setProperty('--chakra-color',color);
  card.innerHTML = `<div class="chakra-title"><label><input type="checkbox" data-select> ${name}</label><strong>${hz} <small>Hz</small></strong></div>
    <label class="wave-type">Sound type<select data-type aria-label="${name} frequency type"><option value="sine">Sine · pure tone</option><option value="triangle">Triangle · soft harmonics</option></select></label>
    <div class="transport" aria-label="${name} playback"><button data-play>Play</button><button data-stop disabled>Stop</button><output data-state>Ready</output></div>`;
  cards.append(card);
  card.querySelector('[data-play]').onclick = () => run(() =>
    player.voices.get(index)?.state === 'playing' ? player.pause(index) : start(index));
  card.querySelector('[data-stop]').onclick = () => run(() => player.stop(index));
}
function refresh() {
  [...cards.children].forEach((card,index) => {
    const state = player.voices.get(index)?.state;
    card.querySelector('[data-state]').textContent = state || 'Ready';
    card.querySelector('[data-play]').textContent = state === 'playing' ? 'Pause' : state === 'paused' ? 'Resume' : 'Play';
    card.querySelector('[data-play]').disabled = state === 'starting';
    card.querySelector('[data-stop]').disabled = !state;
    card.querySelector('[data-type]').disabled = Boolean(state);
    card.classList.toggle('is-playing', state === 'playing');
  });
  const anyPlaying = [...player.voices.values()].some(voice => voice.state === 'playing');
  panel.querySelector('[data-action="toggle"]').textContent = anyPlaying ? 'Pause' :
    player.voices.size ? 'Resume' : 'Play';
  panel.querySelector('[data-action="stop"]').disabled = !player.voices.size;
  document.querySelector('#mix-target').disabled = Boolean(player.voices.size);
}
async function run(action) {
  try { document.querySelector('#chakra-message').textContent = ''; await action(); }
  catch { document.querySelector('#chakra-message').textContent = 'Audio could not start. Check your audio output and try again.'; }
}
function start(index) {
  return player.play(index,cards.children[index].querySelector('[data-type]').value,Number(document.querySelector('#chakra-duration').value));
}
panel.querySelector('[data-action="toggle"]').onclick = () => run(async () => {
  const active = [...player.voices.keys()];
  if ([...player.voices.values()].some(voice => voice.state === 'playing')) {
    await Promise.all(active.map(i => player.pause(i)));
    return;
  }
  if (active.length) { await Promise.all(active.map(start)); return; }
  const all = document.querySelector('#mix-target').value === 'all';
  const selected = [...cards.children].map((card,i) => all || card.querySelector('[data-select]').checked ? i : -1).filter(i => i >= 0);
  if (!selected.length) { document.querySelector('#chakra-message').textContent = 'Select at least one chakra.'; return; }
  await Promise.all(selected.map(start));
});
panel.querySelector('[data-action="stop"]').onclick = () => run(() => player.stopAll());
document.querySelector('#chakra-volume').oninput = event => {
  player.setVolume(event.target.valueAsNumber / 100);
  document.querySelector('#chakra-level').textContent = event.target.value + '%';
};
export function stopChakras() { return player.stopAll(); }

refresh();
