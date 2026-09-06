export function ticksToSeconds(ticks?: number) {
  if (!ticks) return 0;
  return ticks / 10_000_000;
}

export function formatFinishTime(remainingSeconds: number) {
  if (!Number.isFinite(remainingSeconds) || remainingSeconds <= 0) return "";
  const finish = new Date(Date.now() + remainingSeconds * 1000);
  return finish.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function episodeLabel(item: { ParentIndexNumber?: number; IndexNumber?: number; Name?: string }) {
  if (item.ParentIndexNumber && item.IndexNumber) {
    return `S${item.ParentIndexNumber} · E${item.IndexNumber}`;
  }
  return item.Name ?? "";
}
