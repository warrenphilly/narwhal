"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
  removeDownload: (id: string) => void;
  deleteDownload: (id: string) => Promise<void>;
};

const DownloadsContext = createContext<DownloadsContextValue | null>(null);
const STORAGE_KEY = "narwhal.downloads";

function isDiskPath(value?: string) {
  return Boolean(value && (value.startsWith("/") || /^[A-Za-z]:[\\/]/.test(value)));
}

function readDownloads(): DownloadRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DownloadRecord[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((row) =>
      row.status === "saving" ? { ...row, status: "error", error: "Stopped when the app closed." } : row
    );
  } catch {
    return [];
  }
}

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
  const [downloads, setDownloads] = useState<DownloadRecord[]>(() => readDownloads());

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(downloads));
  }, [downloads]);

  const patch = useCallback((id: string, update: Partial<DownloadRecord>) => {
    setDownloads((current) =>
      current.map((item) => (item.id === id ? { ...item, ...update } : item))
    );
  }, []);

  const removeDownload = useCallback((id: string) => {
    setDownloads((current) => current.filter((item) => item.id !== id));
  }, []);

  const deleteDownload = useCallback(
    async (id: string) => {
      const record = downloads.find((item) => item.id === id);
      if (!record) return;
      if (record.status === "saving" && record.savedPath && window.narwhal?.cancelDownload) {
        await window.narwhal.cancelDownload(record.savedPath).catch(() => undefined);
      }
      if (record.savedPath && isDiskPath(record.savedPath) && window.narwhal?.deleteFile) {
        await window.narwhal.deleteFile(record.savedPath);
      }
      removeDownload(id);
    },
    [downloads, removeDownload]
  );

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
        patch(id, { savedPath: filePath });
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
    () => ({ downloads, downloadMovie, removeDownload, deleteDownload }),
    [downloads, downloadMovie, removeDownload, deleteDownload]
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
  if (record.status === "done") {
    return record.savedPath && isDiskPath(record.savedPath) ? record.savedPath : "Saved on this laptop";
  }
  if (record.total) {
    const pct = Math.min(100, Math.round((record.received / record.total) * 100));
    return `${pct}% · ${formatBytes(record.received)} of ${formatBytes(record.total)}`;
  }
  return record.received ? `Saving ${formatBytes(record.received)}` : "Starting…";
}

export function canDeleteFile(record: DownloadRecord) {
  return isDiskPath(record.savedPath);
}
