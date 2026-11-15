import { Capacitor } from "@capacitor/core";
import {
  LocalNotifications,
  LocalNotificationSchema,
} from "@capacitor/local-notifications";
import { manifestationStore } from "./store";
import { occurrence, Reminder } from "./model";
const base = 310000;
export function notificationIds(r: Reminder) {
  return r.days.map((day) => base + r.slot * 7 + day);
}
export async function syncPhoneReminders(requestPermission = false) {
  if (!Capacitor.isNativePlatform())
    return "Web reminders work while the app is open. Export a calendar reminder for use outside the app.";
  const permission = requestPermission
    ? await LocalNotifications.requestPermissions()
    : await LocalNotifications.checkPermissions();
  const pending = await LocalNotifications.getPending();
  const own = pending.notifications.filter(
    (n) => n.id >= base && n.id < base + 56,
  );
  if (own.length)
    await LocalNotifications.cancel({
      notifications: own.map((n) => ({ id: n.id })),
    });
  if (permission.display !== "granted")
    return "Schedule saved. Enable phone reminders to receive native notifications.";
  const { plans, reminders } = manifestationStore.snapshot().data;
  const notifications: LocalNotificationSchema[] = [];
  for (const r of reminders.filter((r) => r.enabled)) {
    const p = plans.find((p) => p.id === r.planId);
    if (!p) continue;
    const [hour, minute] = r.time.split(":").map(Number);
    for (const day of r.days)
      notifications.push({
        id: base + r.slot * 7 + day,
        title: "Manifestation practice",
        body: p.name,
        schedule: {
          on: { weekday: (day + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7, hour, minute },
          repeats: true,
        },
        extra: { planId: p.id, scheduleId: r.id },
      });
  }
  if (notifications.length)
    await LocalNotifications.schedule({ notifications });
  return "Phone reminders scheduled. Delivery timing depends on device permissions and power settings; tap the notification to open your practice.";
}
export type Due = {
  id: string;
  planId: string;
  name: string;
  time: string;
  autoStart: boolean;
};
export function observeReminders(
  onDue: (due: Due) => void,
  onOpen: (id: string) => void,
) {
  let stopped = false,
    checking = false;
  const handles: { remove: () => Promise<void> }[] = [];
  const remembered = new Set<string>();
  async function tick() {
    if (checking || stopped) return;
    checking = true;
    const work = async () => {
      let delivered: Record<string, string> = {};
      try {
        delivered = JSON.parse(
          localStorage.getItem("core-aura.manifestation.delivered") || "{}",
        );
      } catch {}
      const { plans, reminders } = manifestationStore.snapshot().data;
      const now = new Date();
      for (const r of reminders) {
        const due = occurrence(r, now),
          p = plans.find((p) => p.id === r.planId);
        if (
          !due ||
          !p ||
          delivered[r.id] === due.key ||
          remembered.has(due.key)
        )
          continue;
        delivered[r.id] = due.key;
        remembered.add(due.key);
        try {
          localStorage.setItem(
            "core-aura.manifestation.delivered",
            JSON.stringify(delivered),
          );
        } catch {}
        if (stopped) return;
        onDue({
          id: due.key,
          planId: p.id,
          name: p.name,
          time: r.time,
          autoStart:
            Boolean(r.autoStart) && now.getTime() - due.due.getTime() < 60000,
        });
        if (
          !Capacitor.isNativePlatform() &&
          "Notification" in window &&
          Notification.permission === "granted" &&
          "serviceWorker" in navigator
        ) {
          try {
            const registration =
              await navigator.serviceWorker.getRegistration();
            if (registration?.active)
              await registration.showNotification("Manifestation practice", {
                body: p.name,
                tag: due.key,
                data: { planId: p.id },
                icon: "/icon-192.png",
              });
          } catch {}
        }
      }
    };
    try {
      if (navigator.locks)
        await navigator.locks.request(
          "core-aura-manifestation-reminders",
          work,
        );
      else await work();
    } finally {
      checking = false;
    }
  }
  const openFromWorker = (event: MessageEvent) => {
    if (
      event.data?.type === "OPEN_MANIFESTATION" &&
      typeof event.data.planId === "string"
    )
      onOpen(event.data.planId);
  };
  if ("serviceWorker" in navigator)
    navigator.serviceWorker.addEventListener("message", openFromWorker);
  const visibility = () => {
    if (document.visibilityState === "visible") void tick();
  };
  addEventListener("pageshow", visibility);
  document.addEventListener("visibilitychange", visibility);
  const timer = setInterval(() => void tick(), 15000);
  void tick();
  if (Capacitor.isNativePlatform())
    void LocalNotifications.addListener(
      "localNotificationActionPerformed",
      (event) => {
        if (typeof event.notification.extra?.planId === "string")
          onOpen(event.notification.extra.planId);
      },
    ).then((handle) => {
      if (stopped) void handle.remove();
      else handles.push(handle);
    });
  return () => {
    stopped = true;
    clearInterval(timer);
    removeEventListener("pageshow", visibility);
    document.removeEventListener("visibilitychange", visibility);
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.removeEventListener("message", openFromWorker);
    handles.forEach((h) => void h.remove());
  };
}
export async function enableReminders() {
  if (Capacitor.isNativePlatform()) return syncPhoneReminders(true);
  if (!("Notification" in window))
    return "This browser cannot show notifications. In-app reminders still work while open.";
  const permission = await Notification.requestPermission();
  return permission === "granted"
    ? "Notifications enabled while the web app is open. Closed-app delivery requires a calendar reminder or the native app."
    : "Permission was not granted. In-app reminders still work while open.";
}
export function calendarFile(r: Reminder, name: string, now = new Date()) {
  if (!r.days.length) throw Error("Choose at least one reminder day.");
  const [h, m] = r.time.split(":").map(Number);
  const start = new Date(now);
  start.setHours(h, m, 0, 0);
  if (start <= now) start.setDate(start.getDate() + 1);
  while (!r.days.includes(start.getDay())) start.setDate(start.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  const local = (d: Date) =>
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    "T" +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    "00";
  const escape = (s: string) =>
    s
      .replace(/\\/g, "\\\\")
      .replace(/\r\n|\r|\n/g, "\\n")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Core-aura//Manifestation//EN",
    "BEGIN:VEVENT",
    "UID:" + escape(r.id) + "@core-aura",
    "DTSTAMP:" +
      now
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}Z/, "Z"),
    "DTSTART:" + local(start),
    "DURATION:PT10M",
    "RRULE:FREQ=WEEKLY;BYDAY=" +
      r.days
        .map((d) => ["SU", "MO", "TU", "WE", "TH", "FR", "SA"][d])
        .join(","),
    "SUMMARY:" + escape(name),
    "DESCRIPTION:Open Core-aura and tap Play for your saved practice.",
    "URL:" +
      (typeof location === "undefined"
        ? "https://core-aura.coreeye.in"
        : location.origin) +
      "/?manifestPlan=" +
      encodeURIComponent(r.planId) +
      "#manifest",
    "BEGIN:VALARM",
    "TRIGGER:PT0M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Manifestation practice",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return (
    lines
      .map((line) => {
        let folded = "",
          column = 0;
        for (const character of line) {
          const size = new TextEncoder().encode(character).length;
          if (column + size > 74) {
            folded += "\r\n ";
            column = 1;
          }
          folded += character;
          column += size;
        }
        return folded;
      })
      .join("\r\n") + "\r\n"
  );
}
