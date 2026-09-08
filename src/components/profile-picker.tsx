"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { NarwhalMark } from "@/components/narwhal-mark";
import { useProfiles } from "@/components/profile-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ProfilePicker() {
  const { profiles, selectProfile, addProfile } = useProfiles();
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);

  return (
    <div className="tv-root flex min-h-full flex-col items-center justify-center px-6 py-16">
      <NarwhalMark className="size-16" />
      <h1 className="mt-6 text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Who&apos;s watching?
      </h1>
      <p className="mt-2 text-sm text-zinc-500">Each profile keeps its own progress, list, and favorites.</p>
      <div className="mt-10 flex flex-wrap justify-center gap-6">
        {profiles.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => selectProfile(row.id)}
            className="group flex w-28 flex-col items-center gap-3"
          >
            <span
              className="flex size-24 items-center justify-center rounded-2xl text-3xl font-semibold text-white shadow-lg ring-2 ring-transparent transition group-hover:ring-zinc-900 dark:group-hover:ring-white"
              style={{ background: row.color }}
            >
              {row.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{row.name}</span>
          </button>
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
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Profile name"
            className="h-11"
            autoFocus
          />
          <Button type="submit" className="h-11 rounded-full px-5">
            Save
          </Button>
        </form>
      )}
    </div>
  );
}
