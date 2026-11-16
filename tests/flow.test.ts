import { describe, it, expect } from "vitest";
import { newPlan } from "../src/manifestation/model";
import {
  draftChanged,
  isPreview,
  practiceActive,
} from "../src/manifestation/flow";
describe("practice continuity", () => {
  it("detects unsaved settings and content while ignoring generated identities", () => {
    const draft = newPlan();
    expect(draftChanged(draft, [])).toBe(false);
    expect(draftChanged({ ...draft, name: "Changed" }, [])).toBe(true);
    expect(draftChanged({ ...draft, rate: 1.1 }, [])).toBe(true);
    const saved = { ...draft, lines: [{ id: "line", text: "A sentence" }] };
    expect(draftChanged(structuredClone(saved), [saved])).toBe(false);
    expect(
      draftChanged({ ...saved, lines: [{ id: "line", text: "Edited" }] }, [
        saved,
      ]),
    ).toBe(true);
  });
  it("keeps previews distinct from a running full practice", () => {
    const preview = {
      status: "playing" as const,
      plan: { ...newPlan(), id: "preview-line" },
    };
    expect(isPreview(preview)).toBe(true);
    expect(practiceActive(preview)).toBe(false);
    expect(practiceActive({ ...preview, plan: newPlan() })).toBe(true);
    expect(practiceActive({ status: "completed", plan: newPlan() })).toBe(
      false,
    );
  });
});
