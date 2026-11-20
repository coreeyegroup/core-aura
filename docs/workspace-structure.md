# Core-aura 0.27.0 — listening-first Home and playlists

## Home and navigation

Home selects saved manifestation practices, sound mixes and chakra sessions for direct playback, without replacing editor drafts. Detailed voice, repetition, timer, tuning, layer and chakra controls stay in their owning sections. Compact saved-content rows, favorites/recent items, the next session and section links replace the former Home settings panels. Home order and collapse preferences remain compatible.

Library provides named mixed playlists (up to 50, each with 1–100 saved items). Practices and generated/nature/chakra mixes play sequentially from independent run snapshots. Queue controls provide previous/next, combined play/pause, Stop, progress, queue view and sound output. Maximum practice duration is labelled as a maximum because sentence repetitions can finish sooner. Missing source references require editing; they are never silently skipped. The queue persists across tab navigation; browser/application restarts do not automatically resume audio. Edit a chakra sequence in its mixer; saved chakra playlist items currently play their saved channels together, not the separate sequence configuration. Personal imported tracks remain playable in Tracks, but are not playlist items in this release.

One queue transport remains available across tabs while its run is active. Other source playback takes ownership; sentence preview relinquishes the queue and preserves preview behavior. A stopped/completed queue can be played again from Home. Playlist definitions are included in the existing validated ZIP backup. No server migration or new dependency is required.

Sound keeps Explore and Studio plus direct Tracks and Packs navigation; Nature library remains in Explore. Library adds search/sorting by name, tags and collection, Home pins, duplicates, direct Use in Manifest and bulk practice/mix export/deletion. Existing recording, imported-track, pack, JSON, WAV and native sharing controls remain.

Manifest adds eight editable practice presets, sentence duplication/multi-selection and practice copies. Select a preset and Save practice to retain a personal preset. Voice/background levels are separate; live voice level takes effect on the next sentence. Saved generated mixes remain independent attachments. Explicit background mute restores the configured level when unmuted.

Chakras adds sequential playback of selected channels, ordering, per-channel duration and transition gaps. The active sequence uses one transport; individual channel playback remains available. Starting another audio source ends the sequence. Paused transitions restart their configured gap on resume. Together-mode group Stop still reaches deselected voices.

## Playback and draft rules

- Selecting a source configures it; explicit Start/Play begins audio.
- Replacing a different active playback group asks for confirmation. Individual layers within the same mixer can still combine; imported tracks can accompany generated audio.
- Loading a library session requests explicit replacement when playback is active. An unfinished Studio workspace gets its own replacement guard; saved sessions remain unchanged.
- Sentence previews preserve a parent practice and return it paused. Other audio stays paused after audition; it does not resume automatically.
- Home playback resolves saved content into run snapshots without changing editor drafts. Sound/Chakra editor timers remain independent. Queue output is temporary and the workspace output is restored afterward.
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

## v0.27.0 approved Home correction and implementation plan

Goal: Home selects and plays saved content. Editors own configuration. A compact, calm sage/teal visual language replaces trading-style yellow without reducing text contrast or removing display preferences.

Architecture: validated local playlists reference saved manifestation practices and generated sessions (including nature and chakra mixes). Playback resolves immutable run snapshots and uses the existing audio engines. A single queue transport owns sequential advancement, pause/resume, previous/next, progress and stop. External playback ends queue ownership. No editor draft is loaded or overwritten by Home playback. No new dependency or server migration.

- [x] Task 1: add validated playlist storage and a dependency-injected queue controller. Test ordered mixed playback, pauses, completion, external interruption, errors, stale asynchronous starts, missing content and corrupt storage preservation.
- [x] Task 2: add Library playlist creation/editing/reordering and a global queue transport; include playlist settings in existing backups. Preserve all detailed workspace controls.
- [x] Task 3: replace Home settings with saved-content selectors, direct Play, favorites/recent, next schedule and concise section links. Preserve Home module preferences and move history/settings into their sections.
- [ ] Task 4: apply accessible, calm visual tokens for light/dark themes; retain contrast theme, compact/comfortable density and independent text scaling. Verify 320/393/430px, enlarged text, keyboard and accessibility.
- [ ] Task 5: run full unit/build/browser/backend/native checks, inspect mobile screenshots and push a reviewable release branch. Production deployment requires user approval.

Review focus: deleted source references are visible and cannot silently skip; paused queue time never advances; stale asynchronous starts cannot start after Stop/Next; external preview/playback cannot resurrect the old queue; Home playback never replaces an unfinished editor draft.
