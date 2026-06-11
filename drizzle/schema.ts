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
  serial,
  decimal,
  bigserial,
  bigint,
  date,
  numeric,
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────────────────────────────
export const roleEnum = pgEnum("user_role", ["user", "admin"]);
export const mealTypeEnum = pgEnum("meal_type", ["breakfast", "lunch", "dinner", "snack"]);
export const angleEnum = pgEnum("angle", ["front", "back", "side", "custom"]);

// ─── Users ───────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("open_id", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("login_method", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastSignedIn: timestamp("last_signed_in").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── User Profile ─────────────────────────────────────────────────────────────
export const userProfile = pgTable("user_profile", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  height: real("height"),          // cm
  birthYear: integer("birth_year"),
  gender: varchar("gender", { length: 10 }), // 'male' | 'female'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type UserProfile = typeof userProfile.$inferSelect;
export type InsertUserProfile = typeof userProfile.$inferInsert;

// ─── Food Items (built-in database) ──────────────────────────────────────────
export const foodItems = pgTable("food_items", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  nameZh: varchar("name_zh", { length: 255 }),
  calories: real("calories").notNull(), // per 100g
  protein: real("protein").notNull(),   // g per 100g
  carbs: real("carbs").notNull(),       // g per 100g
  fat: real("fat").notNull(),           // g per 100g
  fiber: real("fiber"),
  sugar: real("sugar"),
  sodium: real("sodium"),
  category: varchar("category", { length: 64 }),
  servingSize: real("serving_size"),
  servingUnit: varchar("serving_unit", { length: 50 }),
  isCustom: boolean("is_custom").notNull().default(false),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type FoodItem = typeof foodItems.$inferSelect;
export type InsertFoodItem = typeof foodItems.$inferInsert;

// ─── Meal Logs ────────────────────────────────────────────────────────────────
export const mealLogs = pgTable("meal_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  foodItemId: integer("food_item_id").references(() => foodItems.id),
  foodName: varchar("food_name", { length: 255 }).notNull(),
  mealType: varchar("meal_type", { length: 20 }).notNull().default("snack"),
  servings: real("servings").notNull().default(1),
  servingSize: real("serving_size"),
  calories: real("calories"),
  protein: real("protein"),
  carbs: real("carbs"),
  fat: real("fat"),
  fiber: real("fiber"),
  notes: text("notes"),
  logDate: date("log_date"),
  loggedAt: timestamp("logged_at").defaultNow().notNull(),
  photoUrl: text("photo_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type MealLog = typeof mealLogs.$inferSelect;
export type InsertMealLog = typeof mealLogs.$inferInsert;

// ─── Exercises ────────────────────────────────────────────────────────────────
export const exercises = pgTable("exercises", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  nameZh: varchar("name_zh", { length: 255 }),
  muscleGroup: varchar("muscle_group", { length: 100 }),
  secondaryMuscles: text("secondary_muscles"),
  equipment: varchar("equipment", { length: 100 }),
  category: varchar("category", { length: 100 }),
  description: text("description"),
  instructions: text("instructions"),
  difficulty: varchar("difficulty", { length: 50 }),
  imageUrl: text("image_url"),
  isCustom: boolean("is_custom").notNull().default(false),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Exercise = typeof exercises.$inferSelect;
export type InsertExercise = typeof exercises.$inferInsert;

// ─── Workout Sessions ─────────────────────────────────────────────────────────
export const workoutSessions = pgTable("workout_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }),
  notes: text("notes"),
  duration: integer("duration"),
  startTime: timestamp("start_time").defaultNow().notNull(),
  endTime: timestamp("end_time"),
  totalVolume: real("total_volume"),
  caloriesBurned: real("calories_burned"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type WorkoutSession = typeof workoutSessions.$inferSelect;
export type InsertWorkoutSession = typeof workoutSessions.$inferInsert;

// ─── Workout Sets ─────────────────────────────────────────────────────────────
export const workoutSets = pgTable("workout_sets", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => workoutSessions.id, { onDelete: "cascade" }),
  exerciseId: integer("exercise_id").references(() => exercises.id),
  exerciseName: varchar("exercise_name", { length: 255 }),
  setNumber: integer("set_number").notNull().default(1),
  reps: integer("reps"),
  weight: real("weight"),
  duration: integer("duration"),
  distance: real("distance"),
  avgHr: integer("avg_hr"),
  calories: integer("calories"),
  notes: text("notes"),
  isPersonalRecord: boolean("is_personal_record").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type WorkoutSet = typeof workoutSets.$inferSelect;
export type InsertWorkoutSet = typeof workoutSets.$inferInsert;

// ─── Body Composition ─────────────────────────────────────────────────────────
export const bodyComposition = pgTable("body_composition", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  weight: real("weight"),
  bodyFatPct: real("body_fat_pct"),
  muscleMass: real("muscle_mass"),
  fatMass: real("fat_mass"),
  visceralFat: real("visceral_fat"),
  bmi: real("bmi"),
  bmr: integer("bmr"),
  notes: text("notes"),
  source: varchar("source", { length: 50 }).default("manual"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type BodyComposition = typeof bodyComposition.$inferSelect;
export type InsertBodyComposition = typeof bodyComposition.$inferInsert;

// ─── Heart Rate Logs ──────────────────────────────────────────────────────────
export const heartRateLogs = pgTable("heart_rate_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  restingHr: integer("resting_hr"),
  highHr: integer("high_hr"),
  hrv: integer("hrv"),
  avgHr: integer("avg_hr"),
  zone1: integer("zone1"),
  zone2: integer("zone2"),
  zone3: integer("zone3"),
  zone4: integer("zone4"),
  zone5: integer("zone5"),
  zone1Minutes: integer("zone1_minutes"),
  zone2Minutes: integer("zone2_minutes"),
  zone3Minutes: integer("zone3_minutes"),
  zone4Minutes: integer("zone4_minutes"),
  zone5Minutes: integer("zone5_minutes"),
  notes: text("notes"),
  source: varchar("source", { length: 50 }).default("manual"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type HeartRateLog = typeof heartRateLogs.$inferSelect;
export type InsertHeartRateLog = typeof heartRateLogs.$inferInsert;

// ─── Sleep Logs ───────────────────────────────────────────────────────────────
export const sleepLogs = pgTable("sleep_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  sleepScore: integer("sleep_score"),
  bodyBattery: integer("body_battery"),
  pulseOx: real("pulse_ox"),
  respiration: real("respiration"),
  sleepQuality: varchar("sleep_quality", { length: 50 }),
  sleepDuration: real("sleep_duration"),
  deepSleep: real("deep_sleep"),
  remSleep: real("rem_sleep"),
  lightSleep: real("light_sleep"),
  awakeDuration: real("awake_duration"),
  hrv: integer("hrv"),
  restingHr: integer("resting_hr"),
  skintemp: text("skintemp"),
  bedtime: text("bedtime"),
  waketime: text("waketime"),
  notes: text("notes"),
  source: varchar("source", { length: 50 }).default("manual"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type SleepLog = typeof sleepLogs.$inferSelect;
export type InsertSleepLog = typeof sleepLogs.$inferInsert;

// ─── Progress Photos ──────────────────────────────────────────────────────────
export const progressPhotos = pgTable("progress_photos", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  photoUrl: text("photo_url").notNull(),
  fileKey: text("file_key").notNull(),
  angle: varchar("angle", { length: 50 }).default("front"),
  notes: text("notes"),
  weight: real("weight"),
  bodyFatPct: real("body_fat_pct"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ProgressPhoto = typeof progressPhotos.$inferSelect;
export type InsertProgressPhoto = typeof progressPhotos.$inferInsert;

// ─── AI Insights ──────────────────────────────────────────────────────────────
export const aiInsights = pgTable("ai_insights", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  period: varchar("period", { length: 50 }).notNull().default("weekly"),
  content: text("content").notNull(),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
  weekStart: text("week_start"),
  weekEnd: text("week_end"),
});

export type AiInsight = typeof aiInsights.$inferSelect;
export type InsertAiInsight = typeof aiInsights.$inferInsert;

// ─── Running Logs ───────────────────────────────────────────────────────────────
// NOTE: This table uses snake_case column names matching the existing DB schema
export const runningLogs = pgTable("running_logs", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(),
  runningType: text("running_type"),
  runningShoes: text("running_shoes"),
  shoesId: integer("shoes_id"),
  distanceKm: real("distance_km"),
  hour: integer("hour"),
  minutes: integer("minutes"),
  second: integer("second"),
  averagePace: text("average_pace"),
  bestPace: text("best_pace"),
  averageHeartRate: integer("average_heart_rate"),
  maximumHeartRate: integer("maximum_heart_rate"),
  averageCadence: real("average_cadence"),
  maxCadence: real("max_cadence"),
  avgStrideLengthM: real("avg_stride_length_m"),
  avgVerticalRatio: real("avg_vertical_ratio"),
  verticalOscillationCm: real("vertical_oscillation_cm"),
  avgGroundContactTimeMs: real("avg_ground_contact_time_ms"),
  calories: integer("calories"),
  temperature: real("temperature"),
  humidity: real("humidity"),
  windSpeed: real("wind_speed"),
  apparentTemp: real("apparent_temp"),
  status: text("status"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  goalType: goalTypeEnum("goal_type").notNull(),
  targetValue: real("target_value").notNull(),
  unit: varchar("unit", { length: 30 }),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type HealthGoal = typeof healthGoals.$inferSelect;
export type InsertHealthGoal = typeof healthGoals.$inferInsert;

// ─── Running Shoes ────────────────────────────────────────────────────────────
export const runningShoes = pgTable("running_shoes", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  shoesName: text("shoes_name").notNull(),
  brand: text("brand"),
  model: text("model"),
  status: text("status").default("Active"),
  purchaseDate: date("purchase_date"),
  retirementDate: date("retirement_date"),
  initialKm: numeric("initial_km").default("0"),
  notes: text("notes"),
  photoUrl: text("photo_url"),
  price: numeric("price"),
  firstUseDate: date("firstusedate"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export type RunningShoe = typeof runningShoes.$inferSelect;
export type InsertRunningShoe = typeof runningShoes.$inferInsert;

// ─── Races ────────────────────────────────────────────────────────────────────
export const races = pgTable("races", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  raceName: text("race_name").notNull(),
  date: date("date").notNull(),
  distanceKm: numeric("distance_km"),
  location: text("location"),
  registration: text("registration"),
  bibNo: text("bib_no"),
  isPb: boolean("is_pb").default(false),
  finishTime: text("finish_time"),
  finishHr: integer("finish_hr"),
  finishMin: integer("finish_min"),
  finishSec: integer("finish_sec"),
  targetHr: integer("target_hr"),
  targetMin: integer("target_min"),
  targetSec: integer("target_sec"),
  overallPlace: integer("overall_place"),
  ageGroupPlace: integer("age_group_place"),
  genderGroupPlace: integer("gender_group_place"),
  runningShoes: text("running_shoes"),
  shoesId: bigint("shoes_id", { mode: "number" }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export type Race = typeof races.$inferSelect;
export type InsertRace = typeof races.$inferInsert;

// ─── Favourite Exercises ──────────────────────────────────────────────────────
export const favouriteExercises = pgTable("favourite_exercises", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  exerciseName: text("exercise_name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type FavouriteExercise = typeof favouriteExercises.$inferSelect;
export type InsertFavouriteExercise = typeof favouriteExercises.$inferInsert;

// ─── Daily Steps & Stairs ─────────────────────────────────────────────────────
export const dailySteps = pgTable("daily_steps", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  steps: integer("steps"),
  floorsClimbed: integer("floors_climbed"),
  distanceKm: numeric("distance_km"),
  activeMinutes: integer("active_minutes"),
  calories: integer("calories"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type DailySteps = typeof dailySteps.$inferSelect;
export type InsertDailySteps = typeof dailySteps.$inferInsert;

// ─── Medical Conditions ───────────────────────────────────────────────────────
export const medicalConditions = pgTable("medical_conditions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  category: varchar("category", { length: 64 }),
  status: varchar("status", { length: 32 }).default("active"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type MedicalCondition = typeof medicalConditions.$inferSelect;
export type InsertMedicalCondition = typeof medicalConditions.$inferInsert;

// ─── Medical Visits (per condition) ──────────────────────────────────────────
export const medicalVisits = pgTable("medical_visits", {
  id: serial("id").primaryKey(),
  conditionId: integer("condition_id").notNull().references(() => medicalConditions.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  visitDate: date("visit_date").notNull(),
  visitType: varchar("visit_type", { length: 64 }),
  doctorName: text("doctor_name"),
  clinic: text("clinic"),
  diagnosis: text("diagnosis"),
  prescription: text("prescription"),
  followUpDate: date("follow_up_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type MedicalVisit = typeof medicalVisits.$inferSelect;
export type InsertMedicalVisit = typeof medicalVisits.$inferInsert;

// ─── Medical Attachments (per visit) ─────────────────────────────────────────
export const medicalAttachments = pgTable("medical_attachments", {
  id: serial("id").primaryKey(),
  visitId: integer("visit_id").notNull().references(() => medicalVisits.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  fileType: varchar("file_type", { length: 64 }),
  fileKey: text("file_key").notNull(),
  fileUrl: text("file_url").notNull(),
  attachmentType: varchar("attachment_type", { length: 64 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type MedicalAttachment = typeof medicalAttachments.$inferSelect;
export type InsertMedicalAttachment = typeof medicalAttachments.$inferInsert;

// ─── Supplements ──────────────────────────────────────────────────────────────
export const supplements = pgTable("supplements", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  brand: text("brand"),
  category: varchar("category", { length: 64 }),
  servingSize: text("serving_size"),
  currentStock: integer("current_stock").default(0),
  lowStockThreshold: integer("low_stock_threshold").default(30),
  purchaseDate: date("purchase_date"),
  expiryDate: date("expiry_date"),
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  reminderEnabled: boolean("reminder_enabled").default(false),
  reminderTime: varchar("reminder_time", { length: 5 }),
  description: text("description"),
  descriptionZh: text("description_zh"),
  iherbUrl: text("iherb_url"),
  dailyDose: integer("daily_dose"),
  timeOfDay: varchar("time_of_day", { length: 32 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type Supplement = typeof supplements.$inferSelect;
export type InsertSupplement = typeof supplements.$inferInsert;

// ─── Supplement Intake Logs ───────────────────────────────────────────────────
export const supplementLogs = pgTable("supplement_logs", {
  id: serial("id").primaryKey(),
  supplementId: integer("supplement_id").notNull().references(() => supplements.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  quantity: integer("quantity").default(1),
  timeOfDay: varchar("time_of_day", { length: 32 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type SupplementLog = typeof supplementLogs.$inferSelect;
export type InsertSupplementLog = typeof supplementLogs.$inferInsert;

// ─── Supplement Purchases ─────────────────────────────────────────────────────
export const supplementPurchases = pgTable("supplement_purchases", {
  id: serial("id").primaryKey(),
  supplementId: integer("supplement_id").notNull().references(() => supplements.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  purchaseDate: date("purchase_date").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: numeric("unit_price"),
  totalPrice: numeric("total_price"),
  currency: varchar("currency", { length: 8 }).default("HKD"),
  source: text("source"),
  orderNo: text("order_no"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type SupplementPurchase = typeof supplementPurchases.$inferSelect;
export type InsertSupplementPurchase = typeof supplementPurchases.$inferInsert;

// ─── Supplement Stock Adjustments ─────────────────────────────────────────────
export const supplementStockAdjustments = pgTable("supplement_stock_adjustments", {
  id: serial("id").primaryKey(),
  supplementId: integer("supplement_id").notNull().references(() => supplements.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  adjustDate: date("adjust_date").notNull(),
  adjustType: varchar("adjust_type", { length: 32 }).notNull(),
  delta: integer("delta").notNull(),
  stockAfter: integer("stock_after"),
  reason: text("reason"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type SupplementStockAdjustment = typeof supplementStockAdjustments.$inferSelect;
export type InsertSupplementStockAdjustment = typeof supplementStockAdjustments.$inferInsert;

// ─── Running Log Photos ───────────────────────────────────────────────────────
export const runningLogPhotos = pgTable("running_log_photos", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  runningLogId: integer("running_log_id").notNull().references(() => runningLogs.id, { onDelete: "cascade" }),
  photoUrl: text("photo_url").notNull(),
  fileKey: text("file_key").notNull(),
  caption: text("caption"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type RunningLogPhoto = typeof runningLogPhotos.$inferSelect;
export type InsertRunningLogPhoto = typeof runningLogPhotos.$inferInsert;

// ─── Step Log Photos ──────────────────────────────────────────────────────────
export const stepLogPhotos = pgTable("step_log_photos", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  stepLogId: integer("step_log_id").notNull().references(() => dailySteps.id, { onDelete: "cascade" }),
  photoUrl: text("photo_url").notNull(),
  fileKey: text("file_key").notNull(),
  caption: text("caption"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type StepLogPhoto = typeof stepLogPhotos.$inferSelect;
export type InsertStepLogPhoto = typeof stepLogPhotos.$inferInsert;

// ─── Custom Exercises (user-created) ─────────────────────────────────────────
export const customExercises = pgTable("custom_exercises", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  nameZh: text("name_zh").default(""),
  muscleGroup: text("muscle_group").notNull().default("other"),
  equipment: text("equipment").notNull().default("Other"),
  instructions: text("instructions").default(""),
  photoUrl: text("photo_url"),
  fileKey: text("file_key"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type CustomExercise = typeof customExercises.$inferSelect;
export type InsertCustomExercise = typeof customExercises.$inferInsert;

// ─── Blood Pressure Logs ──────────────────────────────────────────────────────
export const bloodPressureLogs = pgTable("blood_pressure_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  measuredAt: timestamp("measured_at").notNull(),
  systolic: integer("systolic").notNull(),
  diastolic: integer("diastolic").notNull(),
  pulse: integer("pulse"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type BloodPressureLog = typeof bloodPressureLogs.$inferSelect;
export type InsertBloodPressureLog = typeof bloodPressureLogs.$inferInsert;

// ─── Physiotherapy ────────────────────────────────────────────────────────────
export const physioSessions = pgTable("physio_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  sessionDate: date("session_date").notNull(),
  therapist: varchar("therapist", { length: 200 }),
  bodyPart: varchar("body_part", { length: 200 }),
  durationMin: integer("duration_min"),
  notes: text("notes"),
  painBefore: integer("pain_before"),
  painAfter: integer("pain_after"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type PhysioSession = typeof physioSessions.$inferSelect;
export type InsertPhysioSession = typeof physioSessions.$inferInsert;

export const physioExercises = pgTable("physio_exercises", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => physioSessions.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 200 }).notNull(),
  sets: integer("sets"),
  reps: integer("reps"),
  durationSec: integer("duration_sec"),
  equipment: varchar("equipment", { length: 100 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type PhysioExercise = typeof physioExercises.$inferSelect;
export type InsertPhysioExercise = typeof physioExercises.$inferInsert;

// ─── Fasting Logs ─────────────────────────────────────────────────────────────
export const fastingLogs = pgTable("fasting_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  fastingType: varchar("fasting_type", { length: 32 }).notNull().default("16:8"),
  targetHours: real("target_hours").notNull().default(16),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  actualHours: real("actual_hours"),
  isCompleted: boolean("is_completed").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type FastingLog = typeof fastingLogs.$inferSelect;
export type InsertFastingLog = typeof fastingLogs.$inferInsert;

// ─── Food Favorites ───────────────────────────────────────────────────────────
export const foodFavorites = pgTable("food_favorites", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  foodName: varchar("food_name", { length: 255 }).notNull(),
  calories: real("calories"),
  protein: real("protein"),
  carbs: real("carbs"),
  fat: real("fat"),
  servingSize: real("serving_size"),
  servingUnit: varchar("serving_unit", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type FoodFavorite = typeof foodFavorites.$inferSelect;
export type InsertFoodFavorite = typeof foodFavorites.$inferInsert;

// ─── Food Analysis History ────────────────────────────────────────────────────
export const foodAnalysisHistory = pgTable("food_analysis_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  photoUrl: text("photo_url"),
  analysisResult: text("analysis_result").notNull(),
  totalCalories: real("total_calories"),
  analyzedAt: timestamp("analyzed_at").defaultNow().notNull(),
});
export type FoodAnalysisHistory = typeof foodAnalysisHistory.$inferSelect;
export type InsertFoodAnalysisHistory = typeof foodAnalysisHistory.$inferInsert;
