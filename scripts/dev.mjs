import { spawn } from "node:child_process";

const port = process.env.PORT || "3000";
const host = "0.0.0.0";

console.log("");
console.log("  Cinema is starting.");
console.log("  When it says Ready, open this exact address:");
console.log("");
console.log(`    http://127.0.0.1:${port}`);
console.log("");
console.log("  Do not open http://localhost (that is port 80 and will refuse).");
console.log("  Do not open http://0.0.0.0");
console.log("");

const child = spawn(
  "npx",
  ["next", "dev", "--webpack", "--hostname", host, "--port", String(port)],
  { stdio: "inherit", shell: process.platform === "win32" }
);

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
