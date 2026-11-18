import { afterEach, describe, it, expect, vi } from "vitest";
import {
  readAppearance,
  saveAppearance,
  applyAppearance,
} from "../src/appearance";
afterEach(() => vi.unstubAllGlobals());
describe("appearance preferences", () => {
  it("preserves existing scale/spacing and safely defaults unknown themes", () => {
    vi.stubGlobal("localStorage", {
      getItem: () =>
        JSON.stringify({
          textSize: 140,
          density: "comfortable",
          theme: "unknown",
        }),
    });
    expect(readAppearance()).toEqual({
      textSize: 140,
      density: "comfortable",
      theme: "system",
    });
    vi.stubGlobal("localStorage", {
      getItem: () =>
        JSON.stringify({ textSize: 900, density: "broken", theme: "contrast" }),
    });
    expect(readAppearance()).toEqual({
      textSize: 140,
      density: "compact",
      theme: "contrast",
    });
  });
  it("applies system colors and chrome metadata even when persistence fails", () => {
    const set = vi.fn(),
      root = { dataset: {} as any, style: { setProperty: set } },
      meta = { content: "" };
    vi.stubGlobal("document", {
      documentElement: root,
      querySelector: () => meta,
    });
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    vi.stubGlobal("localStorage", {
      setItem: () => {
        throw Error("full");
      },
    });
    expect(
      saveAppearance({ textSize: 100, density: "compact", theme: "system" }),
    ).toBe(false);
    expect(root.dataset.resolvedTheme).toBe("dark");
    expect(meta.content).toBe("#111b19");
    applyAppearance({
      textSize: 125,
      density: "comfortable",
      theme: "contrast",
    });
    expect(root.dataset.textSize).toBe("large");
    expect(meta.content).toBe("#000000");
  });
});
