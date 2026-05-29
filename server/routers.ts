import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import {
  mealLogs, foodItems, workoutSessions, workoutSets, exercises,
  bodyMetrics, heartRateRecords, sleepRecords, progressPhotos, aiInsights
} from "../drizzle/schema";
import { eq, and, desc, gte, lte, like, or } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { readSheetData, writeRowToSheet, ensureSheetHeaders } from "./sheetsService";

// ─── Nutrition Router ─────────────────────────────────────────────────────────
const nutritionRouter = router({
  // Search food database
  searchFoods: protectedProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(foodItems)
        .where(or(like(foodItems.name, `%${input.query}%`), like(foodItems.nameZh, `%${input.query}%`)))
        .limit(20);
    }),

  // Get meal logs for a date
  getMealLogs: protectedProcedure
    .input(z.object({ date: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(mealLogs)
        .where(and(eq(mealLogs.userId, ctx.user.id), eq(mealLogs.date, input.date)))
        .orderBy(mealLogs.createdAt);
    }),

  // Get meal logs for date range
  getMealLogsRange: protectedProcedure
    .input(z.object({ startDate: z.string(), endDate: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(mealLogs)
        .where(and(
          eq(mealLogs.userId, ctx.user.id),
          gte(mealLogs.date, input.startDate),
          lte(mealLogs.date, input.endDate)
        ))
        .orderBy(desc(mealLogs.date));
    }),

  // Add meal log
  addMealLog: protectedProcedure
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
      await db.insert(mealLogs).values({ ...input, userId: ctx.user.id });
      return { success: true };
    }),

  // Update meal log
  updateMealLog: protectedProcedure
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
      await db.update(mealLogs).set(data).where(and(eq(mealLogs.id, id), eq(mealLogs.userId, ctx.user.id)));
      return { success: true };
    }),

  // Delete meal log
  deleteMealLog: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(mealLogs).where(and(eq(mealLogs.id, input.id), eq(mealLogs.userId, ctx.user.id)));
      return { success: true };
    }),

  // AI food photo analysis
  analyzeFoodPhoto: protectedProcedure
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
  uploadFoodPhoto: protectedProcedure
    .input(z.object({ base64: z.string(), mimeType: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.base64, "base64");
      const key = `food-photos/${ctx.user.id}/${nanoid()}.jpg`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      return { url, key };
    }),
});

// ─── Workout Router ───────────────────────────────────────────────────────────
const workoutRouter = router({
  // Get all exercises (built-in + user's custom)
  getExercises: protectedProcedure
    .input(z.object({ muscleGroup: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [
        or(eq(exercises.isCustom, false), eq(exercises.userId, ctx.user.id))
      ];
      if (input?.muscleGroup) {
        conditions.push(eq(exercises.muscleGroup, input.muscleGroup));
      }
      return db.select().from(exercises).where(and(...conditions)).orderBy(exercises.name);
    }),

  // Add custom exercise
  addExercise: protectedProcedure
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
      await db.insert(exercises).values({ ...input, isCustom: true, userId: ctx.user.id });
      return { success: true };
    }),

  // Get workout sessions
  getSessions: protectedProcedure
    .input(z.object({ startDate: z.string().optional(), endDate: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [eq(workoutSessions.userId, ctx.user.id)];
      if (input?.startDate) conditions.push(gte(workoutSessions.date, input.startDate));
      if (input?.endDate) conditions.push(lte(workoutSessions.date, input.endDate));
      return db.select().from(workoutSessions).where(and(...conditions)).orderBy(desc(workoutSessions.date));
    }),

  // Get session with sets
  getSessionWithSets: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return null;
      const sessions = await db.select().from(workoutSessions)
        .where(and(eq(workoutSessions.id, input.sessionId), eq(workoutSessions.userId, ctx.user.id)))
        .limit(1);
      if (!sessions[0]) return null;
      const sets = await db.select().from(workoutSets)
        .where(eq(workoutSets.sessionId, input.sessionId))
        .orderBy(workoutSets.exerciseName, workoutSets.setNumber);
      return { session: sessions[0], sets };
    }),

  // Create workout session
  createSession: protectedProcedure
    .input(z.object({
      date: z.string(),
      name: z.string().optional(),
      duration: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const result = await db.insert(workoutSessions).values({ ...input, userId: ctx.user.id });
      return { success: true, id: Number((result as any).insertId) };
    }),

  // Update session
  updateSession: protectedProcedure
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
      await db.update(workoutSessions).set(data).where(and(eq(workoutSessions.id, id), eq(workoutSessions.userId, ctx.user.id)));
      return { success: true };
    }),

  // Delete session
  deleteSession: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(workoutSets).where(eq(workoutSets.sessionId, input.id));
      await db.delete(workoutSessions).where(and(eq(workoutSessions.id, input.id), eq(workoutSessions.userId, ctx.user.id)));
      return { success: true };
    }),

  // Add workout set
  addSet: protectedProcedure
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
  updateSet: protectedProcedure
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
  deleteSet: protectedProcedure
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
  getAll: protectedProcedure
    .input(z.object({ limit: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(bodyMetrics)
        .where(eq(bodyMetrics.userId, ctx.user.id))
        .orderBy(desc(bodyMetrics.date))
        .limit(input?.limit || 100);
    }),

  add: protectedProcedure
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
      await db.insert(bodyMetrics).values({ ...input, userId: ctx.user.id });
      return { success: true };
    }),

  update: protectedProcedure
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
      await db.update(bodyMetrics).set(data).where(and(eq(bodyMetrics.id, id), eq(bodyMetrics.userId, ctx.user.id)));
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(bodyMetrics).where(and(eq(bodyMetrics.id, input.id), eq(bodyMetrics.userId, ctx.user.id)));
      return { success: true };
    }),

  // Bulk import from Google Sheets
  bulkImport: protectedProcedure
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
        await db.insert(bodyMetrics).values({ ...row, userId: ctx.user.id, source: "sheets" })
          .onDuplicateKeyUpdate({ set: { ...row, source: "sheets" } }).catch(() => {});
      }
      return { success: true, count: input.length };
    }),
});

