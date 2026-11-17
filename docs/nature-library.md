# Nature and sound library — v0.23.0

Open Explore → Nature library or `#explore/nature`. All sources are generated on the listening device; no additional downloads, account or backend are required after the player has been cached.

## Catalogue

| Family | Generated sounds |
| --- | --- |
| Water | Gentle stream, flowing river, waterfall, bubbling spring, garden fountain, water droplets, cave droplets |
| Rain | Light drizzle, steady rain, heavy rain, rain on leaves, rain on a roof |
| Ocean | Gentle ocean shore, rolling surf, distant coast |
| Wind | Soft breeze, wind through trees, bamboo breeze |
| Wildlife | Garden bird-like calls, dawn-like chorus, cricket-like pulses |
| Fire | Gentle fireplace, campfire |
| Textures | White noise, pink-style noise, brown-style noise, rainstick, ocean drum |
| Tones and musical sources | Pure tone, soft triangle, bamboo flute, tuned drum, bell, singing bowl, tanpura drone, Yaman study, Mohanam study, harmonic hum, shruti-style drone, soft harp, tuned chime |

There are 28 nature profiles and 13 tonal/musical sources. Bird-like calls and instrument sounds are original synthesis, not species recordings, authentic chant recordings or sampled performances. Pink-style and brown-style labels describe the generated texture, not a certified spectral response. Traditional performance recordings and practitioner-reviewed sound packs remain a separate content task. No third-party audio assets are bundled by this feature.

## Frequency controls

Natural ambience contains many frequencies. Enabling Frequency focus applies a band-pass filter with a user-selected centre of 80–8000 Hz and Broad, Focused or Narrow width. This does not make a river or bird call a single-frequency sound. Intensity adjusts texture level and event density. Turning focus off restores the natural broadband texture without changing event timing.

Add frequency tone creates an independent pure-tone layer, initially 432 Hz, with its own frequency and level. Instrument frequency sets tuning, tonic or resonance as labelled. Drum, bell, bowl, harp and chime have an independent strike interval; stop the layer before changing that interval. Frequency preferences represent listening choices, not verified medical treatments.

## Mixing and saved sessions

- Preview auditions one sound for eight seconds. Adding a source stops the audition.
- Add up to eight generated layers. Each has Play/Pause/Resume, Stop, level, mute, remove and Solo. Solo stops other audio sources.
- The fixed mix player controls the current generated mix. One button changes between Play, Pause and Resume. Stop is separate. Global controls remain available when leaving this workspace.
- Mix timer is independent of frequency and can be changed while stopped. Master volume uses the existing shared output limiter.
- Save generated mix stores a named session in Audio library. Open restores its layers and controls. Rename/delete, settings JSON backup/import and WAV export use the existing library tools.
- The unfinished mix is stored on this device. Unreadable draft data is preserved until an explicit reset or saved-mix load replaces it.
- Generated mix WAV export runs offline in the existing worker, up to ten minutes per file. Imported tracks are separate and are not embedded in that export or settings JSON.
- Imported audio remains available through Add sound tracks. It plays at its recorded tuning and can accompany generated audio. Sound-pack playback retains its existing exclusive start behavior.

## Implementation

`public/ambience.js` is the shared seeded procedural generator and canonical nature catalogue. Live AudioWorklet playback and offline WAV rendering use the same DSP. `src/nature` implements typed metadata, validated draft/session storage and compact mixer controls. The build emits `nature-library.json` and includes its dependencies in the versioned offline cache. No new runtime packages are required.

Web and Android use the same interface. The phone catalogue is one column, with separate Preview/Add controls and adjustable text size, density and themes from existing Settings. The mix player occupies one bottom dock.

## Release and acceptance

After main verification publishes Android build inputs, deploy v0.23.0 using the repository operations scripts and publish the APK with the permanent VPS signing identity. Users running v0.22.0 can use Settings → Android app updates → Update latest. Android may still request installation confirmation according to device policy.

Check Preview, two-layer playback, pause/resume across navigation, focus changes, save/reload, WAV output and offline replay. Automated coverage checks all generated profiles at 44.1 and 48 kHz, bounded finite output, focus-band energy, session compatibility, draft recovery, audible browser output, small phone widths and accessibility. Real-phone sound quality, battery/background behavior and update acceptance still require device testing.
