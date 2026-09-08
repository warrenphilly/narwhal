"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NarwhalMark } from "@/components/narwhal-mark";
import { useSession } from "@/components/session-provider";
import { browserCanReachJellyfin } from "@/lib/reach-jellyfin";

export function LoginScreen() {
  const { signIn, error, enterPreview } = useSession();
  const [serverUrl, setServerUrl] = useState("http://100.121.26.58:8096");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [allowInsecure, setAllowInsecure] = useState(false);
  const [showTunnel, setShowTunnel] = useState(false);
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
      if (data.ok) {
        setProbeMessage(data.message || "Reached Jellyfin.");
        return;
      }
      const fromBrowser = await browserCanReachJellyfin(serverUrl);
      if (fromBrowser) {
        setProbeMessage(
          "This browser can see Jellyfin, but Narwhal’s server cannot. Open http://127.0.0.1:3000 from npm run dev on this Mac."
        );
        return;
      }
      setProbeMessage(
        data.message ||
          "Nothing answered on that address. Check Tailscale and Jellyfin’s port."
      );
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Probe failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-full overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/login-cinema.jpg" alt="" className="absolute inset-0 size-full object-cover" />
      <div className="absolute inset-0 bg-black/55" />
      <div className="relative flex min-h-full items-center justify-center px-4 py-16">
        <form
          onSubmit={onSubmit}
          className="w-full max-w-md space-y-4 rounded-3xl bg-zinc-950/75 px-8 py-10 text-white shadow-2xl ring-1 ring-white/10 backdrop-blur-xl"
        >
          <div className="mb-6 flex flex-col items-center text-center">
            <NarwhalMark className="size-16" />
            <p className="mt-4 text-2xl font-semibold tracking-tight">Narwhal</p>
            <p className="mt-1 text-sm text-white/60">Your Jellyfin library, on this laptop.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="server" className="text-white/80">
              Server address
            </Label>
            <Input
              id="server"
              value={serverUrl}
              onChange={(event) => setServerUrl(event.target.value)}
              placeholder="http://100.121.26.58:8096"
              className="h-11 border-white/15 bg-white/8 text-white"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="username" className="text-white/80">
              Username
            </Label>
            <Input
              id="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="h-11 border-white/15 bg-white/8 text-white"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-white/80">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 border-white/15 bg-white/8 text-white"
            />
          </div>
          <button
            type="button"
            className="text-left text-sm text-white/55 underline-offset-4 hover:text-white hover:underline"
            onClick={() => setShowTunnel((open) => !open)}
          >
            {showTunnel ? "Hide" : "Tunnel & remote access"}
          </button>
          {showTunnel && (
            <div className="space-y-3 rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs leading-relaxed text-white/55">
                Prefer Tailscale while you are away. Cloudflare email codes will not work here.
              </p>
              <div className="space-y-2">
                <Label htmlFor="cf-id" className="text-white/70">
                  Access Client ID
                </Label>
                <Input
                  id="cf-id"
                  value={cfAccessClientId}
                  onChange={(event) => setCfAccessClientId(event.target.value)}
                  className="h-11 border-white/15 bg-white/8 text-white"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cf-secret" className="text-white/70">
                  Access Client Secret
                </Label>
                <Input
                  id="cf-secret"
                  type="password"
                  value={cfAccessClientSecret}
                  onChange={(event) => setCfAccessClientSecret(event.target.value)}
                  className="h-11 border-white/15 bg-white/8 text-white"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cf-jwt" className="text-white/70">
                  CF_Authorization cookie
                </Label>
                <Input
                  id="cf-jwt"
                  value={cfAccessJwt}
                  onChange={(event) => setCfAccessJwt(event.target.value)}
                  className="h-11 border-white/15 bg-white/8 text-white"
                  autoComplete="off"
                />
              </div>
              <label className="flex items-start gap-2 text-sm text-white/65">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={allowInsecure}
                  onChange={(event) => setAllowInsecure(event.target.checked)}
                />
                Allow self-signed HTTPS certificate
              </label>
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                className="h-10 w-full rounded-full"
                onClick={testTunnel}
              >
                Test tunnel
              </Button>
            </div>
          )}
          {probeMessage && <p className="text-sm leading-relaxed text-white/75">{probeMessage}</p>}
          {(localError || error) && (
            <p className="text-sm leading-relaxed text-red-300">{localError || error}</p>
          )}
          <Button type="submit" disabled={busy} className="h-11 w-full rounded-full">
            {busy ? "Working…" : "Sign in"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-11 w-full rounded-full text-white hover:bg-white/10 hover:text-white"
            onClick={enterPreview}
          >
            Preview the home screen
          </Button>
        </form>
      </div>
    </div>
  );
}
