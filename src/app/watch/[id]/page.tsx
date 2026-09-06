"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
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
  const demoItem = DEMO_TITLES.find((movie) => movie.Id === params.id) ?? null;

  useEffect(() => {
    const id = params.id;
    if (!id || isDemoId(id) || !session?.userId) return;
    fetchMovie(session.userId, id).then(setRemoteItem).catch(() => setRemoteItem(null));
  }, [params.id, session?.userId]);

  if (loading) return <div className="fixed inset-0 bg-black" />;
  if (!session?.signedIn && !preview) return <LoginScreen />;

  const item = demoItem ?? remoteItem;
  const demo = !item || isDemoId(item.Id);

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {demo || !item ? (
        <div className="flex size-full items-center justify-center px-6">
          <div className="max-w-lg rounded-3xl border border-white/15 bg-white/5 p-10 text-center">
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
