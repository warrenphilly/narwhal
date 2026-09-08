type NarwhalDesktop = {
  isDesktop: true;
  pickSavePath: (filename: string) => Promise<string | null>;
  startDownload: (url: string, filePath: string) => Promise<{ ok: boolean; path: string }>;
  onDownloadProgress: (
    listener: (payload: { filePath: string; received: number; total: number }) => void
  ) => () => void;
};

interface Window {
  narwhal?: NarwhalDesktop;
}
