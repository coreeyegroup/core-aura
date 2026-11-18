const assert = require("node:assert/strict");
const { chromium } = require("playwright");

function testAudio() {
  const rate = 8000;
  const samples = rate * 2;
  const data = Buffer.alloc(44 + samples * 2);
  data.write("RIFF");
  data.writeUInt32LE(data.length - 8, 4);
  data.write("WAVEfmt ", 8);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(1, 22);
  data.writeUInt32LE(rate, 24);
  data.writeUInt32LE(rate * 2, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write("data", 36);
  data.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) data.writeInt16LE(Math.round(Math.sin(i * Math.PI / 10) * 4000), 44 + i * 2);
  return data;
}

(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
    const queue = page.getByLabel("Playlist player", { exact: true });
    const button = name => page.getByRole("button", { name, exact: true });
    const navigate = name => page.locator(".bottom-nav").getByRole("button", { name, exact: true }).click();
    const label = name => page.getByLabel(name, { exact: true });
    await page.addInitScript(() => {
      window.mediaCommands = {};
      if (navigator.mediaSession) navigator.mediaSession.setActionHandler = (action, handler) => {
        window.mediaCommands[action] = handler;
      };
      if (localStorage.getItem("core-aura.sessions.v2")) return;
      const layer = { id: "tone", sound: "sine", hz: 432, volume: .2, muted: false, seconds: 60 };
      const mix = (id, name, date) => ({
        schemaVersion: 2, engineVersion: "2.0", id, name, kind: "studio", master: .5,
        createdAt: date, channels: [layer],
      });
      localStorage.setItem("core-aura.sessions.v2", JSON.stringify([
        mix("older", "Older mix", "2026-11-17T00:00:00Z"),
        mix("newer", "Newer mix", "2026-11-18T00:00:00Z"),
      ]));
      localStorage.setItem("core-aura.playlists.v1", JSON.stringify({
        schemaVersion: 1, playlists: [{ id: "older-queue", name: "Older routine", items: [{ kind: "session", id: "older" }] }],
      }));
      const practice = (id, name) => ({
        id, name, schemaVersion: 1, lines: [{ id: "line", text: "Stay present." }],
        order: "sequence", repeats: 1, gap: 1, readSeconds: 5, mode: "read",
        voice: "", rate: 1, volume: .7, seconds: 60, background: null,
      });
      localStorage.setItem("core-aura.manifestation.v1", JSON.stringify({
        schemaVersion: 1, draft: practice("old-practice", "Older practice"),
        plans: [practice("old-practice", "Older practice"), practice("new-practice", "Newer practice")],
        reminders: [],
      }));
    });

    await page.goto("http://localhost:8089/#library/audio");
    const mixes = page.locator(".saved-card h3");
    assert.deepEqual(await mixes.allTextContents(), ["Newer mix", "Older mix"]);
    await label("Select mix Older mix").check();
    await label("Search library").fill("Newer");
    assert.equal(await button("Delete selected mixes").isDisabled(), true);
    await label("Search library").fill("unmatched text");
    await page.getByText("No mixes match this search.").waitFor();
    assert.equal(await page.getByText("Older routine", { exact: true }).count(), 0);
    await label("Search library").clear();
    await label("Select mix Older mix").check();
    page.once("dialog", dialog => {
      assert.match(dialog.message(), /Older mix/);
      assert.match(dialog.message(), /Older routine/);
      return dialog.dismiss();
    });
    await button("Delete selected mixes").click();
    assert.equal(await mixes.count(), 2);
    await label("Import session file").setInputFiles({
      name: "too-large.json", mimeType: "application/json", buffer: Buffer.alloc(100001),
    });
    assert.equal(await label("Import session file").inputValue(), "");

    await button("Affirmations").click();
    await label("Select practice Older practice").check();
    await label("Search library").fill("Newer");
    assert.equal(await button("Delete selected practices").isDisabled(), true);
    await label("Search library").clear();

    await page.goto("http://localhost:8089/#explore/tracks");
    await button("Add audio").waitFor();
    assert.equal(await button("Explore").getAttribute("aria-pressed"), "false");
    await button("Explore").click();
    assert.match(page.url(), /#explore$/);
    await button("Tracks").click();
    await label("Import sound tracks").setInputFiles({
      name: "Imported bell.wav", mimeType: "audio/wav", buffer: testAudio(),
    });
    await page.getByText("1 track(s) added.").waitFor();

    await navigate("Chakras");
    await label("Select Root").check();
    await label("Select Sacral").check();
    await page.getByText("Sequential chakra playback", { exact: false }).first().click();
    await label("Sequence chakra duration").selectOption("1");
    await label("Sequence transition gap").selectOption("1");
    await button("Save").click();
    await label("Session name").fill("Saved chakra sequence");
    await label("Save as a sequence").check();
    await button("Save to Library").click();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("core-aura.sessions.v2")).find(row => row.name === "Saved chakra sequence"));
    assert.equal(saved.sequenceGap, 1);
    assert.deepEqual(saved.channels.map(channel => [channel.id, channel.seconds]), [["root", 1], ["sacral", 1]]);

    await navigate("Home");
    await button("Manage").click();
    assert.match(page.url(), /#library\/playlists$/);
    await button("New playlist").click();
    await label("Playlist name").fill("Audited audio flow");
    for (const name of ["Imported bell · Imported track", "Saved chakra sequence · Chakra"]) {
      await label("Playlist saved item").selectOption({ label: name });
      await button("Add item").click();
    }
    await button("Save playlist").click();
    await navigate("Home");
    await label("Home playlist").selectOption({ label: "Audited audio flow" });
    await button("Play selected playlist").click();
    await queue.getByText("Imported bell", { exact: true }).waitFor();
    await page.evaluate(() => window.mediaCommands.pause());
    await button("Resume playlist").waitFor();
    await page.evaluate(() => window.mediaCommands.play());
    await button("Pause playlist").waitFor();
    await page.evaluate(() => window.mediaCommands.nexttrack());
    await queue.getByText("Saved chakra sequence", { exact: true }).waitFor();
    await queue.waitFor({ state: "hidden", timeout: 10000 });

    await button("Settings").click();
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute("aria-label")), "Settings");
    await page.goto("http://localhost:8089/#unrecognized/route");
    await page.waitForURL(/#home$/);
    console.log("Library safety, source warnings, direct tracks, mixed queue, saved Chakra timing, media commands, focus and route recovery passed.");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
