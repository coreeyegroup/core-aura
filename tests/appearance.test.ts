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
        JSON.stringify({ textSize: 900, density: "broken", theme: "yellow" }),
    });
    expect(readAppearance()).toEqual({
      textSize: 140,
      density: "compact",
      theme: "yellow",
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
    expect(meta.content).toBe("#17231d");
    applyAppearance({
      textSize: 125,
      density: "comfortable",
      theme: "yellow",
    });
    expect(root.dataset.textSize).toBe("large");
    expect(meta.content).toBe("#fff8dc");
    applyAppearance({
      textSize: 100,
      density: "compact",
      theme: "custom",
      customColor: "#ffffff",
    });
    expect(meta.content).toBe("#ffffff");
    expect(set).toHaveBeenCalledWith("--theme-accent", "#6e6e6e");
    applyAppearance({ textSize: 100, density: "compact", theme: "light" });
    expect(set).toHaveBeenCalledWith("--theme-accent", "");
  });
});
