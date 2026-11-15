# Core-aura manifestation practices (0.14.0)

## Build a practice

Manifest is the opening workspace. Choose affirmations opens Library → Affirmations. The initial library contains 40 original sentences across Health, Wealth, Success, Confidence, Relationships, Calm, Gratitude and Purpose. These are practice prompts, not promises of medical or financial outcomes.

Select one sentence or combine several categories. Use selection returns to the practice builder. Edit wording, add your own sentences, remove entries and move them up/down. A practice supports up to 50 sentences, each up to 300 characters. Save practice stores the current routine under its name. Library can reopen, export, import or delete saved practices. Up to 100 practices are supported.

Repetition choices:

| Choice | Two sentences, two repetitions |
| --- | --- |
| Whole sequence | A → B → A → B |
| Each sentence | A → A → B → B |

Repetitions range from 1 to 108. A maximum session limit (1–60 minutes) stops playback even if not all repetitions finish. Pause does not consume session time. Resume repeats the current sentence from its beginning; it does not promise word-position resume. Stop cancels pending speech, reading timers and the optional background sound.

Spoken voice uses browser speech synthesis in web/PWA and native text-to-speech in the new Android/iOS builds. Choose an installed voice, speech speed and volume. Availability, language, quality and offline operation depend on installed device voices. Network voices may send text to their provider. Silent reading works without speech support and displays each sentence for the chosen time.

Background options are a pure tone, synthesized bowl or tanpura with frequency and level controls. Other sound playback stops the manifestation practice. The fixed practice player keeps Play/Pause/Resume and Stop available while scrolling or editing schedules. A mini-player offers pause/resume/stop while viewing another screen. Native voice/background mixing still requires physical-device acceptance.

## Schedule

Save the practice first. In Manifest → Schedule, choose the saved practice, local time and weekdays. Up to eight enabled/disabled schedules are supported. Times are stored as local clock times on the device, not as a fixed India-only UTC offset.

By default the schedule follows reminder → open practice → tap Play. An optional auto-start setting can start a practice during its scheduled minute while the app is visible and idle. It does not interrupt other audio, an unsaved practice draft or content administration. Browser voice restrictions may still require a tap. Missed/hidden/closed occurrences use reminders; the app does not wake itself and start closed-app speech.

| Platform | Reminder behavior |
| --- | --- |
| Web or installed PWA | In-app reminders while open; opt-in server push while closed after backend update and permission. |
| Calendar export | Download an ICS reminder and import it into your calendar. Calendar permissions, settings and import support control delivery. |
| New native Android/iOS build | Local device notifications after permission, including when the app UI is closed, subject to OS restrictions. Tap opens the saved practice. Physical delivery still needs device testing. |

Web timers may be suspended when hidden or locked. On return, a reminder from the last 15 minutes can be shown once; older occurrences are not replayed as a backlog. Delivery keys are saved locally. Web Locks coordinate supported browsers to reduce duplicate reminders across tabs.

Native notification identifiers are isolated to this feature and limited to 56 weekly day/time combinations. Adding/editing/removing schedules updates those device notifications. Exact-alarm privileges are not requested in this release, so native timing may be delayed by power-management or permission settings. New native plugins require a new native binary; the existing PWA updates through Settings as before.

Calendar files contain the practice name, weekly days/time, display alarm and an app link; no affirmation sentence text is included. The exported calendar event is independent of the app: disabling a schedule in Core-aura does not remove a calendar event already imported elsewhere.

## Storage and compatibility

Practices, the current draft and schedules are saved on this device under a separate versioned key. Existing sound sessions, downloaded packs and content-administration records are retained. Personal practice text is not uploaded to the catalog backend. It is not synchronized between devices, browsers or native/PWA storage.

Exported JSON backs up one practice, not its notification permissions or schedules. Imported practices receive new IDs. Browser storage can be cleared; keep exports for valuable custom text. New native builds support JSON and calendar exports through the system share sheet; web/PWA builds download files.

Listener navigation has four destinations: Manifest, Sounds, Chakras and Library. Sounds includes Explore and Studio. Library separates Affirmations from Audio library. Text size and spacing preferences remain adjustable.

## Verification and remaining work

Unit tests cover sequence/each repetition, pause/cancellation, finite reading, maximum duration, input validation, local weekday calculations and notification IDs. Browser tests use a deterministic speech adapter to verify ordering and controls; they do not certify the sound or availability of a physical device voice. Browser checks also cover local reminders without autoplay, offline reading, imports/exports and phone layout.

Native compilation checks are separate from device acceptance. Test installed voices, lock-screen behavior, calls, volume routes, permission denial, reboot/timezone changes and notification taps on actual devices before relying on reminders. Cloud synchronization and unattended closed-app playback remain unimplemented. Personal voice and server push are described below. Editor/reviewer account separation from the previous roadmap remains pending.

