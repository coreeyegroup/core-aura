import { describe, it, expect } from "vitest";
import { defaultRoute, parseRoute, routeHash } from "../src/navigation";
describe("workspace routes", () => {
  it("round-trips nested destinations and encoded categories", () => {
    for (const patch of [
      { tab: "manifest", manifestSection: "schedule" },
      {
        tab: "library",
        librarySection: "saved",
        category: "Health & wealth / ಕನ್ನಡ",
      },
      { tab: "library", librarySection: "recordings" },
      { tab: "library", libraryView: "audio" },
      { tab: "explore", exploreView: "packs" },
    ] as const) {
      const route = { ...defaultRoute, ...patch };
      const restored = parseRoute(routeHash(route));
      expect(routeHash(restored)).toBe(routeHash(route));
    }
  });
  it("supports old links, rejects unknown pages and preserves inactive context", () => {
    expect(parseRoute("#manifest").manifestSection).toBe("practice");
    expect(parseRoute("#unknown").tab).toBe("home");
    expect(
      parseRoute("#library", { ...defaultRoute, libraryView: "audio" })
        .libraryView,
    ).toBe("audio");
    expect(
      parseRoute("#home", { ...defaultRoute, category: "Wealth" }).category,
    ).toBe("Wealth");
  });
});
