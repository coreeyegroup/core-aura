# Chakra mixer — v0.20.0

This release focuses on chakra audio and a compact mobile mixer. The seven existing modern Solfeggio mappings remain fixed; no medical efficacy is implied.

## Controls

- Each row: selection, fixed Hz and frequency type, one Play/Pause/Resume button, Stop, sound type, level, mute, Solo, focus and remaining time.
- Group: selected combination or all seven. Pause reaches all active chakra channels; Stop reaches all chakra channels even if selection has changed or is empty. On the next group Play, channels outside the target are stopped.
- Timer and master volume appear once above the mixer. Timer/sound changes require stopping affected audio. Timer presets range from one minute to one hour; existing custom durations remain supported.
- Mix tools apply one sound to all channels, reset levels to 25% and unmute, or stop/clear selection. Supported sounds are pure sine, triangle, bowl, flute and bell. Instruments include harmonics/resonant partials rather than a single pure frequency.
- Solo stops other audio voices and plays/resumes the chosen chakra. Explicitly muted Solo is unmuted; its level remains unchanged. Zero levels and mute are visible.
- Existing display text-size, spacing and theme controls remain available. The layout wraps at large text sizes and keeps phone touch controls at least 44px.
- Settings and selected channels restore after reload. Save stores the current group in Library, including sound, level, mute, duration and master.

## Fixes

Previously the group Stop controlled only the current selection, leaving deselected/individually started channels outside it. Group Stop now controls the whole chakra mixer. Paused voices no longer contribute to mix normalization, so they do not attenuate a playing voice. Resume updates the UI immediately; a stopping voice is restarted cleanly. Chakra rows resolve settings by ID rather than relying on array order.

## Deployment

Run in ~/core-aura:

```bash
git pull --ff-only origin main
sudo bash ops/deploy.sh origin/main
sudo bash ops/start-backend.sh
sudo bash ops/publish-android.sh
bash ops/verify.sh 0.20.0
curl -fsS https://core-aura.coreeye.in/android/latest.json
```

The main workflow must publish android-v0.20.0 build inputs first. Keep the existing VPS signing identity. Install through Settings → Android app updates; approve the Android Update prompt. A stable 0.19.0 installation should not be uninstalled. The old ephemeral 0.18.0 debug build still requires the documented one-time migration.

## Acceptance

Verify individual audible play, pause/resume and Stop; mute/level; Solo; selected pair and all seven; group pause and Stop after deselection; bulk sound; Save and restore. Check narrow phone layouts and enlarged text. The next stable APK acceptance includes checking saved data persists across the signed update. Physical Android behavior still needs checking on the actual handset.
