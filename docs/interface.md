# Core-aura interface, release 0.16.0

The interface prioritizes readable information and direct operation. It uses flat surfaces, separators, small corner radii and compact spacing. Decorative heroes, large catalog cards and idle practice banners are removed. Content remains naturally sized; short pages do not repeat information simply to fill the display.

## Layout and controls

- Four persistent destinations: Manifest, Sounds, Chakras and Library. Settings is available in the header.
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

Automated browser checks cover Manifest, affirmation Library, Studio, Chakras and Explore in Light, Dark and High Contrast at 393 pixels. They check WCAG A/AA rules with axe, overflow, visible button height, compact affirmation/chakra rows and page errors. Further checks cover 320-pixel screens with enlarged text, saved appearance after reload, live System theme changes, reset and wide-screen practice columns. Screenshots and density measurements are uploaded in the mobile-verification CI artifact. Automated checks do not replace physical phone listening and interaction review.

After updating, confirm version 0.16.0. Switch all themes, reload, and confirm the chosen theme persists. Try 140% text and Comfortable spacing. Check that playback controls stay clear of the navigation bar, sentences remain readable, chakra controls work individually and together, voice preview remains available, and existing saved practices and recordings are present.
