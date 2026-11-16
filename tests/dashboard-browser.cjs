const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  try {
    const context = await browser.newContext({
      viewport: { width: 393, height: 852 },
      isMobile: true,
      hasTouch: true,
    });
    const p = await context.newPage(),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.addInitScript(() => {
      if (localStorage.getItem("core-aura.manifestation.v1")) return;
      const plan = {
        schemaVersion: 1,
        id: "dashboard-plan",
        name: "Morning focus",
        lines: [
          { id: "line-1", text: "I focus on the actions within my control." },
        ],
        order: "sequence",
        repeats: 3,
        gap: 2,
        readSeconds: 5,
        mode: "read",
        voice: "",
        rate: 1,
        volume: 0.7,
        seconds: 600,
        background: null,
      };
      localStorage.setItem(
        "core-aura.manifestation.v1",
        JSON.stringify({
          schemaVersion: 1,
          draft: plan,
          plans: [plan],
          reminders: [
            {
              id: "reminder-1",
              slot: 0,
              planId: plan.id,
              time: "07:00",
              days: [0, 1, 2, 3, 4, 5, 6],
              enabled: true,
            },
          ],
        }),
      );
    });
    await p.goto("http://localhost:8089");
    await p.getByRole("heading", { name: "Overview", exact: true }).waitFor();
    const metrics = await p.locator(".account-metrics dd").allTextContents();
    assert.deepEqual(metrics, ["1", "1", "0"]);
    await p
      .locator(".reminder-ticker")
      .getByText("07:00", { exact: true })
      .waitFor();
    await p.screenshot({ path: "mobile-verification/dashboard-saved-393.png" });
    await p
      .getByRole("button", {
        name: "Play saved practice: Morning focus",
        exact: true,
      })
      .click();
    await p
      .getByRole("button", {
        name: "Pause saved practice: Morning focus",
        exact: true,
      })
      .waitFor();
    await p.getByRole("button", { name: "Stop practice", exact: true }).click();
    await p
      .locator(".intention-grid")
      .getByRole("button", { name: /Wealth/ })
      .click();
    assert.equal(
      await p.getByLabel("Category", { exact: true }).inputValue(),
      "Wealth",
    );
    await p.getByRole("button", { name: "Home", exact: true }).click();
    await p
      .locator(".tool-grid")
      .getByRole("button", { name: "Schedule", exact: true })
      .click();
    await p.getByLabel("Reminder time", { exact: true }).waitFor();
    await p.getByRole("button", { name: "Home", exact: true }).click();
    await p
      .locator(".tool-grid")
      .getByRole("button", { name: "Recordings", exact: true })
      .click();
    assert.equal(await p.locator(".personal-voices").getAttribute("open"), "");
    await p.getByRole("button", { name: "Home", exact: true }).click();
    await p
      .locator(".tool-grid")
      .getByRole("button", { name: "Sound packs", exact: true })
      .click();
    await p
      .getByRole("heading", { name: "Sound packs", exact: true })
      .waitFor();
    await p.getByRole("button", { name: "Home", exact: true }).click();
    await p.locator(".tone-grid").getByRole("button", { name: /528/ }).click();
    assert.equal(
      await p.getByLabel("Frequency (Hz)", { exact: true }).inputValue(),
      "528",
    );
    await p.getByRole("button", { name: "Home", exact: true }).click();
    await p
      .getByRole("button", { name: "Continue practice", exact: true })
      .click();
    assert.equal(await p.locator(".sentence-editor[open]").count(), 0);
    await p.getByLabel("Edit sentence 1", { exact: true }).click();
    await p
      .getByLabel("Sentence 1", { exact: true })
      .fill("I take a clear step forward.");
    await p.getByLabel("Edit sentence 1", { exact: true }).click();
    await p.locator(".queue-copy")
      .getByText("I take a clear step forward.", { exact: true })
      .waitFor();
    await p.screenshot({
      path: "mobile-verification/dashboard-practice-queue-393.png",
    });
    await p.getByRole("button", { name: "Home", exact: true }).click();
    await p.setViewportSize({ width: 1366, height: 900 });
    await p.screenshot({ path: "mobile-verification/dashboard-desktop.png" });
    assert.ok(
      await p
        .locator(".dashboard")
        .evaluate(
          (e) =>
            getComputedStyle(e).gridTemplateColumns.split(" ").length === 2,
        ),
    );
    assert.deepEqual(errors, []);
    await context.close();
    console.log(
      "Dashboard real counts, upcoming schedule, category navigation, saved playback, tool shortcuts, tone tuning and compact sentence editing passed.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
