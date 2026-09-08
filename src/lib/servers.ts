export type NetworkKind = "home" | "tailscale";

export type ServerPrefs = {
  homeUrl: string;
  tailscaleUrl: string;
  last: NetworkKind;
};

const KEY = "narwhal-servers";

export const DEFAULT_HOME = "http://10.88.111.25:8096";
export const DEFAULT_TAILSCALE = "http://100.121.26.58:8096";

export function readServerPrefs(): ServerPrefs {
  if (typeof window === "undefined") {
    return { homeUrl: DEFAULT_HOME, tailscaleUrl: DEFAULT_TAILSCALE, last: "home" };
  }
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { homeUrl: DEFAULT_HOME, tailscaleUrl: DEFAULT_TAILSCALE, last: "home" };
    const parsed = JSON.parse(raw) as Partial<ServerPrefs>;
    return {
      homeUrl: parsed.homeUrl || DEFAULT_HOME,
      tailscaleUrl: parsed.tailscaleUrl || DEFAULT_TAILSCALE,
      last: parsed.last === "tailscale" ? "tailscale" : "home",
    };
  } catch {
    return { homeUrl: DEFAULT_HOME, tailscaleUrl: DEFAULT_TAILSCALE, last: "home" };
  }
}

export function writeServerPrefs(prefs: ServerPrefs) {
  window.localStorage.setItem(KEY, JSON.stringify(prefs));
}

export function activeServerUrl(prefs: ServerPrefs) {
  return prefs.last === "tailscale" ? prefs.tailscaleUrl : prefs.homeUrl;
}
