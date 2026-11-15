# Core-aura

Core-aura 0.11.0 is a sound-generation and personal meditation application. React and TypeScript provide the shared phone interface. An AudioWorklet mixes tunable tones, synthesized instruments, two raga phrase studies and seven chakra channels on the listening device.

## Development

Use Node.js 22.

```bash
npm ci
npm run dev
npm test
npm run build
```

The build output is dist/. The production player needs HTTPS, including for its real-time AudioWorklet. Localhost is supported for development.

## Screens

Explore contains built-in sounds and favorites. Studio supports up to eight independently controlled sound layers. Chakras supports individual, selected and all-seven playback with one Play/Pause/Resume button and a separate Stop button. Library manages versioned saved sessions, import/export and offline readiness. Settings contains update, listening and display controls. Text size (90–140%) and Compact/Comfortable spacing are saved independently. The app does not force a 360-pixel viewport.

Library distinguishes Settings JSON (editable session backup) from WAV audio (rendered sound). WAV export works offline on web/PWA, uses a cancellable background worker and supports up to 10 minutes per export. Native audio-file sharing remains pending.

The master mixer uses one audio context. Pitch changes preserve the percussion pulse and session duration. Approximate instrument and raga synthesis remains subject to musical review.

## Ubuntu

Use the named release and exact deployment commands in its handoff. ops/deploy.sh builds an archived source revision and switches the live directory atomically. ops/verify.sh verifies the public version. Existing PWA installations update through /update.html or Settings.

The PostgreSQL/FastAPI catalog is optional for the current on-device player. See [operations](docs/operations.md) before starting it.

## Sound packs

Explore → Sound packs offers optional downloads with version, size, license and source information. Library plays and removes installed packs offline. Downloads verify SHA-256 and PCM format before committing; cancellation or corruption preserves a previous installed version. Files play through the shared audio context at their recorded tuning. Text and spacing preferences remain adjustable.

The first Core Resonance pack contains original 15-second bell, bowl and flute synthesis studies. Its generated audio is CC0-1.0 and is not a performer recording. The server catalog is optional. Server manifests support versioned replacement and review. Settings → Manage content provides uploads, private previews, editing, publication and revision history. Uploaded files live in a separate Docker content volume across releases.

## Native projects

Capacitor packages the shared interface in Android and iOS projects. Run npm run native:sync, then open Android Studio or Xcode. Automated Android builds provide a test APK. iOS compilation targets the simulator. Device audio and production signing require further acceptance.

## Project references

- [Original blueprint](docs/core-aura-blueprint.md)
- [Implementation and remaining requirements](docs/implementation-status.md)
- [Deployment, backend and native operations](docs/operations.md)
- [Content administration and recovery](docs/content-admin.md)

Core-aura currently presents spiritual and musical listening practices. Instrument models and raga phrase studies are original synthesis. Practitioner-reviewed recordings, world-tradition packs and clinical research remain pending.