// ─── Heart Rate Router ────────────────────────────────────────────────────────
const heartRateRouter = router({
  getAll: protectedProcedure
    .input(z.object({ limit: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(heartRateRecords)
        .where(eq(heartRateRecords.userId, ctx.user.id))
        .orderBy(desc(heartRateRecords.date))
        .limit(input?.limit || 200);
    }),

  add: protectedProcedure
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
      await db.insert(heartRateRecords).values({ ...input, userId: ctx.user.id });
      return { success: true };
    }),

  update: protectedProcedure
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
      await db.update(heartRateRecords).set(data).where(and(eq(heartRateRecords.id, id), eq(heartRateRecords.userId, ctx.user.id)));
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(heartRateRecords).where(and(eq(heartRateRecords.id, input.id), eq(heartRateRecords.userId, ctx.user.id)));
      return { success: true };
    }),

  bulkImport: protectedProcedure
    .input(z.array(z.object({
      date: z.string(),
      restingHr: z.number().optional(),
      highHr: z.number().optional(),
    })))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      for (const row of input) {
        await db.insert(heartRateRecords).values({ ...row, userId: ctx.user.id, source: "sheets" }).catch(() => {});
      }
      return { success: true, count: input.length };
    }),
});

// ─── Sleep Router ─────────────────────────────────────────────────────────────
const sleepRouter = router({
  getAll: protectedProcedure
    .input(z.object({ limit: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(sleepRecords)
        .where(eq(sleepRecords.userId, ctx.user.id))
        .orderBy(desc(sleepRecords.date))
        .limit(input?.limit || 200);
    }),

  add: protectedProcedure
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
      await db.insert(sleepRecords).values({ ...input, userId: ctx.user.id });
      return { success: true };
    }),

  update: protectedProcedure
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
      const { id, ...data } = input;
      await db.update(sleepRecords).set(data).where(and(eq(sleepRecords.id, id), eq(sleepRecords.userId, ctx.user.id)));
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(sleepRecords).where(and(eq(sleepRecords.id, input.id), eq(sleepRecords.userId, ctx.user.id)));
      return { success: true };
    }),

  bulkImport: protectedProcedure
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
        await db.insert(sleepRecords).values({ ...row, userId: ctx.user.id, source: "sheets" }).catch(() => {});
      }
      return { success: true, count: input.length };
    }),
});

// ─── Progress Photos Router ───────────────────────────────────────────────────
const photosRouter = router({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(progressPhotos)
      .where(eq(progressPhotos.userId, ctx.user.id))
      .orderBy(desc(progressPhotos.date));
  }),

  upload: protectedProcedure
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
      const key = `progress-photos/${ctx.user.id}/${nanoid()}.jpg`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.insert(progressPhotos).values({
        userId: ctx.user.id,
        date: input.date,
        photoUrl: url,
        photoKey: key,
        angle: input.angle || "front",
        weight: input.weight,
        notes: input.notes,
      });
      return { success: true, url };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(progressPhotos).where(and(eq(progressPhotos.id, input.id), eq(progressPhotos.userId, ctx.user.id)));
      return { success: true };
    }),
});

