# Core-aura Sound Studio

Version 0.7.0 is a local sound generator with pure tone and four synthesized instrument presets for desktop and mobile browsers. Select 20–12,000 Hz, adjust volume, choose a timer, and press Play. The web app can cache its player for offline use after the first successful online visit. See [the development blueprint](docs/core-aura-blueprint.md) for the instrument, raga, and native app roadmap.

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
bash ops/verify.sh 0.7.0
```

DNS must route core-aura.coreeye.in to this server. After reload, allow time for certificate issuance and run the verifier again if needed. If you already defined the hostname in Caddy, update that site block from the supplied configuration. Keep one site definition for the hostname.

For updates fetch the supplied revision, fast-forward the checkout, and run the deploy script with the exact release commit or tag. To roll back, run it with the preceding compatible commit and verify that version. No Caddy reload is needed for a routine static asset update. On Android open the HTTPS site in Chrome and choose Install app or Add to Home screen if offered.

## Developer checks

Serve web/ on localhost:8089 with Python's http.server. With Playwright installed, run node tests/studio.cjs from another terminal. Set CHROMIUM_PATH to use a system Chromium executable. The checks cover UI playback, measured oscillator pitch, offline reload, and narrow layout.

## Raga Yaman pilot

Choose Raga Yaman under Sound. The melody and optional drone share one tonic. Four original timed phrases repeat with short breaths, using an equal-tempered approximation and pitch slides. Changing Sa transposes both layers during playback. The study runs offline and can be saved like other sessions. Practitioner review is pending.

Musical references: [Tanarang](https://tanarang.com/raag-yaman/) and [KalaSudha](https://kalasudha.com/en-us/raga/yaman).

## Chakra mixer

The Chakra Healing tab uses the modern Solfeggio mapping of Root 396, Sacral 417, Solar plexus 528, Heart 639, Throat 741, Third eye 852 and Crown 963 Hz. This is a selected spiritual meditation mapping, with variations across sources. Mapping reference: https://aroshanti.com/solfeggio-frequencies-and-the-chakras/

Each row supports sine or triangle wave, selection, play/resume, pause and stop. Play selected adds or resumes selected channels. Play all adds or resumes all seven. Stop all resets the mixer. Pausing suspends the channel audio clock, including its timer. Stop a channel before changing its sound type or duration. The combined oscillator gain is bounded for seven simultaneous channels. Returning to Sound Studio ends the chakra mix.

Run node tests/chakra.mjs for isolated audio lifecycle checks. Device listening and mobile layout verification remain part of the release check.

## Phone interface v0.7.0

The default layout is one phone column. Sound Studio and Chakra Healing live in a fixed bottom navigation bar, above the device safe area. The active screen places its transport controls directly above that bar. Chakra rows contain selection, frequency, sound type, independent transport and playback status. The page reserves scroll space for both fixed bars. Large screens retain a centered app column.

Browser checks cover overflow and dock placement at 320, 360, 390 and 430 pixel widths. Browser execution is pending where Chromium cannot launch.

## App screens v0.7.0

Studio, Chakras and Library are individual bottom-navigation destinations. Studio and chakra channels use a single Play/Pause/Resume control alongside Stop. The chakra mix has a Selected/All selector and the same transport behavior. Library retains existing saved studio sessions. The paused audio clock preserves session time.

The touch layout uses the available width, including devices with a desktop-sized layout viewport. A head script requests the phone's screen width when a coarse pointer, phone-sized screen and oversized viewport are detected. User zoom remains enabled. Validate scaling on the actual device because desktop-site settings and embedded browsers vary.
