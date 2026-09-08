import { spawn } from "node:child_process";
import net from "node:net";

const preferred = Number(process.env.PORT || "43147");

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

function run(command, args, extraEnv = {}) {
  return spawn(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ...extraEnv },
  });
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

const port = await pickPort(preferred);
const url = `http://127.0.0.1:${port}`;

console.log("");
console.log("  Narwhal is Cinema in a desktop window.");
if (port !== preferred) {
  console.log(`  Port ${preferred} is already in use (old Next/Narwhal).`);
  console.log(`  Using a fresh server at ${url}`);
  console.log("  Optional: stop the old one with  lsof -ti :43147 | xargs kill");
} else {
  console.log(`  Starting the web app at ${url}`);
}
console.log("");

const next = run("npx", ["next", "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
  PORT: String(port),
});

next.on("exit", (code) => {
  if (code && code !== 0) process.exit(code);
});

await waitForServer(url);

const electron = run("npx", ["electron", "."], {
  NARWHAL_URL: url,
});

electron.on("exit", (code) => {
  next.kill();
  process.exit(code ?? 0);
});
