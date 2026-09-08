"use client";

import { heroImage } from "@/lib/client-api";
import type { JellyfinItem } from "@/lib/jellyfin-types";
import { cn } from "@/lib/utils";

export function HeroArt({
  item,
  gradient,
  className,
}: {
  item?: JellyfinItem | null;
  gradient?: [string, string];
  className?: string;
}) {
  const art = item ? heroImage(item) : null;
  const [from, to] = gradient ?? ["#18181b", "#09090b"];

  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden bg-zinc-950", className)}>
      <div
        className="absolute inset-0"
        style={{ backgroundImage: `linear-gradient(135deg, ${from}, ${to})` }}
      />
      {art && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={art.url}
          alt=""
          className={cn(
            "absolute inset-0 size-full",
            art.fit === "cover" ? "object-cover object-[center_28%]" : "object-contain object-right"
          )}
        />
      )}
    </div>
  );
}
