import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, ownerProcedure } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import {
  mealLogs, foodItems, workoutSessions, workoutSets, exercises,
  bodyComposition, heartRateLogs, sleepLogs, progressPhotos, aiInsights,
  healthGoals, runningLogs, runningShoes, races, favouriteExercises,
  dailySteps, medicalConditions, medicalVisits, medicalAttachments,
  supplements, supplementLogs, supplementPurchases, supplementStockAdjustments,
  runningLogPhotos, stepLogPhotos, customExercises
} from "../drizzle/schema";
import { eq, and, desc, gte, lte, like, or, sql } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { storagePut, storageGetSignedUrl } from "./storage";
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
      // HK midnight = UTC midnight - 8h
      const hkMidnight = (dateStr: string, endOfDay = false) => {
        const [y, m, d] = dateStr.split('-').map(Number);
        const utcMs = Date.UTC(y, m - 1, d) - 8 * 3600 * 1000;
        return new Date(endOfDay ? utcMs + 86400000 - 1 : utcMs);
      };
      return db.select().from(mealLogs)
        .where(and(eq(mealLogs.userId, OWNER_USER_ID), sql`${mealLogs.loggedAt} >= ${hkMidnight(input.date)}`, sql`${mealLogs.loggedAt} < ${hkMidnight(input.date, true)}`))       
        .orderBy(mealLogs.createdAt);
    }),

  // Get meal logs for date range
  getMealLogsRange: publicProcedure
    .input(z.object({ startDate: z.string(), endDate: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const hkMidnight = (dateStr: string, endOfDay = false) => {
        const [y, m, d] = dateStr.split('-').map(Number);
        const utcMs = Date.UTC(y, m - 1, d) - 8 * 3600 * 1000;
        return new Date(endOfDay ? utcMs + 86400000 - 1 : utcMs);
      };
      return db.select().from(mealLogs)
        .where(and(
          eq(mealLogs.userId, OWNER_USER_ID),
          sql`${mealLogs.loggedAt} >= ${hkMidnight(input.startDate)}`,
          sql`${mealLogs.loggedAt} < ${hkMidnight(input.endDate, true)}`
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
  updateMealLog: ownerProcedure
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
  deleteMealLog: ownerProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(mealLogs).where(and(eq(mealLogs.id, input.id), eq(mealLogs.userId, OWNER_USER_ID)));
      return { success: true };
    }),

  // AI food photo analysis
  analyzeFoodPhoto: ownerProcedure
    .input(z.object({ imageUrl: z.string(), imageBase64: z.string().optional() }))
    .mutation(async ({ input }) => {
      // If imageUrl is a relative /manus-storage/ path, resolve to a real signed S3 URL
      // so the LLM can actually fetch the image
      let resolvedImageUrl = input.imageUrl;
      if (input.imageUrl.startsWith('/manus-storage/')) {
        const key = input.imageUrl.replace('/manus-storage/', '');
        try {
          resolvedImageUrl = await storageGetSignedUrl(key);
        } catch (e) {
          console.error('[analyzeFoodPhoto] Failed to get signed URL:', e);
          // Fall back to original URL
          resolvedImageUrl = input.imageUrl;
        }
      }
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
                image_url: { url: resolvedImageUrl, detail: "high" as const }
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
  uploadFoodPhoto: ownerProcedure
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
  addExercise: ownerProcedure
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

  // Get calories burned for a specific date (for daily net calorie calculation)
  getDailyCaloriesBurned: publicProcedure
    .input(z.object({ date: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { caloriesBurned: 0, sessions: [], runningBurned: 0, stepsBurned: 0, totalBurned: 0 };
      const dayStart = new Date(input.date + 'T00:00:00+08:00');
      const dayEnd = new Date(input.date + 'T23:59:59+08:00');
      const sessions = await db.select({
        id: workoutSessions.id,
        name: workoutSessions.name,
        duration: workoutSessions.duration,
        caloriesBurned: workoutSessions.caloriesBurned,
        totalVolume: workoutSessions.totalVolume,
        startTime: workoutSessions.startTime,
      }).from(workoutSessions)
        .where(and(
          eq(workoutSessions.userId, OWNER_USER_ID),
          sql`${workoutSessions.startTime} >= ${dayStart}`,
          sql`${workoutSessions.startTime} <= ${dayEnd}`,
        ))
        .orderBy(desc(workoutSessions.startTime));
      const caloriesBurned = sessions.reduce((sum, s) => sum + (s.caloriesBurned ?? 0), 0);
      // Running calories for the day
      const runningRows = await db.select({ calories: runningLogs.calories })
        .from(runningLogs)
        .where(sql`${runningLogs.date} = ${input.date}`);
      const runningBurned = runningRows.reduce((s, r) => s + (r.calories ?? 0), 0);
      // Steps calories for the day
      const stepsRows = await db.select({ calories: dailySteps.calories })
        .from(dailySteps)
        .where(and(
          eq(dailySteps.userId, OWNER_USER_ID),
          sql`${dailySteps.date} = ${input.date}`,
        ));
      const stepsBurned = stepsRows.reduce((s, r) => s + (r.calories ?? 0), 0);
      const totalBurned = caloriesBurned + runningBurned + stepsBurned;
      return { caloriesBurned, sessions, runningBurned, stepsBurned, totalBurned };
    }),

  // Create workout session
  createSession: ownerProcedure
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
  updateSession: ownerProcedure
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
  deleteSession: ownerProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(workoutSets).where(eq(workoutSets.sessionId, input.id));
      await db.delete(workoutSessions).where(and(eq(workoutSessions.id, input.id), eq(workoutSessions.userId, OWNER_USER_ID)));
      return { success: true };
    }),

  // Add workout set
  addSet: ownerProcedure
    .input(z.object({
      sessionId: z.number(),
      exerciseId: z.number().optional().nullable(),
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
      const { exerciseId, ...rest } = input;
      // Always use raw SQL to avoid Drizzle type issues with nullable exerciseId
      await db.execute(sql`
        INSERT INTO workout_sets ("sessionId", "exerciseId", "exerciseName", "setNumber", reps, weight, duration, distance, notes)
        VALUES (${rest.sessionId}, ${exerciseId ?? null}, ${rest.exerciseName}, ${rest.setNumber}, ${rest.reps ?? null}, ${rest.weight ?? null}, ${rest.duration ?? null}, ${rest.distance ?? null}, ${rest.notes ?? null})
      `);
      // Recalculate and update totalVolume on the session
      const volumeResult = await db.execute(sql`
        SELECT COALESCE(SUM(reps * weight), 0) as total
        FROM workout_sets
        WHERE "sessionId" = ${rest.sessionId} AND reps IS NOT NULL AND weight IS NOT NULL
      `);
      const newVolume = Number(((volumeResult as any).rows?.[0] ?? (volumeResult as any)[0])?.total ?? 0);
      await db.update(workoutSessions)
        .set({ totalVolume: newVolume, updatedAt: new Date() })
        .where(eq(workoutSessions.id, rest.sessionId));
      return { success: true, totalVolume: newVolume };
    }),

  // Update set
  updateSet: ownerProcedure
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
  deleteSet: ownerProcedure
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

  toggleFavourite: ownerProcedure
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

  // ── Custom Exercises ──────────────────────────────────────────────────────
  getCustomExercises: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(customExercises)
        .where(eq(customExercises.userId, OWNER_USER_ID))
        .orderBy(desc(customExercises.createdAt));
    }),

  createCustomExercise: ownerProcedure
    .input(z.object({
      name: z.string().min(1).max(200),
      nameZh: z.string().max(200).optional(),
      muscleGroup: z.string().min(1),
      equipment: z.string().min(1),
      instructions: z.string().optional(),
      photoBase64: z.string().optional(),
      photoMimeType: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      let photoUrl: string | undefined;
      let fileKey: string | undefined;
      if (input.photoBase64 && input.photoMimeType) {
        const buf = Buffer.from(input.photoBase64, 'base64');
        const ext = input.photoMimeType.split('/')[1] ?? 'jpg';
        fileKey = `custom-exercises/${OWNER_USER_ID}-${nanoid(8)}.${ext}`;
        const stored = await storagePut(fileKey, buf, input.photoMimeType);
        photoUrl = stored.url;
      }
      const [row] = await db.insert(customExercises).values({
        userId: OWNER_USER_ID,
        name: input.name,
        nameZh: input.nameZh ?? '',
        muscleGroup: input.muscleGroup,
        equipment: input.equipment,
        instructions: input.instructions ?? '',
        photoUrl,
        fileKey,
      }).returning();
      return row;
    }),

  deleteCustomExercise: ownerProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      await db.delete(customExercises)
        .where(and(eq(customExercises.id, input.id), eq(customExercises.userId, OWNER_USER_ID)));
      return { success: true };
    }),

  // Finish session: set endTime and auto-calculate duration in minutes
  finishSession: ownerProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      const rows = await db.select().from(workoutSessions)
        .where(and(eq(workoutSessions.id, input.id), eq(workoutSessions.userId, OWNER_USER_ID))).limit(1);
      if (!rows.length) throw new Error('Session not found');
      const session = rows[0];
      const endTime = new Date();
      const startTime = session.startTime ? new Date(session.startTime) : endTime;
      const durationMin = Math.max(1, Math.round((endTime.getTime() - startTime.getTime()) / 60000));
      // Estimate calories burned: MET ~5 for moderate weight training, 70kg avg body weight
      // Calories = MET × weight_kg × duration_hours
      // We use volume-adjusted formula: base 5 MET + bonus for high volume
      const volumeResult = await db.execute(sql`
        SELECT COALESCE(SUM(reps * weight), 0) as total
        FROM workout_sets WHERE "sessionId" = ${input.id}
        AND reps IS NOT NULL AND weight IS NOT NULL
      `);
      const totalVolume = Number(((volumeResult as any).rows?.[0] ?? (volumeResult as any)[0])?.total ?? 0);
      // MET 5 = moderate resistance training; scale up slightly for high volume
      const met = totalVolume > 5000 ? 6 : totalVolume > 2000 ? 5.5 : 5;
      const caloriesBurned = Math.round(met * 70 * (durationMin / 60));
      await db.update(workoutSessions).set({ endTime, duration: durationMin, caloriesBurned, totalVolume })
        .where(eq(workoutSessions.id, input.id));
      // Count distinct exercises in this session
      const exerciseCountResult = await db.execute(sql`
        SELECT COUNT(DISTINCT "exerciseId") as cnt
        FROM workout_sets WHERE "sessionId" = ${input.id}
      `);
      const exerciseCount = Number(((exerciseCountResult as any).rows?.[0] ?? (exerciseCountResult as any)[0])?.cnt ?? 0);
      return { success: true, duration: durationMin, caloriesBurned, totalVolume, exerciseCount };
    }),

  // AI exercise analysis: analyze user's past sets and return personalized recommendations
  analyzeExercise: ownerProcedure
    .input(z.object({ exerciseName: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      // Filter via session join since workoutSets has no userId column
      const sets = await db.select({
        reps: workoutSets.reps,
        weight: workoutSets.weight,
        notes: workoutSets.notes,
        createdAt: workoutSets.createdAt,
      }).from(workoutSets)
        .innerJoin(workoutSessions, eq(workoutSets.sessionId, workoutSessions.id))
        .where(and(
          eq(workoutSessions.userId, OWNER_USER_ID),
          eq(workoutSets.exerciseName, input.exerciseName),
        ))
        .orderBy(desc(workoutSets.createdAt))
        .limit(30);
      if (sets.length === 0) {
        return {
          analysis: `尚未找到「${input.exerciseName}」的訓練記錄。開始記錄組數後即可獲得個人化建議！`,
          recommendations: [],
        };
      }
      const setsSummary = sets.map(s => `Reps: ${s.reps ?? '-'}, Weight: ${s.weight ?? 0}kg${s.notes ? ', Notes: ' + s.notes : ''}`).join('\n');
      const aiResponse = await invokeLLM({
        messages: [
          { role: 'system', content: 'You are an expert personal trainer and strength coach. Analyze training data and provide concise, actionable recommendations in Traditional Chinese (繁體中文). Be specific with numbers and percentages.' },
          { role: 'user', content: `Exercise: ${input.exerciseName}\n\nRecent training sets (newest first, max 30):\n${setsSummary}\n\nProvide a brief trend analysis and exactly 3 specific recommendations covering: (1) progressive overload suggestion, (2) optimal rep/set scheme, (3) recovery or form tip. Return JSON only.` },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'exercise_analysis',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                analysis: { type: 'string' },
                recommendations: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string' },
                      detail: { type: 'string' },
                      type: { type: 'string' },
                    },
                    required: ['title', 'detail', 'type'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['analysis', 'recommendations'],
              additionalProperties: false,
            },
          },
        },
      });
      const rawMsg = aiResponse.choices[0]?.message?.content;
      const contentStr = typeof rawMsg === 'string' ? rawMsg : '{"analysis":"","recommendations":[]}';
      return JSON.parse(contentStr) as { analysis: string; recommendations: Array<{ title: string; detail: string; type: string }> };
    }),

  identifyExerciseFromPhoto: ownerProcedure
    .input(z.object({ base64: z.string(), mimeType: z.string() }))
    .mutation(async ({ input }) => {
      const imageUrl = `data:${input.mimeType};base64,${input.base64}`;
      const response = await invokeLLM({
        messages: [
          {
            role: 'system',
            content: 'You are a fitness expert. Analyze the image and identify the exercise being performed or the gym equipment shown. Return structured JSON only.',
          },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
              { type: 'text', text: 'Identify the exercise or equipment in this image. Return JSON with: name (English), nameZh (Chinese), muscleGroup (one of: chest, back, lats, shoulders, biceps, triceps, quads, hamstrings, glutes, calves, core, cardio, other), equipment (one of: Barbell, Dumbbell, Cable, Machine, Smith Machine, Kettlebell, Resistance Band, Bodyweight, TRX / Suspension, Pull-up Bar, Dip Bar, EZ Bar, Trap Bar, Plate, Foam Roller, Medicine Ball, Battle Rope, Cardio Machine, Other), instructions (brief 1-2 sentence description), confidence (high/medium/low).' },
            ],
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'exercise_identification',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                nameZh: { type: 'string' },
                muscleGroup: { type: 'string' },
                equipment: { type: 'string' },
                instructions: { type: 'string' },
                confidence: { type: 'string' },
              },
              required: ['name', 'nameZh', 'muscleGroup', 'equipment', 'instructions', 'confidence'],
              additionalProperties: false,
            },
          },
        },
      });
      const rawMsg = response.choices[0]?.message?.content;
      const contentStr = typeof rawMsg === 'string' ? rawMsg : '{}';
      return JSON.parse(contentStr) as {
        name: string; nameZh: string; muscleGroup: string;
        equipment: string; instructions: string; confidence: string;
      };
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

  add: ownerProcedure
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

  update: ownerProcedure
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

  delete: ownerProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(bodyComposition).where(and(eq(bodyComposition.id, input.id), eq(bodyComposition.userId, OWNER_USER_ID)));
      return { success: true };
    }),

  // Get the most recent weight record on or before a given date
  getWeightOnOrBefore: publicProcedure
    .input(z.object({ date: z.string() })) // date: 'YYYY-MM-DD'
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db.select({
        date: bodyComposition.date,
        weight: bodyComposition.weight,
      }).from(bodyComposition)
        .where(and(
          eq(bodyComposition.userId, OWNER_USER_ID),
          sql`${bodyComposition.date} <= ${input.date}`,
          sql`${bodyComposition.weight} IS NOT NULL`,
        ))
        .orderBy(desc(bodyComposition.date))
        .limit(1);
      return rows[0] ?? null;
    }),

  // Bulk import from Google Sheets
  bulkImport: ownerProcedure
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

  add: ownerProcedure
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

  update: ownerProcedure
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

  delete: ownerProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(heartRateLogs).where(and(eq(heartRateLogs.id, input.id), eq(heartRateLogs.userId, OWNER_USER_ID)));
      return { success: true };
    }),

  bulkImport: ownerProcedure
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
  getMaxHr: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return { maxHr: null };
      const result = await db
        .select({ maxHr: sql<number>`MAX(${heartRateLogs.highHr})` })
        .from(heartRateLogs)
        .where(eq(heartRateLogs.userId, OWNER_USER_ID));
      return { maxHr: result[0]?.maxHr ?? null };
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
      bedtime: z.string().optional(),
      waketime: z.string().optional(),
      notes: z.string().optional(),
      source: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { score, quality, duration, restingHr, ...rest } = input;
      await db.insert(sleepLogs).values({
        ...rest,
        userId: OWNER_USER_ID,
        sleepScore: score,
        sleepQuality: quality,
        sleepDuration: duration,
        restingHr,
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
      bedtime: z.string().optional(),
      waketime: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { id, score, quality, duration, restingHr, ...rest } = input;
      const data = { ...rest, sleepScore: score, sleepQuality: quality, sleepDuration: duration, restingHr };
      await db.update(sleepLogs).set(data).where(and(eq(sleepLogs.id, id), eq(sleepLogs.userId, OWNER_USER_ID)));
      return { success: true };
    }),

  delete: ownerProcedure
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
        const { score, quality, duration, restingHr, ...rest } = row;
        await db.insert(sleepLogs).values({
          ...rest,
          userId: OWNER_USER_ID,
          source: "sheets",
          sleepScore: score,
          sleepQuality: quality,
          sleepDuration: duration,
          restingHr,
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

  upload: ownerProcedure
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

  delete: ownerProcedure
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

  generate: ownerProcedure
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
    const [todayMeals, recentSessions, latestBody, latestSleep, latestHr, weekMeals, todayWorkouts, todayRunning, todayStepsRows] = await Promise.all([
      db.select().from(mealLogs).where(and(eq(mealLogs.userId, OWNER_USER_ID), sql`${mealLogs.loggedAt} >= ${todayStart}`, sql`${mealLogs.loggedAt} <= ${todayEnd}`)),
      db.select().from(workoutSessions).where(and(eq(workoutSessions.userId, OWNER_USER_ID), sql`${workoutSessions.startTime} >= ${weekAgoDate}`)).orderBy(desc(workoutSessions.startTime)).limit(7),
      db.select().from(bodyComposition).where(eq(bodyComposition.userId, OWNER_USER_ID)).orderBy(desc(bodyComposition.date)).limit(2),
      db.select().from(sleepLogs).where(eq(sleepLogs.userId, OWNER_USER_ID)).orderBy(desc(sleepLogs.date)).limit(1),
      db.select().from(heartRateLogs).where(eq(heartRateLogs.userId, OWNER_USER_ID)).orderBy(desc(heartRateLogs.date)).limit(1),
      db.select().from(mealLogs).where(and(eq(mealLogs.userId, OWNER_USER_ID), sql`${mealLogs.loggedAt} >= ${weekAgoDate}`)),
      // Today's workout sessions
      db.select({ id: workoutSessions.id, name: workoutSessions.name, duration: workoutSessions.duration, caloriesBurned: workoutSessions.caloriesBurned })
        .from(workoutSessions)
        .where(and(eq(workoutSessions.userId, OWNER_USER_ID), sql`${workoutSessions.startTime} >= ${todayStart}`, sql`${workoutSessions.startTime} <= ${todayEnd}`)),
      // Today's running logs
      db.select({ id: runningLogs.id, distanceKm: runningLogs.distanceKm, calories: runningLogs.calories })
        .from(runningLogs)
        .where(sql`${runningLogs.date} = ${todayStr}`),
      // Today's steps
      db.select({ id: dailySteps.id, steps: dailySteps.steps, floorsClimbed: dailySteps.floorsClimbed, calories: dailySteps.calories })
        .from(dailySteps)
        .where(and(eq(dailySteps.userId, OWNER_USER_ID), sql`${dailySteps.date} = ${todayStr}`)),
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

    // Calculate calories burned from all exercise sources
    const workoutCaloriesBurned = todayWorkouts.reduce((s, w) => s + (w.caloriesBurned ?? 0), 0);
    const runningCaloriesBurned = todayRunning.reduce((s, r) => s + (r.calories ?? 0), 0);
    const stepsCaloriesBurned = todayStepsRows.reduce((s, st) => s + (st.calories ?? 0), 0);
    const totalCaloriesBurned = workoutCaloriesBurned + runningCaloriesBurned + stepsCaloriesBurned;
    const netCalories = todayCalories - totalCaloriesBurned;

    // Calculate TDEE-based daily calorie target
    // Uses BMR from latest body composition + activity factor (estimated from recent workout frequency)
    // Activity factor: sedentary 1.2, light 1.375, moderate 1.55, active 1.725
    const bmr = latestBody[0]?.bmr ? Number(latestBody[0].bmr) : null;
    const recentWorkoutDays = sessionDates.size; // unique days with workouts in last 7 days
    const activityFactor = recentWorkoutDays >= 6 ? 1.725 : recentWorkoutDays >= 4 ? 1.55 : recentWorkoutDays >= 2 ? 1.375 : 1.2;
    // TDEE = BMR × activity factor (base maintenance), then add today's exercise on top
    // This gives a dynamic target that adjusts with today's actual exercise
    const baseTdee = bmr ? Math.round(bmr * activityFactor) : 2000;
    // Daily target = base TDEE (already includes typical activity) + extra exercise today beyond typical
    // Simpler approach: base TDEE + today's exercise burned (encourages eating back exercise calories)
    const dailyCalorieTarget = bmr ? Math.round(bmr * activityFactor) + totalCaloriesBurned : 2000 + totalCaloriesBurned;

    return {
      today: { calories: todayCalories, protein: todayProtein, carbs: todayCarbs, fat: todayFat, mealCount: todayMeals.length },
      exercise: {
        totalBurned: totalCaloriesBurned,
        workoutBurned: workoutCaloriesBurned,
        runningBurned: runningCaloriesBurned,
        stepsBurned: stepsCaloriesBurned,
        netCalories,
        todayWorkouts,
        todayRunning,
        todaySteps: todayStepsRows[0] || null,
      },
      tdee: {
        bmr: bmr ?? null,
        activityFactor,
        baseTdee,
        dailyCalorieTarget,
        hasBmr: !!bmr,
      },
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
  preview: ownerProcedure
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
  importData: ownerProcedure
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
              restingHr: r.restingHr,
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

  // Weekly exercise calories burned breakdown (workout + running + steps)
  weeklyExerciseCalories: publicProcedure
    .input(z.object({ weeks: z.number().int().min(1).max(26).default(8) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const sinceDate = new Date(Date.now() - input.weeks * 7 * 86400000);
      const sinceDateStr = sinceDate.toISOString().slice(0, 10);
      // Workout calories per day
      const workoutRows = await db.select({
        date: sql<string>`TO_CHAR(${workoutSessions.startTime} AT TIME ZONE 'Asia/Hong_Kong', 'YYYY-MM-DD')`.as('date'),
        calories: sql<number>`COALESCE(SUM(${workoutSessions.caloriesBurned}), 0)`.as('calories'),
      }).from(workoutSessions)
        .where(and(
          eq(workoutSessions.userId, OWNER_USER_ID),
          sql`${workoutSessions.startTime} >= ${sinceDate}`,
          sql`${workoutSessions.endTime} IS NOT NULL`,
        ))
        .groupBy(sql`TO_CHAR(${workoutSessions.startTime} AT TIME ZONE 'Asia/Hong_Kong', 'YYYY-MM-DD')`);
      // Running calories per day
      const runningRows = await db.select({
        date: runningLogs.date,
        calories: sql<number>`COALESCE(SUM(${runningLogs.calories}), 0)`.as('calories'),
      }).from(runningLogs)
        .where(sql`${runningLogs.date} >= ${sinceDateStr}`)
        .groupBy(runningLogs.date);
      // Steps calories per day
      const stepsRows = await db.select({
        date: dailySteps.date,
        calories: sql<number>`COALESCE(SUM(${dailySteps.calories}), 0)`.as('calories'),
      }).from(dailySteps)
        .where(and(
          eq(dailySteps.userId, OWNER_USER_ID),
          sql`${dailySteps.date} >= ${sinceDateStr}`,
        ))
        .groupBy(dailySteps.date);
      // Aggregate by ISO week (Monday-based)
      const weekMap: Record<string, { workout: number; running: number; steps: number }> = {};
      const getWeekLabel = (dateStr: string) => {
        const d = new Date(dateStr + 'T12:00:00+08:00');
        const day = d.getDay();
        const monday = new Date(d);
        monday.setDate(d.getDate() - ((day + 6) % 7));
        return monday.toISOString().slice(0, 10);
      };
      for (const r of workoutRows) {
        const w = getWeekLabel(r.date);
        if (!weekMap[w]) weekMap[w] = { workout: 0, running: 0, steps: 0 };
        weekMap[w].workout += Number(r.calories) || 0;
      }
      for (const r of runningRows) {
        const w = getWeekLabel(String(r.date));
        if (!weekMap[w]) weekMap[w] = { workout: 0, running: 0, steps: 0 };
        weekMap[w].running += Number(r.calories) || 0;
      }
      for (const r of stepsRows) {
        const w = getWeekLabel(String(r.date));
        if (!weekMap[w]) weekMap[w] = { workout: 0, running: 0, steps: 0 };
        weekMap[w].steps += Number(r.calories) || 0;
      }
      return Object.entries(weekMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([week, v]) => ({
          week,
          label: week.slice(5), // MM-DD
          workout: Math.round(v.workout),
          running: Math.round(v.running),
          steps: Math.round(v.steps),
          total: Math.round(v.workout + v.running + v.steps),
        }));
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

  setGoal: ownerProcedure
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

  deleteGoal: ownerProcedure
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
  extract: ownerProcedure
    .input(z.object({
      base64: z.string(),
      mimeType: z.string().default("image/jpeg"),
      dataType: z.enum(["body", "sleep", "heartrate", "nutrition", "running", "steps", "auto"]).default("auto"),
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

      const userPrompt = `Extract all health and fitness metrics from this image. The image may be a Garmin Connect screenshot, Apple Health screenshot, body scale display, sleep tracker, running activity summary, steps/activity app, or any health/fitness app. Return a JSON object with these fields:
{
  "detectedType": "body" | "sleep" | "heartrate" | "nutrition" | "running" | "steps" | "unknown",
  "date": "YYYY-MM-DD or null",
  "body": { "weight": number|null, "bmi": number|null, "bodyFatPct": number|null, "muscleMass": number|null, "visceralFat": number|null },
  "sleep": { "sleepScore": number|null, "sleepDuration": number|null, "deepSleep": number|null, "remSleep": number|null, "bodyBattery": number|null, "pulseOx": number|null, "hrv": number|null },
  "heartrate": { "restingHr": number|null, "highHr": number|null, "avgHr": number|null, "hrv": number|null },
  "nutrition": { "calories": number|null, "protein": number|null, "carbs": number|null, "fat": number|null, "fiber": number|null },
  "running": { "distanceKm": number|null, "durationHour": number|null, "durationMin": number|null, "durationSec": number|null, "avgPace": string|null, "bestPace": string|null, "avgHr": number|null, "maxHr": number|null, "avgCadence": number|null, "maxCadence": number|null, "calories": number|null, "avgStrideLengthM": number|null, "avgVerticalRatio": number|null, "verticalOscillationCm": number|null, "runningType": string|null },
  "steps": { "steps": number|null, "floorsClimbed": number|null, "distanceKm": number|null, "activeMinutes": number|null, "calories": number|null },
  "confidence": "high" | "medium" | "low",
  "notes": "brief description of what was detected"
}

For running data: avgPace and bestPace should be in MM:SS format (e.g. "6:30"). durationHour/durationMin/durationSec are separate integer fields. runningType can be Easy/Tempo/Long Run/Race/Trail/Interval/Recovery.
For steps data: extract daily step count, floors climbed, distance, active minutes, and calories burned.`;

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
                running: {
                  type: "object",
                  properties: {
                    distanceKm: { type: ["number", "null"] },
                    durationHour: { type: ["number", "null"] },
                    durationMin: { type: ["number", "null"] },
                    durationSec: { type: ["number", "null"] },
                    avgPace: { type: ["string", "null"] },
                    bestPace: { type: ["string", "null"] },
                    avgHr: { type: ["number", "null"] },
                    maxHr: { type: ["number", "null"] },
                    avgCadence: { type: ["number", "null"] },
                    maxCadence: { type: ["number", "null"] },
                    calories: { type: ["number", "null"] },
                    avgStrideLengthM: { type: ["number", "null"] },
                    avgVerticalRatio: { type: ["number", "null"] },
                    verticalOscillationCm: { type: ["number", "null"] },
                    runningType: { type: ["string", "null"] },
                  },
                  required: ["distanceKm", "durationHour", "durationMin", "durationSec", "avgPace", "bestPace", "avgHr", "maxHr", "avgCadence", "maxCadence", "calories", "avgStrideLengthM", "avgVerticalRatio", "verticalOscillationCm", "runningType"],
                  additionalProperties: false,
                },
                steps: {
                  type: "object",
                  properties: {
                    steps: { type: ["number", "null"] },
                    floorsClimbed: { type: ["number", "null"] },
                    distanceKm: { type: ["number", "null"] },
                    activeMinutes: { type: ["number", "null"] },
                    calories: { type: ["number", "null"] },
                  },
                  required: ["steps", "floorsClimbed", "distanceKm", "activeMinutes", "calories"],
                  additionalProperties: false,
                },
                confidence: { type: "string" },
                notes: { type: "string" },
              },
              required: ["detectedType", "date", "body", "sleep", "heartrate", "nutrition", "running", "steps", "confidence", "notes"],
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
        restingHr: z.number().nullable().optional(),
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
          restingHr: input.sleep.restingHr ?? undefined,
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
      // Auto-lookup shoes_id by name to keep FK in sync
      let shoesId: number | null = null;
      if (input.runningShoes) {
        const shoeRow = await db.execute(sql`SELECT id FROM running_shoes WHERE shoes_name = ${input.runningShoes} LIMIT 1`);
        const found = ((shoeRow as any).rows ?? shoeRow)[0];
        if (found) shoesId = Number(found.id);
      }
      const result = await db.execute(sql`
        INSERT INTO running_logs (
          date, running_type, running_shoes, shoes_id, distance_km, hour, minutes, second,
          average_pace, best_pace, average_heart_rate, maximum_heart_rate,
          average_cadence, max_cadence, avg_stride_length_m, avg_vertical_ratio,
          vertical_oscillation_cm, avg_ground_contact_time_ms,
          calories, temperature, humidity, notes
        ) VALUES (
          ${input.date},
          ${input.runningType ?? null},
          ${input.runningShoes ?? null},
          ${shoesId},
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
        ) RETURNING id
      `);
      const rows = (result as any).rows ?? result;
      const newId = rows[0]?.id ? Number(rows[0].id) : 0;
      return { success: true, id: newId };
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
      // Auto-lookup shoes_id if runningShoes changed
      if (fields.runningShoes !== undefined) {
        const shoeRow = await db.execute(sql`SELECT id FROM running_shoes WHERE shoes_name = ${fields.runningShoes} LIMIT 1`);
        const found = ((shoeRow as any).rows ?? shoeRow)[0];
        (fields as any).shoesId = found ? Number(found.id) : null;
      }
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

  deleteLog: ownerProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      await db.execute(sql`DELETE FROM running_logs WHERE id = ${input.id}`);
      return { success: true };
    }),

  getAIAnalysis: ownerProcedure
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

      // Fetch upcoming races for predictions
      const upcomingRaceRows = await db.execute(sql`
        SELECT race_name, date, distance_km, location
        FROM races
        WHERE date >= TO_CHAR(NOW(), 'YYYY-MM-DD')
        ORDER BY date ASC
        LIMIT 10
      `);
      const upcomingRaces = (upcomingRaceRows as any).rows ?? upcomingRaceRows;

      // Fetch past race results for context
      const pastRaceRows = await db.execute(sql`
        SELECT race_name, date, distance_km, finish_time, finish_hr, finish_min, finish_sec, is_pb, overall_place, gender_group_place, age_group_place, location, notes
        FROM races
        WHERE date < TO_CHAR(NOW(), 'YYYY-MM-DD')
          AND (finish_hr IS NOT NULL OR finish_min IS NOT NULL OR finish_time IS NOT NULL)
        ORDER BY date DESC
        LIMIT 20
      `);
      const pastRaces = (pastRaceRows as any).rows ?? pastRaceRows;

      // Fetch active shoes for recommendation
      const activeShoeRows = await db.execute(sql`
        SELECT s.shoes_name, s.brand, s.model,
          COALESCE(s.initial_km::numeric, 0) + COALESCE(SUM(r.distance_km::numeric), 0) AS total_km
        FROM running_shoes s
        LEFT JOIN running_logs r ON (r.shoes_id = s.id OR (r.shoes_id IS NULL AND r.running_shoes = s.shoes_name))
        WHERE s.status = 'Active'
        GROUP BY s.id, s.shoes_name, s.brand, s.model
        ORDER BY s.shoes_name ASC
      `);
      const activeShoes = (activeShoeRows as any).rows ?? activeShoeRows;

      const fmtFinishTime = (r: any) => {
        if (r.finish_hr != null || r.finish_min != null || r.finish_sec != null) {
          const h = r.finish_hr ?? 0; const m = r.finish_min ?? 0; const s = r.finish_sec ?? 0;
          return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
        }
        return r.finish_time || '未知';
      };
      const pastRaceSummary = pastRaces.map((r: any) =>
        `${r.date?.toString().slice(0,10)} ${r.race_name} ${parseFloat(r.distance_km||0).toFixed(1)}km 完成:${fmtFinishTime(r)}${r.is_pb?' (PB)':''}${r.overall_place?' 總排#'+r.overall_place:''}${r.location?' @'+r.location:''}`
      ).join('\n');

      const upcomingRaceSummary = upcomingRaces.map((r: any) =>
        `${r.date?.toString().slice(0,10)} ${r.race_name} ${parseFloat(r.distance_km||0).toFixed(1)}km${r.location?' @'+r.location:''}`
      ).join('\n');

      const activeShoeSummary = activeShoes.map((s: any) =>
        `${s.shoes_name}${s.brand?' ('+s.brand+')':''} 已跑${parseFloat(s.total_km||0).toFixed(0)}km`
      ).join(', ');

      const res = await invokeLLM({
        messages: [
          { role: 'system', content: '你是一位專業馬拉松教練和運動科學分析師。請用繁體中文回答，結構清晰，分段說明，使用 Markdown 格式。' },
          { role: 'user', content: `請全面分析我的跑步數據並提供詳細建議。

## 訓練數據摘要 (最近${input.weeks}週)
共${logs.length}次跑步，總距離:${parseFloat(stats?.total_distance||0).toFixed(1)}km
平均配速:${formatPace(parseFloat(stats?.avg_pace||0)*60)}，平均心率:${Math.round(stats?.avg_hr||0)}bpm
平均步頻:${Math.round(stats?.avg_cadence||0)}spm，平均步幅:${parseFloat(stats?.avg_stride||0).toFixed(2)}m
平均垂直比:${parseFloat(stats?.avg_vr||0).toFixed(1)}%，平均振幅:${parseFloat(stats?.avg_vo||0).toFixed(1)}cm

## 詳細訓練記錄(最近30次)
${summary}

## 過往賽事記錄
${pastRaceSummary || '暫無過往賽事記錄'}

## 即將到來的賽事
${upcomingRaceSummary || '暫無即將到來的賽事'}

## 現有跑鞋 (Active)
${activeShoeSummary || '暫無跑鞋記錄'}

請提供以下完整分析:

### 1. 跑步表現總結
分析配速趨勢、距離進展、心率效率

### 2. 跑步生物力學分析
步頻/步幅/垂直振幅/垂直比分析，跑步經濟性評估

### 3. 訓練負荷與類型分布
評估訓練充分度、強度分布是否合理

### 4. 即將賽事完成時間預測
根據現有訓練水平，為每場即將到來的賽事預測完成時間範圍（樂觀/保守），並說明預測依據

### 5. 各賽事配速策略建議
為每場即將到來的賽事提供具體配速計劃（前半段/後半段分配）

### 6. 跑鞋推薦
根據賽事距離和訓練類型，從現有跑鞋中推薦最適合的選擇，並說明理由（考慮里程磨損）

### 7. 天氣應對策略
針對香港天氣特點（高溫高濕夏季、涼爽冬季），提供不同天氣條件下的配速調整、補水策略和裝備建議

### 8. 具體訓練改進建議
提供至少5項可執行的訓練建議，幫助達成賽事目標` },
        ],
      });
      return { analysis: res.choices[0]?.message?.content ?? '分析失敗，請稍後再試。' };
    }),

  // ─── Personalized Training Plan ─────────────────────────────────────────────
  generateTrainingPlan: ownerProcedure
    .input(z.object({
      goalRaceId: z.number().optional(),
      goalRaceName: z.string().optional(),
      goalRaceDate: z.string().optional(),
      goalRaceDistance: z.number().optional(),
      goalFinishHr: z.number().optional(),
      goalFinishMin: z.number().optional(),
      goalFinishSec: z.number().optional(),
      planWeeks: z.number().optional().default(12),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');

      // 1. Recent running logs (last 8 weeks)
      const runRows = await db.execute(sql`
        SELECT date, running_type, distance_km, hour, minutes, second,
               average_pace, best_pace, average_heart_rate, maximum_heart_rate,
               average_cadence, max_cadence, avg_stride_length_m, avg_vertical_ratio,
               vertical_oscillation_cm, calories, running_shoes, notes
        FROM running_logs ORDER BY date DESC LIMIT 60
      `);
      const runs = (runRows as any).rows ?? runRows;

      // 2. All races (past + upcoming)
      const raceRows = await db.execute(sql`
        SELECT race_name, date, distance_km, finish_hr, finish_min, finish_sec, finish_time, is_pb, overall_place, location
        FROM races ORDER BY date DESC LIMIT 30
      `);
      const allRaces = (raceRows as any).rows ?? raceRows;

      // 3. Latest body composition
      const bodyRows = await db.execute(sql`
        SELECT weight, body_fat_pct, muscle_mass, bmi, bmr, visceral_fat
        FROM body_composition ORDER BY date DESC LIMIT 1
      `);
      const body = ((bodyRows as any).rows ?? bodyRows)[0] ?? null;

      // 4. Latest heart rate data
      const hrRows = await db.execute(sql`
        SELECT resting_hr, high_hr, hrv, avg_hr, zone1_minutes, zone2_minutes, zone3_minutes, zone4_minutes, zone5_minutes
        FROM heart_rate_logs ORDER BY date DESC LIMIT 1
      `);
      const hr = ((hrRows as any).rows ?? hrRows)[0] ?? null;

      // 5. Recent sleep data (7-day average)
      const sleepRows = await db.execute(sql`
        SELECT AVG(sleep_score) as avg_score, AVG(sleep_duration) as avg_duration,
               AVG(hrv) as avg_hrv, AVG(resting_hr) as avg_resting_hr,
               AVG(body_battery) as avg_battery, AVG(deep_sleep) as avg_deep
        FROM sleep_logs WHERE date >= TO_CHAR(NOW() - interval '14 days', 'YYYY-MM-DD')
      `);
      const sleep = ((sleepRows as any).rows ?? sleepRows)[0] ?? null;

      // 6. Active shoes
      const shoeRows = await db.execute(sql`
        SELECT s.shoes_name, s.brand,
          COALESCE(s.initial_km::numeric, 0) + COALESCE(SUM(r.distance_km::numeric), 0) AS total_km
        FROM running_shoes s
        LEFT JOIN running_logs r ON (r.shoes_id = s.id OR (r.shoes_id IS NULL AND r.running_shoes = s.shoes_name))
        WHERE s.status = 'Active'
        GROUP BY s.id, s.shoes_name, s.brand ORDER BY s.shoes_name ASC
      `);
      const shoes = (shoeRows as any).rows ?? shoeRows;

      const fmtTime = (r: any) => {
        if (r.finish_hr != null || r.finish_min != null) {
          const h = r.finish_hr ?? 0; const m = r.finish_min ?? 0; const s = r.finish_sec ?? 0;
          return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
        }
        return r.finish_time || null;
      };
      const fmtPace = (sec: number | null) => {
        if (!sec) return 'N/A';
        const m = Math.floor(sec / 60); const s = Math.round(sec % 60);
        return `${m}:${String(s).padStart(2, '0')}/km`;
      };

      const pastRaces = allRaces.filter((r: any) => new Date(r.date) <= new Date());
      const upcomingRaces = allRaces.filter((r: any) => new Date(r.date) > new Date());

      // Build goal race description
      let goalDesc = '';
      if (input.goalRaceId) {
        const gr = allRaces.find((r: any) => Number(r.id) === input.goalRaceId);
        if (gr) goalDesc = `${gr.race_name} (${gr.date}, ${parseFloat(gr.distance_km||0).toFixed(1)}km)`;
      } else if (input.goalRaceName) {
        goalDesc = `${input.goalRaceName}${input.goalRaceDate ? ' ('+input.goalRaceDate+')' : ''}${input.goalRaceDistance ? ' '+input.goalRaceDistance+'km' : ''}`;
      }
      const goalTimeDesc = (input.goalFinishHr != null || input.goalFinishMin != null)
        ? `目標完賽時間: ${input.goalFinishHr ?? 0}:${String(input.goalFinishMin ?? 0).padStart(2,'0')}:${String(input.goalFinishSec ?? 0).padStart(2,'0')}`
        : '';

      const runSummary = runs.slice(0, 40).map((r: any) => {
        const dur = (r.hour || r.minutes) ? `${r.hour||0}h${r.minutes||0}m${r.second||0}s` : '';
        return [
          `${r.date?.toString().slice(0,10)}`,
          r.running_type ? r.running_type : '',
          r.distance_km ? `${parseFloat(r.distance_km).toFixed(1)}km` : '',
          dur,
          r.average_pace ? `配速${fmtPace(parseFloat(r.average_pace)*60)}` : '',
          r.average_heart_rate ? `心率${r.average_heart_rate}bpm` : '',
          r.average_cadence ? `步頻${parseFloat(r.average_cadence).toFixed(0)}spm` : '',
        ].filter(Boolean).join(' ');
      }).join('\n');

      const pastRaceSummary = pastRaces.slice(0, 10).map((r: any) => {
        const t = fmtTime(r);
        return `${r.date?.toString().slice(0,10)} ${r.race_name} ${parseFloat(r.distance_km||0).toFixed(1)}km${t?' 完成:'+t:''}${r.is_pb?' PB':''}`;
      }).join('\n');

      const upcomingRaceSummary = upcomingRaces.slice(0, 5).map((r: any) =>
        `${r.date?.toString().slice(0,10)} ${r.race_name} ${parseFloat(r.distance_km||0).toFixed(1)}km${r.location?' @'+r.location:''}`
      ).join('\n');

      const bodySummary = body ? `體重:${body.weight}kg, 體脂:${body.body_fat_pct}%, 肌肉量:${body.muscle_mass}kg, BMI:${body.bmi}, BMR:${body.bmr}kcal` : '無數據';
      const hrSummary = hr ? `靜息心率:${hr.resting_hr}bpm, 最大心率:${hr.high_hr}bpm, HRV:${hr.hrv}ms, 平均心率:${hr.avg_hr}bpm` : '無數據';
      const sleepSummary = sleep ? `平均睡眠評分:${parseFloat(sleep.avg_score||0).toFixed(0)}, 平均睡眠時長:${parseFloat(sleep.avg_duration||0).toFixed(1)}h, 平均HRV:${parseFloat(sleep.avg_hrv||0).toFixed(0)}ms, 身體電量:${parseFloat(sleep.avg_battery||0).toFixed(0)}` : '無數據';
      const shoesSummary = shoes.map((s: any) => `${s.shoes_name}${s.brand?' ('+s.brand+')':''} 已跑${parseFloat(s.total_km||0).toFixed(0)}km`).join(', ');

      const res = await invokeLLM({
        messages: [
          { role: 'system', content: '你是一位專業馬拉松教練和運動科學家，擅長為跑者制定個人化訓練計劃。請用繁體中文回答，結構清晰，使用 Markdown 格式。' },
          { role: 'user', content: `請根據以下我的全面健康和訓練數據，為我制定一份個人化${input.planWeeks}週訓練計劃。

## 目標賽事
${goalDesc || '暫未指定目標賽事'}
${goalTimeDesc}

## 近期訓練記錄 (最近${runs.length}次)
${runSummary || '無記錄'}

## 過往賽事成績
${pastRaceSummary || '無記錄'}

## 即將到來的賽事
${upcomingRaceSummary || '無記錄'}

## 身體組成
${bodySummary}

## 心率數據
${hrSummary}

## 近2週睡眠恢復
${sleepSummary}

## 現有跑鞋 (Active)
${shoesSummary || '無記錄'}

請提供以下完整訓練計劃:

### 1. 訓練目標與現況評估
根據我的數據評估目前水平，設定合理的訓練目標

### 2. ${input.planWeeks}週訓練計劃概覽
以週為單位，說明每週訓練重點、總里程、強度分布（輕鬆跑/節奏跑/間歇/長跑比例）

### 3. 第1-4週詳細週計劃（基礎建立期）
每週列出7天的具體訓練安排（休息/輕鬆跑/交叉訓練/節奏跑/間歇/長跑），包括距離、配速目標、心率區間

### 4. 第5-8週詳細週計劃（強化期）
每週列出7天的具體訓練安排，逐步提升強度和里程

### 5. 第9-${input.planWeeks}週詳細週計劃（賽前準備/減量期）
最後幾週的減量策略和賽前調整

### 6. 關鍵訓練課程說明
解釋計劃中的核心訓練課程（如乳酸門檻跑、VO2max間歇等）的具體執行方法

### 7. 恢復與健康管理
根據我的睡眠和HRV數據，提供恢復建議；何時應該調整訓練強度

### 8. 跑鞋使用建議
根據訓練類型和里程，建議不同訓練日使用哪雙跑鞋

### 9. 營養與補水策略
長跑和比賽日的補給建議` },
        ],
      });
      return { plan: res.choices[0]?.message?.content ?? '生成失敗，請稍後再試。' };
    }),

  // ─── Shoe Locker CRUD ────────────────────────────────────────────────────────
  getShoes: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return [];
      // Join on BOTH shoes_id (FK) and shoes_name text match to handle legacy data
      const rows = await db.execute(sql`
        SELECT s.*,
          COALESCE(s.initial_km::numeric, 0) + COALESCE(SUM(r.distance_km::numeric), 0) AS total_km,
          COALESCE(COUNT(r.id), 0) AS run_count,
          COALESCE(s.max_km, 800) AS max_km
        FROM running_shoes s
        LEFT JOIN running_logs r ON (r.shoes_id = s.id OR (r.shoes_id IS NULL AND r.running_shoes = s.shoes_name))
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
      maxKm: z.number().optional().default(800),
      notes: z.string().optional(),
      price: z.number().optional(),
      firstUseDate: z.string().optional(),
      photoUrl: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      await db.execute(sql`
        INSERT INTO running_shoes (shoes_name, brand, model, status, purchase_date, retirement_date, initial_km, max_km, notes, price, firstusedate, photo_url)
        VALUES (${input.shoesName}, ${input.brand ?? null}, ${input.model ?? null}, ${input.status ?? 'Active'},
          ${input.purchaseDate ?? null}, ${input.retirementDate ?? null}, ${input.initialKm ?? 0},
          ${input.maxKm ?? 800},
          ${input.notes ?? null}, ${input.price ?? null}, ${input.firstUseDate ?? null}, ${input.photoUrl ?? null})
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
      maxKm: z.number().optional(),
      notes: z.string().optional(),
      price: z.number().optional(),
      firstUseDate: z.string().optional(),
      photoUrl: z.string().optional(),
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
      if (fields.purchaseDate !== undefined) { sets.push(`purchase_date = $${sets.length+1}`); vals.push(fields.purchaseDate || null); }
      if (fields.retirementDate !== undefined) { sets.push(`retirement_date = $${sets.length+1}`); vals.push(fields.retirementDate || null); }
      if (fields.initialKm !== undefined) { sets.push(`initial_km = $${sets.length+1}`); vals.push(fields.initialKm); }
      if ((fields as any).maxKm !== undefined) { sets.push(`max_km = $${sets.length+1}`); vals.push((fields as any).maxKm); }
      if (fields.notes !== undefined) { sets.push(`notes = $${sets.length+1}`); vals.push(fields.notes); }
      if (fields.price !== undefined) { sets.push(`price = $${sets.length+1}`); vals.push(fields.price); }
      if (fields.firstUseDate !== undefined) { sets.push(`firstusedate = $${sets.length+1}`); vals.push(fields.firstUseDate || null); }
      if ((fields as any).photoUrl !== undefined) { sets.push(`photo_url = $${sets.length+1}`); vals.push((fields as any).photoUrl); }
      if (sets.length === 0) return { success: true };
      vals.push(id);
      const { Client } = (await import('pg')).default as any;
      const client = new Client({ connectionString: process.env.SUPABASE_DATABASE_URL, ssl: { rejectUnauthorized: false } });
      await client.connect();
      await client.query(`UPDATE running_shoes SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${vals.length}`, vals);
      await client.end();
      return { success: true };
    }),

  deleteShoe: ownerProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      await db.execute(sql`DELETE FROM running_shoes WHERE id = ${input.id}`);
      return { success: true };
    }),

  getShoeRunHistory: publicProcedure
    .input(z.object({ shoeId: z.number().optional(), shoeName: z.string().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      // Match by shoes_id FK or by shoes_name text (legacy data)
      const rows = await db.execute(sql`
        SELECT id, date, distance_km, hour, minutes, second, average_pace, average_heart_rate,
               average_cadence, calories, running_type, notes
        FROM running_logs
        WHERE (${input.shoeId ?? null}::bigint IS NOT NULL AND (shoes_id = ${input.shoeId ?? null} OR (shoes_id IS NULL AND running_shoes = ${input.shoeName ?? null})))
           OR (${input.shoeId ?? null}::bigint IS NULL AND running_shoes = ${input.shoeName ?? null})
        ORDER BY date DESC
        LIMIT 200
      `);
      return (rows as any).rows ?? rows;
    }),

  // ─── Races CRUD ──────────────────────────────────────────────────────────────
  getRaces: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.execute(sql`
        SELECT id, race_name, date, distance_km, location, registration, bib_no, is_pb,
          finish_time, finish_hr, finish_min, finish_sec, target_hr, target_min, target_sec,
          overall_place, age_group_place, gender_group_place, running_shoes, shoes_id, notes,
          created_at, updated_at
        FROM races ORDER BY date DESC
      `);
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
      finishHr: z.number().optional(),
      finishMin: z.number().optional(),
      finishSec: z.number().optional(),
      targetHr: z.number().optional(),
      targetMin: z.number().optional(),
      targetSec: z.number().optional(),
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
          finish_hr, finish_min, finish_sec, target_hr, target_min, target_sec,
          overall_place, age_group_place, gender_group_place, running_shoes, shoes_id, notes)
        VALUES (${input.raceName}, ${input.date}, ${input.distanceKm ?? null}, ${input.location ?? null},
          ${input.registration ?? null}, ${input.bibNo ?? null}, ${input.isPb ?? false}, ${input.finishTime ?? null},
          ${input.finishHr ?? null}, ${input.finishMin ?? null}, ${input.finishSec ?? null},
          ${input.targetHr ?? null}, ${input.targetMin ?? null}, ${input.targetSec ?? null},
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
      finishHr: z.number().optional(),
      finishMin: z.number().optional(),
      finishSec: z.number().optional(),
      targetHr: z.number().optional(),
      targetMin: z.number().optional(),
      targetSec: z.number().optional(),
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
      if (f.finishHr !== undefined) { sets.push(`finish_hr = $${sets.length+1}`); vals.push(f.finishHr); }
      if (f.finishMin !== undefined) { sets.push(`finish_min = $${sets.length+1}`); vals.push(f.finishMin); }
      if (f.finishSec !== undefined) { sets.push(`finish_sec = $${sets.length+1}`); vals.push(f.finishSec); }
      if (f.targetHr !== undefined) { sets.push(`target_hr = $${sets.length+1}`); vals.push(f.targetHr); }
      if (f.targetMin !== undefined) { sets.push(`target_min = $${sets.length+1}`); vals.push(f.targetMin); }
      if (f.targetSec !== undefined) { sets.push(`target_sec = $${sets.length+1}`); vals.push(f.targetSec); }
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

  deleteRace: ownerProcedure
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
        SELECT DISTINCT ON (distance_km) distance_km, race_name, date, finish_time,
          finish_hr, finish_min, finish_sec, location
        FROM races
        WHERE is_pb = true AND (finish_hr IS NOT NULL OR finish_min IS NOT NULL OR finish_time IS NOT NULL)
        ORDER BY distance_km ASC,
          COALESCE(finish_hr, 0) * 3600 + COALESCE(finish_min, 0) * 60 + COALESCE(finish_sec, 0) ASC
      `);
      return (rows as any).rows ?? rows;
    }),

  // Get all races enriched with matching running_log data (same date ± 1 day, distance within 10%)
  getRacesEnriched: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return [];
      const raceRows = await db.execute(sql`SELECT * FROM races ORDER BY date DESC`);
      const races = (raceRows as any).rows ?? raceRows;
      // For each race, try to find a matching running_log entry
      const enriched = await Promise.all(races.map(async (race: any) => {
        if (!race.date || !race.distance_km) return { ...race, runLog: null };
        const distKm = parseFloat(race.distance_km);
        const minDist = distKm * 0.9;
        const maxDist = distKm * 1.1;
        // Look for a run on the same date or ±1 day with similar distance
        const logRows = await db.execute(sql`
          SELECT id, date, distance_km, average_pace, best_pace, average_heart_rate, maximum_heart_rate, average_cadence,
                 running_shoes, hour, minutes, second, calories, running_type,
                 max_cadence, avg_stride_length_m, avg_vertical_ratio, vertical_oscillation_cm,
                 avg_ground_contact_time_ms, temperature, humidity, wind_speed, apparent_temp, notes as log_notes
          FROM running_logs
          WHERE date BETWEEN (${race.date}::date - interval '1 day')::text AND (${race.date}::date + interval '1 day')::text
            AND distance_km::numeric BETWEEN ${minDist} AND ${maxDist}
          ORDER BY ABS(distance_km::numeric - ${distKm}) ASC
          LIMIT 1
        `);
        const logData = ((logRows as any).rows ?? logRows)[0] ?? null;
        return { ...race, runLog: logData };
      }));
      return enriched;
    }),

  analyzeRace: ownerProcedure
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
  // ─── Running Log Photos ─────────────────────────────────────────────────────
  getLogPhotos: publicProcedure
    .input(z.object({ runningLogId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(runningLogPhotos)
        .where(and(eq(runningLogPhotos.runningLogId, input.runningLogId), eq(runningLogPhotos.userId, OWNER_USER_ID)))
        .orderBy(runningLogPhotos.sortOrder, runningLogPhotos.createdAt);
    }),
  uploadLogPhoto: ownerProcedure
    .input(z.object({ runningLogId: z.number(), base64: z.string(), mimeType: z.string(), caption: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      const buffer = Buffer.from(input.base64, 'base64');
      const ext = input.mimeType.includes('png') ? 'png' : 'jpg';
      const key = `running-photos/${OWNER_USER_ID}/${input.runningLogId}/${nanoid()}.${ext}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      const existing = await db.select({ cnt: sql<number>`COUNT(*)` }).from(runningLogPhotos)
        .where(and(eq(runningLogPhotos.runningLogId, input.runningLogId), eq(runningLogPhotos.userId, OWNER_USER_ID)));
      const sortOrder = Number(existing[0]?.cnt ?? 0);
      await db.insert(runningLogPhotos).values({ userId: OWNER_USER_ID, runningLogId: input.runningLogId, photoUrl: url, fileKey: key, caption: input.caption, sortOrder });
      return { url, key };
    }),
  deleteLogPhoto: ownerProcedure
    .input(z.object({ photoId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      await db.delete(runningLogPhotos).where(and(eq(runningLogPhotos.id, input.photoId), eq(runningLogPhotos.userId, OWNER_USER_ID)));
      return { success: true };
    }),
});


// ─── Steps Router ───────────────────────────────────────────────────────────
const stepsRouter = router({
  getAll: publicProcedure
    .input(z.object({ limit: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(dailySteps)
        .where(eq(dailySteps.userId, OWNER_USER_ID))
        .orderBy(desc(dailySteps.date))
        .limit(input?.limit ?? 365);
      return rows;
    }),
  add: ownerProcedure
    .input(z.object({
      date: z.string(),
      steps: z.number().optional(),
      floorsClimbed: z.number().optional(),
      distanceKm: z.string().optional(),
      activeMinutes: z.number().optional(),
      calories: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      const [row] = await db.insert(dailySteps).values({
        userId: OWNER_USER_ID,
        date: input.date,
        steps: input.steps,
        floorsClimbed: input.floorsClimbed,
        distanceKm: input.distanceKm,
        activeMinutes: input.activeMinutes,
        calories: input.calories,
        notes: input.notes,
      }).returning();
      return row;
    }),
  update: ownerProcedure
    .input(z.object({
      id: z.number(),
      date: z.string().optional(),
      steps: z.number().optional(),
      floorsClimbed: z.number().optional(),
      distanceKm: z.string().optional(),
      activeMinutes: z.number().optional(),
      calories: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      const { id, ...rest } = input;
      const [row] = await db.update(dailySteps).set(rest).where(and(eq(dailySteps.id, id), eq(dailySteps.userId, OWNER_USER_ID))).returning();
      return row;
    }),
  delete: ownerProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      await db.delete(dailySteps).where(and(eq(dailySteps.id, input.id), eq(dailySteps.userId, OWNER_USER_ID)));
      return { success: true };
    }),
  // ─── Step Log Photos ─────────────────────────────────────────────────────────
  getLogPhotos: publicProcedure
    .input(z.object({ stepLogId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(stepLogPhotos)
        .where(and(eq(stepLogPhotos.stepLogId, input.stepLogId), eq(stepLogPhotos.userId, OWNER_USER_ID)))
        .orderBy(stepLogPhotos.sortOrder, stepLogPhotos.createdAt);
    }),
  uploadLogPhoto: ownerProcedure
    .input(z.object({ stepLogId: z.number(), base64: z.string(), mimeType: z.string(), caption: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      const buffer = Buffer.from(input.base64, 'base64');
      const ext = input.mimeType.includes('png') ? 'png' : 'jpg';
      const key = `step-photos/${OWNER_USER_ID}/${input.stepLogId}/${nanoid()}.${ext}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      const existing = await db.select({ cnt: sql<number>`COUNT(*)` }).from(stepLogPhotos)
        .where(and(eq(stepLogPhotos.stepLogId, input.stepLogId), eq(stepLogPhotos.userId, OWNER_USER_ID)));
      const sortOrder = Number(existing[0]?.cnt ?? 0);
      await db.insert(stepLogPhotos).values({ userId: OWNER_USER_ID, stepLogId: input.stepLogId, photoUrl: url, fileKey: key, caption: input.caption, sortOrder });
      return { url, key };
    }),
    deleteLogPhoto: ownerProcedure
    .input(z.object({ photoId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      await db.delete(stepLogPhotos).where(and(eq(stepLogPhotos.id, input.photoId), eq(stepLogPhotos.userId, OWNER_USER_ID)));
      return { success: true };
    }),

  // Backfill calories for steps records that have 0 or null calories
  // Uses body weight on or before each step record's date for accurate estimation
  backfillCalories: ownerProcedure
    .mutation(async () => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      // Get all steps records with 0 or null calories that have steps > 0
      const stepsToFill = await db.select().from(dailySteps)
        .where(and(
          eq(dailySteps.userId, OWNER_USER_ID),
          sql`(${dailySteps.calories} IS NULL OR ${dailySteps.calories} = 0)`,
          sql`${dailySteps.steps} > 0`,
        ))
        .orderBy(dailySteps.date);

      if (stepsToFill.length === 0) return { updated: 0 };

      // Get all body composition records ordered by date for binary search
      const bodyRecords = await db.select({
        date: bodyComposition.date,
        weight: bodyComposition.weight,
      }).from(bodyComposition)
        .where(and(
          eq(bodyComposition.userId, OWNER_USER_ID),
          sql`${bodyComposition.weight} IS NOT NULL`,
        ))
        .orderBy(bodyComposition.date);

      let updated = 0;
      for (const step of stepsToFill) {
        // Find the most recent body weight on or before this step's date
        const weightRecord = bodyRecords
          .filter(b => b.date <= step.date)
          .at(-1); // last element = most recent
        const weightKg = (weightRecord?.weight as number | null) ?? 70;
        const estimated = Math.round((step.steps ?? 0) * 0.0004 * weightKg);
        if (estimated > 0) {
          await db.update(dailySteps)
            .set({ calories: estimated })
            .where(eq(dailySteps.id, step.id));
          updated++;
        }
      }
      return { updated, total: stepsToFill.length };
    }),
});
// ─── Medical Router ───────────────────────────────────────────────────────────
const medicalRouter = router({
  getConditions: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(medicalConditions)
      .where(eq(medicalConditions.userId, OWNER_USER_ID))
      .orderBy(desc(medicalConditions.createdAt));
  }),
  addCondition: ownerProcedure
    .input(z.object({
      title: z.string(),
      category: z.string().optional(),
      status: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      const [row] = await db.insert(medicalConditions).values({
        userId: OWNER_USER_ID,
        title: input.title,
        category: input.category,
        status: input.status ?? 'active',
        startDate: input.startDate || null,
        endDate: input.endDate || null,
        notes: input.notes,
      }).returning();
      return row;
    }),
  updateCondition: ownerProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      category: z.string().optional(),
      status: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      const { id, title, category, status, startDate, endDate, notes: condNotes } = input;
      const condUpdateData: Record<string, unknown> = { updatedAt: new Date() };
      if (title !== undefined) condUpdateData.title = title;
      if (category !== undefined) condUpdateData.category = category;
      if (status !== undefined) condUpdateData.status = status;
      if (startDate !== undefined) condUpdateData.startDate = startDate || null;
      if (endDate !== undefined) condUpdateData.endDate = endDate || null;
      if (condNotes !== undefined) condUpdateData.notes = condNotes;
      const [row] = await db.update(medicalConditions).set(condUpdateData as any)
        .where(and(eq(medicalConditions.id, id), eq(medicalConditions.userId, OWNER_USER_ID))).returning();
      return row;
    }),
  deleteCondition: ownerProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      await db.delete(medicalConditions).where(and(eq(medicalConditions.id, input.id), eq(medicalConditions.userId, OWNER_USER_ID)));
      return { success: true };
    }),
  getVisits: publicProcedure
    .input(z.object({ conditionId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(medicalVisits)
        .where(and(eq(medicalVisits.conditionId, input.conditionId), eq(medicalVisits.userId, OWNER_USER_ID)))
        .orderBy(desc(medicalVisits.visitDate));
    }),
  addVisit: ownerProcedure
    .input(z.object({
      conditionId: z.number(),
      visitDate: z.string(),
      visitType: z.string().optional(),
      doctorName: z.string().optional(),
      clinic: z.string().optional(),
      diagnosis: z.string().optional(),
      prescription: z.string().optional(),
      followUpDate: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      const [row] = await db.insert(medicalVisits).values({
        conditionId: input.conditionId,
        userId: OWNER_USER_ID,
        visitDate: input.visitDate,
        visitType: input.visitType,
        doctorName: input.doctorName,
        clinic: input.clinic,
        diagnosis: input.diagnosis,
        prescription: input.prescription,
        followUpDate: input.followUpDate || null,
        notes: input.notes,
      }).returning();
      return row;
    }),
  updateVisit: ownerProcedure
    .input(z.object({
      id: z.number(),
      visitDate: z.string().optional(),
      visitType: z.string().optional(),
      doctorName: z.string().optional(),
      clinic: z.string().optional(),
      diagnosis: z.string().optional(),
      prescription: z.string().optional(),
      followUpDate: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      const { id, visitDate, visitType, doctorName, clinic, diagnosis, prescription, followUpDate, notes: visitNotes } = input;
      const visitUpdateData: Record<string, unknown> = {};
      if (visitDate !== undefined) visitUpdateData.visitDate = visitDate;
      if (visitType !== undefined) visitUpdateData.visitType = visitType;
      if (doctorName !== undefined) visitUpdateData.doctorName = doctorName;
      if (clinic !== undefined) visitUpdateData.clinic = clinic;
      if (diagnosis !== undefined) visitUpdateData.diagnosis = diagnosis;
      if (prescription !== undefined) visitUpdateData.prescription = prescription;
      if (followUpDate !== undefined) visitUpdateData.followUpDate = followUpDate || null;
      if (visitNotes !== undefined) visitUpdateData.notes = visitNotes;
      const [row] = await db.update(medicalVisits).set(visitUpdateData as any)
        .where(and(eq(medicalVisits.id, id), eq(medicalVisits.userId, OWNER_USER_ID))).returning();
      return row;
    }),
  deleteVisit: ownerProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      await db.delete(medicalVisits).where(and(eq(medicalVisits.id, input.id), eq(medicalVisits.userId, OWNER_USER_ID)));
      return { success: true };
    }),
  getAttachments: publicProcedure
    .input(z.object({ visitId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(medicalAttachments)
        .where(and(eq(medicalAttachments.visitId, input.visitId), eq(medicalAttachments.userId, OWNER_USER_ID)))
        .orderBy(desc(medicalAttachments.createdAt));
    }),
  uploadAttachment: ownerProcedure
    .input(z.object({
      visitId: z.number(),
      fileName: z.string(),
      fileType: z.string(),
      fileBase64: z.string(),
      attachmentType: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      const buffer = Buffer.from(input.fileBase64, 'base64');
      // Sanitize filename: replace non-ASCII characters so storage presign doesn't reject it
      // Keep the original fileName in the DB for display; only the storage key needs to be ASCII
      const ext = input.fileName.split('.').pop() ?? 'bin';
      const safeExt = ext.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'bin';
      const safeKey = `medical/${OWNER_USER_ID}/${nanoid()}.${safeExt}`;
      const { url } = await storagePut(safeKey, buffer, input.fileType);
      const [row] = await db.insert(medicalAttachments).values({
        visitId: input.visitId,
        userId: OWNER_USER_ID,
        fileName: input.fileName,
        fileType: input.fileType,
        fileKey: safeKey,
        fileUrl: url,
        attachmentType: input.attachmentType,
        notes: input.notes,
      }).returning();
      return row;
    }),
  deleteAttachment: ownerProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      await db.delete(medicalAttachments).where(and(eq(medicalAttachments.id, input.id), eq(medicalAttachments.userId, OWNER_USER_ID)));
      return { success: true };
    }),
});

// ─── Supplements Router ───────────────────────────────────────────────────────
const supplementsRouter = router({
  getAll: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(supplements)
      .where(eq(supplements.userId, OWNER_USER_ID))
      .orderBy(supplements.name);
  }),
  add: publicProcedure
    .input(z.object({
      name: z.string(),
      brand: z.string().optional(),
      category: z.string().optional(),
      servingSize: z.string().optional(),
      currentStock: z.number().optional(),
      lowStockThreshold: z.number().optional(),
      purchaseDate: z.string().optional(),
      expiryDate: z.string().optional(),
      notes: z.string().optional(),
      reminderEnabled: z.boolean().optional(),
      reminderTime: z.string().max(5).optional(),
      description: z.string().optional(),
      descriptionZh: z.string().optional(),
      iherbUrl: z.string().optional(),
      dailyDose: z.number().optional(),
      timeOfDay: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      const [row] = await db.insert(supplements).values({
        userId: OWNER_USER_ID,
        ...input,
        // Convert empty strings to null for date fields
        purchaseDate: input.purchaseDate || null,
        expiryDate: input.expiryDate || null,
      }).returning();
      return row;
    }),
  update: publicProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      brand: z.string().optional(),
      category: z.string().optional(),
      servingSize: z.string().optional(),
      currentStock: z.number().optional(),
      lowStockThreshold: z.number().optional(),
      purchaseDate: z.string().optional(),
      expiryDate: z.string().optional(),
      notes: z.string().optional(),
      isActive: z.boolean().optional(),
      reminderEnabled: z.boolean().optional(),
      reminderTime: z.string().max(5).optional(),
      description: z.string().optional(),
      descriptionZh: z.string().optional(),
      iherbUrl: z.string().optional(),
      dailyDose: z.number().optional(),
      timeOfDay: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      // Explicitly destructure to exclude id and userId from the set clause
      const { id, name, brand, category, servingSize, currentStock, lowStockThreshold,
        purchaseDate, expiryDate, notes, isActive, reminderEnabled, reminderTime,
        description, descriptionZh, iherbUrl, dailyDose, timeOfDay } = input;
      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (name !== undefined) updateData.name = name;
      if (brand !== undefined) updateData.brand = brand;
      if (category !== undefined) updateData.category = category;
      if (servingSize !== undefined) updateData.servingSize = servingSize;
      if (currentStock !== undefined) updateData.currentStock = currentStock;
      if (lowStockThreshold !== undefined) updateData.lowStockThreshold = lowStockThreshold;
      if (purchaseDate !== undefined) updateData.purchaseDate = purchaseDate || null;
      if (expiryDate !== undefined) updateData.expiryDate = expiryDate || null;
      if (notes !== undefined) updateData.notes = notes;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (reminderEnabled !== undefined) updateData.reminderEnabled = reminderEnabled;
      if (reminderTime !== undefined) updateData.reminderTime = reminderTime;
      if (description !== undefined) updateData.description = description;
      if (descriptionZh !== undefined) updateData.descriptionZh = descriptionZh;
      if (iherbUrl !== undefined) updateData.iherbUrl = iherbUrl;
      if (dailyDose !== undefined) updateData.dailyDose = dailyDose;
      if (timeOfDay !== undefined) updateData.timeOfDay = timeOfDay;
      const [row] = await db.update(supplements).set(updateData)
        .where(and(eq(supplements.id, id), eq(supplements.userId, OWNER_USER_ID))).returning();
      return row;
    }),
  delete: ownerProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      await db.delete(supplements).where(and(eq(supplements.id, input.id), eq(supplements.userId, OWNER_USER_ID)));
      return { success: true };
    }),
  getLogs: publicProcedure
    .input(z.object({ supplementId: z.number().optional(), limit: z.number().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [eq(supplementLogs.userId, OWNER_USER_ID)];
      if (input.supplementId) conditions.push(eq(supplementLogs.supplementId, input.supplementId));
      return db.select().from(supplementLogs)
        .where(and(...conditions))
        .orderBy(desc(supplementLogs.date))
        .limit(input.limit ?? 200);
    }),
  addLog: ownerProcedure
    .input(z.object({
      supplementId: z.number(),
      date: z.string(),
      quantity: z.number().optional(),
      timeOfDay: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      const qty = input.quantity ?? 1;
      const [row] = await db.insert(supplementLogs).values({
        supplementId: input.supplementId,
        userId: OWNER_USER_ID,
        date: input.date,
        quantity: qty,
        timeOfDay: input.timeOfDay,
        notes: input.notes,
      }).returning();
      // Deduct from stock
      const [suppBefore] = await db.select({ stock: supplements.currentStock }).from(supplements).where(and(eq(supplements.id, input.supplementId), eq(supplements.userId, OWNER_USER_ID)));
      const stockAfterDeduct = Math.max(0, (suppBefore?.stock ?? 0) - qty);
      await db.execute(sql`UPDATE supplements SET current_stock = GREATEST(0, current_stock - ${qty}), "updatedAt" = NOW() WHERE id = ${input.supplementId} AND "userId" = ${OWNER_USER_ID}`);
      // Log stock adjustment
      await db.insert(supplementStockAdjustments).values({
        supplementId: input.supplementId,
        userId: OWNER_USER_ID,
        adjustDate: input.date,
        adjustType: 'intake',
        delta: -qty,
        stockAfter: stockAfterDeduct,
        reason: input.timeOfDay ? `進食 (${input.timeOfDay})` : '進食記錄',
        notes: input.notes,
      });
      return row;
    }),
  updateLog: ownerProcedure
    .input(z.object({
      id: z.number(),
      supplementId: z.number(),
      date: z.string().optional(),
      quantity: z.number().optional(),
      timeOfDay: z.string().optional(),
      notes: z.string().optional(),
      oldQuantity: z.number().optional(), // original quantity for stock adjustment
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      const { id, supplementId, date, quantity, timeOfDay, notes, oldQuantity } = input;
      const updateData: Record<string, unknown> = {};
      if (date !== undefined) updateData.date = date;
      if (quantity !== undefined) updateData.quantity = quantity;
      if (timeOfDay !== undefined) updateData.timeOfDay = timeOfDay;
      if (notes !== undefined) updateData.notes = notes || null;
      const [row] = await db.update(supplementLogs).set(updateData)
        .where(and(eq(supplementLogs.id, id), eq(supplementLogs.userId, OWNER_USER_ID))).returning();
      // Adjust stock if quantity changed
      if (quantity !== undefined && oldQuantity !== undefined && quantity !== oldQuantity) {
        const diff = oldQuantity - quantity; // positive = restore stock, negative = deduct more
        const [suppCur] = await db.select({ stock: supplements.currentStock }).from(supplements).where(and(eq(supplements.id, supplementId), eq(supplements.userId, OWNER_USER_ID)));
        const stockAfter = Math.max(0, (suppCur?.stock ?? 0) + diff);
        if (diff > 0) {
          await db.execute(sql`UPDATE supplements SET current_stock = current_stock + ${diff}, "updatedAt" = NOW() WHERE id = ${supplementId} AND "userId" = ${OWNER_USER_ID}`);
        } else {
          await db.execute(sql`UPDATE supplements SET current_stock = GREATEST(0, current_stock - ${Math.abs(diff)}), "updatedAt" = NOW() WHERE id = ${supplementId} AND "userId" = ${OWNER_USER_ID}`);
        }
        await db.insert(supplementStockAdjustments).values({
          supplementId,
          userId: OWNER_USER_ID,
          adjustDate: date ?? todayHK(),
          adjustType: 'intake_edit',
          delta: diff,
          stockAfter,
          reason: `修改進食數量 (${oldQuantity}→${quantity})`,
        });
      }
      return row;
    }),

  deleteLog: ownerProcedure
    .input(z.object({ id: z.number(), quantity: z.number().optional(), supplementId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      const restoreQty = input.quantity ?? 1;
      await db.delete(supplementLogs).where(and(eq(supplementLogs.id, input.id), eq(supplementLogs.userId, OWNER_USER_ID)));
      // Restore stock
      const [suppBeforeRestore] = await db.select({ stock: supplements.currentStock }).from(supplements).where(and(eq(supplements.id, input.supplementId), eq(supplements.userId, OWNER_USER_ID)));
      const stockAfterRestore = (suppBeforeRestore?.stock ?? 0) + restoreQty;
      await db.execute(sql`UPDATE supplements SET current_stock = current_stock + ${restoreQty}, "updatedAt" = NOW() WHERE id = ${input.supplementId} AND "userId" = ${OWNER_USER_ID}`);
      // Log stock adjustment (reversal)
      await db.insert(supplementStockAdjustments).values({
        supplementId: input.supplementId,
        userId: OWNER_USER_ID,
        adjustDate: todayHK(),
        adjustType: 'intake_reversal',
        delta: restoreQty,
        stockAfter: stockAfterRestore,
        reason: '刪除進食記錄（還原庫存）',
      });
      return { success: true };
    }),
  restockSupplement: ownerProcedure
    .input(z.object({ id: z.number(), quantity: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      // Get current stock before update
      const [supp] = await db.select({ stock: supplements.currentStock }).from(supplements).where(and(eq(supplements.id, input.id), eq(supplements.userId, OWNER_USER_ID)));
      const stockAfter = (supp?.stock ?? 0) + input.quantity;
      await db.execute(sql`UPDATE supplements SET current_stock = current_stock + ${input.quantity}, "updatedAt" = NOW() WHERE id = ${input.id} AND "userId" = ${OWNER_USER_ID}`);
      // Log stock adjustment
      await db.insert(supplementStockAdjustments).values({
        supplementId: input.id,
        userId: OWNER_USER_ID,
        adjustDate: todayHK(),
        adjustType: 'manual_add',
        delta: input.quantity,
        stockAfter,
        reason: 'Manual restock',
      });
      return { success: true };
    }),

  // ─── Purchase Records ───────────────────────────────────────────────────────
  getPurchases: publicProcedure
    .input(z.object({ supplementId: z.number().nullish() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [eq(supplementPurchases.userId, OWNER_USER_ID)];
      if (input.supplementId) conditions.push(eq(supplementPurchases.supplementId, input.supplementId));
      return db.select({
        id: supplementPurchases.id,
        supplementId: supplementPurchases.supplementId,
        supplementName: supplements.name,
        supplementBrand: supplements.brand,
        purchaseDate: supplementPurchases.purchaseDate,
        quantity: supplementPurchases.quantity,
        unitPrice: supplementPurchases.unitPrice,
        totalPrice: supplementPurchases.totalPrice,
        currency: supplementPurchases.currency,
        source: supplementPurchases.source,
        orderNo: supplementPurchases.orderNo,
        notes: supplementPurchases.notes,
        createdAt: supplementPurchases.createdAt,
      }).from(supplementPurchases)
        .leftJoin(supplements, eq(supplementPurchases.supplementId, supplements.id))
        .where(and(...conditions))
        .orderBy(desc(supplementPurchases.purchaseDate));
    }),

  addPurchase: ownerProcedure
    .input(z.object({
      supplementId: z.number(),
      purchaseDate: z.string(),
      quantity: z.number(),
      unitPrice: z.string().optional(),
      totalPrice: z.string().optional(),
      currency: z.string().optional(),
      source: z.string().optional(),
      orderNo: z.string().optional(),
      notes: z.string().optional(),
      addToStock: z.boolean().optional(), // whether to add quantity to current stock
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      const { addToStock, ...purchaseData } = input;
      const [row] = await db.insert(supplementPurchases).values({
        ...purchaseData,
        userId: OWNER_USER_ID,
      }).returning();
      // Optionally add to stock and log adjustment
      if (addToStock) {
        const [supp] = await db.select({ stock: supplements.currentStock }).from(supplements).where(eq(supplements.id, input.supplementId));
        const stockAfter = (supp?.stock ?? 0) + input.quantity;
        await db.execute(sql`UPDATE supplements SET current_stock = current_stock + ${input.quantity}, "updatedAt" = NOW() WHERE id = ${input.supplementId} AND "userId" = ${OWNER_USER_ID}`);
        await db.insert(supplementStockAdjustments).values({
          supplementId: input.supplementId,
          userId: OWNER_USER_ID,
          adjustDate: input.purchaseDate,
          adjustType: 'purchase',
          delta: input.quantity,
          stockAfter,
          reason: `Purchase from ${input.source ?? 'iHerb'}`,
        });
      }
      return row;
    }),

  updatePurchase: ownerProcedure
    .input(z.object({
      id: z.number(),
      purchaseDate: z.string().optional(),
      quantity: z.number().optional(),
      unitPrice: z.string().optional(),
      totalPrice: z.string().optional(),
      currency: z.string().optional(),
      source: z.string().optional(),
      orderNo: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      const { id, ...rest } = input;
      const [row] = await db.update(supplementPurchases).set({ ...rest, updatedAt: new Date() })
        .where(and(eq(supplementPurchases.id, id), eq(supplementPurchases.userId, OWNER_USER_ID))).returning();
      return row;
    }),

  deletePurchase: ownerProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      await db.delete(supplementPurchases).where(and(eq(supplementPurchases.id, input.id), eq(supplementPurchases.userId, OWNER_USER_ID)));
      return { success: true };
    }),

  // ─── Stock Adjustments ──────────────────────────────────────────────────────
  getStockHistory: publicProcedure
    .input(z.object({ supplementId: z.number().nullish(), limit: z.number().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [eq(supplementStockAdjustments.userId, OWNER_USER_ID)];
      if (input.supplementId) conditions.push(eq(supplementStockAdjustments.supplementId, input.supplementId));
      return db.select({
        id: supplementStockAdjustments.id,
        supplementId: supplementStockAdjustments.supplementId,
        supplementName: supplements.name,
        adjustDate: supplementStockAdjustments.adjustDate,
        adjustType: supplementStockAdjustments.adjustType,
        delta: supplementStockAdjustments.delta,
        stockAfter: supplementStockAdjustments.stockAfter,
        reason: supplementStockAdjustments.reason,
        notes: supplementStockAdjustments.notes,
        createdAt: supplementStockAdjustments.createdAt,
      }).from(supplementStockAdjustments)
        .leftJoin(supplements, eq(supplementStockAdjustments.supplementId, supplements.id))
        .where(and(...conditions))
        .orderBy(desc(supplementStockAdjustments.adjustDate))
        .limit(input.limit ?? 200);
    }),

  addStockAdjustment: ownerProcedure
    .input(z.object({
      supplementId: z.number(),
      adjustDate: z.string(),
      adjustType: z.string(),
      delta: z.number(),
      reason: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      const [supp] = await db.select({ stock: supplements.currentStock }).from(supplements).where(and(eq(supplements.id, input.supplementId), eq(supplements.userId, OWNER_USER_ID)));
      const stockAfter = (supp?.stock ?? 0) + input.delta;
      // Update stock
      await db.execute(sql`UPDATE supplements SET current_stock = GREATEST(0, current_stock + ${input.delta}), "updatedAt" = NOW() WHERE id = ${input.supplementId} AND "userId" = ${OWNER_USER_ID}`);
      const [row] = await db.insert(supplementStockAdjustments).values({
        ...input,
        userId: OWNER_USER_ID,
        stockAfter: Math.max(0, stockAfter),
      }).returning();
      return row;
    }),

  // ─── Bulk Log Today ─────────────────────────────────────────────────────────
  bulkLogToday: ownerProcedure
    .input(z.object({
      date: z.string(), // yyyy-MM-dd in HK time
      items: z.array(z.object({
        supplementId: z.number(),
        quantity: z.number().default(1),
        timeOfDay: z.string().optional(),
      })),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      let logged = 0;
      let skipped = 0;
      for (const item of input.items) {
        // Check if already logged today
        const existing = await db.select({ id: supplementLogs.id }).from(supplementLogs)
          .where(and(
            eq(supplementLogs.userId, OWNER_USER_ID),
            eq(supplementLogs.supplementId, item.supplementId),
            eq(supplementLogs.date, input.date),
            item.timeOfDay ? eq(supplementLogs.timeOfDay, item.timeOfDay) : sql`1=1`,
          )).limit(1);
        if (existing.length > 0) { skipped++; continue; }
        const qty = item.quantity ?? 1;
        await db.insert(supplementLogs).values({
          supplementId: item.supplementId,
          userId: OWNER_USER_ID,
          date: input.date,
          quantity: qty,
          timeOfDay: item.timeOfDay,
        });
        // Deduct stock and log adjustment
        const [suppCur] = await db.select({ stock: supplements.currentStock }).from(supplements)
          .where(and(eq(supplements.id, item.supplementId), eq(supplements.userId, OWNER_USER_ID)));
        const stockAfter = Math.max(0, (suppCur?.stock ?? 0) - qty);
        await db.execute(sql`UPDATE supplements SET current_stock = GREATEST(0, current_stock - ${qty}), "updatedAt" = NOW() WHERE id = ${item.supplementId} AND "userId" = ${OWNER_USER_ID}`);
        await db.insert(supplementStockAdjustments).values({
          supplementId: item.supplementId,
          userId: OWNER_USER_ID,
          adjustDate: input.date,
          adjustType: 'intake',
          delta: -qty,
          stockAfter,
          reason: item.timeOfDay ? `進食 (${item.timeOfDay}) [一鍵記錄]` : '進食記錄 [一鍵記錄]',
        });
        logged++;
      }
      return { logged, skipped };
    }),

  // ─── Backfill Stock History from Intake Logs ────────────────────────────────
  backfillStockHistory: ownerProcedure
    .mutation(async () => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      // Get all intake logs ordered by date asc, id asc (chronological)
      const intakeLogs = await db.select().from(supplementLogs)
        .where(eq(supplementLogs.userId, OWNER_USER_ID))
        .orderBy(supplementLogs.date, supplementLogs.id);
      // Get existing stock adjustments of type 'intake' that were auto-generated (have notes = backfill marker or reason contains [backfill])
      // Use a unique marker: store logId in notes as 'logId:{id}' to deduplicate precisely
      const existingAdj = await db.select({ notes: supplementStockAdjustments.notes })
        .from(supplementStockAdjustments)
        .where(and(
          eq(supplementStockAdjustments.userId, OWNER_USER_ID),
          sql`${supplementStockAdjustments.notes} LIKE 'logId:%'`,
        ));
      const existingLogIds = new Set(
        existingAdj
          .map((a: any) => a.notes?.match(/^logId:(\d+)/)?.[1])
          .filter(Boolean)
          .map(Number)
      );
      // Also check for adjustments created by addLog (notes is null/undefined, reason contains [\u4e00鍵記錄] or is 進食記錄)
      // For these we can't perfectly deduplicate, so we use a count-based approach per (supplementId, date)
      const existingIntakeAdj = await db.select({
        supplementId: supplementStockAdjustments.supplementId,
        adjustDate: supplementStockAdjustments.adjustDate,
      }).from(supplementStockAdjustments)
        .where(and(
          eq(supplementStockAdjustments.userId, OWNER_USER_ID),
          sql`${supplementStockAdjustments.adjustType} = 'intake'`,
          sql`(${supplementStockAdjustments.notes} IS NULL OR ${supplementStockAdjustments.notes} NOT LIKE 'logId:%')`,
        ));
      // Count existing non-backfill intake adjustments per (supplementId, date)
      const existingCountMap = new Map<string, number>();
      for (const a of existingIntakeAdj) {
        const k = `${a.supplementId}|${a.adjustDate}`;
        existingCountMap.set(k, (existingCountMap.get(k) ?? 0) + 1);
      }
      // Count intake logs per (supplementId, date)
      const logCountMap = new Map<string, number>();
      for (const log of intakeLogs) {
        const k = `${log.supplementId}|${log.date}`;
        logCountMap.set(k, (logCountMap.get(k) ?? 0) + 1);
      }
      // Get current stock per supplement to work backwards
      const suppStocks = await db.select({ id: supplements.id, stock: supplements.currentStock }).from(supplements)
        .where(eq(supplements.userId, OWNER_USER_ID));
      const stockMap = new Map(suppStocks.map((s: any) => [s.id, s.stock ?? 0]));
      let inserted = 0;
      const usedCountMap = new Map<string, number>();
      for (const log of intakeLogs) {
        // Skip if already has a backfill record for this logId
        if (existingLogIds.has(log.id)) continue;
        const k = `${log.supplementId}|${log.date}`;
        const usedCount = usedCountMap.get(k) ?? 0;
        const existingCount = existingCountMap.get(k) ?? 0;
        const totalLogs = logCountMap.get(k) ?? 1;
        // If existing non-backfill adjustments already cover all logs for this day, skip
        if (usedCount + existingCount >= totalLogs) continue;
        usedCountMap.set(k, usedCount + 1);
        const qty = log.quantity ?? 1;
        // Use current stock as approximate (best we can do without full history)
        const approxStock = stockMap.get(log.supplementId) ?? 0;
        await db.insert(supplementStockAdjustments).values({
          supplementId: log.supplementId,
          userId: OWNER_USER_ID,
          adjustDate: log.date,
          adjustType: 'intake',
          delta: -qty,
          stockAfter: approxStock,
          reason: log.timeOfDay ? `進食 (${log.timeOfDay}) [回填]` : '進食記錄 [回填]',
          notes: `logId:${log.id}`,
        });
        inserted++;
      }
      return { inserted, total: intakeLogs.length };
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
  steps: stepsRouter,
  medical: medicalRouter,
  supplements: supplementsRouter,
});
export type AppRouter = typeof appRouter;

