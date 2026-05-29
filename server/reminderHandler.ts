import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { getDb } from "./db";
import { mealLogs, workoutSessions, bodyComposition, sleepLogs } from "../drizzle/schema";
import { gte, sql } from "drizzle-orm";
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
    const todayStart = new Date(today);

    // Check what has been logged today
    const [todayMeals, todayWorkouts, todayBody, todaySleepLogs] = await Promise.all([
      db.select().from(mealLogs).where(sql`${mealLogs.loggedAt} >= ${today}`).limit(1),
      db.select().from(workoutSessions).where(sql`${workoutSessions.startTime} >= ${todayStart}`).limit(1),
      db.select().from(bodyComposition).where(gte(bodyComposition.date, today)).limit(1),
      db.select().from(sleepLogs).where(gte(sleepLogs.date, today)).limit(1),
    ]);

    const missing: string[] = [];
    if (todayMeals.length === 0) missing.push("🍽️ Meals");
    if (todayWorkouts.length === 0) missing.push("💪 Workout");
    if (todayBody.length === 0) missing.push("⚖️ Body Metrics");
    if (todaySleepLogs.length === 0) missing.push("😴 Sleep");

    if (missing.length === 0) {
      return res.json({ ok: true, message: "All entries logged for today — great job!" });
    }

    const content = `You haven't logged the following today (${today}):\n\n${missing.join("\n")}\n\nOpen BodyFit AI Hub to log your data and stay on track with your health goals! 💪`;

    await notifyOwner({
      title: "BodyFit Daily Reminder 🏋️",
      content,
    });

    return res.json({ ok: true, reminded: missing });
  } catch (err: unknown) {
    const error = err as { message?: string; stack?: string };
    console.error("[daily-reminder] Error:", err);
    return res.status(500).json({
      error: error?.message ?? "Unknown error",
      stack: error?.stack,
      context: { url: req.url, taskUid: "unknown" },
      timestamp: new Date().toISOString(),
    });
  }
}
