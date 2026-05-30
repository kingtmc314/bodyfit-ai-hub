import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import {
  mealLogs, foodItems, workoutSessions, workoutSets, exercises,
  bodyComposition, heartRateLogs, sleepLogs, progressPhotos, aiInsights,
  healthGoals, runningLogs, runningShoes, races, favouriteExercises
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
            content: [
              {
                type: "image_url" as const,
                image_url: { url: input.imageUrl, detail: "high" as const }
              },
              {
                type: "text" as const,
                text: `Identify all food items visible in this image and estimate their nutritional content. Provide the response as JSON with this exact structure: {"foods":[{"name":"Food Name","nameZh":"食物中文名","quantity":150,"unit":"g","calories":250,"protein":15,"carbs":30,"fat":8,"fiber":2}],"totalCalories":250,"totalProtein":15,"totalCarbs":30,"totalFat":8,"confidence":"high","notes":"Brief description"}`
              }
            ]
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
      if (input?.startDate) conditions.push(sql`${workoutSessions.startTime} >= ${new Date(input.startDate + 'T00:00:00+08:00')}`);
      if (input?.endDate) conditions.push(sql`${workoutSessions.startTime} <= ${new Date(input.endDate + 'T23:59:59+08:00')}`);
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

  // ─── Exercise Favourites ────────────────────────────────────────────────────────────
  getFavourites: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.execute(sql`
        SELECT exercise_name FROM favourite_exercises
        WHERE "userId" = ${OWNER_USER_ID}
        ORDER BY "createdAt" DESC
      `);
      return ((rows as any).rows ?? rows).map((r: any) => r.exercise_name as string);
    }),

  toggleFavourite: publicProcedure
    .input(z.object({ exerciseName: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      const existing = await db.execute(sql`
        SELECT id FROM favourite_exercises
        WHERE "userId" = ${OWNER_USER_ID} AND exercise_name = ${input.exerciseName}
      `);
      const rows = (existing as any).rows ?? existing;
      if (rows.length > 0) {
        await db.execute(sql`
          DELETE FROM favourite_exercises
          WHERE "userId" = ${OWNER_USER_ID} AND exercise_name = ${input.exerciseName}
        `);
        return { isFavourite: false };
      } else {
        await db.execute(sql`
          INSERT INTO favourite_exercises ("userId", exercise_name)
          VALUES (${OWNER_USER_ID}, ${input.exerciseName})
        `);
        return { isFavourite: true };
      }
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
      const rows = await db.select().from(sleepLogs)
        .where(eq(sleepLogs.userId, OWNER_USER_ID))
        .orderBy(desc(sleepLogs.date))
        .limit(input?.limit || 200);
      // Normalize sleepDuration from minutes to hours if > 24
      const toHrs = (v: number | null | undefined) =>
        v != null && v > 24 ? Math.round((v / 60) * 10) / 10 : v ?? null;
      return rows.map(r => ({
        ...r,
        sleepDuration: toHrs(r.sleepDuration),
        deepSleep: toHrs(r.deepSleep),
        remSleep: toHrs(r.remSleep),
        lightSleep: toHrs(r.lightSleep),
        awakeDuration: toHrs(r.awakeDuration),
      }));
    }),

  add: publicProcedure
    .input(z.object({
      date: z.string(),
      score: z.number().optional(),
      restingHr: z.number().optional(),
      bodyBattery: z.number().optional(),
      pulseOx: z.number().optional(),
      respiration: z.number().optional(),
      hrv: z.number().optional(),
      quality: z.enum(["Poor", "Fair", "Good", "Excellent"]).optional(),
      duration: z.number().optional(),
      deepSleep: z.number().optional(),
      remSleep: z.number().optional(),
      lightSleep: z.number().optional(),
      awakeDuration: z.number().optional(),
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
      hrv: z.number().optional(),
      quality: z.enum(["Poor", "Fair", "Good", "Excellent"]).optional(),
      duration: z.number().optional(),
      deepSleep: z.number().optional(),
      remSleep: z.number().optional(),
      lightSleep: z.number().optional(),
      awakeDuration: z.number().optional(),
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
      hrv: z.number().optional(),
      quality: z.enum(["Poor", "Fair", "Good", "Excellent"]).optional(),
      duration: z.number().optional(),
      deepSleep: z.number().optional(),
      remSleep: z.number().optional(),
      lightSleep: z.number().optional(),
      awakeDuration: z.number().optional(),
    })))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      for (const row of input) {
        const { score, quality, duration, restingHr: _rhr, ...rest } = row;
        await db.insert(sleepLogs).values({
          ...rest,
          userId: OWNER_USER_ID,
          source: "sheets",
          sleepScore: score,
          sleepQuality: quality,
          sleepDuration: duration,
        }).catch(() => {});
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
      dataType: z.enum(["body", "sleep", "heartrate", "workout", "nutrition", "running", "auto"]).default("auto"),
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
      dataType: z.enum(["body", "sleep", "heartrate", "workout", "nutrition", "running"]),
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
              lightSleep: r.lightSleep,
              awakeDuration: r.awakeDuration,
              bodyBattery: r.bodyBattery,
              pulseOx: r.pulseOx,
              respiration: r.respiration,
              sleepQuality: r.sleepQuality,
              hrv: r.hrv,
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
      } else if (input.dataType === "running") {
        for (const r of rows as import("./csvImport").ParsedRunningRow[]) {
          try {
            await db.execute(sql`
              INSERT INTO running_logs (
                date, running_type, running_shoes, distance_km, hour, minutes, second,
                average_pace, best_pace, average_heart_rate, maximum_heart_rate,
                average_cadence, max_cadence, avg_stride_length_m, avg_vertical_ratio,
                vertical_oscillation_cm, avg_ground_contact_time_ms, calories,
                temperature, humidity, notes
              ) VALUES (
                ${r.date},
                ${r.runningType ?? null},
                ${r.runningShoes ?? null},
                ${r.distanceKm ?? null},
                ${r.hour ?? null},
                ${r.minutes ?? null},
                ${r.second ?? null},
                ${r.averagePace ?? null},
                ${r.bestPace ?? null},
                ${r.averageHeartRate ?? null},
                ${r.maximumHeartRate ?? null},
                ${r.averageCadence ?? null},
                ${r.maxCadence ?? null},
                ${r.avgStrideLengthM ?? null},
                ${r.avgVerticalRatio ?? null},
                ${r.verticalOscillationCm ?? null},
                ${r.avgGroundContactTimeMs ?? null},
                ${r.calories ?? null},
                ${r.temperature ?? null},
                ${r.humidity ?? null},
                ${r.notes ?? null}
              )
              ON CONFLICT DO NOTHING
            `);
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
        hrv: sleepLogs.hrv,
        restingHr: sleepLogs.restingHr,
        pulseOx: sleepLogs.pulseOx,
        respiration: sleepLogs.respiration,
        bedtime: sleepLogs.bedtime,
        waketime: sleepLogs.waketime,
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
  // HRV comes from sleep_logs (Garmin measures HRV during sleep)
  heartRateHistory: publicProcedure
    .input(z.object({ days: z.number().int().min(7).max(365).default(90) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const sinceStr = daysAgoHK(input.days);
      // Get heart rate data
      const hrRows = await db.select({
        date: heartRateLogs.date,
        restingHr: heartRateLogs.restingHr,
        highHr: heartRateLogs.highHr,
        avgHr: heartRateLogs.avgHr,
      }).from(heartRateLogs)
        .where(and(
          eq(heartRateLogs.userId, OWNER_USER_ID),
          sql`${heartRateLogs.date} >= ${sinceStr}`
        ))
        .orderBy(heartRateLogs.date);
      // Get HRV from sleep_logs (same date range)
      const sleepHrvRows = await db.select({
        date: sleepLogs.date,
        hrv: sleepLogs.hrv,
      }).from(sleepLogs)
        .where(and(
          eq(sleepLogs.userId, OWNER_USER_ID),
          sql`${sleepLogs.date} >= ${sinceStr}`,
          sql`${sleepLogs.hrv} IS NOT NULL`
        ))
        .orderBy(sleepLogs.date);
      // Build HRV map by date
      const hrvByDate = new Map(sleepHrvRows.map(r => [r.date, r.hrv]));
      // Merge: use HR rows as base, attach HRV from sleep
      const allDates = new Set([...hrRows.map(r => r.date), ...sleepHrvRows.map(r => r.date)]);
      const merged = Array.from(allDates).sort().map(date => {
        const hr = hrRows.find(r => r.date === date);
        return {
          date,
          restingHr: hr?.restingHr ?? null,
          highHr: hr?.highHr ?? null,
          avgHr: hr?.avgHr ?? null,
          hrv: hrvByDate.get(date) ?? null,
        };
      });
      return merged;
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
  "sleep": { "sleepScore": number|null, "sleepDuration": number|null, "deepSleep": number|null, "remSleep": number|null, "bodyBattery": number|null, "pulseOx": number|null, "hrv": number|null },
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
                    hrv: { type: ["number", "null"] },
                  },
                  required: ["sleepScore", "sleepDuration", "deepSleep", "remSleep", "bodyBattery", "pulseOx", "hrv"],
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
        hrv: z.number().nullable().optional(),
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
          hrv: input.sleep.hrv ?? undefined,
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


// --- Running Router ---
const runningRouter = router({
  getActiveShoes: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.execute(sql`
        SELECT id, shoes_name, brand, status
        FROM running_shoes
        WHERE status != 'Retired'
        ORDER BY status ASC, shoes_name ASC
      `);
      return (rows as any).rows ?? rows;
    }),

  getLogs: publicProcedure
    .input(z.object({ limit: z.number().optional().default(200) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.execute(
        sql`SELECT * FROM running_logs ORDER BY date DESC LIMIT ${input.limit}`
      );
      return (rows as any).rows ?? rows;
    }),

  getStats: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db.execute(sql`
        SELECT
          COUNT(*) as total_runs,
          SUM(distance_km::numeric) as total_distance,
          AVG(distance_km::numeric) as avg_distance,
          AVG(average_pace::numeric) as avg_pace_sec,
          AVG(average_heart_rate::numeric) as avg_hr,
          AVG(average_cadence::numeric) as avg_cadence,
          MAX(distance_km::numeric) as max_distance,
          MIN(average_pace::numeric) as best_pace_sec,
          SUM(calories::numeric) as total_calories,
          MIN(date) as first_run,
          MAX(date) as last_run
        FROM running_logs
      `);
      const typeRows = await db.execute(sql`
        SELECT running_type, COUNT(*) as count, SUM(distance_km::numeric) as total_km
        FROM running_logs
        GROUP BY running_type
        ORDER BY count DESC
      `);
      const monthlyRows = await db.execute(sql`
        SELECT
          SUBSTRING(date, 1, 7) as month,
          COUNT(*) as runs,
          SUM(distance_km::numeric) as distance,
          AVG(average_pace::numeric) as avg_pace,
          AVG(average_heart_rate::numeric) as avg_hr
        FROM running_logs
        WHERE date >= TO_CHAR(NOW() - INTERVAL '12 months', 'YYYY-MM-DD')
        GROUP BY SUBSTRING(date, 1, 7)
        ORDER BY month ASC
      `);
      return {
        summary: ((rows as any).rows ?? rows)[0],
        byType: (typeRows as any).rows ?? typeRows,
        monthly: (monthlyRows as any).rows ?? monthlyRows,
      };
    }),

  addLog: publicProcedure
    .input(z.object({
      date: z.string(),
      runningType: z.string().optional(),
      runningShoes: z.string().optional(),
      distanceKm: z.number().optional(),
      hour: z.number().optional(),
      minutes: z.number().optional(),
      second: z.number().optional(),
      averagePace: z.string().optional(),
      bestPace: z.string().optional(),
      averageHeartRate: z.number().optional(),
      maximumHeartRate: z.number().optional(),
      averageCadence: z.number().optional(),
      maxCadence: z.number().optional(),
      avgStrideLengthM: z.number().optional(),
      avgVerticalRatio: z.number().optional(),
      verticalOscillationCm: z.number().optional(),
      avgGroundContactTimeMs: z.number().optional(),
      calories: z.number().optional(),
      temperature: z.number().optional(),
      humidity: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      await db.execute(sql`
        INSERT INTO running_logs (
          date, running_type, running_shoes, distance_km, hour, minutes, second,
          average_pace, best_pace, average_heart_rate, maximum_heart_rate,
          average_cadence, max_cadence, avg_stride_length_m, avg_vertical_ratio,
          vertical_oscillation_cm, avg_ground_contact_time_ms,
          calories, temperature, humidity, notes
        ) VALUES (
          ${input.date},
          ${input.runningType ?? null},
          ${input.runningShoes ?? null},
          ${input.distanceKm ?? null},
          ${input.hour ?? null},
          ${input.minutes ?? null},
          ${input.second ?? null},
          ${input.averagePace ?? null},
          ${input.bestPace ?? null},
          ${input.averageHeartRate ?? null},
          ${input.maximumHeartRate ?? null},
          ${input.averageCadence ?? null},
          ${input.maxCadence ?? null},
          ${input.avgStrideLengthM ?? null},
          ${input.avgVerticalRatio ?? null},
          ${input.verticalOscillationCm ?? null},
          ${input.avgGroundContactTimeMs ?? null},
          ${input.calories ?? null},
          ${input.temperature ?? null},
          ${input.humidity ?? null},
          ${input.notes ?? null}
        )
      `);
      return { success: true };
    }),

  updateLog: publicProcedure
    .input(z.object({
      id: z.number(),
      date: z.string().optional(),
      runningType: z.string().optional(),
      runningShoes: z.string().optional(),
      distanceKm: z.number().optional(),
      hour: z.number().optional(),
      minutes: z.number().optional(),
      second: z.number().optional(),
      averagePace: z.string().optional(),
      bestPace: z.string().optional(),
      averageHeartRate: z.number().optional(),
      maximumHeartRate: z.number().optional(),
      averageCadence: z.number().optional(),
      maxCadence: z.number().optional(),
      avgStrideLengthM: z.number().optional(),
      avgVerticalRatio: z.number().optional(),
      verticalOscillationCm: z.number().optional(),
      avgGroundContactTimeMs: z.number().optional(),
      calories: z.number().optional(),
      temperature: z.number().optional(),
      humidity: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      const { id, ...fields } = input;
      const setClauses = Object.entries(fields)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => {
          const col = k.replace(/([A-Z])/g, '_$1').toLowerCase();
          return sql`${sql.raw(col)} = ${v}`;
        });
      if (!setClauses.length) return { success: true };
      await db.execute(sql`UPDATE running_logs SET ${sql.join(setClauses, sql`, `)} WHERE id = ${id}`);
      return { success: true };
    }),

  deleteLog: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      await db.execute(sql`DELETE FROM running_logs WHERE id = ${input.id}`);
      return { success: true };
    }),

  getAIAnalysis: publicProcedure
    .input(z.object({ weeks: z.number().optional().default(12) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      const recentRows = await db.execute(sql`
        SELECT date, running_type, running_shoes, distance_km, hour, minutes, second,
               average_pace, best_pace, average_heart_rate, maximum_heart_rate,
               average_cadence, max_cadence, avg_stride_length_m, avg_vertical_ratio,
               vertical_oscillation_cm, avg_ground_contact_time_ms, calories,
               temperature, humidity, notes
        FROM running_logs
        ORDER BY date DESC
        LIMIT ${input.weeks * 7}
      `);
      const logs = (recentRows as any).rows ?? recentRows;

      if (!logs.length) return { analysis: '目前沒有足夠的跑步記錄。' };
      const statsRows = await db.execute(sql`
        SELECT
          COUNT(*) as total_runs,
          SUM(distance_km::numeric) as total_distance,
          AVG(average_pace::numeric) as avg_pace,
          AVG(average_heart_rate::numeric) as avg_hr,
          AVG(average_cadence::numeric) as avg_cadence,
          AVG(avg_stride_length_m::numeric) as avg_stride,
          AVG(avg_vertical_ratio::numeric) as avg_vr,
          AVG(vertical_oscillation_cm::numeric) as avg_vo
        FROM running_logs
        WHERE date >= TO_CHAR(NOW() - (${input.weeks} * INTERVAL '1 week'), 'YYYY-MM-DD')
      `);
      const stats = ((statsRows as any).rows ?? statsRows)[0];

      const formatPace = (sec: number | null) => {
        if (!sec) return 'N/A';
        const m = Math.floor(sec / 60);
        const s = Math.round(sec % 60);
        return `${m}:${String(s).padStart(2, '0')}/km`;
      };

      const summary = logs.slice(0, 30).map((r: any) => [
        `日期:${r.date?.toString().slice(0,10)}`,
        r.running_type ? `類型:${r.running_type}` : '',
        r.distance_km ? `距離:${parseFloat(r.distance_km).toFixed(2)}km` : '',
        (r.hour != null || r.minutes != null) ? `時間:${r.hour||0}h${r.minutes||0}m${r.second||0}s` : '',
        r.average_pace ? `配速:${formatPace(parseFloat(r.average_pace) * 60)}` : '',
        r.average_heart_rate ? `心率:${r.average_heart_rate}bpm` : '',
        r.average_cadence ? `步頻:${r.average_cadence}spm` : '',
        r.avg_stride_length_m ? `步幅:${r.avg_stride_length_m}m` : '',
        r.avg_vertical_ratio ? `垂直比:${r.avg_vertical_ratio}%` : '',
        r.vertical_oscillation_cm ? `振幅:${r.vertical_oscillation_cm}cm` : '',
        r.running_shoes ? `跑鞋:${r.running_shoes}` : '',
        r.notes ? `備註:${r.notes}` : '',
      ].filter(Boolean).join(', ')).join('\\n');

      const res = await invokeLLM({
        messages: [
          { role: 'system', content: '你是一位專業跑步教練和運動科學分析師。請用繁體中文回答，結構清晰，分段說明。' },
          { role: 'user', content: `請分析我的跑步數據，最近${input.weeks}週共${logs.length}次跑步。\n總距離:${parseFloat(stats?.total_distance||0).toFixed(1)}km，平均配速:${formatPace(parseFloat(stats?.avg_pace||0)*60)}，平均心率:${Math.round(stats?.avg_hr||0)}bpm，平均步頻:${Math.round(stats?.avg_cadence||0)}spm，平均步幅:${parseFloat(stats?.avg_stride||0).toFixed(2)}m，平均垂直比:${parseFloat(stats?.avg_vr||0).toFixed(1)}%，平均振幅:${parseFloat(stats?.avg_vo||0).toFixed(1)}cm\n\n詳細記錄(最近30次):\n${summary}\n\n請提供以下分析:\n1. 跑步表現總結(配速趨勢、距離進展、心率效率)\n2. 步頻與步幅分析(是否達到理想步頻 170-180spm)\n3. 垂直振幅與垂直比分析(跑步經濟性評估)\n4. 訓練負荷與類型分布分析\n5. 具體改進建議(至少 3 項可執行的訓練建議)` },
        ],
      });
      return { analysis: res.choices[0]?.message?.content ?? '分析失敗，請稍後再試。' };
    }),

  // ─── Shoe Locker CRUD ────────────────────────────────────────────────────────
  getShoes: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.execute(sql`
        SELECT s.*,
          COALESCE(s.initial_km::numeric, 0) + COALESCE(SUM(r.distance_km::numeric), 0) AS total_km
        FROM running_shoes s
        LEFT JOIN running_logs r ON r.shoes_id = s.id
        GROUP BY s.id
        ORDER BY s.status ASC, s.shoes_name ASC
      `);
      return (rows as any).rows ?? rows;
    }),

  addShoe: publicProcedure
    .input(z.object({
      shoesName: z.string().min(1),
      brand: z.string().optional(),
      model: z.string().optional(),
      status: z.string().optional().default('Active'),
      purchaseDate: z.string().optional(),
      retirementDate: z.string().optional(),
      initialKm: z.number().optional().default(0),
      notes: z.string().optional(),
      price: z.number().optional(),
      firstUseDate: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      await db.execute(sql`
        INSERT INTO running_shoes (shoes_name, brand, model, status, purchase_date, retirement_date, initial_km, notes, price, firstusedate)
        VALUES (${input.shoesName}, ${input.brand ?? null}, ${input.model ?? null}, ${input.status ?? 'Active'},
          ${input.purchaseDate ?? null}, ${input.retirementDate ?? null}, ${input.initialKm ?? 0},
          ${input.notes ?? null}, ${input.price ?? null}, ${input.firstUseDate ?? null})
      `);
      return { success: true };
    }),

  updateShoe: publicProcedure
    .input(z.object({
      id: z.number(),
      shoesName: z.string().min(1).optional(),
      brand: z.string().optional(),
      model: z.string().optional(),
      status: z.string().optional(),
      purchaseDate: z.string().optional(),
      retirementDate: z.string().optional(),
      initialKm: z.number().optional(),
      notes: z.string().optional(),
      price: z.number().optional(),
      firstUseDate: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      const { id, ...fields } = input;
      const sets: string[] = [];
      const vals: any[] = [];
      if (fields.shoesName !== undefined) { sets.push(`shoes_name = $${sets.length+1}`); vals.push(fields.shoesName); }
      if (fields.brand !== undefined) { sets.push(`brand = $${sets.length+1}`); vals.push(fields.brand); }
      if (fields.model !== undefined) { sets.push(`model = $${sets.length+1}`); vals.push(fields.model); }
      if (fields.status !== undefined) { sets.push(`status = $${sets.length+1}`); vals.push(fields.status); }
      if (fields.purchaseDate !== undefined) { sets.push(`purchase_date = $${sets.length+1}`); vals.push(fields.purchaseDate); }
      if (fields.retirementDate !== undefined) { sets.push(`retirement_date = $${sets.length+1}`); vals.push(fields.retirementDate); }
      if (fields.initialKm !== undefined) { sets.push(`initial_km = $${sets.length+1}`); vals.push(fields.initialKm); }
      if (fields.notes !== undefined) { sets.push(`notes = $${sets.length+1}`); vals.push(fields.notes); }
      if (fields.price !== undefined) { sets.push(`price = $${sets.length+1}`); vals.push(fields.price); }
      if (fields.firstUseDate !== undefined) { sets.push(`firstusedate = $${sets.length+1}`); vals.push(fields.firstUseDate); }
      if (sets.length === 0) return { success: true };
      vals.push(id);
      const { Client } = (await import('pg')).default as any;
      const client = new Client({ connectionString: process.env.SUPABASE_DATABASE_URL, ssl: { rejectUnauthorized: false } });
      await client.connect();
      await client.query(`UPDATE running_shoes SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${vals.length}`, vals);
      await client.end();
      return { success: true };
    }),

  deleteShoe: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      await db.execute(sql`DELETE FROM running_shoes WHERE id = ${input.id}`);
      return { success: true };
    }),

  // ─── Races CRUD ──────────────────────────────────────────────────────────────
  getRaces: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.execute(sql`SELECT * FROM races ORDER BY date DESC`);
      return (rows as any).rows ?? rows;
    }),

  addRace: publicProcedure
    .input(z.object({
      raceName: z.string().min(1),
      date: z.string(),
      distanceKm: z.number().optional(),
      location: z.string().optional(),
      registration: z.string().optional(),
      bibNo: z.string().optional(),
      isPb: z.boolean().optional().default(false),
      finishTime: z.string().optional(),
      overallPlace: z.number().optional(),
      ageGroupPlace: z.number().optional(),
      genderGroupPlace: z.number().optional(),
      runningShoes: z.string().optional(),
      shoesId: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      await db.execute(sql`
        INSERT INTO races (race_name, date, distance_km, location, registration, bib_no, is_pb, finish_time,
          overall_place, age_group_place, gender_group_place, running_shoes, shoes_id, notes)
        VALUES (${input.raceName}, ${input.date}, ${input.distanceKm ?? null}, ${input.location ?? null},
          ${input.registration ?? null}, ${input.bibNo ?? null}, ${input.isPb ?? false}, ${input.finishTime ?? null},
          ${input.overallPlace ?? null}, ${input.ageGroupPlace ?? null}, ${input.genderGroupPlace ?? null},
          ${input.runningShoes ?? null}, ${input.shoesId ?? null}, ${input.notes ?? null})
      `);
      return { success: true };
    }),

  updateRace: publicProcedure
    .input(z.object({
      id: z.number(),
      raceName: z.string().optional(),
      date: z.string().optional(),
      distanceKm: z.number().optional(),
      location: z.string().optional(),
      registration: z.string().optional(),
      bibNo: z.string().optional(),
      isPb: z.boolean().optional(),
      finishTime: z.string().optional(),
      overallPlace: z.number().optional(),
      ageGroupPlace: z.number().optional(),
      genderGroupPlace: z.number().optional(),
      runningShoes: z.string().optional(),
      shoesId: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      const { id, ...f } = input;
      const sets: string[] = [];
      const vals: any[] = [];
      if (f.raceName !== undefined) { sets.push(`race_name = $${sets.length+1}`); vals.push(f.raceName); }
      if (f.date !== undefined) { sets.push(`date = $${sets.length+1}`); vals.push(f.date); }
      if (f.distanceKm !== undefined) { sets.push(`distance_km = $${sets.length+1}`); vals.push(f.distanceKm); }
      if (f.location !== undefined) { sets.push(`location = $${sets.length+1}`); vals.push(f.location); }
      if (f.registration !== undefined) { sets.push(`registration = $${sets.length+1}`); vals.push(f.registration); }
      if (f.bibNo !== undefined) { sets.push(`bib_no = $${sets.length+1}`); vals.push(f.bibNo); }
      if (f.isPb !== undefined) { sets.push(`is_pb = $${sets.length+1}`); vals.push(f.isPb); }
      if (f.finishTime !== undefined) { sets.push(`finish_time = $${sets.length+1}`); vals.push(f.finishTime); }
      if (f.overallPlace !== undefined) { sets.push(`overall_place = $${sets.length+1}`); vals.push(f.overallPlace); }
      if (f.ageGroupPlace !== undefined) { sets.push(`age_group_place = $${sets.length+1}`); vals.push(f.ageGroupPlace); }
      if (f.genderGroupPlace !== undefined) { sets.push(`gender_group_place = $${sets.length+1}`); vals.push(f.genderGroupPlace); }
      if (f.runningShoes !== undefined) { sets.push(`running_shoes = $${sets.length+1}`); vals.push(f.runningShoes); }
      if (f.shoesId !== undefined) { sets.push(`shoes_id = $${sets.length+1}`); vals.push(f.shoesId); }
      if (f.notes !== undefined) { sets.push(`notes = $${sets.length+1}`); vals.push(f.notes); }
      if (sets.length === 0) return { success: true };
      vals.push(id);
      const { Client } = (await import('pg')).default as any;
      const client = new Client({ connectionString: process.env.SUPABASE_DATABASE_URL, ssl: { rejectUnauthorized: false } });
      await client.connect();
      await client.query(`UPDATE races SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${vals.length}`, vals);
      await client.end();
      return { success: true };
    }),

  deleteRace: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      await db.execute(sql`DELETE FROM races WHERE id = ${input.id}`);
      return { success: true };
    }),

  getPBs: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.execute(sql`
        SELECT DISTINCT ON (distance_km) distance_km, race_name, date, finish_time, location
        FROM races
        WHERE is_pb = true AND finish_time IS NOT NULL
        ORDER BY distance_km ASC, finish_time ASC
      `);
      return (rows as any).rows ?? rows;
    }),

  analyzeRace: publicProcedure
    .input(z.object({ raceId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      const raceRows = await db.execute(sql`SELECT * FROM races WHERE id = ${input.raceId}`);
      const race = ((raceRows as any).rows ?? raceRows)[0];
      if (!race) throw new Error('Race not found');
      const pbRows = await db.execute(sql`
        SELECT distance_km, finish_time FROM races
        WHERE is_pb = true AND finish_time IS NOT NULL
        ORDER BY distance_km ASC
      `);
      const pbs = (pbRows as any).rows ?? pbRows;
      const trainingRows = await db.execute(sql`
        SELECT date, distance_km, average_pace, average_heart_rate, running_type
        FROM running_logs
        WHERE date >= (${race.date}::date - interval '12 weeks')::text
          AND date <= ${race.date}
        ORDER BY date DESC
        LIMIT 50
      `);
      const training = (trainingRows as any).rows ?? trainingRows;
      const pbSummary = pbs.map((p: any) => `${parseFloat(p.distance_km).toFixed(1)}km: ${p.finish_time}`).join(', ');
      const trainingSummary = training.map((r: any) =>
        `${r.date}: ${parseFloat(r.distance_km||0).toFixed(1)}km, 配速${r.average_pace||'N/A'}, 心率${r.average_heart_rate||'N/A'}bpm`
      ).join('\n');
      const res = await invokeLLM({
        messages: [
          { role: 'system', content: '你是一位專業馬拉松教練和運動科學分析師。請用繁體中文回答，結構清晰。' },
          { role: 'user', content: `請分析以下賽事表現並提供預測和建議。

賽事: ${race.race_name}
日期: ${race.date}
距離: ${race.distance_km}km
完成時間: ${race.finish_time || '尚未完成'}
地點: ${race.location || 'N/A'}
是否PB: ${race.is_pb ? '是' : '否'}
總排名: ${race.overall_place || 'N/A'}
性別排名: ${race.gender_group_place || 'N/A'}
年齡組排名: ${race.age_group_place || 'N/A'}

個人PB記錄: ${pbSummary || '無記錄'}

賽前12週訓練摘要(最近50次):
${trainingSummary || '無訓練記錄'}

請提供:
1. 賽事表現分析(與PB比較、配速策略評估)
2. 訓練充分度評估(賽前準備是否充足)
3. 下次同距離賽事時間預測(基於訓練數據)
4. 具體改進建議(3-5項)` },
        ],
      });
      return { analysis: res.choices[0]?.message?.content ?? '分析失敗，請稍後再試。' };
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
  running: runningRouter,
});

export type AppRouter = typeof appRouter;

