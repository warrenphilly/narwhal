"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Download, Play } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LoginScreen } from "@/components/login-screen";
import { Button } from "@/components/ui/button";
import { useDownloads } from "@/components/downloads-provider";
import { useSession } from "@/components/session-provider";
import { fetchMovie, imageUrl } from "@/lib/client-api";
import { DEMO_MOVIES, demoPosterGradient, isDemoId } from "@/lib/demo-library";
import { formatBytes, formatRuntime } from "@/lib/jellyfin-types";
import type { JellyfinItem } from "@/lib/jellyfin-types";

export default function MoviePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { session, loading, preview } = useSession();
  const { downloadMovie } = useDownloads();
  const [item, setItem] = useState<JellyfinItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const demoItem = DEMO_MOVIES.find((movie) => movie.Id === params.id) ?? null;

  useEffect(() => {
    const id = params.id;
    if (!id || isDemoId(id) || !session?.userId) return;
    fetchMovie(session.userId, id)
      .then(setItem)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Could not open this title.")
      );
  }, [params.id, session?.userId]);

  if (loading) return <div className="tv-root min-h-full" />;
  if (!session?.signedIn && !preview) return <LoginScreen />;

  const resolved = demoItem ?? item;

  if (!resolved && !error) {
    return (
      <AppShell>
        <p className="px-8 py-20 text-zinc-500">Loading title…</p>
      </AppShell>
    );
  }

  if (error || !resolved) {
    return (
      <AppShell>
        <p className="px-8 py-20 text-zinc-500">{error || "Title not found."}</p>
      </AppShell>
    );
  }

  const demo = isDemoId(resolved.Id);
  const [from, to] = demoPosterGradient(resolved.Id);
  const backdrop = demo
    ? undefined
    : imageUrl(resolved.Id, {
        type: resolved.BackdropImageTags?.length ? "Backdrop" : "Primary",
        maxWidth: 1920,
      });
  const size = resolved.MediaSources?.[0]?.Size;
  const movie = resolved;

  async function onDownload() {
    setSaving(true);
    setError(null);
    try {
      await downloadMovie(movie);
      router.push("/downloads");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="relative min-h-[88vh] overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: backdrop
              ? `url(${backdrop})`
              : `linear-gradient(135deg, ${from}, ${to})`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#f5f5f7] via-[#f5f5f7]/90 to-[#f5f5f7]/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#f5f5f7] via-[#f5f5f7]/30 to-transparent" />
        <div className="relative mx-auto grid max-w-[1600px] gap-10 px-4 py-16 sm:px-8 lg:grid-cols-[280px_1fr]">
          <div className="hidden aspect-[2/3] overflow-hidden rounded-2xl shadow-2xl ring-1 ring-black/10 lg:block">
            {demo ? (
              <div
                className="size-full"
                style={{ background: `linear-gradient(160deg, ${from}, ${to})` }}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl(resolved.Id, { maxHeight: 800 })}
                alt=""
                className="size-full object-cover"
              />
            )}
          </div>
          <div className="flex flex-col justify-end">
            <p className="text-xs tracking-[0.24em] text-zinc-500 uppercase">Movie</p>
            <h1 className="mt-3 max-w-3xl text-5xl font-semibold tracking-tight text-zinc-900 sm:text-6xl">
              {resolved.Name}
            </h1>
            <div className="mt-4 flex flex-wrap gap-3 text-sm text-zinc-600">
              {resolved.ProductionYear && <span>{resolved.ProductionYear}</span>}
              {resolved.OfficialRating && (
                <span className="rounded border border-zinc-300 px-1.5 py-0.5 text-xs">
                  {resolved.OfficialRating}
                </span>
              )}
              {resolved.CommunityRating && <span>{resolved.CommunityRating.toFixed(1)} ★</span>}
              {resolved.RunTimeTicks && <span>{formatRuntime(resolved.RunTimeTicks)}</span>}
              {size ? <span>{formatBytes(size)}</span> : null}
            </div>
            {resolved.Overview && (
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-600">
                {resolved.Overview}
              </p>
            )}
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                size="lg"
                className="h-12 rounded-full px-6 text-base"
                onClick={() => router.push(`/watch/${resolved.Id}`)}
              >
                <Play data-icon="inline-start" className="fill-current" />
                Play
              </Button>
              <Button
                size="lg"
                variant="secondary"
                className="h-12 rounded-full px-6 text-base"
                disabled={demo || saving}
                onClick={onDownload}
              >
                <Download data-icon="inline-start" />
                {demo ? "Connect to download" : saving ? "Saving…" : "Download to laptop"}
              </Button>
            </div>
            {resolved.Genres && resolved.Genres.length > 0 && (
              <p className="mt-8 text-sm text-zinc-500">{resolved.Genres.join(" · ")}</p>
            )}
            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
