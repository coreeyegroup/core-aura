import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  permission: "granted",
  platform: "ios",
  cancel: vi.fn(async () => {}),
  schedule: vi.fn(async () => {}),
  request: vi.fn(async () => ({ display: "granted" })),
  rows: [] as any[],
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true, getPlatform: () => mocks.platform },
}));
vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: {
    checkPermissions: async () => ({ display: mocks.permission }),
    requestPermissions: mocks.request,
    getPending: async () => ({ notifications: [{ id: 310001 }, { id: 999 }] }),
    cancel: mocks.cancel,
    schedule: mocks.schedule,
  },
}));
vi.mock("../src/manifestation/store", () => ({
  manifestationStore: {
    snapshot: () => ({
      data: { plans: [{ id: "plan", name: "Morning" }], reminders: mocks.rows },
    }),
  },
}));
import { syncPhoneReminders } from "../src/manifestation/reminders";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.permission = "granted";
  mocks.platform = "ios";
  mocks.rows = [];
});
describe("native reminder reconciliation", () => {
  it("cancels deleted feature reminders even if display permission has been denied", async () => {
    mocks.permission = "denied";
    await syncPhoneReminders();
    expect(mocks.cancel).toHaveBeenCalledWith({
      notifications: [{ id: 310001 }],
    });
    expect(mocks.schedule).not.toHaveBeenCalled();
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it("schedules each daily time as its own native rule", async () => {
    mocks.rows = [{ id: "daily", slot: 0, planId: "plan", time: "07:00", days: [1],
      frequency: "daily", times: ["07:00", "20:15"], enabled: true }];
    await syncPhoneReminders();
    const rows = mocks.schedule.mock.calls[0][0].notifications;
    expect(new Set(rows.map((row: any) => row.id)).size).toBe(2);
    expect(rows.map((row: any) => row.schedule.on)).toEqual([
      { hour: 7, minute: 0, second: 0 }, { hour: 20, minute: 15, second: 0 },
    ]);
  });
  it("queues valid monthly dates on Android when the day can be missing", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2027, 0, 31, 8));
      mocks.platform = "android";
      mocks.rows = [{ id: "month-end", slot: 0, planId: "plan", time: "07:00",
        days: [1], frequency: "monthly", monthDay: 31, enabled: true }];
      await syncPhoneReminders();
      const rows = mocks.schedule.mock.calls[0][0].notifications;
      expect(rows.map((row: any) => row.schedule.at)).toEqual([
        new Date(2027, 2, 31, 7), new Date(2027, 4, 31, 7), new Date(2027, 6, 31, 7),
      ]);
    } finally { vi.useRealTimers(); }
  });
  it("schedules weekly device reminders with unique IDs without requesting permission implicitly", async () => {
    mocks.rows = [
      {
        id: "schedule",
        slot: 0,
        planId: "plan",
        time: "07:30",
        days: [1, 3],
        enabled: true,
      },
    ];
    await syncPhoneReminders();
    const rows = mocks.schedule.mock.calls[0][0].notifications;
    expect(rows.map((r: any) => r.id)).toEqual([310001, 310003]);
    expect(rows.map((r: any) => r.schedule.on.weekday)).toEqual([2, 4]);
    expect(rows[0].extra.planId).toBe("plan");
    expect(mocks.request).not.toHaveBeenCalled();
  });
});
