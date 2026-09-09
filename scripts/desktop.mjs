import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

const preferred = Number(process.env.PORT || "43147");
const useDev = process.env.NARWHAL_DEV === "1";

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

function freePort(port) {
  try {
    if (process.platform === "darwin" || process.platform === "linux") {
      const pids = execSync(`lsof -tiTCP:${port} -sTCP:LISTEN`, { encoding: "utf8" })
        .trim()
        .split(/\s+/)
        .filter(Boolean);
      for (const pid of pids) {
        try {
          process.kill(Number(pid), "SIGTERM");
        } catch {
          /* already gone */
        }
      }
    }
  } catch {
    /* nothing listening */
  }
}

async function pickPort(start) {
  if (!(await portFree(start))) {
    console.log(`  Freeing busy port ${start}…`);
    freePort(start);
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
  for (let port = start; port < start + 20; port += 1) {
    if (await portFree(port)) return port;
  }
  throw new Error("Could not find a free port for Narwhal.");
}

function run(command, args, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      env: { ...process.env, ...extraEnv },
    });
    child.on("exit", (code) => {
      if (code) reject(new Error(`${command} exited with ${code}`));
      else resolve();
    });
  });
}

function runDetached(command, args, extraEnv = {}) {
  return spawn(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ...extraEnv },
  });
}

async function waitForServer(url) {
  for (let i = 0; i < 120; i += 1) {
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

const port = await pickPort(preferred);
const url = `http://127.0.0.1:${port}`;
const buildIdPath = path.join(process.cwd(), ".next/BUILD_ID");
const built = fs.existsSync(buildIdPath);

function latestMtime(dir) {
  let latest = 0;
  if (!fs.existsSync(dir)) return 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const nextPath = path.join(dir, entry.name);
    if (entry.isDirectory()) latest = Math.max(latest, latestMtime(nextPath));
    else latest = Math.max(latest, fs.statSync(nextPath).mtimeMs);
  }
  return latest;
}

function buildIsStale() {
  if (!built) return true;
  const builtAt = fs.statSync(buildIdPath).mtimeMs;
  return latestMtime(path.join(process.cwd(), "src")) > builtAt;
}

console.log("");
console.log("  Narwhal is Cinema in a desktop window.");
if (port !== preferred) {
  console.log(`  Port ${preferred} is still busy after cleanup.`);
  console.log(`  Using a fresh server at ${url}`);
} else {
  console.log(`  Starting the web app at ${url}`);
}

let next;
if (useDev) {
  console.log("  Mode: development (webpack — more stable with Tailwind/PostCSS).");
  // Turbopack + @tailwindcss/postcss has been crashing loaders ("failed to receive message").
  next = runDetached(
    "npx",
    ["next", "dev", "--webpack", "--hostname", "127.0.0.1", "--port", String(port)],
    { PORT: String(port) }
  );
} else {
  if (buildIsStale()) {
    console.log("  Source is newer than the last production build — compiling…");
    await run("npx", ["next", "build"]);
    await run("node", ["scripts/fix-standalone.mjs"]);
  }
  console.log("  Mode: production (fast). Set NARWHAL_DEV=1 for live-reload dev mode.");
  next = runDetached("npx", ["next", "start", "--hostname", "127.0.0.1", "--port", String(port)], {
    PORT: String(port),
  });
}
console.log("");

next.on("exit", (code) => {
  if (code && code !== 0) process.exit(code);
});

await waitForServer(url);

const electron = runDetached("npx", ["electron", "."], {
  NARWHAL_URL: url,
});

electron.on("exit", (code) => {
  next.kill();
  process.exit(code ?? 0);
});
