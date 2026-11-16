const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
function wave() {
  const b = Buffer.alloc(44 + 22050 * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(b.length - 8, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(22050, 24);
  b.writeUInt32LE(44100, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(b.length - 44, 40);
  for (let i = 0; i < 22050; i++)
    b.writeInt16LE(
      Math.round(Math.sin((i / 22050) * 440 * Math.PI * 2) * 8000),
      44 + i * 2,
    );
  return b;
}
(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  try {
    const c = await browser.newContext({
        viewport: { width: 393, height: 852 },
        isMobile: true,
        hasTouch: true,
      }),
      p = await c.newPage(),
      errors = [],
      requests = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.addInitScript(() => {
      window.__audioStarts = 0;
      window.__deviceCalls = 0;
      const start = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function (...args) {
        window.__audioStarts++;
        return start.apply(this, args);
      };
      class Speech extends EventTarget {
        getVoices() {
          return [];
        }
        cancel() {}
        resume() {}
        speak() {
          window.__deviceCalls++;
          throw Error("Device speech unavailable for test.");
        }
      }
      Object.defineProperty(window, "speechSynthesis", {
        value: new Speech(),
        configurable: true,
      });
    });
    if (process.env.CORE_AURA_TEST_SYNTH_MOCK === "1") {
      await p.route("**/api/speech/voices", (r) =>
        r.fulfill({
          json: {
            ready: true,
            voices: [
              {
                voiceURI: "core:en-us",
                name: "Core-aura English (US) · Standard",
                lang: "en-US",
                localService: false,
              },
            ],
          },
        }),
      );
      await p.route("**/api/speech/speak", (r) =>
        r.fulfill({ contentType: "audio/wav", body: wave() }),
      );
    }
    p.on("request", (r) => {
      if (r.url().endsWith("/api/speech/speak"))
        requests.push(r.postDataJSON());
    });
    await p.goto("http://localhost:8089");
    await p
      .getByRole("button", { name: "Choose affirmations", exact: true })
      .click();
    await p
      .getByText("Manage categories & affirmations", { exact: true })
      .click();
    await p.getByRole("button", { name: "Add category", exact: true }).click();
    await p.getByLabel("Category name", { exact: true }).fill("Focused work");
    await p.getByRole("button", { name: "Save changes", exact: true }).click();
    await p
      .getByRole("button", { name: "Add affirmation", exact: true })
      .click();
    await p
      .getByLabel("Affirmation text", { exact: true })
      .fill("I focus on useful action.");
    await p.getByRole("button", { name: "Save changes", exact: true }).click();
    await p
      .getByRole("button", {
        name: "Edit affirmation: I focus on useful action.",
        exact: true,
      })
      .click();
    await p
      .getByLabel("Affirmation category", { exact: true })
      .selectOption("Health");
    await p
      .getByLabel("Affirmation text", { exact: true })
      .fill("I make clear progress.");
    await p.getByRole("button", { name: "Save changes", exact: true }).click();
    await p
      .getByLabel("Category", { exact: true })
      .selectOption("Focused work");
    await p
      .getByRole("button", { name: "Rename category", exact: true })
      .click();
    await p.getByLabel("Category name", { exact: true }).fill("Clear focus");
    await p.getByRole("button", { name: "Save changes", exact: true }).click();
    await p
      .getByRole("button", { name: "Delete category", exact: true })
      .click();
    await p
      .getByRole("button", { name: "Confirm delete", exact: true })
      .click();
    await p.getByLabel("Category", { exact: true }).selectOption("Health");
    const row = p
      .locator(".affirmation-row")
      .filter({ has: p.getByText("I make clear progress.", { exact: true }) });
    await row.getByRole("checkbox").check();
    await p.screenshot({
      path: "mobile-verification/editable-library-393.png",
    });
    await p
      .getByRole("button", { name: "Use selection (1)", exact: true })
      .click();
    await p.getByLabel("Repetitions", { exact: true }).fill("1");
    await p
      .getByLabel("Practice name", { exact: true })
      .fill("Core voice practice");
    await p
      .locator('select[aria-label="Voice"] option[value="core:en-us"]')
      .waitFor({ state: "attached" });
    await p.getByLabel("Voice", { exact: true }).selectOption("core:en-us");
    await p.getByRole("button", { name: "Play practice", exact: true }).click();
    await p.getByText("Practice complete", { exact: true }).waitFor();
    assert.ok(await p.evaluate(() => window.__audioStarts > 0));
    assert.equal(await p.evaluate(() => window.__deviceCalls), 0);
    assert.equal(requests.at(-1).text, "I make clear progress.");
    await p.screenshot({ path: "mobile-verification/core-voices-393.png" });
    await p.getByLabel("Voice", { exact: true }).selectOption("");
    await p
      .getByRole("button", { name: "Test selected voice", exact: true })
      .click();
    await p
      .getByText("Device speech unavailable for test.", { exact: true })
      .first()
      .waitFor();
    await p
      .getByRole("button", { name: "Choose affirmations", exact: true })
      .click();
    await p
      .getByText("Manage categories & affirmations", { exact: true })
      .click();
    await p.getByLabel("Category", { exact: true }).selectOption("Health");
    await p
      .getByRole("button", {
        name: "Delete affirmation: I make clear progress.",
        exact: true,
      })
      .click();
    await p
      .getByRole("button", { name: "Confirm delete", exact: true })
      .click();
    assert.equal(
      await p.getByText("I make clear progress.", { exact: true }).count(),
      0,
    );
    await p.reload();
    const state = await p.evaluate(() =>
      JSON.parse(localStorage.getItem("core-aura.affirmation-library.v1")),
    );
    assert.ok(!state.categories.includes("Clear focus"));
    assert.ok(
      !state.affirmations.some((a) => a.text === "I make clear progress."),
    );
    assert.deepEqual(errors, []);
    await c.close();
    console.log(
      "Verified category/affirmation CRUD, moving items, persistence, server audio playback and visible device speech errors.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
