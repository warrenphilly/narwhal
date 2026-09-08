"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/components/session-provider";
import {
  activeServerUrl,
  readServerPrefs,
  writeServerPrefs,
  type NetworkKind,
} from "@/lib/servers";
import { cn } from "@/lib/utils";

export function ConnectionForm({ compact }: { compact?: boolean }) {
  const { signIn, session, error } = useSession();
  const [prefs, setPrefs] = useState(readServerPrefs);
  const [username, setUsername] = useState(session?.userName ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const url = activeServerUrl(prefs);

  function choose(kind: NetworkKind) {
    const next = { ...prefs, last: kind };
    setPrefs(next);
    writeServerPrefs(next);
  }

  function setUrl(value: string) {
    const next =
      prefs.last === "tailscale" ? { ...prefs, tailscaleUrl: value } : { ...prefs, homeUrl: value };
    setPrefs(next);
    writeServerPrefs(next);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setLocalError(null);
    writeServerPrefs(prefs);
    try {
      await signIn({ serverUrl: url, username, password });
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className={cn("w-full space-y-3", compact ? "max-w-md" : "max-w-sm")}>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => choose("home")}
          className={cn(
            "flex-1 rounded-full px-3 py-2 text-sm",
            prefs.last === "home" ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "bg-zinc-200 dark:bg-white/10"
          )}
        >
          Home network
        </button>
        <button
          type="button"
          onClick={() => choose("tailscale")}
          className={cn(
            "flex-1 rounded-full px-3 py-2 text-sm",
            prefs.last === "tailscale"
              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
              : "bg-zinc-200 dark:bg-white/10"
          )}
        >
          Tailscale
        </button>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="server-url">Server address</Label>
        <Input id="server-url" value={url} onChange={(event) => setUrl(event.target.value)} className="h-11" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="switch-user">Username</Label>
        <Input
          id="switch-user"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          className="h-11"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="switch-pass">Password</Label>
        <Input
          id="switch-pass"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-11"
        />
      </div>
      {(localError || error) && <p className="text-sm text-red-600">{localError || error}</p>}
      <Button type="submit" disabled={busy} className="h-11 w-full rounded-full">
        {busy ? "Connecting…" : session?.signedIn ? "Switch server" : "Sign in"}
      </Button>
    </form>
  );
}
