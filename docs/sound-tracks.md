# Sound tracks — v0.21.0

## Access and controls

Open **Sound tracks** in Chakras, Studio or Library → Audio. Choose **Add audio** to import one or more files. The panel contains play/pause/resume, Stop, seek, volume, mute and Repeat. Track options include ±10 seconds, rename, export original and delete with confirmation. Stop tracks controls imported files only; Settings → Stop all audio controls every sound source. The active playback bar can pause/resume imported files and reopen their library.

Imported files can accompany chakra channels and generated Studio layers. In Chakras, open **Generated sound layers** to add/edit/play extra synthesized layers without leaving the page. This uses the same layers as Studio. Chakra Solo isolates that chakra by stopping other voices, including imported tracks. Recorded sound-pack playback keeps its existing exclusive-start behavior.

Track playback has its own timeline. The generated-sound timer does not stop a repeated imported track; use Stop tracks or Stop all audio when finished. Per-track volume is combined with the existing master control. A shared compressor provides mix headroom when recorded and generated sources overlap.

## Files and persistence

Formats: MP3, WAV, M4A, AAC, OGG and FLAC, subject to the device's actual codec support. Files are checked for size and a readable audio timeline before storage. No conversion is claimed. Limits: 50 MB/file, two hours/file, 30 files or 200 MB/library, and three concurrent imported tracks. These bounds avoid unbounded storage/mixing on phones. Files stream through media elements instead of decoding entire long tracks into application audio buffers.

Files, names, levels, mute and repeat are kept locally in a separate IndexedDB library. Nothing is uploaded. Reloads do not autoplay. Duplicate bytes are rejected by SHA-256, independent of filename. Invalid imports, capacity errors and storage failures keep existing files. Removing an active track releases its audio nodes and temporary object URL. Pending playback is cancelled by Stop and Stop all.

Export original saves/shares the original bytes and original filename. Sound-session/WAV exports continue to contain generated channels only; imported audio is not embedded. Chakra session saves contain chakra channels; save extra generated layers from Studio. Device-local tracks and generated sessions are separate items, rather than a portable combined scene in this release. Browser/PWA and native app storage are separate; import originals into each where needed.

## Deployment

After the main Android publication job succeeds:

```bash
cd ~/core-aura
git pull --ff-only origin main
sudo bash ops/deploy.sh origin/main
sudo bash ops/start-backend.sh
sudo bash ops/publish-android.sh
bash ops/verify.sh 0.21.0
curl -fsS https://core-aura.coreeye.in/android/latest.json
```

Keep the existing VPS signing identity. Update the stable Android app through Settings → Android app updates and confirm Android's Update prompt. No uninstall is needed for the stable signed channel.

## Checks

Verify one and multiple imports, seek/pause/resume, volume/mute/repeat, a track playing with a chakra and extra generated layer, global Stop, duplicate/corrupt import rejection, rename, active deletion, original export and offline replay after reload. Phone/device codec and lock-screen behavior require actual handset acceptance; this feature does not add a native foreground playback service or lock-screen media controls.
