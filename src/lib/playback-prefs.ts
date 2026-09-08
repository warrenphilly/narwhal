export type PlaybackPrefs = {
  /** Top safe area for subtitles, in vh (0–24). */
  subtitlePadTop: number;
  /** Bottom safe area for subtitles, in vh (0–24). */
  subtitlePadBottom: number;
  /** Episodes request fullscreen when playback starts. */
  showsStartFullscreen: boolean;
};

const KEY = "narwhal-playback-prefs";

export const DEFAULT_PLAYBACK_PREFS: PlaybackPrefs = {
  subtitlePadTop: 5,
  subtitlePadBottom: 12,
  showsStartFullscreen: true,
};

function clampPad(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(24, Math.max(0, Math.round(value * 10) / 10));
}

export function loadPlaybackPrefs(): PlaybackPrefs {
  if (typeof window === "undefined") return DEFAULT_PLAYBACK_PREFS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PLAYBACK_PREFS;
    const parsed = JSON.parse(raw) as Partial<PlaybackPrefs>;
    return {
      subtitlePadTop: clampPad(parsed.subtitlePadTop ?? DEFAULT_PLAYBACK_PREFS.subtitlePadTop),
      subtitlePadBottom: clampPad(parsed.subtitlePadBottom ?? DEFAULT_PLAYBACK_PREFS.subtitlePadBottom),
      showsStartFullscreen:
        typeof parsed.showsStartFullscreen === "boolean"
          ? parsed.showsStartFullscreen
          : DEFAULT_PLAYBACK_PREFS.showsStartFullscreen,
    };
  } catch {
    return DEFAULT_PLAYBACK_PREFS;
  }
}

export function savePlaybackPrefs(prefs: PlaybackPrefs) {
  const next: PlaybackPrefs = {
    subtitlePadTop: clampPad(prefs.subtitlePadTop),
    subtitlePadBottom: clampPad(prefs.subtitlePadBottom),
    showsStartFullscreen: Boolean(prefs.showsStartFullscreen),
  };
  window.localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("narwhal-playback-prefs"));
  return next;
}
