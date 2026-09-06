"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoginScreen } from "@/components/login-screen";
import { useSession } from "@/components/session-provider";
import { fetchMovie, streamUrl } from "@/lib/client-api";
import { DEMO_MOVIES, DEMO_SHOWS, isDemoId } from "@/lib/demo-library";
import type { JellyfinItem } from "@/lib/jellyfin-types";

const DEMO_TITLES = [...DEMO_MOVIES, ...DEMO_SHOWS];

export default function WatchPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
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
  const title = item?.SeriesName ? `${item.SeriesName} · ${item.Name}` : item?.Name ?? "Playing";

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-3 bg-gradient-to-b from-black/80 to-transparent px-4 py-4">
        <Button
          variant="ghost"
          className="text-white hover:bg-white/10 hover:text-white"
          onClick={() => router.back()}
        >
          <ArrowLeft data-icon="inline-start" />
          Back
        </Button>
        <p className="truncate text-sm text-white/80">{title}</p>
      </div>
      {demo ? (
        <div className="flex size-full items-center justify-center px-6">
          <div className="max-w-lg rounded-3xl border border-white/15 bg-white/5 p-10 text-center">
            <p className="text-2xl font-semibold text-white">Playback needs your server</p>
            <p className="mt-3 text-white/60">
              Sample titles are layout placeholders. Sign in to stream from Jellyfin.
            </p>
          </div>
        </div>
      ) : (
        <video
          className="size-full bg-black object-contain"
          src={streamUrl(params.id)}
          controls
          autoPlay
        />
      )}
    </div>
  );
}
