# Release 0.19.0 status

Added a hosted Android download page, native version/signing-aware update checks and a permanent VPS-owned signing/publication channel. CI produces unsigned inputs only after verification; the VPS publishes a signed APK and update metadata atomically outside web release directories. Android installation remains user-confirmed. The old debug APK needs a one-time backed-up transition to the stable key. See [Android distribution](android-distribution.md).

Completed a continuity audit with nested navigation/history, reload restoration, saved-practice targets, composer/workspace persistence, draft replacement protection, save-to-schedule handoff, preview identity, global paused-player controls, non-overlapping playback, complete emergency stop and explicit service readiness checks. Findings and remaining limits: [flow audit](flow-audit.md).

Added a real-data Home dashboard, eight functional tool shortcuts, category routing, saved-practice transport, upcoming reminders and quick tone setup. Reworked visual hierarchy with neutral surfaces, amber actions, filled controls and five-destination navigation. Added compact sentence queues with inline preview and edit disclosure, plus the live Studio pitch/waveform monitor.

Rebuilt the shared interface around compact rows and grouped controls. Added saved System, Light, Dark and High Contrast themes, pre-paint appearance restoration and live system-theme tracking. Removed decorative catalog cards and idle practice banners; voice options use one expandable panel. Text scaling and comfortable spacing remain adjustable. Browser checks cover five screens in three explicit themes, small screens, enlarged text, contrast and touch targets. See [interface guide](interface.md).

Added editable device-local categories/affirmations, category moves and library backup/restore, visible voice selection/testing, startup/voice error diagnostics and optional multilingual Core-aura server voices. Portable recordings, direct saved-practice controls and native sharing remain available. Per-sentence Play/Stop previews, device-only microphone recordings, mixed personal/device voice playback and opt-in closed-app web push remain available. Details: [manifestation guide](manifestation.md).

Backend migration 003 adds subscriptions, durable deliveries and worker heartbeat. Compose adds a reminder worker; deployment preserves its VAPID keypair in .env. [Operations](operations.md) includes the upgrade and backup requirements.

Pending: physical Android/iOS microphone/notification/lock-screen acceptance; VPS signing-key setup/publication and physical stable-update acceptance; iOS/store distribution; accounts/cloud practice synchronization; editor/reviewer account separation. No claims of cell regeneration, guaranteed health/wealth results or closed-app automatic speech.

## Current implementation coverage

Release 0.17.0 makes Home the opening dashboard and Manifest the practice workspace, with an affirmation library, custom sentence sequences, spoken/silent repetition, saved practices and local schedules. Existing sound, chakra, content administration and display features remain available.

| Requirement            | Implemented in this release                                                                                                                                                                             | Remaining acceptance                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Manifestation          | 40 category prompts, single-sentence Play previews, personal voice recordings, editable multi-sentence practices, sequence/each repetition, voice/silent modes, timer, background sound and JSON backup | Physical voice quality and language acceptance                                 |
| Schedules              | Local weekday schedules, opt-in server push, in-app reminders, calendar export and native local-notification integration                                                                                | Physical device delivery and unattended closed-app speech                      |
| Web and installed PWA  | Explore, Studio, Chakras, Library, settings, saved display preference, update flow                                                                                                                      | Physical phone acceptance on the owner's device                                |
| Native mobile          | Capacitor Android and iOS projects using bundled application assets                                                                                                                                     | Device audio, interruptions, background operation, signed distribution         |
| Frequency generation   | Sine and band-limited triangle synthesis, exact target input, slider, fine adjustment                                                                                                                   | Calibrated output-device assessment                                            |
| Instruments            | Original synthesized flute, drum, bell, bowl and tanpura; three fixed-tuning generated WAV studies in the Core Resonance pack                                                                           | Performer-reviewed realism and recorded instrument packs                       |
| Indian classical music | Yaman and Mohanam phrase studies with tonic transposition                                                                                                                                               | Hindustani/Carnatic practitioner review, ornamentation and expanded repertoire |
| Mixing                 | One shared AudioContext, per-layer pause, mute, level, master, stop and fades                                                                                                                           | Long-duration device CPU/battery testing                                       |
| Chakra sessions        | Seven mapped channels, separate and combined transport, bowl/sine/triangle type, per-channel level and saved combinations                                                                               | Listening review on headphones and speakers                                    |
| Audio files            | Saved-session WAV exports up to 10 minutes, PCM voice WAV import, portable 32 kHz voice exports and native share sheets                                                                                 | Physical native share-sheet acceptance and longer exports                      |
| Offline                | Versioned player cache, atomic IndexedDB pack installs, validated file hashes, cancelled/failed updates preserve older packs                                                                            | Resumable partial downloads and storage-eviction recovery                      |
| Session compatibility  | Schema v2, engine version, validated imports, legacy flute/drone migration                                                                                                                              | Future migration tests whenever the schema changes                             |
| Backend                | FastAPI/PostgreSQL, uploaded-asset registry, revision events, authenticated administration screen, draft/review/publication/withdrawal                                                                  | Separate user accounts and independently authenticated reviewers               |
| Content rights         | Required creator, license, attribution, provenance fields and recorded operator notes                                                                                                                   | Actual commissioned/licensed recordings and tradition-specific review          |
| Scientific review      | Product wording describes personal listening and meditation                                                                                                                                             | Clinical research, claims register and qualified review                        |
| Release delivery       | Reproducible builds, atomic Ubuntu deployment, browser evidence and native build jobs                                                                                                                   | Stable app signing and store accounts                                          |
| World traditions       | Architecture can add original sound models and reviewed content metadata                                                                                                                                | Pilot traditions, rights agreements and authentic content                      |

