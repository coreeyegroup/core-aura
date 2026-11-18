const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
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
    try {
      await p.addInitScript(() => {
        window.__voiceStops = 0;
        window.SpeechSynthesisUtterance = class {
          constructor(text) {
            this.text = text;
          }
        };
        Object.defineProperty(window, "speechSynthesis", {
          configurable: true,
          value: new (class extends EventTarget {
            getVoices() {
              return [
                {
                  name: "Flow test voice",
                  lang: "en-US",
                  voiceURI: "flow-en",
                  localService: true,
                  default: true,
                },
              ];
            }
            speak(utterance) {
              utterance.onstart?.();
            }
            cancel() {
              window.__voiceStops++;
            }
          })(),
        });
        if (localStorage.getItem("core-aura.manifestation.v1")) return;
        const base = {
          schemaVersion: 1,
          id: "first",
          name: "First practice",
          lines: [{ id: "line-one", text: "I take a clear step." }],
          order: "sequence",
          repeats: 3,
          gap: 2,
          readSeconds: 5,
          mode: "read",
          voice: "",
          rate: 0.9,
          volume: 0.7,
          seconds: 600,
          background: null,
        };
        const second = {
          ...base,
          id: "second",
          name: "Second practice",
          lines: [{ id: "line-two", text: "I keep learning." }],
        };
        localStorage.setItem(
          "core-aura.manifestation.v1",
          JSON.stringify({
            schemaVersion: 1,
            draft: base,
            plans: [base, second],
            reminders: [],
          }),
        );
      });
      const tools=async()=>{if(await p.locator('.home-secondary:not([open])').count())await p.locator('.home-secondary > summary').click();};
      const nav=async(name)=>{await p.locator('.bottom-nav').getByRole('button',{name,exact:true}).click();if(name==='Home')await tools();};
      await p.goto("http://localhost:8089");await tools();
      await p
        .locator(".tool-grid")
        .getByRole("button", { name: "Schedule", exact: true })
        .click();
      assert.ok(p.url().endsWith("#manifest/schedule"));
      await p.reload();
      await p.getByLabel("Reminder time", { exact: true }).waitFor();
      await p.goBack();
      await p.getByRole("heading", { name: "Overview", exact: true }).waitFor();await tools();
      await p
        .locator(".intention-grid")
        .getByRole("button", { name: /Wealth/ })
        .click();
      assert.equal(
        await p.getByLabel("Category", { exact: true }).inputValue(),
        "Wealth",
      );
      await p
        .getByRole("button", { name: "Use selection (1)", exact: true })
        .click();
      await p.goBack();
      assert.equal(
        await p.getByLabel("Category", { exact: true }).inputValue(),
        "Wealth",
      );
      await p.goForward();
      await p.getByLabel("Practice name", { exact: true }).waitFor();
      await p.locator(".custom-sentence > summary").click();
      await p
        .getByLabel("Your own sentence", { exact: true })
        .fill("Unfinished words stay with me.");
      await nav("Home");
      await nav("Manifest");
      await p.locator(".custom-sentence > summary").click();
      assert.equal(
        await p.getByLabel("Your own sentence", { exact: true }).inputValue(),
        "Unfinished words stay with me.",
      );
      await p
        .getByLabel("Practice name", { exact: true })
        .fill("Unsaved draft");
      await nav("Home");
      p.once("dialog", (d) => d.dismiss());
      await p
        .locator(".ticker-open")
        .filter({ hasText: "Second practice" })
        .click();
      assert.ok(p.url().endsWith("#home"));
      assert.equal(
        await p.evaluate(
          () =>
            JSON.parse(localStorage.getItem("core-aura.manifestation.v1")).draft
              .name,
        ),
        "Unsaved draft",
      );
      p.once("dialog", (d) => d.accept());
      await p
        .locator(".ticker-open")
        .filter({ hasText: "Second practice" })
        .click();
      assert.equal(
        await p.getByLabel("Practice name", { exact: true }).inputValue(),
        "Second practice",
      );
      await p
        .getByLabel("Practice name", { exact: true })
        .fill("Second updated");
      await p
        .getByRole("button", { name: "Save practice", exact: true })
        .click();
      await p
        .getByRole("button", { name: "Schedule practice", exact: true })
        .click();
      assert.equal(
        await p.getByLabel("Saved practice", { exact: true }).inputValue(),
        "second",
      );
      await nav("Home");
      await p.getByRole("button", { name: "View all", exact: true }).click();
      await p.locator(".saved-practices-section").waitFor();
      assert.ok(p.url().includes("#library/practices"));
      assert.equal(
        await p.evaluate(() =>
          document.activeElement?.getAttribute("aria-label"),
        ),
        "Saved practices",
      );
      await p.reload();
      await p
        .getByRole("heading", { name: "Second updated", exact: true })
        .waitFor();
      await nav("Home");
      await p
        .locator(".tone-grid")
        .getByRole("button", { name: /528/ })
        .click();
      await p.getByLabel("Frequency (Hz)", { exact: true }).fill("321");
      await p.getByRole("button", { name: "Play", exact: true }).last().click();
      await p
        .getByRole("button", { name: "Pause", exact: true })
        .last()
        .click();
      await nav("Home");
      await p
        .getByRole("button", { name: "Resume audio", exact: true })
        .click();
      await p
        .getByRole("button", { name: "Pause audio", exact: true })
        .waitFor();
      await p.locator(".playback-location").click();
      await p
        .getByRole("heading", { name: "Sound Studio", exact: true })
        .waitFor();
      await p.getByRole("button", { name: "Stop", exact: true }).last().click();
      await nav("Home");
      await p.evaluate(() => {
        const workspace = JSON.parse(
          localStorage.getItem("core-aura.workspace.v1"),
        );
        workspace.seconds = 123;
        localStorage.setItem(
          "core-aura.workspace.v1",
          JSON.stringify(workspace),
        );
      });
      await p.reload();
      await nav("Sounds");
      assert.equal(
        await p.getByLabel("Frequency (Hz)", { exact: true }).inputValue(),
        "321",
      );
      assert.equal(
        await p.getByLabel("Session duration", { exact: true }).inputValue(),
        "123",
      );
      await nav("Manifest");
      await p.getByRole("button", { name: "Practice", exact: true }).click();
      await p
        .getByLabel("Practice mode", { exact: true })
        .selectOption("speech");
      await p.locator(".sentence-queue-head .preview-button").click();
      await nav("Home");
      assert.ok((await p.getByLabel('Home practice',{exact:true}).textContent()).includes('Second updated'));
      await nav("Manifest");
      await p
        .getByRole("button", { name: "Play practice", exact: true })
        .click();
      await nav("Library");
      const stopsBeforeInvalid = await p.evaluate(() => window.__voiceStops);
      await p
        .getByLabel("Import manifestation practice", { exact: true })
        .setInputFiles({
          name: "broken.json",
          mimeType: "application/json",
          buffer: Buffer.from('{"schemaVersion":1}'),
        });
      await p
        .getByText(
          "This manifestation practice has invalid or unsupported settings.",
          { exact: true },
        )
        .waitFor();
      assert.equal(
        await p.evaluate(() => window.__voiceStops),
        stopsBeforeInvalid,
      );
      await nav("Sounds");
      assert.equal(await p.locator(".player-dock").count(), 1);
      assert.equal(await p.locator(".mini-player").count(), 0);
      await p
        .locator(".playback-banner")
        .getByRole("button", { name: "Pause practice", exact: true })
        .waitFor();
      await p.getByRole("button", { name: "Settings", exact: true }).click();
      await p
        .getByRole("button", { name: "Check for updates", exact: true })
        .click();
      await p
        .getByText("Stop all audio before updating.", { exact: true })
        .waitFor();
      const stops = await p.evaluate(() => window.__voiceStops);
      await p
        .getByRole("button", { name: "Stop all audio", exact: true })
        .click();
      await p
        .getByRole("button", { name: "Close settings", exact: true })
        .click();
      assert.equal(await p.locator(".playback-banner").count(), 0);
      assert.ok((await p.evaluate(() => window.__voiceStops)) > stops);
      await nav("Home");
      await p
        .locator(".tool-grid")
        .getByRole("button", { name: "Sound packs", exact: true })
        .click();
      await p.reload();
      await p
        .getByRole("heading", { name: "Sound packs", exact: true })
        .waitFor();
      await p.getByRole("button", { name: "Settings", exact: true }).click();
      await p.route("**/api/health", (r) =>
        r.fulfill({ status: 503, body: "Unavailable" }),
      );
      await p.route("**/api/speech/voices", (r) =>
        r.fulfill({ json: { ready: false, voices: [] } }),
      );
      await p.route("**/api/manifest-reminders/config", (r) =>
        r.fulfill({ json: { ready: false } }),
      );
      await p.locator(".connection-panel > summary").click();
      await p.waitForFunction(() =>
        document
          .querySelector(".service-status")
          ?.textContent.includes("Unavailable — try a device voice"),
      );
      await p.screenshot({
        path: "mobile-verification/continuity-connections-393.png",
      });
      await p
        .getByRole("button", { name: "Close settings", exact: true })
        .click();
      await nav("Manifest");
      await p.getByRole("button", { name: "Practice", exact: true }).click();
      await p.locator(".custom-sentence > summary").click();
      assert.equal(
        await p.getByLabel("Your own sentence", { exact: true }).inputValue(),
        "Unfinished words stay with me.",
      );
      await p.evaluate(() => {
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
          if (key === "core-aura.manifestation.v1")
            throw new DOMException("Storage full", "QuotaExceededError");
          return original.call(this, key, value);
        };
      });
      await p
        .getByRole("button", { name: "Add sentence", exact: true })
        .click();
      assert.equal(
        await p.getByLabel("Your own sentence", { exact: true }).inputValue(),
        "Unfinished words stay with me.",
      );
      await p.screenshot({
        path: "mobile-verification/continuity-manifest-393.png",
      });
      await nav("Library");
      const importFile = {
        name: "practice.json",
        mimeType: "application/json",
        buffer: Buffer.from(
          await p.evaluate(() =>
            JSON.stringify(
              JSON.parse(localStorage.getItem("core-aura.manifestation.v1"))
                .plans[0],
            ),
          ),
        ),
      };
      for (let attempt = 0; attempt < 2; attempt++) {
        p.once("dialog", (dialog) => dialog.dismiss());
        await p
          .getByLabel("Import manifestation practice", { exact: true })
          .setInputFiles(importFile);
        await p.waitForFunction(
          () =>
            document.querySelector(
              'input[aria-label="Import manifestation practice"]',
            ).value === "",
        );
      }
      assert.deepEqual(errors, []);
      await c.close();
      console.log(
        "Back/Forward, nested reloads, category context, composer preservation, draft protection, save-to-schedule, saved destination, paused audio, workspace restore, single playback dock and service diagnostics passed.",
      );
    } catch (error) {
      console.log(
        "Continuity diagnostics:",
        await p.evaluate(() => ({
          url: location.href,
          view: document
            .querySelector(".manifest-workspace")
            ?.getAttribute("data-view"),
          text: document.body.innerText.slice(0, 3000),
        })),
      );
      await p.screenshot({
        path: "mobile-verification/continuity-error.png",
        fullPage: true,
      });
      throw error;
    }
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
