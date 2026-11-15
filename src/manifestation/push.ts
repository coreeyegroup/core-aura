import { manifestationStore as store } from "./store";
const key = "core-aura.push.v1";
type Settings = { token: string; enabled: boolean; cleanup?: boolean };
let message = "Closed-app reminders are off.",
  chain = Promise.resolve(),
  fingerprint = "";
const listeners = new Set<() => void>();
const report = (value: string) => {
  message = value;
  listeners.forEach((f) => f());
};
function settings(): Settings | undefined {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "null");
    return v && /^[a-f0-9]{64}$/.test(v.token) ? v : undefined;
  } catch {
    return;
  }
}
function save(v: Settings) {
  localStorage.setItem(key, JSON.stringify(v));
}
export const pushStatus = {
  snapshot: () => message,
  subscribe: (f: () => void) => {
    listeners.add(f);
    return () => {
      listeners.delete(f);
    };
  },
};
export const remoteRemindersEnabled = () => !!settings()?.enabled;
async function request(
  path: string,
  method = "GET",
  body?: unknown,
  token?: string,
) {
  const response = await fetch("/api/manifest-reminders/" + path, {
    method,
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { "X-Reminder-Token": token } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    let reason = "Reminder service is unavailable.";
    try {
      const data = await response.json();
      if (typeof data.detail === "string") reason = data.detail;
    } catch {}
    throw Error(reason);
  }
  return response.json();
}
function supported() {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    isSecureContext
  );
}
async function registration() {
  const r = await navigator.serviceWorker.getRegistration();
  if (!r?.active)
    throw Error("Finish updating the app, then try enabling reminders again.");
  return r;
}
function rows() {
  const { plans, reminders } = store.snapshot().data;
  return reminders
    .filter((r) => r.enabled)
    .flatMap((r) => {
      const p = plans.find((p) => p.id === r.planId);
      return p
        ? [{ id: r.id, planId: p.id, name: p.name, time: r.time, days: r.days }]
        : [];
    });
}
export async function enablePushReminders() {
  if (!supported())
    throw Error(
      "Closed-app reminders need a supported HTTPS browser. On iPhone, open the installed Home Screen app.",
    );
  // Permission is requested directly from the button gesture.
  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    throw Error(
      "Notification permission was not granted. You can still export a calendar reminder.",
    );
  const config = await request("config");
  if (!config.ready || !config.publicKey)
    throw Error(
      "The reminder server is not ready. Run the backend update before enabling reminders.",
    );
  const r = await registration();
  let s = settings();
  if (!s) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    s = {
      token: Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(""),
      enabled: false,
    };
    save(s);
  }
  let sub = await r.pushManager.getSubscription();
  if (!sub) {
    const str = atob(config.publicKey.replace(/-/g, "+").replace(/_/g, "/"));
    const applicationServerKey = Uint8Array.from(str, (c) => c.charCodeAt(0));
    sub = await r.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
  }
  const json = sub.toJSON();
  await request(
    "device",
    "PUT",
    {
      subscription: { endpoint: sub.endpoint, keys: json.keys },
      schedules: rows(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    s.token,
  );
  save({ ...s, enabled: true, cleanup: false });
  fingerprint = "";
  await syncPushReminders(true);
  return message;
}
export async function disablePushReminders() {
  const s = settings();
  if (!s) return "Closed-app reminders are off.";
  save({ ...s, enabled: false, cleanup: true });
  fingerprint = "";
  await syncPushReminders(true);
  try {
    if (supported())
      await (
        await (await registration()).pushManager.getSubscription()
      )?.unsubscribe();
  } catch {}
  if (!settings()?.cleanup)
    report("Closed-app reminders disabled on this device.");
  return message;
}
export function syncPushReminders(force = false): Promise<void> {
  const s = settings();
  if (!s) return Promise.resolve();
  const schedules = rows(),
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone,
    signature = JSON.stringify([s.enabled, s.cleanup, schedules, timezone]);
  if (!force && fingerprint === signature) return chain;
  fingerprint = signature;
  chain = chain
    .catch(() => {})
    .then(async () => {
      // Snapshot values are queued so a later disable always follows an in-flight update.
      if (s.cleanup) {
        await request("device", "DELETE", undefined, s.token);
        if (!settings()?.enabled)
          save({ ...s, enabled: false, cleanup: false });
        report("Closed-app reminders disabled on this device.");
        return;
      }
      if (!s.enabled) return;
      if (!supported() || Notification.permission !== "granted")
        throw Error(
          "Notification permission is unavailable. Enable reminders again or disable server reminders.",
        );
      const r = await registration(),
        sub = await r.pushManager.getSubscription();
      if (!sub)
        throw Error("Browser subscription expired. Enable reminders again.");
      const json = sub.toJSON();
      await request(
        "device",
        "PUT",
        {
          subscription: { endpoint: sub.endpoint, keys: json.keys },
          schedules,
          timezone,
        },
        s.token,
      );
      report(
        `Closed-app reminders enabled · ${schedules.length} active schedules. Internet and notification permission are required.`,
      );
    })
    .catch((e) => {
      fingerprint = "";
      report(
        (s.cleanup ? "Disable pending: " : "") +
          (e as Error).message +
          " Changes will retry when you reopen the app or reconnect.",
      );
    });
  return chain;
}
export function observePushReminders() {
  const sync = () => void syncPushReminders(true),
    visible = () => {
      if (!document.hidden) sync();
    };
  const unsubscribe = store.subscribe(() => void syncPushReminders());
  addEventListener("online", sync);
  document.addEventListener("visibilitychange", visible);
  sync();
  return () => {
    unsubscribe();
    removeEventListener("online", sync);
    document.removeEventListener("visibilitychange", visible);
  };
}
