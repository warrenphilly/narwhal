"use client";

import { cn } from "@/lib/utils";

export type MediaTab = "movies" | "shows";

export function MediaPills({
  value,
  onChange,
}: {
  value: MediaTab;
  onChange: (tab: MediaTab) => void;
}) {
  return (
    <div className="inline-flex rounded-full bg-black/8 p-1 backdrop-blur-md">
      {(
        [
          ["movies", "Movies"],
          ["shows", "TV Shows"],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition",
            value === id ? "bg-zinc-900 text-white" : "text-zinc-700 hover:text-zinc-900"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
