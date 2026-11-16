import { describe, it, expect, vi } from "vitest";
import { parseLibrary } from "../src/manifestation/library";
const base = {
  schemaVersion: 1,
  categories: ["Health", "Focus"],
  affirmations: [{ id: "one", text: "I focus.", category: "Focus" }],
};
describe("editable affirmation library", () => {
  it("validates category ownership, IDs, names and bounded content", () => {
    expect(parseLibrary(base).affirmations).toHaveLength(1);
    for (const bad of [
      { ...base, categories: ["Health", "health"] },
      {
        ...base,
        affirmations: [{ ...base.affirmations[0], category: "Missing" }],
      },
      { ...base, affirmations: [...base.affirmations, ...base.affirmations] },
      { ...base, categories: [" ".repeat(4)] },
    ])
      expect(() => parseLibrary(bad)).toThrow();
    expect(
      parseLibrary({ schemaVersion: 1, categories: [], affirmations: [] })
        .categories,
    ).toHaveLength(0);
  });
  it("persists add/rename/move/delete and restores without overwriting invalid storage", async () => {
    const saved = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => saved.get(k) || null,
      setItem: (k: string, v: string) => saved.set(k, v),
    });
    vi.resetModules();
    const { affirmationLibrary: l } = await import(
      "../src/manifestation/library"
    );
    l.addCategory("Focus");
    l.save({ id: "focus", category: "Focus", text: "I focus." });
    l.renameCategory("Focus", "Clarity");
    expect(
      l.snapshot().data.affirmations.find((a) => a.id === "focus")?.category,
    ).toBe("Clarity");
    l.save({ id: "focus", category: "Health", text: "I rest." });
    l.deleteCategory("Clarity", "Health");
    expect(l.snapshot().data.categories).not.toContain("Clarity");
    l.remove("focus");
    expect(l.snapshot().data.affirmations.some((a) => a.id === "focus")).toBe(
      false,
    );
    expect(() => l.addCategory("HEALTH")).toThrow();
    l.restore(base);
    expect(JSON.parse([...saved.values()][0]).categories).toEqual(
      base.categories,
    );
    vi.unstubAllGlobals();
  });
});
