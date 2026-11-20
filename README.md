# Core-aura

Core-aura is a manifestation, sound-generation and personal meditation application. React and TypeScript provide the shared phone interface. An AudioWorklet mixes tunable tones, synthesized instruments, two raga phrase studies and seven chakra channels on the listening device.

## v0.44.0 Mobile listening interface

Home opens with the selected playlist, quick playback, saved sessions and the playlist queue. The app uses bottom navigation on phones and a sidebar on desktop. The shared palette, headings and workspace panels bring the redesign to the existing application.

## v0.43.0 Offline listening readiness

Home and Library show whether saved playlists are ready offline, need a device voice, or refer to missing media. Manual practice and playlist starts check their dependencies before replacing active playback. Android release verification now checks the public APK checksum.

## v0.42.0 Listening and recovery

Home plays saved practices, playlists and mixes. Its replay shortcut survives a reload and never starts automatically. Queues check linked audio files before playback, and backups support the current themes and audio affirmation references. The release check can verify both the web and Android channels.

[Release-readiness audit and acceptance checks](docs/release-readiness.md)

## v0.41.0 Offline Library and Android release channel

Library → Sound packs can download available packs together, check their total size, and play them from Downloaded packs without internet. Generated sounds and imported files are already local. When a practice uses online speech, an installed device voice for the same language can read it offline.

## v0.40.0 Library audio affirmations

Sounds and Backgrounds offer visible delete controls for imported files and reversible removal for built-in sounds. Voices keeps WAV import and clip management. Affirmations supports text, audio file import, and microphone recording. Audio affirmations can be previewed, exported as WAV, and included in a spoken practice.

## v0.39.0 Library layers

Library lists have import controls below their items. Backgrounds contains ambient and imported files. Manifest and each chakra can use an extra generated sound, an ambient layer with a filter frequency, and an imported file with its own level and loop control. File references are saved with the practice or chakra mix; the audio remains in the on-device Library.

## v0.38.0 Library collections

Sounds holds raw instruments, tones, and user samples. Backgrounds holds ambient sources and background mixes. Audio files is for music and longer recordings. Each collection uses the device file picker and can export its original imports. Voices lists the speech voices available to the device and Core-aura service, and manages personal WAV recordings. Affirmations is a flat list with additive JSON import.

## v0.37.0 Library catalog

Library is a category list with item management and test playback. Sound layers, levels, timers, and mix editing live in Sounds. Practice editing opens in Manifest. Playlist JSON import adds copies of playlists and preserves matching item references on the device.

## v0.36.0 Library overview

See all nine Library collections and all nine bundled starter items from the Library overview. Search collection names and starter titles, play or pause a starter directly, and open a collection for creation and management. Saved mixes put secondary actions under More options.

## v0.35.0 Library starter content

Library includes three silent affirmation practices, two generated backgrounds, two saved-mix templates, and two ready-to-play playlists. The starter items are bundled with the app. Use Save copy to add a practice or mix to your personal library. Audio files links to the original downloadable samples in Sound packs.

## v0.34.0 Library rebuild

Library includes generated sounds and favorites, saved backgrounds, voice recordings and speech voices, affirmations, manifestation practices, imported audio files, sound packs, saved mixes, and playlists. Home, Manifest, Sounds, and Chakras remain staged. Settings offers System, Light, Dark, Green, Yellow, and a custom colour.

## v0.32.0 Manifestation and Library

Manifest opens the practice list. Open a saved practice or start a new one, add sentences, set playback, and save or schedule it. Library separates affirmations, personal voice recordings, audio, backgrounds, and playlists. Backgrounds use saved mixes of up to eight layers. Editing a saved mix preserves its identity, while attaching it to a practice keeps a separate copy.

## v0.30.0 audit fixes

Library has a direct Playlists destination. Search and sorting apply to saved content, and bulk delete confirms the visible items and any affected playlists. Imported audio and explicitly saved Chakra sequences can play in a playlist. A Chakra sequence keeps its order and timing in playlist playback and WAV export. Existing Chakra mixes still play together. To move an imported-track playlist to another device, include the audio in the ZIP backup.

## Operating workspace

Home plays saved manifestations, sound mixes, and chakra sessions while preserving editor drafts. Reorder/collapse modules, pin practices/mixes, use editable presets, run chakra sequences, manage opt-in history, search/tag collections and export selected-audio ZIP backups. Playback replacement and unfinished-work protection are explicit. [Structure, capabilities and verification](docs/workspace-structure.md).

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

Home shows saved practices, playlists, recent playback, upcoming reminders, and shortcuts. Manifest is the practice editor. Choose single/multiple affirmations from eight categories, write your own sentences, set sequence/each repetition, speak or read silently, attach a saved generated sound mix or background tone and save practices. Background level stays adjustable during playback; optional voice reduction lowers it while affirmations speak and restores it in gaps. Attached mixes survive deletion of the source session. Schedule weekday reminders or export calendar reminders. Schedules default to reminder → tap Play, with optional visible/idle auto-start. The category/affirmation library supports add, rename/edit, move, delete and JSON backup on this device. Every affirmation has a Play preview; selected sentences can use personal microphone recordings or imported PCM WAV files. Personal recordings export as portable WAV; saved practices have direct Play/Pause controls. Opt-in web push reminders work through the PostgreSQL reminder worker; closed-app automatic speech remains unsupported. Voice selection, language filtering and Test voice are available in the compact Voice & playback panel in Manifest and Library. Optional self-hosted eSpeak NG voices work through the backend when device speech is unavailable. Native notification/speech plugins require a new native build. See [manifestation guide](docs/manifestation.md).

