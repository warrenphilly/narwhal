"use client";

import { DownloadsProvider } from "@/components/downloads-provider";
import { SessionProvider } from "@/components/session-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <DownloadsProvider>{children}</DownloadsProvider>
    </SessionProvider>
  );
}
