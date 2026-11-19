import type { Tab } from "./model";
export const libraryViews = ["overview", "manifestation", "sounds", "backgrounds", "audio", "mixes", "packs"] as const;
type LibraryView = (typeof libraryViews)[number];

export type Route = {
  tab: Tab;
  manifestSection: "practices" | "practice" | "schedule";
  libraryView: LibraryView;
  librarySection: "all" | "saved" | "recordings" | "playlists";
  category: string;
  exploreView: "sounds" | "packs" | "nature" | "tracks";
};
export const defaultRoute: Route = {
  tab: "home",
  manifestSection: "practice",
  libraryView: "overview",
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
    route.manifestSection = section === "schedule" ? "schedule" : section === "practices" ? "practices" : "practice";
  if (page === "explore")
    route.exploreView = section === "packs" ? "packs" : section === "nature" ? "nature" : section === "tracks" ? "tracks" : "sounds";
  if (page === "library") {
    if (section === "playlists") route.libraryView = "overview";
    else if (section) route.libraryView = libraryViews.find(view => view === section) ?? "manifestation";
    else route.libraryView = "overview";
    route.librarySection =
      section === "playlists" ? "playlists" :
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
      "#manifest" + (route.manifestSection === "practice" ? "" : "/" + route.manifestSection)
    );
  if (route.tab === "explore")
    return "#explore" + (route.exploreView === "packs" ? "/packs" : route.exploreView === "nature" ? "/nature" : route.exploreView === "tracks" ? "/tracks" : "");
  if (route.tab === "library") {
    if (route.librarySection === "playlists") return "#library/playlists";
    if (route.libraryView === "overview") return "#library";
    if (route.libraryView !== "manifestation") return "#library/" + route.libraryView;
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
