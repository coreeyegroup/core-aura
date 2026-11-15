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
    // Host browser that ignores mobile viewport, including desktop dimensions.
    const ignored = await browser.newContext({
      viewport: { width: 980, height: 2100 },
      screen: { width: 980, height: 2100 },
      isMobile: false,
      hasTouch: true,
      deviceScaleFactor: 1,
    });
    const q = await ignored.newPage();
    await q.goto("http://localhost:8089");
    const fallback = await q.evaluate(() => ({
      zoom: Number(getComputedStyle(document.documentElement).zoom),
      overflow: document.documentElement.scrollWidth,
    }));
    assert.ok(fallback.zoom > 2.7 && fallback.overflow <= 980);
    await q.screenshot({ path: "mobile-verification/ignored-viewport.png" });
    await ignored.close();
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
