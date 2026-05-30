import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import {
  mealLogs, foodItems, workoutSessions, workoutSets, exercises,
  bodyComposition, heartRateLogs, sleepLogs, progressPhotos, aiInsights,
  healthGoals
} from "../drizzle/schema";
import { eq, and, desc, gte, lte, like, or, sql } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { todayHK, daysAgoHK, toHKDateString } from "./hkTime";
import { parseRows, detectDataType, type ImportDataType } from "./csvImport";
import Papa from "papaparse";
// Fixed owner user ID - no login required
const OWNER_USER_ID = 2;


// ─── Nutrition Router ─────────────────────────────────────────────────────────
const nutritionRouter = router({
  // Search food database
  searchFoods: publicProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(foodItems)
        .where(or(like(foodItems.name, `%${input.query}%`), like(foodItems.nameZh, `%${input.query}%`)))
        .limit(20);
    }),

  // Get meal logs for a date
  getMealLogs: publicProcedure
    .input(z.object({ date: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(mealLogs)
        .where(and(eq(mealLogs.userId, OWNER_USER_ID), sql`${mealLogs.loggedAt} >= ${new Date(input.date + "T00:00:00")}`, sql`${mealLogs.loggedAt} <= ${new Date(input.date + "T23:59:59")}`))
        .orderBy(mealLogs.createdAt);
    }),

  // Get meal logs for date range
  getMealLogsRange: publicProcedure
    .input(z.object({ startDate: z.string(), endDate: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(mealLogs)
        .where(and(
          eq(mealLogs.userId, OWNER_USER_ID),
          sql`${mealLogs.loggedAt} >= ${new Date(input.startDate)}`,
          sql`${mealLogs.loggedAt} <= ${new Date(input.endDate)}`
        ))
        .orderBy(desc(mealLogs.loggedAt));
    }),

  // Add meal log
  addMealLog: publicProcedure
    .input(z.object({
      date: z.string(),
      mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
      foodName: z.string(),
      foodItemId: z.number().optional(),
      quantity: z.number(),
      calories: z.number(),
      protein: z.number(),
      carbs: z.number(),
      fat: z.number(),
      fiber: z.number().optional(),
      notes: z.string().optional(),
      photoUrl: z.string().optional(),
      aiAnalyzed: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.insert(mealLogs).values({ ...input, userId: OWNER_USER_ID });
      return { success: true };
    }),

  // Update meal log
  updateMealLog: publicProcedure
    .input(z.object({
      id: z.number(),
      foodName: z.string().optional(),
      quantity: z.number().optional(),
      calories: z.number().optional(),
      protein: z.number().optional(),
      carbs: z.number().optional(),
      fat: z.number().optional(),
      notes: z.string().optional(),
      mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { id, ...data } = input;
      await db.update(mealLogs).set(data).where(and(eq(mealLogs.id, id), eq(mealLogs.userId, OWNER_USER_ID)));
      return { success: true };
    }),

  // Delete meal log
  deleteMealLog: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(mealLogs).where(and(eq(mealLogs.id, input.id), eq(mealLogs.userId, OWNER_USER_ID)));
      return { success: true };
    }),

  // AI food photo analysis
  analyzeFoodPhoto: publicProcedure
    .input(z.object({ imageUrl: z.string(), imageBase64: z.string().optional() }))
    .mutation(async ({ input }) => {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a professional nutritionist and food recognition AI. Analyze the food in the image and provide accurate nutritional estimates. Always respond with valid JSON only.`
          },
          {
            role: "user",
            content: `[IMAGE:${input.imageUrl}] Identify all food items visible in this image and estimate their nutritional content. Provide the response as JSON with this exact structure: {"foods":[{"name":"Food Name","nameZh":"食物中文名","quantity":150,"unit":"g","calories":250,"protein":15,"carbs":30,"fat":8,"fiber":2}],"totalCalories":250,"totalProtein":15,"totalCarbs":30,"totalFat":8,"confidence":"high","notes":"Brief description"}`
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "food_analysis",
            strict: true,
            schema: {
              type: "object",
              properties: {
                foods: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      nameZh: { type: "string" },
                      quantity: { type: "number" },
                      unit: { type: "string" },
                      calories: { type: "number" },
                      protein: { type: "number" },
                      carbs: { type: "number" },
                      fat: { type: "number" },
                      fiber: { type: "number" }
                    },
                    required: ["name", "nameZh", "quantity", "unit", "calories", "protein", "carbs", "fat", "fiber"],
                    additionalProperties: false
                  }
                },
                totalCalories: { type: "number" },
                totalProtein: { type: "number" },
                totalCarbs: { type: "number" },
                totalFat: { type: "number" },
                confidence: { type: "string" },
                notes: { type: "string" }
              },
              required: ["foods", "totalCalories", "totalProtein", "totalCarbs", "totalFat", "confidence", "notes"],
              additionalProperties: false
            }
          }
        }
      });
      const rawMsg = response.choices[0]?.message?.content;
      const contentStr = typeof rawMsg === "string" ? rawMsg : "{}";
      return JSON.parse(contentStr);
    }),

  // Upload food photo to storage
  uploadFoodPhoto: publicProcedure
    .input(z.object({ base64: z.string(), mimeType: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.base64, "base64");
      const key = `food-photos/${OWNER_USER_ID}/${nanoid()}.jpg`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      return { url, key };
    }),
});

// ─── Workout Router ───────────────────────────────────────────────────────────
const workoutRouter = router({
  // Get all exercises (built-in + user's custom)
  getExercises: publicProcedure
    .input(z.object({ muscleGroup: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [
        or(eq(exercises.isCustom, false), eq(exercises.userId, OWNER_USER_ID))
      ];
      if (input?.muscleGroup) {
        conditions.push(eq(exercises.muscleGroup, input.muscleGroup));
      }
      return db.select().from(exercises).where(and(...conditions)).orderBy(exercises.name);
    }),

  // Add custom exercise
  addExercise: publicProcedure
    .input(z.object({
      name: z.string(),
      nameZh: z.string().optional(),
      muscleGroup: z.string(),
      equipment: z.string().optional(),
      instructions: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.insert(exercises).values({ ...input, isCustom: true, userId: OWNER_USER_ID });
      return { success: true };
    }),

  // Get workout sessions
  getSessions: publicProcedure
    .input(z.object({ startDate: z.string().optional(), endDate: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [eq(workoutSessions.userId, OWNER_USER_ID)];
      if (input?.startDate) conditions.push(sql`${workoutSessions.startTime} >= ${new Date(input.startDate)}`);
      if (input?.endDate) conditions.push(sql`${workoutSessions.startTime} <= ${new Date(input.endDate)}`);
      return db.select().from(workoutSessions).where(and(...conditions)).orderBy(desc(workoutSessions.startTime));
    }),

  // Get session with sets
  getSessionWithSets: publicProcedure
    .input(z.object({ sessionId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return null;
      const sessions = await db.select().from(workoutSessions)
        .where(and(eq(workoutSessions.id, input.sessionId), eq(workoutSessions.userId, OWNER_USER_ID)))
        .limit(1);
      if (!sessions[0]) return null;
      const sets = await db.select().from(workoutSets)
        .where(eq(workoutSets.sessionId, input.sessionId))
        .orderBy(workoutSets.exerciseName, workoutSets.setNumber);
      return { session: sessions[0], sets };
    }),

  // Create workout session
  createSession: publicProcedure
    .input(z.object({
      date: z.string(),
      name: z.string().optional(),
      duration: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const result = await db.insert(workoutSessions).values({ ...input, userId: OWNER_USER_ID }).returning({ id: workoutSessions.id });
      return { success: true, id: result[0]?.id ?? 0 };
    }),

  // Update session
  updateSession: publicProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      duration: z.number().optional(),
      notes: z.string().optional(),
      totalVolume: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { id, ...data } = input;
      await db.update(workoutSessions).set(data).where(and(eq(workoutSessions.id, id), eq(workoutSessions.userId, OWNER_USER_ID)));
      return { success: true };
    }),

  // Delete session
  deleteSession: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(workoutSets).where(eq(workoutSets.sessionId, input.id));
      await db.delete(workoutSessions).where(and(eq(workoutSessions.id, input.id), eq(workoutSessions.userId, OWNER_USER_ID)));
      return { success: true };
    }),

  // Add workout set
  addSet: publicProcedure
    .input(z.object({
      sessionId: z.number(),
      exerciseId: z.number(),
      exerciseName: z.string(),
      setNumber: z.number(),
      reps: z.number().optional(),
      weight: z.number().optional(),
      duration: z.number().optional(),
      distance: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.insert(workoutSets).values(input);
      return { success: true };
    }),

  // Update set
  updateSet: publicProcedure
    .input(z.object({
      id: z.number(),
      reps: z.number().optional(),
      weight: z.number().optional(),
      duration: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { id, ...data } = input;
      await db.update(workoutSets).set(data).where(eq(workoutSets.id, id));
      return { success: true };
    }),

  // Delete set
  deleteSet: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(workoutSets).where(eq(workoutSets.id, input.id));
      return { success: true };
    }),
});

// ─── Body Metrics Router ──────────────────────────────────────────────────────
const bodyRouter = router({
  getAll: publicProcedure
    .input(z.object({ limit: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(bodyComposition)
        .where(eq(bodyComposition.userId, OWNER_USER_ID))
        .orderBy(desc(bodyComposition.date))
        .limit(input?.limit || 100);
    }),

  add: publicProcedure
    .input(z.object({
      date: z.string(),
      weight: z.number().optional(),
      bmi: z.number().optional(),
      bodyFatPct: z.number().optional(),
      fatMass: z.number().optional(),
      muscleMass: z.number().optional(),
      bmr: z.number().optional(),
      visceralFat: z.number().optional(),
      notes: z.string().optional(),
      source: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.insert(bodyComposition).values({ ...input, userId: OWNER_USER_ID });
      return { success: true };
    }),

  update: publicProcedure
    .input(z.object({
      id: z.number(),
      date: z.string().optional(),
      weight: z.number().optional(),
      bmi: z.number().optional(),
      bodyFatPct: z.number().optional(),
      fatMass: z.number().optional(),
      muscleMass: z.number().optional(),
      bmr: z.number().optional(),
      visceralFat: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { id, ...data } = input;
      await db.update(bodyComposition).set(data).where(and(eq(bodyComposition.id, id), eq(bodyComposition.userId, OWNER_USER_ID)));
      return { success: true };
    }),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(bodyComposition).where(and(eq(bodyComposition.id, input.id), eq(bodyComposition.userId, OWNER_USER_ID)));
      return { success: true };
    }),

  // Bulk import from Google Sheets
  bulkImport: publicProcedure
    .input(z.array(z.object({
      date: z.string(),
      weight: z.number().optional(),
      bmi: z.number().optional(),
      bodyFatPct: z.number().optional(),
      fatMass: z.number().optional(),
      muscleMass: z.number().optional(),
      bmr: z.number().optional(),
      visceralFat: z.number().optional(),
    })))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      for (const row of input) {
        await db.insert(bodyComposition).values({ ...row, userId: OWNER_USER_ID, source: "sheets" })
          .onConflictDoNothing().catch(() => {});
      }
      return { success: true, count: input.length };
    }),
});

// ─── Heart Rate Router ────────────────────────────────────────────────────────
const heartRateRouter = router({
  getAll: publicProcedure
    .input(z.object({ limit: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(heartRateLogs)
        .where(eq(heartRateLogs.userId, OWNER_USER_ID))
        .orderBy(desc(heartRateLogs.date))
        .limit(input?.limit || 200);
    }),

  add: publicProcedure
    .input(z.object({
      date: z.string(),
      restingHr: z.number().optional(),
      highHr: z.number().optional(),
      maxHr: z.number().optional(),
      hrv: z.number().optional(),
      notes: z.string().optional(),
      source: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.insert(heartRateLogs).values({ ...input, userId: OWNER_USER_ID });
      return { success: true };
    }),

  update: publicProcedure
    .input(z.object({
      id: z.number(),
      date: z.string().optional(),
      restingHr: z.number().optional(),
      highHr: z.number().optional(),
      hrv: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { id, ...data } = input;
      await db.update(heartRateLogs).set(data).where(and(eq(heartRateLogs.id, id), eq(heartRateLogs.userId, OWNER_USER_ID)));
      return { success: true };
    }),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(heartRateLogs).where(and(eq(heartRateLogs.id, input.id), eq(heartRateLogs.userId, OWNER_USER_ID)));
      return { success: true };
    }),

  bulkImport: publicProcedure
    .input(z.array(z.object({
      date: z.string(),
      restingHr: z.number().optional(),
      highHr: z.number().optional(),
    })))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      for (const row of input) {
        await db.insert(heartRateLogs).values({ ...row, userId: OWNER_USER_ID, source: "sheets" }).catch(() => {});
      }
      return { success: true, count: input.length };
    }),
});

// ─── Sleep Router ─────────────────────────────────────────────────────────────
const sleepRouter = router({
  getAll: publicProcedure
    .input(z.object({ limit: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(sleepLogs)
        .where(eq(sleepLogs.userId, OWNER_USER_ID))
        .orderBy(desc(sleepLogs.date))
        .limit(input?.limit || 200);
    }),

  add: publicProcedure
    .input(z.object({
      date: z.string(),
      score: z.number().optional(),
      restingHr: z.number().optional(),
      bodyBattery: z.number().optional(),
      pulseOx: z.number().optional(),
      respiration: z.number().optional(),
      stress: z.number().optional(),
      quality: z.enum(["Poor", "Fair", "Good", "Excellent"]).optional(),
      duration: z.number().optional(),
      deepSleep: z.number().optional(),
      remSleep: z.number().optional(),
      notes: z.string().optional(),
      source: z.string().optional(),
    }))
        .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { score, quality, duration, restingHr: _rhr, ...rest } = input;
      await db.insert(sleepLogs).values({
        ...rest,
        userId: OWNER_USER_ID,
        sleepScore: score,
        sleepQuality: quality,
        sleepDuration: duration,
      });
      return { success: true };
    }),
  update: publicProcedure
    .input(z.object({
      id: z.number(),
      date: z.string().optional(),
      score: z.number().optional(),
      restingHr: z.number().optional(),
      bodyBattery: z.number().optional(),
      pulseOx: z.number().optional(),
      respiration: z.number().optional(),
      quality: z.enum(["Poor", "Fair", "Good", "Excellent"]).optional(),
      duration: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { id, score, quality, duration, restingHr: _rhr, ...rest } = input;
      const data = { ...rest, sleepScore: score, sleepQuality: quality, sleepDuration: duration };
      await db.update(sleepLogs).set(data).where(and(eq(sleepLogs.id, id), eq(sleepLogs.userId, OWNER_USER_ID)));
      return { success: true };
    }),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(sleepLogs).where(and(eq(sleepLogs.id, input.id), eq(sleepLogs.userId, OWNER_USER_ID)));
      return { success: true };
    }),

  bulkImport: publicProcedure
    .input(z.array(z.object({
      date: z.string(),
      score: z.number().optional(),
      restingHr: z.number().optional(),
      bodyBattery: z.number().optional(),
      pulseOx: z.number().optional(),
      respiration: z.number().optional(),
      stress: z.number().optional(),
      quality: z.enum(["Poor", "Fair", "Good", "Excellent"]).optional(),
    })))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      for (const row of input) {
        await db.insert(sleepLogs).values({ ...row, userId: OWNER_USER_ID, source: "sheets" }).catch(() => {});
      }
      return { success: true, count: input.length };
    }),
});

// ─── Progress Photos Router ───────────────────────────────────────────────────
const photosRouter = router({
  getAll: publicProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(progressPhotos)
      .where(eq(progressPhotos.userId, OWNER_USER_ID))
      .orderBy(desc(progressPhotos.date));
  }),

  upload: publicProcedure
    .input(z.object({
      base64: z.string(),
      mimeType: z.string(),
      date: z.string(),
      angle: z.enum(["front", "back", "side_left", "side_right", "other"]).optional(),
      weight: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.base64, "base64");
      const key = `progress-photos/${OWNER_USER_ID}/${nanoid()}.jpg`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.insert(progressPhotos).values({
        userId: OWNER_USER_ID,
        date: input.date,
        photoUrl: url,
        fileKey: key,
        angle: input.angle || "front",
        weight: input.weight,
        notes: input.notes,
      });
      return { success: true, url };
    }),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(progressPhotos).where(and(eq(progressPhotos.id, input.id), eq(progressPhotos.userId, OWNER_USER_ID)));
      return { success: true };
    }),
});

// ─── AI Insights Router ───────────────────────────────────────────────────────
const insightsRouter = router({
  getLatest: publicProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;
    const results = await db.select().from(aiInsights)
      .where(eq(aiInsights.userId, OWNER_USER_ID))
      .orderBy(desc(aiInsights.weekStart))
      .limit(4);
    return results;
  }),

  generate: publicProcedure
    .input(z.object({ type: z.enum(["nutrition", "workout", "recovery", "overall"]).optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Gather recent data (HK timezone)
      const todayStr = todayHK();
      const weekAgoStr = daysAgoHK(7);
      const weekAgo = new Date(weekAgoStr + "T00:00:00+08:00");

      const [meals, sessions, body, sleep, hr] = await Promise.all([
        db.select().from(mealLogs).where(and(eq(mealLogs.userId, OWNER_USER_ID), sql`${mealLogs.loggedAt} >= ${weekAgo}`)).limit(50),
        db.select().from(workoutSessions).where(and(eq(workoutSessions.userId, OWNER_USER_ID), sql`${workoutSessions.startTime} >= ${weekAgo}`)),
        db.select().from(bodyComposition).where(eq(bodyComposition.userId, OWNER_USER_ID)).orderBy(desc(bodyComposition.date)).limit(5),
        db.select().from(sleepLogs).where(and(eq(sleepLogs.userId, OWNER_USER_ID), gte(sleepLogs.date, weekAgoStr))),
        db.select().from(heartRateLogs).where(and(eq(heartRateLogs.userId, OWNER_USER_ID), gte(heartRateLogs.date, weekAgoStr))),
      ]);

      const dataContext = JSON.stringify({ meals, sessions, body, sleep, hr }, null, 2);

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are an expert personal health coach and nutritionist. Analyze the user's fitness data and provide personalized, actionable insights. Write in a supportive, professional tone. Use markdown formatting with headers, bullet points, and emphasis. Respond in both English and Traditional Chinese (繁體中文).`
          },
          {
            role: "user",
            content: `Here is my health data from the past week. Please provide comprehensive ${input.type || "overall"} insights, recommendations, and tips:\n\n${dataContext}\n\nProvide:\n1. Summary of current status\n2. Key observations\n3. Specific recommendations\n4. Goals for next week\n5. Motivational message`
          }
        ]
      });

      const rawContent = response.choices[0]?.message?.content;
      const content = typeof rawContent === "string" ? rawContent : "Unable to generate insights.";
      const weekStart = weekAgoStr;

      await db.insert(aiInsights).values({
        userId: OWNER_USER_ID,
        weekStart,
        content,
        period: input.type || "overall",
      });

      return { content, weekStart };
    }),
});