// ─── AI Insights Router ───────────────────────────────────────────────────────
const insightsRouter = router({
  getLatest: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;
    const results = await db.select().from(aiInsights)
      .where(eq(aiInsights.userId, ctx.user.id))
      .orderBy(desc(aiInsights.createdAt))
      .limit(4);
    return results;
  }),

  generate: protectedProcedure
    .input(z.object({ type: z.enum(["nutrition", "workout", "recovery", "overall"]).optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Gather recent data
      const today = new Date();
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const weekAgoStr = weekAgo.toISOString().split("T")[0];
      const todayStr = today.toISOString().split("T")[0];

      const [meals, sessions, body, sleep, hr] = await Promise.all([
        db.select().from(mealLogs).where(and(eq(mealLogs.userId, ctx.user.id), gte(mealLogs.date, weekAgoStr))).limit(50),
        db.select().from(workoutSessions).where(and(eq(workoutSessions.userId, ctx.user.id), gte(workoutSessions.date, weekAgoStr))),
        db.select().from(bodyMetrics).where(eq(bodyMetrics.userId, ctx.user.id)).orderBy(desc(bodyMetrics.date)).limit(5),
        db.select().from(sleepRecords).where(and(eq(sleepRecords.userId, ctx.user.id), gte(sleepRecords.date, weekAgoStr))),
        db.select().from(heartRateRecords).where(and(eq(heartRateRecords.userId, ctx.user.id), gte(heartRateRecords.date, weekAgoStr))),
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
        userId: ctx.user.id,
        weekStart,
        content,
        type: input.type || "overall",
      });

      return { content, weekStart };
    }),
});

