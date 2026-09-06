"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  fetchPlaybackInfo,
  reportPlaybackStart,
  streamUrl,
  subtitleTracks,
} from "@/lib/client-api";
import { formatFinishTime, ticksToSeconds } from "@/lib/clock";
import { playerTitleHref } from "@/lib/item-href";
import type { JellyfinItem, PlaybackInfo } from "@/lib/jellyfin-types";

export function VideoPlayer({
  item,
  userId,
}: {
  item: JellyfinItem;
  userId?: string;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [info, setInfo] = useState<PlaybackInfo | null>(null);
  const [track, setTrack] = useState("off");
  const [finishAt, setFinishAt] = useState("");
  const tracks = useMemo(() => subtitleTracks(item.Id, info), [item.Id, info]);
  const headline = item.SeriesName || item.Name;
  const detail =
    item.Type === "Episode"
      ? [item.ParentIndexNumber && item.IndexNumber ? `S${item.ParentIndexNumber} · E${item.IndexNumber}` : null, item.Name]
          .filter(Boolean)
          .join("  ·  ")
      : item.ProductionYear
        ? String(item.ProductionYear)
        : "";

  useEffect(() => {
    if (!userId) return;
    fetchPlaybackInfo(item.Id, userId)
      .then((data) => {
        setInfo(data);
        const preferred = data.MediaSources?.[0]?.DefaultSubtitleStreamIndex;
        const match = data.MediaSources?.[0]?.MediaStreams?.find(
          (stream) => stream.Type === "Subtitle" && stream.Index === preferred
        );
        const english = data.MediaSources?.[0]?.MediaStreams?.find(
          (stream) =>
            stream.Type === "Subtitle" &&
            (stream.Language || "").toLowerCase().startsWith("en")
        );
        const pick = match ?? english;
        if (pick && typeof pick.Index === "number") {
          setTrack(String(pick.Index));
        }
      })
      .catch(() => setInfo(null));
  }, [item.Id, userId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    for (const textTrack of video.textTracks) {
      textTrack.mode = "disabled";
    }
    if (track === "off") return;
    const label = tracks.find((row) => String(row.index) === track)?.label;
    const chosen = [...video.textTracks].find((textTrack) => textTrack.label === label);
    if (chosen) chosen.mode = "showing";
  }, [track, tracks]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const start = ticksToSeconds(item.UserData?.PlaybackPositionTicks);
    const onLoaded = () => {
      if (start > 5 && start < video.duration - 5) {
        video.currentTime = start;
      }
    };
    const onTime = () => {
      if (!video.duration || video.paused) return;
      const remaining = (video.duration - video.currentTime) / (video.playbackRate || 1);
      setFinishAt(formatFinishTime(remaining));
    };
    const onPlay = () => {
      reportPlaybackStart(item.Id);
      onTime();
    };
    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("play", onPlay);
    return () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("play", onPlay);
    };
  }, [item.Id, item.UserData?.PlaybackPositionTicks]);

  return (
    <div className="relative size-full">
      <video
        ref={videoRef}
        key={item.Id}
        className="size-full bg-black object-contain"
        src={streamUrl(item.Id)}
        controls
        autoPlay
        crossOrigin="anonymous"
      >
        {tracks.map((entry) => (
          <track
            key={entry.index}
            kind="subtitles"
            src={entry.src}
            srcLang={entry.language}
            label={entry.label}
            default={track === String(entry.index)}
          />
        ))}
      </video>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/80 via-black/35 to-transparent px-4 pt-4 pb-16">
        <div className="pointer-events-auto flex items-start gap-3">
          <Button
            variant="ghost"
            className="mt-0.5 shrink-0 text-white hover:bg-white/10 hover:text-white"
            onClick={() => router.back()}
          >
            <ArrowLeft data-icon="inline-start" />
            Back
          </Button>
          <div className="min-w-0 flex-1">
            <Link
              href={playerTitleHref(item)}
              className="block truncate text-2xl font-semibold tracking-tight text-white hover:underline sm:text-3xl"
            >
              {headline}
            </Link>
            {detail && <p className="mt-0.5 truncate text-sm text-white/65">{detail}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2 pt-1">
            {finishAt && (
              <p className="hidden rounded-full bg-black/55 px-3 py-1 text-sm text-white sm:block">
                Finishes at {finishAt}
              </p>
            )}
            {tracks.length > 0 && (
              <label className="flex items-center gap-2 rounded-full bg-black/55 px-3 py-1 text-sm text-white">
                Subs
                <select
                  className="max-w-[160px] bg-transparent text-white outline-none"
                  value={track}
                  onChange={(event) => setTrack(event.target.value)}
                >
                  <option value="off">Off</option>
                  {tracks.map((entry) => (
                    <option key={entry.index} value={String(entry.index)}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>
        {finishAt && (
          <p className="mt-2 rounded-full bg-black/55 px-3 py-1 text-sm text-white sm:hidden">
            Finishes at {finishAt}
          </p>
        )}
      </div>
    </div>
  );
}