## Continuity

Nested workspace routes restore Schedule, category filters, saved practices, recordings and sound packs after reload and support browser Back/Forward. The unfinished sentence composer and validated sound workspace persist on this device. Opening another practice asks before replacing unsaved edits. Save → Schedule selects the current saved practice. Paused sound controls remain reachable across tabs; previews have separate identity, foreign players use a non-overlapping banner, and Stop all audio covers speech and synthesis. Settings → Connection & offline readiness distinguishes network, local assets, API, server voice and push readiness. See the [flow audit](docs/flow-audit.md) for reproduced gaps, verification and remaining work.

## Screens

Sounds includes Explore for built-in sounds/favorites and Studio for synthesis. Studio supports up to eight independently controlled sound layers. Chakras supports individual, selected and all-seven playback with one Play/Pause/Resume button and a separate Stop button. Library separates affirmations/saved manifestation practices from audio sessions, packs and offline readiness. Settings contains update, listening and display controls. System, Light, Dark and High Contrast themes, text size (90–140%) and Compact/Comfortable spacing are saved independently. Compact uses shorter 36-pixel controls, tighter modules and headings, inline nature-layer options and a smaller header/player/navigation. Comfortable retains 44-pixel controls; enlarged text restores taller controls. The interface uses a responsive dashboard, five persistent navigation destinations, compact modules, filled controls and clear selected states. Sentence queues keep preview available while text, voice recording and ordering open through Edit. Studio includes a live signal monitor. The app does not force a 360-pixel viewport.

Library distinguishes Settings JSON (editable session backup) from WAV audio (rendered sound). WAV export works offline on web/PWA, uses a cancellable background worker and supports up to 10 minutes per export. Native builds can open the share sheet for WAV audio, settings JSON, practice JSON and calendar files; physical-device acceptance remains pending.

The master mixer uses one audio context. Pitch changes preserve the percussion pulse and session duration. Approximate instrument and raga synthesis remains subject to musical review.

## Ubuntu

Use the named release and exact deployment commands in its handoff. ops/deploy.sh builds an archived source revision and switches the live directory atomically. ops/verify.sh verifies the public version. Existing PWA installations update through /update.html or Settings.

The PostgreSQL/FastAPI catalog is optional for the on-device player and required for closed-app web push reminders. See [operations](docs/operations.md) before starting it.

## Nature and sound library

Explore → Nature library offers 28 original generated nature textures and 13 tones, instrument models and raga studies. Preview sounds, mix up to eight layers, set each level and optional frequency-focus filter, add a separate exact-frequency tone, and save generated mixes for offline playback or WAV export. Rain, water, ocean, wind, bird-like calls, fire and noise are procedural approximations rather than field recordings. [Library controls and catalogue](docs/nature-library.md).

## Sound packs

Explore → Sound packs offers optional downloads with version, size, license and source information. Library plays and removes installed packs offline. Downloads verify SHA-256 and PCM format before committing; cancellation or corruption preserves a previous installed version. Files play through the shared audio context at their recorded tuning. Text and spacing preferences remain adjustable.

The first Core Resonance pack contains original 15-second bell, bowl and flute synthesis studies. Its generated audio is CC0-1.0 and is not a performer recording. The server catalog is optional. Server manifests support versioned replacement and review. Settings → Manage content provides uploads, private previews, editing, publication and revision history. Uploaded files live in a separate Docker content volume across releases.

## Android APK and updates

The website links to /download.html and the persistent /android/core-aura-latest.apk download. Android Settings includes one Update latest action: it downloads a compatible update privately, verifies package/version/signing identity and submits a same-app update through Android without a browser or manual APK-opening step. Eligible Android 12+ devices can update without an extra installation prompt; Android confirmation is handled when required. Android may ask once to allow updates from Core-aura. Older stable app versions need a one-time normal upgrade to get the new native updater. The VPS signs verified CI build inputs with its permanent private key; a web deployment does not remove the APK channel. Publish using sudo bash ops/publish-android.sh after CI has published build inputs from the verified release branch. See [Android distribution](docs/android-distribution.md) for exact commands, private key backup and the one-time migration from the old temporary test APK.

Capacitor packages the shared interface in Android and iOS projects. Run npm run native:sync, then open Android Studio or Xcode. Automated verification builds Android debug/release packages, tests real APK signing/publication and compiles the iOS simulator project. Physical-device acceptance and iOS production signing/store distribution remain separate.

## Project references

- [Original blueprint](docs/core-aura-blueprint.md)
- [Implementation and remaining requirements](docs/implementation-status.md)
- [Deployment, backend and native operations](docs/operations.md)
- [Content administration and recovery](docs/content-admin.md)

Core-aura currently presents spiritual and musical listening practices. Instrument models and raga phrase studies are original synthesis. Practitioner-reviewed recordings, world-tradition packs and clinical research remain pending.
