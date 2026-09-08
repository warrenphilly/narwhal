"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Hls from "hls.js";
import { ArrowLeft, Maximize, Minimize, Pause, Play, Settings, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NarwhalMark } from "@/components/narwhal-mark";
import { NarwhalSpinner } from "@/components/narwhal-spinner";
import { useProfiles } from "@/components/profile-provider";
import {
  audioTracks,
  fetchPlaybackInfo,
  hlsUrl,
  imageUrl,
  savePlayPosition,
  setPlayed,
  streamUrl,
  subtitleTracks,
} from "@/lib/client-api";
import { formatClock, formatFinishTime, ticksToSeconds } from "@/lib/clock";
import { formatRuntime } from "@/lib/jellyfin-types";
import { playerTitleHref } from "@/lib/item-href";
import type { JellyfinItem, PlaybackInfo } from "@/lib/jellyfin-types";

function TrackPickers({
  sounds,
  tracks,
  audio,
  track,
  onAudio,
  onTrack,
}: {
  sounds: { index: number; label: string }[];
  tracks: { index: number; label: string }[];
  audio?: number;
  track: string;
  onAudio: (index: number) => void;
  onTrack: (value: string) => void;
}) {
  return (
    <div className="space-y-3">
      {sounds.length > 0 && (
        <label className="block text-sm text-white/80">
          Audio
          <select
            className="mt-1 h-11 w-full rounded-xl border border-white/15 bg-[#0c0c0e] px-3 text-base text-white outline-none"
            value={audio ?? sounds[0]?.index ?? ""}
            onChange={(event) => onAudio(Number(event.target.value))}
          >
            {sounds.map((entry) => (
              <option key={entry.index} value={entry.index}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {tracks.length > 0 && (
        <label className="block text-sm text-white/80">
          Subtitles
          <select
            className="mt-1 h-11 w-full rounded-xl border border-white/15 bg-[#0c0c0e] px-3 text-base text-white outline-none"
            value={track}
            onChange={(event) => onTrack(event.target.value)}
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
  );
}

const VIEWS = [
  { id: "fit", label: "Fit" },
  { id: "fill", label: "Fill" },
  { id: "wide", label: "Widescreen" },
  { id: "stretch", label: "Stretch" },
] as const;

type ViewMode = (typeof VIEWS)[number]["id"];

const MIN_RESUME = 10 * 10_000_000;

function viewClass(mode: ViewMode) {
  if (mode === "fill") return "size-full object-cover";
  if (mode === "wide") return "h-[42vw] max-h-full w-full object-cover";
  if (mode === "stretch") return "size-full object-fill";
  return "size-full object-contain";
}

function canSeekTo(video: HTMLVideoElement, local: number) {
  if (!Number.isFinite(local) || local < 0 || !video.seekable.length) return false;
  for (let i = 0; i < video.seekable.length; i += 1) {
    const start = video.seekable.start(i);
    const end = video.seekable.end(i);
    if (local >= start && local <= Math.max(start, end - 0.2)) return true;
  }
  return false;
}

export function VideoPlayer({
  item,
  userId,
  startFresh = false,
  startAtSeconds,
  trackProgress = true,
  onEnded,
}: {
  item: JellyfinItem;
  userId?: string;
  startFresh?: boolean;
  startAtSeconds?: number;
  trackProgress?: boolean;
  onEnded?: () => void;
}) {
  const router = useRouter();
  const { rememberProgress, applyProfile } = useProfiles();
  const rememberRef = useRef(rememberProgress);
  rememberRef.current = rememberProgress;
  const trackProgressRef = useRef(trackProgress);
  trackProgressRef.current = trackProgress;
  const videoRef = useRef<HTMLVideoElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [info, setInfo] = useState<PlaybackInfo | null>(null);
  const [track, setTrack] = useState("off");
  const [audio, setAudio] = useState<number | undefined>(undefined);
  const [audioSession, setAudioSession] = useState(0);
  const [finishAt, setFinishAt] = useState("");
  const [paused, setPaused] = useState(false);
  const [logoOk, setLogoOk] = useState(true);
  const [playError, setPlayError] = useState<string | null>(null);
  const [forceTranscode, setForceTranscode] = useState(false);
  const [hardTranscode, setHardTranscode] = useState(false);
  const [waiting, setWaiting] = useState(true);
  const [synced, setSynced] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const hideChromeTimer = useRef<number | null>(null);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const [view, setView] = useState<ViewMode>("fit");
  const [fullscreen, setFullscreen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const resume = startFresh ? 0 : applyProfile(item).UserData?.PlaybackPositionTicks ?? 0;
  const resumeSeconds =
    startAtSeconds ?? ticksToSeconds(startFresh ? 0 : resume > MIN_RESUME ? resume : 0);
  const [startTicks, setStartTicks] = useState(() =>
    startAtSeconds != null ? Math.round(startAtSeconds * 10_000_000) : 0
  );
  const [now, setNow] = useState(resumeSeconds);
  const resumeGoal = useRef(resumeSeconds);
  const offsetSecondsRef = useRef(0);
  const resumeRedirect = useRef(false);
  const errorStep = useRef(0);
  const endedRef = useRef(onEnded);
  endedRef.current = onEnded;
  const hlsRef = useRef<Hls | null>(null);
  // Jellyfin tells us up front (via PlaybackInfo) whether this codec/container
  // can play natively in the browser. Anything that can't goes through a
  // segmented HLS transcode (via hls.js) instead of a raw progressive mp4 —
  // segments re-anchor audio/video timestamps regularly, so drift can't build up.
  const needsTranscode = info?.MediaSources?.[0]?.SupportsDirectPlay === false;
  const usingHls = needsTranscode || forceTranscode || hardTranscode;
  const serverStart = usingHls ? startTicks : 0;
  const src = usingHls ? hlsUrl(item.Id, audio, serverStart, audioSession) : streamUrl(item.Id, info, false, audio, 0, false);
  const tracks = useMemo(() => subtitleTracks(item.Id, info), [item.Id, info]);
  const sounds = useMemo(() => audioTracks(info), [info]);
  const [streamLength, setStreamLength] = useState(0);
  const length = ticksToSeconds(item.RunTimeTicks) || streamLength;
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
    errorStep.current = 0;
    resumeRedirect.current = false;
    setStreamLength(0);
    if (startAtSeconds != null) {
      const ticks = Math.round(startAtSeconds * 10_000_000);
      setStartTicks(ticks);
      resumeGoal.current = startAtSeconds;
      setNow(startAtSeconds);
      return;
    }
    setStartTicks(0);
    if (startFresh) {
      resumeGoal.current = 0;
      setNow(0);
      return;
    }
    const next = applyProfile(item).UserData?.PlaybackPositionTicks ?? 0;
    const seconds = ticksToSeconds(next > MIN_RESUME ? next : 0);
    resumeGoal.current = seconds;
    setNow(seconds);
  }, [item.Id, startFresh, startAtSeconds]);

  useEffect(() => {
    if (length) setFinishAt(formatFinishTime(Math.max(0, length - now)));
  }, [item.Id, length, now]);

  useEffect(() => {
    setForceTranscode(false);
    setHardTranscode(false);
    setPlayError(null);
    setWaiting(true);
    setSynced(false);
    setAudio(undefined);
    setSettingsOpen(false);
    if (!userId) return;
    fetchPlaybackInfo(item.Id, userId)
      .then((data) => {
        setInfo(data);
        const audios = (data.MediaSources?.[0]?.MediaStreams ?? []).filter((stream) => stream.Type === "Audio");
        const defaultSound = audios.find((stream) => stream.IsDefault) ?? audios[0];
        if (typeof defaultSound?.Index === "number") setAudio(defaultSound.Index);
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
        if (pick && typeof pick.Index === "number") setTrack(String(pick.Index));
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

  function displaySeconds() {
    return offsetSecondsRef.current + (videoRef.current?.currentTime ?? 0);
  }

  function saveAt(seconds: number, done = false) {
    if (!trackProgressRef.current) return;
    const ticks = Math.round(seconds * 10_000_000);
    if (!done && ticks < 5_000_000) return;
    const position = done ? (item.RunTimeTicks ?? ticks) : ticks;
    rememberRef.current(
      item.Id,
      position,
      done,
      item.Type === "Episode" && item.SeriesId ? { seriesId: item.SeriesId } : undefined
    );
    if (userId) {
      savePlayPosition(userId, item.Id, position, done).catch(() => undefined);
      if (done) setPlayed(userId, item.Id, true).catch(() => undefined);
    }
  }

  function goBack() {
    if (trackProgressRef.current) saveAt(displaySeconds(), false);
    router.back();
  }

  function pickAudio(index: number) {
    const seconds = displaySeconds();
    saveAt(seconds, false);
    resumeGoal.current = seconds;
    offsetSecondsRef.current = seconds;
    setNow(seconds);
    setStartTicks(Math.round(seconds * 10_000_000));
    setAudio(index);
    setAudioSession(Date.now());
    setForceTranscode(true);
    setWaiting(true);
  }

  function jumpTo(seconds: number) {
    const video = videoRef.current;
    const next = Math.max(0, Math.min(seconds, length > 1 ? length - 1 : seconds));
    setNow(next);
    saveAt(next, false);
    const offset = offsetSecondsRef.current;
    const local = next - offset;
    // HLS (hls.js) fetches whichever segment covers the target time on its own,
    // so a normal currentTime seek works for transcoded playback too — only
    // fall back to restarting the stream when the target isn't seekable yet
    // (e.g. before the manifest/duration is known).
    if (video && local >= 0 && canSeekTo(video, local)) {
      video.currentTime = local;
      return;
    }
    resumeRedirect.current = true;
    setForceTranscode(true);
    setStartTicks(Math.round(next * 10_000_000));
    setWaiting(true);
  }

  function onBarPointer(event: React.PointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    const bar = barRef.current;
    if (!bar || !length) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    jumpTo(ratio * length);
  }

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let lastSecond = -1;
    const persist = (done: boolean) => {
      if (!trackProgressRef.current) return;
      saveAt(offsetSecondsRef.current + video.currentTime, done);
    };
    const onTime = () => {
      const seconds = offsetSecondsRef.current + video.currentTime;
      const whole = Math.floor(seconds);
      if (whole === lastSecond) return;
      lastSecond = whole;
      setNow(seconds);
      if (length) setFinishAt(formatFinishTime(Math.max(0, (length - seconds) / (video.playbackRate || 1))));
    };
    const onPlay = () => {
      setPaused(false);
      onTime();
    };
    const onPause = () => {
      setPaused(true);
      persist(false);
    };
    const pulse = trackProgress
      ? window.setInterval(() => {
          if (!video.paused && video.currentTime > 1) persist(false);
        }, 8_000)
      : undefined;
    const onHide = () => persist(false);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("narwhal-quit", onHide);
    const onVideoEnded = () => {
      if (!Number.isFinite(video.duration) || video.duration < 8 || video.currentTime < 8) {
        if (errorStep.current < 2) {
          errorStep.current += 1;
          setForceTranscode(true);
          setHardTranscode(true);
          setStartTicks(0);
          setWaiting(true);
          setPlayError("This file needed a full convert. Starting again…");
          return;
        }
      }
      persist(true);
      endedRef.current?.();
    };
    video.addEventListener("ended", onVideoEnded);
    window.addEventListener("pagehide", onHide);
    return () => {
      persist(false);
      if (pulse) window.clearInterval(pulse);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onVideoEnded);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("narwhal-quit", onHide);
      window.removeEventListener("pagehide", onHide);
    };
    // `src` is included because the <video> element remounts (its `key`
    // includes `src`) whenever playback mode changes — e.g. once we learn a
    // title needs HLS. Without it, these listeners stay attached to the old,
    // now-detached element and the clock/progress bar stop updating.
  }, [item.Id, item.RunTimeTicks, startTicks, userId, length, src, trackProgress]);

  const percent = length ? Math.min(100, (now / length) * 100) : 0;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !synced) return;
    video.volume = volume;
    video.muted = muted;
  }, [volume, muted, synced]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let started = false;
    let seeking = false;
    let cancelled = false;
    setWaiting(true);
    setSynced(false);
    video.pause();
    offsetSecondsRef.current = ticksToSeconds(startTicks);
    const goal = startTicks > 0 ? 0 : resumeGoal.current;

    function escalate() {
      if (cancelled) return;
      if (errorStep.current === 0) {
        errorStep.current = 1;
        setForceTranscode(true);
        setStartTicks(Math.round((now || resumeGoal.current) * 10_000_000));
        setWaiting(true);
        setPlayError("This file needs a browser copy. Jellyfin is converting it…");
        return;
      }
      if (errorStep.current === 1) {
        errorStep.current = 2;
        setHardTranscode(true);
        setStartTicks(Math.round((now || resumeGoal.current) * 10_000_000));
        setWaiting(true);
        setPlayError("Trying a full convert. This can take a few seconds…");
        return;
      }
      setWaiting(false);
      setPlayError("This title still will not start. If it is a disc image (ISO) or unsupported rip, play it in the Jellyfin app.");
    }

    let hls: Hls | null = null;
    if (usingHls) {
      if (Hls.isSupported()) {
        hls = new Hls({
          maxBufferLength: 20,
          maxMaxBufferLength: 40,
          startFragPrefetch: true,
        });
        hlsRef.current = hls;
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) escalate();
        });
        hls.loadSource(src);
        hls.attachMedia(video);
      } else {
        setWaiting(false);
        setPlayError("This browser build can't play converted video.");
        return () => {
          cancelled = true;
        };
      }
    } else {
      video.src = src;
    }

    async function startSynced() {
      if (started || cancelled || !video) return;
      started = true;
      video.muted = mutedRef.current;
      video.volume = volume;
      try {
        await video.play();
      } catch {
        started = false;
        setWaiting(false);
        return;
      }
      if (cancelled) return;
      setSynced(true);
      setWaiting(false);
    }
    const restartFromResume = () => {
      if (resumeRedirect.current || goal <= 10 || startTicks > 0) return false;
      resumeRedirect.current = true;
      setForceTranscode(true);
      setStartTicks(Math.round(goal * 10_000_000));
      return true;
    };
    const tryStart = (force = false) => {
      if (started || seeking || cancelled) return;
      if (goal > 10 && startTicks === 0) {
        // hls.js can seek within an HLS session the same as a plain <video>
        // once it knows the seekable range — only restart the whole stream
        // (which doesn't reliably honor a start position for HLS) as a last
        // resort, when the target isn't seekable yet.
        if (canSeekTo(video, goal)) {
          if (Math.abs(video.currentTime - goal) > 1.25) {
            seeking = true;
            video.currentTime = goal;
            return;
          }
        } else if (video.seekable.length > 0 || force) {
          if (restartFromResume()) return;
        }
      }
      if (video.readyState < 3) return;
      void startSynced();
    };
    const onSeeked = () => {
      seeking = false;
      tryStart(false);
    };
    const onReady = () => tryStart(true);
    const onProgress = () => tryStart(false);
    const onMeta = () => {
      if (Number.isFinite(video.duration) && video.duration > 1) {
        setStreamLength(video.duration + offsetSecondsRef.current);
      }
      const full = ticksToSeconds(item.RunTimeTicks);
      const offset = ticksToSeconds(startTicks);
      // If Jellyfin ignored StartTimeTicks, this is the whole movie from 0 —
      // seek to where we were instead of showing 0:00 while the clock stays at 19:00.
      if (offset > 10 && full > 60 && Number.isFinite(video.duration) && video.duration >= full * 0.85) {
        offsetSecondsRef.current = 0;
        setStreamLength(video.duration);
        if (Math.abs(video.currentTime - offset) > 1.25) {
          seeking = true;
          video.currentTime = offset;
          return;
        }
      }
      tryStart(false);
    };
    video.addEventListener("canplaythrough", onReady);
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("progress", onProgress);
    video.addEventListener("loadeddata", onProgress);
    video.addEventListener("seeked", onSeeked);
    const giveUp = window.setTimeout(() => {
      if (started || seeking || cancelled) return;
      if (restartFromResume()) return;
      void startSynced();
    }, 15_000);
    return () => {
      cancelled = true;
      video.removeEventListener("canplaythrough", onReady);
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("progress", onProgress);
      video.removeEventListener("loadeddata", onProgress);
      video.removeEventListener("seeked", onSeeked);
      window.clearTimeout(giveUp);
      if (hls) {
        hls.destroy();
        hlsRef.current = null;
      }
    };
  }, [src, usingHls, item.RunTimeTicks]);

  useEffect(() => {
    const onFull = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFull);
    return () => document.removeEventListener("fullscreenchange", onFull);
  }, []);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  }

  async function toggleFullscreen() {
    const node = rootRef.current;
    if (!node) return;
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
    else await node.requestFullscreen().catch(() => undefined);
  }

  function bumpChrome() {
    setChromeVisible(true);
    if (hideChromeTimer.current) window.clearTimeout(hideChromeTimer.current);
    hideChromeTimer.current = null;
    if (paused || settingsOpen || !synced || waiting) return;
    hideChromeTimer.current = window.setTimeout(() => {
      setChromeVisible(false);
      setSettingsOpen(false);
    }, 3000);
  }

  useEffect(() => {
    bumpChrome();
    return () => {
      if (hideChromeTimer.current) window.clearTimeout(hideChromeTimer.current);
    };
  }, [paused, settingsOpen, synced, waiting, item.Id]);

  const chromeShown = chromeVisible || paused || settingsOpen || !synced || waiting;

  return (
    <div
      ref={rootRef}
      className={`relative size-full overflow-hidden bg-black ${chromeShown ? "" : "cursor-none"}`}
      onMouseMove={bumpChrome}
      onPointerDown={bumpChrome}
      onTouchStart={bumpChrome}
    >
      <div className="pointer-events-none absolute -left-16 -top-20 size-72 rounded-full bg-[#00A4DC]/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-10 top-0 size-64 rounded-full bg-[#AA5CC3]/20 blur-3xl" />
      <video
        ref={videoRef}
        key={`${item.Id}-${src}`}
        className={`absolute inset-0 m-auto bg-black ${synced ? "" : "opacity-0"} ${viewClass(view)}`}
        playsInline
        preload="auto"
        onWaiting={() => {
          if (synced) setWaiting(true);
        }}
        onPlaying={() => {
          setPlayError(null);
          if (synced) setWaiting(false);
        }}
        onCanPlay={() => {
          if (synced) setWaiting(false);
        }}
        onError={() => {
          if (errorStep.current === 0) {
            errorStep.current = 1;
            setForceTranscode(true);
            setStartTicks(Math.round((now || resumeGoal.current) * 10_000_000));
            setWaiting(true);
            setPlayError("This file needs a browser copy. Jellyfin is converting it…");
            return;
          }
          if (errorStep.current === 1) {
            errorStep.current = 2;
            setHardTranscode(true);
            setStartTicks(Math.round((now || resumeGoal.current) * 10_000_000));
            setWaiting(true);
            setPlayError("Trying a full convert. This can take a few seconds…");
            return;
          }
          setWaiting(false);
          setPlayError("This title still will not start. If it is a disc image (ISO) or unsupported rip, play it in the Jellyfin app.");
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
      {waiting && !playError && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <NarwhalSpinner label="Lining up picture and sound…" />
        </div>
      )}
      {playError && (
        <div className="pointer-events-none absolute inset-x-0 bottom-28 z-10 flex justify-center px-4">
          <p className="max-w-lg rounded-2xl border border-[#00A4DC]/30 bg-black/70 px-4 py-3 text-center text-sm text-white/85">
            {playError}
          </p>
        </div>
      )}
      <button
        type="button"
        aria-label={paused ? "Play" : "Pause"}
        className={`absolute inset-x-0 z-[15] cursor-pointer bg-transparent ${
          chromeShown ? (settingsOpen ? "top-72" : "top-24") : "top-0"
        } ${chromeShown ? "bottom-40" : "bottom-0"}`}
        onClick={() => togglePlay()}
      />
      <div
        className={`pointer-events-auto absolute inset-x-0 top-0 z-40 bg-gradient-to-b from-black/85 via-black/30 to-transparent px-4 pt-4 pb-12 transition-opacity duration-300 ${
          chromeShown ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            className="size-10 shrink-0 rounded-full border-[#00A4DC]/40 bg-black/40 text-white hover:bg-[#00A4DC]/20 hover:text-white"
            onClick={() => goBack()}
            aria-label="Back"
          >
            <ArrowLeft />
          </Button>
          <div className="min-w-0 flex-1 overflow-hidden pr-2">
            <Link
              href={playerTitleHref(item)}
              onClick={() => saveAt(displaySeconds(), false)}
              className="block truncate text-xl font-semibold tracking-tight text-white hover:underline sm:text-2xl"
            >
              {headline}
            </Link>
            {detail && <p className="mt-0.5 truncate text-sm text-white/65">{detail}</p>}
          </div>
          <div className="relative flex shrink-0 items-center gap-2">
            {finishAt && (
              <p className="hidden rounded-full border border-white/10 bg-black/55 px-3 py-1 text-sm text-white sm:block">
                Ends {finishAt}
              </p>
            )}
            <Button
              variant="outline"
              size="icon"
              className="size-10 rounded-full border-[#AA5CC3]/40 bg-black/40 text-white hover:bg-[#AA5CC3]/20 hover:text-white"
              onClick={() => setSettingsOpen((open) => !open)}
              aria-label="Playback settings"
            >
              <Settings />
            </Button>
            {settingsOpen && (
              <div
                data-no-toggle
                className="absolute top-12 right-0 z-50 w-[22rem] rounded-2xl border border-white/10 bg-[#0c0c0e]/95 p-4 shadow-xl shadow-[#AA5CC3]/10 sm:w-[26rem]"
              >
                <p className="mb-3 text-xs font-semibold tracking-wide text-[#00A4DC] uppercase">Playback</p>
                <TrackPickers
                  sounds={sounds}
                  tracks={tracks}
                  audio={audio}
                  track={track}
                  onAudio={pickAudio}
                  onTrack={setTrack}
                />
                <div className="mt-4 space-y-3 border-t border-white/10 pt-3">
                  <p className="text-xs font-semibold tracking-wide text-[#AA5CC3] uppercase">Sound</p>
                  <label className="flex items-center gap-3 text-sm text-white/80">
                    <button
                      type="button"
                      className="rounded-full border border-white/15 p-2 text-white"
                      onClick={() => setMuted((value) => !value)}
                      aria-label={muted ? "Unmute" : "Mute"}
                    >
                      {muted || volume === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={muted ? 0 : volume}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        setVolume(next);
                        setMuted(next === 0);
                      }}
                      className="h-2 w-full accent-[#00A4DC]"
                    />
                  </label>
                  <p className="text-xs font-semibold tracking-wide text-[#AA5CC3] uppercase">View</p>
                  <div className="grid grid-cols-2 gap-2">
                    {VIEWS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setView(option.id)}
                        className={`h-10 rounded-xl border text-sm ${
                          view === option.id
                            ? "border-[#00A4DC] bg-[#00A4DC]/20 text-white"
                            : "border-white/15 text-white/70 hover:bg-white/8"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => toggleFullscreen()}
                      className={`col-span-2 flex h-10 items-center justify-center gap-2 rounded-xl border text-sm ${
                        fullscreen
                          ? "border-[#AA5CC3] bg-[#AA5CC3]/20 text-white"
                          : "border-white/15 text-white/70 hover:bg-white/8"
                      }`}
                    >
                      {fullscreen ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
                      {fullscreen ? "Exit fullscreen" : "Fullscreen"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        data-no-toggle
        className={`absolute inset-x-0 bottom-0 z-40 bg-gradient-to-t from-black via-black/80 to-transparent px-4 pb-5 pt-14 transition-opacity duration-300 sm:px-6 lg:px-10 ${
          chromeShown ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="w-full">
          <div
            ref={barRef}
            role="slider"
            aria-valuemin={0}
            aria-valuemax={length || 0}
            aria-valuenow={now}
            aria-label="Seek"
            tabIndex={0}
            className="group relative h-12 cursor-pointer sm:h-14"
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              onBarPointer(event);
            }}
            onPointerMove={(event) => {
              if (event.buttons) onBarPointer(event);
            }}
          >
            <div className="absolute top-1/2 h-2 w-full -translate-y-1/2 rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#00A4DC] to-[#AA5CC3]"
                style={{ width: `${percent}%` }}
              />
            </div>
            <div
              className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_12px_rgba(0,164,220,0.65)]"
              style={{ left: `${percent}%` }}
            />
          </div>
          <div className="mt-2 flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="size-10 rounded-full border-[#00A4DC]/40 bg-black/40 text-white hover:bg-[#00A4DC]/20 hover:text-white"
              onClick={() => togglePlay()}
              aria-label={paused ? "Play" : "Pause"}
            >
              {paused ? <Play className="fill-current" /> : <Pause />}
            </Button>
            <p className="min-w-[7.5rem] font-medium tabular-nums text-white">
              {formatClock(now)}
              <span className="text-white/45"> / {formatClock(length)}</span>
            </p>
            <label className="ml-auto flex items-center gap-2">
              <button
                type="button"
                className="rounded-full border border-white/15 p-2 text-white"
                onClick={() => setMuted((value) => !value)}
                aria-label={muted ? "Unmute" : "Mute"}
              >
                {muted || volume === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setVolume(next);
                  setMuted(next === 0);
                }}
                className="h-2 w-24 accent-[#00A4DC] sm:w-36"
              />
            </label>
            <Button
              variant="outline"
              size="icon"
              className="size-10 rounded-full border-[#AA5CC3]/40 bg-black/40 text-white hover:bg-[#AA5CC3]/20 hover:text-white"
              onClick={() => toggleFullscreen()}
              aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {fullscreen ? <Minimize /> : <Maximize />}
            </Button>
          </div>
        </div>
      </div>

      {paused && synced && (
        <div
          className="absolute inset-0 z-20 flex items-end bg-gradient-to-t from-black via-black/70 to-transparent px-8 py-8 sm:px-16"
          onClick={() => togglePlay()}
        >
          <div className="max-w-2xl pb-28 pt-24">
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
                <span className="rounded-full bg-[#00A4DC]/20 px-3 py-1 text-[#7dd3fc]">
                  {formatRuntime(item.RunTimeTicks)}
                  {finishAt ? ` · ends ${finishAt}` : ""}
                </span>
              )}
            </div>
            {item.Overview && (
              <p className="mt-4 line-clamp-3 text-base leading-relaxed text-white/80">{item.Overview}</p>
            )}
            {(sounds.length > 0 || tracks.length > 0) && (
              <div
                className="mt-5 w-full max-w-md rounded-2xl border border-white/10 bg-black/40 p-4"
                onClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <TrackPickers
                  sounds={sounds}
                  tracks={tracks}
                  audio={audio}
                  track={track}
                  onAudio={pickAudio}
                  onTrack={setTrack}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
