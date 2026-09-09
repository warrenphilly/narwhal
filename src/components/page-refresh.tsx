"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearHomeCache } from "@/lib/home-cache";
import { cn } from "@/lib/utils";

export const REFRESH_EVENT = "narwhal-refresh";

/** Ask every mounted page to re-fetch Jellyfin data and redraw. */
export function requestAppRefresh() {
  clearHomeCache();
  try {
    window.sessionStorage.setItem("narwhal-img-bust", String(Date.now()));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(REFRESH_EVENT));
}

/** Pages that hold Jellyfin lists/details should listen and bump their reload key. */
export function useAppRefresh(onRefresh: () => void) {
  useEffect(() => {
    function handle() {
      onRefresh();
    }
    window.addEventListener(REFRESH_EVENT, handle);
    return () => window.removeEventListener(REFRESH_EVENT, handle);
  }, [onRefresh]);
}

export function PageRefreshButton({ className }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const onRefresh = useCallback(() => {
    setBusy(true);
    requestAppRefresh();
    // Best-effort: ask Jellyfin to rescan libraries so new downloads show up.
    void import("@/lib/client-api")
      .then(({ refreshJellyfinLibraries }) => refreshJellyfinLibraries())
      .catch(() => undefined)
      .finally(() => {
        // Fire again after scan kicks off so UI picks up fresh items.
        window.setTimeout(() => requestAppRefresh(), 1200);
      });
    router.refresh();
    window.setTimeout(() => setBusy(false), 1600);
  }, [router]);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("h-8 gap-1.5 rounded-full px-3 text-xs sm:h-9 sm:text-sm", className)}
      onClick={onRefresh}
      disabled={busy}
      title="Refresh library and this page"
    >
      <RefreshCw className={cn("size-3.5", busy && "animate-spin")} />
      Refresh
    </Button>
  );
}
