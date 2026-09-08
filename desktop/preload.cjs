const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("narwhal", {
  isDesktop: true,
  pickSavePath: (filename) => ipcRenderer.invoke("narwhal:pick-save", filename),
  startDownload: (url, filePath) => ipcRenderer.invoke("narwhal:start-download", { url, filePath }),
  onDownloadProgress: (listener) => {
    const handler = (_event, payload) => listener(payload);
    ipcRenderer.on("narwhal:download-progress", handler);
    return () => ipcRenderer.removeListener("narwhal:download-progress", handler);
  },
});
