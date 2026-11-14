# Core-aura Sound Studio

Version 0.5.0 is a local sound generator with pure tone and four synthesized instrument presets for desktop and mobile browsers. Select 20–12,000 Hz, adjust volume, choose a timer, and press Play. The web app can cache its player for offline use after the first successful online visit. See [the development blueprint](docs/core-aura-blueprint.md) for the instrument, raga, and native app roadmap.

## Ubuntu installation

From the project checkout, deploy the supplied release commit. The installer uses a versioned directory and switches the active symlink atomically. The first version is static and needs only Git, standard Ubuntu tools, and Caddy.

```bash
cd ~/core-aura
sudo bash ops/deploy.sh HEAD
sudo install -m 644 ops/core-aura.caddy /etc/caddy/sites/core-aura.caddy
# On core-node the top-level Caddyfile imports each site individually.
# Skip this import step on hosts that already import sites/*.caddy.
if ! sudo grep -Fxq 'import /etc/caddy/sites/core-aura.caddy' /etc/caddy/Caddyfile; then
  printf '\nimport /etc/caddy/sites/core-aura.caddy\n' | sudo tee -a /etc/caddy/Caddyfile >/dev/null
fi
sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy
bash ops/verify.sh 0.5.0
```

DNS must route core-aura.coreeye.in to this server. After reload, allow time for certificate issuance and run the verifier again if needed. If you already defined the hostname in Caddy, update that site block from the supplied configuration. Keep one site definition for the hostname.

For updates fetch the supplied revision, fast-forward the checkout, and run the deploy script with the exact release commit or tag. To roll back, run it with the preceding compatible commit and verify that version. No Caddy reload is needed for a routine static asset update. On Android open the HTTPS site in Chrome and choose Install app or Add to Home screen if offered.

## Developer checks

Serve web/ on localhost:8089 with Python's http.server. With Playwright installed, run node tests/studio.cjs from another terminal. Set CHROMIUM_PATH to use a system Chromium executable. The checks cover UI playback, measured oscillator pitch, offline reload, and narrow layout.

## Raga Yaman pilot

Choose Raga Yaman under Sound. The melody and optional drone share one tonic. Four original timed phrases repeat with short breaths, using an equal-tempered approximation and pitch slides. Changing Sa transposes both layers during playback. The study runs offline and can be saved like other sessions. Practitioner review is pending.

Musical references: [Tanarang](https://tanarang.com/raag-yaman/) and [KalaSudha](https://kalasudha.com/en-us/raga/yaman).
