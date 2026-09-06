"use client";

import Link from "next/link";
import { homeHref, type MediaTab } from "@/lib/media-tab";
import { cn } from "@/lib/utils";

export function MediaPills({ value }: { value: MediaTab }) {
  return (
    <div className="inline-flex rounded-full bg-black/8 p-1 backdrop-blur-md dark:bg-white/12">
      {(
        [
          ["movies", "Movies"],
          ["shows", "TV Shows"],
        ] as const
      ).map(([id, label]) => (
        <Link
          key={id}
          href={homeHref(id)}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition",
            value === id
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "text-zinc-700 hover:text-zinc-900 dark:text-zinc-200 dark:hover:text-white"
          )}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}
