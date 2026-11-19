const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    args: [
      "--no-sandbox",
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  });
  try {
    const ctx = await browser.newContext({
      viewport: { width: 360, height: 800 },
      isMobile: true,
      hasTouch: true,
      permissions: ["microphone"],
    });
    const p = await ctx.newPage(),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.addInitScript(() => {
      window.__spoken = [];
      window.__delay = 10000;
      let timer;
      class Speech extends EventTarget {
        getVoices() {
          return [];
        }
        cancel() {
          clearTimeout(timer);
        }
        speak(u) {
          window.__spoken.push(u.text);
          timer = setTimeout(() => u.onend?.(), window.__delay);
        }
      }
      Object.defineProperty(window, "speechSynthesis", {
        value: new Speech(),
        configurable: true,
      });
      window.SpeechSynthesisUtterance = class {
        constructor(t) {
          this.text = t;
        }
      };
    });
    await p.goto("http://localhost:8089/#manifest");
    await p
      .getByRole("button", { name: "Choose affirmations", exact: true })
      .click();
    for (const category of [
      "Health",
      "Wealth",
      "Success",
      "Confidence",
      "Relationships",
      "Calm",
      "Gratitude",
      "Purpose",
    ]) {
      await p.getByLabel("Category", { exact: true }).selectOption(category);
      assert.equal(
        await p.getByRole("button", { name: /^Play preview:/ }).count(),
        5,
      );
    }
    await p.getByLabel("Category", { exact: true }).selectOption("Health");
    const text = await p
      .locator(".affirmation-choice span")
      .first()
      .innerText();
    await p
      .getByRole("button", { name: "Play preview: " + text, exact: true })
      .click();
    await p
      .getByRole("button", { name: "Stop preview: " + text, exact: true })
      .click();
    assert.deepEqual(await p.evaluate(() => window.__spoken), [text]);
    await p
      .locator(".affirmation-choice")
      .first()
      .getByRole("checkbox")
      .check();
    await p
      .getByRole("button", { name: "Use selection (1)", exact: true })
      .click();
    await p
      .getByRole("button", { name: "Play preview: " + text, exact: true })
      .click();
    await p
      .getByRole("button", { name: "Stop preview: " + text, exact: true })
      .click();
    await p.getByLabel("Edit sentence 1", { exact: true }).click();
    await p.getByRole("button", { name: "Record voice", exact: true }).click();
    await p
      .getByRole("button", { name: "Start recording", exact: true })
      .click();
    await p
      .getByText("Recording… microphone is on.", { exact: true })
      .waitFor();
    await p.waitForTimeout(1800);
    await p
      .getByRole("button", { name: "Finish recording", exact: true })
      .click();
    await p
      .getByRole("button", { name: "Use recording", exact: true })
      .waitFor();
    await p.screenshot({ path: "mobile-verification/voice-recording-360.png" });
    await p.getByRole("button", { name: "Use recording", exact: true }).click();
    await p.getByText("Personal voice saved", { exact: true }).waitFor();
    const original = await p.evaluate(
      () =>
        JSON.parse(localStorage.getItem("core-aura.manifestation.v1")).draft,
    );
    assert.ok(original.useRecordings && original.lines[0].recordingId);
    await p
      .getByLabel("Practice name", { exact: true })
      .fill("My recorded practice");
    await p.getByLabel("Repetitions", { exact: true }).fill("1");
    await p.getByRole("button", { name: "Save practice", exact: true }).click();
    const before = await p.evaluate(() => window.__spoken.length);
    await p.getByRole("button", { name: "Play practice", exact: true }).click();
    await p.getByRole("button", { name: "Pause", exact: true }).click();
    await p.getByRole("button", { name: "Resume", exact: true }).click();
    await p.getByText("Practice complete", { exact: true }).waitFor();
    assert.equal(await p.evaluate(() => window.__spoken.length), before);
    await p.screenshot({ path: "mobile-verification/personal-voice-360.png" });
    await p.getByLabel("Sentence 1", { exact: true }).fill("Changed sentence");
    assert.equal(
      await p.evaluate(
        () =>
          JSON.parse(localStorage.getItem("core-aura.manifestation.v1")).draft
            .lines[0].recordingId,
      ),
      undefined,
    );
    await p
      .getByRole("button", { name: "Choose affirmations", exact: true })
      .click();
    await p.getByRole("button", { name: "Saved practices", exact: true }).click();
    const downloading = p.waitForEvent("download");
    await p
      .getByRole("button", { name: "Export practice", exact: true })
      .click();
    const dl = await downloading;
    const fs = require("node:fs");
    const backup = JSON.parse(fs.readFileSync(await dl.path(), "utf8"));
    assert.equal(backup.lines[0].recordingId, undefined);
    assert.equal(backup.useRecordings, false);
    await p.getByRole("button", { name: "Recordings", exact: true }).click();
    await p
      .getByRole("button", { name: "Play preview: " + text, exact: true })
      .last()
      .click();
    await p
      .getByRole("button", { name: "Stop preview: " + text, exact: true })
      .click();
    p.once("dialog", (d) => d.accept());
    await p
      .getByRole("button", { name: "Delete recording", exact: true })
      .click();
    await p.getByText("My voice recordings (0)", { exact: true }).waitFor();
    const stored = await p.evaluate(() =>
      JSON.parse(localStorage.getItem("core-aura.manifestation.v1")),
    );
    assert.equal(stored.plans[0].lines[0].recordingId, undefined);
    await p.getByRole("button", { name: "Browse", exact: true }).click();
    // A denied microphone leaves the sentence usable and surfaces the failure.
    await p
      .getByRole("button", { name: "Use selection (1)", exact: true })
      .click();
    await ctx.clearPermissions();
    await p.evaluate(() => {
      navigator.mediaDevices.getUserMedia = () =>
        Promise.reject(
          new DOMException("Microphone denied", "NotAllowedError"),
        );
    });
    await p.getByLabel("Edit sentence 1", { exact: true }).click();
    await p.getByRole("button", { name: "Record voice", exact: true }).click();
    await p
      .getByRole("button", { name: "Start recording", exact: true })
      .click();
    await p.getByText("Microphone denied", { exact: true }).waitFor();
    await p.getByRole("button", { name: "Cancel", exact: true }).click();
    assert.deepEqual(errors, []);
    await ctx.close();
    console.log(
      "Verified per-sentence previews, microphone capture, personal playback, edited-text detachment, export and deletion.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
