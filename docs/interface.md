# Core-aura interface, release 0.17.0

The interface prioritizes readable information and direct operation. It uses flat surfaces, separators, small corner radii and compact spacing. Decorative heroes, large catalog cards and idle practice banners are removed. Content remains naturally sized; short pages do not repeat information simply to fill the display.

## Layout and controls

- Five persistent destinations: Home, Manifest, Sounds, Chakras and Library. Settings is available in the header. Home is the default route; existing feature links remain supported.
- One primary Play/Pause/Resume control and a separate Stop control. Per-layer controls remain available for independent mixing.
- Chakra rows show selection, name, state, frequency, sound type and transport. The settings icon opens level and focus controls.
- Affirmations use compact rows with selection, sentence text and preview. Category and affirmation editing stays in an expandable management panel.
- Voice selection, language and playback checks are grouped inside Voice & playback in Manifest and Library.
- The practice editor separates sentences from repetition and background controls in two columns on wide displays, and stacks them on phones.
- Sound catalog entries are rows with descriptions and direct actions.
- Fixed playback and navigation controls reserve only their measured height and respect safe areas. No fixed document width or automatic zoom is used.

## Appearance

Settings → Display provides System, Light, Dark and High Contrast themes. System follows device light/dark changes while the application is open. Appearance loads before React to avoid an incorrect initial palette. Text size remains adjustable from 90% to 140%; spacing has Compact and Comfortable options. Reset restores System, 100% and Compact. Older stored text and density choices are retained when the theme field is missing. Controls retain 44-pixel minimum hit areas at normal text size; checkboxes remain native and explicitly labelled.

All themes use semantic surface, text, border and action colors, including dialogs and waveform visualization. High Contrast uses black surfaces, white text and yellow actions. Theme changes do not change practices, recordings, library entries or downloaded packs.

## Release verification

Automated browser checks cover Home, Manifest, affirmation Library, Studio, Chakras and Explore in Light, Dark and High Contrast at 393 pixels. They check WCAG A/AA rules with axe, overflow, visible button height, compact affirmation/chakra rows and page errors. Further checks cover 320-pixel screens with enlarged text, saved appearance after reload, live System theme changes, reset and wide-screen practice columns. Screenshots and density measurements are uploaded in the mobile-verification CI artifact. Automated checks do not replace physical phone listening and interaction review.

After updating, confirm version 0.17.0. Switch all themes, reload, and confirm the chosen theme persists. Try 140% text and Comfortable spacing. Check that playback controls stay clear of the navigation bar, sentences remain readable, chakra controls work individually and together, voice preview remains available, and existing saved practices and recordings are present.

## Dashboard and compact workspace

Home uses actual device data: the current draft or active practice, saved-practice count, enabled-reminder count, sound-session count, category totals and the next valid reminder times. Dates refresh every 30 seconds. Empty states are labelled; no activity history, completion streak or therapeutic result is invented.

Eight tool shortcuts open Affirmations, Sound Studio, Chakras, Schedule, Recordings, Sound Packs, Sessions and Display. Category rows open the corresponding library filter. Saved practices have direct Play/Pause/Resume and editor access. Quick tones open 432, 528 or 639 Hz sine synthesis in Studio; they do not start audio without the player's Play action.

The visual hierarchy uses charcoal surfaces in Dark, neutral light surfaces in Light, amber primary actions, consistent icons and compact secondary type. Theme choices and 90–140% text scaling remain available. Each sentence queue row exposes preview immediately; its Edit icon reveals text, recording, ordering and removal. Custom text entry is an explicit Write your own affirmation panel. Studio's monitor shows the actual selected pitch and mixed waveform.

Additional browser tests verify real dashboard counts, schedule ordering, category routing, saved-practice transport, recording/packs shortcuts, exact tone setup and sentence editing. Physical phone readability and interaction acceptance remain the owner's final check.
