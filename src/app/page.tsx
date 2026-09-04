"use client";

import { AppShell } from "@/components/app-shell";
import { HomeScreen } from "@/components/home-screen";
import { LoginScreen } from "@/components/login-screen";
import { useSession } from "@/components/session-provider";

export default function HomePage() {
  const { session, loading, preview } = useSession();

  if (loading) {
    return (
      <div className="tv-root flex min-h-full items-center justify-center text-white/50">
        Starting Cinema…
      </div>
    );
  }

  if (!session?.signedIn && !preview) {
    return <LoginScreen />;
  }

  return (
    <AppShell>
      <HomeScreen />
    </AppShell>
  );
}
