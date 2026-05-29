/**
 * Full Vercel build script:
 * 1. Build frontend with Vite (outputs to dist/public)
 * 2. Bundle Express server with esbuild (outputs to api/server.js)
 * No TypeScript type-checking — esbuild transpiles only.
 */
import { build as esbuild } from "esbuild";
import { execSync } from "child_process";

console.log("🏗️  Building frontend with Vite...");
execSync("pnpm vite build", { stdio: "inherit" });

console.log("🔧  Bundling Express server with esbuild...");
await esbuild({
  entryPoints: ["api/index.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "api/server.js",
  // Keep npm packages external — Vercel installs node_modules
  packages: "external",
  // Suppress TypeScript errors — esbuild transpiles only
  logLevel: "warning",
  banner: {
    js: `import { createRequire } from 'module'; const require = createRequire(import.meta.url);`,
  },
});

console.log("✅  Build complete!");
console.log("   Frontend → dist/public/");
console.log("   Backend  → api/server.js");
