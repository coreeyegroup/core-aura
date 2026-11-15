const { chromium } = require("playwright");
const AxeBuilder = require("@axe-core/playwright").default;
const assert = require("node:assert/strict");
const fs = require("node:fs");
function speechMock() {
  window.__spoken = [];
  window.__speechDelay = 40;
  let pending;
  class Utterance {
    constructor(text) {
      this.text = text;
    }
  }
  class Speech extends EventTarget {
    getVoices() {
      return [
        {
          name: "Test English",
          lang: "en-US",
          voiceURI: "test-en",
          localService: true,
          default: true,
        },
      ];
    }
    cancel() {
      clearTimeout(pending);
    }
    speak(u) {
      window.__spoken.push(u.text);
      pending = setTimeout(() => u.onend?.(), window.__speechDelay);
    }
  }
  Object.defineProperty(window, "speechSynthesis", {
    configurable: true,
    value: new Speech(),
  });
  window.SpeechSynthesisUtterance = Utterance;
}
(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  try {
    for (const width of [320, 360, 393, 430]) {
      const c = await browser.newContext({
        viewport: { width, height: 852 },
        screen: { width, height: 852 },
        isMobile: true,
        hasTouch: true,
        timezoneId: "Asia/Kolkata",
      });
      const p = await c.newPage();
      await p.addInitScript(speechMock);
      await p.goto("http://localhost:8089");
      await p
        .getByRole("heading", { name: "Manifestation", exact: true })
        .waitFor();
      assert.ok(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await p.screenshot({
        path: "mobile-verification/manifest-" + width + ".png",
      });
      await p
        .getByRole("button", { name: "Choose affirmations", exact: true })
        .click();
      await p
        .getByRole("heading", { name: "Affirmation library", exact: true })
        .waitFor();
      assert.ok(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await p.screenshot({
        path: "mobile-verification/affirmations-" + width + ".png",
      });
      if (width === 393) {
        const audit = await new AxeBuilder({ page: p })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        assert.deepEqual(
          audit.violations.map((v) => ({
            id: v.id,
            nodes: v.nodes.map((n) => n.target),
          })),
          [],
        );
      }
      if (width === 320) {
        await p.getByRole("button", { name: "Settings", exact: true }).click();
        const size = p.getByRole("slider", { name: "Text size", exact: true });
        await size.focus();
        await size.press("End");
        await p
          .getByLabel("Spacing", { exact: true })
          .selectOption("comfortable");
        await p
          .getByRole("button", { name: "Close settings", exact: true })
          .click();
        assert.ok(
          await p.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        );
        await p.screenshot({
          path: "mobile-verification/affirmations-large-320.png",
        });
        await p
          .getByRole("button", { name: "Manifest", exact: true })
          .last()
          .click();
        assert.ok(
          await p.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        );
        await p.screenshot({
          path: "mobile-verification/manifest-large-320.png",
        });
      }
      await c.close();
    }
    const ctx = await browser.newContext({
      viewport: { width: 393, height: 852 },
      screen: { width: 393, height: 852 },
      isMobile: true,
      hasTouch: true,
      timezoneId: "Asia/Kolkata",
    });
    const p = await ctx.newPage(),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.addInitScript(speechMock);
    await p.goto("http://localhost:8089");
    await p
      .getByRole("button", { name: "Choose affirmations", exact: true })
      .click();
    const texts = [];
    for (const category of ["Health", "Wealth", "Success"]) {
      await p.getByLabel("Category", { exact: true }).selectOption(category);
      const first = p.locator(".affirmation-choice").first();
      texts.push(await first.locator("span").innerText());
      await first.getByRole("checkbox").check();
    }
    await p
      .getByRole("button", { name: "Use selection (3)", exact: true })
      .click();
    await p
      .getByLabel("Practice name", { exact: true })
      .fill("Morning manifestation");
    await p.getByLabel("Repetitions", { exact: true }).fill("2");
    await p
      .getByLabel("Gap between sentences (sec)", { exact: true })
      .fill("0");
    await p.getByRole("button", { name: "Save practice", exact: true }).click();
    await p.getByText("Practice saved in Library.", { exact: true }).waitFor();
    await p.getByRole("button", { name: "Play practice", exact: true }).click();
    await p.getByText("Practice complete", { exact: true }).waitFor();
    assert.deepEqual(await p.evaluate(() => window.__spoken), [
      ...texts,
      ...texts,
    ]);
    await p.getByLabel("Repeat order", { exact: true }).selectOption("each");
    await p.getByRole("button", { name: "Play practice", exact: true }).click();
    await p.getByText("Practice complete", { exact: true }).waitFor();
    assert.deepEqual(
      (await p.evaluate(() => window.__spoken)).slice(6),
      texts.flatMap((t) => [t, t]),
    );
    await p.evaluate(() => (window.__speechDelay = 3000));
    await p.getByRole("button", { name: "Play practice", exact: true }).click();
    await p.getByRole("button", { name: "Pause", exact: true }).click();
    await p.getByRole("button", { name: "Resume", exact: true }).waitFor();
    await p.getByRole("button", { name: "Resume", exact: true }).click();
    await p.getByRole("button", { name: "Stop practice", exact: true }).click();
    await p.getByLabel("Practice mode", { exact: true }).selectOption("read");
    const count = await p.evaluate(() => window.__spoken.length);
    await p.getByRole("button", { name: "Play practice", exact: true }).click();
    await p.getByRole("button", { name: "Pause", exact: true }).click();
    assert.equal(await p.evaluate(() => window.__spoken.length), count);
    await p.getByRole("button", { name: "Stop practice", exact: true }).click();
    await p.getByRole("button", { name: "Schedule", exact: true }).click();
    await p.getByLabel("Reminder time", { exact: true }).fill("17:30");
    await p.getByRole("button", { name: "Add schedule", exact: true }).click();
    await p
      .getByRole("heading", {
        name: "Morning manifestation · 17:30",
        exact: true,
      })
      .waitFor();
    const downloading = p.waitForEvent("download");
    await p
      .getByRole("button", { name: "Export calendar reminder", exact: true })
      .click();
    const file = await downloading;
    await file.saveAs("mobile-verification/manifest-reminder.ics");
    assert.ok(
      fs
        .readFileSync("mobile-verification/manifest-reminder.ics", "utf8")
        .includes("BEGIN:VALARM"),
    );
    await p.screenshot({
      path: "mobile-verification/manifest-schedule-393.png",
    });
    await p.evaluate(() => {
      const data = JSON.parse(
        localStorage.getItem("core-aura.manifestation.v1"),
      );
      const now = new Date();
      data.reminders[0].time =
        String(now.getHours()).padStart(2, "0") +
        ":" +
        String(now.getMinutes()).padStart(2, "0");
      localStorage.setItem("core-aura.manifestation.v1", JSON.stringify(data));
    });
    await p.reload();
    await p
      .getByRole("button", { name: "Open practice", exact: true })
      .waitFor();
    assert.deepEqual(await p.evaluate(() => window.__spoken), []);
    await p.getByRole("button", { name: "Open practice", exact: true }).click();
    assert.deepEqual(await p.evaluate(() => window.__spoken), []);
    await p.reload();
    assert.equal(
      await p
        .getByRole("button", { name: "Open practice", exact: true })
        .count(),
      0,
    );
    // Opt-in auto-start is separate from reminder-only delivery.
    const waitForFreshMinute = await p.evaluate(() => {
      const sec = new Date().getSeconds();
      return sec > 50 ? (60 - sec) * 1000 + 250 : 0;
    });
    if (waitForFreshMinute) await p.waitForTimeout(waitForFreshMinute);
    await p.evaluate(() => {
      const value = JSON.parse(
        localStorage.getItem("core-aura.manifestation.v1"),
      );
      const now = new Date();
      value.draft = value.plans[0];
      value.reminders[0].autoStart = true;
      value.reminders[0].time =
        String(now.getHours()).padStart(2, "0") +
        ":" +
        String(now.getMinutes()).padStart(2, "0");
      localStorage.setItem("core-aura.manifestation.v1", JSON.stringify(value));
      localStorage.removeItem("core-aura.manifestation.delivered");
    });
    await p.reload();
    await p.waitForFunction(() => window.__spoken.length === 6);
    await p.getByText("Practice complete", { exact: true }).waitFor();
    await p.reload();
    await p
      .getByRole("heading", { name: "Manifestation", exact: true })
      .waitFor();
    assert.deepEqual(await p.evaluate(() => window.__spoken), []);
    await p.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await p.reload();
    await p.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    await ctx.setOffline(true);
    await p.reload();
    await p.getByLabel("Practice mode", { exact: true }).selectOption("read");
    await p.getByRole("button", { name: "Play practice", exact: true }).click();
    await p.getByRole("button", { name: "Pause", exact: true }).waitFor();
    await p.getByRole("button", { name: "Stop practice", exact: true }).click();
    await p
      .getByRole("button", { name: "Library", exact: true })
      .last()
      .click();
    await p
      .getByRole("heading", { name: "Morning manifestation", exact: true })
      .waitFor();
    const exporting = p.waitForEvent("download");
    await p
      .getByRole("button", { name: "Export practice", exact: true })
      .click();
    const backup = await exporting;
    await backup.saveAs("mobile-verification/manifest-practice.json");
    assert.equal(
      JSON.parse(
        fs.readFileSync("mobile-verification/manifest-practice.json", "utf8"),
      ).lines.length,
      3,
    );
    p.once("dialog", (d) => d.accept());
    await p
      .getByRole("button", { name: "Delete practice", exact: true })
      .click();
    assert.equal(
      await p
        .getByRole("heading", { name: "Morning manifestation", exact: true })
        .count(),
      0,
    );
    assert.deepEqual(errors, []);
    await ctx.close();
    console.log(
      "Manifestation categories, multi-sentence repeats, pause/read mode, scheduling, deduplication, offline practice and backups passed.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
