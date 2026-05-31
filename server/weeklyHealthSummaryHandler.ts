/**
 * POST /api/scheduled/weekly-health-summary
 * Triggered every Monday at 09:00 HKT (01:00 UTC) by Heartbeat cron.
 * Aggregates the past 7 days of health data and generates an AI summary.
 */
import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { getDb } from "./db";
import { sql } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";

export async function weeklyHealthSummaryHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) {
      return res.status(403).json({ error: "cron-only endpoint" });
    }

    const db = await getDb();
    if (!db) return res.status(500).json({ error: "DB unavailable" });

    // HK date range: last 7 days
    const nowHK = new Date(Date.now() + 8 * 3600 * 1000);
    const todayHK = nowHK.toISOString().split("T")[0];
    const sevenDaysAgo = new Date(Date.now() + 8 * 3600 * 1000 - 7 * 86400 * 1000).toISOString().split("T")[0];

    // Fetch all data in parallel
    const [runResult, bodyResult, sleepResult, hrResult, nutritionResult, workoutResult] = await Promise.all([
      // Running stats
      db.execute(sql`
        SELECT COUNT(*) as runs, SUM(distance_km::numeric) as total_km,
               AVG(average_pace::numeric) as avg_pace, AVG(average_heart_rate::numeric) as avg_hr
        FROM running_logs WHERE date >= ${sevenDaysAgo}
      `),
      // Body composition (latest entry)
      db.execute(sql`
        SELECT date, weight, bmi, body_fat_pct, muscle_mass, visceral_fat
        FROM body_composition WHERE "userId" = 2 AND date >= ${sevenDaysAgo}
        ORDER BY date DESC LIMIT 1
      `),
      // Sleep averages
      db.execute(sql`
        SELECT AVG(sleep_score::numeric) as avg_score,
               AVG(sleep_duration::numeric) as avg_duration,
               AVG(hrv::numeric) as avg_hrv,
               AVG(resting_hr::numeric) as avg_resting_hr,
               AVG(body_battery::numeric) as avg_body_battery
        FROM sleep_logs WHERE date >= ${sevenDaysAgo}
      `),
      // Heart rate averages
      db.execute(sql`
        SELECT AVG(resting_hr::numeric) as avg_resting_hr,
               AVG(hrv::numeric) as avg_hrv
        FROM heart_rate_logs WHERE date >= ${sevenDaysAgo}
      `),
      // Nutrition totals
      db.execute(sql`
        SELECT COUNT(DISTINCT DATE(logged_at)) as days_logged,
               AVG(calories::numeric) as avg_calories,
               AVG(protein::numeric) as avg_protein,
               AVG(carbs::numeric) as avg_carbs,
               AVG(fat::numeric) as avg_fat
        FROM (
          SELECT logged_at, SUM(calories) as calories, SUM(protein) as protein,
                 SUM(carbs) as carbs, SUM(fat) as fat
          FROM meal_logs WHERE "userId" = 2 AND logged_at >= ${sevenDaysAgo}
          GROUP BY DATE(logged_at)
        ) daily
      `),
      // Workout sessions
      db.execute(sql`
        SELECT COUNT(*) as sessions,
               SUM(EXTRACT(EPOCH FROM (end_time - start_time))/60) as total_min
        FROM workout_sessions
        WHERE "userId" = 2 AND start_time >= ${sevenDaysAgo} AND end_time IS NOT NULL
      `),
    ]);

    const run = (((runResult as any).rows ?? runResult)[0] ?? {}) as any;
    const body = (((bodyResult as any).rows ?? bodyResult)[0] ?? null) as any;
    const sleep = (((sleepResult as any).rows ?? sleepResult)[0] ?? {}) as any;
    const hr = (((hrResult as any).rows ?? hrResult)[0] ?? {}) as any;
    const nutrition = (((nutritionResult as any).rows ?? nutritionResult)[0] ?? {}) as any;
    const workout = (((workoutResult as any).rows ?? workoutResult)[0] ?? {}) as any;

    // Build data summary for LLM
    const dataSummary = `
Weekly Health Data Summary (${sevenDaysAgo} to ${todayHK}, HKT):

RUNNING:
- Runs: ${run.runs ?? 0}
- Total Distance: ${run.total_km ? Number(run.total_km).toFixed(1) : 0} km
- Avg Pace: ${run.avg_pace ? `${Math.floor(Number(run.avg_pace) / 60)}:${String(Math.round(Number(run.avg_pace) % 60)).padStart(2, "0")} /km` : "N/A"}
- Avg HR: ${run.avg_hr ? Math.round(Number(run.avg_hr)) : "N/A"} bpm

BODY COMPOSITION (latest):
${body ? `- Weight: ${body.weight ?? "N/A"} kg, BMI: ${body.bmi ?? "N/A"}, Body Fat: ${body.body_fat_pct ?? "N/A"}%, Muscle: ${body.muscle_mass ?? "N/A"} kg, Visceral Fat: ${body.visceral_fat ?? "N/A"}` : "- No data this week"}

SLEEP (7-day avg):
- Score: ${sleep.avg_score ? Number(sleep.avg_score).toFixed(0) : "N/A"}/100
- Duration: ${sleep.avg_duration ? Number(sleep.avg_duration).toFixed(1) : "N/A"} hrs
- HRV: ${sleep.avg_hrv ? Number(sleep.avg_hrv).toFixed(0) : "N/A"} ms
- Resting HR: ${sleep.avg_resting_hr ? Number(sleep.avg_resting_hr).toFixed(0) : "N/A"} bpm
- Body Battery: ${sleep.avg_body_battery ? Number(sleep.avg_body_battery).toFixed(0) : "N/A"}/100

HEART RATE (7-day avg):
- Resting HR: ${hr.avg_resting_hr ? Number(hr.avg_resting_hr).toFixed(0) : "N/A"} bpm
- HRV: ${hr.avg_hrv ? Number(hr.avg_hrv).toFixed(0) : "N/A"} ms

NUTRITION (daily avg):
- Days Logged: ${nutrition.days_logged ?? 0}/7
- Calories: ${nutrition.avg_calories ? Number(nutrition.avg_calories).toFixed(0) : "N/A"} kcal
- Protein: ${nutrition.avg_protein ? Number(nutrition.avg_protein).toFixed(0) : "N/A"} g
- Carbs: ${nutrition.avg_carbs ? Number(nutrition.avg_carbs).toFixed(0) : "N/A"} g
- Fat: ${nutrition.avg_fat ? Number(nutrition.avg_fat).toFixed(0) : "N/A"} g

WORKOUTS:
- Sessions: ${workout.sessions ?? 0}
- Total Time: ${workout.total_min ? Math.round(Number(workout.total_min)) : 0} min
`.trim();

    // Generate AI summary
    const llmResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a professional fitness and health coach. Analyze the user's weekly health data and provide a concise, encouraging, and actionable summary in both English and Traditional Chinese (繁體中文). 

Format your response as:
## 🏆 Weekly Health Summary / 每週健康總結

### English
[3-4 sentences covering highlights, areas of concern, and 2-3 specific actionable tips for next week]

### 中文
[Same content in Traditional Chinese]

Keep it positive, specific, and motivating. Use emojis sparingly for readability.`,
        },
        {
          role: "user",
          content: dataSummary,
        },
      ],
    });

    const rawContent = llmResponse?.choices?.[0]?.message?.content;
    const summary: string = typeof rawContent === "string" ? rawContent : (Array.isArray(rawContent) ? rawContent.map((p: any) => p.text ?? "").join("") : "Unable to generate summary.");

    await notifyOwner({
      title: `BodyFit Weekly Health Summary 📊 (${sevenDaysAgo} – ${todayHK})`,
      content: summary,
    });

    return res.json({ ok: true, period: `${sevenDaysAgo} to ${todayHK}` });
  } catch (err: any) {
    console.error("[weekly-health-summary] Error:", err);
    return res.status(500).json({
      error: err?.message ?? "Unknown error",
      stack: err?.stack,
      context: { url: req.url },
      timestamp: new Date().toISOString(),
    });
  }
}
