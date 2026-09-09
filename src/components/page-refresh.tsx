"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearHomeCache } from "@/lib/home-cache";
import { cn } from "@/lib/utils";

export const REFRESH_EVENT = "narwhal-refresh";

export function requestAppRefresh() {
  clearHomeCache();
  window.dispatchEvent(new Event(REFRESH_EVENT));
}

export function PageRefreshButton({ className }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const onRefresh = useCallback(() => {
    setBusy(true);
    requestAppRefresh();
    router.refresh();
    window.setTimeout(() => setBusy(false), 800);
  }, [router]);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("h-8 gap-1.5 rounded-full px-3 text-xs sm:h-9 sm:text-sm", className)}
      onClick={onRefresh}
      disabled={busy}
      title="Refresh this page"
    >
      <RefreshCw className={cn("size-3.5", busy && "animate-spin")} />
      Refresh
    </Button>
  );
}
