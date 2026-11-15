# Core-aura implementation status

Release 0.8.0 moves the prototype to React and TypeScript, introduces a shared real-time audio worklet, and adds native packaging and a catalog backend.

| Requirement | Implemented in this release | Remaining acceptance |
| --- | --- | --- |
| Web and installed PWA | Explore, Studio, Chakras, Library, settings, saved display preference, update flow | Physical phone acceptance on the owner's device |
| Native mobile | Capacitor Android and iOS projects using bundled application assets | Device audio, interruptions, background operation, signed distribution |
| Frequency generation | Sine and band-limited triangle synthesis, exact target input, slider, fine adjustment | Calibrated output-device assessment |
| Instruments | Original synthesized flute, drum, bell, bowl and tanpura | Performer-reviewed realism and recorded instrument packs |
| Indian classical music | Yaman and Mohanam phrase studies with tonic transposition | Hindustani/Carnatic practitioner review, ornamentation and expanded repertoire |
| Mixing | One shared AudioContext, per-layer pause, mute, level, master, stop and fades | Long-duration device CPU/battery testing |
| Chakra sessions | Seven mapped channels, separate and combined transport, bowl/sine/triangle type, per-channel level and saved combinations | Listening review on headphones and speakers |
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
