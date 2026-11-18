# Core-aura 0.26.0 — operating workspace

## Home and navigation

Home now controls the same draft, Studio layers, Chakra channels, master output and practice player used by the detailed screens. It offers practice selection, repetition/mode/timer, direct Start, voice/background settings, saved-mix selection, sound tuning/level/timer, all seven chakra selections, group start, next schedule, pins/recent items and history. Secondary counts, categories and legacy shortcuts remain in Saved counts and quick tools. No prior workspace is removed. Home modules can be reordered and collapsed in Settings; opening destination is selectable and never auto-starts audio.

Sound keeps Explore and Studio plus direct Tracks and Packs navigation; Nature library remains in Explore. Library adds search/sorting by name, tags and collection, Home pins, duplicates, direct Use in Manifest and bulk practice/mix export/deletion. Existing recording, imported-track, pack, JSON, WAV and native sharing controls remain.

Manifest adds eight editable practice presets, sentence duplication/multi-selection and practice copies. Select a preset and Save practice to retain a personal preset. Voice/background levels are separate; live voice level takes effect on the next sentence. Saved generated mixes remain independent attachments. Explicit background mute restores the configured level when unmuted.

Chakras adds sequential playback of selected channels, ordering, per-channel duration and transition gaps. The active sequence uses one transport; individual channel playback remains available. Starting another audio source ends the sequence. Paused transitions restart their configured gap on resume. Together-mode group Stop still reaches deselected voices.

## Playback and draft rules

- Selecting a source configures it; explicit Start/Play begins audio.
- Replacing a different active playback group asks for confirmation. Individual layers within the same mixer can still combine; imported tracks can accompany generated audio.
- Loading a library session requests explicit replacement when playback is active. An unfinished Studio workspace gets its own replacement guard; saved sessions remain unchanged.
- Sentence previews preserve a parent practice and return it paused. Other audio stays paused after audition; it does not resume automatically.
- Home and editors share state. Sound/Chakra timers are independent; shared Sound output is deliberately labelled separately from voice/background level.
- Live controls affect the run. Save live settings is explicit; normal Save while stopped retains preferences. Stop all audio remains available through the active player's Levels and Settings.
- Existing PWA/native update and permanent VPS signing remain unchanged.

## Preferences, history and data

Pins, recent references, tags/collections, Home order and expansion preferences are local. Broken item references can be removed. History is off by default, stores actual on-device session timing and excludes paused time; practice completion and interruption are distinguished. Sound listening is recorded separately. No clinical outcomes, audio or affirmation words are stored in history. It can be filtered, exported and cleared.

Settings can save the current draft voice as defaults for newly created practices and choose a fade for newly created layers. Existing saved content is not silently rewritten. Themes and independent 90–140% text scaling remain.

ZIP backups contain whitelisted settings and selected imported tracks, personal recordings or downloaded packs. Secrets, administrative access keys and push credentials are excluded. Bundles contain private text/audio in plain form; keep them securely. Select up to 50 MB of media per bundle (native sharing remains bounded at 60 MB). Additional bundles can carry remaining audio. CRC and SHA-256 validation precede writes. Restore merges supplied media, replaces supplied settings and attempts rollback if writes fail; keep the original backup if rollback reports failure. Restored reminders are disabled pending review, and unavailable recordings fall back to the selected voice. Reload applies restored preferences. Individual JSON/audio exports remain available.

## Reminder capabilities

Schedules support edit, disabled duplicate, enable/disable, calendar export and an additional one-off Remind in 10 min (within the eight-slot schedule limit). In-app and server push support Skip next date exceptions. Native weekly notifications do not provide an exception API through the current plugin, so Skip next is explicitly unavailable there; disable/edit the native schedule instead. No closed-app automatic speech is added. A Test notification action checks the actual permission/delivery path. Timing still depends on OS permissions and power management.

## Content roles

Optional server-configured named administrator/editor/reviewer access keys enforce role restrictions independently of UI. Editors upload/edit but cannot review/publish; reviewers review but cannot upload/edit/publish; administrators publish/withdraw. For named accounts, actor/reviewer identity comes from the authenticated server mapping, not the client operator header. Legacy administrator access remains compatible and is labelled as shared-key access, not independent identity.

After the backend exists, provision named roles without printing keys:

```bash
sudo python3 ops/provision-admin.py
sudo bash ops/start-backend.sh
```

The root-only credentials file is `/var/lib/core-aura/admin-accounts.json`; preserve it securely. Configuration is applied through `CORE_AURA_ADMIN_USERS` in `.env`. Running the provisioner again preserves existing accounts. Android signing identities are separate and unaffected.

## Verification and remaining device acceptance

Production build/unit checks, full browser regressions, direct Home controls, replacement cancellation, shared state, independent timers, sequential playback, pins, manifestation handoff, layout persistence, ZIP backup/restore, responsive phone layouts, named-role enforcement, native builds and signing publication are release checks. Actual-phone audio interruptions, OS notification reliability, tactile comfort, native share destinations and stable self-update acceptance remain physical-device checks. iOS production signing/store distribution and cloud account synchronization are separate work.
