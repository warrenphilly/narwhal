"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NarwhalMark } from "@/components/narwhal-mark";
import { PageRefreshButton } from "@/components/page-refresh";

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
    <header className="home-brand flex items-end justify-between gap-3 pt-4 pb-2 sm:gap-4 md:pt-8 md:pb-3">
      <Link
        href="/"
        aria-label="Home"
        className="flex min-w-0 items-center gap-2.5 rounded-2xl outline-none transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-[#AA5CC3]/50 sm:gap-4"
      >
        <span className="glass-edge flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/20 sm:size-14 sm:rounded-2xl">
          <NarwhalMark className="size-7 sm:size-10" />
        </span>
        <span className="min-w-0">
          <span className="block text-[9px] font-semibold tracking-[0.32em] text-[#AA5CC3] uppercase sm:text-[11px]">
            {subtitle}
          </span>
          <span className="block bg-gradient-to-r from-[#00A4DC] via-[#7dd3fc] to-[#AA5CC3] bg-clip-text text-2xl font-bold tracking-tight text-transparent sm:text-4xl lg:text-[2.75rem]">
            Narwhal
          </span>
        </span>
      </Link>
      <PageRefreshButton className="shrink-0" />
    </header>
  );
}
