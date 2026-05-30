import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
  real,
  boolean,
  json,
  date,
  serial,
  decimal,
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────────────────────────────
export const roleEnum = pgEnum("user_role", ["user", "admin"]);
export const mealTypeEnum = pgEnum("meal_type", ["breakfast", "lunch", "dinner", "snack"]);
export const angleEnum = pgEnum("angle", ["front", "back", "side", "custom"]);

// ─── Users ───────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Food Items (built-in database) ──────────────────────────────────────────
export const foodItems = pgTable("food_items", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  nameZh: varchar("nameZh", { length: 255 }),
  calories: real("calories").notNull(), // per 100g
  protein: real("protein").notNull(),   // g per 100g
  carbs: real("carbs").notNull(),       // g per 100g
  fat: real("fat").notNull(),           // g per 100g
  fiber: real("fiber"),
  sugar: real("sugar"),
  sodium: real("sodium"),
  category: varchar("category", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FoodItem = typeof foodItems.$inferSelect;
export type InsertFoodItem = typeof foodItems.$inferInsert;

// ─── Meal Logs ────────────────────────────────────────────────────────────────
export const mealLogs = pgTable("meal_logs", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  foodItemId: integer("foodItemId").references(() => foodItems.id),
  foodName: varchar("foodName", { length: 255 }).notNull(),
  mealType: varchar("mealType", { length: 20 }).notNull().default("snack"),
  servings: real("servings").notNull().default(1),
  servingSize: real("servingSize"),
  calories: real("calories"),
  protein: real("protein"),
  carbs: real("carbs"),
  fat: real("fat"),
  fiber: real("fiber"),
  notes: text("notes"),
  loggedAt: timestamp("loggedAt").defaultNow().notNull(),
  photoUrl: text("photoUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MealLog = typeof mealLogs.$inferSelect;
export type InsertMealLog = typeof mealLogs.$inferInsert;

// ─── Exercises ────────────────────────────────────────────────────────────────
export const exercises = pgTable("exercises", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  nameZh: varchar("nameZh", { length: 255 }),
  muscleGroup: varchar("muscleGroup", { length: 100 }),
  secondaryMuscles: text("secondaryMuscles"),
  equipment: varchar("equipment", { length: 100 }),
  category: varchar("category", { length: 100 }),
  description: text("description"),
  instructions: text("instructions"),
  difficulty: varchar("difficulty", { length: 50 }),
  imageUrl: text("imageUrl"),
  isCustom: boolean("isCustom").notNull().default(false),
  userId: integer("userId").references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Exercise = typeof exercises.$inferSelect;
export type InsertExercise = typeof exercises.$inferInsert;

// ─── Workout Sessions ─────────────────────────────────────────────────────────
export const workoutSessions = pgTable("workout_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }),
  notes: text("notes"),
  duration: integer("duration"),
  startTime: timestamp("startTime").defaultNow().notNull(),
  endTime: timestamp("endTime"),
  totalVolume: real("totalVolume"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type WorkoutSession = typeof workoutSessions.$inferSelect;
export type InsertWorkoutSession = typeof workoutSessions.$inferInsert;

// ─── Workout Sets ─────────────────────────────────────────────────────────────
export const workoutSets = pgTable("workout_sets", {
  id: serial("id").primaryKey(),
  sessionId: integer("sessionId").notNull().references(() => workoutSessions.id, { onDelete: "cascade" }),
  exerciseId: integer("exerciseId").notNull().references(() => exercises.id),
  exerciseName: varchar("exerciseName", { length: 255 }),
  setNumber: integer("setNumber").notNull().default(1),
  reps: integer("reps"),
  weight: real("weight"),
  duration: integer("duration"),
  distance: real("distance"),
  notes: text("notes"),
  isPersonalRecord: boolean("isPersonalRecord").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WorkoutSet = typeof workoutSets.$inferSelect;
export type InsertWorkoutSet = typeof workoutSets.$inferInsert;

// ─── Body Composition ─────────────────────────────────────────────────────────
export const bodyComposition = pgTable("body_composition", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  weight: real("weight"),
  bodyFatPct: real("bodyFatPct"),
  muscleMass: real("muscleMass"),
  fatMass: real("fatMass"),
  visceralFat: real("visceralFat"),
  bmi: real("bmi"),
  bmr: integer("bmr"),
  notes: text("notes"),
  source: varchar("source", { length: 50 }).default("manual"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type BodyComposition = typeof bodyComposition.$inferSelect;
export type InsertBodyComposition = typeof bodyComposition.$inferInsert;

// ─── Heart Rate Logs ──────────────────────────────────────────────────────────
export const heartRateLogs = pgTable("heart_rate_logs", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  restingHr: integer("restingHr"),
  highHr: integer("highHr"),
  hrv: integer("hrv"),
  avgHr: integer("avgHr"),
  zone1: integer("zone1"),
  zone2: integer("zone2"),
  zone3: integer("zone3"),
  zone4: integer("zone4"),
  zone5: integer("zone5"),
  notes: text("notes"),
  source: varchar("source", { length: 50 }).default("manual"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type HeartRateLog = typeof heartRateLogs.$inferSelect;
export type InsertHeartRateLog = typeof heartRateLogs.$inferInsert;

// ─── Sleep Logs ───────────────────────────────────────────────────────────────
export const sleepLogs = pgTable("sleep_logs", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  sleepScore: integer("sleepScore"),
  bodyBattery: integer("bodyBattery"),
  pulseOx: real("pulseOx"),
  respiration: real("respiration"),
  stress: integer("stress"),
  sleepQuality: varchar("sleepQuality", { length: 50 }),
  sleepDuration: real("sleepDuration"),
  deepSleep: real("deepSleep"),
  remSleep: real("remSleep"),
  lightSleep: real("lightSleep"),
  awakeDuration: real("awakeDuration"),
  notes: text("notes"),
  source: varchar("source", { length: 50 }).default("manual"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type SleepLog = typeof sleepLogs.$inferSelect;
export type InsertSleepLog = typeof sleepLogs.$inferInsert;

// ─── Progress Photos ──────────────────────────────────────────────────────────
export const progressPhotos = pgTable("progress_photos", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  photoUrl: text("photoUrl").notNull(),
  fileKey: text("fileKey").notNull(),
  angle: varchar("angle", { length: 50 }).default("front"),
  notes: text("notes"),
  weight: real("weight"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ProgressPhoto = typeof progressPhotos.$inferSelect;
export type InsertProgressPhoto = typeof progressPhotos.$inferInsert;

// ─── AI Insights ──────────────────────────────────────────────────────────────
export const aiInsights = pgTable("ai_insights", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  period: varchar("period", { length: 50 }).notNull().default("weekly"),
  content: text("content").notNull(),
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
  weekStart: date("weekStart"),
  weekEnd: date("weekEnd"),
});

export type AiInsight = typeof aiInsights.$inferSelect;
export type InsertAiInsight = typeof aiInsights.$inferInsert;

// ─── Running Logs ───────────────────────────────────────────────────────────────
export const runningLogs = pgTable("running_logs", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  distanceKm: real("distanceKm"),                  // km
  durationMin: real("durationMin"),                 // minutes
  avgPaceSecPerKm: integer("avgPaceSecPerKm"),       // seconds per km
  avgHr: integer("avgHr"),                          // bpm
  maxHr: integer("maxHr"),                          // bpm
  calories: integer("calories"),                    // kcal
  avgCadence: integer("avgCadence"),                 // steps/min
  maxCadence: integer("maxCadence"),                 // steps/min
  avgStrideLength: real("avgStrideLength"),          // metres
  avgVerticalRatio: real("avgVerticalRatio"),        // %
  verticalOscillation: real("verticalOscillation"), // cm
  elevationGain: real("elevationGain"),             // metres
  notes: text("notes"),
  source: varchar("source", { length: 50 }).default("manual"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type RunningLog = typeof runningLogs.$inferSelect;
export type InsertRunningLog = typeof runningLogs.$inferInsert;

// ─── Health Goals ─────────────────────────────────────────────────────────────
export const goalTypeEnum = pgEnum("goal_type", [
  "weight",
  "body_fat_pct",
  "muscle_mass",
  "sleep_duration",
  "sleep_score",
  "resting_hr",
  "hrv",
  "daily_calories",
  "daily_protein",
  "workout_duration",
]);

export const healthGoals = pgTable("health_goals", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  goalType: goalTypeEnum("goalType").notNull(),
  targetValue: real("targetValue").notNull(),
  unit: varchar("unit", { length: 30 }),
  notes: text("notes"),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type HealthGoal = typeof healthGoals.$inferSelect;
export type InsertHealthGoal = typeof healthGoals.$inferInsert;
