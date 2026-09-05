"use client";

import { useState } from "react";
import { Tv } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/components/session-provider";

export function LoginScreen() {
  const { signIn, error, enterPreview } = useSession();
  const [serverUrl, setServerUrl] = useState("http://127.0.0.1:8096");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [allowInsecure, setAllowInsecure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setLocalError(null);
    try {
      await signIn({ serverUrl, username, password, allowInsecure });
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Could not sign in.");
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
              placeholder="http://127.0.0.1:8096"
              className="h-11 bg-white"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="h-11 bg-white"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 bg-white"
            />
          </div>
          <label className="flex items-start gap-2 text-sm text-zinc-600">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={allowInsecure}
              onChange={(event) => setAllowInsecure(event.target.checked)}
            />
            Allow self-signed HTTPS certificate
          </label>
          {(localError || error) && (
            <p className="text-sm leading-relaxed text-red-600">{localError || error}</p>
          )}
          <Button type="submit" disabled={busy} className="h-11 w-full rounded-full">
            {busy ? "Connecting…" : "Sign in"}
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
            Open Cinema at http://127.0.0.1:3000 — include the port. For Jellyfin, use the address from the dashboard (often http://192.168.x.x:8096). Enable Downloads for your user if you want files saved here.
          </p>
        </form>
      </div>
    </div>
  );
}
