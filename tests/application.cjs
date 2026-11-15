const { chromium } = require("playwright");
const AxeBuilder = require("@axe-core/playwright").default;
const assert = require("node:assert/strict");
const fs = require("node:fs");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--no-sandbox"],
  });
  const results = [];
  fs.mkdirSync("mobile-verification", { recursive: true });
  try {
    for (const width of [320, 360, 393, 430]) {
      const ctx = await browser.newContext({
        viewport: { width, height: 852 },
        screen: { width, height: 852 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 1,
      });
      const p = await ctx.newPage();
      const errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      await p.goto("http://localhost:8089");
      await p.getByRole("heading", { name: /Make room/ }).waitFor();
      for (const tab of ["Studio", "Chakras", "Library", "Explore"]) {
        await p.getByRole("button", { name: tab, exact: true }).last().click();
        const metrics = await p.evaluate(() => ({
          width: document.documentElement.clientWidth,
          overflow: document.documentElement.scrollWidth,
          font: getComputedStyle(document.body).fontSize,
          scale: visualViewport.scale,
        }));
        assert.equal(metrics.width, width);
        assert.ok(metrics.overflow <= width);
        assert.equal(metrics.font, "16px");
        await p.screenshot({
          path:
            "mobile-verification/" + tab.toLowerCase() + "-" + width + ".png",
        });
        if (width === 393) {
          const audit = await new AxeBuilder({ page: p })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze();
          assert.deepEqual(
            audit.violations.map((v) => ({
              id: v.id,
              description: v.description,
              nodes: v.nodes.map((n) => n.target),
            })),
            [],
          );
        }
        results.push({ tab, width, ...metrics });
      }
      assert.deepEqual(errors, []);
      await ctx.close();
    }
    const ctx = await browser.newContext({
      viewport: { width: 393, height: 852 },
      isMobile: true,
      hasTouch: true,
      screen: { width: 393, height: 852 },
    });
    const p = await ctx.newPage();
    await p.addInitScript(() => {
      localStorage.setItem(
        "core-aura.sessions.v1",
        JSON.stringify([
          {
            name: "Legacy flute",
            instrument: "flute",
            hz: "432",
            volume: "15",
            seconds: "600",
            drone: true,
            sa: "216",
            mix: "12",
          },
        ]),
      );
    });
    await p.goto("http://localhost:8089");
    await p.getByRole("button", { name: "Studio", exact: true }).last().click();
    await p.getByRole("button", { name: "Play", exact: true }).last().click();
    await p
      .getByRole("button", { name: "Pause", exact: true })
      .last()
      .waitFor();
    await p.getByRole("button", { name: "Pause", exact: true }).last().click();
    await p
      .getByRole("button", { name: "Resume", exact: true })
      .last()
      .waitFor();
    await p.getByRole("button", { name: "Resume", exact: true }).last().click();
    await p
      .getByRole("button", { name: "Pause", exact: true })
      .last()
      .waitFor();
    await p.getByRole("button", { name: "Stop", exact: true }).last().click();
    await p.getByRole("button", { name: "Play", exact: true }).last().waitFor();
    await p
      .getByRole("button", { name: "Add sound layer", exact: true })
      .click();
    assert.equal(await p.locator(".layer").count(), 2);
    await p.getByRole("button", { name: "Save", exact: true }).click();
    await p
      .getByRole("textbox", { name: "Session name", exact: true })
      .fill("Layered evening");
    await p.getByRole("button", { name: "Save to Library" }).click();
    await p
      .getByRole("button", { name: "Library", exact: true })
      .last()
      .click();
    await p.getByRole("heading", { name: "Layered evening" }).waitFor();
    await p.getByRole("heading", { name: "Legacy flute" }).waitFor();
    await p
      .getByRole("button", { name: "Chakras", exact: true })
      .last()
      .click();
    await p.getByRole("button", { name: "All seven", exact: true }).click();
    await p.getByRole("button", { name: "Play", exact: true }).last().click();
    await p
      .getByRole("button", { name: "Pause", exact: true })
      .last()
      .waitFor();
    await p.waitForFunction(
      () => document.querySelectorAll(".chakra-row.active").length === 7,
    );
    await p.getByRole("button", { name: "Pause", exact: true }).last().click();
    await p
      .getByRole("button", { name: "Resume", exact: true })
      .last()
      .waitFor();
    await p.getByRole("button", { name: "Stop", exact: true }).last().click();
    await p.waitForFunction(
      () => document.querySelectorAll(".chakra-row.active").length === 0,
    );
    await p.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await p.reload();
    await p.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    await ctx.setOffline(true);
    await p.reload();
    await p
      .getByRole("button", { name: "Library", exact: true })
      .last()
      .click();
    const saved = p
      .locator(".saved-card")
      .filter({ has: p.getByRole("heading", { name: "Layered evening" }) });
    await saved.getByRole("button", { name: "Open", exact: true }).click();
    assert.equal(await p.locator(".layer").count(), 2);
    await p.getByRole("button", { name: "Play", exact: true }).last().click();
    await p
      .getByRole("button", { name: "Pause", exact: true })
      .last()
      .waitFor();
    await p.getByRole("button", { name: "Stop", exact: true }).last().click();
    await ctx.close();
    // Display controls vary text independently of layout and persist across reloads.
    const display = await browser.newContext({
      viewport: { width: 320, height: 852 },
      screen: { width: 320, height: 852 },
      isMobile: true,
      hasTouch: true,
    });
    const q = await display.newPage();
    await q.goto("http://localhost:8089/#studio");
    assert.equal(
      await q.getByRole("button", { name: "Play", exact: true }).count(),
      1,
    );
    await q.getByRole("button", { name: "Settings", exact: true }).click();
    await q.getByRole("slider", { name: "Text size", exact: true }).fill("140");
    await q.getByLabel("Spacing", { exact: true }).selectOption("comfortable");
    await q.getByRole("button", { name: "Close settings" }).click();
    await q.reload();
    assert.equal(
      await q.evaluate(() => getComputedStyle(document.body).fontSize),
      "22.4px",
    );
    for (const tab of ["Studio", "Chakras", "Library", "Explore"]) {
      await q.getByRole("button", { name: tab, exact: true }).last().click();
      assert.ok(
        await q.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await q.screenshot({
        path: "mobile-verification/large-" + tab.toLowerCase() + "-320.png",
      });
    }
    await q.getByRole("button", { name: "Settings", exact: true }).click();
    await q.getByRole("button", { name: "Reset display" }).click();
    await q.getByRole("button", { name: "Close settings" }).click();
    await q.getByRole("button", { name: "Studio", exact: true }).last().click();
    // Save and download actual generated audio through a module worker, offline.
    await q.getByRole("button", { name: "Save", exact: true }).click();
    await q
      .getByRole("textbox", { name: "Session name", exact: true })
      .fill("WAV test");
    await q.getByRole("button", { name: "Save to Library" }).click();
    await q.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await q.reload();
    await q.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    await display.setOffline(true);
    await q
      .getByRole("button", { name: "Library", exact: true })
      .last()
      .click();
    await q.getByRole("button", { name: "WAV audio", exact: true }).click();
    await q.getByLabel("Export duration", { exact: true }).selectOption("15");
    const downloading = q.waitForEvent("download");
    await q.getByRole("button", { name: "Download WAV", exact: true }).click();
    const download = await downloading;
    await download.saveAs("mobile-verification/session.wav");
    const wav = fs.readFileSync("mobile-verification/session.wav");
    assert.equal(wav.subarray(0, 4).toString(), "RIFF");
    assert.equal(wav.readUInt32LE(24), 44100);
    assert.equal(wav.length, 44 + 15 * 44100 * 2);
    await display.close();
    fs.writeFileSync(
      "mobile-verification/measurements.json",
      JSON.stringify(results, null, 2),
    );
    console.log(
      "Phone screens, accessibility, playback, seven-channel mixing, legacy migration and offline session replay passed.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
