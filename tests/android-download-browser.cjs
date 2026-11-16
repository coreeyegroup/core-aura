const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  AxeBuilder = require("@axe-core/playwright").default;
(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  try {
    const c = await browser.newContext({
      viewport: { width: 393, height: 852 },
      isMobile: true,
      hasTouch: true,
    });
    const p = await c.newPage(),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    let available = false;
    const sha = "a".repeat(64),
      release = {
        schemaVersion: 1,
        applicationId: "in.coreeye.coreaura",
        versionName: "0.19.0",
        versionCode: 19,
        minSdk: 23,
        url:
          "https://core-aura.coreeye.in/android/releases/" +
          sha +
          "/core-aura-0.19.0.apk",
        sha256: sha,
        size: 8400000,
        certificateSha256: "b".repeat(64),
        publishedAt: "2026-11-16T10:00:00Z",
      };
    await p.route("**/android/latest.json", (r) =>
      available
        ? r.fulfill({ json: release })
        : r.fulfill({ status: 404, body: "Not published" }),
    );
    await p.goto("http://localhost:8089/download.html");
    await p
      .getByText(
        "The Android download is not available right now. Please try again later.",
        { exact: true },
      )
      .waitFor();
    assert.equal(await p.locator("#release").isVisible(), false);
    available = true;
    await p.getByRole("button", { name: "Check again", exact: true }).click();
    await p
      .getByRole("link", { name: "Download Android APK", exact: true })
      .waitFor();
    assert.equal(await p.locator("#apk").getAttribute("href"), release.url);
    await p.getByText("0.19.0 · build 19", { exact: true }).waitFor();
    assert.ok(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
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
    await p.screenshot({
      path: "mobile-verification/android-download-393.png",
      fullPage: true,
    });
    await p.setViewportSize({ width: 320, height: 852 });
    assert.ok(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    assert.deepEqual(errors, []);
    await c.close();
    console.log(
      "Android website download, unpublished channel, retry, immutable APK link, phone overflow and accessibility passed.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
