const { chromium } = require("playwright");
const AxeBuilder = require("@axe-core/playwright").default;
const assert = require("node:assert/strict");
const fs = require("node:fs");
(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  try {
    const ctx = await browser.newContext({
      viewport: { width: 393, height: 852 },
      screen: { width: 393, height: 852 },
      isMobile: true,
      hasTouch: true,
    });
    const p = await ctx.newPage(),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    const built = JSON.parse(fs.readFileSync("dist/catalog-packs.json", "utf8"))
      .packs[0];
    let manifest = {
      ...built,
      id: "server-study",
      title: "Published study",
      version: "1.0.0",
    };
    await p.route("**/api/catalog", (route) =>
      route.fulfill({ json: { packs: [manifest] } }),
    );
    await p.goto("http://localhost:8089");
    await p.getByRole("button", { name: "Sound packs", exact: true }).click();
    await p
      .getByRole("heading", { name: "Published study", exact: true })
      .waitFor();
    await p.screenshot({ path: "mobile-verification/catalog-393.png" });
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
    const card = p
      .locator(".pack-card")
      .filter({
        has: p.getByRole("heading", { name: "Published study", exact: true }),
      });
    await card
      .getByRole("button", { name: "Download pack", exact: true })
      .click();
    await card
      .getByRole("button", { name: "Downloaded", exact: true })
      .waitFor();
    assert.equal(
      await p.evaluate(async () => {
        let n = 0;
        for (const key of await caches.keys()) {
          const c = await caches.open(key);
          n += (await c.keys()).filter((r) =>
            new URL(r.url).pathname.startsWith("/packs/"),
          ).length;
        }
        return n;
      }),
      0,
    );
    // Cancelling an update leaves the complete older pack in IndexedDB.
    manifest = { ...manifest, version: "1.1.0" };
    await p
      .getByRole("button", { name: "Refresh catalog", exact: true })
      .click();
    await card
      .getByRole("button", { name: "Download update", exact: true })
      .waitFor();
    await p.route("**/packs/**", async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route
        .fulfill({ status: 503, body: "temporarily unavailable" })
        .catch(() => {});
    });
    await card
      .getByRole("button", { name: "Download update", exact: true })
      .click();
    await p
      .getByRole("button", { name: "Cancel download", exact: true })
      .click();
    await p
      .getByText("Download cancelled. Existing downloads were kept.", {
        exact: true,
      })
      .waitFor();
    await p.unroute("**/packs/**");
    // A corrupt update cannot replace the old version.
    manifest = {
      ...manifest,
      assets: manifest.assets.map((a) => ({ ...a, sha256: "0".repeat(64) })),
    };
    await p
      .getByRole("button", { name: "Refresh catalog", exact: true })
      .click();
    await p.waitForTimeout(200);
    await card
      .getByRole("button", { name: "Download update", exact: true })
      .click();
    await p
      .getByText(
        "File integrity check failed. The previous version has been kept",
        { exact: true },
      )
      .waitFor();
    await p
      .getByRole("button", { name: "Library", exact: true })
      .last()
      .click();
    const installed = p
      .locator(".pack-card")
      .filter({
        has: p.getByRole("heading", { name: "Published study", exact: true }),
      });
    await installed.getByText("v1.0.0", { exact: true }).waitFor();
    await p.screenshot({ path: "mobile-verification/downloaded-393.png" });
    await installed
      .getByRole("button", { name: "Play Bell · 432 Hz", exact: true })
      .click();
    await installed
      .getByRole("button", { name: "Pause Bell · 432 Hz", exact: true })
      .waitFor();
    await p.waitForTimeout(1100);
    await installed
      .getByRole("button", { name: "Pause Bell · 432 Hz", exact: true })
      .click();
    await installed
      .getByRole("button", { name: "Resume Bell · 432 Hz", exact: true })
      .waitFor();
    const track = installed.locator(".pack-track").first();
    const paused = await track.locator("small").innerText();
    await p.waitForTimeout(300);
    assert.equal(await track.locator("small").innerText(), paused);
    await installed
      .getByRole("button", { name: "Resume Bell · 432 Hz", exact: true })
      .click();
    await installed
      .getByRole("button", { name: "Pause Bell · 432 Hz", exact: true })
      .waitFor();
    await p.getByRole("button", { name: "Studio", exact: true }).last().click();
    await p.getByRole("button", { name: "Play", exact: true }).last().click();
    await p
      .getByRole("button", { name: "Pause", exact: true })
      .last()
      .waitFor();
    await p.getByRole("button", { name: "Stop", exact: true }).last().click();
    await p
      .getByRole("button", { name: "Library", exact: true })
      .last()
      .click();
    await installed
      .getByRole("button", { name: "Play Bell · 432 Hz", exact: true })
      .waitFor();
    await p.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await p.reload();
    await p.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    await ctx.setOffline(true);
    await p.reload();
    await installed
      .getByRole("button", { name: "Play Singing bowl · 432 Hz", exact: true })
      .click();
    await installed
      .getByRole("button", { name: "Pause Singing bowl · 432 Hz", exact: true })
      .waitFor();
    await installed
      .getByRole("button", { name: "Stop Singing bowl · 432 Hz", exact: true })
      .click();
    p.once("dialog", (d) => d.accept());
    await installed
      .getByRole("button", { name: "Remove download", exact: true })
      .click();
    await p
      .getByText("No packs downloaded. Find them in Explore → Sound packs.", {
        exact: true,
      })
      .waitFor();
    await p.reload();
    await p
      .getByText("No packs downloaded. Find them in Explore → Sound packs.", {
        exact: true,
      })
      .waitFor();
    assert.deepEqual(errors, []);
    await ctx.close();
    console.log(
      "Catalog, integrity, update cancellation, offline recorded playback, pause/resume, shared engine and removal passed.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
