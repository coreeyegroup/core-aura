const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const { chromium } = require("playwright");
const AxeBuilder = require("@axe-core/playwright").default;

const origin = "http://localhost:8089";
const palettes = ["system", "light", "dark", "green", "yellow", "custom"];
const collections = [
  ["Sounds", "#library/sounds", "Import sounds"],
  ["Backgrounds", "#library/backgrounds", "Import backgrounds"],
  ["Voices", "#library/recordings", "My voice recordings (0)"],
  ["Affirmations", "#library/affirmations", "Add affirmation"],
  ["Manifestation practices", "#library/practices", "Saved practice"],
  ["Audio files", "#library/audio", "Import audio"],
  ["Sound packs", "#library/packs", "Available packs"],
  ["Saved mixes", "#library/mixes", "Saved mix"],
  ["Chakras", "#library/chakras", "Root"],
  ["Playlists", "#library/playlists", "Saved routine"],
];
const practice = {
  id: "practice", name: "Saved practice", schemaVersion: 1,
  lines: [{ id: "line", text: "Stay present." }],
  order: "sequence", repeats: 1, gap: 1, readSeconds: 5, mode: "read",
  voice: "", rate: 1, volume: 0.7, seconds: 60, background: null,
};
const saved = {
  "core-aura.manifestation.v1": JSON.stringify({
    schemaVersion: 1, draft: practice, plans: [practice], reminders: [],
  }),
  "core-aura.sessions.v2": JSON.stringify([{
    schemaVersion: 2, engineVersion: "2.0", id: "mix", name: "Saved mix",
    kind: "studio", master: 0.5, createdAt: "2026-11-18T00:00:00Z",
    channels: [{ id: "tone", sound: "sine", hz: 432, volume: 0.2, muted: false, seconds: 60 }],
  }]),
  "core-aura.playlists.v1": JSON.stringify({
    schemaVersion: 1, playlists: [{ id: "queue", name: "Saved routine", items: [{ kind: "session", id: "mix" }] }],
  }),
};

function testAudio(name) {
  const sampleRate = 8000;
  const bytes = sampleRate * 2;
  const buffer = Buffer.alloc(44 + bytes);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(bytes, 40);
  return { name, mimeType: "audio/wav", buffer };
}

