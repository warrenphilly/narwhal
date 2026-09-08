"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_PLAYBACK_PREFS,
  loadPlaybackPrefs,
  savePlaybackPrefs,
  type PlaybackPrefs,
} from "@/lib/playback-prefs";
import {
  SERVICE_LABELS,
  launchHref,
  loadServiceLinks,
  openInBrowser,
  saveServiceLinks,
  type ServiceId,
  type ServiceLink,
} from "@/lib/service-links";

type SessionInfo = { connected: boolean; serverUrl?: string; error?: string };

const SettingsContext = createContext<{ openSettings: () => void }>({
  openSettings: () => undefined,
});

export function useSettings() {
  return useContext(SettingsContext);
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <SettingsContext.Provider value={{ openSettings: () => setOpen(true) }}>
      {children}
      <AppSettingsDialog open={open} onOpenChange={setOpen} />
    </SettingsContext.Provider>
  );
}

function AppSettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [info, setInfo] = useState<SessionInfo>({ connected: false });
  const [serverUrl, setServerUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [allowInsecure, setAllowInsecure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [links, setLinks] = useState(loadServiceLinks);
  const [playback, setPlayback] = useState<PlaybackPrefs>(DEFAULT_PLAYBACK_PREFS);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLinks(loadServiceLinks());
    setPlayback(loadPlaybackPrefs());
    fetch("/api/seerr/session", { cache: "no-store" })
      .then((response) => response.json())
      .then(async (data: SessionInfo) => {
        setInfo(data);
        if (data.serverUrl) setServerUrl(data.serverUrl);
        if (!data.connected) return;
        const current = loadServiceLinks();
        const [radarr, sonarr] = await Promise.all([
          fetch("/api/seerr/v1/service/radarr", { cache: "no-store" }).then((row) => row.json()).catch(() => []),
          fetch("/api/seerr/v1/service/sonarr", { cache: "no-store" }).then((row) => row.json()).catch(() => []),
        ]);
        const radarrUrl = Array.isArray(radarr) ? radarr.find((row: { isDefault?: boolean; externalUrl?: string }) => row.isDefault)?.externalUrl || radarr[0]?.externalUrl : "";
        const sonarrUrl = Array.isArray(sonarr) ? sonarr.find((row: { isDefault?: boolean; externalUrl?: string }) => row.isDefault)?.externalUrl || sonarr[0]?.externalUrl : "";
        const next = {
          ...current,
          radarr: { ...current.radarr, url: current.radarr.url || radarrUrl || "" },
          sonarr: { ...current.sonarr, url: current.sonarr.url || sonarrUrl || "" },
        };
        setLinks(next);
        saveServiceLinks(next);
      })
      .catch(() => undefined);
  }, [open]);

  function updateLink(id: ServiceId, patch: Partial<ServiceLink>) {
    setLinks((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  }

  function persistLinks() {
    saveServiceLinks(links);
  }

  function launch(id: ServiceId) {
    persistLinks();
    const href = launchHref(links[id]);
    if (!href) return;
    openInBrowser(href);
  }

  function updatePlayback(patch: Partial<PlaybackPrefs>) {
    setPlayback((current) => savePlaybackPrefs({ ...current, ...patch }));
  }

  async function connect(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    persistLinks();
    try {
      const response = await fetch("/api/seerr/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverUrl, apiKey, allowInsecure }),
      });
      const data = (await response.json()) as SessionInfo;
      if (!response.ok) throw new Error(data.error || "Could not connect.");
      setApiKey("");
      setInfo(data);
      window.dispatchEvent(new Event("narwhal-seerr-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Connect Jellyseerr, then launch Radarr, Sonarr, Prowlarr, or Dockage in your browser.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={connect} className="space-y-3">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Jellyseerr</p>
          <div className="space-y-1.5">
            <Label htmlFor="seerr-url">Server address</Label>
            <Input
              id="seerr-url"
              value={serverUrl}
              onChange={(event) => setServerUrl(event.target.value)}
              placeholder="http://192.168.x.x:5055"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="seerr-key">API key</Label>
            <Input
              id="seerr-key"
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={info.connected ? "Saved — paste to replace" : "Paste API key"}
              required={!info.connected}
            />
          </div>
          <label className="flex items-start gap-2 text-sm text-zinc-500">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={allowInsecure}
              onChange={(event) => setAllowInsecure(event.target.checked)}
            />
            Allow self-signed HTTPS
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={busy} className="h-10 w-full rounded-full">
            {busy ? "Connecting…" : info.connected ? "Update Jellyseerr" : "Connect Jellyseerr"}
          </Button>
          {info.connected && <p className="text-xs text-zinc-500">Connected to {info.serverUrl}</p>}
        </form>

        <div className="space-y-3 border-t border-zinc-200 pt-4 dark:border-white/10">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Shows & subtitles</p>
          <label className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-300">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={playback.showsStartFullscreen}
              onChange={(event) => updatePlayback({ showsStartFullscreen: event.target.checked })}
            />
            Start TV episodes in fullscreen
          </label>
          <div className="space-y-1.5">
            <Label htmlFor="sub-pad-top">
              Subtitle top padding ({playback.subtitlePadTop}vh)
            </Label>
            <input
              id="sub-pad-top"
              type="range"
              min={0}
              max={24}
              step={0.5}
              value={playback.subtitlePadTop}
              onChange={(event) => updatePlayback({ subtitlePadTop: Number(event.target.value) })}
              className="h-2 w-full accent-[#AA5CC3]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sub-pad-bottom">
              Subtitle bottom padding ({playback.subtitlePadBottom}vh)
            </Label>
            <input
              id="sub-pad-bottom"
              type="range"
              min={0}
              max={24}
              step={0.5}
              value={playback.subtitlePadBottom}
              onChange={(event) => updatePlayback({ subtitlePadBottom: Number(event.target.value) })}
              className="h-2 w-full accent-[#00A4DC]"
            />
          </div>
          <p className="text-xs text-zinc-500">
            Extra black space above and below TV episodes so captions stay readable.
          </p>
        </div>

        <div className="space-y-2 border-t border-zinc-200 pt-4 dark:border-white/10">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Apps in your browser</p>
          {SERVICE_LABELS.map((service) => (
            <details
              key={service.id}
              className="group rounded-xl border border-zinc-200 dark:border-white/10"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
                <span className="flex min-w-0 items-center gap-2">
                  <ChevronDown className="size-4 shrink-0 text-zinc-400 transition-transform group-open:rotate-180" />
                  <span className="text-sm font-medium">{service.label}</span>
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  disabled={!links[service.id].url.trim()}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    launch(service.id);
                  }}
                >
                  <ExternalLink data-icon="inline-start" />
                  Launch
                </Button>
              </summary>
              <div className="space-y-2 border-t border-zinc-200 px-3 py-3 dark:border-white/10">
                <Input
                  value={links[service.id].url}
                  onChange={(event) => updateLink(service.id, { url: event.target.value })}
                  onBlur={persistLinks}
                  placeholder={service.hint}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={links[service.id].username}
                    onChange={(event) => updateLink(service.id, { username: event.target.value })}
                    onBlur={persistLinks}
                    placeholder="Username"
                    autoComplete="off"
                  />
                  <Input
                    type="password"
                    value={links[service.id].password}
                    onChange={(event) => updateLink(service.id, { password: event.target.value })}
                    onBlur={persistLinks}
                    placeholder="Password"
                    autoComplete="off"
                  />
                </div>
              </div>
            </details>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
