"use client";

import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { HomeScreen } from "@/components/home-screen";
import { LoginScreen } from "@/components/login-screen";
import { useSession } from "@/components/session-provider";

export default function HomePage() {
  const { session, preview } = useSession();

  if (!session?.signedIn && !preview) {
    return <LoginScreen />;
  }

  return (
    <AppShell>
      <Suspense
        fallback={
          <div className="flex min-h-[70vh] items-center justify-center text-zinc-500">
            Loading your library…
          </div>
        }
      >
        <HomeScreen />
      </Suspense>
    </AppShell>
  );
}
