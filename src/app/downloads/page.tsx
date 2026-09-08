"use client";

import { AppShell } from "@/components/app-shell";
import { PageBack } from "@/components/back-button";
import { LoginScreen } from "@/components/login-screen";
import { canDeleteFile, progressLabel, useDownloads } from "@/components/downloads-provider";
import { PageSpinner } from "@/components/narwhal-spinner";
import { Button } from "@/components/ui/button";
import { useSession } from "@/components/session-provider";
import { Progress } from "@/components/ui/progress";
import { formatBytes } from "@/lib/jellyfin-types";

export default function DownloadsPage() {
  const { session, loading, preview } = useSession();
  const { downloads, removeDownload, deleteDownload } = useDownloads();

  if (loading) return <PageSpinner label="Waking Narwhal…" />;
  if (!session?.signedIn && !preview) return <LoginScreen />;

  return (
    <AppShell>
      <div className="page-gutter mx-auto max-w-3xl py-6">
        <PageBack />
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Downloads</h1>
        <p className="mt-2 text-zinc-500">
          Remove takes a title off this list. Delete file also erases it from the laptop when Narwhal knows the path.
        </p>
        {downloads.length === 0 ? (
          <div className="mt-16 rounded-3xl border border-zinc-200 bg-white px-6 py-16 text-center dark:border-white/10 dark:bg-zinc-900">
            <p className="text-lg text-zinc-900 dark:text-zinc-50">Nothing saved yet</p>
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
                  className="rounded-2xl border border-zinc-200 bg-white px-5 py-4 dark:border-white/10 dark:bg-zinc-900"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium text-zinc-900 dark:text-zinc-50">
                        {item.title}
                        {item.year ? ` (${item.year})` : ""}
                      </p>
                      <p className="mt-1 break-all text-sm text-zinc-500">{progressLabel(item)}</p>
                    </div>
                    <p className="shrink-0 text-xs text-zinc-400">
                      {item.total ? formatBytes(item.total) : item.filename}
                    </p>
                  </div>
                  <Progress value={pct} className="mt-3 h-1.5" />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => removeDownload(item.id)}>
                      {item.status === "saving" ? "Hide" : "Remove"}
                    </Button>
                    {(canDeleteFile(item) || item.status === "saving") && (
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        className="rounded-full"
                        onClick={() => deleteDownload(item.id).catch(() => undefined)}
                      >
                        {item.status === "saving" ? "Cancel and delete" : "Delete file"}
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
