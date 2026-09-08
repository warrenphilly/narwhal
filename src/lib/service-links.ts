export type ServiceId = "radarr" | "sonarr" | "prowlarr" | "dockage";

export type ServiceLink = {
  url: string;
  username: string;
  password: string;
};

export const SERVICE_LABELS: { id: ServiceId; label: string; hint: string }[] = [
  { id: "radarr", label: "Radarr", hint: "http://192.168.x.x:7878" },
  { id: "sonarr", label: "Sonarr", hint: "http://192.168.x.x:8989" },
  { id: "prowlarr", label: "Prowlarr", hint: "http://192.168.x.x:9696" },
  { id: "dockage", label: "Dockage", hint: "http://192.168.x.x:5001" },
];

const KEY = "narwhal.service-links";

const empty: Record<ServiceId, ServiceLink> = {
  radarr: { url: "", username: "", password: "" },
  sonarr: { url: "", username: "", password: "" },
  prowlarr: { url: "", username: "", password: "" },
  dockage: { url: "", username: "", password: "" },
};

export function loadServiceLinks(): Record<ServiceId, ServiceLink> {
  if (typeof window === "undefined") return empty;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...empty };
    const parsed = JSON.parse(raw) as Partial<Record<ServiceId, Partial<ServiceLink>>>;
    const next = { ...empty };
    for (const id of Object.keys(empty) as ServiceId[]) {
      next[id] = {
        url: parsed[id]?.url ?? "",
        username: parsed[id]?.username ?? "",
        password: parsed[id]?.password ?? "",
      };
    }
    return next;
  } catch {
    return { ...empty };
  }
}

export function saveServiceLinks(links: Record<ServiceId, ServiceLink>) {
  localStorage.setItem(KEY, JSON.stringify(links));
}

export function launchHref(link: ServiceLink) {
  const raw = link.url.trim();
  if (!raw) return "";
  try {
    const url = new URL(raw.includes("://") ? raw : `http://${raw}`);
    url.username = "";
    url.password = "";
    return url.toString();
  } catch {
    return raw;
  }
}

export function openInBrowser(href: string) {
  const desktop = window.narwhal;
  if (desktop?.openExternal) {
    desktop.openExternal(href);
    return;
  }
  window.open(href, "_blank", "noopener,noreferrer");
}
