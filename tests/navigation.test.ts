import { describe, it, expect } from "vitest";
import { defaultRoute, parseRoute, routeHash } from "../src/navigation";
describe("workspace routes", () => {
  it("round-trips nested destinations and encoded categories", () => {
    for (const patch of [
      { tab: "manifest", manifestSection: "schedule" },
      {
        tab: "library",
        libraryView: "manifestation",
        librarySection: "saved",
        category: "Health & wealth / ಕನ್ನಡ",
      },
      { tab: "library", libraryView: "manifestation", librarySection: "recordings" },
      { tab: "library", libraryView: "audio" },
      { tab: "library", libraryView: "mixes" },
      { tab: "library", libraryView: "sounds" },
      { tab: "library", libraryView: "packs" },
      { tab: "library", libraryView: "backgrounds" },
      { tab: "library", librarySection: "playlists" },
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
    ).toBe("overview");
    expect(parseRoute("#library/affirmations").libraryView).toBe("manifestation");
    expect(parseRoute("#library/recordings").librarySection).toBe("recordings");
    expect(
      parseRoute("#home", { ...defaultRoute, category: "Wealth" }).category,
    ).toBe("Wealth");
  });
});
