import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  float,
  boolean,
  json,
} from "drizzle-orm/mysql-core";

// ─── Users ───────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Food Items (built-in database) ──────────────────────────────────────────
export const foodItems = mysqlTable("food_items", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  nameZh: varchar("nameZh", { length: 255 }),
  calories: float("calories").notNull(), // per 100g
  protein: float("protein").notNull(),   // g per 100g
  carbs: float("carbs").notNull(),       // g per 100g
  fat: float("fat").notNull(),           // g per 100g
  fiber: float("fiber"),
  sugar: float("sugar"),
  sodium: float("sodium"),
  category: varchar("category", { length: 64 }), // e.g. "protein", "grain", "vegetable", "fruit", "dairy", "fat"
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FoodItem = typeof foodItems.$inferSelect;
export type InsertFoodItem = typeof foodItems.$inferInsert;

// ─── Meal Logs ────────────────────────────────────────────────────────────────
export const mealLogs = mysqlTable("meal_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
  mealType: mysqlEnum("mealType", ["breakfast", "lunch", "dinner", "snack"]).notNull(),
  foodName: varchar("foodName", { length: 255 }).notNull(),
  foodItemId: int("foodItemId"), // nullable, if from food database
  quantity: float("quantity").notNull(), // grams
  calories: float("calories").notNull(),
  protein: float("protein").notNull(),
  carbs: float("carbs").notNull(),
  fat: float("fat").notNull(),
  fiber: float("fiber"),
  notes: text("notes"),
  photoUrl: varchar("photoUrl", { length: 1024 }), // S3 URL if photo was used
  aiAnalyzed: boolean("aiAnalyzed").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MealLog = typeof mealLogs.$inferSelect;
export type InsertMealLog = typeof mealLogs.$inferInsert;

// ─── Exercise Library ─────────────────────────────────────────────────────────
export const exercises = mysqlTable("exercises", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  nameZh: varchar("nameZh", { length: 255 }),
  muscleGroup: varchar("muscleGroup", { length: 64 }).notNull(), // chest, back, legs, shoulders, arms, core, cardio, full_body
  equipment: varchar("equipment", { length: 64 }), // barbell, dumbbell, machine, bodyweight, cable, cardio
  instructions: text("instructions"),
  isCustom: boolean("isCustom").default(false),
  userId: int("userId"), // null = built-in, set = user-created
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Exercise = typeof exercises.$inferSelect;
export type InsertExercise = typeof exercises.$inferInsert;

// ─── Workout Sessions ─────────────────────────────────────────────────────────
export const workoutSessions = mysqlTable("workout_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
  name: varchar("name", { length: 255 }), // e.g. "Push Day", "Leg Day"
  duration: int("duration"), // minutes
  notes: text("notes"),
  totalVolume: float("totalVolume"), // total kg lifted
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WorkoutSession = typeof workoutSessions.$inferSelect;
export type InsertWorkoutSession = typeof workoutSessions.$inferInsert;

// ─── Workout Sets ─────────────────────────────────────────────────────────────
export const workoutSets = mysqlTable("workout_sets", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  exerciseId: int("exerciseId").notNull(),
  exerciseName: varchar("exerciseName", { length: 255 }).notNull(), // denormalized for speed
  setNumber: int("setNumber").notNull(),
  reps: int("reps"),
  weight: float("weight"), // kg
  duration: int("duration"), // seconds (for cardio/timed sets)
  distance: float("distance"), // km (for cardio)
  isPersonalRecord: boolean("isPersonalRecord").default(false),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WorkoutSet = typeof workoutSets.$inferSelect;
export type InsertWorkoutSet = typeof workoutSets.$inferInsert;

// ─── Body Metrics ─────────────────────────────────────────────────────────────
export const bodyMetrics = mysqlTable("body_metrics", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
  weight: float("weight"),       // kg
  bmi: float("bmi"),
  bodyFatPct: float("bodyFatPct"), // %
  fatMass: float("fatMass"),       // kg
  muscleMass: float("muscleMass"), // kg
  bmr: float("bmr"),               // kcal
  visceralFat: float("visceralFat"),
  notes: text("notes"),
  source: varchar("source", { length: 64 }).default("manual"), // manual, sheets
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BodyMetric = typeof bodyMetrics.$inferSelect;
export type InsertBodyMetric = typeof bodyMetrics.$inferInsert;

// ─── Heart Rate Records ───────────────────────────────────────────────────────
export const heartRateRecords = mysqlTable("heart_rate_records", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
  restingHr: int("restingHr"),   // bpm
  highHr: int("highHr"),         // bpm
  maxHr: int("maxHr"),           // bpm (configured)
  hrv: float("hrv"),             // ms
  notes: text("notes"),
  source: varchar("source", { length: 64 }).default("manual"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type HeartRateRecord = typeof heartRateRecords.$inferSelect;
export type InsertHeartRateRecord = typeof heartRateRecords.$inferInsert;

// ─── Sleep Records ────────────────────────────────────────────────────────────
export const sleepRecords = mysqlTable("sleep_records", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
  score: int("score"),           // 0-100
  restingHr: int("restingHr"),   // bpm
  bodyBattery: int("bodyBattery"), // 0-100
  pulseOx: float("pulseOx"),     // %
  respiration: float("respiration"), // breaths/min
  stress: float("stress"),
  quality: mysqlEnum("quality", ["Poor", "Fair", "Good", "Excellent"]),
  duration: float("duration"),   // hours
  deepSleep: float("deepSleep"), // hours
  remSleep: float("remSleep"),   // hours
  notes: text("notes"),
  source: varchar("source", { length: 64 }).default("manual"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SleepRecord = typeof sleepRecords.$inferSelect;
export type InsertSleepRecord = typeof sleepRecords.$inferInsert;

// ─── Progress Photos ──────────────────────────────────────────────────────────
export const progressPhotos = mysqlTable("progress_photos", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
  photoUrl: varchar("photoUrl", { length: 1024 }).notNull(),
  photoKey: varchar("photoKey", { length: 512 }).notNull(), // S3 key
  angle: mysqlEnum("angle", ["front", "back", "side_left", "side_right", "other"]).default("front"),
  weight: float("weight"), // optional weight at time of photo
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ProgressPhoto = typeof progressPhotos.$inferSelect;
export type InsertProgressPhoto = typeof progressPhotos.$inferInsert;

// ─── AI Insights ──────────────────────────────────────────────────────────────
export const aiInsights = mysqlTable("ai_insights", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  weekStart: varchar("weekStart", { length: 10 }).notNull(), // YYYY-MM-DD
  content: text("content").notNull(), // markdown content from LLM
  type: mysqlEnum("type", ["nutrition", "workout", "recovery", "overall"]).default("overall"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AiInsight = typeof aiInsights.$inferSelect;
export type InsertAiInsight = typeof aiInsights.$inferInsert;
