"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { ConnectionForm } from "@/components/connection-form";
import { NarwhalMark } from "@/components/narwhal-mark";
import { useProfiles, type ViewingProfile } from "@/components/profile-provider";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const COLORS = ["#AA5CC3", "#00A4DC", "#F59E0B", "#FB7185", "#34D399", "#818CF8", "#F472B6", "#22D3EE"];
const EMOJIS = ["🐋", "🎬", "🍿", "🌙", "🚀", "🎧", "🦊", "👾", "⭐", "🌊"];

export function ProfilePicker() {
  const { session } = useSession();
  const { profiles, selectProfile, addProfile, updateProfile, removeProfile } = useProfiles();
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ViewingProfile | null>(null);

  return (
    <div className="tv-root flex min-h-full flex-col items-center px-6 py-16">
      <Link href="/" aria-label="Home">
        <NarwhalMark className="size-16" />
      </Link>
      <h1 className="mt-6 text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Who&apos;s watching?
      </h1>
      <p className="mt-2 text-sm text-zinc-500">Each profile keeps its own progress, list, and favorites.</p>
      <div className="mt-10 flex flex-wrap justify-center gap-6">
        {profiles.map((row) => (
          <div key={row.id} className="flex w-28 flex-col items-center gap-2">
            <button type="button" onClick={() => selectProfile(row.id)} className="group flex flex-col items-center gap-3">
              <span
                className="flex size-24 items-center justify-center rounded-2xl text-4xl shadow-lg ring-2 ring-transparent transition group-hover:ring-zinc-900 dark:group-hover:ring-white"
                style={{ background: row.color }}
              >
                {row.emoji || row.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{row.name}</span>
            </button>
            <button
              type="button"
              className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              onClick={() => setEditing(row)}
            >
              <Pencil className="mr-1 inline size-3" />
              Edit
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex w-28 flex-col items-center gap-3 text-zinc-500"
        >
          <span className="flex size-24 items-center justify-center rounded-2xl border border-dashed border-zinc-300 dark:border-white/20">
            <Plus className="size-8" />
          </span>
          <span className="text-sm">Add profile</span>
        </button>
      </div>

      {adding && (
        <form
          className="mt-10 flex w-full max-w-sm gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            addProfile(name);
            setName("");
            setAdding(false);
          }}
        >
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Profile name" className="h-11" autoFocus />
          <Button type="submit" className="h-11 rounded-full px-5">
            Save
          </Button>
        </form>
      )}

      {editing && (
        <div className="glass-card glass-edge mt-10 w-full max-w-md rounded-3xl p-6">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Customize {editing.name}</p>
          <label className="mt-4 block text-xs text-zinc-500">Name</label>
          <Input
            value={editing.name}
            onChange={(event) => setEditing({ ...editing, name: event.target.value })}
            className="mt-1 h-11"
          />
          <p className="mt-4 text-xs text-zinc-500">Icon</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className={cn(
                  "flex size-10 items-center justify-center rounded-xl text-xl",
                  editing.emoji === emoji ? "ring-2 ring-zinc-900 dark:ring-white" : "glass-chip"
                )}
                onClick={() => setEditing({ ...editing, emoji })}
              >
                {emoji}
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs text-zinc-500">Color</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className="size-8 rounded-full"
                style={{ background: color, outline: editing.color === color ? "2px solid currentColor" : undefined }}
                onClick={() => setEditing({ ...editing, color })}
              />
            ))}
          </div>
          <div className="mt-6 flex gap-2">
            <Button
              className="h-10 flex-1 rounded-full"
              onClick={() => {
                updateProfile(editing.id, { name: editing.name, color: editing.color, emoji: editing.emoji });
                setEditing(null);
              }}
            >
              Save profile
            </Button>
            {profiles.length > 1 && (
              <Button
                variant="ghost"
                className="h-10 rounded-full text-red-600"
                onClick={() => {
                  removeProfile(editing.id);
                  setEditing(null);
                }}
              >
                <Trash2 />
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="mt-16 w-full max-w-md border-t border-zinc-200 pt-8 dark:border-white/10">
        <p className="text-center text-sm font-semibold text-zinc-900 dark:text-zinc-50">Server</p>
        <p className="mt-1 text-center text-xs text-zinc-500">
          Signed into {session?.serverUrl || "Jellyfin"}. Switch between home Wi‑Fi and Tailscale.
        </p>
        <div className="mx-auto mt-5">
          <ConnectionForm compact />
        </div>
      </div>
    </div>
  );
}
