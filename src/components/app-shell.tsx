"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useRef } from "react";
import { Compass, Download, Film, Home, LogIn, LogOut, Moon, Radio, Search, Settings, Sun, Tv } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { useDownloads } from "@/components/downloads-provider";
import { useProfiles } from "@/components/profile-provider";
import { useSettings } from "@/components/app-settings";
import { ProfilePicker } from "@/components/profile-picker";
import { HomeBrandHeader } from "@/components/home-brand-header";
import { NarwhalMark } from "@/components/narwhal-mark";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function navLinks(): { href: string; label: string; icon: LucideIcon; active: (path: string) => boolean }[] {
  return [
    { href: "/", label: "Home", icon: Home, active: (path: string) => path === "/" },
    { href: "/movies", label: "Movies", icon: Film, active: (path: string) => path === "/movies" },
    { href: "/shows", label: "TV Shows", icon: Tv, active: (path: string) => path === "/shows" },
    { href: "/seerr", label: "Discover", icon: Compass, active: (path: string) => path.startsWith("/seerr") || path.startsWith("/discover") },
    { href: "/channels", label: "Channels", icon: Radio, active: (path: string) => path.startsWith("/channels") },
  ];
}

function railItemClass(active?: boolean) {
  return cn(
    "flex w-full min-h-[2.75rem] items-center justify-center gap-0 rounded-2xl px-0 py-0 text-sm text-zinc-700 transition",
    "hover:bg-white/25 hover:text-zinc-950 group-hover:justify-start group-hover:gap-3 group-hover:px-2.5 group-hover:py-0.5",
    "dark:text-zinc-200 dark:hover:bg-white/10 dark:hover:text-white",
    active &&
      "bg-gradient-to-br from-[#00A4DC]/35 via-white/50 to-[#AA5CC3]/35 text-zinc-950 shadow-[inset_0_0_0_2px_rgba(170,92,195,0.55)] dark:from-[#00A4DC]/30 dark:via-white/12 dark:to-[#AA5CC3]/30 dark:text-white"
  );
}

function dockItemClass(active?: boolean) {
  return cn(
    "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-center text-[10px] font-normal text-zinc-500 transition active:scale-[0.97]",
    active &&
      "rounded-xl bg-gradient-to-br from-[#00A4DC]/30 to-[#AA5CC3]/30 text-zinc-950 shadow-[inset_0_0_0_1.5px_rgba(170,92,195,0.5)] dark:text-white"
  );
}

function RailIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center [&>svg]:size-5 [&>svg]:shrink-0 [&>svg]:stroke-[1.75]">
      {children}
    </span>
  );
}

function DockIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex size-6 items-center justify-center [&>svg]:size-[1.125rem] [&>svg]:shrink-0 [&>svg]:stroke-[1.75]">
      {children}
    </span>
  );
}

function RailLabel({ children }: { children: React.ReactNode }) {
  return <span className="hidden whitespace-nowrap group-hover:inline">{children}</span>;
}

