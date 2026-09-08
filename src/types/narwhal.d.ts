type NarwhalDesktop = {
  isDesktop: true;
  pickSavePath: (filename: string) => Promise<string | null>;
  startDownload: (url: string, filePath: string) => Promise<{ ok: boolean; path: string }>;
  cancelDownload: (filePath: string) => Promise<void>;
  deleteFile: (filePath: string) => Promise<{ ok: boolean }>;
  openExternal: (url: string) => Promise<void>;
  onDownloadProgress: (
    listener: (payload: { filePath: string; received: number; total: number }) => void
  ) => () => void;
};

interface Window {
  narwhal?: NarwhalDesktop;
}
