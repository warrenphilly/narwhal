"use client";

import { DownloadsProvider } from "@/components/downloads-provider";
import { SessionProvider } from "@/components/session-provider";
import { ThemeProvider } from "@/components/theme-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SessionProvider>
        <DownloadsProvider>{children}</DownloadsProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
