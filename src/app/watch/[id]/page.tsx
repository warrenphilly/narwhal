"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { BackButton } from "@/components/back-button";
import { LoginScreen } from "@/components/login-screen";
import { VideoPlayer } from "@/components/video-player";
import { useSession } from "@/components/session-provider";
import { fetchMovie } from "@/lib/client-api";
import { DEMO_MOVIES, DEMO_SHOWS, isDemoId } from "@/lib/demo-library";
import type { JellyfinItem } from "@/lib/jellyfin-types";

const DEMO_TITLES = [...DEMO_MOVIES, ...DEMO_SHOWS];

export default function WatchPage() {
  const params = useParams<{ id: string }>();
  const { session, loading, preview } = useSession();
  const [remoteItem, setRemoteItem] = useState<JellyfinItem | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const demoItem = DEMO_TITLES.find((movie) => movie.Id === params.id) ?? null;

  useEffect(() => {
    const id = params.id;
    if (!id || isDemoId(id) || !session?.userId) {
      setReady(true);
      return;
    }
    setReady(false);
    setError(null);
    fetchMovie(session.userId, id)
      .then((item) => {
        if (item.Type === "Series") {
          window.location.replace(`/show/${item.Id}`);
          return;
        }
        if (item.Type === "Season" && item.SeriesId) {
          window.location.replace(`/show/${item.SeriesId}`);
          return;
        }
        setRemoteItem(item);
        setReady(true);
      })
      .catch((err: unknown) => {
        setRemoteItem(null);
        setError(err instanceof Error ? err.message : "Could not open this title.");
        setReady(true);
      });
  }, [params.id, session?.userId]);

  if (loading) return <div className="fixed inset-0 bg-black" />;
  if (!session?.signedIn && !preview) return <LoginScreen />;

  const item = demoItem ?? remoteItem;
  const waiting = Boolean(session?.signedIn && !demoItem && !ready);
  const demo = Boolean(demoItem) || (!session?.signedIn && preview);

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {waiting ? (
        <div className="flex size-full items-center justify-center px-6">
          <div className="absolute left-4 top-4">
            <BackButton className="text-white hover:bg-white/10 hover:text-white" />
          </div>
          <p className="text-white/70">Starting playback…</p>
        </div>
      ) : error || (!item && session?.signedIn) ? (
        <div className="flex size-full items-center justify-center px-6">
          <div className="absolute left-4 top-4">
            <BackButton className="text-white hover:bg-white/10 hover:text-white" />
          </div>
          <div className="max-w-lg rounded-3xl border border-white/15 bg-white/5 p-8 text-center sm:p-10">
            <p className="text-2xl font-semibold text-white">Couldn’t start this title</p>
            <p className="mt-3 text-white/60">{error || "Jellyfin did not return this item."}</p>
          </div>
        </div>
      ) : demo || !item ? (
        <div className="flex size-full items-center justify-center px-6">
          <div className="absolute left-4 top-4">
            <BackButton className="text-white hover:bg-white/10 hover:text-white" />
          </div>
          <div className="max-w-lg rounded-3xl border border-white/15 bg-white/5 p-8 text-center sm:p-10">
            <p className="text-2xl font-semibold text-white">Playback needs your server</p>
            <p className="mt-3 text-white/60">
              Sample titles are layout placeholders. Sign in to stream from Jellyfin.
            </p>
          </div>
        </div>
      ) : (
        <VideoPlayer item={item} userId={session?.userId} />
      )}
    </div>
  );
}
