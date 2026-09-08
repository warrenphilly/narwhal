"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createChannel,
  hasEntry,
  loadChannels,
  saveChannels,
  toggleEntry,
  type Channel,
  type ChannelEntryType,
} from "@/lib/channels";
import { cn } from "@/lib/utils";

export function ChannelAdd({
  itemId,
  userId,
  name,
  type,
  className,
}: {
  itemId: string;
  userId?: string;
  name: string;
  type: ChannelEntryType;
  className?: string;
}) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [nextName, setNextName] = useState("");

  useEffect(() => {
    if (!userId) return;
    setChannels(loadChannels(userId));
  }, [userId]);

  if (!userId) return null;

  function persist(next: Channel[]) {
    setChannels(next);
    saveChannels(userId!, next);
  }

  const label = type === "series" ? `${name} (whole show)` : name;

  return (
    <div className={cn("relative z-20 rounded-2xl border border-black/8 bg-white/80 p-3 dark:border-white/10 dark:bg-black/50", className)}>
      <Label className="text-xs tracking-wide text-zinc-500 uppercase">Channels</Label>
      <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-200">
        Add this {type === "series" ? "whole show" : "title"} to a channel. Fine-tune seasons and episodes on the Channels page.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {channels.map((channel) => {
          const on = hasEntry(channel, type, itemId);
          return (
            <Button
              key={channel.id}
              type="button"
              size="sm"
              variant={on ? "default" : "outline"}
              className="rounded-full"
              onClick={() =>
                persist(channels.map((row) => (row.id === channel.id ? toggleEntry(row, { type, itemId, label }) : row)))
              }
            >
              {on ? `On ${channel.name}` : channel.name}
            </Button>
          );
        })}
      </div>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!nextName.trim()) return;
          persist([
            ...channels,
            createChannel({
              name: nextName.trim(),
              kind: "shuffle",
              scope: type === "movie" ? "movies" : "shows",
              alwaysOn: true,
              hours: 24,
              entries: [{ id: crypto.randomUUID(), type, itemId, label }],
            }),
          ]);
          setNextName("");
        }}
      >
        <Input value={nextName} onChange={(event) => setNextName(event.target.value)} placeholder="New channel" />
        <Button type="submit" size="sm" className="rounded-full" disabled={!nextName.trim()}>
          Create
        </Button>
      </form>
    </div>
  );
}
