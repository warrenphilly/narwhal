"use client";

import { AppShell } from "@/components/app-shell";
import { LibraryHome } from "@/components/home-screen";
import { LoginScreen } from "@/components/login-screen";
import { useSession } from "@/components/session-provider";

export default function MoviesPage() {
  const { session, preview } = useSession();

  if (!session?.signedIn && !preview) {
    return <LoginScreen />;
  }

  return (
    <AppShell>
      <LibraryHome kind="movies" />
    </AppShell>
  );
}
