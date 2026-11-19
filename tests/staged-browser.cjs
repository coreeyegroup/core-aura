const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const AxeBuilder = require("@axe-core/playwright").default;

const origin = "http://localhost:8089";
const screens = ["Home", "Manifest", "Sounds", "Chakras", "Library"];
const palettes = [
  "system", "light", "dark", "contrast",
  "red", "orange", "yellow", "green", "blue", "indigo", "purple",
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
      ["#library/backgrounds", "Library"],
    ]) {
      await page.goto(origin + "/" + route);
      await assertEmpty(name);
    }

    await settings.click();
    const theme = page.getByLabel("Theme", { exact: true });
    assert.deepEqual(await theme.locator("option").evaluateAll(options => options.map(option => option.value)), palettes);
    const papers = [];
    for (const palette of palettes) {
      await theme.selectOption(palette);
      const resolved = palette === "system" ? "light" : palette;
      await page.locator('html[data-resolved-theme="' + resolved + '"]').waitFor();
      const { paper, meta } = await page.evaluate(() => ({
        paper: getComputedStyle(document.documentElement).getPropertyValue("--paper").trim(),
        meta: document.querySelector('meta[name="theme-color"]').content,
      }));
      assert.equal(paper, meta === "#000000" ? "#000" : meta);
      if (palettes.indexOf(palette) >= 4) papers.push(paper);
    }
    assert.equal(new Set(papers).size, 7);
    await page.reload();
    await settings.click();
    assert.equal(await theme.inputValue(), "purple");
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
    assert.deepEqual(errors, []);
    console.log("Verified five empty screens and deep links, all eleven themes, system switching, persistence, keyboard focus, accessibility and saved data.");
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
