import fs from "node:fs";
import path from "node:path";

/**
 * Next standalone file tracing sometimes omits runtime bits the desktop
 * server needs. Turbopack builds ship pages but drop app-route-turbo*, so
 * every /api/* call returns Internal Server Error inside the .app.
 */
const root = process.cwd();
const fullNext = path.join(root, "node_modules", "next");
const standNext = path.join(root, ".next", "standalone", "node_modules", "next");

function mustExist(file, label) {
  if (!fs.existsSync(file)) {
    throw new Error(`fix-standalone: missing ${label} at ${file}`);
  }
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

mustExist(fullNext, "node_modules/next");
mustExist(standNext, ".next/standalone/node_modules/next (run next build first)");

const compiledRel = path.join("dist", "compiled", "next-server");
const compiledSrc = path.join(fullNext, compiledRel);
const compiledDest = path.join(standNext, compiledRel);
fs.mkdirSync(compiledDest, { recursive: true });

let copied = 0;
for (const name of fs.readdirSync(compiledSrc)) {
  if (!name.endsWith(".runtime.prod.js")) continue;
  copyFile(path.join(compiledSrc, name), path.join(compiledDest, name));
  copied += 1;
}

// Webpack standalone has been tracing an incomplete next package (missing
 // cpu-profile and friends). Overlay the server lib helpers we know start-server needs.
const serverLib = path.join("dist", "server", "lib");
const startServer = path.join(standNext, serverLib, "start-server.js");
if (fs.existsSync(startServer)) {
  for (const name of ["cpu-profile.js"]) {
    const src = path.join(fullNext, serverLib, name);
    if (fs.existsSync(src)) {
      copyFile(src, path.join(standNext, serverLib, name));
      copied += 1;
    }
  }
}

console.log(`  fix-standalone: ensured ${copied} Next runtime file(s) in the desktop server bundle.`);
