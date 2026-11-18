import type { Tab } from "./model";
export type Route = {
  tab: Tab;
  manifestSection: "practice" | "schedule";
  libraryView: "manifestation" | "audio";
  librarySection: "all" | "saved" | "recordings";
  category: string;
  exploreView: "sounds" | "packs" | "nature" | "tracks";
};
export const defaultRoute: Route = {
  tab: "home",
  manifestSection: "practice",
  libraryView: "manifestation",
  librarySection: "all",
  category: "Health",
  exploreView: "sounds",
};
export function parseRoute(hash: string, previous = defaultRoute): Route {
  const [path, query = ""] = hash.replace(/^#/, "").split("?");
  const [page, section] = path.split("/");
  const known = [
    "home",
    "manifest",
    "explore",
    "studio",
    "chakras",
    "library",
    "admin",
  ];
  const route: Route = {
    ...previous,
    tab: known.includes(page) ? (page as Tab) : "home",
  };
  if (page === "manifest")
    route.manifestSection = section === "schedule" ? "schedule" : "practice";
  if (page === "explore")
    route.exploreView = section === "packs" ? "packs" : section === "nature" ? "nature" : section === "tracks" ? "tracks" : "sounds";
  if (page === "library") {
    if (section)
      route.libraryView = section === "audio" ? "audio" : "manifestation";
    route.librarySection =
      section === "practices"
        ? "saved"
        : section === "recordings"
          ? "recordings"
          : "all";
    const category = new URLSearchParams(query).get("category");
    if (category && category.length <= 80) route.category = category;
  }
  return route;
}
export function routeHash(route: Route) {
  if (route.tab === "manifest")
    return (
      "#manifest" + (route.manifestSection === "schedule" ? "/schedule" : "")
    );
  if (route.tab === "explore")
    return "#explore" + (route.exploreView === "packs" ? "/packs" : route.exploreView === "nature" ? "/nature" : route.exploreView === "tracks" ? "/tracks" : "");
  if (route.tab === "library") {
    if (route.libraryView === "audio") return "#library/audio";
    const section =
      route.librarySection === "saved"
        ? "practices"
        : route.librarySection === "recordings"
          ? "recordings"
          : "affirmations";
    return (
      "#library/" + section + "?category=" + encodeURIComponent(route.category)
    );
  }
  return "#" + route.tab;
}
