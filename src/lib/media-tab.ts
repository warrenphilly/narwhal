export type MediaTab = "movies" | "shows";

export function tabFromSearch(tab: string | null | undefined): MediaTab {
  return tab === "shows" ? "shows" : "movies";
}

export function homeHref(tab: MediaTab) {
  return tab === "shows" ? "/?tab=shows" : "/?tab=movies";
}
