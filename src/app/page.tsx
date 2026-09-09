"use client";

import { AppShell } from "@/components/app-shell";
import { LibraryHome } from "@/components/home-screen";
import { LoginScreen } from "@/components/login-screen";
import { PageSpinner } from "@/components/narwhal-spinner";
import { useSession } from "@/components/session-provider";

export default function HomePage() {
  const { session, loading, preview } = useSession();

  if (loading) return <PageSpinner label="Waking Narwhal…" />;
  if (!session?.signedIn && !preview) return <LoginScreen />;

  return (
    <AppShell>
      <LibraryHome kind="home" />
    </AppShell>
  );
}
