"use client";

import { AppShell } from "@/components/app-shell";
import { LoginScreen } from "@/components/login-screen";
import { useDownloads, progressLabel } from "@/components/downloads-provider";
import { useSession } from "@/components/session-provider";
import { Progress } from "@/components/ui/progress";
import { formatBytes } from "@/lib/jellyfin-types";

export default function DownloadsPage() {
  const { session, loading, preview } = useSession();
  const { downloads } = useDownloads();

  if (loading) return <div className="tv-root min-h-full" />;
  if (!session?.signedIn && !preview) return <LoginScreen />;

  return (
    <AppShell>
      <div className="page-gutter mx-auto max-w-3xl py-10">
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900">Downloads</h1>
        <p className="mt-2 text-zinc-500">
          Movies you save land on this laptop. Chrome and Edge can pick a folder; other browsers use the usual Downloads folder.
        </p>
        {downloads.length === 0 ? (
          <div className="mt-16 rounded-3xl border border-zinc-200 bg-white px-6 py-16 text-center">
            <p className="text-lg text-zinc-900">Nothing saved yet</p>
            <p className="mt-2 text-sm text-zinc-500">
              Open a movie and choose Download. Your Jellyfin user needs download permission.
            </p>
          </div>
        ) : (
          <ul className="mt-10 space-y-3">
            {downloads.map((item) => {
              const pct =
                item.total && item.total > 0
                  ? Math.min(100, Math.round((item.received / item.total) * 100))
                  : item.status === "done"
                    ? 100
                    : 8;
              return (
                <li
                  key={item.id}
                  className="rounded-2xl border border-zinc-200 bg-white px-5 py-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-zinc-900">
                        {item.title}
                        {item.year ? ` (${item.year})` : ""}
                      </p>
                      <p className="mt-1 text-sm text-zinc-500">{progressLabel(item)}</p>
                    </div>
                    <p className="text-xs text-zinc-400">
                      {item.total ? formatBytes(item.total) : item.filename}
                    </p>
                  </div>
                  <Progress value={pct} className="mt-3 h-1.5" />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
