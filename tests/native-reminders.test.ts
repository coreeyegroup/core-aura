import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  permission: "granted",
  cancel: vi.fn(async () => {}),
  schedule: vi.fn(async () => {}),
  request: vi.fn(async () => ({ display: "granted" })),
  rows: [] as any[],
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true },
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
