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

console.log("Building Narwhal for Windows…");
await run("npx", ["next", "build"]);
await run("npx", ["electron-builder", "--win", "nsis"]);

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