// ─── Dashboard Router ─────────────────────────────────────────────────────────
const dashboardRouter = router({
  getSummary: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;

    const today = new Date().toISOString().split("T")[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const [todayMeals, recentSessions, latestBody, latestSleep, latestHr, weekMeals] = await Promise.all([
      db.select().from(mealLogs).where(and(eq(mealLogs.userId, ctx.user.id), eq(mealLogs.date, today))),
      db.select().from(workoutSessions).where(and(eq(workoutSessions.userId, ctx.user.id), gte(workoutSessions.date, weekAgo))).orderBy(desc(workoutSessions.date)).limit(7),
      db.select().from(bodyMetrics).where(eq(bodyMetrics.userId, ctx.user.id)).orderBy(desc(bodyMetrics.date)).limit(2),
      db.select().from(sleepRecords).where(eq(sleepRecords.userId, ctx.user.id)).orderBy(desc(sleepRecords.date)).limit(1),
      db.select().from(heartRateRecords).where(eq(heartRateRecords.userId, ctx.user.id)).orderBy(desc(heartRateRecords.date)).limit(1),
      db.select().from(mealLogs).where(and(eq(mealLogs.userId, ctx.user.id), gte(mealLogs.date, weekAgo))),
    ]);

    const todayCalories = todayMeals.reduce((s, m) => s + m.calories, 0);
    const todayProtein = todayMeals.reduce((s, m) => s + m.protein, 0);
    const todayCarbs = todayMeals.reduce((s, m) => s + m.carbs, 0);
    const todayFat = todayMeals.reduce((s, m) => s + m.fat, 0);

    // Calculate workout streak
    let streak = 0;
    const sessionDates = new Set(recentSessions.map(s => s.date));
    for (let i = 0; i < 7; i++) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
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

// ─── Google Sheets Sync Router ────────────────────────────────────────────────
const sheetsRouter = router({
  // Pull data FROM Google Sheets → local DB
  pullFromSheets: protectedProcedure
    .input(z.object({ type: z.enum(["body", "sleep", "heartrate"]) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const rows = await readSheetData(input.type);
      let count = 0;

      if (input.type === "body") {
        for (const row of rows) {
          const dateVal = String(row.date ?? "");
          if (!dateVal) continue;
          await db.insert(bodyMetrics).values({
            userId: ctx.user.id,
            date: dateVal,
            weight: row.weight !== undefined ? Number(row.weight) : undefined,
            bmi: row.bmi !== undefined ? Number(row.bmi) : undefined,
            bodyFatPct: row.bodyFatPct !== undefined ? Number(row.bodyFatPct) : undefined,
            fatMass: row.fatMass !== undefined ? Number(row.fatMass) : undefined,
            muscleMass: row.muscleMass !== undefined ? Number(row.muscleMass) : undefined,
            bmr: row.bmr !== undefined ? Number(row.bmr) : undefined,
            visceralFat: row.visceralFat !== undefined ? Number(row.visceralFat) : undefined,
            source: "sheets",
          }).catch(() => {});
          count++;
        }
      } else if (input.type === "sleep") {
        for (const row of rows) {
          const dateVal = String(row.date ?? "");
          if (!dateVal) continue;
          const qualityVal = String(row.quality ?? "") as "Poor" | "Fair" | "Good" | "Excellent" | undefined;
          await db.insert(sleepRecords).values({
            userId: ctx.user.id,
            date: dateVal,
            score: row.score !== undefined ? Number(row.score) : undefined,
            restingHr: row.restingHr !== undefined ? Number(row.restingHr) : undefined,
            bodyBattery: row.bodyBattery !== undefined ? Number(row.bodyBattery) : undefined,
            pulseOx: row.pulseOx !== undefined ? Number(row.pulseOx) : undefined,
            respiration: row.respiration !== undefined ? Number(row.respiration) : undefined,
            quality: ["Poor","Fair","Good","Excellent"].includes(qualityVal ?? "") ? qualityVal : undefined,
            source: "sheets",
          }).catch(() => {});
          count++;
        }
      } else if (input.type === "heartrate") {
        for (const row of rows) {
          const dateVal = String(row.date ?? "");
          if (!dateVal) continue;
          await db.insert(heartRateRecords).values({
            userId: ctx.user.id,
            date: dateVal,
            restingHr: row.restingHr !== undefined ? Number(row.restingHr) : undefined,
            highHr: row.highHr !== undefined ? Number(row.highHr) : undefined,
            hrv: row.hrv !== undefined ? Number(row.hrv) : undefined,
            source: "sheets",
          }).catch(() => {});
          count++;
        }
      }

      return { success: true, count, rows: rows.length };
    }),

  // Push data FROM local DB → Google Sheets (write-back)
  pushToSheets: protectedProcedure
    .input(z.object({
      type: z.enum(["body", "sleep", "heartrate"]),
      data: z.record(z.string(), z.unknown())
    }))
    .mutation(async ({ input }) => {
      await ensureSheetHeaders(input.type);
      await writeRowToSheet(input.type, input.data);
      return { success: true };
    }),

  // Legacy: accept manually pasted data array (for users without API access)
  syncFromSheets: protectedProcedure
    .input(z.object({
      type: z.enum(["body", "sleep", "heartrate"]),
      data: z.array(z.record(z.string(), z.unknown()))
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      let count = 0;
      for (const row of input.data) {
        const dateVal = String(row.date ?? "");
        if (!dateVal) continue;
        if (input.type === "body") {
          await db.insert(bodyMetrics).values({ userId: ctx.user.id, date: dateVal,
            weight: row.weight !== undefined ? Number(row.weight) : undefined,
            bmi: row.bmi !== undefined ? Number(row.bmi) : undefined,
            bodyFatPct: row.bodyFatPct !== undefined ? Number(row.bodyFatPct) : undefined,
            fatMass: row.fatMass !== undefined ? Number(row.fatMass) : undefined,
            muscleMass: row.muscleMass !== undefined ? Number(row.muscleMass) : undefined,
            bmr: row.bmr !== undefined ? Number(row.bmr) : undefined,
            visceralFat: row.visceralFat !== undefined ? Number(row.visceralFat) : undefined,
            source: "sheets",
          }).catch(() => {});
        } else if (input.type === "sleep") {
          const qualityVal = String(row.quality ?? "") as "Poor" | "Fair" | "Good" | "Excellent" | undefined;
          await db.insert(sleepRecords).values({ userId: ctx.user.id, date: dateVal,
            score: row.score !== undefined ? Number(row.score) : undefined,
            restingHr: row.restingHr !== undefined ? Number(row.restingHr) : undefined,
            bodyBattery: row.bodyBattery !== undefined ? Number(row.bodyBattery) : undefined,
            pulseOx: row.pulseOx !== undefined ? Number(row.pulseOx) : undefined,
            respiration: row.respiration !== undefined ? Number(row.respiration) : undefined,
            quality: ["Poor","Fair","Good","Excellent"].includes(qualityVal ?? "") ? qualityVal : undefined,
            source: "sheets",
          }).catch(() => {});
        } else if (input.type === "heartrate") {
          await db.insert(heartRateRecords).values({ userId: ctx.user.id, date: dateVal,
            restingHr: row.restingHr !== undefined ? Number(row.restingHr) : undefined,
            highHr: row.highHr !== undefined ? Number(row.highHr) : undefined,
            source: "sheets",
          }).catch(() => {});
        }
        count++;
      }
      return { success: true, count };
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
  sheets: sheetsRouter,
});

export type AppRouter = typeof appRouter;