Implementation references: [Web Speech API](https://wicg.github.io/speech-api/), [Capacitor 7 local notifications](https://capacitorjs.com/docs/v7/apis/local-notifications), and [community text-to-speech](https://github.com/capacitor-community/text-to-speech).

## 0.13.0: sentence previews, personal voice and web push

Every library affirmation and selected sentence has Play. A preview speaks that one sentence once using the current device voice/rate/volume; it does not change the draft. Its button becomes Stop. Starting any preview stops the current practice. A selected sentence uses its attached personal recording when that option is enabled.

Record voice opens a microphone dialog. Start recording requests permission, Finish recording stops the microphone, and the audio preview is available before Use recording saves. Cancel, leaving the app, errors and the 60-second cap stop microphone tracks. No audio is uploaded. Device storage supports 100 clips / 50 MB, each at most 5 MB. Editing a sentence detaches its old recording; it remains in Library → Affirmations → My voice recordings until deleted. Delete recording removes its reference from saved practices and the current draft. A missing clip surfaces an error rather than silently substituting different words.

Voice & volume → Use my recordings when available enables personal audio for attached sentences, with device text-to-speech for the remainder. Rate applies only to text-to-speech. Pause/resume restarts the current recording from the beginning. Personal audio shares the main mixer and can accompany the chosen background sound. Practice JSON exports intentionally omit recording references; download each voice clip separately for an audio backup. Release 0.14.0 adds portable WAV export and reimport; see below. Browser audio formats vary; physical Android/iOS recording and routing still need acceptance testing.

Web/PWA → Schedule → Enable reminders now registers an opt-in server push subscription. The backend must be updated and the reminder worker healthy. The server stores the device timezone, enabled schedule IDs, practice IDs/names and push subscription; it never receives sentence text or microphone audio. Use a neutral practice name if lock-screen privacy matters. A random device token in browser storage controls that device's registration; it is sent in a header and stored hashed on the server. There is no account or cross-device practice synchronization.

The persistent worker checks every 10 seconds. Deliveries have a stable date/time ID, durable database state, retry leases, a 15-minute expiry and notification tags. Network/429/5xx failures retry within that window. Expired subscriptions deactivate. Changed/deleted schedules cancel queued deliveries; an already in-flight push may still arrive. Delivery is at least once (a process failure after sending can cause a retry), with notification tags reducing duplicates. Outages longer than 15 minutes do not replay a backlog. DST nonexistent local times are skipped; a repeated local time uses its first occurrence.

Supported endpoint services: Google FCM, Mozilla Push, Apple Web Push and Windows notification hosts. Other push providers are rejected. Browser permission, connectivity, OS power restrictions and the browser's continued subscription control delivery. iPhone/iPad web push requires an installed Home Screen web app. Native builds continue to use local notifications; they do not register a web push subscription. Neither delivery path wakes closed-app speech: tap opens the practice, then press Play.

Disable closed-app reminders removes this device's server registration and unsubscribes its browser subscription. If offline, deletion is marked pending and retried on reconnect/reopen; avoid clearing browser storage before that completes. Saved schedule changes synchronize automatically while enabled. Foreground notification display is suppressed when server push is enabled, while the in-app reminder banner remains. Calendar events already imported must still be removed in the calendar separately.

Verification adds microphone capture with Chromium's fake audio device, per-sentence preview controls, personal clip playback, text-change detachment, JSON export, deletion and denied permission. Push browser tests use a mocked subscription with the real API. Backend tests exercise actual encryption/signing against a mocked HTTP transport; no external devices receive test pushes. Real end-to-end device notification delivery remains an installation acceptance check.

## 0.14.0: portable recordings and direct practice playback

Play appears beside every affirmation and selected sentence. Saved practices now also have a single Play/Pause/Resume button so they can be heard directly from Library. Open practice remains the editing action. The mini-player provides Stop while browsing.

Record voice/Record again opens one dialog for three choices: record the microphone, Import WAV, or choose a saved recording of exactly the same sentence. Imported audio is previewed before Use recording attaches it. Confirm that its spoken words match the displayed sentence; Core-aura does not transcribe or verify audio content. The old attachment is preserved until confirmation. Library → My voice recordings → Use in practice reuses a clip with its original text, adding or updating that sentence in the current draft without starting playback.

Imports support uncompressed 16-bit PCM WAV, mono/stereo, 8–96 kHz, under 5 MiB and nominally up to 60 seconds (65-second container-padding tolerance). RIFF structure, chunk bounds, byte rates, channels, sample alignment and duration are checked before decoding. MP3, M4A, WebM, floating-point WAV and compressed WAV imports are rejected; convert them to 16-bit PCM WAV first. Existing microphone recordings in browser-native formats continue to play and export.

Personal voice exports are mono 32 kHz 16-bit PCM WAV. Browser decoding performs resampling, stereo channels are averaged, and levels are clamped before encoding. These exports omit original container metadata and fit within the import size limit even for a full 60-second clip. They can be imported on another device or reattached later. The original device recording is retained; exporting does not delete or replace it. Practice JSON still contains only words and settings, so keep both the JSON and voice WAV copies for a backup. Automatic bundled backup/restore is not implemented.

Web/PWA uses Download WAV. The rebuilt native app uses Share WAV; practice JSON, sound-session JSON and ICS calendar exports also open native share sheets. Session synthesis WAV keeps its original 44.1 kHz format and 10-minute maximum. A share sheet lets the user choose a destination; Core-aura reports a handoff, not a verified save or delivery. Cancellation leaves the original recording/practice intact. No share target is selected automatically.

Native exports use a dedicated private cache subdirectory. Android's file provider grants access only to that export directory. Files remain available for receivers that read after a destination is chosen. Generated cache files older than 24 hours are cleaned on app startup where timestamps are available; the OS may clear cache sooner. Copies saved into another app/folder are managed there. No broad storage permission is requested. The iOS filesystem timestamp privacy declaration is included in the native resource bundle.

PWA users receive this update through Settings without reinstalling. Filesystem/Share plugin support requires a rebuilt native binary; JavaScript updates cannot add native plugins to an older native app. Android/iOS compilation and mocked native-share tests do not replace testing actual file pickers, share targets, cancellation and memory behavior on phones.
