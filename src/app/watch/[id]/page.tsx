"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { BackButton } from "@/components/back-button";
import { LoginScreen } from "@/components/login-screen";
import { VideoPlayer } from "@/components/video-player";
import { NarwhalSpinner } from "@/components/narwhal-spinner";
import { useSession } from "@/components/session-provider";
import { fetchMovie } from "@/lib/client-api";
import { isDemoId } from "@/lib/demo-library";
import type { JellyfinItem } from "@/lib/jellyfin-types";

export default function WatchPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [startFresh, setStartFresh] = useState(false);
  const { session, loading, preview } = useSession();
  const [item, setItem] = useState<JellyfinItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setStartFresh(new URLSearchParams(window.location.search).get("fresh") === "1");
    } catch {
      setStartFresh(false);
    }
  }, []);

  useEffect(() => {
    if (!id || isDemoId(id) || !session?.userId) return;
    let cancelled = false;
    setError(null);
    setItem(null);
    fetchMovie(session.userId, id)
      .then((data) => {
        if (cancelled) return;
        if (data.Type === "Series") {
          window.location.replace(`/show/${data.Id}`);
          return;
        }
        if (data.Type === "Season" && data.SeriesId) {
          window.location.replace(`/show/${data.SeriesId}`);
          return;
        }
        setItem({ ...data, Id: data.Id || id });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load this title.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id, session?.userId]);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black">
        <NarwhalSpinner label="Cueing it up…" />
      </div>
    );
  }
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

  if (error) {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        <div className="absolute left-4 top-4">
          <BackButton className="text-white hover:bg-white/10 hover:text-white" />
        </div>
        <div className="flex size-full items-center justify-center px-6">
          <div className="max-w-lg rounded-3xl border border-white/15 bg-white/5 p-8 text-center sm:p-10">
            <p className="text-2xl font-semibold text-white">Couldn’t open this title</p>
            <p className="mt-3 text-white/60">{error}</p>
            <p className="mt-4 text-sm text-white/45">
              If you re-downloaded this show, open it from TV Shows and start a new episode — the old file link may be gone.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black">
        <NarwhalSpinner label="Cueing it up…" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <VideoPlayer item={item} userId={session.userId} startFresh={startFresh} />
    </div>
  );
}
