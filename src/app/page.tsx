"use client";

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
      <HomeScreen />
    </AppShell>
  );
}