(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] });
  try {
    const context = await browser.newContext({ viewport: { width: 320, height: 740 }, colorScheme: "light" });
    await context.addInitScript(() => {
      window.testMediaElements = [];
      window.testBufferStarts = 0;
      const start = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function (...args) {
        window.testBufferStarts++;
        return start.apply(this, args);
      };
      const create = AudioContext.prototype.createMediaElementSource;
      AudioContext.prototype.createMediaElementSource = function (audio) {
        window.testMediaElements.push(audio);
        return create.call(this, audio);
      };
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(origin);
    await page.evaluate(values => {
      for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value);
    }, saved);
    await page.reload();

    const settings = page.getByRole("button", { name: "Settings", exact: true });
    const nav = page.getByRole("navigation", { name: "Main navigation" });
    await nav.getByRole("button", { name: "Home", exact: true }).click();
    await page.getByRole("heading", { name: "Your practice", exact: true }).waitFor();
    const home = page.getByRole("region", { name: "Home playlists" });
    await home.getByRole("combobox", { name: "Home playlist" }).selectOption({ label: "Saved routine" });
    await home.getByRole("heading", { name: "Saved routine" }).waitFor();
    await page.getByRole("region", { name: "In this playlist" }).getByText("Saved mix").waitFor();
    assert.match(await home.evaluate(element => getComputedStyle(element).backgroundImage), /morning-lake\.webp/);
    const navPosition = () => nav.evaluate(element => getComputedStyle(element).flexDirection);
    assert.equal(await navPosition(), "row");
    await page.setViewportSize({ width: 1280, height: 850 });
    assert.equal(await navPosition(), "column");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.setViewportSize({ width: 320, height: 740 });
    const homePlayer = page.getByRole("region", { name: "Playlist player" });
    await home.getByRole("button", { name: "Play selected playlist" }).click();
    await homePlayer.getByText("Saved mix", { exact: true }).waitFor();
    await homePlayer.getByRole("button", { name: "Pause playlist" }).click();
    await nav.getByRole("button", { name: "Library", exact: true }).click();
    await homePlayer.getByRole("button", { name: "Resume playlist" }).click();
    await homePlayer.getByRole("button", { name: "Stop playlist" }).click();
    await nav.getByRole("button", { name: "Home", exact: true }).click();
    await page.reload();
    assert.equal(await homePlayer.count(), 0);
    const replay = page.getByRole("region", { name: "Continue listening" });
    await replay.getByText("Saved routine", { exact: true }).waitFor();
    await replay.getByRole("button", { name: "Play again" }).click();
    await homePlayer.getByText("Saved mix", { exact: true }).waitFor();
    await homePlayer.getByRole("button", { name: "Stop playlist" }).click();
    await page.getByRole("button", { name: "Play selected manifestation", exact: true }).click();
    await homePlayer.getByText("Stay present.", { exact: true }).waitFor();
    await homePlayer.getByRole("button", { name: "Stop playlist" }).click();
    for (const width of [320, 390, 768, 1024]) {
      await page.setViewportSize({ width, height: 800 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    await page.setViewportSize({ width: 320, height: 740 });
    const homeAudit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    assert.deepEqual(homeAudit.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(node => node.target) })), []);
    await nav.getByRole("button", { name: "Library", exact: true }).click();
    const libraryGrid = page.getByRole("group", { name: "Library collections" });
    await libraryGrid.waitFor();
    assert.equal(await libraryGrid.getByRole("button").count(), 10);
    assert.equal(await page.getByRole("region", { name: "Starter collection" }).count(), 0);
    const librarySearch = page.getByRole("searchbox", { name: "Find a collection" });
    await librarySearch.fill("voices");
    assert.equal(await libraryGrid.getByRole("button").count(), 1);
    await page.getByRole("button", { name: "Clear library search" }).click();
    assert.equal(await librarySearch.evaluate(input => input === document.activeElement), true);
    for (const width of [320, 390, 768, 1024]) {
      await page.setViewportSize({ width, height: 800 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.equal(await libraryGrid.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(" ").length),
        1);
    }
    await page.setViewportSize({ width: 320, height: 740 });
    const overviewAudit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    assert.deepEqual(overviewAudit.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(node => node.target) })), []);

    for (const [name, route, evidence] of collections) {
      await libraryGrid.getByRole("button", { name, exact: true }).click();
      await page.getByRole("heading", { level: 1, name, exact: true }).waitFor();
      assert.equal(new URL(page.url()).hash.split("?")[0], route);
      await page.getByText(evidence, { exact: true }).first().waitFor();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.getByRole("button", { name: "Back", exact: true }).click();
    }
    await page.goto(origin + "/#library/sounds");
    const catalog = page.getByRole("region", { name: "Sound catalog" });
    assert.equal(await catalog.getByRole("button", { name: /^Test play .*rain/i }).count(), 0);
    await catalog.getByRole("searchbox", { name: "Search sounds" }).fill("bell");
    const testSound = catalog.getByRole("button", { name: "Test play Bell" });
    await testSound.click();
    await catalog.getByRole("button", { name: /^Stop test / }).click();
    await catalog.getByRole("button", { name: "Export WAV Bell" }).click();
    const sampleDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download WAV" }).click();
    assert.match((await sampleDownload).suggestedFilename(), /\.wav$/);
    await page.getByRole("button", { name: "Close audio export" }).click();
    page.once("dialog", dialog => dialog.accept());
    await catalog.getByRole("button", { name: "Delete Bell", exact: true }).click();
    await testSound.waitFor({ state: "detached" });
    await page.reload();
    await catalog.getByText("Removed built-in sounds").click();
    await catalog.getByRole("button", { name: "Restore Bell", exact: true }).click();
    await catalog.getByRole("searchbox", { name: "Search sounds" }).fill("bell");
    await testSound.waitFor();

    assert.equal(await page.getByRole("button", { name: "Add frequency tone" }).count(), 0);
    assert.equal(await page.getByLabel("Nature mix duration").count(), 0);
    const [picker] = await Promise.all([
      page.waitForEvent("filechooser", { timeout: 5000 }),
      page.getByRole("button", { name: "Import sounds", exact: true }).click({ timeout: 5000 }),
    ]);
    await picker.setFiles(testAudio("Raw bell.wav"));
    await page.getByText("Raw bell", { exact: true }).waitFor();
    assert.equal(new URL(page.url()).hash, "#library/sounds");
    const rawExport = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export Raw bell" }).click();
    const rawFile = await rawExport;
    assert.equal(rawFile.suggestedFilename(), "Raw-bell.wav");
    assert.deepEqual(await readFile(await rawFile.path()), testAudio("Raw bell.wav").buffer);
    const deleteRaw = page.getByRole("button", { name: "Delete Raw bell", exact: true });
    page.once("dialog", dialog => dialog.dismiss());
    await deleteRaw.click();
    await deleteRaw.waitFor();
    page.once("dialog", dialog => dialog.accept());
    await deleteRaw.click();
    await deleteRaw.waitFor({ state: "detached" });
    await page.goto(origin + "/#library/backgrounds");
    await page.getByRole("region", { name: "Built-in background sounds" }).waitFor();
    assert.equal(await page.getByText("Raw bell", { exact: true }).count(), 0);
    await page.getByLabel("Import backgrounds from device").setInputFiles(testAudio("Ambient layer.wav"));
    await page.getByText("Ambient layer", { exact: true }).waitFor();
    const backgroundPicker = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Import backgrounds", exact: true }).click();
    const spareBackground = testAudio("Spare background.wav");
    spareBackground.buffer.writeInt16LE(1000, 44);
    await (await backgroundPicker).setFiles(spareBackground);
    page.once("dialog", dialog => dialog.accept());
    const deleteBackground = page.getByRole("button", { name: "Delete Spare background", exact: true });
    await deleteBackground.click();
    await deleteBackground.waitFor({ state: "detached" });
    const builtInBackgrounds = page.getByRole("region", { name: "Built-in background sounds" });
    const builtInBackgroundDelete = builtInBackgrounds.getByRole("button", { name: /^Delete / }).first();
    const backgroundName = (await builtInBackgroundDelete.getAttribute("aria-label")).slice(7);
    page.once("dialog", dialog => dialog.accept());
    await builtInBackgroundDelete.click();
    await builtInBackgrounds.getByText("Removed built-in sounds").click();
    await builtInBackgrounds.getByRole("button", { name: "Restore " + backgroundName, exact: true }).click();
    await builtInBackgrounds.getByRole("button", { name: "Delete " + backgroundName, exact: true }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.goto(origin + "/#library/audio");
    assert.equal(await page.getByText("Raw bell", { exact: true }).count(), 0);
    assert.equal(await page.getByText("Ambient layer", { exact: true }).count(), 0);
    await page.getByLabel("Import audio from device").setInputFiles(testAudio("Quiet audio.wav"));
    await page.getByText("Quiet audio", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Test play Quiet audio" }).click();
    const audioExport = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export Quiet audio" }).click();
    assert.equal((await audioExport).suggestedFilename(), "Quiet-audio.wav");

    const youtube = page.getByRole("region", { name: /YouTube links/ });
    await youtube.getByRole("button", { name: "Add link" }).click();
    await youtube.getByLabel("YouTube link", { exact: true }).fill("https://youtu.be/abcdefghijk?si=example");
    await youtube.getByLabel("Title (optional)").fill("Quiet source");
    await youtube.getByRole("button", { name: "Save link" }).click();
    await page.route("https://www.youtube-nocookie.com/embed/**", route =>
      route.fulfill({ contentType: "text/html", body: "<button>Mock YouTube play</button>" }));
    assert.equal(await youtube.locator("iframe").count(), 0);
    await youtube.getByRole("button", { name: "Play here" }).click();
    const embed = youtube.locator("iframe[title='YouTube player for Quiet source']");
    await embed.waitFor();
    assert.equal(await embed.getAttribute("src"), "https://www.youtube-nocookie.com/embed/abcdefghijk?playsinline=1");
    assert.equal(await youtube.getByRole("link", { name: "open it in YouTube" }).getAttribute("href"),
      "https://www.youtube.com/watch?v=abcdefghijk");
    await embed.contentFrame().getByRole("button", { name: "Mock YouTube play" }).click();
    assert.ok(page.url().endsWith("/#library/audio"));
    const size = await embed.boundingBox();
    assert.ok(size.width >= 200 && size.height >= 200);
    await youtube.getByRole("button", { name: "Close player" }).click();
    assert.equal(await youtube.locator("iframe").count(), 0);
    await youtube.getByText("Link offline audio", { exact: true }).click();
    await youtube.getByLabel("Imported audio for Quiet source").selectOption({ label: "Quiet audio" });
    await page.reload();
    await youtube.getByText("Offline audio linked · Quiet audio", { exact: true }).waitFor();
    await youtube.getByRole("button", { name: "Go to offline player" }).click();
    assert.match(await page.evaluate(() => document.activeElement.getAttribute("aria-label")), /Quiet audio$/);
    await youtube.getByRole("button", { name: "Add link" }).click();
    await youtube.getByLabel("YouTube link", { exact: true }).fill("https://www.youtube.com/watch?v=abcdefghijk");
    await youtube.getByRole("button", { name: "Save link" }).click();
    await youtube.getByText("This video is already saved.", { exact: true }).waitFor();

    await page.goto(origin + "/#library/affirmations");
    assert.equal(await page.getByLabel("Category", { exact: true }).count(), 0);
    assert.ok(await page.locator(".affirmation-row").count() > 5);
    await page.getByRole("button", { name: "Add affirmation", exact: true }).click();
    await page.getByLabel("Affirmation text").fill("I can start again.");
    await page.getByRole("button", { name: "Save affirmation" }).click();
    await page.getByRole("button", { name: "Edit affirmation: I can start again." }).click();
    await page.getByLabel("Affirmation text").fill("I can take my time.");
    await page.getByRole("button", { name: "Save affirmation" }).click();
    await page.getByRole("button", { name: "Delete affirmation: I can take my time." }).click();
    await page.getByRole("button", { name: "Confirm delete" }).click();
    await page.getByLabel("Import affirmation JSON").setInputFiles({
      name: "affirmations.json", mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({ schemaVersion: 1, affirmations: ["I make time to rest."] })),
    });
    await page.getByRole("button", { name: "Test play: I make time to rest." }).waitFor();
    const affirmationExport = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export affirmations" }).click();
    assert.equal((await affirmationExport).suggestedFilename(), "core-aura-affirmations.json");

    const importAffirmationAudio = page.getByLabel("Import affirmation audio from device");
    await importAffirmationAudio.setInputFiles({ name: "Broken.mp3", mimeType: "audio/mpeg", buffer: Buffer.from("not audio") });
    const audioDialog = page.getByRole("dialog", { name: "Import audio affirmation" });
    await audioDialog.getByRole("button", { name: "Save to Library" }).click();
    await audioDialog.getByRole("alert").waitFor();
    await audioDialog.getByRole("button", { name: "Back to affirmations" }).click();
    await importAffirmationAudio.setInputFiles(testAudio("A calm breath.wav"));
    await audioDialog.getByRole("button", { name: "Save to Library" }).click();
    await page.getByRole("button", { name: "Edit affirmation: A calm breath" }).click();
    await page.getByLabel("Affirmation name").fill("A calmer breath");
    await page.getByRole("button", { name: "Save affirmation" }).click();
    await page.getByRole("button", { name: "Test play: A calmer breath", exact: true }).waitFor();
    await page.reload();
    await page.getByRole("button", { name: "Test play: A calmer breath", exact: true }).click();
    await page.waitForFunction(() => window.testBufferStarts === 1);
    const audioAffirmationExport = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export audio: A calmer breath", exact: true }).click();
    assert.match((await audioAffirmationExport).suggestedFilename(), /\.wav$/);

    await page.getByRole("button", { name: "Record audio affirmation", exact: true }).click();
    const recordDialog = page.getByRole("dialog", { name: "Record audio affirmation" });
    await recordDialog.getByLabel("Affirmation name").fill("My own affirmation");
    await recordDialog.getByRole("button", { name: "Start recording", exact: true }).click();
    const finishRecording = recordDialog.getByRole("button", { name: "Finish recording", exact: true });
    await finishRecording.waitFor();
    await page.waitForTimeout(600);
    await finishRecording.click();
    await recordDialog.getByRole("button", { name: "Save audio affirmation", exact: true }).click();
    const deleteAffirmation = page.getByRole("button", { name: "Delete affirmation: My own affirmation", exact: true });
    await deleteAffirmation.click();
    await page.getByRole("button", { name: "Confirm delete", exact: true }).click();
    await deleteAffirmation.waitFor({ state: "detached" });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

    await page.goto(origin + "/#library/recordings");
    await page.getByRole("button", { name: "Test play Device default", exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Record voice", exact: true }).count(), 0);
    assert.equal(await page.getByText("A calmer breath", { exact: true }).count(), 0);
    await page.getByLabel("Import voice WAV from device").setInputFiles(testAudio("Quiet voice.wav"));
    const voiceDialog = page.getByRole("dialog", { name: "Import voice WAV" });
    await voiceDialog.getByRole("button", { name: "Back to voices" }).click();
    await page.getByLabel("Import voice WAV from device").setInputFiles(testAudio("Quiet voice.wav"));
    await voiceDialog.getByRole("textbox", { name: "Words in the recording" }).fill("A quiet moment.");
    await voiceDialog.getByRole("button", { name: "Save to Library" }).click();
    await page.getByText("A quiet moment.", { exact: true }).waitFor();
    const recording = page.locator(".personal-voices .saved-card").filter({ hasText: "A quiet moment." });
    page.once("dialog", dialog => dialog.accept("My calm voice"));
    await recording.getByRole("button", { name: "Edit name", exact: true }).click();
    await recording.getByRole("button", { name: "Test play My calm voice", exact: true }).waitFor();
    const voiceExport = page.waitForEvent("download");
    await recording.getByRole("button", { name: "Download WAV", exact: true }).click();
    assert.match((await voiceExport).suggestedFilename(), /\.wav$/);

    await page.goto(origin + "/#library/practices");
    await page.getByRole("heading", { name: "Saved practice", exact: true }).waitFor();
    await page.getByRole("button", { name: "Play practice: Saved practice" }).click();
    await page.getByRole("button", { name: "Stop practice", exact: true }).click();
    await page.getByRole("button", { name: "Back", exact: true }).click();

    await settings.click();
    const theme = page.getByLabel("Theme", { exact: true });
    assert.deepEqual(await theme.locator("option").evaluateAll(options => options.map(option => option.value)), palettes);
    for (const palette of palettes) {
      await theme.selectOption(palette);
      const resolved = palette === "system" ? "light" : palette;
      await page.locator('html[data-resolved-theme="' + resolved + '"]').waitFor();
      const { paper, meta } = await page.evaluate(() => ({
        paper: getComputedStyle(document.documentElement).getPropertyValue("--paper").trim(),
        meta: document.querySelector('meta[name="theme-color"]').content,
      }));
      assert.equal(paper, meta);
      if (palette === "yellow") assert.equal(paper, "#fff8dc");
      if (palette === "green") assert.equal(paper, "#ecf7ed");
    }
    await page.getByLabel("Custom colour").fill("#ae5ee9");
    assert.equal(await page.locator("html").evaluate(element => element.style.getPropertyValue("--theme-paper")), "#f9f2fd");
    await page.reload();
    await settings.click();
    assert.equal(await theme.inputValue(), "custom");
    assert.equal(await page.getByLabel("Custom colour").inputValue(), "#ae5ee9");
    for (const width of [320, 430, 1024]) {
      await page.setViewportSize({ width, height: 800 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    assert.deepEqual(audit.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(node => node.target) })), []);
    await theme.selectOption("system");
    await page.emulateMedia({ colorScheme: "dark" });
    await page.locator('html[data-resolved-theme="dark"]').waitFor();
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "detached" });
    assert.equal(await settings.evaluate(element => element === document.activeElement), true);
    assert.deepEqual(await page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), Object.keys(saved)), saved);
    await page.goto(origin + "/#explore/nature");
    await page.getByRole("button", { name: "Add frequency tone" }).click();
    const mixName = page.getByLabel("Mix name", { exact: true });
    await mixName.fill("Rain practice mix");
    await page.getByRole("button", { name: "Save generated mix" }).click();
    await page.getByText("Generated mix saved in Saved mixes.", { exact: true }).waitFor();
    await page.goto(origin + "/#library/mixes");
    const card = page.locator(".saved-card").filter({ hasText: "Rain practice mix" });
    await card.getByRole("button", { name: "Edit in Sounds", exact: true }).click();
    await mixName.fill("Evening practice mix");
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await page.goto(origin + "/#library/mixes");
    await page.getByRole("heading", { name: "Evening practice mix", exact: true }).waitFor();
    assert.equal(await card.count(), 0);
    assert.equal(await page.locator(".saved-card").count(), 2);
    const editedCard = page.locator(".saved-card").filter({ hasText: "Evening practice mix" });
    const rename = editedCard.getByRole("button", { name: "Rename", exact: true });
    assert.equal(await rename.isVisible(), false);
    await editedCard.locator('summary[aria-label="More options for Evening practice mix"]').click();
    assert.equal(await rename.isVisible(), true);

    await page.goto(origin + "/#library/practices");
    const starters = page.getByRole("region", { name: "Starter collection" });
    assert.equal(await starters.count(), 0);
    await page.getByRole("button", { name: "New practice", exact: true }).click();
    await page.getByRole("textbox", { name: "Practice name" }).fill("Rain without narration");
    assert.deepEqual(await page.locator(".practice-editor h2, .practice-editor h3").allTextContents(), [
      "1. Practice details", "2. Sentences or audio", "2.1 Choose from library", "2.2 Playback options", "3. Audio, sounds and backgrounds",
    ]);
    assert.equal(await page.getByRole("button", { name: "Manage background library", exact: true }).count(), 0);
    const playbackOptions = page.getByText("2.2 Playback options", { exact: true });
    const maximumSession = page.getByLabel("Maximum session", { exact: true });
    assert.equal(await maximumSession.isVisible(), false);
    await playbackOptions.click();
    assert.equal(await maximumSession.isVisible(), true);
    await playbackOptions.click();
    assert.equal(await page.getByLabel("Your own sentence", { exact: true }).isVisible(), false);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.getByRole("button", { name: "Add background", exact: true }).click();
    await page.getByLabel("New layer background sound", { exact: true }).selectOption("stream");
    await page.getByRole("button", { name: "Add layer", exact: true }).click();
    assert.equal(await page.locator("#practice-layer-picker").isVisible(), false);
    await page.getByText("1000 Hz filter · 20% · Background layer", { exact: true }).waitFor();
    assert.equal(await page.getByLabel("Layer 1 background sound", { exact: true }).isVisible(), false);
    await page.getByRole("button", { name: "Add sound", exact: true }).click();
    await page.getByLabel("New layer extra sound", { exact: true }).selectOption("sine");
    await page.getByRole("button", { name: "Add layer", exact: true }).click();
    const toneRow = page.locator(".practice-layer").filter({ hasText: "Pure tone" });
    await toneRow.locator("summary").click();
    const layerFrequency = page.getByLabel("Layer 2 extra sound frequency (Hz)", { exact: true });
    await layerFrequency.fill("528");
    await layerFrequency.press("Tab");
    await toneRow.locator("summary").click();
    const layerPreview = toneRow.getByRole("button", { name: /^Test play:/ });
    assert.equal(await layerPreview.isVisible(), true);
    await layerPreview.click();
    await toneRow.getByRole("button", { name: /^Stop preview:/ }).click();
    await layerPreview.waitFor();
    await page.getByRole("button", { name: "Add audio", exact: true }).click();
    await page.getByLabel("New layer audio file", { exact: true }).selectOption({ label: "Ambient layer" });
    await page.getByRole("button", { name: "Add layer", exact: true }).click();
    await page.getByRole("button", { name: "Test play: Ambient layer", exact: true }).click();
    await page.waitForFunction(() => window.testMediaElements.some(audio => audio.loop && !audio.paused));
    await page.getByRole("button", { name: "Stop preview: Ambient layer", exact: true }).click();
    await page.waitForFunction(() => window.testMediaElements.every(audio => audio.paused));
    await page.getByRole("button", { name: "Save practice", exact: true }).click();
    const practiceData = await page.evaluate(() => JSON.parse(localStorage.getItem("core-aura.manifestation.v1")));
    const layeredPractice = practiceData.plans.find(plan => plan.name === "Rain without narration");
    assert.equal(layeredPractice.lines.length, 0);
    assert.equal(layeredPractice.additionalLayers[0].ambience.sound, "stream");
    assert.equal(layeredPractice.additionalLayers[1].tone.hz, 528);
    assert.match(layeredPractice.additionalLayers[2].audio.id, /^track:backgrounds:/);
    await page.getByText("Playlist", { exact: true }).click();
    await page.getByLabel("Playlist name", { exact: true }).fill("Evening listening");
    await page.getByRole("button", { name: "Add to playlist", exact: true }).click();
    await page.getByRole("button", { name: "Open on Home", exact: true }).click();
    await page.getByRole("heading", { name: "Evening listening", exact: true }).waitFor();
    await page.getByRole("button", { name: "Play selected playlist", exact: true }).click();
    const homeQueuePlayer = page.getByRole("region", { name: "Playlist player", exact: true });
    await homeQueuePlayer.getByRole("button", { name: "Stop playlist", exact: true }).click();
    await page.goto(origin + "/#library/playlists");
    const auditPlaylist = page.getByRole("article", { name: "Evening listening playlist", exact: true });
    page.once("dialog", dialog => dialog.accept());
    await auditPlaylist.getByRole("button", { name: "Delete playlist Evening listening", exact: true }).click();
    await page.goto(origin + "/#library/practices");
    await page.locator(".saved-card").filter({ hasText: "Rain without narration" })
      .getByRole("button", { name: "Edit practice", exact: true }).click();
    await page.getByRole("button", { name: "Play practice", exact: true }).click();
    await page.waitForFunction(() => window.testMediaElements.some(audio => audio.loop && !audio.paused));
    await page.getByRole("button", { name: "Stop practice", exact: true }).click();
    await page.goto(origin + "/#library/practices");
    const layeredCard = page.locator(".saved-card").filter({ has: page.getByRole("heading", { name: "Rain without narration", exact: true }) });
    await layeredCard.getByRole("button", { name: "Edit practice", exact: true }).click();
    await page.locator(".practice-layer").filter({ hasText: "Ambient layer" }).locator("summary").click();
    await page.getByRole("button", { name: "Remove layer", exact: true }).click();
    await page.getByRole("button", { name: "Save practice", exact: true }).click();
    await page.goto(origin + "/#library/practices");
    const updated = await page.evaluate(() => JSON.parse(localStorage.getItem("core-aura.manifestation.v1")).plans.find(plan => plan.name === "Rain without narration"));
    assert.equal(updated.additionalLayers.length, 2);
    assert.equal(await layeredCard.getByRole("button", { name: "Delete practice", exact: true }).isVisible(), false);
    await layeredCard.getByLabel("More options for Rain without narration", { exact: true }).click();
    page.once("dialog", dialog => dialog.accept());
    await layeredCard.getByRole("button", { name: "Delete practice", exact: true }).click();
    await layeredCard.waitFor({ state: "detached" });

    await page.goto(origin + "/#library/packs");
    await page.getByRole("heading", { name: "Core Resonance", exact: true }).waitFor();
    await page.goto(origin + "/#library/mixes");
    await starters.getByRole("button", { name: "Save a copy of Gentle rain" }).click();
    await page.locator(".saved-card").getByRole("heading", { name: "Gentle rain", exact: true }).waitFor();

    await page.goto(origin + "/#library/playlists");
    const incoming = { schemaVersion: 1, playlists: [
      { id: "queue", name: "Imported playlist", items: [{ kind: "session", id: "mix" }] },
    ] };
    await page.getByLabel("Import playlist JSON").setInputFiles({
      name: "playlists.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(incoming)),
    });
    await page.getByText("Imported playlist", { exact: true }).waitFor();
    await page.getByText("Saved routine", { exact: true }).waitFor();
    const downloaded = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export playlists" }).click();
    assert.equal((await downloaded).suggestedFilename(), "core-aura-playlists.json");

    await page.goto(origin + "/#library/backgrounds");
    assert.equal(await page.getByRole("button", { name: "Open Sounds" }).count(), 0);
    assert.equal(await page.getByRole("button", { name: "Import mix settings" }).count(), 0);
    assert.equal(await page.locator(".soundtrack-panel").evaluate(panel => {
      const footer = panel.querySelector(":scope > .catalog-footer");
      const list = panel.querySelector(".library-starters");
      return Boolean(list && footer && list.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING);
    }), true);

    await page.goto(origin + "/#library/chakras");
    await page.getByRole("button", { name: "Configure Root" }).click();
    const root = page.getByRole("article", { name: "Root chakra" });
    const frequency = root.getByLabel("Root frequency (Hz)", { exact: true });
    await frequency.fill("400");
    await frequency.press("Tab");
    await root.getByText("Library layers", { exact: true }).click();
    await root.getByLabel("Root background sound", { exact: true }).selectOption("rain");
    await root.getByLabel("Root audio file", { exact: true }).selectOption({label: "Quiet audio"});
    const chakraPreset = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("core-aura.workspace.v1")).chakraChannels.find(item => item.id === "root"));
    assert.equal(chakraPreset.hz, 400);
    assert.equal(chakraPreset.accompaniment.ambience.sound, "rain");
    assert.match(chakraPreset.accompaniment.audio.id, /^track:/);
    await root.getByRole("button", { name: "Play", exact: true }).click();
    await page.waitForFunction(() => window.testMediaElements.some(audio => audio.loop && !audio.paused));
    await root.getByRole("button", { name: "Pause", exact: true }).click();
    await page.waitForFunction(() => window.testMediaElements.every(audio => audio.paused));
    await root.getByRole("button", { name: "Resume", exact: true }).click();
    await page.waitForFunction(() => window.testMediaElements.some(audio => audio.loop && !audio.paused));
    await root.getByRole("button", { name: "Stop", exact: true }).click();
    await page.waitForFunction(() => window.testMediaElements.every(audio => !audio.hasAttribute("src")));

    await page.goto(origin + "/#library/practices");
    const practiceCard = page.locator(".saved-card").filter({ has: page.getByRole("heading", {name:"Saved practice", exact:true}) });
    await practiceCard.getByRole("button", { name: "Edit practice", exact: true }).click();
    const firstSentence = page.getByLabel("Select sentence 1", { exact: true });
    assert.equal(await firstSentence.count(), 0);
    await page.getByRole("button", { name: "Select sentences", exact: true }).click();
    await firstSentence.check();
    await page.getByRole("button", { name: "Done", exact: true }).click();
    assert.equal(await firstSentence.count(), 0);
    await page.getByRole("button", { name: "Add sound", exact: true }).click();
    await page.getByLabel("New layer extra sound", { exact: true }).selectOption("bell");
    await page.getByRole("button", { name: "Add layer", exact: true }).click();
    await page.getByRole("button", { name: "Add background", exact: true }).click();
    await page.getByLabel("New layer background sound", { exact: true }).selectOption("rain");
    await page.getByRole("button", { name: "Add layer", exact: true }).click();
    await page.getByRole("button", { name: "Add audio", exact: true }).click();
    await page.getByLabel("New layer audio file", { exact: true }).selectOption({label: "Ambient layer"});
    await page.getByRole("button", { name: "Add layer", exact: true }).click();
    await page.getByText("432 Hz · 20% · Sound layer", { exact: true }).waitFor();
    const authored = "I make steady progress in my own time.";
    await page.getByText("Write your own affirmation", { exact: true }).click();
    await page.getByLabel("Your own sentence", { exact: true }).fill(authored);
    await page.getByRole("button", { name: "Add sentence", exact: true }).click();
    await page.locator(".manifest-line").getByText(authored, { exact: true }).waitFor();
    assert.equal(await page.evaluate(text => JSON.parse(localStorage.getItem("core-aura.affirmation-library.v1"))
      .affirmations.filter(item => item.text === text).length, authored), 1);
    await page.getByLabel("Your own sentence", { exact: true }).fill(authored);
    await page.getByRole("button", { name: "Add sentence", exact: true }).click();
    assert.equal(await page.evaluate(text => JSON.parse(localStorage.getItem("core-aura.affirmation-library.v1"))
      .affirmations.filter(item => item.text === text).length, authored), 1);
    const manifestPreset = await page.evaluate(() => JSON.parse(localStorage.getItem("core-aura.manifestation.v1")).draft);
    assert.equal(manifestPreset.additionalLayers[0].tone.sound, "bell");
    assert.equal(manifestPreset.additionalLayers[1].ambience.sound, "rain");
    assert.match(manifestPreset.additionalLayers[2].audio.id, /^track:backgrounds:/);
    await page.getByRole("button", { name: "Choose affirmations", exact: true }).click();
    const affirmationPicker = page.getByRole("dialog", { name: "Choose affirmations" });
    await affirmationPicker.getByRole("checkbox", { name: "I make time to rest.", exact: true }).check();
    await affirmationPicker.getByRole("button", { name: "Cancel", exact: true }).click();
    assert.equal(await page.locator(".manifest-line").getByText("I make time to rest.", { exact: true }).count(), 0);
    await page.getByRole("button", { name: "Choose affirmations", exact: true }).click();
    await affirmationPicker.getByRole("checkbox", { name: "I make time to rest.", exact: true }).check();
    await page.getByRole("checkbox", { name: /^A calmer breath/ }).check();
    await affirmationPicker.getByRole("button", { name: "Add selected", exact: true }).click();
    await affirmationPicker.waitFor({ state: "detached" });
    const chosenAudio = page.locator(".manifest-line").filter({ hasText: "Audio affirmation" });
    const bufferStarts = await page.evaluate(() => window.testBufferStarts);
    await chosenAudio.getByRole("button", { name: "Play preview: A calmer breath", exact: true }).click();
    await page.waitForFunction(previous => window.testBufferStarts > previous, bufferStarts);
    await chosenAudio.getByRole("button", { name: "Stop preview: A calmer breath", exact: true }).click();
    await page.getByRole("button", { name: "Save practice", exact: true }).click();
    await page.getByRole("button", { name: "Play practice", exact: true }).click();
    await page.waitForFunction(() => window.testMediaElements.some(audio => audio.loop && !audio.paused));
    await page.getByRole("button", { name: "Stop practice", exact: true }).click();
    await page.waitForFunction(() => window.testMediaElements.every(audio => !audio.hasAttribute("src")));


    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await context.setOffline(true);
    await page.goto(origin + "/#library/playlists");
    await page.reload();
    await starters.getByRole("button", { name: "Test play Morning pause" }).click();
    const player = page.getByRole("region", { name: "Playlist player" });
    await player.getByText("I can return my attention to this moment.", { exact: true }).waitFor();
    await player.getByRole("button", { name: "Next item" }).click();
    await player.getByText("Stream and breeze", { exact: true }).waitFor();
    await player.getByRole("button", { name: "Pause playlist" }).waitFor();
    await player.getByRole("button", { name: "Stop playlist" }).click();
    await player.waitFor({ state: "detached" });
    await context.setOffline(false);
    await settings.click();
    const chooseTheme = page.getByRole("combobox", { name: "Theme", exact: true });
    await chooseTheme.selectOption("custom");
    await page.getByText("Backup, restore & storage", { exact: true }).click();
    const backupClip = page.getByRole("checkbox", { name: "Back up A calmer breath", exact: true });
    await backupClip.check();
    async function backup() {
      const downloaded = page.waitForEvent("download");
      await page.getByRole("button", { name: "Export backup ZIP", exact: true }).click();
      return readFile(await (await downloaded).path());
    }
    const fullBackup = await backup();
    await page.getByRole("button", { name: "Settings only", exact: true }).click();
    const settingsBackup = await backup();
    async function removeFixtureClip() {
      await page.evaluate(() => new Promise((resolve, reject) => {
        const data = JSON.parse(localStorage.getItem("core-aura.manifestation.v1"));
        const id = data.plans.flatMap(plan => plan.lines).find(line => line.audioAffirmation).recordingId;
        const open = indexedDB.open("core-aura-personal-voice", 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result, tx = db.transaction("recordings", "readwrite");
          tx.objectStore("recordings").delete(id);
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onerror = () => reject(tx.error);
        };
      }));
    }
    async function restore(buffer) {
      page.once("dialog", dialog => dialog.accept());
      await page.getByLabel("Restore Core-aura backup").setInputFiles({ name: "backup.zip", mimeType: "application/zip", buffer });
      await page.getByText(/^Backup restored/).waitFor();
    }
    await removeFixtureClip();
    await restore(fullBackup);
    await page.goto(origin + "/#library/affirmations");
    await page.reload();
    await page.getByRole("button", { name: "Test play: A calmer breath", exact: true }).waitFor();
    assert.equal(await page.locator("html").getAttribute("data-theme"), "custom");
    await removeFixtureClip();
    await settings.click();
    await page.getByText("Backup, restore & storage", { exact: true }).click();
    await restore(settingsBackup);
    const recovered = await page.evaluate(() => JSON.parse(localStorage.getItem("core-aura.manifestation.v1")).plans);
    const fallback = recovered.flatMap(plan => plan.lines).find(line => line.text === "A calmer breath");
    assert.ok(fallback && !fallback.audioAffirmation && !fallback.recordingId);
    await page.evaluate(() => {
      const manifest = JSON.parse(localStorage.getItem("core-aura.manifestation.v1"));
      const playlists = JSON.parse(localStorage.getItem("core-aura.playlists.v1"));
      const voice = { ...manifest.draft, id: "offline-voice", name: "Voice check",
        mode: "speech", voice: "core:zz", lines: [{ id: "local-word", text: "A test phrase." }],
        background: null, backgroundMix: null, accompaniment: undefined };
      manifest.plans.push(voice, { ...voice, id: "offline-missing-clip", name: "Recording check",
        lines: [{ id: "local-clip", text: "A test phrase.", recordingId: "missing-fixture-clip",
          recordedText: "A test phrase.", audioAffirmation: true }] });
      playlists.playlists.push({ id: "voice-check", name: "Voice check routine", items: [{ kind: "practice", id: voice.id }] },
        { id: "clip-check", name: "Recording check routine", items: [{ kind: "practice", id: "offline-missing-clip" }] });
      localStorage.setItem("core-aura.manifestation.v1", JSON.stringify(manifest));
      localStorage.setItem("core-aura.playlists.v1", JSON.stringify(playlists));
    });
    await context.setOffline(true);
    await page.goto(origin + "/#home");
    await page.reload();
    const offlineHome = page.getByRole("region", { name: "Home playlists" });
    const offlinePicker = offlineHome.getByRole("combobox", { name: "Home playlist" });
    const offlinePlay = offlineHome.getByRole("button", { name: "Play selected playlist" });
    await offlinePicker.selectOption("voice-check");
    await offlineHome.getByText(/Voice check.*installed offline voice/).waitFor();
    assert.equal(await offlinePlay.isDisabled(), true);
    await offlinePicker.selectOption("clip-check");
    await offlineHome.getByText(/Recording check.*unavailable recording/).waitFor();
    assert.equal(await offlinePlay.isDisabled(), true);
    await offlinePicker.selectOption("queue");
    await offlineHome.getByText("Ready offline", { exact: true }).waitFor();
    await offlinePlay.click();
    await player.getByText("Saved mix", { exact: true }).waitFor();
    await player.getByRole("button", { name: "Stop playlist" }).click();
    await page.goto(origin + "/#library/playlists");
    const clipRoutine = page.getByRole("article", { name: "Recording check routine playlist" });
    await clipRoutine.getByText(/unavailable recording/).waitFor();
    assert.equal(await clipRoutine.getByRole("button", { name: "Play playlist Recording check routine" }).isDisabled(), true);
    await context.setOffline(false);
    const voiceRoutine = page.getByRole("article", { name: "Voice check routine playlist" });
    await voiceRoutine.getByRole("button", { name: "Play playlist Voice check routine" }).waitFor();
    await page.waitForFunction(() => !document.querySelector('[aria-label="Play playlist Voice check routine"]').disabled);
    assert.deepEqual(errors, []);
    console.log("Verified ten Library collections, isolated sound testing, separate mix editing, six themes, custom colour persistence, keyboard focus, accessibility and saved data.");
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
