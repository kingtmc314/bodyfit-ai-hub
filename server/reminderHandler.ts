import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { getDb } from "./db";
import { mealLogs, workoutSessions, bodyMetrics, sleepRecords } from "../drizzle/schema";
import { eq, and, gte } from "drizzle-orm";
import { notifyOwner } from "./_core/notification";

/**
 * POST /api/scheduled/daily-reminder
 * Triggered daily by Heartbeat cron. Checks if the owner has logged
 * meals, workouts, or body metrics today, and sends a reminder if not.
 */
export async function dailyReminderHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) {
      return res.status(403).json({ error: "cron-only endpoint" });
    }

    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "DB unavailable" });
    }

    const today = new Date().toISOString().split("T")[0];

    // Check what has been logged today for all users (owner-level reminder)
    const [todayMeals, todayWorkouts, todayBody, todaySleep] = await Promise.all([
      db.select().from(mealLogs).where(gte(mealLogs.date, today)).limit(1),
      db.select().from(workoutSessions).where(gte(workoutSessions.date, today)).limit(1),
      db.select().from(bodyMetrics).where(gte(bodyMetrics.date, today)).limit(1),
      db.select().from(sleepRecords).where(gte(sleepRecords.date, today)).limit(1),
    ]);

    const missing: string[] = [];
    if (todayMeals.length === 0) missing.push("🍽️ Meals");
    if (todayWorkouts.length === 0) missing.push("💪 Workout");
    if (todayBody.length === 0) missing.push("⚖️ Body Metrics");
    if (todaySleep.length === 0) missing.push("😴 Sleep");

    if (missing.length === 0) {
      return res.json({ ok: true, message: "All entries logged for today — great job!" });
    }

    const content = `You haven't logged the following today (${today}):\n\n${missing.join("\n")}\n\nOpen BodyFit AI Hub to log your data and stay on track with your health goals! 💪`;

    await notifyOwner({
      title: "BodyFit Daily Reminder 🏋️",
      content,
    });

    return res.json({ ok: true, reminded: missing });
  } catch (err: any) {
    console.error("[daily-reminder] Error:", err);
    return res.status(500).json({
      error: err?.message ?? "Unknown error",
      stack: err?.stack,
      context: { url: req.url, taskUid: "unknown" },
      timestamp: new Date().toISOString(),
    });
  }
}
