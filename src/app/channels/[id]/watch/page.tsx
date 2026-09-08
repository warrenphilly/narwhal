"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { BackButton } from "@/components/back-button";
import { LoginScreen } from "@/components/login-screen";
import { NarwhalSpinner } from "@/components/narwhal-spinner";
import { VideoPlayer } from "@/components/video-player";
import { Button } from "@/components/ui/button";
import { useSession } from "@/components/session-provider";
import { fetchMovie, fetchPlayableId } from "@/lib/client-api";
import { expandChannelLineup } from "@/lib/channel-play";
import { channelBlockMs, lineupCount, loadChannels, nextPlayIndex } from "@/lib/channels";
import type { JellyfinItem } from "@/lib/jellyfin-types";

export default function ChannelWatchPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const startItem = search.get("item");
  const { session, loading, preview } = useSession();
  const channel = useMemo(
    () => (session?.userId ? loadChannels(session.userId).find((row) => row.id === params.id) : undefined),
    [session?.userId, params.id]
  );
  const [order, setOrder] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [item, setItem] = useState<JellyfinItem | null>(null);
  const [startedAt] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [building, setBuilding] = useState(true);

  useEffect(() => {
    if (!channel || !session?.userId) return;
    let cancelled = false;
    setBuilding(true);
    expandChannelLineup(channel, session.userId)
      .then((ids) => {
        if (cancelled) return;
        setOrder(ids);
        const jump = startItem ? ids.indexOf(startItem) : 0;
        setIndex(jump >= 0 ? jump : 0);
        setBuilding(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not build this channel.");
        setBuilding(false);
      });
    return () => {
      cancelled = true;
    };
  }, [channel?.id, session?.userId, startItem]);

  useEffect(() => {
    if (!channel || !session?.userId || !order[index]) return;
    let cancelled = false;
    setItem(null);
    setError(null);
    const userId = session.userId;
    fetchMovie(userId, order[index])
      .then(async (next) => {
        const playId = await fetchPlayableId(userId, next);
        const playable = playId === next.Id ? next : await fetchMovie(userId, playId);
        if (!cancelled) setItem(playable);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not start this channel.");
      });
    return () => {
      cancelled = true;
    };
  }, [channel, session?.userId, order, index]);

  async function reshuffle() {
    if (!channel || !session?.userId) return;
    const ids = await expandChannelLineup(channel, session.userId);
    setOrder(ids);
    setIndex(0);
  }

  function advance() {
    if (!channel) return;
    if (Date.now() - startedAt >= channelBlockMs(channel)) {
      setDone(true);
      return;
    }
    const next = nextPlayIndex(channel, order, index);
    if (next < 0) {
      setDone(true);
      return;
    }
    if (next === 0 && channel.kind === "shuffle") {
      void reshuffle();
      return;
    }
    setIndex(next);
  }

  if (loading || building) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black">
        <NarwhalSpinner label="Tuning in…" />
      </div>
    );
  }
  if (!session?.signedIn && !preview) return <LoginScreen />;
  if (!channel) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-black text-white">
        <p>This channel is gone.</p>
        <Link href="/channels" className="underline">
          Back to channels
        </Link>
      </div>
    );
  }

  if (done || lineupCount(channel) === 0 || order.length === 0) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-black px-6 text-center text-white">
        <p className="text-2xl font-semibold">{lineupCount(channel) === 0 ? "Add titles first" : "This block is over"}</p>
        <p className="text-white/60">{channel.name}</p>
        <Link href="/channels">
          <Button className="rounded-full">Edit channel</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <div className="absolute left-4 top-4 z-[90]">
        <BackButton className="text-white hover:bg-white/10 hover:text-white" />
      </div>
      {error && (
        <div className="absolute inset-0 z-[80] flex flex-col items-center justify-center gap-3 text-white">
          <p>{error}</p>
          <Button className="rounded-full" onClick={advance}>
            Skip
          </Button>
        </div>
      )}
      {!item && !error && (
        <div className="flex size-full items-center justify-center">
          <NarwhalSpinner label={`Now on ${channel.name}…`} />
        </div>
      )}
      {item && session?.userId && (
        <VideoPlayer key={item.Id} item={item} userId={session.userId} startFresh onEnded={advance} />
      )}
    </div>
  );
}
