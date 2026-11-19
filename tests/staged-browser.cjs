const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const AxeBuilder = require("@axe-core/playwright").default;

const origin = "http://localhost:8089";
const screens = ["Home", "Manifest", "Sounds", "Chakras"];
const palettes = ["system", "light", "dark", "green", "yellow", "custom"];
const collections = [
  ["Sounds", "#library/sounds", "Nature & instruments"],
  ["Backgrounds", "#library/backgrounds", "Saved mix"],
  ["Voices", "#library/recordings", "My voice recordings (0)"],
  ["Affirmations", "#library/affirmations", "Affirmation library"],
  ["Manifestation practices", "#library/practices", "Saved practice"],
  ["Audio files", "#library/audio", "Add audio"],
  ["Sound packs", "#library/packs", "Available packs"],
  ["Saved mixes", "#library/mixes", "Saved mix"],
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
    for (const [route, name] of [
      ["#manifest/schedule", "Manifest"],
      ["#explore/nature", "Sounds"],
      ["#studio", "Sounds"],
    ]) {
      await page.goto(origin + "/" + route);
      await assertEmpty(name);
    }

    await nav.getByRole("button", { name: "Library", exact: true }).click();
    const libraryGrid = page.getByRole("group", { name: "Library collections" });
    await libraryGrid.waitFor();
    for (const [name, route, evidence] of collections) {
      await libraryGrid.getByRole("button", { name, exact: true }).click();
      await page.getByRole("heading", { level: 1, name, exact: true }).waitFor();
      assert.equal(new URL(page.url()).hash.split("?")[0], route);
      await page.getByText(evidence, { exact: true }).first().waitFor();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.getByRole("button", { name: "All collections", exact: true }).click();
    }
    await page.goto(origin + "/#library/audio");
    await page.getByLabel("Import sound tracks").setInputFiles(testAudio("Quiet audio.wav"));
    await page.getByText("Quiet audio", { exact: true }).waitFor();
    await page.goto(origin + "/#library/recordings");
    await page.getByRole("textbox", { name: "Words in the recording" }).fill("A quiet moment.");
    await page.getByRole("button", { name: "Record or import WAV" }).click();
    await page.getByLabel("Import sentence WAV").setInputFiles(testAudio("Quiet voice.wav"));
    await page.getByRole("button", { name: "Save to Library" }).click();
    await page.getByText("A quiet moment.", { exact: true }).waitFor();
    await page.goto(origin + "/#library/practices");
    await page.getByRole("heading", { name: "Saved practice", exact: true }).waitFor();
    await page.getByRole("button", { name: "Play practice: Saved practice" }).click();
    await page.getByRole("button", { name: "Stop practice", exact: true }).click();
    await page.getByRole("button", { name: "All collections", exact: true }).click();

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
    await page.goto(origin + "/#library/sounds");
    await page.getByRole("button", { name: "Add frequency tone" }).click();
    const mixName = page.getByLabel("Mix name", { exact: true });
    await mixName.fill("Rain practice mix");
    await page.getByRole("button", { name: "Save generated mix" }).click();
    await page.getByText("Generated mix saved in Saved mixes.", { exact: true }).waitFor();
    await page.goto(origin + "/#library/backgrounds");
    const card = page.locator(".saved-card").filter({ hasText: "Rain practice mix" });
    await card.getByRole("button", { name: "Edit mix", exact: true }).click();
    await mixName.fill("Evening practice mix");
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await page.goto(origin + "/#library/mixes");
    await page.getByRole("heading", { name: "Evening practice mix", exact: true }).waitFor();
    assert.equal(await card.count(), 0);
    assert.equal(await page.locator(".saved-card").count(), 2);
    await page.goto(origin + "/#library/practices");
    const starters = page.getByRole("region", { name: "Starter collection" });
    await starters.getByRole("button", { name: "Save a copy of A quiet moment" }).click();
    await page.locator(".saved-card").getByRole("heading", { name: "A quiet moment" }).waitFor();
    const practiceData = await page.evaluate(() => JSON.parse(localStorage.getItem("core-aura.manifestation.v1")));
    assert.equal(practiceData.draft.id, "practice");
    assert.equal(practiceData.plans.length, 2);

    await page.goto(origin + "/#library/audio");
    await page.getByRole("button", { name: "Browse original audio samples" }).click();
    await page.getByRole("heading", { name: "Core Resonance", exact: true }).waitFor();
    await page.goto(origin + "/#library/backgrounds");
    await starters.getByRole("button", { name: "Save a copy of Gentle rain" }).click();
    await page.locator(".saved-card").getByRole("heading", { name: "Gentle rain", exact: true }).waitFor();

    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await context.setOffline(true);
    await page.goto(origin + "/#library/playlists");
    await page.reload();
    await starters.getByRole("button", { name: "Play Morning pause" }).click();
    const player = page.getByRole("region", { name: "Playlist player" });
    await player.getByText("I can return my attention to this moment.", { exact: true }).waitFor();
    await player.getByRole("button", { name: "Next item" }).click();
    await player.getByText("Stream and breeze", { exact: true }).waitFor();
    await player.getByRole("button", { name: "Pause playlist" }).waitFor();
    await player.getByRole("button", { name: "Stop playlist" }).click();
    await player.waitFor({ state: "detached" });
    await context.setOffline(false);
    assert.deepEqual(errors, []);
    console.log("Verified four staged screens, nine Library collections, mix editing, six themes, custom colour persistence, keyboard focus, accessibility and saved data.");
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
