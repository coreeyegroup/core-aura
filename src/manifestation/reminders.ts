import { Capacitor } from "@capacitor/core";
import {
  LocalNotifications,
  LocalNotificationSchema,
} from "@capacitor/local-notifications";
import { manifestationStore } from "./store";
import { dueOccurrences, nextOccurrence, Reminder } from "./model";
import { scheduleClock, scheduleFrequency, scheduleTimes, upcomingOccurrences } from "../scheduling/recurrence";
import {enablePushReminders,remoteRemindersEnabled,syncPushReminders} from "./push";
const base = 310000;
export function notificationIds(r: Reminder) {
  return r.days.map((day) => base + r.slot * 7 + day);
}
const expandedBase = 320000;
let reconciliation = Promise.resolve("");

export function syncPhoneReminders(requestPermission = false): Promise<string> {
  // Request permission from the gesture, then serialize reconciliation.
  const permission = Capacitor.isNativePlatform() && requestPermission
    ? LocalNotifications.requestPermissions() : undefined;
  reconciliation = reconciliation.catch(() => "").then(async () => {
    if (!Capacitor.isNativePlatform()) {
      await syncPushReminders(true);
      return remoteRemindersEnabled() ? "Schedules saved. See notification status." :
        "Schedules saved. Enable closed-app reminders or export to your calendar.";
    }
    const access = await (permission ?? LocalNotifications.checkPermissions());
    const { plans, reminders } = manifestationStore.snapshot().data;
    const now = new Date();
    const android = Capacitor.getPlatform?.() === "android";
    const notifications: LocalNotificationSchema[] = [];
    let finiteMonthly = false;
    if (access.display === "granted") {
      for (const rule of reminders.filter(item => item.enabled)) {
        const plan = plans.find(item => item.id === rule.planId);
        if (!plan) continue;
        const frequency = scheduleFrequency(rule);
        const add = (id: number, schedule: NonNullable<LocalNotificationSchema["schedule"]>) => notifications.push({
          id, title: "Manifestation practice", body: plan.name, schedule,
          extra: { planId: plan.id, scheduleId: rule.id },
        });
        if (rule.oneOff) {
          const at = nextOccurrence(rule, now);
          if (at) add(base + rule.slot * 7, { at, allowWhileIdle: true });
        } else if (frequency === "monthly" && android && rule.monthDay! > 28) {
          // Android Calendar can roll an absent day into the following month.
          finiteMonthly = true;
          for (const [index, at] of upcomingOccurrences(rule, now, scheduleTimes(rule).length * 3).entries())
            add(expandedBase + rule.slot * 100 + 70 + index, { at, allowWhileIdle: true });
        } else {
          for (const [index, time] of scheduleTimes(rule).entries()) {
            const [hour, minute] = time.split(":").map(Number);
            if (rule.frequency === undefined || frequency === "weekly") {
              for (const day of rule.days) {
                const id = index === 0 ? base + rule.slot * 7 + day : expandedBase + rule.slot * 100 + index * 7 + day;
                add(id, { on: { weekday: (day + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7, hour, minute, second: 0 }, repeats: true });
              }
            } else {
              add(expandedBase + rule.slot * 100 + index, {
                on: { hour, minute, second: 0, ...(frequency === "monthly" ? { day: rule.monthDay } : {}) },
                repeats: true,
              });
            }
          }
        }
      }
    }
    const pending = await LocalNotifications.getPending();
    const own = pending.notifications.filter(({ id }) => id >= base && id < base + 56 ||
      id >= expandedBase && id < expandedBase + 800);
    if (Capacitor.getPlatform?.() === "ios" && notifications.length + pending.notifications.length - own.length > 64)
      throw Error("Schedules saved, but they exceed this iPhone’s notification limit. Disable a schedule or remove times, then enable reminders again.");
    if (own.length)
      await LocalNotifications.cancel({ notifications: own.map(({ id }) => ({ id })) });
    if (access.display !== "granted")
      return "Schedules saved. Enable phone reminders to receive notifications.";
    if (notifications.length) await LocalNotifications.schedule({ notifications });
    return finiteMonthly ? "Phone reminders scheduled. For days 29–31, Android queues the next three eligible months. Reopen Core-aura to refresh them." :
      "Phone reminders scheduled. Delivery timing depends on your device settings.";
  });
  return reconciliation;
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
      const scheduleIds = new Set(reminders.map(rule => rule.id));
      delivered = Object.fromEntries(Object.entries(delivered).filter(([key]) => scheduleIds.has(key.split("|")[0])));
      for (const r of reminders) for (const due of dueOccurrences(r, now)) {
        const p = plans.find(plan => plan.id === r.planId);
        const slot = r.id + "|" + scheduleClock(due.due);
        if (
          !due ||
          !p ||
          (delivered[slot] === due.key || delivered[r.id] === due.key) ||
          remembered.has(due.key)
        )
          continue;
        delivered[slot] = due.key;
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
          time: scheduleClock(due.due),
          autoStart:
            Boolean(r.autoStart) && now.getTime() - due.due.getTime() < 60000,
        });
        if (
          !Capacitor.isNativePlatform() &&
          !remoteRemindersEnabled() &&
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
    if (document.visibilityState !== "visible") return;
    void tick();
    if (Capacitor.getPlatform?.() === "android" && manifestationStore.snapshot().data.reminders.some(rule =>
      rule.enabled && rule.frequency === "monthly" && rule.monthDay! > 28)) void syncPhoneReminders().catch(() => {});

  };
  addEventListener("pageshow", visibility);
  document.addEventListener("visibilitychange", visibility);
  const timer = setInterval(() => void tick(), 15000);
  visibility();
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
  return enablePushReminders();
}
export function calendarFile(r: Reminder, name: string, now = new Date()) {
  const frequency = scheduleFrequency(r);
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
  const utc = (value: Date) => value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const rule = r.frequency === "daily" ? "FREQ=DAILY" : frequency === "monthly" ? "FREQ=MONTHLY;BYMONTHDAY=" + r.monthDay :
    "FREQ=WEEKLY;BYDAY=" + r.days.map(day => ["SU", "MO", "TU", "WE", "TH", "FR", "SA"][day]).join(",");
  const events = (r.oneOff ? [r.time] : scheduleTimes(r)).flatMap((time, index) => {
    const start = r.oneOff ? new Date(r.oneOff) : nextOccurrence({ ...r, enabled: true, time, times: [time] }, now);
    if (!start) return [];
    const exceptions = [...(r.skipDates ?? []).map(date => date + "T" + time),
      ...(r.skipOccurrences ?? []).filter(value => value.endsWith("T" + time))];
    return [
      "BEGIN:VEVENT",
      "UID:" + escape(r.id) + (index ? "-" + time.replace(":", "") : "") + "@core-aura",
      "DTSTAMP:" + utc(now),
      "DTSTART:" + (r.oneOff ? utc(start) : local(start)),
      "DURATION:PT10M",
      ...(r.oneOff ? [] : ["RRULE:" + rule]),
      ...(!r.oneOff && exceptions.length ? ["EXDATE:" + [...new Set(exceptions)].map(value => value.replace(/[-:]/g, "") + "00").join(",")] : []),
      "SUMMARY:" + escape(name),
      "DESCRIPTION:Open Core-aura and tap Play for your saved practice.",
      "URL:" + (typeof location === "undefined" ? "https://core-aura.coreeye.in" : location.origin) +
        "/?manifestPlan=" + encodeURIComponent(r.planId) + "#manifest",
      "BEGIN:VALARM",
      "TRIGGER:PT0M",
      "ACTION:DISPLAY",
      "DESCRIPTION:Manifestation practice",
      "END:VALARM",
      "END:VEVENT",
    ];
  });
  if (!events.length) throw Error("This schedule has no upcoming dates.");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Core-aura//Manifestation//EN", ...events, "END:VCALENDAR"];
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

export async function testNotification(){
 if(Capacitor.isNativePlatform()){const permission=await LocalNotifications.requestPermissions();if(permission.display!=="granted")throw Error("Notification permission was not granted.");await LocalNotifications.schedule({notifications:[{id:319999,title:"Core-aura notification test",body:"Notifications are available on this device.",schedule:{at:new Date(Date.now()+1500)}}]});return "Test notification scheduled.";}
 if(!("Notification" in window)||!isSecureContext)throw Error("Notifications need a supported HTTPS browser.");
 if(await Notification.requestPermission()!=="granted")throw Error("Notification permission was not granted.");
 const registration=await navigator.serviceWorker.ready;await registration.showNotification("Core-aura notification test",{body:"Notifications are available on this device.",icon:"/icon-192.png"});return "Test notification sent.";
}
