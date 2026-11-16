const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  fs = require("node:fs");
function wav() {
  const b = Buffer.alloc(44 + 32000 * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(b.length - 8, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(32000, 24);
  b.writeUInt32LE(64000, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(b.length - 44, 40);
  for (let i = 0; i < 32000; i++)
    b.writeInt16LE(
      Math.round(Math.sin((2 * Math.PI * 220 * i) / 32000) * 10000),
      44 + i * 2,
    );
  return b;
}
(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  try {
    const c = await browser.newContext({
        viewport: { width: 360, height: 800 },
        isMobile: true,
        hasTouch: true,
      }),
      p = await c.newPage(),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto("http://localhost:8089/#manifest");
    await p.locator(".custom-sentence > summary").click();
    await p
      .getByLabel("Your own sentence", { exact: true })
      .fill("I make steady progress.");
    await p.getByRole("button", { name: "Add sentence", exact: true }).click();
    await p.getByLabel("Edit sentence 1", { exact: true }).click();
    await p.getByRole("button", { name: "Record voice", exact: true }).click();
    const input = p.getByLabel("Import sentence WAV", { exact: true });
    await input.setInputFiles({
      name: "broken.wav",
      mimeType: "audio/wav",
      buffer: Buffer.from("broken"),
    });
    await p
      .getByText("Choose a PCM WAV file under 5 MB, up to 60 seconds.", {
        exact: true,
      })
      .waitFor();
    await input.setInputFiles({
      name: "voice.wav",
      mimeType: "audio/wav",
      buffer: wav(),
    });
    await p
      .getByRole("button", { name: "Use recording", exact: true })
      .waitFor();
    assert.equal(
      await p.evaluate(
        () =>
          JSON.parse(localStorage.getItem("core-aura.manifestation.v1")).draft
            .lines[0].recordingId,
      ),
      undefined,
    );
    await p.screenshot({ path: "mobile-verification/voice-import-360.png" });
    await p.getByRole("button", { name: "Use recording", exact: true }).click();
    await p
      .getByRole("dialog", { name: "Record your sentence", exact: true })
      .waitFor({ state: "hidden" });
    const original = await p.evaluate(
      () =>
        JSON.parse(localStorage.getItem("core-aura.manifestation.v1")).draft
          .lines[0].recordingId,
    );
    assert.ok(original);
    await p.getByRole("button", { name: "Record again", exact: true }).click();
    await p
      .getByLabel("Saved voice for these words", { exact: true })
      .selectOption(original);
    await p.getByRole("button", { name: "Use recording", exact: true }).click();
    await p
      .getByRole("dialog", { name: "Record your sentence", exact: true })
      .waitFor({ state: "hidden" });
    assert.equal(
      await p.evaluate(
        () =>
          JSON.parse(localStorage.getItem("core-aura.manifestation.v1")).draft
            .lines[0].recordingId,
      ),
      original,
    );
    await p
      .getByLabel("Practice name", { exact: true })
      .fill("Voice import practice");
    await p.getByLabel("Repetitions", { exact: true }).fill("1");
    await p.getByRole("button", { name: "Save practice", exact: true }).click();
    await p
      .getByRole("button", { name: "Choose affirmations", exact: true })
      .click();
    await p
      .getByRole("button", {
        name: "Play practice: Voice import practice",
        exact: true,
      })
      .click();
    await p
      .getByRole("button", {
        name: "Pause practice: Voice import practice",
        exact: true,
      })
      .click();
    await p
      .getByRole("button", {
        name: "Resume practice: Voice import practice",
        exact: true,
      })
      .click();
    await p
      .getByRole("button", {
        name: "Play practice: Voice import practice",
        exact: true,
      })
      .waitFor();
    await p.getByText("My voice recordings (1)", { exact: true }).click();
    const downloading = p.waitForEvent("download");
    await p.getByRole("button", { name: "Download WAV", exact: true }).click();
    const file = await downloading,
      bytes = fs.readFileSync(await file.path());
    assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
    assert.equal(bytes.readUInt32LE(24), 32000);
    assert.ok(Math.abs((bytes.length - 44) / 64000 - 1) < 0.02);
    await p.evaluate(() => navigator.serviceWorker.ready);
    await p.reload();
    await p.waitForFunction(() => !!navigator.serviceWorker.controller);
    await c.setOffline(true);
    await p
      .getByRole("button", { name: "Use selection (1)", exact: true })
      .click();
    await p.getByRole("button", { name: "Record again", exact: true }).click();
    await p.getByLabel("Import sentence WAV", { exact: true }).setInputFiles({
      name: "restored.wav",
      mimeType: "audio/wav",
      buffer: bytes,
    });
    await p.getByRole("button", { name: "Use recording", exact: true }).click();
    await p
      .getByRole("dialog", { name: "Record your sentence", exact: true })
      .waitFor({ state: "hidden" });
    await p.getByRole("button", { name: "Play practice", exact: true }).click();
    await p.getByText("Practice complete", { exact: true }).waitFor();

    p.once("dialog", (d) => d.accept());
    await p.getByRole("button", { name: "New practice", exact: true }).click();
    await p
      .getByRole("button", { name: "Choose affirmations", exact: true })
      .click();
    await p.getByText("My voice recordings (2)", { exact: true }).click();
    await p
      .getByRole("button", { name: "Use in practice", exact: true })
      .first()
      .click();
    assert.ok(
      await p.evaluate(
        () =>
          JSON.parse(localStorage.getItem("core-aura.manifestation.v1")).draft
            .lines[0].recordingId,
      ),
    );
    assert.deepEqual(errors, []);
    await c.close();
    console.log(
      "Verified voice WAV import, saved-clip reuse, direct practice transport, portable export and offline reimport/playback.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