## Platform decision

The original blueprint proposed React Native. This release uses React with Capacitor for native packaging so the verified phone interface and audio synthesis remain shared. Capacitor provides native application projects. The sound engine continues to run through Web Audio in the platform web view. Oboe and AVAudioEngine remain candidates for a dedicated native sound engine if background and device-performance acceptance require one.

## Research and cultural review

The seven frequencies use a contemporary Solfeggio meditation mapping. Musical note and resonance controls describe the generated signal. Cellular regeneration is a research objective requiring direct evidence before public clinical claims.

Yaman and Mohanam are original phrase studies using approximate tuning. No performer recording, lineage-specific interpretation or cultural endorsement is implied by their inclusion. An appropriate practitioner must review each tradition before its content is presented as verified repertoire.

## Display and controls in 0.9.0

Settings provides saved text scaling from 90% to 140% and Compact/Comfortable spacing. Browser pinch zoom remains available. The old forced 360-pixel width and automatic document zoom are removed; the host browser is responsible for honoring the device viewport. Old display mode values do not constrain the new layout.

Studio keeps exact frequency input in each layer. Visual tuning is optional. A single layer has one main transport; multi-layer sessions also expose separate layer transports. Timer and master volume share one expandable session control. Chakra selection, frequency, sound and individual transport remain available; mute and per-channel volume sit in the detail panel.

WAV export renders saved settings from time zero; it does not record the microphone or the current playback position. Muted channels, master volume, individual session lengths and fade envelopes are honored. Its duration is limited to 10 minutes to bound device memory. WAV downloads are enabled for web/PWA; new native builds use the system share sheet.

## Sound packs in 0.10.0

Explore → Sound packs reads the bundled catalog and the optional published server catalog. Metadata-only legacy records are omitted. Packs expose credits, source, license, version, engine compatibility and declared size. Browser player updates do not automatically download pack audio.

The Core Resonance demonstration pack contains three reproducibly generated 15-second WAV studies: bell, bowl and flute at 432 Hz. Its audio is CC0-1.0; it contains no performer recording or authenticity endorsement. It is generated during the release build, not stored as binary source in Git. Native builds bundle this small demonstration pack; published server packs download from the public domain.

Files use bounded canonical PCM WAV with SHA-256 integrity checks and same-site /packs/ paths. Packs are limited to 25 MB and 20 files, each at most 10 minutes. Downloads are transactional: every file must pass before the stored version is replaced. Cancellation discards partial files; resume across interrupted downloads is not implemented. Browser storage may be evicted and is not an independent backup.

Recorded playback shares the existing AudioContext, analyser and master-volume state. One recorded file plays at a time. Starting a recording stops synthesis; starting synthesis stops the recording. Recorded files preserve their original tuning and are not yet layers in the tunable mixer. Pause/resume keeps playback position. Native background and interruption acceptance remain pending.

Server manifests can be replaced using optimistic revisions and a higher content version. Replacement returns them to draft; review and publication are required again. Publication requires a managed file manifest. The upload service computes canonical file hashes and validates them during review/publication. Operators remain responsible for rights, musical context and content claims.

## Content administration in 0.11.0

Settings → Manage content (website) opens the shared-key administration screen. The operator enters a name and the existing server access key. Credentials remain in tab memory and are not placed in URLs, local storage or session storage. This is a single-administrator workflow; entered operator/reviewer names are self-reported, not independently verified accounts.

Uploads accept bounded 16-bit PCM WAV at 44.1/48 kHz, mono or stereo. The service removes container metadata and writes a canonical WAV while preserving audio samples. Original local files are not modified. Uploaded audio has content-addressed immutable names in a separate Docker volume, outside static release directories. The default storage quota is 2 GiB, configurable in the environment. Each upload remains bounded at 25 MiB.

Draft files require authenticated preview. The public file route serves audio only while a published pack references it. Review and publication verify registered metadata and actual file hashes. Pack creation, version replacement and publication decisions append database events in the same transaction. Stale revisions are rejected. Withdrawing content removes public discovery/access on subsequent uncached requests; offline downloads and previously cached public files are not remotely erased.

Backups now contain a database dump and an audio archive with checksums and per-file hash verification. Backup/restore still requires an independent operational recovery rehearsal on the owner's VPS. Asset deletion/garbage collection, multi-user roles and store signing remain pending.

## Manifestation implementation

See [manifestation.md](manifestation.md) for platform limits and acceptance. Sentence text and recordings stay on the device. Opt-in web push uploads only practice names, IDs, schedule times/weekdays, timezone and the browser subscription. Native speech and notifications compile separately from PWA functionality and need actual device testing. Schedules default to reminders, with opt-in visible/idle auto-start. Closed or locked apps require opening the practice and tapping Play.