// ─── Dashboard Router ─────────────────────────────────────────────────────────
const dashboardRouter = router({
  getSummary: publicProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;

        // Use HK timezone for today/week boundaries
    const todayStr = todayHK();
    const todayStart = new Date(todayStr + "T00:00:00+08:00");
    const todayEnd = new Date(todayStr + "T23:59:59+08:00");
    const weekAgoStr = daysAgoHK(7);
    const weekAgoDate = new Date(weekAgoStr + "T00:00:00+08:00");
    const [todayMeals, recentSessions, latestBody, latestSleep, latestHr, weekMeals] = await Promise.all([
      db.select().from(mealLogs).where(and(eq(mealLogs.userId, OWNER_USER_ID), sql`${mealLogs.loggedAt} >= ${todayStart}`, sql`${mealLogs.loggedAt} <= ${todayEnd}`)),
      db.select().from(workoutSessions).where(and(eq(workoutSessions.userId, OWNER_USER_ID), sql`${workoutSessions.startTime} >= ${weekAgoDate}`)).orderBy(desc(workoutSessions.startTime)).limit(7),
      db.select().from(bodyComposition).where(eq(bodyComposition.userId, OWNER_USER_ID)).orderBy(desc(bodyComposition.date)).limit(2),
      db.select().from(sleepLogs).where(eq(sleepLogs.userId, OWNER_USER_ID)).orderBy(desc(sleepLogs.date)).limit(1),
      db.select().from(heartRateLogs).where(eq(heartRateLogs.userId, OWNER_USER_ID)).orderBy(desc(heartRateLogs.date)).limit(1),
      db.select().from(mealLogs).where(and(eq(mealLogs.userId, OWNER_USER_ID), sql`${mealLogs.loggedAt} >= ${weekAgoDate}`)),
    ]);

    const todayCalories = todayMeals.reduce((s, m) => s + (m.calories ?? 0), 0);
    const todayProtein = todayMeals.reduce((s, m) => s + (m.protein ?? 0), 0);
    const todayCarbs = todayMeals.reduce((s, m) => s + (m.carbs ?? 0), 0);
    const todayFat = todayMeals.reduce((s, m) => s + (m.fat ?? 0), 0);

    // Calculate workout streak
    let streak = 0;
    const sessionDates = new Set(recentSessions.map(s => toHKDateString(new Date(s.startTime))));
    for (let i = 0; i < 7; i++) {
      const d = daysAgoHK(i);
      if (sessionDates.has(d)) streak++;
      else if (i > 0) break;
    }

    return {
      today: { calories: todayCalories, protein: todayProtein, carbs: todayCarbs, fat: todayFat, mealCount: todayMeals.length },
      workoutStreak: streak,
      latestBody: latestBody[0] || null,
      prevBody: latestBody[1] || null,
      latestSleep: latestSleep[0] || null,
      latestHr: latestHr[0] || null,
      recentSessions,
      weekMeals,
    };
  }),
});


