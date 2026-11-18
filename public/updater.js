const message = document.querySelector('#message');
const retry = document.querySelector('#retry');

function workerVersion(worker) {
  return new Promise(resolve => {
    const channel = new MessageChannel();
    function done(version) {
      clearTimeout(timer);
      channel.port1.close();
      resolve(version);
    }
    const timer = setTimeout(() => done(null), 300);
    channel.port1.onmessage = event => done(event.data);
    try { worker.postMessage('VERSION', [channel.port2]); } catch { done(null); }
  });
}

async function update() {
  retry.hidden = true;
  message.textContent = 'Checking for updates…';
  try {
    const response = await fetch('/health.json?t=' + Date.now(), {cache: 'no-store', signal: AbortSignal.timeout(12000)});
    if (!response.ok) throw new Error();
    const {version, status} = await response.json();
    if (status !== 'ok' || !version) throw new Error();
    const registration = await navigator.serviceWorker.register('/sw.js', {updateViaCache: 'none'});
    await registration.update();
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      const active = registration.active;
      if (active?.state === 'activated' && await workerVersion(active) === version) {
        message.textContent = 'Core-aura v' + version + ' is ready. Opening Core-aura…';
        location.replace('/?updated=' + encodeURIComponent(version));
        return;
      }
      message.textContent = 'Installing Core-aura v' + version + '…';
      registration.waiting?.postMessage('APPLY_UPDATE');
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    throw new Error();
  } catch {
    message.textContent = 'Could not finish the update. Check your connection and try again.';
    retry.hidden = false;
  }
}
retry.onclick = update;
update();
