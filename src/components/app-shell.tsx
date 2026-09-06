"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Download, LogOut, Search, Tv } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { useDownloads } from "@/components/downloads-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Watch Now" },
  { href: "/movies", label: "Movies" },
  { href: "/downloads", label: "Downloads" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, signOut } = useSession();
  const { downloads } = useDownloads();
  const active = downloads.filter((item) => item.status === "saving").length;

  return (
    <div className="tv-root flex min-h-full flex-col">
      <header className="sticky top-0 z-40 border-b border-black/5 bg-white/80 backdrop-blur-xl">
        <div className="page-gutter mx-auto flex h-16 items-center gap-6">
          <Link href="/" className="flex items-center gap-2 text-zinc-900">
            <span className="flex size-8 items-center justify-center rounded-full bg-zinc-900 text-white">
              <Tv className="size-4" />
            </span>
            <span className="text-[15px] font-semibold tracking-tight">Cinema</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm text-zinc-500 transition hover:text-zinc-900",
                  pathname === link.href && "bg-zinc-900/5 text-zinc-900"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/search")}
              aria-label="Search"
            >
              <Search />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="relative md:hidden"
              onClick={() => router.push("/downloads")}
              aria-label="Downloads"
            >
              <Download />
              {active > 0 && (
                <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-sky-500" />
              )}
            </Button>
            {session?.signedIn ? (
              <div className="hidden items-center gap-3 pl-2 text-sm text-zinc-500 sm:flex">
                <span className="max-w-[180px] truncate">{session.userName}</span>
                <Button variant="ghost" size="sm" onClick={() => signOut()}>
                  <LogOut data-icon="inline-start" />
                  Sign out
                </Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => signOut()}>
                Sign in
              </Button>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-black/10 bg-white/90 backdrop-blur-xl md:hidden">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex-1 py-3 text-center text-xs text-zinc-500",
              pathname === link.href && "text-zinc-900"
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
