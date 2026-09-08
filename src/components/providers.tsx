"use client";

import { DownloadsProvider } from "@/components/downloads-provider";
import { ProfileProvider } from "@/components/profile-provider";
import { SessionProvider } from "@/components/session-provider";
import { ThemeProvider } from "@/components/theme-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SessionProvider>
        <ProfileProvider>
          <DownloadsProvider>{children}</DownloadsProvider>
        </ProfileProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
