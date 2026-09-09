"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Play, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ChannelBuilder } from "@/components/channel-builder";
import { ChannelGuide } from "@/components/channel-guide";
import { LoginScreen } from "@/components/login-screen";
import { NarwhalSpinner } from "@/components/narwhal-spinner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/components/session-provider";
import { fetchMovies, fetchShows } from "@/lib/client-api";
import {
  createChannel,
  lineupCount,
  loadChannels,
  removeChannel,
  saveChannels,
  upsertChannel,
  type Channel,
  type ChannelKind,
  type ChannelScope,
} from "@/lib/channels";
import type { JellyfinItem } from "@/lib/jellyfin-types";

export default function ChannelsPage() {
  const { session, loading, preview } = useSession();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [catalog, setCatalog] = useState<JellyfinItem[]>([]);
  const [ready, setReady] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<ChannelKind>("shuffle");
  const [scope, setScope] = useState<ChannelScope>("both");
  const [alwaysOn, setAlwaysOn] = useState(true);
  const [hours, setHours] = useState(6);
  const [editing, setEditing] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    function onRefresh() {
      setReady(false);
      setReloadKey((value) => value + 1);
    }
    window.addEventListener("narwhal-refresh", onRefresh);
    return () => window.removeEventListener("narwhal-refresh", onRefresh);
  }, []);

  useEffect(() => {
    if (!session?.userId) return;
    let cancelled = false;
    setChannels(loadChannels(session.userId));
    Promise.all([fetchMovies(session.userId), fetchShows(session.userId)])
      .then(([movies, shows]) => {
        if (!cancelled) setCatalog([...movies, ...shows]);
      })
      .catch(() => {
        if (!cancelled) setCatalog([]);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.userId, reloadKey]);

  const active = channels.find((row) => row.id === editing) ?? null;

  function persist(next: Channel[]) {
    if (!session?.userId) return;
    setChannels(next);
    saveChannels(session.userId, next);
  }

  function deleteChannel(id: string) {
    persist(removeChannel(channels, id));
    if (editing === id) setEditing(null);
  }

  function create() {
    if (!name.trim()) return;
    const next = createChannel({
      name: name.trim(),
      kind,
      scope,
      alwaysOn,
      hours,
      entries: [],
    });
    persist([...channels, next]);
    setEditing(next.id);
    setCreating(false);
    setName("");
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <NarwhalSpinner label="Tuning channels…" />
        </div>
      </AppShell>
    );
  }
  if (!session?.signedIn && !preview) return <LoginScreen />;

  return (
    <AppShell>
      <div className="w-full py-6">
        <div className="page-gutter flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Channels</h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-300">
              Make a station, add movies or TV, then watch it 24/7 or on a timed block.
            </p>
          </div>
          {channels.length > 0 && (
            <Button className="rounded-full" onClick={() => setCreating(true)}>
              <Plus data-icon="inline-start" />
              Add new channel
            </Button>
          )}
        </div>

        {channels.length === 0 ? (
          <div className="page-gutter mt-10">
            <div className="rounded-3xl border border-dashed border-black/15 bg-white/70 px-6 py-20 text-center dark:border-white/15 dark:bg-black/30">
              <p className="text-2xl font-semibold tracking-tight">No channels yet</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
                Create your first station. You can shuffle titles, play them in order, and pick movies, TV, or both.
              </p>
              <Button className="mt-6 rounded-full" onClick={() => setCreating(true)}>
                <Plus data-icon="inline-start" />
                Add new channel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="page-gutter mt-8 w-full">
              <ChannelGuide channels={channels.filter((row) => row.entries.length > 0)} userId={session?.userId} />
            </div>
            <div className="page-gutter mt-8 grid w-full gap-4">
              {channels.map((channel) => (
                <article key={channel.id} className="w-full rounded-2xl border border-black/8 bg-white/70 p-4 dark:border-white/10 dark:bg-black/30">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold">{channel.name}</h2>
                    <span className="text-xs text-zinc-500">
                      {channel.scope === "movies" ? "Movies" : channel.scope === "shows" ? "TV" : "Movies + TV"} ·{" "}
                      {channel.kind === "shuffle" ? "Shuffle" : "Queue"} · {channel.alwaysOn ? "24/7" : `${channel.hours}h`} ·{" "}
                      {lineupCount(channel)} in lineup
                    </span>
                    <div className="ml-auto flex flex-wrap gap-2">
                      <Button size="sm" className="rounded-full" variant="outline" onClick={() => setEditing(channel.id === editing ? null : channel.id)}>
                        {editing === channel.id ? "Close" : "Edit lineup"}
                      </Button>
                      <Link href={`/channels/${channel.id}/watch`}>
                        <Button size="sm" className="rounded-full" disabled={lineupCount(channel) === 0}>
                          <Play data-icon="inline-start" className="fill-current" />
                          Watch
                        </Button>
                      </Link>
                      <Button size="sm" variant="destructive" className="rounded-full" onClick={() => deleteChannel(channel.id)}>
                        <Trash2 data-icon="inline-start" />
                        Delete
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {channel.entries.map((entry) => (
                      <span key={entry.id} className="rounded-full bg-black/5 px-2 py-1 text-xs dark:bg-white/10">
                        {entry.label}
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      className="rounded-full"
                      variant={channel.kind === "shuffle" ? "default" : "outline"}
                      onClick={() => persist(upsertChannel(channels, { ...channel, kind: "shuffle" }))}
                    >
                      Shuffle
                    </Button>
                    <Button
                      size="sm"
                      className="rounded-full"
                      variant={channel.kind === "queue" ? "default" : "outline"}
                      onClick={() => persist(upsertChannel(channels, { ...channel, kind: "queue" }))}
                    >
                      Queue
                    </Button>
                    <Button
                      size="sm"
                      className="rounded-full"
                      variant={channel.alwaysOn ? "default" : "outline"}
                      onClick={() => persist(upsertChannel(channels, { ...channel, alwaysOn: true }))}
                    >
                      24/7
                    </Button>
                    <Button
                      size="sm"
                      className="rounded-full"
                      variant={!channel.alwaysOn ? "default" : "outline"}
                      onClick={() => persist(upsertChannel(channels, { ...channel, alwaysOn: false }))}
                    >
                      Timed
                    </Button>
                    {!channel.alwaysOn && (
                      <Input
                        className="h-8 w-24"
                        type="number"
                        min={0.5}
                        step={0.5}
                        value={channel.hours}
                        onChange={(event) => persist(upsertChannel(channels, { ...channel, hours: Number(event.target.value) || 1 }))}
                      />
                    )}
                  </div>
                </article>
              ))}
            </div>
          </>
        )}

        {active && (
          <div className="mt-8 w-full">
            {!ready && (
              <div className="page-gutter">
                <NarwhalSpinner label="Loading your library…" />
              </div>
            )}
            <ChannelBuilder
              channel={active}
              catalog={catalog}
              userId={session?.userId}
              onChange={(next) => persist(upsertChannel(channels, next))}
            />
          </div>
        )}
      </div>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-lg" showCloseButton>
          <DialogHeader>
            <DialogTitle>Add new channel</DialogTitle>
            <DialogDescription>Name it, pick movies or TV, then choose shuffle or a queue.</DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              create();
            }}
          >
            <Label htmlFor="channel-name">Name</Label>
            <Input
              id="channel-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="90s comfort, Kids morning…"
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" className="rounded-full" variant={scope === "both" ? "default" : "outline"} onClick={() => setScope("both")}>
                Movies + TV
              </Button>
              <Button type="button" size="sm" className="rounded-full" variant={scope === "movies" ? "default" : "outline"} onClick={() => setScope("movies")}>
                Movies
              </Button>
              <Button type="button" size="sm" className="rounded-full" variant={scope === "shows" ? "default" : "outline"} onClick={() => setScope("shows")}>
                TV shows
              </Button>
              <Button type="button" size="sm" className="rounded-full" variant={kind === "shuffle" ? "default" : "outline"} onClick={() => setKind("shuffle")}>
                Shuffle
              </Button>
              <Button type="button" size="sm" className="rounded-full" variant={kind === "queue" ? "default" : "outline"} onClick={() => setKind("queue")}>
                Scheduled queue
              </Button>
              <Button type="button" size="sm" className="rounded-full" variant={alwaysOn ? "default" : "outline"} onClick={() => setAlwaysOn(true)}>
                24/7
              </Button>
              <Button type="button" size="sm" className="rounded-full" variant={!alwaysOn ? "default" : "outline"} onClick={() => setAlwaysOn(false)}>
                Timed block
              </Button>
            </div>
            {!alwaysOn && (
              <label className="text-sm text-zinc-600 dark:text-zinc-300">
                Hours
                <Input
                  className="mt-1"
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={hours}
                  onChange={(event) => setHours(Number(event.target.value) || 1)}
                />
              </label>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreating(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!name.trim()}>
                Create channel
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