// ─── CSV Import Router ───────────────────────────────────────────────────────
const csvImportRouter = router({
  /**
   * Parse a CSV string and return a preview (first 5 rows) + detected type.
   * No data is written to the DB at this stage.
   */
  preview: publicProcedure
    .input(z.object({
      csvText: z.string().max(5_000_000), // 5 MB limit
      dataType: z.enum(["body", "sleep", "heartrate", "workout", "nutrition", "auto"]).default("auto"),
    }))
    .mutation(async ({ input }) => {
      const parsed = Papa.parse<Record<string, string>>(input.csvText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim(),
      });

      const headers = parsed.meta.fields ?? [];
      const detectedType: ImportDataType | null =
        input.dataType === "auto" ? detectDataType(headers) : input.dataType as ImportDataType;

      if (!detectedType) {
        return { detectedType: null, headers, preview: [], totalRows: parsed.data.length };
      }

      const allRows = parseRows(parsed.data, detectedType);
      return {
        detectedType,
        headers,
        preview: allRows.slice(0, 5),
        totalRows: parsed.data.length,
        validRows: allRows.length,
      };
    }),

  /**
   * Import all rows from a CSV string into the database.
   * Returns counts of inserted / skipped rows.
   */
  importData: publicProcedure
    .input(z.object({
      csvText: z.string().max(5_000_000),
      dataType: z.enum(["body", "sleep", "heartrate", "workout", "nutrition"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const parsed = Papa.parse<Record<string, string>>(input.csvText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim(),
      });

      const rows = parseRows(parsed.data, input.dataType);
      let inserted = 0;
      let skipped = 0;

      if (input.dataType === "body") {
        for (const r of rows as import("./csvImport").ParsedBodyRow[]) {
          try {
            await db.insert(bodyComposition).values({
              userId: OWNER_USER_ID,
              date: r.date,
              weight: r.weight,
              bmi: r.bmi,
              bodyFatPct: r.bodyFatPct,
              muscleMass: r.muscleMass,
              fatMass: r.fatMass,
              bmr: r.bmr,
              visceralFat: r.visceralFat,
              source: "csv",
            }).onConflictDoNothing();
            inserted++;
          } catch { skipped++; }
        }
      } else if (input.dataType === "sleep") {
        for (const r of rows as import("./csvImport").ParsedSleepRow[]) {
          try {
            await db.insert(sleepLogs).values({
              userId: OWNER_USER_ID,
              date: r.date,
              sleepScore: r.sleepScore,
              sleepDuration: r.sleepDuration,
              deepSleep: r.deepSleep,
              remSleep: r.remSleep,
              bodyBattery: r.bodyBattery,
              pulseOx: r.pulseOx,
              respiration: r.respiration,
              stress: r.stress,
              sleepQuality: r.sleepQuality,
              notes: r.restingHr ? `Resting HR: ${r.restingHr} bpm` : undefined,
              source: "csv",
            }).onConflictDoNothing();
            inserted++;
          } catch { skipped++; }
        }
      } else if (input.dataType === "heartrate") {
        for (const r of rows as import("./csvImport").ParsedHeartRateRow[]) {
          try {
            await db.insert(heartRateLogs).values({
              userId: OWNER_USER_ID,
              date: r.date,
              restingHr: r.restingHr,
              highHr: r.highHr,
              avgHr: r.avgHr,
              hrv: r.hrv,
              source: "csv",
            }).onConflictDoNothing();
            inserted++;
          } catch { skipped++; }
        }
      } else if (input.dataType === "workout") {
        for (const r of rows as import("./csvImport").ParsedWorkoutRow[]) {
          try {
            const [session] = await db.insert(workoutSessions).values({
              userId: OWNER_USER_ID,
              name: r.activityName ?? r.activityType ?? "Imported Workout",
              startTime: new Date(r.date + "T00:00:00Z"),
              duration: r.durationMinutes,
              notes: [
                r.notes,
                r.calories ? `Calories: ${r.calories} kcal` : null,
                r.avgHr ? `Avg HR: ${r.avgHr} bpm` : null,
                r.distanceKm ? `Distance: ${r.distanceKm.toFixed(2)} km` : null,
              ].filter(Boolean).join(" | ") || undefined,
            }).returning();
            if (session) inserted++;
          } catch { skipped++; }
        }
      } else if (input.dataType === "nutrition") {
        for (const r of rows as import("./csvImport").ParsedNutritionRow[]) {
          try {
            const validMealType = ["breakfast", "lunch", "dinner", "snack"].includes(r.mealType ?? "") ? r.mealType as "breakfast" | "lunch" | "dinner" | "snack" : "snack";
            await db.insert(mealLogs).values({
              userId: OWNER_USER_ID,
              foodName: r.foodName ?? "Imported Entry",
              mealType: validMealType,
              servings: r.servings ?? 1,
              calories: r.calories,
              protein: r.protein,
              carbs: r.carbs,
              fat: r.fat,
              fiber: r.fiber,
              loggedAt: new Date(r.date + "T12:00:00Z"),
              notes: "Imported from CSV",
            });
            inserted++;
          } catch { skipped++; }
        }
      }

      return { success: true, inserted, skipped, total: rows.length };
    }),
});

// ─── Charts Router ──────────────────────────────────────────────────────────
const COOKIE_NAME_CONST = "bf_session";
const chartsRouter = router({
  // Fetch body composition history for charting
  bodyHistory: publicProcedure
    .input(z.object({ days: z.number().int().min(7).max(365).default(90) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const sinceStr = daysAgoHK(input.days);
      return db.select({
        date: bodyComposition.date,
        weight: bodyComposition.weight,
        bodyFatPct: bodyComposition.bodyFatPct,
        muscleMass: bodyComposition.muscleMass,
        bmi: bodyComposition.bmi,
      }).from(bodyComposition)
        .where(and(
          eq(bodyComposition.userId, OWNER_USER_ID),
          sql`${bodyComposition.date} >= ${sinceStr}`
        ))
        .orderBy(bodyComposition.date);
    }),

  // Fetch sleep history for charting
  sleepHistory: publicProcedure
    .input(z.object({ days: z.number().int().min(7).max(365).default(90) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const sinceStr = daysAgoHK(input.days);
      const rows = await db.select({
        date: sleepLogs.date,
        sleepScore: sleepLogs.sleepScore,
        sleepDuration: sleepLogs.sleepDuration,
        deepSleep: sleepLogs.deepSleep,
        remSleep: sleepLogs.remSleep,
        lightSleep: sleepLogs.lightSleep,
        bodyBattery: sleepLogs.bodyBattery,
        stress: sleepLogs.stress,
      }).from(sleepLogs)
        .where(and(
          eq(sleepLogs.userId, OWNER_USER_ID),
          sql`${sleepLogs.date} >= ${sinceStr}`
        ))
        .orderBy(sleepLogs.date);
      // Normalize: if values stored as minutes (> 24), convert to hours
      const toHrs = (v: number | null) => v != null && v > 24 ? Math.round((v / 60) * 10) / 10 : v;
      return rows.map(r => ({
        ...r,
        sleepDuration: toHrs(r.sleepDuration),
        deepSleep: toHrs(r.deepSleep),
        remSleep: toHrs(r.remSleep),
        lightSleep: toHrs(r.lightSleep),
      }));
    }),

  // Fetch heart rate history for charting
  heartRateHistory: publicProcedure
    .input(z.object({ days: z.number().int().min(7).max(365).default(90) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const sinceStr = daysAgoHK(input.days);
      return db.select({
        date: heartRateLogs.date,
        restingHr: heartRateLogs.restingHr,
        highHr: heartRateLogs.highHr,
        avgHr: heartRateLogs.avgHr,
        hrv: heartRateLogs.hrv,
      }).from(heartRateLogs)
        .where(and(
          eq(heartRateLogs.userId, OWNER_USER_ID),
          sql`${heartRateLogs.date} >= ${sinceStr}`
        ))
        .orderBy(heartRateLogs.date);
    }),

  // Fetch workout history for charting
  workoutHistory: publicProcedure
    .input(z.object({ days: z.number().int().min(7).max(365).default(90) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const sinceStr = daysAgoHK(input.days);
      const sinceDate = new Date(sinceStr + "T00:00:00+08:00");
      return db.select({
        date: sql<string>`TO_CHAR(${workoutSessions.startTime} AT TIME ZONE 'Asia/Hong_Kong', 'YYYY-MM-DD')`.as("date"),
        duration: workoutSessions.duration,
        totalVolume: workoutSessions.totalVolume,
        name: workoutSessions.name,
      }).from(workoutSessions)
        .where(and(
          eq(workoutSessions.userId, OWNER_USER_ID),
          sql`${workoutSessions.startTime} >= ${sinceDate}`
        ))
        .orderBy(workoutSessions.startTime);
    }),

  // Fetch daily calorie totals for charting
  calorieHistory: publicProcedure
    .input(z.object({ days: z.number().int().min(7).max(365).default(30) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const sinceStr = daysAgoHK(input.days);
      const sinceDate = new Date(sinceStr + "T00:00:00+08:00");
      const rows = await db.select({
        date: sql<string>`TO_CHAR(${mealLogs.loggedAt} AT TIME ZONE 'Asia/Hong_Kong', 'YYYY-MM-DD')`.as("date"),
        totalCalories: sql<number>`COALESCE(SUM(${mealLogs.calories}), 0)`.as("totalCalories"),
        totalProtein: sql<number>`COALESCE(SUM(${mealLogs.protein}), 0)`.as("totalProtein"),
        totalCarbs: sql<number>`COALESCE(SUM(${mealLogs.carbs}), 0)`.as("totalCarbs"),
        totalFat: sql<number>`COALESCE(SUM(${mealLogs.fat}), 0)`.as("totalFat"),
      }).from(mealLogs)
        .where(and(
          eq(mealLogs.userId, OWNER_USER_ID),
          sql`${mealLogs.loggedAt} >= ${sinceDate}`
        ))
        .groupBy(sql`TO_CHAR(${mealLogs.loggedAt} AT TIME ZONE 'Asia/Hong_Kong', 'YYYY-MM-DD')`)
        .orderBy(sql`TO_CHAR(${mealLogs.loggedAt} AT TIME ZONE 'Asia/Hong_Kong', 'YYYY-MM-DD')`);
      return rows;
    }),
});

// ─── Goals Router ───────────────────────────────────────────────────────────
const goalsRouter = router({
  getGoals: publicProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(healthGoals)
      .where(and(eq(healthGoals.userId, OWNER_USER_ID), eq(healthGoals.isActive, true)))
      .orderBy(healthGoals.goalType);
  }),

  setGoal: publicProcedure
    .input(z.object({
      goalType: z.enum([
        "weight", "body_fat_pct", "muscle_mass",
        "sleep_duration", "sleep_score",
        "resting_hr", "hrv",
        "daily_calories", "daily_protein",
        "workout_duration",
      ]),
      targetValue: z.number(),
      unit: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.update(healthGoals)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(healthGoals.userId, OWNER_USER_ID), eq(healthGoals.goalType, input.goalType)));
      const [goal] = await db.insert(healthGoals).values({
        userId: OWNER_USER_ID,
        goalType: input.goalType,
        targetValue: input.targetValue,
        unit: input.unit,
        notes: input.notes,
        isActive: true,
      }).returning();
      return goal;
    }),

  deleteGoal: publicProcedure
    .input(z.object({ goalType: z.enum([
      "weight", "body_fat_pct", "muscle_mass",
      "sleep_duration", "sleep_score",
      "resting_hr", "hrv",
      "daily_calories", "daily_protein",
      "workout_duration",
    ]) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.update(healthGoals)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(healthGoals.userId, OWNER_USER_ID), eq(healthGoals.goalType, input.goalType)));
      return { success: true };
    }),
});

// ─── Image Import Router ────────────────────────────────────────────────────
const imageImportRouter = router({
  /**
   * Upload an image and extract health data using AI vision.
   * Returns extracted fields for user review before saving.
   */
  extract: publicProcedure
    .input(z.object({
      base64: z.string(),
      mimeType: z.string().default("image/jpeg"),
      dataType: z.enum(["body", "sleep", "heartrate", "nutrition", "auto"]).default("auto"),
    }))
    .mutation(async ({ input }) => {
      // Upload image to storage
      const buffer = Buffer.from(input.base64, "base64");
      const ext = input.mimeType.includes("png") ? "png" : "jpg";
      const key = `import-images/${OWNER_USER_ID}/${nanoid()}.${ext}`;
      const { url: imageUrl } = await storagePut(key, buffer, input.mimeType);

      // Build the absolute URL for LLM vision
      const absoluteUrl = `${process.env.VITE_FRONTEND_FORGE_API_URL ?? ""}/manus-storage/${key}`.replace(/\/\/manus/, "/manus");

      const systemPrompt = `You are a health data extraction AI. Analyze the health-related screenshot or photo and extract all numeric health metrics visible. Respond only with valid JSON matching the schema exactly. Use null for any field not visible in the image.`;

      const userPrompt = `Extract all health metrics from this image. The image may be a Garmin Connect screenshot, Apple Health screenshot, body scale display, sleep tracker, or any health app. Return a JSON object with these fields:
{
  "detectedType": "body" | "sleep" | "heartrate" | "nutrition" | "unknown",
  "date": "YYYY-MM-DD or null",
  "body": { "weight": number|null, "bmi": number|null, "bodyFatPct": number|null, "muscleMass": number|null, "visceralFat": number|null },
  "sleep": { "sleepScore": number|null, "sleepDuration": number|null, "deepSleep": number|null, "remSleep": number|null, "bodyBattery": number|null, "pulseOx": number|null, "stress": number|null },
  "heartrate": { "restingHr": number|null, "highHr": number|null, "avgHr": number|null, "hrv": number|null },
  "nutrition": { "calories": number|null, "protein": number|null, "carbs": number|null, "fat": number|null, "fiber": number|null },
  "confidence": "high" | "medium" | "low",
  "notes": "brief description of what was detected"
}`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
              { type: "text", text: userPrompt },
            ],
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "health_extraction",
            strict: true,
            schema: {
              type: "object",
              properties: {
                detectedType: { type: "string" },
                date: { type: ["string", "null"] },
                body: {
                  type: "object",
                  properties: {
                    weight: { type: ["number", "null"] },
                    bmi: { type: ["number", "null"] },
                    bodyFatPct: { type: ["number", "null"] },
                    muscleMass: { type: ["number", "null"] },
                    visceralFat: { type: ["number", "null"] },
                  },
                  required: ["weight", "bmi", "bodyFatPct", "muscleMass", "visceralFat"],
                  additionalProperties: false,
                },
                sleep: {
                  type: "object",
                  properties: {
                    sleepScore: { type: ["number", "null"] },
                    sleepDuration: { type: ["number", "null"] },
                    deepSleep: { type: ["number", "null"] },
                    remSleep: { type: ["number", "null"] },
                    bodyBattery: { type: ["number", "null"] },
                    pulseOx: { type: ["number", "null"] },
                    stress: { type: ["number", "null"] },
                  },
                  required: ["sleepScore", "sleepDuration", "deepSleep", "remSleep", "bodyBattery", "pulseOx", "stress"],
                  additionalProperties: false,
                },
                heartrate: {
                  type: "object",
                  properties: {
                    restingHr: { type: ["number", "null"] },
                    highHr: { type: ["number", "null"] },
                    avgHr: { type: ["number", "null"] },
                    hrv: { type: ["number", "null"] },
                  },
                  required: ["restingHr", "highHr", "avgHr", "hrv"],
                  additionalProperties: false,
                },
                nutrition: {
                  type: "object",
                  properties: {
                    calories: { type: ["number", "null"] },
                    protein: { type: ["number", "null"] },
                    carbs: { type: ["number", "null"] },
                    fat: { type: ["number", "null"] },
                    fiber: { type: ["number", "null"] },
                  },
                  required: ["calories", "protein", "carbs", "fat", "fiber"],
                  additionalProperties: false,
                },
                confidence: { type: "string" },
                notes: { type: "string" },
              },
              required: ["detectedType", "date", "body", "sleep", "heartrate", "nutrition", "confidence", "notes"],
              additionalProperties: false,
            },
          },
        },
      });

      const rawMsg = response.choices[0]?.message?.content;
      const contentStr = typeof rawMsg === "string" ? rawMsg : "{}";
      const extracted = JSON.parse(contentStr);
      return { ...extracted, imageUrl };
    }),

  /**
   * Save extracted image data to the database after user confirms.
   */
  save: publicProcedure
    .input(z.object({
      date: z.string(),
      dataType: z.enum(["body", "sleep", "heartrate", "nutrition"]),
      body: z.object({
        weight: z.number().nullable().optional(),
        bmi: z.number().nullable().optional(),
        bodyFatPct: z.number().nullable().optional(),
        muscleMass: z.number().nullable().optional(),
        visceralFat: z.number().nullable().optional(),
      }).optional(),
      sleep: z.object({
        sleepScore: z.number().nullable().optional(),
        sleepDuration: z.number().nullable().optional(),
        deepSleep: z.number().nullable().optional(),
        remSleep: z.number().nullable().optional(),
        bodyBattery: z.number().nullable().optional(),
        pulseOx: z.number().nullable().optional(),
        stress: z.number().nullable().optional(),
      }).optional(),
      heartrate: z.object({
        restingHr: z.number().nullable().optional(),
        highHr: z.number().nullable().optional(),
        avgHr: z.number().nullable().optional(),
        hrv: z.number().nullable().optional(),
      }).optional(),
      nutrition: z.object({
        calories: z.number().nullable().optional(),
        protein: z.number().nullable().optional(),
        carbs: z.number().nullable().optional(),
        fat: z.number().nullable().optional(),
        fiber: z.number().nullable().optional(),
      }).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      if (input.dataType === "body" && input.body) {
        await db.insert(bodyComposition).values({
          userId: OWNER_USER_ID,
          date: input.date,
          weight: input.body.weight ?? undefined,
          bmi: input.body.bmi ?? undefined,
          bodyFatPct: input.body.bodyFatPct ?? undefined,
          muscleMass: input.body.muscleMass ?? undefined,
          visceralFat: input.body.visceralFat ?? undefined,
          source: "image",
        }).onConflictDoNothing();
      } else if (input.dataType === "sleep" && input.sleep) {
        await db.insert(sleepLogs).values({
          userId: OWNER_USER_ID,
          date: input.date,
          sleepScore: input.sleep.sleepScore ?? undefined,
          sleepDuration: input.sleep.sleepDuration ?? undefined,
          deepSleep: input.sleep.deepSleep ?? undefined,
          remSleep: input.sleep.remSleep ?? undefined,
          bodyBattery: input.sleep.bodyBattery ?? undefined,
          pulseOx: input.sleep.pulseOx ?? undefined,
          stress: input.sleep.stress ?? undefined,
          source: "image",
        }).onConflictDoNothing();
      } else if (input.dataType === "heartrate" && input.heartrate) {
        await db.insert(heartRateLogs).values({
          userId: OWNER_USER_ID,
          date: input.date,
          restingHr: input.heartrate.restingHr ?? undefined,
          highHr: input.heartrate.highHr ?? undefined,
          avgHr: input.heartrate.avgHr ?? undefined,
          hrv: input.heartrate.hrv ?? undefined,
          source: "image",
        }).onConflictDoNothing();
      } else if (input.dataType === "nutrition" && input.nutrition) {
        await db.insert(mealLogs).values({
          userId: OWNER_USER_ID,
          foodName: "Image Import",
          mealType: "snack",
          servings: 1,
          calories: input.nutrition.calories ?? undefined,
          protein: input.nutrition.protein ?? undefined,
          carbs: input.nutrition.carbs ?? undefined,
          fat: input.nutrition.fat ?? undefined,
          fiber: input.nutrition.fiber ?? undefined,
          loggedAt: new Date(input.date + "T12:00:00Z"),
          notes: "Imported from image",
        });
      }

      return { success: true };
    }),
});

// ─── App Router ───────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  nutrition: nutritionRouter,
  workout: workoutRouter,
  body: bodyRouter,
  heartRate: heartRateRouter,
  sleep: sleepRouter,
  photos: photosRouter,
  insights: insightsRouter,
  dashboard: dashboardRouter,
  csvImport: csvImportRouter,
  charts: chartsRouter,
  goals: goalsRouter,
  imageImport: imageImportRouter,
});

export type AppRouter = typeof appRouter;
