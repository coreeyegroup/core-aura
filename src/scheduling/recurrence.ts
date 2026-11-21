export type Frequency = "daily" | "weekly" | "monthly";
export type ScheduleTiming = {
  time: string;
  days: number[];
  enabled: boolean;
  frequency?: Frequency;
  times?: string[];
  monthDay?: number;
  oneOff?: string;
  skipDates?: string[];
  skipOccurrences?: string[];
};

export const maxScheduleTimes = 8;
export const scheduleTimePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export function scheduleTimes(rule: ScheduleTiming): readonly string[] {
  return rule.times ?? [rule.time];
}

export function scheduleFrequency(rule: ScheduleTiming): Frequency | "once" {
  return rule.oneOff ? "once" : rule.frequency ?? (rule.days.length === 7 ? "daily" : "weekly");
}

const pad = (value: number) => String(value).padStart(2, "0");
export const scheduleDate = (date: Date) =>
  date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
export const scheduleClock = (date: Date) => pad(date.getHours()) + ":" + pad(date.getMinutes());

function matchesDate(rule: ScheduleTiming, date: Date) {
  const frequency = scheduleFrequency(rule);
  if (frequency === "monthly") return date.getDate() === rule.monthDay;
  return frequency === "daily" || rule.days.includes(date.getDay());
}

function timesOnDate(rule: ScheduleTiming, date: Date): Date[] {
  const day = scheduleDate(date);
  if (!matchesDate(rule, date) || rule.skipDates?.includes(day)) return [];
  return scheduleTimes(rule).flatMap(time => {
    if (rule.skipOccurrences?.includes(day + "T" + time)) return [];
    const [hours, minutes] = time.split(":").map(Number);
    const due = new Date(date);
    due.setHours(hours, minutes, 0, 0);
    // A missing wall-clock time during a DST jump is skipped.
    return scheduleClock(due) === time ? [due] : [];
  });
}

export function upcomingOccurrences(rule: ScheduleTiming, after: Date, limit = 1): Date[] {
  if (!rule.enabled) return [];
  if (rule.oneOff) {
    const due = new Date(rule.oneOff);
    return due > after ? [due] : [];
  }
  const result: Date[] = [];
  const date = new Date(after);
  date.setHours(12, 0, 0, 0);
  // At most 30 skipped dates and 30 skipped times are stored. A day near month-end may also be absent.
  const horizon = scheduleFrequency(rule) === "monthly" ? (61 * (61 + limit)) : 7 * (61 + limit);
  for (let offset = 0; offset < horizon && result.length < limit; offset++) {
    for (const due of timesOnDate(rule, date)) {
      if (due > after) result.push(due);
      if (result.length === limit) break;
    }
    date.setDate(date.getDate() + 1);
  }
  return result;
}

export function recentOccurrences(rule: ScheduleTiming, now: Date): Date[] {
  if (!rule.enabled) return [];
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const candidates = rule.oneOff ? [new Date(rule.oneOff)] :
    [...timesOnDate(rule, yesterday), ...timesOnDate(rule, now)];
  return candidates.filter(due => +due <= +now && +now - +due < 900_000);
}

export function chakraScheduleId(kind: "session" | "playlist", id: string) {
  return "chakra-" + kind + "-" + id;
}

export function chakraScheduleTarget(id: unknown) {
  if (typeof id !== "string") return undefined;
  const match = /^chakra-(session|playlist)-([a-z0-9-]{1,84})$/i.exec(id);
  return match ? { kind: match[1] as "session" | "playlist", id: match[2] } : undefined;
}
