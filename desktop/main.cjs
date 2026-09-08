const { app, BrowserWindow, dialog, ipcMain, shell, utilityProcess } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const path = require("node:path");
const net = require("node:net");

const VIDEO_EXT = new Set([".mp4", ".mkv", ".avi", ".mov", ".m4v", ".webm", ".ts", ".m2ts"]);
const activeSaves = new Map();

let child = null;
let serverUrl = "";

function iconPath() {
  if (app.isPackaged) return path.join(process.resourcesPath, "icon.png");
  return path.join(__dirname, "..", "public", "icon.png");
}

function portFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

async function pickPort(start) {
  for (let port = start; port < start + 20; port += 1) {
    if (await portFree(port)) return port;
  }
  throw new Error("Could not find a free port for Narwhal.");
}

async function waitForServer(url) {
  for (let i = 0; i < 80; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 307 || response.status === 404) return;
    } catch {
      // still starting
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error("Narwhal did not start.");
}

function packedServerJs() {
  const serverDir = path.join(process.resourcesPath, "server");
  const nested = path.join(serverDir, "server.js");
  const named = path.join(serverDir, "narwhal", "server.js");
  if (fsSync.existsSync(nested)) return { serverDir, serverJs: nested };
  if (fsSync.existsSync(named)) return { serverDir: path.join(serverDir, "narwhal"), serverJs: named };
  return { serverDir, serverJs: nested };
}

async function startPackedServer() {
  const port = await pickPort(43147);
  const url = `http://127.0.0.1:${port}`;
  const { serverDir, serverJs } = packedServerJs();
  if (!fsSync.existsSync(serverJs)) {
    throw new Error(`Missing packed server at ${serverJs}`);
  }
  // Do not spawn process.execPath (Narwhal.app/Contents/MacOS/Narwhal).
  // On macOS that opens a second Dock item that looks like a .exec, and the
  // real window hangs waiting for a server that never starts.
  child = utilityProcess.fork(serverJs, [], {
    cwd: serverDir,
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
    },
    stdio: "pipe",
    serviceName: "narwhal-next",
  });
  await waitForServer(url);
  return url;
}

async function startUrl() {
  if (process.env.NARWHAL_URL) return process.env.NARWHAL_URL;
  if (app.isPackaged) return startPackedServer();
  return "http://127.0.0.1:43147";
}

function createWindow(url) {
  const win = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 720,
    minHeight: 560,
    title: "Narwhal",
    icon: iconPath(),
    backgroundColor: "#09090b",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  win.loadURL(url);
}

function appleScriptString(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function openInDefaultBrowser(url) {
  if (process.platform !== "darwin") return shell.openExternal(url);
  return new Promise((resolve, reject) => {
    // `shell.openExternal` / `open` often only drop the URL in Safari/Chrome
    // without navigating. AppleScript `open location` actually loads it.
    const task = spawn("osascript", ["-e", `open location ${appleScriptString(url)}`], {
      stdio: "ignore",
    });
    task.on("error", () => {
      shell.openExternal(url).then(resolve, reject);
    });
    task.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      shell.openExternal(url).then(resolve, reject);
    });
  });
}

ipcMain.handle("narwhal:open-external", async (_event, url) => {
  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) return;
  await openInDefaultBrowser(url);
});

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
      activeSaves.set(filePath, item);
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
        activeSaves.delete(filePath);
        session.removeListener("will-download", onWillDownload);
        if (state === "completed") resolve({ ok: true, path: filePath });
        else reject(new Error(state === "cancelled" ? "Save canceled." : "Download failed."));
      });
    };
    session.on("will-download", onWillDownload);
    win.webContents.downloadURL(url);
  });
});

ipcMain.handle("narwhal:cancel-download", async (_event, filePath) => {
  if (typeof filePath !== "string") return;
  const item = activeSaves.get(filePath);
  if (item) item.cancel();
});

ipcMain.handle("narwhal:delete-file", async (_event, filePath) => {
  if (typeof filePath !== "string" || !path.isAbsolute(filePath)) {
    throw new Error("That file path is not valid.");
  }
  if (!VIDEO_EXT.has(path.extname(filePath).toLowerCase())) {
    throw new Error("Only downloaded video files can be deleted.");
  }
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error && error.code === "ENOENT") return { ok: true };
    throw error;
  }
  return { ok: true };
});

app.commandLine.appendSwitch("ignore-gpu-blocklist");

app.whenReady().then(async () => {
  if (process.platform === "darwin") {
    app.dock.setIcon(iconPath());
  }
  try {
    serverUrl = await startUrl();
  } catch (error) {
    dialog.showErrorBox("Narwhal could not start", error instanceof Error ? error.message : String(error));
    app.quit();
    return;
  }
  createWindow(serverUrl);
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0 && serverUrl) createWindow(serverUrl);
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

let quitting = false;
app.on("before-quit", (event) => {
  if (quitting) {
    try {
      child?.kill();
    } catch {
      /* already gone */
    }
    return;
  }
  event.preventDefault();
  quitting = true;
  Promise.all(
    BrowserWindow.getAllWindows().map((win) =>
      win.webContents.executeJavaScript("window.dispatchEvent(new Event('narwhal-quit')); true;").catch(() => undefined)
    )
  )
    .then(() => new Promise((resolve) => setTimeout(resolve, 500)))
    .then(() => app.quit());
});
