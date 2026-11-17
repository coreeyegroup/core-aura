# Core-aura

Core-aura 0.22.0 is a manifestation, sound-generation and personal meditation application. React and TypeScript provide the shared phone interface. An AudioWorklet mixes tunable tones, synthesized instruments, two raga phrase studies and seven chakra channels on the listening device.

## Development

Use Node.js 22.

```bash
npm ci
npm run dev
npm test
npm run build
```

The build output is dist/. The production player needs HTTPS, including for its real-time AudioWorklet. Localhost is supported for development.

## Manifestation

Home is the starting workspace: current practice, saved counts, eight tool shortcuts, affirmation categories, saved-practice transport, upcoming reminders and quick tone setup. Manifest is the practice editor. Choose single/multiple affirmations from eight categories, write your own sentences, set sequence/each repetition, speak or read silently, add a background tone and save practices. Schedule weekday reminders or export calendar reminders. Schedules default to reminder → tap Play, with optional visible/idle auto-start. The category/affirmation library supports add, rename/edit, move, delete and JSON backup on this device. Every affirmation has a Play preview; selected sentences can use personal microphone recordings or imported PCM WAV files. Personal recordings export as portable WAV; saved practices have direct Play/Pause controls. Opt-in web push reminders work through the PostgreSQL reminder worker; closed-app automatic speech remains unsupported. Voice selection, language filtering and Test voice are available in the compact Voice & playback panel in Manifest and Library. Optional self-hosted eSpeak NG voices work through the backend when device speech is unavailable. Native notification/speech plugins require a new native build. See [manifestation guide](docs/manifestation.md).

## Continuity

Nested workspace routes restore Schedule, category filters, saved practices, recordings and sound packs after reload and support browser Back/Forward. The unfinished sentence composer and validated sound workspace persist on this device. Opening another practice asks before replacing unsaved edits. Save → Schedule selects the current saved practice. Paused sound controls remain reachable across tabs; previews have separate identity, foreign players use a non-overlapping banner, and Stop all audio covers speech and synthesis. Settings → Connection & offline readiness distinguishes network, local assets, API, server voice and push readiness. See the [flow audit](docs/flow-audit.md) for reproduced gaps, verification and remaining work.

## Screens

Sounds includes Explore for built-in sounds/favorites and Studio for synthesis. Studio supports up to eight independently controlled sound layers. Chakras supports individual, selected and all-seven playback with one Play/Pause/Resume button and a separate Stop button. Library separates affirmations/saved manifestation practices from audio sessions, packs and offline readiness. Settings contains update, listening and display controls. System, Light, Dark and High Contrast themes, text size (90–140%) and Compact/Comfortable spacing are saved independently. The interface uses a responsive dashboard, five persistent navigation destinations, compact modules, filled controls and clear selected states. Sentence queues keep preview available while text, voice recording and ordering open through Edit. Studio includes a live signal monitor. The app does not force a 360-pixel viewport.

Library distinguishes Settings JSON (editable session backup) from WAV audio (rendered sound). WAV export works offline on web/PWA, uses a cancellable background worker and supports up to 10 minutes per export. Native builds can open the share sheet for WAV audio, settings JSON, practice JSON and calendar files; physical-device acceptance remains pending.

The master mixer uses one audio context. Pitch changes preserve the percussion pulse and session duration. Approximate instrument and raga synthesis remains subject to musical review.

## Ubuntu

Use the named release and exact deployment commands in its handoff. ops/deploy.sh builds an archived source revision and switches the live directory atomically. ops/verify.sh verifies the public version. Existing PWA installations update through /update.html or Settings.

The PostgreSQL/FastAPI catalog is optional for the on-device player and required for closed-app web push reminders. See [operations](docs/operations.md) before starting it.

## Sound packs

Explore → Sound packs offers optional downloads with version, size, license and source information. Library plays and removes installed packs offline. Downloads verify SHA-256 and PCM format before committing; cancellation or corruption preserves a previous installed version. Files play through the shared audio context at their recorded tuning. Text and spacing preferences remain adjustable.

The first Core Resonance pack contains original 15-second bell, bowl and flute synthesis studies. Its generated audio is CC0-1.0 and is not a performer recording. The server catalog is optional. Server manifests support versioned replacement and review. Settings → Manage content provides uploads, private previews, editing, publication and revision history. Uploaded files live in a separate Docker content volume across releases.

## Android APK and updates

The website links to /download.html and the persistent /android/core-aura-latest.apk download. Android Settings includes one Update latest action: it downloads a compatible update privately, verifies package/version/signing identity and opens Android’s update confirmation without a browser or manual APK-opening step. Android may ask once to allow updates from Core-aura. Older stable app versions need a one-time normal upgrade to get the new native updater. The VPS signs verified CI build inputs with its permanent private key; a web deployment does not remove the APK channel. Publish using sudo bash ops/publish-android.sh after the verified main build. See [Android distribution](docs/android-distribution.md) for exact commands, private key backup and the one-time migration from the old temporary test APK.

Capacitor packages the shared interface in Android and iOS projects. Run npm run native:sync, then open Android Studio or Xcode. Automated verification builds Android debug/release packages, tests real APK signing/publication and compiles the iOS simulator project. Physical-device acceptance and iOS production signing/store distribution remain separate.

## Project references

- [Original blueprint](docs/core-aura-blueprint.md)
- [Implementation and remaining requirements](docs/implementation-status.md)
- [Deployment, backend and native operations](docs/operations.md)
- [Content administration and recovery](docs/content-admin.md)

Core-aura currently presents spiritual and musical listening practices. Instrument models and raga phrase studies are original synthesis. Practitioner-reviewed recordings, world-tradition packs and clinical research remain pending.
