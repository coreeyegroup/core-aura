const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
(async () => {
  // Only creates a worker heartbeat in the test database. No external push is sent.
  execFileSync("python", ["tests/push-fixture.py"]);
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  try {
    const ctx = await browser.newContext({
      viewport: { width: 393, height: 852 },
      isMobile: true,
      hasTouch: true,
      permissions: ["notifications"],
      timezoneId: "Asia/Kolkata",
    });
    const p = await ctx.newPage(),
      sent = [];
    p.on("request", (r) => {
      if (r.url().endsWith("/api/manifest-reminders/device"))
        sent.push({ method: r.method(), body: r.postDataJSON() });
    });
    await p.addInitScript(() => {
      const publicKey =
        "BGsX0fLhLEJH-Lzm5WOkQPJ3A32BLeszoPShOUXYmMKWT-NC4v4af5uO5-tKfA-eFivOM1drMV7Oy7ZAaDe_UfU";
      let sub;
      const make = () => ({
        endpoint:
          "https://fcm.googleapis.com/fcm/send/browser-fixture-" +
          localStorage.getItem("test-device"),
        toJSON() {
          return {
            endpoint: this.endpoint,
            keys: { p256dh: publicKey, auth: "YWFhYWFhYWFhYWFhYWFhYQ" },
          };
        },
        async unsubscribe() {
          sub = undefined;
          localStorage.removeItem("test-subscribed");
          return true;
        },
      });
      if (!localStorage.getItem("test-device"))
        localStorage.setItem("test-device", crypto.randomUUID());
      if (localStorage.getItem("test-subscribed")) sub = make();
      PushManager.prototype.getSubscription = async () => sub || null;
      PushManager.prototype.subscribe = async () => {
        sub = make();
        localStorage.setItem("test-subscribed", "1");
        return sub;
      };
    });
    await p.goto("http://localhost:8089");
    await p.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await p
      .getByRole("button", { name: "Choose affirmations", exact: true })
      .click();
    await p
      .locator(".affirmation-choice")
      .first()
      .getByRole("checkbox")
      .check();
    await p
      .getByRole("button", { name: "Use selection (1)", exact: true })
      .click();
    await p
      .getByLabel("Practice name", { exact: true })
      .fill("Push test practice");
    await p.getByRole("button", { name: "Save practice", exact: true }).click();
    await p.getByRole("button", { name: "Schedule", exact: true }).click();
    await p.getByRole("button", { name: "Add schedule", exact: true }).click();
    await p
      .getByRole("button", { name: "Enable reminders", exact: true })
      .click();
    await p
      .getByText(/Closed-app reminders enabled · 1 active schedules/)
      .first()
      .waitFor().catch(async e=>{
        console.log('Reminder UI diagnostics:',await p.evaluate(()=>({text:document.body.innerText,permission:Notification.permission,settings:localStorage.getItem('core-aura.push.v1')?JSON.parse(localStorage.getItem('core-aura.push.v1')).enabled:null,subscription:localStorage.getItem('test-subscribed')})));
        await p.screenshot({path:'mobile-verification/push-error.png',fullPage:true});throw e;
      });
    let put = sent.filter((r) => r.method === "PUT").at(-1);
    assert.equal(put.body.timezone, "Asia/Kolkata");
    assert.equal(put.body.schedules.length, 1);
    assert.equal(put.body.schedules[0].name, "Push test practice");
    assert.ok(!JSON.stringify(put.body).includes("I care for"));
    // Disabled schedules are removed from the remote device registration.
    await p.getByRole("button", { name: "Disable", exact: true }).click();
    await p
      .getByText(/Closed-app reminders enabled · 0 active schedules/)
      .first()
      .waitFor();
    await p.screenshot({ path: "mobile-verification/push-schedule-393.png" });
    await p
      .getByRole("button", {
        name: "Disable closed-app reminders",
        exact: true,
      })
      .click();
    await p
      .getByText("Closed-app reminders disabled on this device.", {
        exact: true,
      })
      .first()
      .waitFor();
    assert.ok(sent.some((r) => r.method === "DELETE"));
    const count = sent.length;
    await p.reload();
    await p.waitForTimeout(400);
    assert.equal(sent.length, count);
    await ctx.close();
    console.log(
      "Verified opt-in push registration, minimal schedule payload, update reconciliation and unsubscribe with a mocked browser subscription.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
