export function ticksToSeconds(ticks?: number) {
  if (!ticks) return 0;
  return ticks / 10_000_000;
}

export function formatClock(totalSeconds: number) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "0:00";
  const s = Math.floor(totalSeconds);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  if (hours) return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatFinishTime(remainingSeconds: number) {
  if (!Number.isFinite(remainingSeconds) || remainingSeconds <= 0) return "";
  const finish = new Date(Date.now() + remainingSeconds * 1000);
  return finish.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function episodeLabel(item?: { ParentIndexNumber?: number; IndexNumber?: number; Name?: string } | null) {
  if (!item) return "";
  if (item.ParentIndexNumber && item.IndexNumber) {
    return `S${item.ParentIndexNumber} · E${item.IndexNumber}`;
  }
  return item.Name ?? "";
}
