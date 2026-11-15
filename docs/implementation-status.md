# Core-aura implementation status

Release 0.9.0 adds adjustable text size and spacing, a denser interface with fewer duplicate controls, and offline WAV export. The React, shared audio worklet, native packaging and catalog backend foundations continue from 0.8.0.

| Requirement | Implemented in this release | Remaining acceptance |
| --- | --- | --- |
| Web and installed PWA | Explore, Studio, Chakras, Library, settings, saved display preference, update flow | Physical phone acceptance on the owner's device |
| Native mobile | Capacitor Android and iOS projects using bundled application assets | Device audio, interruptions, background operation, signed distribution |
| Frequency generation | Sine and band-limited triangle synthesis, exact target input, slider, fine adjustment | Calibrated output-device assessment |
| Instruments | Original synthesized flute, drum, bell, bowl and tanpura | Performer-reviewed realism and recorded instrument packs |
| Indian classical music | Yaman and Mohanam phrase studies with tonic transposition | Hindustani/Carnatic practitioner review, ornamentation and expanded repertoire |
| Mixing | One shared AudioContext, per-layer pause, mute, level, master, stop and fades | Long-duration device CPU/battery testing |
| Chakra sessions | Seven mapped channels, separate and combined transport, bowl/sine/triangle type, per-channel level and saved combinations | Listening review on headphones and speakers |
| Audio files | Worker-based mono 44.1 kHz 16-bit WAV export from saved sessions, up to 10 minutes; progress and cancellation | Native file sharing and longer exports |
| Offline | Versioned whole-player cache and native bundled assets, session import/export | Resumable recording-pack downloads |
| Session compatibility | Schema v2, engine version, validated imports, legacy flute/drone migration | Future migration tests whenever the schema changes |
| Backend | FastAPI, PostgreSQL, migration, authenticated draft/review/publication/withdrawal API | Separate user accounts, reviewer identities and administrative UI |
| Content rights | Required creator, license, attribution, provenance fields | Actual commissioned/licensed recordings and tradition-specific review |
| Scientific review | Product wording describes personal listening and meditation | Clinical research, claims register and qualified review |
| Release delivery | Reproducible builds, atomic Ubuntu deployment, browser evidence and native build jobs | Stable app signing and store accounts |
| World traditions | Architecture can add original sound models and reviewed content metadata | Pilot traditions, rights agreements and authentic content |

## Platform decision

The original blueprint proposed React Native. This release uses React with Capacitor for native packaging so the verified phone interface and audio synthesis remain shared. Capacitor provides native application projects. The sound engine continues to run through Web Audio in the platform web view. Oboe and AVAudioEngine remain candidates for a dedicated native sound engine if background and device-performance acceptance require one.

## Research and cultural review

The seven frequencies use a contemporary Solfeggio meditation mapping. Musical note and resonance controls describe the generated signal. Cellular regeneration is a research objective requiring direct evidence before public clinical claims.

Yaman and Mohanam are original phrase studies using approximate tuning. No performer recording, lineage-specific interpretation or cultural endorsement is implied by their inclusion. An appropriate practitioner must review each tradition before its content is presented as verified repertoire.

## Display and controls in 0.9.0

Settings provides saved text scaling from 90% to 140% and Compact/Comfortable spacing. Browser pinch zoom remains available. The old forced 360-pixel width and automatic document zoom are removed; the host browser is responsible for honoring the device viewport. Old display mode values do not constrain the new layout.

Studio keeps exact frequency input in each layer. Visual tuning is optional. A single layer has one main transport; multi-layer sessions also expose separate layer transports. Timer and master volume share one expandable session control. Chakra selection, frequency, sound and individual transport remain available; mute and per-channel volume sit in the detail panel.

WAV export renders saved settings from time zero; it does not record the microphone or the current playback position. Muted channels, master volume, individual session lengths and fade envelopes are honored. Its duration is limited to 10 minutes to bound device memory. WAV downloads are enabled for web/PWA. Native sharing remains pending.
