"use client";

import { usePathname } from "next/navigation";
import { NarwhalMark } from "@/components/narwhal-mark";

function subtitleForPath(pathname: string) {
  if (pathname.startsWith("/movies") || pathname.startsWith("/movie/")) return "Movies";
  if (pathname.startsWith("/shows") || pathname.startsWith("/show/")) return "TV Shows";
  if (pathname.startsWith("/channels")) return "Channels";
  if (pathname.startsWith("/seerr") || pathname.startsWith("/discover")) return "Discover";
  if (pathname.startsWith("/search")) return "Search";
  if (pathname.startsWith("/downloads")) return "Downloads";
  return "Movies & TV";
}

export function HomeBrandHeader() {
  const pathname = usePathname();
  const subtitle = subtitleForPath(pathname);

  return (
    <header className="home-brand flex items-end justify-between gap-4 pt-6 pb-3 md:pt-8">
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <div className="glass-edge flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 sm:size-14">
          <NarwhalMark className="size-9 sm:size-10" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.32em] text-[#AA5CC3] uppercase sm:text-[11px]">
            {subtitle}
          </p>
          <h1 className="bg-gradient-to-r from-[#00A4DC] via-[#7dd3fc] to-[#AA5CC3] bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl lg:text-[2.75rem]">
            Narwhal
          </h1>
        </div>
      </div>
    </header>
  );
}
