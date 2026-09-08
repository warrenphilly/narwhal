"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConnectionForm } from "@/components/connection-form";
import { NarwhalMark } from "@/components/narwhal-mark";
import { useSession } from "@/components/session-provider";
import { browserCanReachJellyfin } from "@/lib/reach-jellyfin";
import { activeServerUrl, readServerPrefs } from "@/lib/servers";

export function LoginScreen() {
  const { enterPreview } = useSession();
  const [showTunnel, setShowTunnel] = useState(false);
  const [allowInsecure, setAllowInsecure] = useState(false);
  const [cfAccessClientId, setCfAccessClientId] = useState("");
  const [cfAccessClientSecret, setCfAccessClientSecret] = useState("");
  const [cfAccessJwt, setCfAccessJwt] = useState("");
  const [busy, setBusy] = useState(false);
  const [probeMessage, setProbeMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  async function testTunnel() {
    setBusy(true);
    setProbeMessage(null);
    setLocalError(null);
    const serverUrl = activeServerUrl(readServerPrefs());
    const tunnelFields = { serverUrl, allowInsecure, cfAccessClientId, cfAccessClientSecret, cfAccessJwt };
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
      setProbeMessage(
        fromBrowser
          ? "This browser can see Jellyfin, but Narwhal’s server cannot. Use http://127.0.0.1:3000 on this computer."
          : data.message || "Nothing answered on that address."
      );
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Probe failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-full overflow-x-clip overflow-y-auto">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/login-cinema.jpg" alt="" className="absolute inset-0 size-full object-cover" />
      <div className="absolute inset-0 bg-black/55" />
      <div className="relative flex min-h-full items-center justify-center px-4 py-16">
        <div className="glass-edge w-full max-w-md space-y-4 rounded-3xl bg-zinc-950/75 px-8 py-10 text-white backdrop-blur-xl">
          <div className="mb-2 flex flex-col items-center text-center">
            <NarwhalMark className="size-16" />
            <p className="mt-4 text-2xl font-semibold tracking-tight">Narwhal</p>
            <p className="mt-1 text-sm text-white/60">Home Wi‑Fi or Tailscale — pick one, then sign in.</p>
          </div>
          <div className="login-form [&_label]:text-white/80 [&_input]:border-white/15! [&_input]:bg-white/8! [&_input]:text-white!">
            <ConnectionForm />
          </div>
          <button
            type="button"
            className="text-left text-sm text-white/55 underline-offset-4 hover:text-white hover:underline"
            onClick={() => setShowTunnel((open) => !open)}
          >
            {showTunnel ? "Hide" : "Tunnel & remote access"}
          </button>
          {showTunnel && (
            <div className="space-y-3 rounded-2xl border border-white/10 bg-black/30 p-4 backdrop-blur-md">
              <p className="text-xs leading-relaxed text-white/55">
                Only needed for a public Cloudflare URL. Home network and Tailscale do not use this.
              </p>
              <div className="space-y-2">
                <Label htmlFor="cf-id" className="text-white/70">
                  Access Client ID
                </Label>
                <Input
                  id="cf-id"
                  value={cfAccessClientId}
                  onChange={(event) => setCfAccessClientId(event.target.value)}
                  className="h-11 border-white/15! bg-white/8! text-white!"
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
                  className="h-11 border-white/15! bg-white/8! text-white!"
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
              <Button type="button" variant="secondary" disabled={busy} className="h-10 w-full rounded-full" onClick={testTunnel}>
                Test tunnel
              </Button>
              {probeMessage && <p className="text-sm text-white/75">{probeMessage}</p>}
              {localError && <p className="text-sm text-red-300">{localError}</p>}
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            className="h-11 w-full rounded-full text-white hover:bg-white/10 hover:text-white"
            onClick={enterPreview}
          >
            Preview the home screen
          </Button>
        </div>
      </div>
    </div>
  );
}