function NavItems({
  className,
  itemClass,
  showIcons = false,
  dock = false,
}: {
  className?: string;
  itemClass: (active: boolean) => string;
  showIcons?: boolean;
  dock?: boolean;
}) {
  const pathname = usePathname();
  const IconWrap = dock ? DockIcon : RailIcon;
  return (
    <nav className={className}>
      {navLinks().map((link) => {
        const Icon = link.icon;
        const active = link.active(pathname);
        return (
          <Link key={link.label} href={link.href} className={itemClass(active)} aria-label={showIcons ? link.label : undefined}>
            {showIcons ? (
              <IconWrap>
                <Icon />
              </IconWrap>
            ) : null}
            {showIcons ? dock ? <span>{link.label}</span> : <RailLabel>{link.label}</RailLabel> : <span>{link.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

function ShellActions({ compact }: { compact?: boolean }) {
  const router = useRouter();
  const { session, signOut } = useSession();
  const { profile, setPicking } = useProfiles();
  const { theme, toggle } = useTheme();
  const { downloads } = useDownloads();
  const { openSettings } = useSettings();
  const active = downloads.filter((item) => item.status === "saving").length;

  return (
    <div className={cn("flex gap-1", compact ? "flex-row items-center" : "w-full flex-col items-stretch")}>
      {compact ? (
        <>
          <Button variant="ghost" size="icon" onClick={() => openSettings()} aria-label="Settings">
            <Settings />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun /> : <Moon />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => router.push("/search")} aria-label="Search">
            <Search />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={() => router.push("/downloads")}
            aria-label="Downloads"
          >
            <Download />
            {active > 0 && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-sky-500" />}
          </Button>
        </>
      ) : (
        <>
          <button type="button" className={railItemClass()} onClick={() => openSettings()}>
            <RailIcon>
              <Settings />
            </RailIcon>
            <RailLabel>Settings</RailLabel>
          </button>
          <button type="button" className={railItemClass()} onClick={toggle}>
            <RailIcon>{theme === "dark" ? <Sun /> : <Moon />}</RailIcon>
            <RailLabel>{theme === "dark" ? "Light mode" : "Dark mode"}</RailLabel>
          </button>
          <button type="button" className={railItemClass()} onClick={() => router.push("/search")}>
            <RailIcon>
              <Search />
            </RailIcon>
            <RailLabel>Search</RailLabel>
          </button>
          <button type="button" className={cn(railItemClass(), "relative")} onClick={() => router.push("/downloads")}>
            <RailIcon>
              <Download />
            </RailIcon>
            <RailLabel>Downloads</RailLabel>
            {active > 0 && <span className="absolute top-2 right-2 size-2 rounded-full bg-sky-500 group-hover:top-2.5 group-hover:right-auto group-hover:left-[2.15rem]" />}
          </button>
        </>
      )}
      {session?.signedIn ? (
        <div className={cn("flex items-start gap-1", compact ? "flex-row pl-1" : "mt-1 w-full flex-col")}>
          {profile && (
            <button
              type="button"
              className={compact ? "flex items-center gap-2 rounded-2xl px-1.5 py-1 hover:bg-black/5 dark:hover:bg-white/10" : railItemClass()}
              onClick={() => setPicking(true)}
            >
              <RailIcon>
                <span
                  className="flex size-7 items-center justify-center rounded-lg text-xs font-semibold text-white"
                  style={{ background: profile.color }}
                >
                  {profile.name.slice(0, 1).toUpperCase()}
                </span>
              </RailIcon>
              {!compact && <RailLabel>{profile.name}</RailLabel>}
            </button>
          )}
          {compact ? (
            <Button variant="ghost" size="icon" onClick={() => signOut()} aria-label="Sign out">
              <LogOut />
            </Button>
          ) : (
            <button type="button" className={railItemClass()} onClick={() => signOut()}>
              <RailIcon>
                <LogOut />
              </RailIcon>
              <RailLabel>Sign out</RailLabel>
            </button>
          )}
        </div>
      ) : compact ? (
        <Button variant="ghost" size="sm" onClick={() => signOut()}>
          Sign in
        </Button>
      ) : (
        <button type="button" className={railItemClass()} onClick={() => signOut()}>
          <RailIcon>
            <LogIn />
          </RailIcon>
          <RailLabel>Sign in</RailLabel>
        </button>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { session } = useSession();
  const { picking } = useProfiles();
  const navRef = useRef<HTMLElement>(null);

  function collapseNav() {
    const nav = navRef.current;
    if (!nav) return;
    const focused = nav.querySelector<HTMLElement>(":focus");
    focused?.blur();
  }

  if (session?.signedIn && picking) {
    return <ProfilePicker />;
  }

  return (
    <div className="tv-root shell-frame">
      <header className="mobile-topbar glass-panel fixed inset-x-3 z-40 flex h-14 items-center gap-2 rounded-2xl px-2 md:hidden">
        <Link href="/" className="flex shrink-0 items-center text-zinc-900 dark:text-zinc-50">
          <NarwhalMark className="size-7" />
        </Link>
        <div className="ml-auto min-w-0 overflow-x-auto touch-pan-x">
          <ShellActions compact />
        </div>
      </header>

      <aside
        ref={navRef}
        className="shell-nav group glass-panel hidden flex-col overflow-hidden p-2 md:flex"
        onMouseLeave={collapseNav}
      >
        <Link
          href="/"
          className="flex min-h-[2.75rem] items-center justify-center gap-0 rounded-2xl px-0 py-0 text-zinc-900 group-hover:justify-start group-hover:gap-2 group-hover:px-2 group-hover:py-1 dark:text-zinc-50"
        >
          <span className="flex size-10 shrink-0 items-center justify-center">
            <NarwhalMark className="size-8" />
          </span>
          <span className="hidden whitespace-nowrap text-[15px] font-semibold tracking-tight group-hover:inline">Narwhal</span>
        </Link>
        <Suspense
          fallback={
            <nav className="mt-3 flex flex-col gap-1">
              <span className="rounded-2xl px-3 py-2.5 text-sm text-zinc-500">Movies</span>
            </nav>
          }
        >
          <NavItems
            showIcons
            className="mt-3 flex flex-col gap-1"
            itemClass={(isActive) => railItemClass(isActive)}
          />
        </Suspense>
        <div className="mt-auto flex w-full flex-col items-stretch gap-1">
          <ShellActions />
        </div>
      </aside>

      <main className="shell-main">
        <div className="page-gutter">
          <HomeBrandHeader />
        </div>
        {children}
      </main>

      <Suspense fallback={<nav className="fixed inset-x-0 bottom-0 z-40 md:hidden" />}>
        <NavItems
          showIcons
          dock
          className="mobile-dock glass-panel fixed inset-x-3 bottom-3 z-40 flex rounded-2xl md:hidden"
          itemClass={(isActive) => dockItemClass(isActive)}
        />
      </Suspense>
    </div>
  );
}
