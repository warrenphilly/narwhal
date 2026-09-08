"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import {
  Compass,
  Download,
  Film,
  Home,
  LogIn,
  LogOut,
  Menu,
  Moon,
  Radio,
  Search,
  Settings,
  Sun,
  Tv,
  X,
} from "lucide-react";
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

function menuItemClass(active?: boolean) {
  return cn(
    "flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-[15px] text-zinc-700 transition active:scale-[0.99]",
    "hover:bg-white/25 dark:text-zinc-200 dark:hover:bg-white/10",
    active &&
      "bg-gradient-to-br from-[#00A4DC]/30 to-[#AA5CC3]/30 font-medium text-zinc-950 shadow-[inset_0_0_0_1.5px_rgba(170,92,195,0.45)] dark:text-white"
  );
}

function RailIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center [&>svg]:size-5 [&>svg]:shrink-0 [&>svg]:stroke-[1.75]">
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
  onNavigate,
}: {
  className?: string;
  itemClass: (active: boolean) => string;
  showIcons?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <nav className={className}>
      {navLinks().map((link) => {
        const Icon = link.icon;
        const active = link.active(pathname);
        return (
          <Link
            key={link.label}
            href={link.href}
            className={itemClass(active)}
            aria-label={showIcons ? link.label : undefined}
            onClick={() => onNavigate?.()}
          >
            {showIcons ? (
              <RailIcon>
                <Icon />
              </RailIcon>
            ) : null}
            {showIcons ? <RailLabel>{link.label}</RailLabel> : <span>{link.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

function ShellActions({
  compact,
  drawer,
  onNavigate,
}: {
  compact?: boolean;
  drawer?: boolean;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const { session, signOut } = useSession();
  const { profile, setPicking } = useProfiles();
  const { theme, toggle } = useTheme();
  const { downloads } = useDownloads();
  const { openSettings } = useSettings();
  const active = downloads.filter((item) => item.status === "saving").length;

  if (drawer) {
    return (
      <div className="flex w-full flex-col gap-1">
        <button
          type="button"
          className={menuItemClass()}
          onClick={() => {
            openSettings();
            onNavigate?.();
          }}
        >
          <Settings className="size-5 shrink-0" />
          Settings
        </button>
        <button type="button" className={menuItemClass()} onClick={toggle}>
          {theme === "dark" ? <Sun className="size-5 shrink-0" /> : <Moon className="size-5 shrink-0" />}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
        <button
          type="button"
          className={menuItemClass()}
          onClick={() => {
            router.push("/search");
            onNavigate?.();
          }}
        >
          <Search className="size-5 shrink-0" />
          Search
        </button>
        <button
          type="button"
          className={cn(menuItemClass(), "relative")}
          onClick={() => {
            router.push("/downloads");
            onNavigate?.();
          }}
        >
          <Download className="size-5 shrink-0" />
          Downloads
          {active > 0 && <span className="ml-auto size-2 rounded-full bg-sky-500" />}
        </button>
        {session?.signedIn ? (
          <>
            {profile && (
              <button
                type="button"
                className={menuItemClass()}
                onClick={() => {
                  setPicking(true);
                  onNavigate?.();
                }}
              >
                <span
                  className="flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold text-white"
                  style={{ background: profile.color }}
                >
                  {profile.name.slice(0, 1).toUpperCase()}
                </span>
                {profile.name}
              </button>
            )}
            <button
              type="button"
              className={menuItemClass()}
              onClick={() => {
                signOut();
                onNavigate?.();
              }}
            >
              <LogOut className="size-5 shrink-0" />
              Sign out
            </button>
          </>
        ) : (
          <button
            type="button"
            className={menuItemClass()}
            onClick={() => {
              signOut();
              onNavigate?.();
            }}
          >
            <LogIn className="size-5 shrink-0" />
            Sign in
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex gap-1", compact ? "flex-row items-center" : "w-full flex-col items-stretch")}>
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
      {session?.signedIn ? (
        <div className="mt-1 flex w-full flex-col">
          {profile && (
            <button type="button" className={railItemClass()} onClick={() => setPicking(true)}>
              <RailIcon>
                <span
                  className="flex size-7 items-center justify-center rounded-lg text-xs font-semibold text-white"
                  style={{ background: profile.color }}
                >
                  {profile.name.slice(0, 1).toUpperCase()}
                </span>
              </RailIcon>
              <RailLabel>{profile.name}</RailLabel>
            </button>
          )}
          <button type="button" className={railItemClass()} onClick={() => signOut()}>
            <RailIcon>
              <LogOut />
            </RailIcon>
            <RailLabel>Sign out</RailLabel>
          </button>
        </div>
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

function MobileMenu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    setOpen(false);
    setHidden(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    lastY.current = window.scrollY;
    function onScroll() {
      if (open) {
        setHidden(false);
        return;
      }
      const y = Math.max(0, window.scrollY);
      const delta = y - lastY.current;
      if (y < 16) {
        setHidden(false);
      } else if (delta > 8) {
        setHidden(true);
      } else if (delta < -8) {
        setHidden(false);
      }
      lastY.current = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [open]);

  return (
    <>
      <div
        className={cn("mobile-topbar-wrap fixed z-40 lg:hidden", (hidden && !open) && "is-hidden")}
      >
        <header className="mobile-topbar glass-panel flex h-11 w-full items-center gap-1.5 rounded-2xl px-1.5">
          <Button
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 rounded-xl"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
          <Link
            href="/"
            className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden text-zinc-900 dark:text-zinc-50"
            onClick={() => setOpen(false)}
          >
            <NarwhalMark className="size-5 shrink-0" />
            <span className="truncate text-sm font-semibold tracking-tight">Narwhal</span>
          </Link>
        </header>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/45"
            onClick={() => setOpen(false)}
          />
          <div className="mobile-drawer glass-panel absolute top-[calc(0.5rem+2.75rem+env(safe-area-inset-top,0px))] bottom-[max(0.5rem,env(safe-area-inset-bottom,0px))] flex max-h-[calc(100dvh-3.75rem)] flex-col overflow-hidden rounded-3xl p-2 sm:p-3">
            <Suspense fallback={<p className="p-3 text-sm text-muted">Loading…</p>}>
              <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain">
                {navLinks().map((link) => {
                  const Icon = link.icon;
                  const active = link.active(pathname);
                  return (
                    <Link
                      key={link.label}
                      href={link.href}
                      className={menuItemClass(active)}
                      onClick={() => setOpen(false)}
                    >
                      <Icon className="size-5 shrink-0" />
                      {link.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="mt-2 shrink-0 border-t border-black/8 pt-2 dark:border-white/10">
                <ShellActions drawer onNavigate={() => setOpen(false)} />
              </div>
            </Suspense>
          </div>
        </div>
      )}
    </>
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
      <aside
        ref={navRef}
        className="shell-nav group glass-panel hidden flex-col overflow-hidden p-2 lg:flex"
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
          <NavItems showIcons className="mt-3 flex flex-col gap-1" itemClass={(isActive) => railItemClass(isActive)} />
        </Suspense>
        <div className="mt-auto flex w-full flex-col items-stretch gap-1">
          <ShellActions />
        </div>
      </aside>

      <main className="shell-main">
        <MobileMenu />
        <div className="page-gutter">
          <HomeBrandHeader />
        </div>
        {children}
      </main>
    </div>
  );
}
