"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { fileNameForItem, formatBytes } from "@/lib/jellyfin-types";
import type { JellyfinItem } from "@/lib/jellyfin-types";
import { isDemoId } from "@/lib/demo-library";
import { downloadUrl } from "@/lib/client-api";

export type DownloadRecord = {
  id: string;
  title: string;
  year?: number;
  filename: string;
  status: "saving" | "done" | "error";
  received: number;
  total?: number;
  error?: string;
  savedPath?: string;
  startedAt: number;
};

type DownloadsContextValue = {
  downloads: DownloadRecord[];
  downloadMovie: (item: JellyfinItem) => Promise<void>;
};

const DownloadsContext = createContext<DownloadsContextValue | null>(null);

async function writeWithPicker(filename: string, response: Response, onProgress: (received: number, total?: number) => void) {
  const picker = (
    window as Window & {
      showSaveFilePicker?: (options: {
        suggestedName?: string;
        types?: { description: string; accept: Record<string, string[]> }[];
      }) => Promise<{
        createWritable: () => Promise<{
          write: (data: Uint8Array) => Promise<void>;
          close: () => Promise<void>;
        }>;
      }>;
    }
  ).showSaveFilePicker;
  if (!picker || !response.body) return false;
  const handle = await picker({
    suggestedName: filename,
    types: [
      {
        description: "Movie",
        accept: { "video/*": [".mp4", ".mkv", ".avi", ".mov", ".m4v", ".webm"] },
      },
    ],
  });
  const writable = await handle.createWritable();
  const reader = response.body.getReader();
  const total = Number(response.headers.get("content-length")) || undefined;
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    await writable.write(value);
    onProgress(received, total);
  }
  await writable.close();
  return true;
}

export function DownloadsProvider({ children }: { children: React.ReactNode }) {
  const [downloads, setDownloads] = useState<DownloadRecord[]>([]);

  const patch = useCallback((id: string, update: Partial<DownloadRecord>) => {
    setDownloads((current) =>
      current.map((item) => (item.id === id ? { ...item, ...update } : item))
    );
  }, []);

  const downloadMovie = useCallback(
    async (item: JellyfinItem) => {
      if (isDemoId(item.Id)) {
        throw new Error("Connect your Jellyfin server to download real movies.");
      }
      const filename = fileNameForItem(item);
      const id = `${item.Id}-${Date.now()}`;
      const record: DownloadRecord = {
        id,
        title: item.Name,
        year: item.ProductionYear,
        filename,
        status: "saving",
        received: 0,
        total: item.MediaSources?.[0]?.Size,
        startedAt: Date.now(),
      };
      setDownloads((current) => [record, ...current]);

      const downloadPath = downloadUrl(item.Id, filename);
      const desktop = window.narwhal;

      if (desktop) {
        const filePath = await desktop.pickSavePath(filename);
        if (!filePath) {
          patch(id, { status: "error", error: "Save canceled." });
          return;
        }
        const stop = desktop.onDownloadProgress((payload) => {
          if (payload.filePath !== filePath) return;
          patch(id, {
            received: payload.received,
            total: payload.total || undefined,
          });
        });
        try {
          await desktop.startDownload(downloadPath, filePath);
          patch(id, { status: "done", savedPath: filePath });
        } catch (error) {
          patch(id, {
            status: "error",
            error: error instanceof Error ? error.message : "Download failed.",
          });
          throw error;
        } finally {
          stop();
        }
        return;
      }

      const canPickFile = "showSaveFilePicker" in window;

      if (!canPickFile) {
        const link = document.createElement("a");
        link.href = downloadPath;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        patch(id, { status: "done", savedPath: "Browser downloads folder" });
        return;
      }

      const response = await fetch(downloadPath);
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        patch(id, { status: "error", error: data?.error || "Download failed." });
        throw new Error(data?.error || "Download failed.");
      }

      try {
        await writeWithPicker(filename, response, (received, total) => {
          patch(id, { received, total });
        });
        patch(id, { status: "done", savedPath: filename });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          patch(id, { status: "error", error: "Save canceled." });
          return;
        }
        patch(id, {
          status: "error",
          error: error instanceof Error ? error.message : "Could not save the file.",
        });
      }
    },
    [patch]
  );

  const value = useMemo(
    () => ({ downloads, downloadMovie }),
    [downloads, downloadMovie]
  );

  return (
    <DownloadsContext.Provider value={value}>{children}</DownloadsContext.Provider>
  );
}

export function useDownloads() {
  const ctx = useContext(DownloadsContext);
  if (!ctx) throw new Error("useDownloads must be used inside DownloadsProvider");
  return ctx;
}

export function progressLabel(record: DownloadRecord) {
  if (record.status === "error") return record.error || "Failed";
  if (record.status === "done") return "Saved on this laptop";
  if (record.total) {
    const pct = Math.min(100, Math.round((record.received / record.total) * 100));
    return `${pct}% · ${formatBytes(record.received)} of ${formatBytes(record.total)}`;
  }
  return record.received ? `Saving ${formatBytes(record.received)}` : "Starting…";
}
