export type MediaTab = "home" | "movies" | "shows";

const TAB_KEY = "cinema-tab";

export function tabFromSearch(tab: string | null | undefined): MediaTab {
  if (tab === "shows") return "shows";
  if (tab === "home") return "home";
  return tab === "movies" ? "movies" : "home";
}

export function homeHref(tab: MediaTab) {
  if (tab === "shows") return "/shows";
  if (tab === "movies") return "/movies";
  return "/";
}

export function rememberTab(tab: MediaTab) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(TAB_KEY, tab);
}

export function lastTab(): MediaTab {
  if (typeof window === "undefined") return "home";
  return tabFromSearch(window.sessionStorage.getItem(TAB_KEY));
}
