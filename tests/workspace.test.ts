import { afterEach, describe, it, expect, vi } from "vitest";
import { channel, chakras } from "../src/model";
import {
  parseWorkspace,
  readWorkspace,
  saveWorkspace,
  Workspace,
} from "../src/workspace";
const fixture = (): Workspace => ({
  schemaVersion: 1,
  layers: [channel("flute", 321)],
  chakraChannels: chakras.map((c) => ({ ...channel("sine", c.hz), id: c.id })),
  selected: ["root"],
  mixTarget: "selected",
  seconds: 123,
  master: 0.3,
});
afterEach(() => vi.unstubAllGlobals());
describe("sound workspace persistence", () => {
  it("restores exact settings including non-preset duration and selection", () => {
    const data = fixture(),
      setItem = vi.fn();
    vi.stubGlobal("localStorage", {
      getItem: () => JSON.stringify(data),
      setItem,
    });
    expect(readWorkspace().data).toEqual(data);
    expect(
      parseWorkspace({
        ...data,
        layers: Array.from({ length: 12 }, () => channel("flute", 321)),
      }).layers,
    ).toHaveLength(12);
    expect(saveWorkspace(data)).toBe(true);
    expect(setItem).toHaveBeenCalledOnce();
  });
  it("preserves unreadable storage and rejects invalid channels or selections", () => {
    const setItem = vi.fn();
    vi.stubGlobal("localStorage", {
      getItem: () => '{"broken":true}',
      setItem,
    });
    expect(readWorkspace().error).toContain("preserved");
    expect(setItem).not.toHaveBeenCalled();
    expect(() =>
      parseWorkspace({ ...fixture(), selected: ["unknown"] }),
    ).toThrow();
    expect(() => parseWorkspace({ ...fixture(), layers: [] })).toThrow();
    const w = fixture();
    w.chakraChannels[0].hz = 400;
    expect(() => parseWorkspace(w)).toThrow();
  });
  it("reports failed persistence instead of claiming settings were saved", () => {
    vi.stubGlobal("localStorage", {
      setItem: () => {
        throw Error("full");
      },
    });
    expect(saveWorkspace(fixture())).toBe(false);
  });
});
