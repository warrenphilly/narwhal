"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NarwhalMark } from "@/components/narwhal-mark";
import { useProfiles } from "@/components/profile-provider";
import {
  fetchPlaybackInfo,
  imageUrl,
  reportPlaybackStart,
  reportPlaybackStopped,
  setPlayed,
  streamUrl,
  subtitleTracks,
} from "@/lib/client-api";
import { formatFinishTime, ticksToSeconds } from "@/lib/clock";
import { formatRuntime } from "@/lib/jellyfin-types";
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
  const { rememberProgress } = useProfiles();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [info, setInfo] = useState<PlaybackInfo | null>(null);
  const [track, setTrack] = useState("off");
  const [finishAt, setFinishAt] = useState("");
  const [paused, setPaused] = useState(false);
  const [logoOk, setLogoOk] = useState(true);
  const [playError, setPlayError] = useState<string | null>(null);
  const [forceTranscode, setForceTranscode] = useState(false);
  const src = streamUrl(item.Id, info, forceTranscode);
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
    setForceTranscode(false);
    setPlayError(null);
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
    let marked = false;
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
      setPaused(false);
      reportPlaybackStart(item.Id);
      onTime();
    };
    const onPause = () => {
      setPaused(true);
      const ticks = Math.round(video.currentTime * 10_000_000);
      rememberProgress(item.Id, ticks, false);
      reportPlaybackStopped(item.Id, ticks);
    };
    const markDone = () => {
      if (marked) return;
      marked = true;
      rememberProgress(item.Id, item.RunTimeTicks ?? 0, true);
      reportPlaybackStopped(item.Id, item.RunTimeTicks);
      if (userId) setPlayed(userId, item.Id, true).catch(() => undefined);
    };
    const onEnded = () => markDone();
    const onTimeWatch = () => {
      onTime();
      if (video.duration && video.currentTime / video.duration >= 0.9) {
        markDone();
      }
    };
    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("timeupdate", onTimeWatch);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);
    return () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("timeupdate", onTimeWatch);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
    };
  }, [item.Id, item.RunTimeTicks, item.UserData?.PlaybackPositionTicks, rememberProgress, userId]);

  return (
    <div className="relative size-full">
      <video
        ref={videoRef}
        key={`${item.Id}-${src}`}
        className="size-full bg-black object-contain"
        src={src}
        controls
        autoPlay
        playsInline
        preload="auto"
        onError={() => {
          if (!forceTranscode) {
            setForceTranscode(true);
            setPlayError("Original file is not browser-friendly. Asking Jellyfin to convert it…");
            return;
          }
          setPlayError("This file could not start. Confirm it plays in the Jellyfin web app.");
        }}
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
      {playError && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-10 flex justify-center px-4">
          <p className="max-w-lg rounded-2xl bg-black/70 px-4 py-3 text-center text-sm text-white/85">
            {playError}
          </p>
        </div>
      )}
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
      {paused && (
        <div className="absolute inset-0 z-20 flex items-end bg-gradient-to-t from-black via-black/70 to-black/20 px-8 py-16 sm:px-16">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3">
              <NarwhalMark className="size-10" />
              {logoOk && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl(item.Id, { type: "Logo", maxWidth: 480 })}
                  alt=""
                  className="h-16 max-w-[280px] object-contain"
                  onError={() => setLogoOk(false)}
                />
              )}
            </div>
            <p className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-5xl">{headline}</p>
            {detail && <p className="mt-2 text-lg text-white/70">{detail}</p>}
            <div className="mt-3 flex flex-wrap gap-2 text-sm text-white/80">
              {item.ProductionYear && (
                <span className="rounded-full bg-white/12 px-3 py-1">{item.ProductionYear}</span>
              )}
              {item.OfficialRating && (
                <span className="rounded-full bg-white/12 px-3 py-1">{item.OfficialRating}</span>
              )}
              {formatRuntime(item.RunTimeTicks) && (
                <span className="rounded-full bg-white/12 px-3 py-1">{formatRuntime(item.RunTimeTicks)}</span>
              )}
              {item.CommunityRating && (
                <span className="rounded-full bg-white/12 px-3 py-1">{item.CommunityRating.toFixed(1)} ★</span>
              )}
            </div>
            {item.Overview && (
              <p className="mt-4 line-clamp-3 text-base leading-relaxed text-white/80">{item.Overview}</p>
            )}
            <Button
              size="lg"
              className="mt-6 h-12 rounded-full px-6"
              onClick={() => videoRef.current?.play()}
            >
              <Play data-icon="inline-start" className="fill-current" />
              Resume
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
