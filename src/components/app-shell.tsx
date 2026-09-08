"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Download, LogOut, Moon, Search, Sun } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { useDownloads } from "@/components/downloads-provider";
import { useProfiles } from "@/components/profile-provider";
import { ProfilePicker } from "@/components/profile-picker";
import { NarwhalMark } from "@/components/narwhal-mark";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { homeHref, lastTab } from "@/lib/media-tab";
import { cn } from "@/lib/utils";

function navLinks() {
  return [
    { href: homeHref(lastTab()), label: "Watch Now", active: (path: string) => path === "/" },
    { href: "/movies", label: "Movies", active: (path: string) => path === "/movies" },
    { href: "/shows", label: "TV Shows", active: (path: string) => path === "/shows" },
    { href: "/downloads", label: "Downloads", active: (path: string) => path === "/downloads" },
  ];
}

function NavItems({ className, itemClass }: { className?: string; itemClass: (active: boolean) => string }) {
  const pathname = usePathname();
  return (
    <nav className={className}>
      {navLinks().map((link) => (
        <Link key={link.label} href={link.href} className={itemClass(link.active(pathname))}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

function ScrollHeader({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (y < 24) {
        setHidden(false);
      } else if (y > last + 6) {
        setHidden(true);
      } else if (y < last - 6) {
        setHidden(false);
      }
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 border-b border-black/8 bg-[var(--page-bg)]/95 backdrop-blur-md transition-transform duration-200 dark:border-white/10",
        hidden ? "-translate-y-full" : "translate-y-0"
      )}
    >
      {children}
    </header>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, signOut } = useSession();
  const { profile, picking, setPicking } = useProfiles();
  const { theme, toggle } = useTheme();
  const { downloads } = useDownloads();
  const active = downloads.filter((item) => item.status === "saving").length;

  if (session?.signedIn && picking) {
    return <ProfilePicker />;
  }

  return (
    <div className="tv-root flex min-h-full flex-col">
      <ScrollHeader key={pathname}>
        <div className="page-gutter mx-auto flex h-14 items-center gap-2 sm:h-16 sm:gap-4">
          <Link href={homeHref(lastTab())} className="flex shrink-0 items-center gap-2 text-zinc-900 dark:text-zinc-50">
            <NarwhalMark className="size-7 sm:size-8" />
            <span className="hidden text-[15px] font-semibold tracking-tight sm:inline">Narwhal</span>
          </Link>
          <Suspense
            fallback={
              <nav className="hidden items-center gap-1 md:flex">
                <span className="rounded-full px-3 py-1.5 text-sm text-zinc-500">Watch Now</span>
              </nav>
            }
          >
            <NavItems
              className="hidden items-center gap-1 md:flex"
              itemClass={(isActive) =>
                cn(
                  "rounded-full px-3 py-1.5 text-sm text-zinc-600 transition hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-zinc-50",
                  isActive && "bg-black/6 text-zinc-950 dark:bg-white/12 dark:text-zinc-50"
                )
              }
            />
          </Suspense>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun /> : <Moon />}
            </Button>
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
              <div className="hidden items-center gap-3 pl-2 text-sm text-zinc-500 sm:flex dark:text-zinc-400">
                {profile && (
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-full px-2 py-1 hover:bg-black/5 dark:hover:bg-white/10"
                    onClick={() => setPicking(true)}
                  >
                    <span
                      className="flex size-7 items-center justify-center rounded-lg text-xs font-semibold text-white"
                      style={{ background: profile.color }}
                    >
                      {profile.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="max-w-[120px] truncate">{profile.name}</span>
                  </button>
                )}
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
      </ScrollHeader>
      <main className="min-w-0 flex-1 pt-14 pb-24 sm:pt-16 md:pb-8">{children}</main>
      <Suspense fallback={<nav className="fixed inset-x-0 bottom-0 z-40 md:hidden" />}>
        <NavItems
          className="fixed inset-x-0 bottom-0 z-40 flex border-t border-black/10 bg-[var(--page-bg)]/90 backdrop-blur-xl md:hidden dark:border-white/10"
          itemClass={(isActive) =>
            cn(
              "flex-1 py-3 text-center text-xs text-zinc-500",
              isActive && "text-zinc-900 dark:text-zinc-50"
            )
          }
        />
      </Suspense>
    </div>
  );
}
