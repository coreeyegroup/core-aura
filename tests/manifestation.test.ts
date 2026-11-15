import { afterEach, describe, expect, it, vi } from "vitest";
import {
  newPlan,
  parsePlan,
  parseReminders,
  position,
  occurrence,
  nextOccurrence,
} from "../src/manifestation/model";
import { ManifestPlayer } from "../src/manifestation/player";
import { calendarFile, notificationIds } from "../src/manifestation/reminders";
function plan() {
  return {
    ...newPlan(),
    lines: [
      { id: "a", text: "I take a clear step." },
      { id: "b", text: "I keep learning." },
    ],
    repeats: 2,
    gap: 0,
    seconds: 60,
  };
}
afterEach(() => vi.useRealTimers());
describe("manifestation practices and reminders", () => {
  it("validates single/multiple sentences and bounded settings without treating drafts as finished practices", () => {
    expect(parsePlan(plan()).lines).toHaveLength(2);
    expect(
      parsePlan({ ...plan(), lines: [plan().lines[0]] }).lines,
    ).toHaveLength(1);
    expect(() => parsePlan({ ...plan(), lines: [] })).toThrow();
    expect(() => parsePlan({ ...plan(), repeats: 0 })).toThrow();
    expect(() => parsePlan({ ...plan(), background: false })).toThrow();
    expect(
      parsePlan(
        { ...plan(), name: "", lines: [{ id: "draft", text: "" }] },
        true,
      ),
    ).toBeTruthy();
  });
  it("orders repeats correctly for the whole sequence and each-sentence modes", () => {
    const p = plan();
    expect([0, 1, 2, 3].map((n) => position(p, n).line)).toEqual([0, 1, 0, 1]);
    p.order = "each";
    expect([0, 1, 2, 3].map((n) => position(p, n).line)).toEqual([0, 0, 1, 1]);
  });
  it("resolves weekday reminders in local time, catches only recent occurrences and assigns non-colliding native IDs", () => {
    const p = plan(),
      r = {
        id: "r",
        slot: 0,
        planId: p.id,
        time: "07:00",
        days: [0, 1, 2, 3, 4, 5, 6],
        enabled: true,
      };
    expect(parseReminders([r], [p])).toHaveLength(1);
    expect(occurrence(r, new Date(2026, 10, 16, 7, 1))?.key).toContain(
      "2026-11-16",
    );
    expect(occurrence(r, new Date(2026, 10, 16, 6, 59))).toBeNull();
    expect(occurrence(r, new Date(2026, 10, 16, 7, 16))).toBeNull();
    expect(nextOccurrence(r, new Date(2026, 10, 16, 7, 1))?.getDate()).toBe(17);
    expect(
      new Set([...notificationIds(r), ...notificationIds({ ...r, slot: 1 })])
        .size,
    ).toBe(14);
    expect(() => parseReminders([r, { ...r, id: "other" }], [p])).toThrow();
    const ics = calendarFile(
      r,
      "Calm, health; progress\nToday",
      new Date(2026, 10, 16, 6),
    );
    expect(ics).toContain("SUMMARY:Calm\\, health\\; progress\\nToday");
    expect(ics).toContain("BEGIN:VALARM");
    expect(ics).toContain("RRULE:FREQ=WEEKLY;BYDAY=SU,MO,TU,WE,TH,FR,SA");
  });
  it("plays all sentences, pauses without advancing, repeats the current sentence on resume and cancels late completions", async () => {
    vi.useFakeTimers();
    const spoken: string[] = [],
      waiting: (() => void)[] = [];
    const voice = {
      voices: async () => [],
      speak: (text: string) => {
        spoken.push(text);
        return new Promise<void>((r) => waiting.push(r));
      },
      stop: vi.fn(),
    };
    const audio = {
      stopAll: vi.fn(),
      play: vi.fn(async () => {}),
      pause: vi.fn(),
      stop: vi.fn(),
    };
    const player = new ManifestPlayer(voice, audio);
    player.start(plan());
    expect(spoken).toEqual(["I take a clear step."]);
    player.pause();
    waiting.shift()!();
    await vi.advanceTimersByTimeAsync(5000);
    expect(player.snapshot().step).toBe(0);
    player.resume();
    expect(spoken).toEqual(["I take a clear step.", "I take a clear step."]);
    waiting.shift()!();
    await vi.advanceTimersByTimeAsync(1);
    expect(spoken.at(-1)).toBe("I keep learning.");
    player.stop();
    waiting.shift()!();
    await vi.advanceTimersByTimeAsync(1000);
    expect(player.snapshot().status).toBe("idle");
    player.dispose();
  });
  it("completes a finite silent practice and enforces the session time limit without counting paused time", async () => {
    vi.useFakeTimers();
    const voice = {
        voices: async () => [],
        speak: vi.fn(async () => {}),
        stop: vi.fn(),
      },
      audio = {
        stopAll: vi.fn(),
        play: vi.fn(async () => {}),
        pause: vi.fn(),
        stop: vi.fn(),
      };
    const player = new ManifestPlayer(voice, audio),
      p = plan();
    p.mode = "read";
    p.readSeconds = 2;
    p.repeats = 1;
    player.start(p);
    await vi.advanceTimersByTimeAsync(4500);
    expect(player.snapshot().status).toBe("completed");
    p.repeats = 108;
    player.start(p);
    await vi.advanceTimersByTimeAsync(1000);
    player.pause();
    await vi.advanceTimersByTimeAsync(90000);
    expect(player.snapshot().status).toBe("paused");
    player.resume();
    await vi.advanceTimersByTimeAsync(60000);
    expect(player.snapshot().status).toBe("completed");
    player.dispose();
  });
});
