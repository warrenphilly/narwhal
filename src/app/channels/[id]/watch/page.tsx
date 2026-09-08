"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { BackButton } from "@/components/back-button";
import { LoginScreen } from "@/components/login-screen";
import { NarwhalSpinner } from "@/components/narwhal-spinner";
import { VideoPlayer } from "@/components/video-player";
import { Button } from "@/components/ui/button";
import { useSession } from "@/components/session-provider";
import { expandChannelItems, findGuideBlock, findLiveBlock, type LiveBlock } from "@/lib/channel-play";
import { fetchMovie, fetchPlayableId } from "@/lib/client-api";
import { channelBlockMs, lineupCount, loadChannels } from "@/lib/channels";
import type { JellyfinItem } from "@/lib/jellyfin-types";

type TuneState = {
  item: JellyfinItem;
  blockStart: number;
  blockEnd: number;
};

export default function ChannelWatchPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const blockStartParam = search.get("start");
  const { session, loading, preview } = useSession();
  const channel = useMemo(
    () => (session?.userId ? loadChannels(session.userId).find((row) => row.id === params.id) : undefined),
    [session?.userId, params.id]
  );
  const [tune, setTune] = useState<TuneState | null>(null);
  const [startedAt] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [building, setBuilding] = useState(true);
  const itemsRef = useRef<JellyfinItem[]>([]);
  const tuneRef = useRef<TuneState | null>(null);
  tuneRef.current = tune;

  const syncToSchedule = useCallback(
    async (at = Date.now(), preferredStart?: number) => {
      if (!channel || !session?.userId) return;
      if (!channel.alwaysOn && Date.now() - startedAt >= channelBlockMs(channel)) {
        setDone(true);
        return;
      }

      let items = itemsRef.current;
      if (!items.length) {
        items = await expandChannelItems(channel, session.userId);
        itemsRef.current = items;
      }
      if (!items.length) {
        setDone(true);
        return;
      }

      let block: LiveBlock | null = null;
      if (preferredStart != null) {
        block = findGuideBlock(channel, items, preferredStart, at);
      } else {
        block = findLiveBlock(channel, items, at);
      }
      if (!block) {
        setDone(true);
        return;
      }

      try {
        const playId = await fetchPlayableId(session.userId, block.item);
        const playable = playId === block.item.Id ? block.item : await fetchMovie(session.userId, playId);
        setError(null);
        setTune({
          item: playable,
          blockStart: block.start,
          blockEnd: block.end,
        });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Could not start this channel.");
      }
    },
    [channel, session?.userId, startedAt]
  );

  useEffect(() => {
    if (!channel || !session?.userId) return;
    let cancelled = false;
    setBuilding(true);
    setTune(null);
    setDone(false);
    setError(null);
    itemsRef.current = [];

    expandChannelItems(channel, session.userId)
      .then(async (items) => {
        if (cancelled) return;
        itemsRef.current = items;
        const preferred = blockStartParam ? Number(blockStartParam) : undefined;
        await syncToSchedule(Date.now(), Number.isFinite(preferred) ? preferred : undefined);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not build this channel.");
      })
      .finally(() => {
        if (!cancelled) setBuilding(false);
      });

    return () => {
      cancelled = true;
    };
  }, [channel?.id, session?.userId, blockStartParam, syncToSchedule]);

  useEffect(() => {
    if (!tune) return;
    const ms = tune.blockEnd - Date.now();
    if (ms <= 0) {
      void syncToSchedule();
      return;
    }
    const id = window.setTimeout(() => {
      void syncToSchedule();
    }, ms);
    return () => window.clearTimeout(id);
  }, [tune?.blockStart, tune?.blockEnd, syncToSchedule]);

  function advance() {
    const current = tuneRef.current;
    const at = current ? Math.max(Date.now(), current.blockEnd) : Date.now();
    void syncToSchedule(at);
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

  if (done || lineupCount(channel) === 0) {
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
      {!tune && (
        <div className="absolute left-4 top-4 z-[90]">
          <BackButton className="text-white hover:bg-white/10 hover:text-white" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 z-[80] flex flex-col items-center justify-center gap-3 text-white">
          <p>{error}</p>
          <Button className="rounded-full" onClick={advance}>
            Skip
          </Button>
        </div>
      )}
      {!tune && !error && (
        <div className="flex size-full items-center justify-center">
          <NarwhalSpinner label={`Now on ${channel.name}…`} />
        </div>
      )}
      {tune && session?.userId && (
        <VideoPlayer
          key={`${tune.item.Id}-${tune.blockStart}`}
          item={tune.item}
          userId={session.userId}
          startFresh
          trackProgress={false}
          onEnded={advance}
        />
      )}
    </div>
  );
}
