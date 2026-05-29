import { build } from "esbuild";
import { copyFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

// Bundle the Express server into a single file for Vercel
await build({
  entryPoints: ["api/index.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "api/server.js",
  packages: "external",  // Keep node_modules external (Vercel installs them)
  banner: {
    js: `import { createRequire } from 'module'; const require = createRequire(import.meta.url);`,
  },
  external: [
    // Node built-ins
    "fs", "path", "net", "http", "https", "crypto", "stream", "os", "url",
    "util", "events", "buffer", "querystring", "zlib", "child_process",
    // All npm packages - Vercel will install them
    "express", "drizzle-orm", "@trpc/server", "postgres", "pg",
    "jose", "nanoid", "cookie", "dotenv", "googleapis",
    "@aws-sdk/*", "superjson", "zod",
  ],
});

console.log("✅ Vercel API bundle built: api/server.js");
