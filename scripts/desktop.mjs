import { spawn } from "node:child_process";

const port = process.env.PORT || "43147";
const url = `http://127.0.0.1:${port}`;

function run(command, args, extraEnv = {}) {
  return spawn(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ...extraEnv },
  });
}

async function waitForServer() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 307 || response.status === 404) return;
    } catch {
      // still starting
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error("Cinema did not start. Is the port free?");
}

console.log("");
console.log("  Narwhal is Cinema in a desktop window.");
console.log(`  Starting the web app at ${url}`);
console.log("");

const next = run("npx", ["next", "dev", "--hostname", "127.0.0.1", "--port", port], {
  PORT: port,
});

next.on("exit", (code) => {
  if (code && code !== 0) process.exit(code);
});

await waitForServer();

const electron = run("npx", ["electron", "."], {
  NARWHAL_URL: url,
});

electron.on("exit", (code) => {
  next.kill();
  process.exit(code ?? 0);
});
