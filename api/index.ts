import "dotenv/config";
import express, { type Request, type Response } from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "../server/_core/oauth";
import { registerStorageProxy } from "../server/_core/storageProxy";
import { appRouter } from "../server/routers";
import { createContext } from "../server/_core/context";
import { dailyReminderHandler } from "../server/reminderHandler";
import path from "path";
import fs from "fs";

const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

registerStorageProxy(app);
registerOAuthRoutes(app);

// Health check
app.get("/api/health", (_req: Request, res: Response) => res.json({ ok: true, version: "1.0.0" }));

// Scheduled cron handlers
app.post("/api/scheduled/daily-reminder", dailyReminderHandler);

// tRPC API
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

// Serve static frontend files in production
const staticDir = path.join(process.cwd(), "dist/public");
if (fs.existsSync(staticDir)) {
  app.use(express.static(staticDir));
  app.get("*", (_req: Request, res: Response) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });
}

export default app;
