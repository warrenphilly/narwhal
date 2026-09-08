"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { BackButton } from "@/components/back-button";
import { LoginScreen } from "@/components/login-screen";
import { VideoPlayer } from "@/components/video-player";
import { useSession } from "@/components/session-provider";
import { isDemoId } from "@/lib/demo-library";
import type { JellyfinItem } from "@/lib/jellyfin-types";

export default function WatchPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { session, loading, preview } = useSession();
  const [item, setItem] = useState<JellyfinItem | null>(id ? { Id: id, Name: "" } : null);

  useEffect(() => {
    if (!id || isDemoId(id) || !session?.userId) return;
    let cancelled = false;
    fetch(`/api/item/${encodeURIComponent(id)}`, { cache: "no-store", credentials: "same-origin" })
      .then(async (response) => {
        const data = (await response.json()) as JellyfinItem & { error?: string };
        if (!response.ok) throw new Error(data.error || "Could not load this title.");
        return data;
      })
      .then((next) => {
        if (cancelled) return;
        if (next.Type === "Series") {
          window.location.replace(`/show/${next.Id}`);
          return;
        }
        if (next.Type === "Season" && next.SeriesId) {
          window.location.replace(`/show/${next.SeriesId}`);
          return;
        }
        setItem({ ...next, Id: next.Id || id });
      })
      .catch(() => {
        /* play with the id from the URL even if metadata fails */
      });
    return () => {
      cancelled = true;
    };
  }, [id, session?.userId]);

  if (loading) return <div className="fixed inset-0 bg-black" />;
  if (!session?.signedIn && !preview) return <LoginScreen />;
  if (!id || isDemoId(id) || !session?.signedIn) {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        <div className="absolute left-4 top-4">
          <BackButton className="text-white hover:bg-white/10 hover:text-white" />
        </div>
        <div className="flex size-full items-center justify-center px-6">
          <div className="max-w-lg rounded-3xl border border-white/15 bg-white/5 p-8 text-center sm:p-10">
            <p className="text-2xl font-semibold text-white">Playback needs your server</p>
            <p className="mt-3 text-white/60">Sign in to stream from Jellyfin.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <VideoPlayer item={item ?? { Id: id, Name: "" }} userId={session.userId} />
    </div>
  );
}
