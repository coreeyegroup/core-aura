const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const { chromium } = require("playwright");
const AxeBuilder = require("@axe-core/playwright").default;

const origin = "http://localhost:8089";
const screens = ["Home"];
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
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  try {
    const context = await browser.newContext({ viewport: { width: 320, height: 740 }, colorScheme: "light" });
    await context.addInitScript(() => {
      window.testMediaElements = [];
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
    async function assertEmpty(name) {
      const heading = page.getByRole("main").getByRole("heading", { name, exact: true });
      await heading.waitFor({ state: "attached" });
      assert.equal(await page.locator("main > *").count(), 1);
      assert.equal(await page.locator("main > .sr-only").count(), 1);
      assert.equal(await page.locator(".player-dock, .mini-player, .queue-player").count(), 0);
      assert.equal(await nav.getByRole("button", { name, exact: true }).getAttribute("aria-current"), "page");
    }

    for (const name of screens) {
      await nav.getByRole("button", { name, exact: true }).click();
      await assertEmpty(name);
    }
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
    await page.goto(origin + "/#library/backgrounds");
    await page.getByRole("region", { name: "Built-in background sounds" }).waitFor();
    assert.equal(await page.getByText("Raw bell", { exact: true }).count(), 0);
    await page.getByLabel("Import backgrounds from device").setInputFiles(testAudio("Ambient layer.wav"));
    await page.getByText("Ambient layer", { exact: true }).waitFor();
    await page.goto(origin + "/#library/audio");
    assert.equal(await page.getByText("Raw bell", { exact: true }).count(), 0);
    assert.equal(await page.getByText("Ambient layer", { exact: true }).count(), 0);
    await page.getByLabel("Import audio from device").setInputFiles(testAudio("Quiet audio.wav"));
    await page.getByText("Quiet audio", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Test play Quiet audio" }).click();
    const audioExport = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export Quiet audio" }).click();
    assert.equal((await audioExport).suggestedFilename(), "Quiet-audio.wav");

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

    await page.goto(origin + "/#library/recordings");
    await page.getByRole("button", { name: "Test play Device default", exact: true }).waitFor();
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
    await starters.getByRole("button", { name: "Save a copy of A quiet moment" }).click();
    await page.locator(".saved-card").getByRole("heading", { name: "A quiet moment" }).waitFor();
    const practiceData = await page.evaluate(() => JSON.parse(localStorage.getItem("core-aura.manifestation.v1")));
    assert.equal(practiceData.draft.id, "practice");
    assert.equal(practiceData.plans.length, 2);

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
    await page.getByText("Library layers", { exact: true }).click();
    await page.getByLabel("Manifest extra sound", { exact: true }).selectOption("bell");
    await page.getByLabel("Manifest background sound", { exact: true }).selectOption("rain");
    await page.getByLabel("Manifest audio file", { exact: true }).selectOption({label: "Ambient layer"});
    const manifestPreset = await page.evaluate(() => JSON.parse(localStorage.getItem("core-aura.manifestation.v1")).draft);
    assert.equal(manifestPreset.accompaniment.tone.sound, "bell");
    assert.equal(manifestPreset.accompaniment.ambience.sound, "rain");
    assert.match(manifestPreset.accompaniment.audio.id, /^track:backgrounds:/);
    await page.getByRole("button", { name: "Choose affirmations", exact: true }).click();
    await page.getByRole("checkbox", { name: "I make time to rest.", exact: true }).check();
    await page.getByRole("button", { name: /^Use selection/ }).click();
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
    assert.deepEqual(errors, []);
    console.log("Verified ten Library collections, isolated sound testing, separate mix editing, six themes, custom colour persistence, keyboard focus, accessibility and saved data.");
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
