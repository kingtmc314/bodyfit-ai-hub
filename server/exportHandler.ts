/**
 * Export handlers for CSV and PDF downloads.
 * Mounted as GET /api/export/:type/:format in server/_core/index.ts
 */
import type { Request, Response } from "express";
import { getDb } from "./db";
import { sql } from "drizzle-orm";
import { bodyComposition, supplements, supplementLogs } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";

const OWNER_USER_ID = parseInt(process.env.OWNER_USER_ID ?? "2");

// ─── CSV helpers ─────────────────────────────────────────────────────────────
function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowsToCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const lines: string[] = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map(h => escapeCsv(row[h])).join(","));
  }
  return lines.join("\n");
}

// ─── HTML → PDF helper ───────────────────────────────────────────────────────
function buildHtmlTable(title: string, headers: string[], rows: Record<string, unknown>[]): string {
  const headerRow = headers.map(h => `<th>${h}</th>`).join("");
  const dataRows = rows.map(row =>
    `<tr>${headers.map(h => `<td>${row[h] ?? ""}</td>`).join("")}</tr>`
  ).join("\n");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; margin: 20px; color: #333; }
  h1 { font-size: 16px; margin-bottom: 4px; color: #1a1a1a; }
  p.meta { font-size: 10px; color: #666; margin-bottom: 12px; }
  table { border-collapse: collapse; width: 100%; }
  th { background: #f97316; color: white; padding: 6px 8px; text-align: left; font-size: 10px; }
  td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; font-size: 10px; }
  tr:nth-child(even) { background: #fafafa; }
</style>
</head>
<body>
<h1>${title}</h1>
<p class="meta">Exported on ${new Date().toLocaleString("en-HK", { timeZone: "Asia/Hong_Kong" })} (HKT) · ${rows.length} records</p>
<table>
<thead><tr>${headerRow}</tr></thead>
<tbody>${dataRows}</tbody>
</table>
</body>
</html>`;
}

// ─── Running Logs Export ─────────────────────────────────────────────────────
export async function exportRunningLogsHandler(req: Request, res: Response) {
  try {
    const format = (req.params.format ?? "csv").toLowerCase();
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "DB unavailable" });

    const result = await db.execute(sql`
      SELECT date, running_type, distance_km, hour, minutes, second,
             average_pace, best_pace, average_heart_rate, maximum_heart_rate,
             average_cadence, max_cadence, calories, running_shoes,
             temperature, humidity, wind_speed, apparent_temp,
             avg_stride_length_m, avg_vertical_ratio, vertical_oscillation_cm,
             avg_ground_contact_time_ms, notes
      FROM running_logs
      ORDER BY date DESC
      LIMIT 2000
    `);
    const rows = ((result as any).rows ?? result) as Record<string, unknown>[];

    const headers = [
      "date", "running_type", "distance_km", "hour", "minutes", "second",
      "average_pace", "best_pace", "average_heart_rate", "maximum_heart_rate",
      "average_cadence", "max_cadence", "calories", "running_shoes",
      "temperature", "humidity", "wind_speed", "apparent_temp",
      "avg_stride_length_m", "avg_vertical_ratio", "vertical_oscillation_cm",
      "avg_ground_contact_time_ms", "notes",
    ];

    if (format === "pdf") {
      const html = buildHtmlTable("Running Log — BodyFit AI Hub", headers, rows);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="running-log-${new Date().toISOString().split("T")[0]}.html"`);
      return res.send(html);
    }

    const csv = rowsToCsv(headers, rows);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="running-log-${new Date().toISOString().split("T")[0]}.csv"`);
    return res.send("\uFEFF" + csv); // BOM for Excel UTF-8
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? "Unknown error" });
  }
}

// ─── Body Composition Export ─────────────────────────────────────────────────
export async function exportBodyCompositionHandler(req: Request, res: Response) {
  try {
    const format = (req.params.format ?? "csv").toLowerCase();
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "DB unavailable" });

    const rows = await db.select().from(bodyComposition)
      .where(eq(bodyComposition.userId, OWNER_USER_ID))
      .orderBy(desc(bodyComposition.date));

    const headers = [
      "date", "weight", "bmi", "bodyFatPct", "fatMass", "muscleMass", "bmr", "visceralFat", "notes",
    ];

    const mapped = rows.map(r => ({
      date: r.date,
      weight: r.weight,
      bmi: r.bmi,
      bodyFatPct: r.bodyFatPct,
      fatMass: r.fatMass,
      muscleMass: r.muscleMass,
      bmr: r.bmr,
      visceralFat: r.visceralFat,
      notes: r.notes,
    }));

    if (format === "pdf") {
      const html = buildHtmlTable("Body Composition — BodyFit AI Hub", headers, mapped);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="body-composition-${new Date().toISOString().split("T")[0]}.html"`);
      return res.send(html);
    }

    const csv = rowsToCsv(headers, mapped);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="body-composition-${new Date().toISOString().split("T")[0]}.csv"`);
    return res.send("\uFEFF" + csv);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? "Unknown error" });
  }
}

// ─── Supplement Logs Export ──────────────────────────────────────────────────
export async function exportSupplementLogsHandler(req: Request, res: Response) {
  try {
    const format = (req.params.format ?? "csv").toLowerCase();
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "DB unavailable" });

    const result = await db.execute(sql`
      SELECT sl.date, s.name AS supplement_name, s.brand, s.category,
             sl.quantity, sl.time_of_day, sl.notes
      FROM supplement_logs sl
      JOIN supplements s ON s.id = sl.supplement_id
      WHERE sl."userId" = ${OWNER_USER_ID}
      ORDER BY sl.date DESC
      LIMIT 2000
    `);
    const rows = ((result as any).rows ?? result) as Record<string, unknown>[];

    const headers = ["date", "supplement_name", "brand", "category", "quantity", "time_of_day", "notes"];

    if (format === "pdf") {
      const html = buildHtmlTable("Supplement Log — BodyFit AI Hub", headers, rows);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="supplement-log-${new Date().toISOString().split("T")[0]}.html"`);
      return res.send(html);
    }

    const csv = rowsToCsv(headers, rows);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="supplement-log-${new Date().toISOString().split("T")[0]}.csv"`);
    return res.send("\uFEFF" + csv);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? "Unknown error" });
  }
}
