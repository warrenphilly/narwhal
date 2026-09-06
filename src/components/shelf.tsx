"use client";

import { PosterCard } from "@/components/poster-card";
import type { JellyfinItem } from "@/lib/jellyfin-types";

export function Shelf({
  title,
  items,
}: {
  title: string;
  items: JellyfinItem[];
}) {
  if (!items.length) return null;
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight text-zinc-900">{title}</h2>
      <div className="shelf-scroll -mx-1 flex gap-4 overflow-x-auto pb-4 pt-2">
        {items.map((item) => (
          <PosterCard key={item.Id} item={item} />
        ))}
      </div>
    </section>
  );
}
