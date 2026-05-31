import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { dailyReminderHandler } from "../reminderHandler";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  // Health check for Render/uptime monitoring
  app.get("/api/health", (_req, res) => res.json({ ok: true, version: "1.0.0" }));

  // Proxy for wger.de exercise images (no CORS headers on wger media)
  app.get("/api/wger-img", async (req, res) => {
    try {
      const path = req.query.path as string;
      if (!path || !path.startsWith("/media/exercise-images/")) {
        return res.status(400).json({ error: "Invalid path" });
      }
      const upstream = await fetch(`https://wger.de${path}`);
      if (!upstream.ok) return res.status(upstream.status).end();
      const ct = upstream.headers.get("content-type") || "image/png";
      res.setHeader("Content-Type", ct);
      res.setHeader("Cache-Control", "public, max-age=86400");
      const buf = await upstream.arrayBuffer();
      res.end(Buffer.from(buf));
    } catch (e) {
      res.status(500).end();
    }
  });
  // Scheduled cron handlers — must be before Vite/static fallthrough
  app.post("/api/scheduled/daily-reminder", dailyReminderHandler);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
