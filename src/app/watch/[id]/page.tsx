"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoginScreen } from "@/components/login-screen";
import { useSession } from "@/components/session-provider";
import { fetchMovie, streamUrl } from "@/lib/client-api";
import { DEMO_MOVIES, isDemoId } from "@/lib/demo-library";
import type { JellyfinItem } from "@/lib/jellyfin-types";

export default function WatchPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { session, loading, preview } = useSession();
  const [remoteItem, setRemoteItem] = useState<JellyfinItem | null>(null);
  const demoItem = DEMO_MOVIES.find((movie) => movie.Id === params.id) ?? null;

  useEffect(() => {
    const id = params.id;
    if (!id || isDemoId(id) || !session?.userId) return;
    fetchMovie(session.userId, id).then(setRemoteItem).catch(() => setRemoteItem(null));
  }, [params.id, session?.userId]);

  if (loading) return <div className="tv-root min-h-full bg-black" />;
  if (!session?.signedIn && !preview) return <LoginScreen />;

  const item = demoItem ?? remoteItem;
  const demo = !item || isDemoId(item.Id);

  return (
    <div className="flex min-h-full flex-col bg-black">
      <div className="flex items-center gap-3 px-4 py-4">
        <Button
          variant="ghost"
          className="text-white hover:bg-white/10"
          onClick={() => router.back()}
        >
          <ArrowLeft data-icon="inline-start" />
          Back
        </Button>
        <p className="text-sm text-white/70">{item?.Name ?? "Playing"}</p>
      </div>
      <div className="flex flex-1 items-center justify-center px-4 pb-10">
        {demo ? (
          <div className="max-w-lg rounded-3xl border border-white/10 bg-white/5 p-10 text-center">
            <p className="text-2xl font-semibold text-white">Playback needs your server</p>
            <p className="mt-3 text-white/55">
              Sample titles are layout placeholders. Sign in to stream or download the original file from Jellyfin.
            </p>
          </div>
        ) : (
          <video
            className="aspect-video w-full max-w-6xl rounded-2xl bg-black"
            src={streamUrl(params.id)}
            controls
            autoPlay
          />
        )}
      </div>
    </div>
  );
}
