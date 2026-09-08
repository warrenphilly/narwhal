const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("node:path");

const startUrl = process.env.NARWHAL_URL || "http://127.0.0.1:43147";

function createWindow() {
  const win = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 720,
    minHeight: 560,
    title: "Narwhal",
    backgroundColor: "#09090b",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.loadURL(startUrl);
}

ipcMain.handle("narwhal:pick-save", async (event, filename) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showSaveDialog(win ?? undefined, {
    defaultPath: filename,
    filters: [{ name: "Video", extensions: ["mp4", "mkv", "avi", "mov", "m4v", "webm"] }],
  });
  return result.canceled ? null : result.filePath;
});

ipcMain.handle("narwhal:start-download", async (event, { url, filePath }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) throw new Error("No window");

  return new Promise((resolve, reject) => {
    const session = win.webContents.session;
    const onWillDownload = (_e, item) => {
      item.setSavePath(filePath);
      item.on("updated", (_updateEvent, state) => {
        if (state === "progressing") {
          win.webContents.send("narwhal:download-progress", {
            filePath,
            received: item.getReceivedBytes(),
            total: item.getTotalBytes(),
          });
        }
      });
      item.once("done", (_doneEvent, state) => {
        session.removeListener("will-download", onWillDownload);
        if (state === "completed") resolve({ ok: true, path: filePath });
        else reject(new Error(state === "cancelled" ? "Save canceled." : "Download failed."));
      });
    };
    session.on("will-download", onWillDownload);
    win.webContents.downloadURL(url);
  });
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
