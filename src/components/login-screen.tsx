"use client";

import { useState } from "react";
import { Tv } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/components/session-provider";

export function LoginScreen() {
  const { signIn, error, enterPreview } = useSession();
  const [serverUrl, setServerUrl] = useState("https://");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [allowInsecure, setAllowInsecure] = useState(false);
  const [showTunnel, setShowTunnel] = useState(true);
  const [cfAccessClientId, setCfAccessClientId] = useState("");
  const [cfAccessClientSecret, setCfAccessClientSecret] = useState("");
  const [cfAccessJwt, setCfAccessJwt] = useState("");
  const [busy, setBusy] = useState(false);
  const [probeMessage, setProbeMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const tunnelFields = {
    serverUrl,
    allowInsecure,
    cfAccessClientId,
    cfAccessClientSecret,
    cfAccessJwt,
  };

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setLocalError(null);
    try {
      await signIn({
        username,
        password,
        ...tunnelFields,
      });
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  async function testTunnel() {
    setBusy(true);
    setProbeMessage(null);
    setLocalError(null);
    try {
      const response = await fetch("/api/auth/probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tunnelFields),
      });
      const data = (await response.json()) as { ok?: boolean; message?: string };
      setProbeMessage(data.message || (data.ok ? "Reached Jellyfin." : "Could not reach the server."));
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Probe failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tv-root grid min-h-full lg:grid-cols-[1.1fr_0.9fr]">
      <div className="relative hidden min-h-[40vh] overflow-hidden lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,#dbeafe,transparent_42%),radial-gradient(circle_at_90%_10%,#fce7f3,transparent_36%),linear-gradient(#f5f5f7,#e8e8ed)]" />
        <div className="relative flex h-full flex-col justify-end p-16">
          <p className="text-sm tracking-[0.28em] text-black/40 uppercase">For your laptop</p>
          <h1 className="mt-4 max-w-lg text-6xl font-semibold tracking-tight text-zinc-900">
            Your movies, laid out like Apple TV.
          </h1>
          <p className="mt-6 max-w-md text-lg text-zinc-600">
            Sign in to your Jellyfin server, browse the shelves, and download titles to this computer.
          </p>
        </div>
      </div>
      <div className="flex items-center justify-center bg-[#fbfbfd] px-6 py-16">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5">
          <div className="mb-8 flex items-center gap-3 text-zinc-900">
            <span className="flex size-10 items-center justify-center rounded-full bg-zinc-900 text-white">
              <Tv className="size-5" />
            </span>
            <div>
              <p className="text-lg font-semibold">Cinema</p>
              <p className="text-sm text-zinc-500">Jellyfin client</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="server">Server address</Label>
            <Input
              id="server"
              value={serverUrl}
              onChange={(event) => setServerUrl(event.target.value)}
              placeholder="http://homeserver.tailnet.ts.net:8096"
              className="h-11 bg-white"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">Jellyfin username</Label>
            <Input
              id="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="h-11 bg-white"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Jellyfin password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 bg-white"
            />
          </div>
          <button
            type="button"
            className="text-left text-sm text-zinc-600 underline-offset-4 hover:underline"
            onClick={() => setShowTunnel((open) => !open)}
          >
            {showTunnel ? "Hide" : "Show"} Cloudflare tunnel options
          </button>
          {showTunnel && (
            <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4">
              <p className="text-xs leading-relaxed text-zinc-500">
                jelly.watchwithwarren.uk is the public door: Cloudflare shows an email window, then Jellyfin. Cinema cannot complete that window. Prefer Tailscale while you are away: turn the VPN on and paste the Tailscale address (100.x.x.x or *.ts.net) with Jellyfin’s port. Use a Service Token or CF_Authorization only if you must go through the public URL.
              </p>
              <div className="space-y-2">
                <Label htmlFor="cf-id">Access Client ID</Label>
                <Input
                  id="cf-id"
                  value={cfAccessClientId}
                  onChange={(event) => setCfAccessClientId(event.target.value)}
                  className="h-11 bg-white"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cf-secret">Access Client Secret</Label>
                <Input
                  id="cf-secret"
                  type="password"
                  value={cfAccessClientSecret}
                  onChange={(event) => setCfAccessClientSecret(event.target.value)}
                  className="h-11 bg-white"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cf-jwt">CF_Authorization cookie (optional)</Label>
                <Input
                  id="cf-jwt"
                  value={cfAccessJwt}
                  onChange={(event) => setCfAccessJwt(event.target.value)}
                  className="h-11 bg-white"
                  autoComplete="off"
                />
              </div>
            </div>
          )}
          <label className="flex items-start gap-2 text-sm text-zinc-600">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={allowInsecure}
              onChange={(event) => setAllowInsecure(event.target.checked)}
            />
            Allow self-signed HTTPS certificate
          </label>
          {probeMessage && (
            <p className="text-sm leading-relaxed text-zinc-700">{probeMessage}</p>
          )}
          {(localError || error) && (
            <p className="text-sm leading-relaxed text-red-600">{localError || error}</p>
          )}
          <Button type="submit" disabled={busy} className="h-11 w-full rounded-full">
            {busy ? "Working…" : "Sign in"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            className="h-11 w-full rounded-full"
            onClick={testTunnel}
          >
            Test tunnel
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-11 w-full rounded-full"
            onClick={enterPreview}
          >
            Preview the home screen
          </Button>
          <p className="text-xs leading-relaxed text-zinc-500">
            Open Cinema at http://127.0.0.1:3000. Away from home: Tailscale on, then the Tailscale Jellyfin URL — not jelly.watchwithwarren.uk unless you also added a Cloudflare service token.
          </p>
        </form>
      </div>
    </div>
  );
}
