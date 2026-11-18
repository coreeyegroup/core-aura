const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  AxeBuilder = require("@axe-core/playwright").default,
  { navigate } = require("./navigation.cjs");
(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  try {
    const c = await browser.newContext({
        viewport: { width: 393, height: 852 },
        isMobile: true,
        hasTouch: true,
        colorScheme: "light",
      }),
      p = await c.newPage(),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto("http://localhost:8089");
    const metrics = [];
    for (const theme of ["light", "dark", "contrast"]) {
      await p.getByRole("button", { name: "Settings", exact: true }).click();
      await p.getByLabel("Theme", { exact: true }).selectOption(theme);
      await p
        .getByRole("button", { name: "Close settings", exact: true })
        .click();
      for (const tab of [
        "Home",
        "Manifest",
        "Library",
        "Studio",
        "Chakras",
        "Explore",
      ]) {
        if (tab === "Home" || tab === "Manifest" || tab === "Library")
          await p
            .getByRole("button", { name: tab, exact: true })
            .last()
            .click();
        else await navigate(p, tab);
        if (tab === "Library")
          await p
            .getByRole("button", { name: "Affirmations", exact: true })
            .click();
        await p.screenshot({
          path: `mobile-verification/design-${theme}-${tab.toLowerCase()}-393.png`,
        });
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
        assert.ok(
          await p.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        );
        const buttons = await p.locator("button:visible").evaluateAll((rows) =>
          rows.map((e) => ({
            label: e.getAttribute("aria-label") || e.textContent,
            height: e.getBoundingClientRect().height,
          })),
        );
        assert.ok(
          buttons.every((b) => b.height >= 35.9),
          JSON.stringify(buttons.filter((b) => b.height < 35.9)),
        );
        if (tab === "Library") {
          const rows = await p
            .locator(".affirmation-row")
            .evaluateAll((rows) =>
              rows.map((e) => e.getBoundingClientRect().height),
            );
          assert.ok(rows.length === 5 && rows.every((h) => h <= 76));
          metrics.push({ theme, affirmationHeights: rows });
        }
        if (tab === "Chakras") {
          const rows = await p
            .locator(".chakra-row")
            .evaluateAll((rows) =>
              rows.map((e) => e.getBoundingClientRect().height),
            );
          assert.equal(rows.length, 7);
          assert.ok(rows.every((h) => h <= 120));
        }
      }
    }
    await p.getByRole("button", { name: "Settings", exact: true }).click();
    await p.getByLabel("Theme", { exact: true }).selectOption("dark");
    await p.getByLabel("Spacing", { exact: true }).selectOption("comfortable");
    await p.getByRole("slider", { name: "Text size", exact: true }).focus();
    await p
      .getByRole("slider", { name: "Text size", exact: true })
      .press("End");
    await p
      .getByRole("button", { name: "Close settings", exact: true })
      .click();
    await p.reload();
    assert.equal(
      await p.evaluate(() => document.documentElement.dataset.resolvedTheme),
      "dark",
    );
    assert.equal(
      await p.evaluate(() => getComputedStyle(document.body).fontSize),
      "22.4px",
    );
    await p.setViewportSize({ width: 320, height: 852 });
    for (const tab of ["Home", "Manifest", "Library", "Studio", "Chakras"]) {
      if (tab === "Home" || tab === "Manifest" || tab === "Library")
        await p.getByRole("button", { name: tab, exact: true }).last().click();
      else await navigate(p, tab);
      assert.ok(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await p.screenshot({
        path: `mobile-verification/design-large-dark-${tab.toLowerCase()}-320.png`,
      });
    }
    await p.getByRole("button", { name: "Settings", exact: true }).click();
    await p.getByRole("button", { name: "Reset display", exact: true }).click();
    await p
      .getByRole("button", { name: "Close settings", exact: true })
      .click();
    await p.emulateMedia({ colorScheme: "dark" });
    await p.waitForFunction(
      () => document.documentElement.dataset.resolvedTheme === "dark",
    );
    await p.emulateMedia({ colorScheme: "light" });
    await p.waitForFunction(
      () => document.documentElement.dataset.resolvedTheme === "light",
    );
    assert.equal(
      await p.evaluate(
        () => document.querySelector('meta[name="theme-color"]').content,
      ),
      "#f4f6f8",
    );
    await p.setViewportSize({ width: 1366, height: 900 });
    await navigate(p, "Studio");
    await p.screenshot({
      path: "mobile-verification/design-desktop-studio.png",
    });
    assert.ok(
      (await p
        .locator(".app")
        .evaluate((e) => e.getBoundingClientRect().width)) > 1000,
    );
    await p
      .getByRole("button", { name: "Manifest", exact: true })
      .last()
      .click();
    await p.screenshot({
      path: "mobile-verification/design-desktop-manifest.png",
    });
    assert.equal(
      await p
        .locator(".practice-grid")
        .evaluate((e) => getComputedStyle(e).display),
      "grid",
    );
    require("node:fs").writeFileSync(
      "mobile-verification/design-metrics.json",
      JSON.stringify(metrics, null, 2),
    );
    assert.deepEqual(errors, []);
    await c.close();
    console.log(
      "Verified full-screen redesign, three explicit themes, system changes, theme persistence, accessibility, touch targets and compact row density.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
