import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function run(command, args, allowFail = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: process.platform === "win32" });
    child.on("exit", (code) => {
      if (code && !allowFail) reject(new Error(`${command} exited with ${code}`));
      else resolve();
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findNewestFile(root, match) {
  const matches = [];
  function walk(dir, depth) {
    if (depth > 3 || !fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      let stat;
      try {
        stat = fs.statSync(full);
      } catch {
        continue;
      }
      if (match(name, stat)) {
        matches.push({ full, mtime: stat.mtimeMs });
        continue;
      }
      if (stat.isDirectory()) walk(full, depth + 1);
    }
  }
  walk(root, 0);
  matches.sort((a, b) => b.mtime - a.mtime);
  return matches[0]?.full;
}

async function freeMacInstallLocks() {
  // An already-running Narwhal (or a still-mounted old .dmg) keeps bundle
  // folders locked. Finder then says “Library is in use” when replacing the app.
  await run("killall", ["Narwhal"], true);
  await run("hdiutil", ["detach", "/Volumes/Narwhal", "-force"], true);
  await run("hdiutil", ["detach", "/Volumes/Narwhal 0.1.0", "-force"], true);
  await run("hdiutil", ["detach", "/Volumes/Narwhal 0.2.0", "-force"], true);
  await sleep(800);
}

console.log("Building Narwhal for your Mac…");
if (process.arch !== "arm64") {
  console.log("");
  console.log("  Warning: this build is using Intel (x64) Node on an Apple Silicon Mac.");
  console.log("  The .dmg will feel slow. Install ARM64 Node, then rebuild:");
  console.log("    node -p process.arch   # should print arm64");
  console.log("  https://nodejs.org  → macOS Installer (ARM64)");
  console.log("");
}
await freeMacInstallLocks();
// Must use webpack — Turbopack standalone omits app-route-turbo.runtime.prod.js,
// so every /api/* route crashes with Internal Server Error in the .app.
await run("npx", ["next", "build", "--webpack"]);
await run("npx", ["electron-builder", "--mac", "dmg"]);

const dist = path.join(process.cwd(), "dist");
const dmg = findNewestFile(dist, (name, stat) => stat.isFile() && name.endsWith(".dmg"));

if (!dmg) {
  throw new Error("The Mac app was built, but no .dmg was found in dist/.");
}

console.log("");
console.log(`  Disk image: ${dmg}`);
console.log("");
console.log("  Install:");
console.log("  1. Quit Narwhal if it is open (right-click Dock icon → Quit).");
console.log("  2. Open the .dmg.");
console.log("  3. Drag Narwhal onto Applications.");
console.log("  4. Eject the disk image.");
console.log("  5. Open /Applications/Narwhal (first time: right-click → Open).");
console.log("  Do not launch Narwhal from inside the .dmg.");
console.log("");
