import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: process.platform === "win32" });
    child.on("exit", (code) => {
      if (code) reject(new Error(`${command} exited with ${code}`));
      else resolve();
    });
  });
}

function findApp(root) {
  const matches = [];
  function walk(dir, depth) {
    if (depth > 3 || !fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (name === "Narwhal.app" && fs.statSync(full).isDirectory()) {
        matches.push(full);
        continue;
      }
      try {
        if (fs.statSync(full).isDirectory()) walk(full, depth + 1);
      } catch {
        /* skip */
      }
    }
  }
  walk(root, 0);
  return matches[0];
}

console.log("Building Narwhal for your Mac…");
await run("npx", ["next", "build"]);
await run("npx", ["electron-builder", "--mac", "dir"]);

const built = findApp(path.join(process.cwd(), "dist"));
if (!built) {
  throw new Error("The Mac app was built, but Narwhal.app was not found in dist/.");
}

const dest = "/Applications/Narwhal.app";
fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(built, dest, { recursive: true });
console.log("");
console.log(`  Installed ${dest}`);
console.log("  Open it from Applications, Launchpad, or Spotlight (search Narwhal).");
console.log("");
