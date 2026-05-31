/**
 * POST /api/scheduled/supplement-reminder
 * Triggered daily at 08:00 HKT (00:00 UTC) by Heartbeat cron.
 * Checks which active supplements have reminder_enabled = true and
 * haven't been logged today, then sends a push notification.
 */
import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { getDb } from "./db";
import { sql } from "drizzle-orm";
import { notifyOwner } from "./_core/notification";

export async function supplementReminderHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) {
      return res.status(403).json({ error: "cron-only endpoint" });
    }

    const db = await getDb();
    if (!db) return res.status(500).json({ error: "DB unavailable" });

    // HK date today (UTC+8)
    const nowHK = new Date(Date.now() + 8 * 3600 * 1000);
    const todayHK = nowHK.toISOString().split("T")[0];

    // Get all active supplements with reminders enabled
    const result = await db.execute(sql`
      SELECT s.id, s.name, s.brand, s.category, s.current_stock, s.low_stock_threshold,
             s.reminder_enabled, s.reminder_time
      FROM supplements s
      WHERE s."userId" = 2
        AND s.is_active = true
        AND s.reminder_enabled = true
    `);
    const supplements = ((result as any).rows ?? result) as any[];

    if (!supplements.length) {
      return res.json({ ok: true, message: "No supplements with reminders enabled" });
    }

    // Check which ones haven't been logged today
    const logResult = await db.execute(sql`
      SELECT supplement_id FROM supplement_logs
      WHERE "userId" = 2 AND date = ${todayHK}
    `);
    const loggedIds = new Set(
      ((logResult as any).rows ?? logResult).map((r: any) => r.supplement_id)
    );

    const due = supplements.filter((s: any) => !loggedIds.has(s.id));
    const lowStock = supplements.filter((s: any) => s.current_stock != null && s.low_stock_threshold != null && s.current_stock <= s.low_stock_threshold);

    if (due.length === 0 && lowStock.length === 0) {
      return res.json({ ok: true, message: "All supplements logged today, no low stock" });
    }

    let content = `📅 Date: ${todayHK}\n\n`;

    if (due.length > 0) {
      content += `💊 **Supplements not yet taken today:**\n`;
      for (const s of due) {
        const label = s.brand ? `${s.name} (${s.brand})` : s.name;
        content += `  • ${label}${s.reminder_time ? ` — scheduled at ${s.reminder_time}` : ""}\n`;
      }
      content += "\n";
    }

    if (lowStock.length > 0) {
      content += `⚠️ **Low Stock Alert:**\n`;
      for (const s of lowStock) {
        content += `  • ${s.name}: ${s.current_stock} units left (threshold: ${s.low_stock_threshold})\n`;
      }
      content += "\n";
    }

    content += "Open BodyFit AI Hub → Supplements to log your intake. 💪";

    await notifyOwner({
      title: `BodyFit Supplement Reminder 💊 (${due.length} due)`,
      content,
    });

    return res.json({ ok: true, due: due.length, lowStock: lowStock.length });
  } catch (err: any) {
    console.error("[supplement-reminder] Error:", err);
    return res.status(500).json({
      error: err?.message ?? "Unknown error",
      stack: err?.stack,
      context: { url: req.url },
      timestamp: new Date().toISOString(),
    });
  }
}
