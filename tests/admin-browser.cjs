const { chromium } = require("playwright");
const AxeBuilder = require("@axe-core/playwright").default;
const assert = require("node:assert/strict");
const fs = require("node:fs");
(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  try {
    const context = await browser.newContext({
      viewport: { width: 393, height: 852 },
      screen: { width: 393, height: 852 },
      isMobile: true,
      hasTouch: true,
    });
    const p = await context.newPage(),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto("http://localhost:8089/#admin");
    await p
      .getByRole("heading", { name: "Content administration", exact: true })
      .waitFor();
    await p
      .getByLabel("Operator name", { exact: true })
      .fill("Browser reviewer");
    await p
      .getByLabel("Administrator access key", { exact: true })
      .fill("wrong");
    await p.getByRole("button", { name: "Connect", exact: true }).click();
    await p
      .getByText("Access key was not accepted. Sign out and connect again.", {
        exact: true,
      })
      .waitFor();
    await p
      .getByLabel("Administrator access key", { exact: true })
      .fill("test-browser-admin");
    await p.getByRole("button", { name: "Connect", exact: true }).click();
    await p.getByRole("heading", { name: "New pack", exact: true }).waitFor();
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
    assert.equal(
      await p.evaluate(() =>
        JSON.stringify({ ...localStorage, ...sessionStorage }).includes(
          "test-browser-admin",
        ),
      ),
      false,
    );
    await p
      .getByLabel("Pack identifier", { exact: true })
      .fill("browser-review-pack");
    await p
      .getByLabel("Pack title", { exact: true })
      .fill("Browser review pack");
    await p
      .getByLabel("Description", { exact: true })
      .fill("Original technical sound study for the publication workflow.");
    await p
      .getByLabel("Creator", { exact: true })
      .fill("Core-aura test fixture");
    await p
      .getByLabel("License or permission", { exact: true })
      .fill("CC0-1.0");
    await p
      .getByLabel("Attribution", { exact: true })
      .fill("Core-aura synthesis engine");
    await p
      .getByLabel("Source and review context", { exact: true })
      .fill("Generated original synthesis, no performer recording.");
    const built = JSON.parse(fs.readFileSync("dist/catalog-packs.json", "utf8"))
      .packs[0];
    const bytes = fs.readFileSync("dist" + built.assets[0].url);
    await p
      .getByLabel("Audio file", { exact: true })
      .setInputFiles({
        name: "review-bell.wav",
        mimeType: "audio/wav",
        buffer: bytes,
      });
    await p
      .getByRole("button", { name: "Upload and attach", exact: true })
      .click();
    await p
      .getByText(
        "Audio uploaded and attached. Save the draft to keep this attachment.",
        { exact: true },
      )
      .waitFor();
    const uploads = await p.request.get(
      "http://localhost:8089/api/admin/assets",
      { headers: { Authorization: "Bearer test-browser-admin" } },
    );
    const asset = (await uploads.json()).assets[0];
    assert.equal(
      (await p.request.get("http://localhost:8089" + asset.url)).status(),
      404,
    );
    assert.equal(
      (
        await p.request.get(
          "http://localhost:8089/api/admin/assets/" + asset.sha256,
        )
      ).status(),
      401,
    );
    await p.getByRole("button", { name: "Save draft", exact: true }).click();
    await p
      .getByText("Draft saved. Review before publishing.", { exact: true })
      .waitFor();
    await p
      .locator("summary")
      .filter({ hasText: "Available uploads (" })
      .click();
    await p
      .getByRole("button", { name: "Preview review-bell", exact: true })
      .click();
    await p
      .getByRole("button", { name: "Pause preview review-bell", exact: true })
      .waitFor();
    await p
      .getByRole("button", { name: "Stop preview review-bell", exact: true })
      .click();
    await p
      .getByLabel("Review notes", { exact: true })
      .fill(
        "Rights, tuning and source descriptions reviewed for this test study.",
      );
    await p.getByRole("button", { name: "Mark reviewed", exact: true }).click();
    await p.getByText("Pack status: reviewed.", { exact: true }).waitFor();
    await p
      .getByLabel("Review notes", { exact: true })
      .fill("Approved for publication as an original synthesis test.");
    await p.getByRole("button", { name: "Publish pack", exact: true }).click();
    await p.getByText("Pack status: published.", { exact: true }).waitFor();
    assert.equal(
      (await p.request.get("http://localhost:8089" + asset.url)).status(),
      200,
    );
    await p
      .locator("summary")
      .filter({ hasText: "Revision history (3)" })
      .click();
    await p.getByText("published · revision 3", { exact: true }).waitFor();
    await p.screenshot({ path: "mobile-verification/admin-review-393.png" });
    const auditPublished = await new AxeBuilder({ page: p })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    assert.deepEqual(
      auditPublished.violations.map((v) => v.id),
      [],
    );
    const catalog = await p.request.get("http://localhost:8089/api/catalog");
    assert.ok(
      (await catalog.json()).packs.some(
        (row) => row.id === "browser-review-pack",
      ),
    );
    await p
      .getByLabel("Review notes", { exact: true })
      .fill("Withdrawn after verifying the publication workflow.");
    await p.getByRole("button", { name: "Withdraw pack", exact: true }).click();
    await p.getByText("Pack status: withdrawn.", { exact: true }).waitFor();
    assert.equal(
      (await p.request.get("http://localhost:8089" + asset.url)).status(),
      404,
    );
    await p.getByRole("button", { name: "Sign out", exact: true }).click();
    await p.getByRole("button", { name: "Connect", exact: true }).waitFor();
    assert.equal(
      await p
        .getByLabel("Administrator access key", { exact: true })
        .inputValue(),
      "",
    );
    assert.deepEqual(errors, []);
    await context.close();
    console.log(
      "Admin authentication, private uploads/previews, publication, audit, withdrawal and logout passed.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
