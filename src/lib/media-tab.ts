export type MediaTab = "movies" | "shows";

const TAB_KEY = "cinema-tab";

export function tabFromSearch(tab: string | null | undefined): MediaTab {
  return tab === "shows" ? "shows" : "movies";
}

export function homeHref(tab: MediaTab) {
  return tab === "shows" ? "/?tab=shows" : "/?tab=movies";
}

export function rememberTab(tab: MediaTab) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(TAB_KEY, tab);
}

export function lastTab(): MediaTab {
  if (typeof window === "undefined") return "movies";
  return tabFromSearch(window.sessionStorage.getItem(TAB_KEY));
}
