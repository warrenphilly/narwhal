import { spawn } from "node:child_process";
import fs from "node:fs";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { createWriteStream } from "node:fs";

function run(command, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      env,
    });
    child.on("exit", (code) => {
      if (code) reject(new Error(`${command} exited with ${code}`));
      else resolve();
    });
  });
}

function findFile(root, match) {
  const matches = [];
  function walk(dir, depth) {
    if (depth > 4 || !fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      let stat;
      try {
        stat = fs.statSync(full);
      } catch {
        continue;
      }
      if (match(name, stat)) {
        matches.push(full);
        continue;
      }
      if (stat.isDirectory()) walk(full, depth + 1);
    }
  }
  walk(root, 0);
  return matches[0];
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    https
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlinkSync(dest);
          download(res.headers.location, dest).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed (${res.statusCode}): ${url}`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve()));
      })
      .on("error", reject);
  });
}

/**
 * electron-builder extracts winCodeSign with two macOS symlinks.
 * On Windows without Developer Mode / admin, 7-Zip exits 2 and the build dies.
 * Pre-seed the cache and replace those links with real file copies.
 */
async function ensureWinCodeSignCache() {
  if (process.platform !== "win32") return;

  const version = "2.6.0";
  const cacheRoot = path.join(os.homedir(), "AppData", "Local", "electron-builder", "Cache", "winCodeSign");
  const dest = path.join(cacheRoot, `winCodeSign-${version}`);
  const marker = path.join(dest, "rcedit-x64.exe");
  if (fs.existsSync(marker)) return;

  fs.mkdirSync(cacheRoot, { recursive: true });
  const archive = path.join(cacheRoot, `winCodeSign-${version}.7z`);
  const url = `https://github.com/electron-userland/electron-builder-binaries/releases/download/winCodeSign-${version}/winCodeSign-${version}.7z`;

  console.log("  Preparing Windows code-sign tools cache…");
  if (!fs.existsSync(archive)) {
    await download(url, archive);
  }

  const sevenZa = path.join(
    process.cwd(),
    "node_modules",
    "7zip-bin",
    "win",
    "x64",
    "7za.exe"
  );
  const staging = path.join(cacheRoot, `_staging-${version}`);
  fs.rmSync(staging, { recursive: true, force: true });
  fs.mkdirSync(staging, { recursive: true });

  await new Promise((resolve) => {
    const child = spawn(sevenZa, ["x", "-bd", archive, `-o${staging}`, "-y"], {
      stdio: "ignore",
    });
    // Exit 2 = symlink errors for darwin dylibs; Windows tools still extract.
    child.on("exit", () => resolve());
  });

  const libDir = path.join(staging, "darwin", "10.12", "lib");
  for (const [linkName, realName] of [
    ["libcrypto.dylib", "libcrypto.1.0.0.dylib"],
    ["libssl.dylib", "libssl.1.0.0.dylib"],
  ]) {
    const linkPath = path.join(libDir, linkName);
    const realPath = path.join(libDir, realName);
    if (fs.existsSync(realPath)) {
      fs.copyFileSync(realPath, linkPath);
    }
  }

  fs.rmSync(dest, { recursive: true, force: true });
  fs.renameSync(staging, dest);
}

console.log("Building Narwhal for Windows…");
await ensureWinCodeSignCache();
// Turbopack standalone needs app-route runtimes patched in before packaging.
await run("npx", ["next", "build"]);
await run("node", ["scripts/fix-standalone.mjs"]);
await run("npx", ["electron-builder", "--win", "nsis"], {
  ...process.env,
  CSC_IDENTITY_AUTO_DISCOVERY: "false",
});

const dist = path.join(process.cwd(), "dist");
const installer = findFile(
  dist,
  (name, stat) => stat.isFile() && (name.endsWith(".exe") || name.endsWith(".msi"))
);

if (!installer) {
  throw new Error("The Windows app was built, but no installer was found in dist/.");
}

console.log("");
console.log(`  Installer: ${installer}`);
console.log("  Run the .exe on Windows to install Narwhal.");
console.log("");
