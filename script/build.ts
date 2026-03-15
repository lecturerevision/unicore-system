import { execSync } from "child_process";
import { build } from "esbuild";

// 1. Build React frontend with Vite → dist/public/
console.log("[build] Building client...");
execSync("npx vite build", { stdio: "inherit" });

// 2. Bundle Express server → dist/index.js (ESM)
// All npm packages stay external (installed via npm install at deploy time).
// server/vite.ts is only ever imported inside an if(NODE_ENV !== "production")
// dynamic import, so it is never executed in production.
console.log("[build] Building server...");
await build({
  entryPoints: ["server/index.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: "dist/index.js",
  packages: "external",
});

console.log("[build] Done ✓");
