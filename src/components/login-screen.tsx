"use client";

import { useState } from "react";
import { Tv } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/components/session-provider";

export function LoginScreen() {
  const { signIn, error, enterPreview } = useSession();
  const [serverUrl, setServerUrl] = useState("http://localhost:8096");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setLocalError(null);
    try {
      await signIn({ serverUrl, username, password });
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tv-root grid min-h-full lg:grid-cols-[1.1fr_0.9fr]">
      <div className="relative hidden min-h-[40vh] overflow-hidden lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,#3a3a3c,transparent_40%),radial-gradient(circle_at_80%_0%,#1c3a5f,transparent_35%),linear-gradient(#000,#111)]" />
        <div className="relative flex h-full flex-col justify-end p-16">
          <p className="text-sm tracking-[0.28em] text-white/50 uppercase">For your laptop</p>
          <h1 className="mt-4 max-w-lg text-6xl font-semibold tracking-tight text-white">
            Your movies, laid out like Apple TV.
          </h1>
          <p className="mt-6 max-w-md text-lg text-white/65">
            Sign in to your Jellyfin server, browse the shelves, and download titles to this computer.
          </p>
        </div>
      </div>
      <div className="flex items-center justify-center px-6 py-16">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5">
          <div className="mb-8 flex items-center gap-3 text-white">
            <span className="flex size-10 items-center justify-center rounded-full bg-white text-black">
              <Tv className="size-5" />
            </span>
            <div>
              <p className="text-lg font-semibold">Cinema</p>
              <p className="text-sm text-white/50">Jellyfin client</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="server" className="text-white/70">
              Server address
            </Label>
            <Input
              id="server"
              value={serverUrl}
              onChange={(event) => setServerUrl(event.target.value)}
              placeholder="http://192.168.1.20:8096"
              className="h-11 border-white/15 bg-white/5 text-white"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="username" className="text-white/70">
              Username
            </Label>
            <Input
              id="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="h-11 border-white/15 bg-white/5 text-white"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-white/70">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 border-white/15 bg-white/5 text-white"
            />
          </div>
          {(localError || error) && (
            <p className="text-sm text-red-300">{localError || error}</p>
          )}
          <Button
            type="submit"
            disabled={busy}
            className="h-11 w-full rounded-full bg-white text-black hover:bg-white/90"
          >
            {busy ? "Connecting…" : "Sign in"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-11 w-full rounded-full text-white/70 hover:bg-white/10 hover:text-white"
            onClick={enterPreview}
          >
            Preview the home screen
          </Button>
          <p className="text-xs leading-relaxed text-white/40">
            This app talks to your server from this laptop. Enable Downloads for your user in the Jellyfin dashboard if you want files saved locally.
          </p>
        </form>
      </div>
    </div>
  );
}
