import { createRequire } from 'module'; const require = createRequire(import.meta.url);

// api/index.ts
import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/db.ts
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

// drizzle/schema.ts
import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
  real,
  boolean,
  serial,
  bigserial,
  bigint,
  date,
  numeric
} from "drizzle-orm/pg-core";
var roleEnum = pgEnum("user_role", ["user", "admin"]);
var mealTypeEnum = pgEnum("meal_type", ["breakfast", "lunch", "dinner", "snack"]);
var angleEnum = pgEnum("angle", ["front", "back", "side", "custom"]);
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var foodItems = pgTable("food_items", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  nameZh: varchar("nameZh", { length: 255 }),
  calories: real("calories").notNull(),
  // per 100g
  protein: real("protein").notNull(),
  // g per 100g
  carbs: real("carbs").notNull(),
  // g per 100g
  fat: real("fat").notNull(),
  // g per 100g
  fiber: real("fiber"),
  sugar: real("sugar"),
  sodium: real("sodium"),
  category: varchar("category", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var mealLogs = pgTable("meal_logs", {
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
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var exercises = pgTable("exercises", {
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
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var workoutSessions = pgTable("workout_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }),
  notes: text("notes"),
  duration: integer("duration"),
  startTime: timestamp("startTime").defaultNow().notNull(),
  endTime: timestamp("endTime"),
  totalVolume: real("totalVolume"),
  caloriesBurned: real("caloriesBurned"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull()
});
var workoutSets = pgTable("workout_sets", {
  id: serial("id").primaryKey(),
  sessionId: integer("sessionId").notNull().references(() => workoutSessions.id, { onDelete: "cascade" }),
  exerciseId: integer("exerciseId").references(() => exercises.id),
  exerciseName: varchar("exerciseName", { length: 255 }),
  setNumber: integer("setNumber").notNull().default(1),
  reps: integer("reps"),
  weight: real("weight"),
  duration: integer("duration"),
  distance: real("distance"),
  notes: text("notes"),
  isPersonalRecord: boolean("isPersonalRecord").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var bodyComposition = pgTable("body_composition", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
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
  updatedAt: timestamp("updatedAt").defaultNow().notNull()
});
var heartRateLogs = pgTable("heart_rate_logs", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  restingHr: integer("restingHr"),
  highHr: integer("highHr"),
  hrv: integer("hrv"),
  avgHr: integer("avgHr"),
  zone1: integer("zone1"),
  zone2: integer("zone2"),
  zone3: integer("zone3"),
  zone4: integer("zone4"),
  zone5: integer("zone5"),
  zone1Minutes: integer("zone1Minutes"),
  zone2Minutes: integer("zone2Minutes"),
  zone3Minutes: integer("zone3Minutes"),
  zone4Minutes: integer("zone4Minutes"),
  zone5Minutes: integer("zone5Minutes"),
  notes: text("notes"),
  source: varchar("source", { length: 50 }).default("manual"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull()
});
var sleepLogs = pgTable("sleep_logs", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  sleepScore: integer("sleepScore"),
  bodyBattery: integer("bodyBattery"),
  pulseOx: real("pulseOx"),
  respiration: real("respiration"),
  sleepQuality: varchar("sleepQuality", { length: 50 }),
  sleepDuration: real("sleepDuration"),
  deepSleep: real("deepSleep"),
  remSleep: real("remSleep"),
  lightSleep: real("lightSleep"),
  awakeDuration: real("awakeDuration"),
  hrv: integer("hrv"),
  restingHr: integer("restingHr"),
  skintemp: text("skintemp"),
  bedtime: text("bedtime"),
  waketime: text("waketime"),
  notes: text("notes"),
  source: varchar("source", { length: 50 }).default("manual"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull()
});
var progressPhotos = pgTable("progress_photos", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  photoUrl: text("photoUrl").notNull(),
  fileKey: text("fileKey").notNull(),
  angle: varchar("angle", { length: 50 }).default("front"),
  notes: text("notes"),
  weight: real("weight"),
  bodyFatPct: real("bodyFatPct"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var aiInsights = pgTable("ai_insights", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  period: varchar("period", { length: 50 }).notNull().default("weekly"),
  content: text("content").notNull(),
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
  weekStart: text("weekStart"),
  weekEnd: text("weekEnd")
});
var runningLogs = pgTable("running_logs", {
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
  updatedAt: timestamp("updated_at").defaultNow()
});
var goalTypeEnum = pgEnum("goal_type", [
  "weight",
  "body_fat_pct",
  "muscle_mass",
  "sleep_duration",
  "sleep_score",
  "resting_hr",
  "hrv",
  "daily_calories",
  "daily_protein",
  "workout_duration"
]);
var healthGoals = pgTable("health_goals", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  goalType: goalTypeEnum("goalType").notNull(),
  targetValue: real("targetValue").notNull(),
  unit: varchar("unit", { length: 30 }),
  notes: text("notes"),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull()
});
var runningShoes = pgTable("running_shoes", {
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
  updatedAt: timestamp("updated_at").defaultNow()
});
var races = pgTable("races", {
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
  updatedAt: timestamp("updated_at").defaultNow()
});
var favouriteExercises = pgTable("favourite_exercises", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  exerciseName: text("exercise_name").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var dailySteps = pgTable("daily_steps", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  steps: integer("steps"),
  floorsClimbed: integer("floors_climbed"),
  distanceKm: numeric("distance_km"),
  activeMinutes: integer("active_minutes"),
  calories: integer("calories"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull()
});
var medicalConditions = pgTable("medical_conditions", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  category: varchar("category", { length: 64 }),
  // e.g. illness, injury, sports_injury, checkup
  status: varchar("status", { length: 32 }).default("active"),
  // active, resolved, chronic
  startDate: date("start_date"),
  endDate: date("end_date"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull()
});
var medicalVisits = pgTable("medical_visits", {
  id: serial("id").primaryKey(),
  conditionId: integer("condition_id").notNull().references(() => medicalConditions.id, { onDelete: "cascade" }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  visitDate: date("visit_date").notNull(),
  visitType: varchar("visit_type", { length: 64 }),
  // consultation, xray, mri, blood_test, physio, checkup, other
  doctorName: text("doctor_name"),
  clinic: text("clinic"),
  diagnosis: text("diagnosis"),
  prescription: text("prescription"),
  followUpDate: date("follow_up_date"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var medicalAttachments = pgTable("medical_attachments", {
  id: serial("id").primaryKey(),
  visitId: integer("visit_id").notNull().references(() => medicalVisits.id, { onDelete: "cascade" }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  fileType: varchar("file_type", { length: 64 }),
  // image/jpeg, application/pdf, etc.
  fileKey: text("file_key").notNull(),
  fileUrl: text("file_url").notNull(),
  attachmentType: varchar("attachment_type", { length: 64 }),
  // xray, mri, doctor_note, prescription, report, other
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var supplements = pgTable("supplements", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  brand: text("brand"),
  category: varchar("category", { length: 64 }),
  // protein, vitamin, mineral, pre_workout, etc.
  servingSize: text("serving_size"),
  currentStock: integer("current_stock").default(0),
  // in pills/servings
  lowStockThreshold: integer("low_stock_threshold").default(30),
  purchaseDate: date("purchase_date"),
  expiryDate: date("expiry_date"),
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  reminderEnabled: boolean("reminder_enabled").default(false),
  reminderTime: varchar("reminder_time", { length: 5 }),
  // HH:MM format, e.g. "08:00"
  description: text("description"),
  // EN product description from iHerb
  descriptionZh: text("description_zh"),
  // ZH product description
  iherbUrl: text("iherb_url"),
  // iHerb product page URL
  dailyDose: integer("daily_dose"),
  // pills/servings per day
  timeOfDay: varchar("time_of_day", { length: 32 }),
  // morning, pre_workout, post_workout, evening, night
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull()
});
var supplementLogs = pgTable("supplement_logs", {
  id: serial("id").primaryKey(),
  supplementId: integer("supplement_id").notNull().references(() => supplements.id, { onDelete: "cascade" }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  quantity: integer("quantity").default(1),
  timeOfDay: varchar("time_of_day", { length: 32 }),
  // morning, afternoon, evening, night, pre_workout, post_workout
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var supplementPurchases = pgTable("supplement_purchases", {
  id: serial("id").primaryKey(),
  supplementId: integer("supplement_id").notNull().references(() => supplements.id, { onDelete: "cascade" }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  purchaseDate: date("purchase_date").notNull(),
  quantity: integer("quantity").notNull().default(1),
  // number of pills/servings purchased
  unitPrice: numeric("unit_price"),
  // price per pill/serving
  totalPrice: numeric("total_price"),
  // total cost
  currency: varchar("currency", { length: 8 }).default("HKD"),
  source: text("source"),
  // iHerb, Amazon, local pharmacy, etc.
  orderNo: text("order_no"),
  // order reference number
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull()
});
var supplementStockAdjustments = pgTable("supplement_stock_adjustments", {
  id: serial("id").primaryKey(),
  supplementId: integer("supplement_id").notNull().references(() => supplements.id, { onDelete: "cascade" }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  adjustDate: date("adjust_date").notNull(),
  adjustType: varchar("adjust_type", { length: 32 }).notNull(),
  // purchase, intake, manual_add, manual_remove, expired, lost
  delta: integer("delta").notNull(),
  // positive = add, negative = remove
  stockAfter: integer("stock_after"),
  // stock level after adjustment
  reason: text("reason"),
  // description of why
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var runningLogPhotos = pgTable("running_log_photos", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  runningLogId: integer("running_log_id").notNull().references(() => runningLogs.id, { onDelete: "cascade" }),
  photoUrl: text("photo_url").notNull(),
  fileKey: text("file_key").notNull(),
  caption: text("caption"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var stepLogPhotos = pgTable("step_log_photos", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  stepLogId: integer("step_log_id").notNull().references(() => dailySteps.id, { onDelete: "cascade" }),
  photoUrl: text("photo_url").notNull(),
  fileKey: text("file_key").notNull(),
  caption: text("caption"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var customExercises = pgTable("custom_exercises", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  nameZh: text("name_zh").default(""),
  muscleGroup: text("muscle_group").notNull().default("other"),
  equipment: text("equipment").notNull().default("Other"),
  instructions: text("instructions").default(""),
  photoUrl: text("photo_url"),
  fileKey: text("file_key"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  supabaseUrl: process.env.SUPABASE_URL ?? "https://awvpavxgsikzmmrwspqp.supabase.co",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
};

// server/db.ts
var OWNER_EMAIL = "kingsleytsemc314@gmail.com";
var { Pool } = pg;
var _db = null;
var _pool = null;
async function getDb() {
  if (_db) return _db;
  const connStr = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
  if (!connStr) return null;
  if (connStr.startsWith("postgresql://") || connStr.startsWith("postgres://")) {
    try {
      _pool = new Pool({
        connectionString: connStr,
        ssl: { rejectUnauthorized: false },
        max: 5
      });
      _db = drizzle(_pool);
      console.log("[Database] Connected to Supabase PostgreSQL");
    } catch (error) {
      console.warn("[Database] Failed to connect to PostgreSQL:", error);
      _db = null;
    }
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const isOwnerEmail = user.email && user.email.toLowerCase() === OWNER_EMAIL.toLowerCase();
    const isOwnerOpenId = user.openId === ENV.ownerOpenId;
    if (isOwnerEmail || isOwnerOpenId) {
      let existingOwner = await db.select().from(users).where(eq(users.email, OWNER_EMAIL)).limit(1).then((r) => r[0] ?? null);
      if (!existingOwner && ENV.ownerOpenId) {
        existingOwner = await db.select().from(users).where(eq(users.openId, ENV.ownerOpenId)).limit(1).then((r) => r[0] ?? null);
      }
      if (existingOwner) {
        await db.update(users).set({
          openId: user.openId,
          // bind this provider's openId to the owner row
          name: user.name ?? existingOwner.name,
          email: OWNER_EMAIL,
          loginMethod: user.loginMethod ?? existingOwner.loginMethod,
          lastSignedIn: /* @__PURE__ */ new Date(),
          role: "admin"
        }).where(eq(users.id, existingOwner.id));
        console.log(`[Auth] Owner account merged: openId=${user.openId} \u2192 user.id=${existingOwner.id}`);
        return;
      } else {
        await db.insert(users).values({
          openId: user.openId,
          name: user.name ?? null,
          email: OWNER_EMAIL,
          loginMethod: user.loginMethod ?? null,
          lastSignedIn: /* @__PURE__ */ new Date(),
          role: "admin"
        }).onConflictDoUpdate({
          target: users.openId,
          set: { email: OWNER_EMAIL, role: "admin", lastSignedIn: /* @__PURE__ */ new Date() }
        });
        console.log(`[Auth] Owner account created: openId=${user.openId}`);
        return;
      }
    }
    const values = { openId: user.openId };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod"];
    const assignNullable = (field) => {
      const value = user[field];
      if (value === void 0) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== void 0) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== void 0) {
      values.role = user.role;
      updateSet.role = user.role;
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = /* @__PURE__ */ new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = /* @__PURE__ */ new Date();
    }
    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return void 0;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    const redirectUri = atob(state);
    return redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    if (session.openId.startsWith(CRON_OPEN_ID_PREFIX)) {
      const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
      const taskUid = userInfo.taskUid ?? null;
      if (!taskUid) {
        throw ForbiddenError("Cron session missing task_uid");
      }
      return buildCronUser(userInfo);
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var CRON_OPEN_ID_PREFIX = "cron_";
function buildCronUser(userInfo) {
  const now = /* @__PURE__ */ new Date();
  return {
    id: -1,
    openId: userInfo.openId,
    name: userInfo.name || "Manus Scheduled Task",
    email: null,
    loginMethod: null,
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    taskUid: userInfo.taskUid ?? void 0,
    isCron: true
  };
}
var sdk = new SDKServer();

// server/_core/supabase.ts
import { createClient } from "@supabase/supabase-js";
var supabaseAdmin = createClient(ENV.supabaseUrl, ENV.supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});
async function verifySupabaseToken(accessToken) {
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email };
  } catch {
    return null;
  }
}

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function decodeState(state) {
  try {
    const decoded = atob(state);
    try {
      const parsed = JSON.parse(decoded);
      if (parsed.redirectUri) return parsed;
    } catch {
    }
    return { redirectUri: decoded };
  } catch {
    return { redirectUri: state };
  }
}
function registerOAuthRoutes(app2) {
  app2.post("/api/auth/session", async (req, res) => {
    const { accessToken } = req.body;
    if (!accessToken) {
      res.status(400).json({ error: "accessToken is required" });
      return;
    }
    try {
      const supabaseUser = await verifySupabaseToken(accessToken);
      if (!supabaseUser) {
        res.status(401).json({ error: "Invalid Supabase access token" });
        return;
      }
      const email = supabaseUser.email ?? null;
      const supabaseId = supabaseUser.id;
      await upsertUser({
        openId: supabaseId,
        email,
        name: email?.split("@")[0] ?? null,
        loginMethod: "supabase",
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(supabaseId, {
        name: email?.split("@")[0] ?? "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.json({ ok: true });
    } catch (error) {
      console.error("[Auth] Supabase session exchange failed", error);
      res.status(500).json({ error: "Session exchange failed" });
    }
  });
  app2.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const { returnOrigin } = decodeState(state);
      if (returnOrigin) {
        const bridgeUrl = new URL("/api/oauth/bridge", returnOrigin);
        bridgeUrl.searchParams.set("token", sessionToken);
        res.redirect(302, bridgeUrl.toString());
        return;
      }
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
  app2.get("/api/oauth/bridge", async (req, res) => {
    const token = getQueryParam(req, "token");
    if (!token) {
      res.status(400).json({ error: "token is required" });
      return;
    }
    const session = await sdk.verifySession(token);
    if (!session) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }
    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
    res.redirect(302, "/");
  });
}

// server/_core/storageProxy.ts
function registerStorageProxy(app2) {
  app2.get("/manus-storage/*", async (req, res) => {
    const key = req.params[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }
    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/"
      );
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` }
      });
      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = await forgeResp.json();
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);
var ownerProcedure = adminProcedure;

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/routers.ts
import { z as z2 } from "zod";
import { eq as eq2, and, desc, gte, like, or, sql as sql2 } from "drizzle-orm";

// server/_core/llm.ts
var ensureArray = (value) => Array.isArray(value) ? value : [value];
var normalizeContentPart = (part) => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }
  if (part.type === "text") {
    return part;
  }
  if (part.type === "image_url") {
    return part;
  }
  if (part.type === "file_url") {
    return part;
  }
  throw new Error("Unsupported message content part");
};
var normalizeMessage = (message) => {
  const { role, name, tool_call_id } = message;
  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content).map((part) => typeof part === "string" ? part : JSON.stringify(part)).join("\n");
    return {
      role,
      name,
      tool_call_id,
      content
    };
  }
  const contentParts = ensureArray(message.content).map(normalizeContentPart);
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text
    };
  }
  return {
    role,
    name,
    content: contentParts
  };
};
var normalizeToolChoice = (toolChoice, tools) => {
  if (!toolChoice) return void 0;
  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }
  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }
    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }
    return {
      type: "function",
      function: { name: tools[0].function.name }
    };
  }
  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name }
    };
  }
  return toolChoice;
};
var resolveApiUrl = () => ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0 ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions` : "https://forge.manus.im/v1/chat/completions";
var assertApiKey = () => {
  if (!ENV.forgeApiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
};
var normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema
}) => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (explicitFormat.type === "json_schema" && !explicitFormat.json_schema?.schema) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }
  const schema = outputSchema || output_schema;
  if (!schema) return void 0;
  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }
  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...typeof schema.strict === "boolean" ? { strict: schema.strict } : {}
    }
  };
};
async function invokeLLM(params) {
  assertApiKey();
  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format
  } = params;
  const payload = {
    model: "gemini-2.5-flash",
    messages: messages.map(normalizeMessage)
  };
  if (tools && tools.length > 0) {
    payload.tools = tools;
  }
  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }
  payload.max_tokens = 32768;
  payload.thinking = {
    "budget_tokens": 128
  };
  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema
  });
  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }
  const response = await fetch(resolveApiUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.forgeApiKey}`
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} \u2013 ${errorText}`
    );
  }
  return await response.json();
}

// server/storage.ts
function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;
  if (!forgeUrl || !forgeKey) {
    throw new Error(
      "Storage config missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }
  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}
function normalizeKey(relKey) {
  return relKey.replace(/^\/+/, "");
}
function appendHashSuffix(relKey) {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}
async function storagePut(relKey, data, contentType = "application/octet-stream") {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const key = appendHashSuffix(normalizeKey(relKey));
  const presignUrl = new URL("v1/storage/presign/put", forgeUrl + "/");
  presignUrl.searchParams.set("path", key);
  const presignResp = await fetch(presignUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` }
  });
  if (!presignResp.ok) {
    const msg = await presignResp.text().catch(() => presignResp.statusText);
    throw new Error(`Storage presign failed (${presignResp.status}): ${msg}`);
  }
  const { url: s3Url } = await presignResp.json();
  if (!s3Url) throw new Error("Forge returned empty presign URL");
  const blob = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data], { type: contentType });
  const uploadResp = await fetch(s3Url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob
  });
  if (!uploadResp.ok) {
    throw new Error(`Storage upload to S3 failed (${uploadResp.status})`);
  }
  return { key, url: `/manus-storage/${key}` };
}
async function storageGetSignedUrl(relKey) {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const key = normalizeKey(relKey);
  const getUrl = new URL("v1/storage/presign/get", forgeUrl + "/");
  getUrl.searchParams.set("path", key);
  const resp = await fetch(getUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` }
  });
  if (!resp.ok) {
    const msg = await resp.text().catch(() => resp.statusText);
    throw new Error(`Storage signed URL failed (${resp.status}): ${msg}`);
  }
  const { url } = await resp.json();
  return url;
}

// server/routers.ts
import { nanoid } from "nanoid";

// server/hkTime.ts
var HK_OFFSET_MS = 8 * 60 * 60 * 1e3;
function todayHK() {
  const now = /* @__PURE__ */ new Date();
  const hkNow = new Date(now.getTime() + HK_OFFSET_MS);
  return hkNow.toISOString().slice(0, 10);
}
function daysAgoHK(days) {
  const now = /* @__PURE__ */ new Date();
  const hkNow = new Date(now.getTime() + HK_OFFSET_MS - days * 24 * 60 * 60 * 1e3);
  return hkNow.toISOString().slice(0, 10);
}
function toHKDateString(date2) {
  const hkDate = new Date(date2.getTime() + HK_OFFSET_MS);
  return hkDate.toISOString().slice(0, 10);
}

// server/csvImport.ts
function normalizeKey2(k) {
  return k.toLowerCase().replace(/[^a-z0-9]/g, "");
}
function parseDate(raw) {
  if (!raw) return null;
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const [, a, b, year] = slashMatch;
    const month = a.padStart(2, "0");
    const day = b.padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const isoMatch = s.match(/^(\d{4}-\d{2}-\d{2})T/);
  if (isoMatch) return isoMatch[1];
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  return null;
}
function toNum(v) {
  if (v === void 0 || v === null || v.trim() === "" || v.trim() === "--") return void 0;
  const n = parseFloat(v.replace(/,/g, ""));
  return isNaN(n) ? void 0 : n;
}
function toSleepQuality(score) {
  if (score === void 0) return void 0;
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  return "Poor";
}
function parseBodyRow(row) {
  const keys = {};
  for (const [k, v] of Object.entries(row)) {
    keys[normalizeKey2(k)] = v;
  }
  const rawDate = keys["date"] || keys["weightdate"] || keys["calendardate"] || keys["datetime"] || keys["time"];
  const date2 = rawDate ? parseDate(rawDate) : null;
  if (!date2) return null;
  return {
    date: date2,
    weight: toNum(keys["weight"] ?? keys["weightkg"] ?? keys["weightlbs"]),
    bmi: toNum(keys["bmi"]),
    bodyFatPct: toNum(keys["bodyfat"] ?? keys["bodyfatpct"] ?? keys["fatpercent"] ?? keys["fat"]),
    muscleMass: toNum(keys["skeletalmusclemass"] ?? keys["musclemass"] ?? keys["muscle"] ?? keys["leanmass"]),
    fatMass: toNum(keys["fatmass"]),
    bmr: toNum(keys["bmr"] ?? keys["basalmetabolicrate"]),
    visceralFat: toNum(keys["visceralfat"] ?? keys["visceralfatrating"])
  };
}
function parseSleepRow(row) {
  const keys = {};
  for (const [k, v] of Object.entries(row)) {
    keys[normalizeKey2(k)] = v;
  }
  const rawDate = keys["date"] ?? keys["calendardate"] ?? keys["datetime"];
  const date2 = rawDate ? parseDate(rawDate) : null;
  if (!date2) return null;
  const sleepScore = toNum(keys["sleepscore"] ?? keys["score"] ?? keys["sleepquality"]);
  const rawQuality = keys["quality"] ?? keys["sleepqualitylabel"];
  let sleepQuality;
  if (rawQuality) {
    const q = rawQuality.trim();
    if (["Poor", "Fair", "Good", "Excellent"].includes(q)) {
      sleepQuality = q;
    }
  }
  if (!sleepQuality && sleepScore !== void 0) {
    sleepQuality = toSleepQuality(sleepScore);
  }
  let sleepDuration = toNum(keys["duration"] ?? keys["sleepduration"] ?? keys["totalsleephours"] ?? keys["sleephours"]);
  if (sleepDuration !== void 0 && sleepDuration > 24) {
    sleepDuration = sleepDuration / 60;
  }
  let deepSleep = toNum(keys["deepsleep"] ?? keys["deepsleepduration"] ?? keys["deepsleepmins"] ?? keys["deepsleepminhours"]);
  if (deepSleep !== void 0 && deepSleep > 24) deepSleep = deepSleep / 60;
  let remSleep = toNum(keys["remsleep"] ?? keys["remsleepduration"] ?? keys["remsleepmins"]);
  if (remSleep !== void 0 && remSleep > 24) remSleep = remSleep / 60;
  let lightSleep = toNum(keys["lightsleep"] ?? keys["lightsleepduration"] ?? keys["lightsleepmins"]);
  if (lightSleep !== void 0 && lightSleep > 24) lightSleep = lightSleep / 60;
  let awakeDuration = toNum(keys["awake"] ?? keys["awakeduration"] ?? keys["awakemins"] ?? keys["awakenings"]);
  if (awakeDuration !== void 0 && awakeDuration > 24) awakeDuration = awakeDuration / 60;
  return {
    date: date2,
    sleepScore,
    sleepDuration,
    deepSleep,
    remSleep,
    lightSleep,
    awakeDuration,
    bodyBattery: toNum(keys["bodybattery"] ?? keys["bodybatteryend"]),
    pulseOx: toNum(keys["pulseox"] ?? keys["spo2"] ?? keys["bloodoxygen"]),
    respiration: toNum(keys["respiration"] ?? keys["breathingrate"] ?? keys["avgrespirationrate"]),
    sleepQuality,
    restingHr: toNum(keys["restinghr"] ?? keys["restingheartrate"] ?? keys["avgrestinghr"]),
    hrv: toNum(keys["hrv"] ?? keys["heartratevariability"] ?? keys["hrvscore"] ?? keys["avghrv"])
  };
}
function parseHeartRateRow(row) {
  const keys = {};
  for (const [k, v] of Object.entries(row)) {
    keys[normalizeKey2(k)] = v;
  }
  const rawDate = keys["date"] ?? keys["calendardate"] ?? keys["datetime"];
  const date2 = rawDate ? parseDate(rawDate) : null;
  if (!date2) return null;
  return {
    date: date2,
    restingHr: toNum(keys["restinghr"] ?? keys["restingheartrate"] ?? keys["restingbpm"] ?? keys["minheartratebeatsperminute"]),
    highHr: toNum(keys["highhr"] ?? keys["maxhr"] ?? keys["maxheartrate"] ?? keys["maxheartratebeatsperminute"] ?? keys["peakhr"]),
    avgHr: toNum(keys["avghr"] ?? keys["averageheartrate"] ?? keys["averageheartratebeatsperminute"]),
    hrv: toNum(keys["hrv"] ?? keys["lastnightavg"] ?? keys["heartratevariability"] ?? keys["sdnn"])
  };
}
function parseWorkoutRow(row) {
  const keys = {};
  for (const [k, v] of Object.entries(row)) {
    keys[normalizeKey2(k)] = v;
  }
  const rawDate = keys["date"] ?? keys["startdate"] ?? keys["datetime"] ?? keys["calendardate"];
  const date2 = rawDate ? parseDate(rawDate) : null;
  if (!date2) return null;
  const activityType = (keys["activitytype"] ?? keys["type"] ?? keys["workoutactivitytype"] ?? keys["sport"])?.trim();
  const activityName = (keys["title"] ?? keys["activityname"] ?? keys["name"] ?? keys["workoutname"])?.trim();
  let durationMinutes;
  const rawDuration = keys["time"] ?? keys["duration"] ?? keys["durationinseconds"] ?? keys["durationminutes"] ?? keys["elapsedtime"];
  if (rawDuration) {
    const hhmmss = rawDuration.match(/^(\d+):(\d{2}):(\d{2})$/);
    if (hhmmss) {
      durationMinutes = parseInt(hhmmss[1]) * 60 + parseInt(hhmmss[2]) + parseInt(hhmmss[3]) / 60;
    } else {
      const n = toNum(rawDuration);
      if (n !== void 0) {
        durationMinutes = n > 300 ? n / 60 : n;
      }
    }
  }
  let distanceKm;
  const rawDist = keys["distance"] ?? keys["distanceinmeters"] ?? keys["distancekm"];
  if (rawDist) {
    const n = toNum(rawDist);
    if (n !== void 0) {
      distanceKm = n > 500 ? n / 1e3 : n;
    }
  }
  return {
    date: date2,
    activityType,
    activityName,
    durationMinutes: durationMinutes !== void 0 ? Math.round(durationMinutes) : void 0,
    calories: toNum(keys["calories"] ?? keys["activekilocalories"] ?? keys["totalenergyburned"]),
    avgHr: toNum(keys["avghr"] ?? keys["averageheartrate"] ?? keys["averageheartratebeatsperminute"]),
    maxHr: toNum(keys["maxhr"] ?? keys["maxheartrate"] ?? keys["maxheartratebeatsperminute"]),
    distanceKm,
    notes: (keys["notes"] ?? keys["description"] ?? "")?.trim() || void 0
  };
}
function parseNutritionRow(row) {
  const keys = {};
  for (const [k, v] of Object.entries(row)) {
    keys[normalizeKey2(k)] = v;
  }
  const rawDate = keys["date"] ?? keys["datetime"] ?? keys["day"] ?? keys["calendardate"];
  const date2 = rawDate ? parseDate(rawDate) : null;
  if (!date2) return null;
  const calories = toNum(
    keys["calories"] ?? keys["kcal"] ?? keys["energy"] ?? keys["totalcalories"] ?? keys["energykcal"] ?? keys["calorieskcal"]
  );
  const protein = toNum(
    keys["protein"] ?? keys["proteing"] ?? keys["proteingrams"] ?? keys["totalprotein"]
  );
  const carbs = toNum(
    keys["carbs"] ?? keys["carbohydrates"] ?? keys["carbohydratesg"] ?? keys["totalcarbs"] ?? keys["netcarbs"]
  );
  const fat = toNum(
    keys["fat"] ?? keys["totalfat"] ?? keys["fatg"] ?? keys["fatgrams"]
  );
  const fiber = toNum(keys["fiber"] ?? keys["dietaryfiber"] ?? keys["fibeg"]);
  if (calories === void 0 && protein === void 0) return null;
  const mealType = (keys["meal"] ?? keys["mealtype"] ?? keys["mealname"] ?? keys["category"])?.trim()?.toLowerCase() ?? "snack";
  const foodName = (keys["food"] ?? keys["foodname"] ?? keys["name"] ?? keys["item"] ?? keys["description"])?.trim();
  return {
    date: date2,
    mealType,
    foodName: foodName || "Imported Entry",
    calories,
    protein,
    carbs,
    fat,
    fiber,
    servings: toNum(keys["servings"] ?? keys["quantity"] ?? keys["amount"]) ?? 1
  };
}
function parseRunningRow(row) {
  const keys = {};
  for (const [k, v] of Object.entries(row)) {
    keys[normalizeKey2(k)] = v;
  }
  const rawDate = keys["date"] ?? keys["calendardate"] ?? keys["datetime"] ?? keys["starttime"];
  const date2 = rawDate ? parseDate(rawDate) : null;
  if (!date2) return null;
  const actType = (keys["activitytype"] ?? keys["type"] ?? keys["sport"] ?? "").toLowerCase();
  const runningKeywords = ["running", "run", "trail", "race", "jogging", "treadmill"];
  if (actType && !runningKeywords.some((k) => actType.includes(k))) return null;
  let hour;
  let minutes;
  let second;
  const rawTime = keys["time"] ?? keys["duration"] ?? keys["durationinseconds"];
  if (rawTime) {
    const hmsMatch = rawTime.match(/(\d+):(\d{2}):(\d{2})/);
    if (hmsMatch) {
      hour = parseInt(hmsMatch[1]);
      minutes = parseInt(hmsMatch[2]);
      second = parseInt(hmsMatch[3]);
    } else {
      const secs = parseFloat(rawTime);
      if (!isNaN(secs) && secs > 0) {
        hour = Math.floor(secs / 3600);
        minutes = Math.floor(secs % 3600 / 60);
        second = Math.round(secs % 60);
      }
    }
  }
  let distanceKm = toNum(keys["distance"] ?? keys["distancekm"] ?? keys["distancemiles"]);
  if (distanceKm !== void 0) {
    if (distanceKm > 500) distanceKm = distanceKm / 1e3;
  }
  let averagePace;
  const rawPace = keys["avgpace"] ?? keys["averagepace"] ?? keys["pace"];
  if (rawPace && rawPace !== "--") {
    const paceMatch = rawPace.match(/(\d+):(\d{2})/);
    if (paceMatch) {
      const decPace = parseInt(paceMatch[1]) + parseInt(paceMatch[2]) / 60;
      averagePace = decPace.toFixed(4);
    } else {
      const n = parseFloat(rawPace);
      if (!isNaN(n)) averagePace = String(n);
    }
  }
  let bestPace;
  const rawBest = keys["bestpace"] ?? keys["fastestpace"];
  if (rawBest && rawBest !== "--") {
    bestPace = rawBest.trim();
  }
  const avgCadence = toNum(keys["avgcadence"] ?? keys["avgruncadence"] ?? keys["averagecadence"] ?? keys["cadence"]);
  const maxCadence = toNum(keys["maxcadence"] ?? keys["maxruncadence"]);
  const avgStrideLengthM = toNum(keys["avgstridelength"] ?? keys["averagestridelength"] ?? keys["avgstridelengthmeter"]);
  const avgVerticalRatio = toNum(keys["avgverticalratio"] ?? keys["verticalratio"]);
  const verticalOscillationCm = toNum(keys["avgverticaloscillation"] ?? keys["verticaloscillation"] ?? keys["avgverticaloscillationcm"]);
  const avgGroundContactTimeMs = toNum(keys["avggroundcontacttime"] ?? keys["groundcontacttime"]);
  let runningType;
  const title = (keys["title"] ?? keys["activityname"] ?? "").toLowerCase();
  if (title.includes("interval") || title.includes("track")) runningType = "Interval";
  else if (title.includes("tempo") || title.includes("threshold")) runningType = "Tempo";
  else if (title.includes("long") || title.includes("lsd")) runningType = "Long Run";
  else if (title.includes("race") || title.includes("competition")) runningType = "Race";
  else if (title.includes("trail")) runningType = "Trail";
  else if (title.includes("recovery") || title.includes("easy")) runningType = "Easy";
  else if (actType.includes("trail")) runningType = "Trail";
  return {
    date: date2,
    runningType,
    distanceKm,
    hour,
    minutes,
    second,
    averagePace,
    bestPace,
    averageHeartRate: toNum(keys["avghr"] ?? keys["averageheartrate"] ?? keys["heartrateavg"]) !== void 0 ? Math.round(toNum(keys["avghr"] ?? keys["averageheartrate"] ?? keys["heartrateavg"])) : void 0,
    maximumHeartRate: toNum(keys["maxhr"] ?? keys["maximumheartrate"] ?? keys["heartratemax"]) !== void 0 ? Math.round(toNum(keys["maxhr"] ?? keys["maximumheartrate"] ?? keys["heartratemax"])) : void 0,
    averageCadence: avgCadence,
    maxCadence,
    avgStrideLengthM,
    avgVerticalRatio,
    verticalOscillationCm,
    avgGroundContactTimeMs,
    calories: toNum(keys["calories"] ?? keys["activekilocalories"] ?? keys["totalcalories"]) !== void 0 ? Math.round(toNum(keys["calories"] ?? keys["activekilocalories"] ?? keys["totalcalories"])) : void 0,
    temperature: toNum(keys["mintemp"] ?? keys["temperature"] ?? keys["avgtemperature"]),
    humidity: toNum(keys["humidity"]),
    notes: keys["title"] ?? void 0
  };
}
function detectDataType(headers) {
  const normalized = headers.map(normalizeKey2);
  const has = (k) => normalized.includes(k);
  const hasAny = (...ks) => ks.some((k) => normalized.includes(k));
  if (hasAny("sleepscore", "score", "deepsleep", "remsleep", "sleepduration", "bodybattery")) {
    return "sleep";
  }
  if (hasAny("restinghr", "restingheartrate", "hrv", "lastnightavg", "heartratevariability")) {
    return "heartrate";
  }
  if (hasAny("activitytype", "workoutactivitytype") && hasAny("avgruncadence", "avgcadence", "avgpace", "bestpace", "avgstridelength", "avgverticalratio")) {
    return "running";
  }
  if (hasAny("activitytype", "workoutactivitytype", "sport") || hasAny("calories", "activekilocalories") && hasAny("time", "duration", "durationinseconds")) {
    return "workout";
  }
  if (hasAny("calories", "kcal", "energy", "totalcalories") && hasAny("protein", "carbs", "carbohydrates", "fat")) {
    if (!hasAny("activitytype", "workoutactivitytype", "sport")) {
      return "nutrition";
    }
  }
  if (hasAny("weight", "weightkg", "bmi", "bodyfat", "bodyfatpct", "skeletalmusclemass", "musclemass")) {
    return "body";
  }
  return null;
}
function parseRows(rows, type) {
  const results = [];
  for (const row of rows) {
    let parsed = null;
    if (type === "body") parsed = parseBodyRow(row);
    else if (type === "sleep") parsed = parseSleepRow(row);
    else if (type === "heartrate") parsed = parseHeartRateRow(row);
    else if (type === "workout") parsed = parseWorkoutRow(row);
    else if (type === "nutrition") parsed = parseNutritionRow(row);
    else if (type === "running") parsed = parseRunningRow(row);
    if (parsed) results.push(parsed);
  }
  return results;
}

// server/routers.ts
import Papa from "papaparse";
var OWNER_USER_ID = 2;
var nutritionRouter = router({
  // Search food database
  searchFoods: publicProcedure.input(z2.object({ query: z2.string().min(1) })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(foodItems).where(or(like(foodItems.name, `%${input.query}%`), like(foodItems.nameZh, `%${input.query}%`))).limit(20);
  }),
  // Get meal logs for a date
  getMealLogs: publicProcedure.input(z2.object({ date: z2.string() })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return [];
    const hkMidnight = (dateStr, endOfDay = false) => {
      const [y, m, d] = dateStr.split("-").map(Number);
      const utcMs = Date.UTC(y, m - 1, d) - 8 * 3600 * 1e3;
      return new Date(endOfDay ? utcMs + 864e5 - 1 : utcMs);
    };
    return db.select().from(mealLogs).where(and(eq2(mealLogs.userId, OWNER_USER_ID), sql2`${mealLogs.loggedAt} >= ${hkMidnight(input.date)}`, sql2`${mealLogs.loggedAt} < ${hkMidnight(input.date, true)}`)).orderBy(mealLogs.createdAt);
  }),
  // Get meal logs for date range
  getMealLogsRange: publicProcedure.input(z2.object({ startDate: z2.string(), endDate: z2.string() })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return [];
    const hkMidnight = (dateStr, endOfDay = false) => {
      const [y, m, d] = dateStr.split("-").map(Number);
      const utcMs = Date.UTC(y, m - 1, d) - 8 * 3600 * 1e3;
      return new Date(endOfDay ? utcMs + 864e5 - 1 : utcMs);
    };
    return db.select().from(mealLogs).where(and(
      eq2(mealLogs.userId, OWNER_USER_ID),
      sql2`${mealLogs.loggedAt} >= ${hkMidnight(input.startDate)}`,
      sql2`${mealLogs.loggedAt} < ${hkMidnight(input.endDate, true)}`
    )).orderBy(desc(mealLogs.loggedAt));
  }),
  // Add meal log
  addMealLog: publicProcedure.input(z2.object({
    date: z2.string(),
    mealType: z2.enum(["breakfast", "lunch", "dinner", "snack"]),
    foodName: z2.string(),
    foodItemId: z2.number().optional(),
    quantity: z2.number(),
    calories: z2.number(),
    protein: z2.number(),
    carbs: z2.number(),
    fat: z2.number(),
    fiber: z2.number().optional(),
    notes: z2.string().optional(),
    photoUrl: z2.string().optional(),
    aiAnalyzed: z2.boolean().optional()
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.insert(mealLogs).values({ ...input, userId: OWNER_USER_ID });
    return { success: true };
  }),
  // Update meal log
  updateMealLog: ownerProcedure.input(z2.object({
    id: z2.number(),
    foodName: z2.string().optional(),
    quantity: z2.number().optional(),
    calories: z2.number().optional(),
    protein: z2.number().optional(),
    carbs: z2.number().optional(),
    fat: z2.number().optional(),
    notes: z2.string().optional(),
    mealType: z2.enum(["breakfast", "lunch", "dinner", "snack"]).optional()
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const { id, ...data } = input;
    await db.update(mealLogs).set(data).where(and(eq2(mealLogs.id, id), eq2(mealLogs.userId, OWNER_USER_ID)));
    return { success: true };
  }),
  // Delete meal log
  deleteMealLog: ownerProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.delete(mealLogs).where(and(eq2(mealLogs.id, input.id), eq2(mealLogs.userId, OWNER_USER_ID)));
    return { success: true };
  }),
  // AI food photo analysis
  analyzeFoodPhoto: ownerProcedure.input(z2.object({ imageUrl: z2.string(), imageBase64: z2.string().optional() })).mutation(async ({ input }) => {
    let resolvedImageUrl = input.imageUrl;
    if (input.imageUrl.startsWith("/manus-storage/")) {
      const key = input.imageUrl.replace("/manus-storage/", "");
      try {
        resolvedImageUrl = await storageGetSignedUrl(key);
      } catch (e) {
        console.error("[analyzeFoodPhoto] Failed to get signed URL:", e);
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
              type: "image_url",
              image_url: { url: resolvedImageUrl, detail: "high" }
            },
            {
              type: "text",
              text: `Identify all food items visible in this image and estimate their nutritional content. Provide the response as JSON with this exact structure: {"foods":[{"name":"Food Name","nameZh":"\u98DF\u7269\u4E2D\u6587\u540D","quantity":150,"unit":"g","calories":250,"protein":15,"carbs":30,"fat":8,"fiber":2}],"totalCalories":250,"totalProtein":15,"totalCarbs":30,"totalFat":8,"confidence":"high","notes":"Brief description"}`
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
  uploadFoodPhoto: ownerProcedure.input(z2.object({ base64: z2.string(), mimeType: z2.string() })).mutation(async ({ ctx, input }) => {
    const buffer = Buffer.from(input.base64, "base64");
    const key = `food-photos/${OWNER_USER_ID}/${nanoid()}.jpg`;
    const { url } = await storagePut(key, buffer, input.mimeType);
    return { url, key };
  })
});
var workoutRouter = router({
  // Get all exercises (built-in + user's custom)
  getExercises: publicProcedure.input(z2.object({ muscleGroup: z2.string().optional() }).optional()).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return [];
    const conditions = [
      or(eq2(exercises.isCustom, false), eq2(exercises.userId, OWNER_USER_ID))
    ];
    if (input?.muscleGroup) {
      conditions.push(eq2(exercises.muscleGroup, input.muscleGroup));
    }
    return db.select().from(exercises).where(and(...conditions)).orderBy(exercises.name);
  }),
  // Add custom exercise
  addExercise: ownerProcedure.input(z2.object({
    name: z2.string(),
    nameZh: z2.string().optional(),
    muscleGroup: z2.string(),
    equipment: z2.string().optional(),
    instructions: z2.string().optional()
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.insert(exercises).values({ ...input, isCustom: true, userId: OWNER_USER_ID });
    return { success: true };
  }),
  // Get workout sessions
  getSessions: publicProcedure.input(z2.object({ startDate: z2.string().optional(), endDate: z2.string().optional() }).optional()).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return [];
    const conditions = [eq2(workoutSessions.userId, OWNER_USER_ID)];
    if (input?.startDate) conditions.push(sql2`${workoutSessions.startTime} >= ${/* @__PURE__ */ new Date(input.startDate + "T00:00:00+08:00")}`);
    if (input?.endDate) conditions.push(sql2`${workoutSessions.startTime} <= ${/* @__PURE__ */ new Date(input.endDate + "T23:59:59+08:00")}`);
    return db.select().from(workoutSessions).where(and(...conditions)).orderBy(desc(workoutSessions.startTime));
  }),
  // Get session with sets
  getSessionWithSets: publicProcedure.input(z2.object({ sessionId: z2.number() })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return null;
    const sessions = await db.select().from(workoutSessions).where(and(eq2(workoutSessions.id, input.sessionId), eq2(workoutSessions.userId, OWNER_USER_ID))).limit(1);
    if (!sessions[0]) return null;
    const sets = await db.select().from(workoutSets).where(eq2(workoutSets.sessionId, input.sessionId)).orderBy(workoutSets.exerciseName, workoutSets.setNumber);
    return { session: sessions[0], sets };
  }),
  // Get calories burned for a specific date (for daily net calorie calculation)
  getDailyCaloriesBurned: publicProcedure.input(z2.object({ date: z2.string() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { caloriesBurned: 0, sessions: [] };
    const dayStart = /* @__PURE__ */ new Date(input.date + "T00:00:00+08:00");
    const dayEnd = /* @__PURE__ */ new Date(input.date + "T23:59:59+08:00");
    const sessions = await db.select({
      id: workoutSessions.id,
      name: workoutSessions.name,
      duration: workoutSessions.duration,
      caloriesBurned: workoutSessions.caloriesBurned,
      totalVolume: workoutSessions.totalVolume,
      startTime: workoutSessions.startTime
    }).from(workoutSessions).where(and(
      eq2(workoutSessions.userId, OWNER_USER_ID),
      sql2`${workoutSessions.startTime} >= ${dayStart}`,
      sql2`${workoutSessions.startTime} <= ${dayEnd}`
    )).orderBy(desc(workoutSessions.startTime));
    const caloriesBurned = sessions.reduce((sum, s) => sum + (s.caloriesBurned ?? 0), 0);
    return { caloriesBurned, sessions };
  }),
  // Create workout session
  createSession: ownerProcedure.input(z2.object({
    date: z2.string(),
    name: z2.string().optional(),
    duration: z2.number().optional(),
    notes: z2.string().optional()
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const result = await db.insert(workoutSessions).values({ ...input, userId: OWNER_USER_ID }).returning({ id: workoutSessions.id });
    return { success: true, id: result[0]?.id ?? 0 };
  }),
  // Update session
  updateSession: ownerProcedure.input(z2.object({
    id: z2.number(),
    name: z2.string().optional(),
    duration: z2.number().optional(),
    notes: z2.string().optional(),
    totalVolume: z2.number().optional()
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const { id, ...data } = input;
    await db.update(workoutSessions).set(data).where(and(eq2(workoutSessions.id, id), eq2(workoutSessions.userId, OWNER_USER_ID)));
    return { success: true };
  }),
  // Delete session
  deleteSession: ownerProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.delete(workoutSets).where(eq2(workoutSets.sessionId, input.id));
    await db.delete(workoutSessions).where(and(eq2(workoutSessions.id, input.id), eq2(workoutSessions.userId, OWNER_USER_ID)));
    return { success: true };
  }),
  // Add workout set
  addSet: ownerProcedure.input(z2.object({
    sessionId: z2.number(),
    exerciseId: z2.number().optional().nullable(),
    exerciseName: z2.string(),
    setNumber: z2.number(),
    reps: z2.number().optional(),
    weight: z2.number().optional(),
    duration: z2.number().optional(),
    distance: z2.number().optional(),
    notes: z2.string().optional()
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const { exerciseId, ...rest } = input;
    await db.execute(sql2`
        INSERT INTO workout_sets ("sessionId", "exerciseId", "exerciseName", "setNumber", reps, weight, duration, distance, notes)
        VALUES (${rest.sessionId}, ${exerciseId ?? null}, ${rest.exerciseName}, ${rest.setNumber}, ${rest.reps ?? null}, ${rest.weight ?? null}, ${rest.duration ?? null}, ${rest.distance ?? null}, ${rest.notes ?? null})
      `);
    const volumeResult = await db.execute(sql2`
        SELECT COALESCE(SUM(reps * weight), 0) as total
        FROM workout_sets
        WHERE "sessionId" = ${rest.sessionId} AND reps IS NOT NULL AND weight IS NOT NULL
      `);
    const newVolume = Number((volumeResult.rows?.[0] ?? volumeResult[0])?.total ?? 0);
    await db.update(workoutSessions).set({ totalVolume: newVolume, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(workoutSessions.id, rest.sessionId));
    return { success: true, totalVolume: newVolume };
  }),
  // Update set
  updateSet: ownerProcedure.input(z2.object({
    id: z2.number(),
    reps: z2.number().optional(),
    weight: z2.number().optional(),
    duration: z2.number().optional(),
    notes: z2.string().optional()
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const { id, ...data } = input;
    await db.update(workoutSets).set(data).where(eq2(workoutSets.id, id));
    return { success: true };
  }),
  // Delete set
  deleteSet: ownerProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.delete(workoutSets).where(eq2(workoutSets.id, input.id));
    return { success: true };
  }),
  // ─── Exercise Favourites ────────────────────────────────────────────────────────────
  getFavourites: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.execute(sql2`
        SELECT exercise_name FROM favourite_exercises
        WHERE "userId" = ${OWNER_USER_ID}
        ORDER BY "createdAt" DESC
      `);
    return (rows.rows ?? rows).map((r) => r.exercise_name);
  }),
  toggleFavourite: ownerProcedure.input(z2.object({ exerciseName: z2.string().min(1) })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const existing = await db.execute(sql2`
        SELECT id FROM favourite_exercises
        WHERE "userId" = ${OWNER_USER_ID} AND exercise_name = ${input.exerciseName}
      `);
    const rows = existing.rows ?? existing;
    if (rows.length > 0) {
      await db.execute(sql2`
          DELETE FROM favourite_exercises
          WHERE "userId" = ${OWNER_USER_ID} AND exercise_name = ${input.exerciseName}
        `);
      return { isFavourite: false };
    } else {
      await db.execute(sql2`
          INSERT INTO favourite_exercises ("userId", exercise_name)
          VALUES (${OWNER_USER_ID}, ${input.exerciseName})
        `);
      return { isFavourite: true };
    }
  }),
  // ── Custom Exercises ──────────────────────────────────────────────────────
  getCustomExercises: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(customExercises).where(eq2(customExercises.userId, OWNER_USER_ID)).orderBy(desc(customExercises.createdAt));
  }),
  createCustomExercise: ownerProcedure.input(z2.object({
    name: z2.string().min(1).max(200),
    nameZh: z2.string().max(200).optional(),
    muscleGroup: z2.string().min(1),
    equipment: z2.string().min(1),
    instructions: z2.string().optional(),
    photoBase64: z2.string().optional(),
    photoMimeType: z2.string().optional()
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    let photoUrl;
    let fileKey;
    if (input.photoBase64 && input.photoMimeType) {
      const buf = Buffer.from(input.photoBase64, "base64");
      const ext = input.photoMimeType.split("/")[1] ?? "jpg";
      fileKey = `custom-exercises/${OWNER_USER_ID}-${nanoid(8)}.${ext}`;
      const stored = await storagePut(fileKey, buf, input.photoMimeType);
      photoUrl = stored.url;
    }
    const [row] = await db.insert(customExercises).values({
      userId: OWNER_USER_ID,
      name: input.name,
      nameZh: input.nameZh ?? "",
      muscleGroup: input.muscleGroup,
      equipment: input.equipment,
      instructions: input.instructions ?? "",
      photoUrl,
      fileKey
    }).returning();
    return row;
  }),
  deleteCustomExercise: ownerProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.delete(customExercises).where(and(eq2(customExercises.id, input.id), eq2(customExercises.userId, OWNER_USER_ID)));
    return { success: true };
  }),
  // Finish session: set endTime and auto-calculate duration in minutes
  finishSession: ownerProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const rows = await db.select().from(workoutSessions).where(and(eq2(workoutSessions.id, input.id), eq2(workoutSessions.userId, OWNER_USER_ID))).limit(1);
    if (!rows.length) throw new Error("Session not found");
    const session = rows[0];
    const endTime = /* @__PURE__ */ new Date();
    const startTime = session.startTime ? new Date(session.startTime) : endTime;
    const durationMin = Math.max(1, Math.round((endTime.getTime() - startTime.getTime()) / 6e4));
    const volumeResult = await db.execute(sql2`
        SELECT COALESCE(SUM(reps * weight), 0) as total
        FROM workout_sets WHERE "sessionId" = ${input.id}
        AND reps IS NOT NULL AND weight IS NOT NULL
      `);
    const totalVolume = Number((volumeResult.rows?.[0] ?? volumeResult[0])?.total ?? 0);
    const met = totalVolume > 5e3 ? 6 : totalVolume > 2e3 ? 5.5 : 5;
    const caloriesBurned = Math.round(met * 70 * (durationMin / 60));
    await db.update(workoutSessions).set({ endTime, duration: durationMin, caloriesBurned, totalVolume }).where(eq2(workoutSessions.id, input.id));
    return { success: true, duration: durationMin, caloriesBurned };
  }),
  // AI exercise analysis: analyze user's past sets and return personalized recommendations
  analyzeExercise: ownerProcedure.input(z2.object({ exerciseName: z2.string() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const sets = await db.select({
      reps: workoutSets.reps,
      weight: workoutSets.weight,
      notes: workoutSets.notes,
      createdAt: workoutSets.createdAt
    }).from(workoutSets).innerJoin(workoutSessions, eq2(workoutSets.sessionId, workoutSessions.id)).where(and(
      eq2(workoutSessions.userId, OWNER_USER_ID),
      eq2(workoutSets.exerciseName, input.exerciseName)
    )).orderBy(desc(workoutSets.createdAt)).limit(30);
    if (sets.length === 0) {
      return {
        analysis: `\u5C1A\u672A\u627E\u5230\u300C${input.exerciseName}\u300D\u7684\u8A13\u7DF4\u8A18\u9304\u3002\u958B\u59CB\u8A18\u9304\u7D44\u6578\u5F8C\u5373\u53EF\u7372\u5F97\u500B\u4EBA\u5316\u5EFA\u8B70\uFF01`,
        recommendations: []
      };
    }
    const setsSummary = sets.map((s) => `Reps: ${s.reps ?? "-"}, Weight: ${s.weight ?? 0}kg${s.notes ? ", Notes: " + s.notes : ""}`).join("\n");
    const aiResponse = await invokeLLM({
      messages: [
        { role: "system", content: "You are an expert personal trainer and strength coach. Analyze training data and provide concise, actionable recommendations in Traditional Chinese (\u7E41\u9AD4\u4E2D\u6587). Be specific with numbers and percentages." },
        { role: "user", content: `Exercise: ${input.exerciseName}

Recent training sets (newest first, max 30):
${setsSummary}

Provide a brief trend analysis and exactly 3 specific recommendations covering: (1) progressive overload suggestion, (2) optimal rep/set scheme, (3) recovery or form tip. Return JSON only.` }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "exercise_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              analysis: { type: "string" },
              recommendations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    detail: { type: "string" },
                    type: { type: "string" }
                  },
                  required: ["title", "detail", "type"],
                  additionalProperties: false
                }
              }
            },
            required: ["analysis", "recommendations"],
            additionalProperties: false
          }
        }
      }
    });
    const rawMsg = aiResponse.choices[0]?.message?.content;
    const contentStr = typeof rawMsg === "string" ? rawMsg : '{"analysis":"","recommendations":[]}';
    return JSON.parse(contentStr);
  }),
  identifyExerciseFromPhoto: ownerProcedure.input(z2.object({ base64: z2.string(), mimeType: z2.string() })).mutation(async ({ input }) => {
    const imageUrl = `data:${input.mimeType};base64,${input.base64}`;
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are a fitness expert. Analyze the image and identify the exercise being performed or the gym equipment shown. Return structured JSON only."
        },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
            { type: "text", text: "Identify the exercise or equipment in this image. Return JSON with: name (English), nameZh (Chinese), muscleGroup (one of: chest, back, lats, shoulders, biceps, triceps, quads, hamstrings, glutes, calves, core, cardio, other), equipment (one of: Barbell, Dumbbell, Cable, Machine, Smith Machine, Kettlebell, Resistance Band, Bodyweight, TRX / Suspension, Pull-up Bar, Dip Bar, EZ Bar, Trap Bar, Plate, Foam Roller, Medicine Ball, Battle Rope, Cardio Machine, Other), instructions (brief 1-2 sentence description), confidence (high/medium/low)." }
          ]
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "exercise_identification",
          strict: true,
          schema: {
            type: "object",
            properties: {
              name: { type: "string" },
              nameZh: { type: "string" },
              muscleGroup: { type: "string" },
              equipment: { type: "string" },
              instructions: { type: "string" },
              confidence: { type: "string" }
            },
            required: ["name", "nameZh", "muscleGroup", "equipment", "instructions", "confidence"],
            additionalProperties: false
          }
        }
      }
    });
    const rawMsg = response.choices[0]?.message?.content;
    const contentStr = typeof rawMsg === "string" ? rawMsg : "{}";
    return JSON.parse(contentStr);
  })
});
var bodyRouter = router({
  getAll: publicProcedure.input(z2.object({ limit: z2.number().optional() }).optional()).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(bodyComposition).where(eq2(bodyComposition.userId, OWNER_USER_ID)).orderBy(desc(bodyComposition.date)).limit(input?.limit || 100);
  }),
  add: ownerProcedure.input(z2.object({
    date: z2.string(),
    weight: z2.number().optional(),
    bmi: z2.number().optional(),
    bodyFatPct: z2.number().optional(),
    fatMass: z2.number().optional(),
    muscleMass: z2.number().optional(),
    bmr: z2.number().optional(),
    visceralFat: z2.number().optional(),
    notes: z2.string().optional(),
    source: z2.string().optional()
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.insert(bodyComposition).values({ ...input, userId: OWNER_USER_ID });
    return { success: true };
  }),
  update: ownerProcedure.input(z2.object({
    id: z2.number(),
    date: z2.string().optional(),
    weight: z2.number().optional(),
    bmi: z2.number().optional(),
    bodyFatPct: z2.number().optional(),
    fatMass: z2.number().optional(),
    muscleMass: z2.number().optional(),
    bmr: z2.number().optional(),
    visceralFat: z2.number().optional(),
    notes: z2.string().optional()
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const { id, ...data } = input;
    await db.update(bodyComposition).set(data).where(and(eq2(bodyComposition.id, id), eq2(bodyComposition.userId, OWNER_USER_ID)));
    return { success: true };
  }),
  delete: ownerProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.delete(bodyComposition).where(and(eq2(bodyComposition.id, input.id), eq2(bodyComposition.userId, OWNER_USER_ID)));
    return { success: true };
  }),
  // Bulk import from Google Sheets
  bulkImport: ownerProcedure.input(z2.array(z2.object({
    date: z2.string(),
    weight: z2.number().optional(),
    bmi: z2.number().optional(),
    bodyFatPct: z2.number().optional(),
    fatMass: z2.number().optional(),
    muscleMass: z2.number().optional(),
    bmr: z2.number().optional(),
    visceralFat: z2.number().optional()
  }))).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    for (const row of input) {
      await db.insert(bodyComposition).values({ ...row, userId: OWNER_USER_ID, source: "sheets" }).onConflictDoNothing().catch(() => {
      });
    }
    return { success: true, count: input.length };
  })
});
var heartRateRouter = router({
  getAll: publicProcedure.input(z2.object({ limit: z2.number().optional() }).optional()).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(heartRateLogs).where(eq2(heartRateLogs.userId, OWNER_USER_ID)).orderBy(desc(heartRateLogs.date)).limit(input?.limit || 200);
  }),
  add: ownerProcedure.input(z2.object({
    date: z2.string(),
    restingHr: z2.number().optional(),
    highHr: z2.number().optional(),
    maxHr: z2.number().optional(),
    hrv: z2.number().optional(),
    notes: z2.string().optional(),
    source: z2.string().optional()
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.insert(heartRateLogs).values({ ...input, userId: OWNER_USER_ID });
    return { success: true };
  }),
  update: ownerProcedure.input(z2.object({
    id: z2.number(),
    date: z2.string().optional(),
    restingHr: z2.number().optional(),
    highHr: z2.number().optional(),
    hrv: z2.number().optional(),
    notes: z2.string().optional()
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const { id, ...data } = input;
    await db.update(heartRateLogs).set(data).where(and(eq2(heartRateLogs.id, id), eq2(heartRateLogs.userId, OWNER_USER_ID)));
    return { success: true };
  }),
  delete: ownerProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.delete(heartRateLogs).where(and(eq2(heartRateLogs.id, input.id), eq2(heartRateLogs.userId, OWNER_USER_ID)));
    return { success: true };
  }),
  bulkImport: ownerProcedure.input(z2.array(z2.object({
    date: z2.string(),
    restingHr: z2.number().optional(),
    highHr: z2.number().optional()
  }))).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    for (const row of input) {
      await db.insert(heartRateLogs).values({ ...row, userId: OWNER_USER_ID, source: "sheets" }).catch(() => {
      });
    }
    return { success: true, count: input.length };
  }),
  getMaxHr: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { maxHr: null };
    const result = await db.select({ maxHr: sql2`MAX(${heartRateLogs.highHr})` }).from(heartRateLogs).where(eq2(heartRateLogs.userId, OWNER_USER_ID));
    return { maxHr: result[0]?.maxHr ?? null };
  })
});
var sleepRouter = router({
  getAll: publicProcedure.input(z2.object({ limit: z2.number().optional() }).optional()).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.select().from(sleepLogs).where(eq2(sleepLogs.userId, OWNER_USER_ID)).orderBy(desc(sleepLogs.date)).limit(input?.limit || 200);
    const toHrs = (v) => v != null && v > 24 ? Math.round(v / 60 * 10) / 10 : v ?? null;
    return rows.map((r) => ({
      ...r,
      sleepDuration: toHrs(r.sleepDuration),
      deepSleep: toHrs(r.deepSleep),
      remSleep: toHrs(r.remSleep),
      lightSleep: toHrs(r.lightSleep),
      awakeDuration: toHrs(r.awakeDuration)
    }));
  }),
  add: publicProcedure.input(z2.object({
    date: z2.string(),
    score: z2.number().optional(),
    restingHr: z2.number().optional(),
    bodyBattery: z2.number().optional(),
    pulseOx: z2.number().optional(),
    respiration: z2.number().optional(),
    hrv: z2.number().optional(),
    quality: z2.enum(["Poor", "Fair", "Good", "Excellent"]).optional(),
    duration: z2.number().optional(),
    deepSleep: z2.number().optional(),
    remSleep: z2.number().optional(),
    lightSleep: z2.number().optional(),
    awakeDuration: z2.number().optional(),
    notes: z2.string().optional(),
    source: z2.string().optional()
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const { score, quality, duration, restingHr: _rhr, ...rest } = input;
    await db.insert(sleepLogs).values({
      ...rest,
      userId: OWNER_USER_ID,
      sleepScore: score,
      sleepQuality: quality,
      sleepDuration: duration
    });
    return { success: true };
  }),
  update: publicProcedure.input(z2.object({
    id: z2.number(),
    date: z2.string().optional(),
    score: z2.number().optional(),
    restingHr: z2.number().optional(),
    bodyBattery: z2.number().optional(),
    pulseOx: z2.number().optional(),
    respiration: z2.number().optional(),
    hrv: z2.number().optional(),
    quality: z2.enum(["Poor", "Fair", "Good", "Excellent"]).optional(),
    duration: z2.number().optional(),
    deepSleep: z2.number().optional(),
    remSleep: z2.number().optional(),
    lightSleep: z2.number().optional(),
    awakeDuration: z2.number().optional(),
    notes: z2.string().optional()
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const { id, score, quality, duration, restingHr: _rhr, ...rest } = input;
    const data = { ...rest, sleepScore: score, sleepQuality: quality, sleepDuration: duration };
    await db.update(sleepLogs).set(data).where(and(eq2(sleepLogs.id, id), eq2(sleepLogs.userId, OWNER_USER_ID)));
    return { success: true };
  }),
  delete: ownerProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.delete(sleepLogs).where(and(eq2(sleepLogs.id, input.id), eq2(sleepLogs.userId, OWNER_USER_ID)));
    return { success: true };
  }),
  bulkImport: publicProcedure.input(z2.array(z2.object({
    date: z2.string(),
    score: z2.number().optional(),
    restingHr: z2.number().optional(),
    bodyBattery: z2.number().optional(),
    pulseOx: z2.number().optional(),
    respiration: z2.number().optional(),
    hrv: z2.number().optional(),
    quality: z2.enum(["Poor", "Fair", "Good", "Excellent"]).optional(),
    duration: z2.number().optional(),
    deepSleep: z2.number().optional(),
    remSleep: z2.number().optional(),
    lightSleep: z2.number().optional(),
    awakeDuration: z2.number().optional()
  }))).mutation(async ({ ctx, input }) => {
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
        sleepDuration: duration
      }).catch(() => {
      });
    }
    return { success: true, count: input.length };
  })
});
var photosRouter = router({
  getAll: publicProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(progressPhotos).where(eq2(progressPhotos.userId, OWNER_USER_ID)).orderBy(desc(progressPhotos.date));
  }),
  upload: ownerProcedure.input(z2.object({
    base64: z2.string(),
    mimeType: z2.string(),
    date: z2.string(),
    angle: z2.enum(["front", "back", "side_left", "side_right", "other"]).optional(),
    weight: z2.number().optional(),
    notes: z2.string().optional()
  })).mutation(async ({ ctx, input }) => {
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
      notes: input.notes
    });
    return { success: true, url };
  }),
  delete: ownerProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.delete(progressPhotos).where(and(eq2(progressPhotos.id, input.id), eq2(progressPhotos.userId, OWNER_USER_ID)));
    return { success: true };
  })
});
var insightsRouter = router({
  getLatest: publicProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;
    const results = await db.select().from(aiInsights).where(eq2(aiInsights.userId, OWNER_USER_ID)).orderBy(desc(aiInsights.weekStart)).limit(4);
    return results;
  }),
  generate: ownerProcedure.input(z2.object({ type: z2.enum(["nutrition", "workout", "recovery", "overall"]).optional() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const todayStr = todayHK();
    const weekAgoStr = daysAgoHK(7);
    const weekAgo = /* @__PURE__ */ new Date(weekAgoStr + "T00:00:00+08:00");
    const [meals, sessions, body, sleep, hr] = await Promise.all([
      db.select().from(mealLogs).where(and(eq2(mealLogs.userId, OWNER_USER_ID), sql2`${mealLogs.loggedAt} >= ${weekAgo}`)).limit(50),
      db.select().from(workoutSessions).where(and(eq2(workoutSessions.userId, OWNER_USER_ID), sql2`${workoutSessions.startTime} >= ${weekAgo}`)),
      db.select().from(bodyComposition).where(eq2(bodyComposition.userId, OWNER_USER_ID)).orderBy(desc(bodyComposition.date)).limit(5),
      db.select().from(sleepLogs).where(and(eq2(sleepLogs.userId, OWNER_USER_ID), gte(sleepLogs.date, weekAgoStr))),
      db.select().from(heartRateLogs).where(and(eq2(heartRateLogs.userId, OWNER_USER_ID), gte(heartRateLogs.date, weekAgoStr)))
    ]);
    const dataContext = JSON.stringify({ meals, sessions, body, sleep, hr }, null, 2);
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are an expert personal health coach and nutritionist. Analyze the user's fitness data and provide personalized, actionable insights. Write in a supportive, professional tone. Use markdown formatting with headers, bullet points, and emphasis. Respond in both English and Traditional Chinese (\u7E41\u9AD4\u4E2D\u6587).`
        },
        {
          role: "user",
          content: `Here is my health data from the past week. Please provide comprehensive ${input.type || "overall"} insights, recommendations, and tips:

${dataContext}

Provide:
1. Summary of current status
2. Key observations
3. Specific recommendations
4. Goals for next week
5. Motivational message`
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
      period: input.type || "overall"
    });
    return { content, weekStart };
  })
});
var dashboardRouter = router({
  getSummary: publicProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;
    const todayStr = todayHK();
    const todayStart = /* @__PURE__ */ new Date(todayStr + "T00:00:00+08:00");
    const todayEnd = /* @__PURE__ */ new Date(todayStr + "T23:59:59+08:00");
    const weekAgoStr = daysAgoHK(7);
    const weekAgoDate = /* @__PURE__ */ new Date(weekAgoStr + "T00:00:00+08:00");
    const [todayMeals, recentSessions, latestBody, latestSleep, latestHr, weekMeals, todayWorkouts, todayRunning, todayStepsRows] = await Promise.all([
      db.select().from(mealLogs).where(and(eq2(mealLogs.userId, OWNER_USER_ID), sql2`${mealLogs.loggedAt} >= ${todayStart}`, sql2`${mealLogs.loggedAt} <= ${todayEnd}`)),
      db.select().from(workoutSessions).where(and(eq2(workoutSessions.userId, OWNER_USER_ID), sql2`${workoutSessions.startTime} >= ${weekAgoDate}`)).orderBy(desc(workoutSessions.startTime)).limit(7),
      db.select().from(bodyComposition).where(eq2(bodyComposition.userId, OWNER_USER_ID)).orderBy(desc(bodyComposition.date)).limit(2),
      db.select().from(sleepLogs).where(eq2(sleepLogs.userId, OWNER_USER_ID)).orderBy(desc(sleepLogs.date)).limit(1),
      db.select().from(heartRateLogs).where(eq2(heartRateLogs.userId, OWNER_USER_ID)).orderBy(desc(heartRateLogs.date)).limit(1),
      db.select().from(mealLogs).where(and(eq2(mealLogs.userId, OWNER_USER_ID), sql2`${mealLogs.loggedAt} >= ${weekAgoDate}`)),
      // Today's workout sessions
      db.select({ id: workoutSessions.id, name: workoutSessions.name, duration: workoutSessions.duration, caloriesBurned: workoutSessions.caloriesBurned }).from(workoutSessions).where(and(eq2(workoutSessions.userId, OWNER_USER_ID), sql2`${workoutSessions.startTime} >= ${todayStart}`, sql2`${workoutSessions.startTime} <= ${todayEnd}`)),
      // Today's running logs
      db.select({ id: runningLogs.id, distanceKm: runningLogs.distanceKm, calories: runningLogs.calories }).from(runningLogs).where(sql2`${runningLogs.date} = ${todayStr}`),
      // Today's steps
      db.select({ id: dailySteps.id, steps: dailySteps.steps, floorsClimbed: dailySteps.floorsClimbed, calories: dailySteps.calories }).from(dailySteps).where(and(eq2(dailySteps.userId, OWNER_USER_ID), sql2`${dailySteps.date} = ${todayStr}`))
    ]);
    const todayCalories = todayMeals.reduce((s, m) => s + (m.calories ?? 0), 0);
    const todayProtein = todayMeals.reduce((s, m) => s + (m.protein ?? 0), 0);
    const todayCarbs = todayMeals.reduce((s, m) => s + (m.carbs ?? 0), 0);
    const todayFat = todayMeals.reduce((s, m) => s + (m.fat ?? 0), 0);
    let streak = 0;
    const sessionDates = new Set(recentSessions.map((s) => toHKDateString(new Date(s.startTime))));
    for (let i = 0; i < 7; i++) {
      const d = daysAgoHK(i);
      if (sessionDates.has(d)) streak++;
      else if (i > 0) break;
    }
    const workoutCaloriesBurned = todayWorkouts.reduce((s, w) => s + (w.caloriesBurned ?? 0), 0);
    const runningCaloriesBurned = todayRunning.reduce((s, r) => s + (r.calories ?? 0), 0);
    const stepsCaloriesBurned = todayStepsRows.reduce((s, st) => s + (st.calories ?? 0), 0);
    const totalCaloriesBurned = workoutCaloriesBurned + runningCaloriesBurned + stepsCaloriesBurned;
    const netCalories = todayCalories - totalCaloriesBurned;
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
        todaySteps: todayStepsRows[0] || null
      },
      workoutStreak: streak,
      latestBody: latestBody[0] || null,
      prevBody: latestBody[1] || null,
      latestSleep: latestSleep[0] || null,
      latestHr: latestHr[0] || null,
      recentSessions,
      weekMeals
    };
  })
});
var csvImportRouter = router({
  /**
   * Parse a CSV string and return a preview (first 5 rows) + detected type.
   * No data is written to the DB at this stage.
   */
  preview: ownerProcedure.input(z2.object({
    csvText: z2.string().max(5e6),
    // 5 MB limit
    dataType: z2.enum(["body", "sleep", "heartrate", "workout", "nutrition", "running", "auto"]).default("auto")
  })).mutation(async ({ input }) => {
    const parsed = Papa.parse(input.csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim()
    });
    const headers = parsed.meta.fields ?? [];
    const detectedType = input.dataType === "auto" ? detectDataType(headers) : input.dataType;
    if (!detectedType) {
      return { detectedType: null, headers, preview: [], totalRows: parsed.data.length };
    }
    const allRows = parseRows(parsed.data, detectedType);
    return {
      detectedType,
      headers,
      preview: allRows.slice(0, 5),
      totalRows: parsed.data.length,
      validRows: allRows.length
    };
  }),
  /**
   * Import all rows from a CSV string into the database.
   * Returns counts of inserted / skipped rows.
   */
  importData: ownerProcedure.input(z2.object({
    csvText: z2.string().max(5e6),
    dataType: z2.enum(["body", "sleep", "heartrate", "workout", "nutrition", "running"])
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const parsed = Papa.parse(input.csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim()
    });
    const rows = parseRows(parsed.data, input.dataType);
    let inserted = 0;
    let skipped = 0;
    if (input.dataType === "body") {
      for (const r of rows) {
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
            source: "csv"
          }).onConflictDoNothing();
          inserted++;
        } catch {
          skipped++;
        }
      }
    } else if (input.dataType === "sleep") {
      for (const r of rows) {
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
            notes: r.restingHr ? `Resting HR: ${r.restingHr} bpm` : void 0,
            source: "csv"
          }).onConflictDoNothing();
          inserted++;
        } catch {
          skipped++;
        }
      }
    } else if (input.dataType === "heartrate") {
      for (const r of rows) {
        try {
          await db.insert(heartRateLogs).values({
            userId: OWNER_USER_ID,
            date: r.date,
            restingHr: r.restingHr,
            highHr: r.highHr,
            avgHr: r.avgHr,
            hrv: r.hrv,
            source: "csv"
          }).onConflictDoNothing();
          inserted++;
        } catch {
          skipped++;
        }
      }
    } else if (input.dataType === "workout") {
      for (const r of rows) {
        try {
          const [session] = await db.insert(workoutSessions).values({
            userId: OWNER_USER_ID,
            name: r.activityName ?? r.activityType ?? "Imported Workout",
            startTime: /* @__PURE__ */ new Date(r.date + "T00:00:00Z"),
            duration: r.durationMinutes,
            notes: [
              r.notes,
              r.calories ? `Calories: ${r.calories} kcal` : null,
              r.avgHr ? `Avg HR: ${r.avgHr} bpm` : null,
              r.distanceKm ? `Distance: ${r.distanceKm.toFixed(2)} km` : null
            ].filter(Boolean).join(" | ") || void 0
          }).returning();
          if (session) inserted++;
        } catch {
          skipped++;
        }
      }
    } else if (input.dataType === "nutrition") {
      for (const r of rows) {
        try {
          const validMealType = ["breakfast", "lunch", "dinner", "snack"].includes(r.mealType ?? "") ? r.mealType : "snack";
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
            loggedAt: /* @__PURE__ */ new Date(r.date + "T12:00:00Z"),
            notes: "Imported from CSV"
          });
          inserted++;
        } catch {
          skipped++;
        }
      }
    } else if (input.dataType === "running") {
      for (const r of rows) {
        try {
          await db.execute(sql2`
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
        } catch {
          skipped++;
        }
      }
    }
    return { success: true, inserted, skipped, total: rows.length };
  })
});
var chartsRouter = router({
  // Fetch body composition history for charting
  bodyHistory: publicProcedure.input(z2.object({ days: z2.number().int().min(7).max(365).default(90) })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return [];
    const sinceStr = daysAgoHK(input.days);
    return db.select({
      date: bodyComposition.date,
      weight: bodyComposition.weight,
      bodyFatPct: bodyComposition.bodyFatPct,
      muscleMass: bodyComposition.muscleMass,
      bmi: bodyComposition.bmi
    }).from(bodyComposition).where(and(
      eq2(bodyComposition.userId, OWNER_USER_ID),
      sql2`${bodyComposition.date} >= ${sinceStr}`
    )).orderBy(bodyComposition.date);
  }),
  // Fetch sleep history for charting
  sleepHistory: publicProcedure.input(z2.object({ days: z2.number().int().min(7).max(365).default(90) })).query(async ({ ctx, input }) => {
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
      waketime: sleepLogs.waketime
    }).from(sleepLogs).where(and(
      eq2(sleepLogs.userId, OWNER_USER_ID),
      sql2`${sleepLogs.date} >= ${sinceStr}`
    )).orderBy(sleepLogs.date);
    const toHrs = (v) => v != null && v > 24 ? Math.round(v / 60 * 10) / 10 : v;
    return rows.map((r) => ({
      ...r,
      sleepDuration: toHrs(r.sleepDuration),
      deepSleep: toHrs(r.deepSleep),
      remSleep: toHrs(r.remSleep),
      lightSleep: toHrs(r.lightSleep)
    }));
  }),
  // Fetch heart rate history for charting
  // HRV comes from sleep_logs (Garmin measures HRV during sleep)
  heartRateHistory: publicProcedure.input(z2.object({ days: z2.number().int().min(7).max(365).default(90) })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return [];
    const sinceStr = daysAgoHK(input.days);
    const hrRows = await db.select({
      date: heartRateLogs.date,
      restingHr: heartRateLogs.restingHr,
      highHr: heartRateLogs.highHr,
      avgHr: heartRateLogs.avgHr
    }).from(heartRateLogs).where(and(
      eq2(heartRateLogs.userId, OWNER_USER_ID),
      sql2`${heartRateLogs.date} >= ${sinceStr}`
    )).orderBy(heartRateLogs.date);
    const sleepHrvRows = await db.select({
      date: sleepLogs.date,
      hrv: sleepLogs.hrv
    }).from(sleepLogs).where(and(
      eq2(sleepLogs.userId, OWNER_USER_ID),
      sql2`${sleepLogs.date} >= ${sinceStr}`,
      sql2`${sleepLogs.hrv} IS NOT NULL`
    )).orderBy(sleepLogs.date);
    const hrvByDate = new Map(sleepHrvRows.map((r) => [r.date, r.hrv]));
    const allDates = /* @__PURE__ */ new Set([...hrRows.map((r) => r.date), ...sleepHrvRows.map((r) => r.date)]);
    const merged = Array.from(allDates).sort().map((date2) => {
      const hr = hrRows.find((r) => r.date === date2);
      return {
        date: date2,
        restingHr: hr?.restingHr ?? null,
        highHr: hr?.highHr ?? null,
        avgHr: hr?.avgHr ?? null,
        hrv: hrvByDate.get(date2) ?? null
      };
    });
    return merged;
  }),
  // Fetch workout history for charting
  workoutHistory: publicProcedure.input(z2.object({ days: z2.number().int().min(7).max(365).default(90) })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return [];
    const sinceStr = daysAgoHK(input.days);
    const sinceDate = /* @__PURE__ */ new Date(sinceStr + "T00:00:00+08:00");
    return db.select({
      date: sql2`TO_CHAR(${workoutSessions.startTime} AT TIME ZONE 'Asia/Hong_Kong', 'YYYY-MM-DD')`.as("date"),
      duration: workoutSessions.duration,
      totalVolume: workoutSessions.totalVolume,
      name: workoutSessions.name
    }).from(workoutSessions).where(and(
      eq2(workoutSessions.userId, OWNER_USER_ID),
      sql2`${workoutSessions.startTime} >= ${sinceDate}`
    )).orderBy(workoutSessions.startTime);
  }),
  // Fetch daily calorie totals for charting
  calorieHistory: publicProcedure.input(z2.object({ days: z2.number().int().min(7).max(365).default(30) })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return [];
    const sinceStr = daysAgoHK(input.days);
    const sinceDate = /* @__PURE__ */ new Date(sinceStr + "T00:00:00+08:00");
    const rows = await db.select({
      date: sql2`TO_CHAR(${mealLogs.loggedAt} AT TIME ZONE 'Asia/Hong_Kong', 'YYYY-MM-DD')`.as("date"),
      totalCalories: sql2`COALESCE(SUM(${mealLogs.calories}), 0)`.as("totalCalories"),
      totalProtein: sql2`COALESCE(SUM(${mealLogs.protein}), 0)`.as("totalProtein"),
      totalCarbs: sql2`COALESCE(SUM(${mealLogs.carbs}), 0)`.as("totalCarbs"),
      totalFat: sql2`COALESCE(SUM(${mealLogs.fat}), 0)`.as("totalFat")
    }).from(mealLogs).where(and(
      eq2(mealLogs.userId, OWNER_USER_ID),
      sql2`${mealLogs.loggedAt} >= ${sinceDate}`
    )).groupBy(sql2`TO_CHAR(${mealLogs.loggedAt} AT TIME ZONE 'Asia/Hong_Kong', 'YYYY-MM-DD')`).orderBy(sql2`TO_CHAR(${mealLogs.loggedAt} AT TIME ZONE 'Asia/Hong_Kong', 'YYYY-MM-DD')`);
    return rows;
  })
});
var goalsRouter = router({
  getGoals: publicProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(healthGoals).where(and(eq2(healthGoals.userId, OWNER_USER_ID), eq2(healthGoals.isActive, true))).orderBy(healthGoals.goalType);
  }),
  setGoal: ownerProcedure.input(z2.object({
    goalType: z2.enum([
      "weight",
      "body_fat_pct",
      "muscle_mass",
      "sleep_duration",
      "sleep_score",
      "resting_hr",
      "hrv",
      "daily_calories",
      "daily_protein",
      "workout_duration"
    ]),
    targetValue: z2.number(),
    unit: z2.string().optional(),
    notes: z2.string().optional()
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.update(healthGoals).set({ isActive: false, updatedAt: /* @__PURE__ */ new Date() }).where(and(eq2(healthGoals.userId, OWNER_USER_ID), eq2(healthGoals.goalType, input.goalType)));
    const [goal] = await db.insert(healthGoals).values({
      userId: OWNER_USER_ID,
      goalType: input.goalType,
      targetValue: input.targetValue,
      unit: input.unit,
      notes: input.notes,
      isActive: true
    }).returning();
    return goal;
  }),
  deleteGoal: ownerProcedure.input(z2.object({ goalType: z2.enum([
    "weight",
    "body_fat_pct",
    "muscle_mass",
    "sleep_duration",
    "sleep_score",
    "resting_hr",
    "hrv",
    "daily_calories",
    "daily_protein",
    "workout_duration"
  ]) })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.update(healthGoals).set({ isActive: false, updatedAt: /* @__PURE__ */ new Date() }).where(and(eq2(healthGoals.userId, OWNER_USER_ID), eq2(healthGoals.goalType, input.goalType)));
    return { success: true };
  })
});
var imageImportRouter = router({
  /**
   * Upload an image and extract health data using AI vision.
   * Returns extracted fields for user review before saving.
   */
  extract: ownerProcedure.input(z2.object({
    base64: z2.string(),
    mimeType: z2.string().default("image/jpeg"),
    dataType: z2.enum(["body", "sleep", "heartrate", "nutrition", "running", "steps", "auto"]).default("auto")
  })).mutation(async ({ input }) => {
    const buffer = Buffer.from(input.base64, "base64");
    const ext = input.mimeType.includes("png") ? "png" : "jpg";
    const key = `import-images/${OWNER_USER_ID}/${nanoid()}.${ext}`;
    const { url: imageUrl } = await storagePut(key, buffer, input.mimeType);
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
            { type: "text", text: userPrompt }
          ]
        }
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
                  visceralFat: { type: ["number", "null"] }
                },
                required: ["weight", "bmi", "bodyFatPct", "muscleMass", "visceralFat"],
                additionalProperties: false
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
                  hrv: { type: ["number", "null"] }
                },
                required: ["sleepScore", "sleepDuration", "deepSleep", "remSleep", "bodyBattery", "pulseOx", "hrv"],
                additionalProperties: false
              },
              heartrate: {
                type: "object",
                properties: {
                  restingHr: { type: ["number", "null"] },
                  highHr: { type: ["number", "null"] },
                  avgHr: { type: ["number", "null"] },
                  hrv: { type: ["number", "null"] }
                },
                required: ["restingHr", "highHr", "avgHr", "hrv"],
                additionalProperties: false
              },
              nutrition: {
                type: "object",
                properties: {
                  calories: { type: ["number", "null"] },
                  protein: { type: ["number", "null"] },
                  carbs: { type: ["number", "null"] },
                  fat: { type: ["number", "null"] },
                  fiber: { type: ["number", "null"] }
                },
                required: ["calories", "protein", "carbs", "fat", "fiber"],
                additionalProperties: false
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
                  runningType: { type: ["string", "null"] }
                },
                required: ["distanceKm", "durationHour", "durationMin", "durationSec", "avgPace", "bestPace", "avgHr", "maxHr", "avgCadence", "maxCadence", "calories", "avgStrideLengthM", "avgVerticalRatio", "verticalOscillationCm", "runningType"],
                additionalProperties: false
              },
              steps: {
                type: "object",
                properties: {
                  steps: { type: ["number", "null"] },
                  floorsClimbed: { type: ["number", "null"] },
                  distanceKm: { type: ["number", "null"] },
                  activeMinutes: { type: ["number", "null"] },
                  calories: { type: ["number", "null"] }
                },
                required: ["steps", "floorsClimbed", "distanceKm", "activeMinutes", "calories"],
                additionalProperties: false
              },
              confidence: { type: "string" },
              notes: { type: "string" }
            },
            required: ["detectedType", "date", "body", "sleep", "heartrate", "nutrition", "running", "steps", "confidence", "notes"],
            additionalProperties: false
          }
        }
      }
    });
    const rawMsg = response.choices[0]?.message?.content;
    const contentStr = typeof rawMsg === "string" ? rawMsg : "{}";
    const extracted = JSON.parse(contentStr);
    return { ...extracted, imageUrl };
  }),
  /**
   * Save extracted image data to the database after user confirms.
   */
  save: publicProcedure.input(z2.object({
    date: z2.string(),
    dataType: z2.enum(["body", "sleep", "heartrate", "nutrition"]),
    body: z2.object({
      weight: z2.number().nullable().optional(),
      bmi: z2.number().nullable().optional(),
      bodyFatPct: z2.number().nullable().optional(),
      muscleMass: z2.number().nullable().optional(),
      visceralFat: z2.number().nullable().optional()
    }).optional(),
    sleep: z2.object({
      sleepScore: z2.number().nullable().optional(),
      sleepDuration: z2.number().nullable().optional(),
      deepSleep: z2.number().nullable().optional(),
      remSleep: z2.number().nullable().optional(),
      bodyBattery: z2.number().nullable().optional(),
      pulseOx: z2.number().nullable().optional(),
      hrv: z2.number().nullable().optional()
    }).optional(),
    heartrate: z2.object({
      restingHr: z2.number().nullable().optional(),
      highHr: z2.number().nullable().optional(),
      avgHr: z2.number().nullable().optional(),
      hrv: z2.number().nullable().optional()
    }).optional(),
    nutrition: z2.object({
      calories: z2.number().nullable().optional(),
      protein: z2.number().nullable().optional(),
      carbs: z2.number().nullable().optional(),
      fat: z2.number().nullable().optional(),
      fiber: z2.number().nullable().optional()
    }).optional()
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    if (input.dataType === "body" && input.body) {
      await db.insert(bodyComposition).values({
        userId: OWNER_USER_ID,
        date: input.date,
        weight: input.body.weight ?? void 0,
        bmi: input.body.bmi ?? void 0,
        bodyFatPct: input.body.bodyFatPct ?? void 0,
        muscleMass: input.body.muscleMass ?? void 0,
        visceralFat: input.body.visceralFat ?? void 0,
        source: "image"
      }).onConflictDoNothing();
    } else if (input.dataType === "sleep" && input.sleep) {
      await db.insert(sleepLogs).values({
        userId: OWNER_USER_ID,
        date: input.date,
        sleepScore: input.sleep.sleepScore ?? void 0,
        sleepDuration: input.sleep.sleepDuration ?? void 0,
        deepSleep: input.sleep.deepSleep ?? void 0,
        remSleep: input.sleep.remSleep ?? void 0,
        bodyBattery: input.sleep.bodyBattery ?? void 0,
        pulseOx: input.sleep.pulseOx ?? void 0,
        hrv: input.sleep.hrv ?? void 0,
        source: "image"
      }).onConflictDoNothing();
    } else if (input.dataType === "heartrate" && input.heartrate) {
      await db.insert(heartRateLogs).values({
        userId: OWNER_USER_ID,
        date: input.date,
        restingHr: input.heartrate.restingHr ?? void 0,
        highHr: input.heartrate.highHr ?? void 0,
        avgHr: input.heartrate.avgHr ?? void 0,
        hrv: input.heartrate.hrv ?? void 0,
        source: "image"
      }).onConflictDoNothing();
    } else if (input.dataType === "nutrition" && input.nutrition) {
      await db.insert(mealLogs).values({
        userId: OWNER_USER_ID,
        foodName: "Image Import",
        mealType: "snack",
        servings: 1,
        calories: input.nutrition.calories ?? void 0,
        protein: input.nutrition.protein ?? void 0,
        carbs: input.nutrition.carbs ?? void 0,
        fat: input.nutrition.fat ?? void 0,
        fiber: input.nutrition.fiber ?? void 0,
        loggedAt: /* @__PURE__ */ new Date(input.date + "T12:00:00Z"),
        notes: "Imported from image"
      });
    }
    return { success: true };
  })
});
var runningRouter = router({
  getActiveShoes: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.execute(sql2`
        SELECT id, shoes_name, brand, status
        FROM running_shoes
        WHERE status != 'Retired'
        ORDER BY status ASC, shoes_name ASC
      `);
    return rows.rows ?? rows;
  }),
  getLogs: publicProcedure.input(z2.object({ limit: z2.number().optional().default(200) })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.execute(
      sql2`SELECT * FROM running_logs ORDER BY date DESC LIMIT ${input.limit}`
    );
    return rows.rows ?? rows;
  }),
  getStats: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.execute(sql2`
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
    const typeRows = await db.execute(sql2`
        SELECT running_type, COUNT(*) as count, SUM(distance_km::numeric) as total_km
        FROM running_logs
        GROUP BY running_type
        ORDER BY count DESC
      `);
    const monthlyRows = await db.execute(sql2`
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
      summary: (rows.rows ?? rows)[0],
      byType: typeRows.rows ?? typeRows,
      monthly: monthlyRows.rows ?? monthlyRows
    };
  }),
  addLog: publicProcedure.input(z2.object({
    date: z2.string(),
    runningType: z2.string().optional(),
    runningShoes: z2.string().optional(),
    distanceKm: z2.number().optional(),
    hour: z2.number().optional(),
    minutes: z2.number().optional(),
    second: z2.number().optional(),
    averagePace: z2.string().optional(),
    bestPace: z2.string().optional(),
    averageHeartRate: z2.number().optional(),
    maximumHeartRate: z2.number().optional(),
    averageCadence: z2.number().optional(),
    maxCadence: z2.number().optional(),
    avgStrideLengthM: z2.number().optional(),
    avgVerticalRatio: z2.number().optional(),
    verticalOscillationCm: z2.number().optional(),
    avgGroundContactTimeMs: z2.number().optional(),
    calories: z2.number().optional(),
    temperature: z2.number().optional(),
    humidity: z2.number().optional(),
    notes: z2.string().optional()
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    let shoesId = null;
    if (input.runningShoes) {
      const shoeRow = await db.execute(sql2`SELECT id FROM running_shoes WHERE shoes_name = ${input.runningShoes} LIMIT 1`);
      const found = (shoeRow.rows ?? shoeRow)[0];
      if (found) shoesId = Number(found.id);
    }
    const result = await db.execute(sql2`
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
    const rows = result.rows ?? result;
    const newId = rows[0]?.id ? Number(rows[0].id) : 0;
    return { success: true, id: newId };
  }),
  updateLog: publicProcedure.input(z2.object({
    id: z2.number(),
    date: z2.string().optional(),
    runningType: z2.string().optional(),
    runningShoes: z2.string().optional(),
    distanceKm: z2.number().optional(),
    hour: z2.number().optional(),
    minutes: z2.number().optional(),
    second: z2.number().optional(),
    averagePace: z2.string().optional(),
    bestPace: z2.string().optional(),
    averageHeartRate: z2.number().optional(),
    maximumHeartRate: z2.number().optional(),
    averageCadence: z2.number().optional(),
    maxCadence: z2.number().optional(),
    avgStrideLengthM: z2.number().optional(),
    avgVerticalRatio: z2.number().optional(),
    verticalOscillationCm: z2.number().optional(),
    avgGroundContactTimeMs: z2.number().optional(),
    calories: z2.number().optional(),
    temperature: z2.number().optional(),
    humidity: z2.number().optional(),
    notes: z2.string().optional()
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const { id, ...fields } = input;
    if (fields.runningShoes !== void 0) {
      const shoeRow = await db.execute(sql2`SELECT id FROM running_shoes WHERE shoes_name = ${fields.runningShoes} LIMIT 1`);
      const found = (shoeRow.rows ?? shoeRow)[0];
      fields.shoesId = found ? Number(found.id) : null;
    }
    const setClauses = Object.entries(fields).filter(([, v]) => v !== void 0).map(([k, v]) => {
      const col = k.replace(/([A-Z])/g, "_$1").toLowerCase();
      return sql2`${sql2.raw(col)} = ${v}`;
    });
    if (!setClauses.length) return { success: true };
    await db.execute(sql2`UPDATE running_logs SET ${sql2.join(setClauses, sql2`, `)} WHERE id = ${id}`);
    return { success: true };
  }),
  deleteLog: ownerProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.execute(sql2`DELETE FROM running_logs WHERE id = ${input.id}`);
    return { success: true };
  }),
  getAIAnalysis: ownerProcedure.input(z2.object({ weeks: z2.number().optional().default(12) })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const recentRows = await db.execute(sql2`
        SELECT date, running_type, running_shoes, distance_km, hour, minutes, second,
               average_pace, best_pace, average_heart_rate, maximum_heart_rate,
               average_cadence, max_cadence, avg_stride_length_m, avg_vertical_ratio,
               vertical_oscillation_cm, avg_ground_contact_time_ms, calories,
               temperature, humidity, notes
        FROM running_logs
        ORDER BY date DESC
        LIMIT ${input.weeks * 7}
      `);
    const logs = recentRows.rows ?? recentRows;
    if (!logs.length) return { analysis: "\u76EE\u524D\u6C92\u6709\u8DB3\u5920\u7684\u8DD1\u6B65\u8A18\u9304\u3002" };
    const statsRows = await db.execute(sql2`
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
    const stats = (statsRows.rows ?? statsRows)[0];
    const formatPace = (sec) => {
      if (!sec) return "N/A";
      const m = Math.floor(sec / 60);
      const s = Math.round(sec % 60);
      return `${m}:${String(s).padStart(2, "0")}/km`;
    };
    const summary = logs.slice(0, 30).map((r) => [
      `\u65E5\u671F:${r.date?.toString().slice(0, 10)}`,
      r.running_type ? `\u985E\u578B:${r.running_type}` : "",
      r.distance_km ? `\u8DDD\u96E2:${parseFloat(r.distance_km).toFixed(2)}km` : "",
      r.hour != null || r.minutes != null ? `\u6642\u9593:${r.hour || 0}h${r.minutes || 0}m${r.second || 0}s` : "",
      r.average_pace ? `\u914D\u901F:${formatPace(parseFloat(r.average_pace) * 60)}` : "",
      r.average_heart_rate ? `\u5FC3\u7387:${r.average_heart_rate}bpm` : "",
      r.average_cadence ? `\u6B65\u983B:${r.average_cadence}spm` : "",
      r.avg_stride_length_m ? `\u6B65\u5E45:${r.avg_stride_length_m}m` : "",
      r.avg_vertical_ratio ? `\u5782\u76F4\u6BD4:${r.avg_vertical_ratio}%` : "",
      r.vertical_oscillation_cm ? `\u632F\u5E45:${r.vertical_oscillation_cm}cm` : "",
      r.running_shoes ? `\u8DD1\u978B:${r.running_shoes}` : "",
      r.notes ? `\u5099\u8A3B:${r.notes}` : ""
    ].filter(Boolean).join(", ")).join("\\n");
    const upcomingRaceRows = await db.execute(sql2`
        SELECT race_name, date, distance_km, location
        FROM races
        WHERE date >= TO_CHAR(NOW(), 'YYYY-MM-DD')
        ORDER BY date ASC
        LIMIT 10
      `);
    const upcomingRaces = upcomingRaceRows.rows ?? upcomingRaceRows;
    const pastRaceRows = await db.execute(sql2`
        SELECT race_name, date, distance_km, finish_time, finish_hr, finish_min, finish_sec, is_pb, overall_place, gender_group_place, age_group_place, location, notes
        FROM races
        WHERE date < TO_CHAR(NOW(), 'YYYY-MM-DD')
          AND (finish_hr IS NOT NULL OR finish_min IS NOT NULL OR finish_time IS NOT NULL)
        ORDER BY date DESC
        LIMIT 20
      `);
    const pastRaces = pastRaceRows.rows ?? pastRaceRows;
    const activeShoeRows = await db.execute(sql2`
        SELECT s.shoes_name, s.brand, s.model,
          COALESCE(s.initial_km::numeric, 0) + COALESCE(SUM(r.distance_km::numeric), 0) AS total_km
        FROM running_shoes s
        LEFT JOIN running_logs r ON (r.shoes_id = s.id OR (r.shoes_id IS NULL AND r.running_shoes = s.shoes_name))
        WHERE s.status = 'Active'
        GROUP BY s.id, s.shoes_name, s.brand, s.model
        ORDER BY s.shoes_name ASC
      `);
    const activeShoes = activeShoeRows.rows ?? activeShoeRows;
    const fmtFinishTime = (r) => {
      if (r.finish_hr != null || r.finish_min != null || r.finish_sec != null) {
        const h = r.finish_hr ?? 0;
        const m = r.finish_min ?? 0;
        const s = r.finish_sec ?? 0;
        return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
      }
      return r.finish_time || "\u672A\u77E5";
    };
    const pastRaceSummary = pastRaces.map(
      (r) => `${r.date?.toString().slice(0, 10)} ${r.race_name} ${parseFloat(r.distance_km || 0).toFixed(1)}km \u5B8C\u6210:${fmtFinishTime(r)}${r.is_pb ? " (PB)" : ""}${r.overall_place ? " \u7E3D\u6392#" + r.overall_place : ""}${r.location ? " @" + r.location : ""}`
    ).join("\n");
    const upcomingRaceSummary = upcomingRaces.map(
      (r) => `${r.date?.toString().slice(0, 10)} ${r.race_name} ${parseFloat(r.distance_km || 0).toFixed(1)}km${r.location ? " @" + r.location : ""}`
    ).join("\n");
    const activeShoeSummary = activeShoes.map(
      (s) => `${s.shoes_name}${s.brand ? " (" + s.brand + ")" : ""} \u5DF2\u8DD1${parseFloat(s.total_km || 0).toFixed(0)}km`
    ).join(", ");
    const res = await invokeLLM({
      messages: [
        { role: "system", content: "\u4F60\u662F\u4E00\u4F4D\u5C08\u696D\u99AC\u62C9\u677E\u6559\u7DF4\u548C\u904B\u52D5\u79D1\u5B78\u5206\u6790\u5E2B\u3002\u8ACB\u7528\u7E41\u9AD4\u4E2D\u6587\u56DE\u7B54\uFF0C\u7D50\u69CB\u6E05\u6670\uFF0C\u5206\u6BB5\u8AAA\u660E\uFF0C\u4F7F\u7528 Markdown \u683C\u5F0F\u3002" },
        { role: "user", content: `\u8ACB\u5168\u9762\u5206\u6790\u6211\u7684\u8DD1\u6B65\u6578\u64DA\u4E26\u63D0\u4F9B\u8A73\u7D30\u5EFA\u8B70\u3002

## \u8A13\u7DF4\u6578\u64DA\u6458\u8981 (\u6700\u8FD1${input.weeks}\u9031)
\u5171${logs.length}\u6B21\u8DD1\u6B65\uFF0C\u7E3D\u8DDD\u96E2:${parseFloat(stats?.total_distance || 0).toFixed(1)}km
\u5E73\u5747\u914D\u901F:${formatPace(parseFloat(stats?.avg_pace || 0) * 60)}\uFF0C\u5E73\u5747\u5FC3\u7387:${Math.round(stats?.avg_hr || 0)}bpm
\u5E73\u5747\u6B65\u983B:${Math.round(stats?.avg_cadence || 0)}spm\uFF0C\u5E73\u5747\u6B65\u5E45:${parseFloat(stats?.avg_stride || 0).toFixed(2)}m
\u5E73\u5747\u5782\u76F4\u6BD4:${parseFloat(stats?.avg_vr || 0).toFixed(1)}%\uFF0C\u5E73\u5747\u632F\u5E45:${parseFloat(stats?.avg_vo || 0).toFixed(1)}cm

## \u8A73\u7D30\u8A13\u7DF4\u8A18\u9304(\u6700\u8FD130\u6B21)
${summary}

## \u904E\u5F80\u8CFD\u4E8B\u8A18\u9304
${pastRaceSummary || "\u66AB\u7121\u904E\u5F80\u8CFD\u4E8B\u8A18\u9304"}

## \u5373\u5C07\u5230\u4F86\u7684\u8CFD\u4E8B
${upcomingRaceSummary || "\u66AB\u7121\u5373\u5C07\u5230\u4F86\u7684\u8CFD\u4E8B"}

## \u73FE\u6709\u8DD1\u978B (Active)
${activeShoeSummary || "\u66AB\u7121\u8DD1\u978B\u8A18\u9304"}

\u8ACB\u63D0\u4F9B\u4EE5\u4E0B\u5B8C\u6574\u5206\u6790:

### 1. \u8DD1\u6B65\u8868\u73FE\u7E3D\u7D50
\u5206\u6790\u914D\u901F\u8DA8\u52E2\u3001\u8DDD\u96E2\u9032\u5C55\u3001\u5FC3\u7387\u6548\u7387

### 2. \u8DD1\u6B65\u751F\u7269\u529B\u5B78\u5206\u6790
\u6B65\u983B/\u6B65\u5E45/\u5782\u76F4\u632F\u5E45/\u5782\u76F4\u6BD4\u5206\u6790\uFF0C\u8DD1\u6B65\u7D93\u6FDF\u6027\u8A55\u4F30

### 3. \u8A13\u7DF4\u8CA0\u8377\u8207\u985E\u578B\u5206\u5E03
\u8A55\u4F30\u8A13\u7DF4\u5145\u5206\u5EA6\u3001\u5F37\u5EA6\u5206\u5E03\u662F\u5426\u5408\u7406

### 4. \u5373\u5C07\u8CFD\u4E8B\u5B8C\u6210\u6642\u9593\u9810\u6E2C
\u6839\u64DA\u73FE\u6709\u8A13\u7DF4\u6C34\u5E73\uFF0C\u70BA\u6BCF\u5834\u5373\u5C07\u5230\u4F86\u7684\u8CFD\u4E8B\u9810\u6E2C\u5B8C\u6210\u6642\u9593\u7BC4\u570D\uFF08\u6A02\u89C0/\u4FDD\u5B88\uFF09\uFF0C\u4E26\u8AAA\u660E\u9810\u6E2C\u4F9D\u64DA

### 5. \u5404\u8CFD\u4E8B\u914D\u901F\u7B56\u7565\u5EFA\u8B70
\u70BA\u6BCF\u5834\u5373\u5C07\u5230\u4F86\u7684\u8CFD\u4E8B\u63D0\u4F9B\u5177\u9AD4\u914D\u901F\u8A08\u5283\uFF08\u524D\u534A\u6BB5/\u5F8C\u534A\u6BB5\u5206\u914D\uFF09

### 6. \u8DD1\u978B\u63A8\u85A6
\u6839\u64DA\u8CFD\u4E8B\u8DDD\u96E2\u548C\u8A13\u7DF4\u985E\u578B\uFF0C\u5F9E\u73FE\u6709\u8DD1\u978B\u4E2D\u63A8\u85A6\u6700\u9069\u5408\u7684\u9078\u64C7\uFF0C\u4E26\u8AAA\u660E\u7406\u7531\uFF08\u8003\u616E\u91CC\u7A0B\u78E8\u640D\uFF09

### 7. \u5929\u6C23\u61C9\u5C0D\u7B56\u7565
\u91DD\u5C0D\u9999\u6E2F\u5929\u6C23\u7279\u9EDE\uFF08\u9AD8\u6EAB\u9AD8\u6FD5\u590F\u5B63\u3001\u6DBC\u723D\u51AC\u5B63\uFF09\uFF0C\u63D0\u4F9B\u4E0D\u540C\u5929\u6C23\u689D\u4EF6\u4E0B\u7684\u914D\u901F\u8ABF\u6574\u3001\u88DC\u6C34\u7B56\u7565\u548C\u88DD\u5099\u5EFA\u8B70

### 8. \u5177\u9AD4\u8A13\u7DF4\u6539\u9032\u5EFA\u8B70
\u63D0\u4F9B\u81F3\u5C115\u9805\u53EF\u57F7\u884C\u7684\u8A13\u7DF4\u5EFA\u8B70\uFF0C\u5E6B\u52A9\u9054\u6210\u8CFD\u4E8B\u76EE\u6A19` }
      ]
    });
    return { analysis: res.choices[0]?.message?.content ?? "\u5206\u6790\u5931\u6557\uFF0C\u8ACB\u7A0D\u5F8C\u518D\u8A66\u3002" };
  }),
  // ─── Personalized Training Plan ─────────────────────────────────────────────
  generateTrainingPlan: ownerProcedure.input(z2.object({
    goalRaceId: z2.number().optional(),
    goalRaceName: z2.string().optional(),
    goalRaceDate: z2.string().optional(),
    goalRaceDistance: z2.number().optional(),
    goalFinishHr: z2.number().optional(),
    goalFinishMin: z2.number().optional(),
    goalFinishSec: z2.number().optional(),
    planWeeks: z2.number().optional().default(12)
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const runRows = await db.execute(sql2`
        SELECT date, running_type, distance_km, hour, minutes, second,
               average_pace, best_pace, average_heart_rate, maximum_heart_rate,
               average_cadence, max_cadence, avg_stride_length_m, avg_vertical_ratio,
               vertical_oscillation_cm, calories, running_shoes, notes
        FROM running_logs ORDER BY date DESC LIMIT 60
      `);
    const runs = runRows.rows ?? runRows;
    const raceRows = await db.execute(sql2`
        SELECT race_name, date, distance_km, finish_hr, finish_min, finish_sec, finish_time, is_pb, overall_place, location
        FROM races ORDER BY date DESC LIMIT 30
      `);
    const allRaces = raceRows.rows ?? raceRows;
    const bodyRows = await db.execute(sql2`
        SELECT weight, body_fat_pct, muscle_mass, bmi, bmr, visceral_fat
        FROM body_composition ORDER BY date DESC LIMIT 1
      `);
    const body = (bodyRows.rows ?? bodyRows)[0] ?? null;
    const hrRows = await db.execute(sql2`
        SELECT resting_hr, high_hr, hrv, avg_hr, zone1_minutes, zone2_minutes, zone3_minutes, zone4_minutes, zone5_minutes
        FROM heart_rate_logs ORDER BY date DESC LIMIT 1
      `);
    const hr = (hrRows.rows ?? hrRows)[0] ?? null;
    const sleepRows = await db.execute(sql2`
        SELECT AVG(sleep_score) as avg_score, AVG(sleep_duration) as avg_duration,
               AVG(hrv) as avg_hrv, AVG(resting_hr) as avg_resting_hr,
               AVG(body_battery) as avg_battery, AVG(deep_sleep) as avg_deep
        FROM sleep_logs WHERE date >= TO_CHAR(NOW() - interval '14 days', 'YYYY-MM-DD')
      `);
    const sleep = (sleepRows.rows ?? sleepRows)[0] ?? null;
    const shoeRows = await db.execute(sql2`
        SELECT s.shoes_name, s.brand,
          COALESCE(s.initial_km::numeric, 0) + COALESCE(SUM(r.distance_km::numeric), 0) AS total_km
        FROM running_shoes s
        LEFT JOIN running_logs r ON (r.shoes_id = s.id OR (r.shoes_id IS NULL AND r.running_shoes = s.shoes_name))
        WHERE s.status = 'Active'
        GROUP BY s.id, s.shoes_name, s.brand ORDER BY s.shoes_name ASC
      `);
    const shoes = shoeRows.rows ?? shoeRows;
    const fmtTime = (r) => {
      if (r.finish_hr != null || r.finish_min != null) {
        const h = r.finish_hr ?? 0;
        const m = r.finish_min ?? 0;
        const s = r.finish_sec ?? 0;
        return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
      }
      return r.finish_time || null;
    };
    const fmtPace = (sec) => {
      if (!sec) return "N/A";
      const m = Math.floor(sec / 60);
      const s = Math.round(sec % 60);
      return `${m}:${String(s).padStart(2, "0")}/km`;
    };
    const pastRaces = allRaces.filter((r) => new Date(r.date) <= /* @__PURE__ */ new Date());
    const upcomingRaces = allRaces.filter((r) => new Date(r.date) > /* @__PURE__ */ new Date());
    let goalDesc = "";
    if (input.goalRaceId) {
      const gr = allRaces.find((r) => Number(r.id) === input.goalRaceId);
      if (gr) goalDesc = `${gr.race_name} (${gr.date}, ${parseFloat(gr.distance_km || 0).toFixed(1)}km)`;
    } else if (input.goalRaceName) {
      goalDesc = `${input.goalRaceName}${input.goalRaceDate ? " (" + input.goalRaceDate + ")" : ""}${input.goalRaceDistance ? " " + input.goalRaceDistance + "km" : ""}`;
    }
    const goalTimeDesc = input.goalFinishHr != null || input.goalFinishMin != null ? `\u76EE\u6A19\u5B8C\u8CFD\u6642\u9593: ${input.goalFinishHr ?? 0}:${String(input.goalFinishMin ?? 0).padStart(2, "0")}:${String(input.goalFinishSec ?? 0).padStart(2, "0")}` : "";
    const runSummary = runs.slice(0, 40).map((r) => {
      const dur = r.hour || r.minutes ? `${r.hour || 0}h${r.minutes || 0}m${r.second || 0}s` : "";
      return [
        `${r.date?.toString().slice(0, 10)}`,
        r.running_type ? r.running_type : "",
        r.distance_km ? `${parseFloat(r.distance_km).toFixed(1)}km` : "",
        dur,
        r.average_pace ? `\u914D\u901F${fmtPace(parseFloat(r.average_pace) * 60)}` : "",
        r.average_heart_rate ? `\u5FC3\u7387${r.average_heart_rate}bpm` : "",
        r.average_cadence ? `\u6B65\u983B${parseFloat(r.average_cadence).toFixed(0)}spm` : ""
      ].filter(Boolean).join(" ");
    }).join("\n");
    const pastRaceSummary = pastRaces.slice(0, 10).map((r) => {
      const t2 = fmtTime(r);
      return `${r.date?.toString().slice(0, 10)} ${r.race_name} ${parseFloat(r.distance_km || 0).toFixed(1)}km${t2 ? " \u5B8C\u6210:" + t2 : ""}${r.is_pb ? " PB" : ""}`;
    }).join("\n");
    const upcomingRaceSummary = upcomingRaces.slice(0, 5).map(
      (r) => `${r.date?.toString().slice(0, 10)} ${r.race_name} ${parseFloat(r.distance_km || 0).toFixed(1)}km${r.location ? " @" + r.location : ""}`
    ).join("\n");
    const bodySummary = body ? `\u9AD4\u91CD:${body.weight}kg, \u9AD4\u8102:${body.body_fat_pct}%, \u808C\u8089\u91CF:${body.muscle_mass}kg, BMI:${body.bmi}, BMR:${body.bmr}kcal` : "\u7121\u6578\u64DA";
    const hrSummary = hr ? `\u975C\u606F\u5FC3\u7387:${hr.resting_hr}bpm, \u6700\u5927\u5FC3\u7387:${hr.high_hr}bpm, HRV:${hr.hrv}ms, \u5E73\u5747\u5FC3\u7387:${hr.avg_hr}bpm` : "\u7121\u6578\u64DA";
    const sleepSummary = sleep ? `\u5E73\u5747\u7761\u7720\u8A55\u5206:${parseFloat(sleep.avg_score || 0).toFixed(0)}, \u5E73\u5747\u7761\u7720\u6642\u9577:${parseFloat(sleep.avg_duration || 0).toFixed(1)}h, \u5E73\u5747HRV:${parseFloat(sleep.avg_hrv || 0).toFixed(0)}ms, \u8EAB\u9AD4\u96FB\u91CF:${parseFloat(sleep.avg_battery || 0).toFixed(0)}` : "\u7121\u6578\u64DA";
    const shoesSummary = shoes.map((s) => `${s.shoes_name}${s.brand ? " (" + s.brand + ")" : ""} \u5DF2\u8DD1${parseFloat(s.total_km || 0).toFixed(0)}km`).join(", ");
    const res = await invokeLLM({
      messages: [
        { role: "system", content: "\u4F60\u662F\u4E00\u4F4D\u5C08\u696D\u99AC\u62C9\u677E\u6559\u7DF4\u548C\u904B\u52D5\u79D1\u5B78\u5BB6\uFF0C\u64C5\u9577\u70BA\u8DD1\u8005\u5236\u5B9A\u500B\u4EBA\u5316\u8A13\u7DF4\u8A08\u5283\u3002\u8ACB\u7528\u7E41\u9AD4\u4E2D\u6587\u56DE\u7B54\uFF0C\u7D50\u69CB\u6E05\u6670\uFF0C\u4F7F\u7528 Markdown \u683C\u5F0F\u3002" },
        { role: "user", content: `\u8ACB\u6839\u64DA\u4EE5\u4E0B\u6211\u7684\u5168\u9762\u5065\u5EB7\u548C\u8A13\u7DF4\u6578\u64DA\uFF0C\u70BA\u6211\u5236\u5B9A\u4E00\u4EFD\u500B\u4EBA\u5316${input.planWeeks}\u9031\u8A13\u7DF4\u8A08\u5283\u3002

## \u76EE\u6A19\u8CFD\u4E8B
${goalDesc || "\u66AB\u672A\u6307\u5B9A\u76EE\u6A19\u8CFD\u4E8B"}
${goalTimeDesc}

## \u8FD1\u671F\u8A13\u7DF4\u8A18\u9304 (\u6700\u8FD1${runs.length}\u6B21)
${runSummary || "\u7121\u8A18\u9304"}

## \u904E\u5F80\u8CFD\u4E8B\u6210\u7E3E
${pastRaceSummary || "\u7121\u8A18\u9304"}

## \u5373\u5C07\u5230\u4F86\u7684\u8CFD\u4E8B
${upcomingRaceSummary || "\u7121\u8A18\u9304"}

## \u8EAB\u9AD4\u7D44\u6210
${bodySummary}

## \u5FC3\u7387\u6578\u64DA
${hrSummary}

## \u8FD12\u9031\u7761\u7720\u6062\u5FA9
${sleepSummary}

## \u73FE\u6709\u8DD1\u978B (Active)
${shoesSummary || "\u7121\u8A18\u9304"}

\u8ACB\u63D0\u4F9B\u4EE5\u4E0B\u5B8C\u6574\u8A13\u7DF4\u8A08\u5283:

### 1. \u8A13\u7DF4\u76EE\u6A19\u8207\u73FE\u6CC1\u8A55\u4F30
\u6839\u64DA\u6211\u7684\u6578\u64DA\u8A55\u4F30\u76EE\u524D\u6C34\u5E73\uFF0C\u8A2D\u5B9A\u5408\u7406\u7684\u8A13\u7DF4\u76EE\u6A19

### 2. ${input.planWeeks}\u9031\u8A13\u7DF4\u8A08\u5283\u6982\u89BD
\u4EE5\u9031\u70BA\u55AE\u4F4D\uFF0C\u8AAA\u660E\u6BCF\u9031\u8A13\u7DF4\u91CD\u9EDE\u3001\u7E3D\u91CC\u7A0B\u3001\u5F37\u5EA6\u5206\u5E03\uFF08\u8F15\u9B06\u8DD1/\u7BC0\u594F\u8DD1/\u9593\u6B47/\u9577\u8DD1\u6BD4\u4F8B\uFF09

### 3. \u7B2C1-4\u9031\u8A73\u7D30\u9031\u8A08\u5283\uFF08\u57FA\u790E\u5EFA\u7ACB\u671F\uFF09
\u6BCF\u9031\u5217\u51FA7\u5929\u7684\u5177\u9AD4\u8A13\u7DF4\u5B89\u6392\uFF08\u4F11\u606F/\u8F15\u9B06\u8DD1/\u4EA4\u53C9\u8A13\u7DF4/\u7BC0\u594F\u8DD1/\u9593\u6B47/\u9577\u8DD1\uFF09\uFF0C\u5305\u62EC\u8DDD\u96E2\u3001\u914D\u901F\u76EE\u6A19\u3001\u5FC3\u7387\u5340\u9593

### 4. \u7B2C5-8\u9031\u8A73\u7D30\u9031\u8A08\u5283\uFF08\u5F37\u5316\u671F\uFF09
\u6BCF\u9031\u5217\u51FA7\u5929\u7684\u5177\u9AD4\u8A13\u7DF4\u5B89\u6392\uFF0C\u9010\u6B65\u63D0\u5347\u5F37\u5EA6\u548C\u91CC\u7A0B

### 5. \u7B2C9-${input.planWeeks}\u9031\u8A73\u7D30\u9031\u8A08\u5283\uFF08\u8CFD\u524D\u6E96\u5099/\u6E1B\u91CF\u671F\uFF09
\u6700\u5F8C\u5E7E\u9031\u7684\u6E1B\u91CF\u7B56\u7565\u548C\u8CFD\u524D\u8ABF\u6574

### 6. \u95DC\u9375\u8A13\u7DF4\u8AB2\u7A0B\u8AAA\u660E
\u89E3\u91CB\u8A08\u5283\u4E2D\u7684\u6838\u5FC3\u8A13\u7DF4\u8AB2\u7A0B\uFF08\u5982\u4E73\u9178\u9580\u6ABB\u8DD1\u3001VO2max\u9593\u6B47\u7B49\uFF09\u7684\u5177\u9AD4\u57F7\u884C\u65B9\u6CD5

### 7. \u6062\u5FA9\u8207\u5065\u5EB7\u7BA1\u7406
\u6839\u64DA\u6211\u7684\u7761\u7720\u548CHRV\u6578\u64DA\uFF0C\u63D0\u4F9B\u6062\u5FA9\u5EFA\u8B70\uFF1B\u4F55\u6642\u61C9\u8A72\u8ABF\u6574\u8A13\u7DF4\u5F37\u5EA6

### 8. \u8DD1\u978B\u4F7F\u7528\u5EFA\u8B70
\u6839\u64DA\u8A13\u7DF4\u985E\u578B\u548C\u91CC\u7A0B\uFF0C\u5EFA\u8B70\u4E0D\u540C\u8A13\u7DF4\u65E5\u4F7F\u7528\u54EA\u96D9\u8DD1\u978B

### 9. \u71DF\u990A\u8207\u88DC\u6C34\u7B56\u7565
\u9577\u8DD1\u548C\u6BD4\u8CFD\u65E5\u7684\u88DC\u7D66\u5EFA\u8B70` }
      ]
    });
    return { plan: res.choices[0]?.message?.content ?? "\u751F\u6210\u5931\u6557\uFF0C\u8ACB\u7A0D\u5F8C\u518D\u8A66\u3002" };
  }),
  // ─── Shoe Locker CRUD ────────────────────────────────────────────────────────
  getShoes: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.execute(sql2`
        SELECT s.*,
          COALESCE(s.initial_km::numeric, 0) + COALESCE(SUM(r.distance_km::numeric), 0) AS total_km,
          COALESCE(COUNT(r.id), 0) AS run_count,
          COALESCE(s.max_km, 800) AS max_km
        FROM running_shoes s
        LEFT JOIN running_logs r ON (r.shoes_id = s.id OR (r.shoes_id IS NULL AND r.running_shoes = s.shoes_name))
        GROUP BY s.id
        ORDER BY s.status ASC, s.shoes_name ASC
      `);
    return rows.rows ?? rows;
  }),
  addShoe: publicProcedure.input(z2.object({
    shoesName: z2.string().min(1),
    brand: z2.string().optional(),
    model: z2.string().optional(),
    status: z2.string().optional().default("Active"),
    purchaseDate: z2.string().optional(),
    retirementDate: z2.string().optional(),
    initialKm: z2.number().optional().default(0),
    maxKm: z2.number().optional().default(800),
    notes: z2.string().optional(),
    price: z2.number().optional(),
    firstUseDate: z2.string().optional(),
    photoUrl: z2.string().optional()
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.execute(sql2`
        INSERT INTO running_shoes (shoes_name, brand, model, status, purchase_date, retirement_date, initial_km, max_km, notes, price, firstusedate, photo_url)
        VALUES (${input.shoesName}, ${input.brand ?? null}, ${input.model ?? null}, ${input.status ?? "Active"},
          ${input.purchaseDate ?? null}, ${input.retirementDate ?? null}, ${input.initialKm ?? 0},
          ${input.maxKm ?? 800},
          ${input.notes ?? null}, ${input.price ?? null}, ${input.firstUseDate ?? null}, ${input.photoUrl ?? null})
      `);
    return { success: true };
  }),
  updateShoe: publicProcedure.input(z2.object({
    id: z2.number(),
    shoesName: z2.string().min(1).optional(),
    brand: z2.string().optional(),
    model: z2.string().optional(),
    status: z2.string().optional(),
    purchaseDate: z2.string().optional(),
    retirementDate: z2.string().optional(),
    initialKm: z2.number().optional(),
    maxKm: z2.number().optional(),
    notes: z2.string().optional(),
    price: z2.number().optional(),
    firstUseDate: z2.string().optional(),
    photoUrl: z2.string().optional()
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const { id, ...fields } = input;
    const sets = [];
    const vals = [];
    if (fields.shoesName !== void 0) {
      sets.push(`shoes_name = $${sets.length + 1}`);
      vals.push(fields.shoesName);
    }
    if (fields.brand !== void 0) {
      sets.push(`brand = $${sets.length + 1}`);
      vals.push(fields.brand);
    }
    if (fields.model !== void 0) {
      sets.push(`model = $${sets.length + 1}`);
      vals.push(fields.model);
    }
    if (fields.status !== void 0) {
      sets.push(`status = $${sets.length + 1}`);
      vals.push(fields.status);
    }
    if (fields.purchaseDate !== void 0) {
      sets.push(`purchase_date = $${sets.length + 1}`);
      vals.push(fields.purchaseDate);
    }
    if (fields.retirementDate !== void 0) {
      sets.push(`retirement_date = $${sets.length + 1}`);
      vals.push(fields.retirementDate);
    }
    if (fields.initialKm !== void 0) {
      sets.push(`initial_km = $${sets.length + 1}`);
      vals.push(fields.initialKm);
    }
    if (fields.maxKm !== void 0) {
      sets.push(`max_km = $${sets.length + 1}`);
      vals.push(fields.maxKm);
    }
    if (fields.notes !== void 0) {
      sets.push(`notes = $${sets.length + 1}`);
      vals.push(fields.notes);
    }
    if (fields.price !== void 0) {
      sets.push(`price = $${sets.length + 1}`);
      vals.push(fields.price);
    }
    if (fields.firstUseDate !== void 0) {
      sets.push(`firstusedate = $${sets.length + 1}`);
      vals.push(fields.firstUseDate);
    }
    if (fields.photoUrl !== void 0) {
      sets.push(`photo_url = $${sets.length + 1}`);
      vals.push(fields.photoUrl);
    }
    if (sets.length === 0) return { success: true };
    vals.push(id);
    const { Client } = (await import("pg")).default;
    const client = new Client({ connectionString: process.env.SUPABASE_DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();
    await client.query(`UPDATE running_shoes SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $${vals.length}`, vals);
    await client.end();
    return { success: true };
  }),
  deleteShoe: ownerProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.execute(sql2`DELETE FROM running_shoes WHERE id = ${input.id}`);
    return { success: true };
  }),
  getShoeRunHistory: publicProcedure.input(z2.object({ shoeId: z2.number().optional(), shoeName: z2.string().optional() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.execute(sql2`
        SELECT id, date, distance_km, hour, minutes, second, average_pace, average_heart_rate,
               average_cadence, calories, running_type, notes
        FROM running_logs
        WHERE (${input.shoeId ?? null}::bigint IS NOT NULL AND (shoes_id = ${input.shoeId ?? null} OR (shoes_id IS NULL AND running_shoes = ${input.shoeName ?? null})))
           OR (${input.shoeId ?? null}::bigint IS NULL AND running_shoes = ${input.shoeName ?? null})
        ORDER BY date DESC
        LIMIT 200
      `);
    return rows.rows ?? rows;
  }),
  // ─── Races CRUD ──────────────────────────────────────────────────────────────
  getRaces: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.execute(sql2`
        SELECT id, race_name, date, distance_km, location, registration, bib_no, is_pb,
          finish_time, finish_hr, finish_min, finish_sec, target_hr, target_min, target_sec,
          overall_place, age_group_place, gender_group_place, running_shoes, shoes_id, notes,
          created_at, updated_at
        FROM races ORDER BY date DESC
      `);
    return rows.rows ?? rows;
  }),
  addRace: publicProcedure.input(z2.object({
    raceName: z2.string().min(1),
    date: z2.string(),
    distanceKm: z2.number().optional(),
    location: z2.string().optional(),
    registration: z2.string().optional(),
    bibNo: z2.string().optional(),
    isPb: z2.boolean().optional().default(false),
    finishTime: z2.string().optional(),
    finishHr: z2.number().optional(),
    finishMin: z2.number().optional(),
    finishSec: z2.number().optional(),
    targetHr: z2.number().optional(),
    targetMin: z2.number().optional(),
    targetSec: z2.number().optional(),
    overallPlace: z2.number().optional(),
    ageGroupPlace: z2.number().optional(),
    genderGroupPlace: z2.number().optional(),
    runningShoes: z2.string().optional(),
    shoesId: z2.number().optional(),
    notes: z2.string().optional()
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.execute(sql2`
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
  updateRace: publicProcedure.input(z2.object({
    id: z2.number(),
    raceName: z2.string().optional(),
    date: z2.string().optional(),
    distanceKm: z2.number().optional(),
    location: z2.string().optional(),
    registration: z2.string().optional(),
    bibNo: z2.string().optional(),
    isPb: z2.boolean().optional(),
    finishTime: z2.string().optional(),
    finishHr: z2.number().optional(),
    finishMin: z2.number().optional(),
    finishSec: z2.number().optional(),
    targetHr: z2.number().optional(),
    targetMin: z2.number().optional(),
    targetSec: z2.number().optional(),
    overallPlace: z2.number().optional(),
    ageGroupPlace: z2.number().optional(),
    genderGroupPlace: z2.number().optional(),
    runningShoes: z2.string().optional(),
    shoesId: z2.number().optional(),
    notes: z2.string().optional()
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const { id, ...f } = input;
    const sets = [];
    const vals = [];
    if (f.raceName !== void 0) {
      sets.push(`race_name = $${sets.length + 1}`);
      vals.push(f.raceName);
    }
    if (f.date !== void 0) {
      sets.push(`date = $${sets.length + 1}`);
      vals.push(f.date);
    }
    if (f.distanceKm !== void 0) {
      sets.push(`distance_km = $${sets.length + 1}`);
      vals.push(f.distanceKm);
    }
    if (f.location !== void 0) {
      sets.push(`location = $${sets.length + 1}`);
      vals.push(f.location);
    }
    if (f.registration !== void 0) {
      sets.push(`registration = $${sets.length + 1}`);
      vals.push(f.registration);
    }
    if (f.bibNo !== void 0) {
      sets.push(`bib_no = $${sets.length + 1}`);
      vals.push(f.bibNo);
    }
    if (f.isPb !== void 0) {
      sets.push(`is_pb = $${sets.length + 1}`);
      vals.push(f.isPb);
    }
    if (f.finishTime !== void 0) {
      sets.push(`finish_time = $${sets.length + 1}`);
      vals.push(f.finishTime);
    }
    if (f.finishHr !== void 0) {
      sets.push(`finish_hr = $${sets.length + 1}`);
      vals.push(f.finishHr);
    }
    if (f.finishMin !== void 0) {
      sets.push(`finish_min = $${sets.length + 1}`);
      vals.push(f.finishMin);
    }
    if (f.finishSec !== void 0) {
      sets.push(`finish_sec = $${sets.length + 1}`);
      vals.push(f.finishSec);
    }
    if (f.targetHr !== void 0) {
      sets.push(`target_hr = $${sets.length + 1}`);
      vals.push(f.targetHr);
    }
    if (f.targetMin !== void 0) {
      sets.push(`target_min = $${sets.length + 1}`);
      vals.push(f.targetMin);
    }
    if (f.targetSec !== void 0) {
      sets.push(`target_sec = $${sets.length + 1}`);
      vals.push(f.targetSec);
    }
    if (f.overallPlace !== void 0) {
      sets.push(`overall_place = $${sets.length + 1}`);
      vals.push(f.overallPlace);
    }
    if (f.ageGroupPlace !== void 0) {
      sets.push(`age_group_place = $${sets.length + 1}`);
      vals.push(f.ageGroupPlace);
    }
    if (f.genderGroupPlace !== void 0) {
      sets.push(`gender_group_place = $${sets.length + 1}`);
      vals.push(f.genderGroupPlace);
    }
    if (f.runningShoes !== void 0) {
      sets.push(`running_shoes = $${sets.length + 1}`);
      vals.push(f.runningShoes);
    }
    if (f.shoesId !== void 0) {
      sets.push(`shoes_id = $${sets.length + 1}`);
      vals.push(f.shoesId);
    }
    if (f.notes !== void 0) {
      sets.push(`notes = $${sets.length + 1}`);
      vals.push(f.notes);
    }
    if (sets.length === 0) return { success: true };
    vals.push(id);
    const { Client } = (await import("pg")).default;
    const client = new Client({ connectionString: process.env.SUPABASE_DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();
    await client.query(`UPDATE races SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $${vals.length}`, vals);
    await client.end();
    return { success: true };
  }),
  deleteRace: ownerProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.execute(sql2`DELETE FROM races WHERE id = ${input.id}`);
    return { success: true };
  }),
  getPBs: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.execute(sql2`
        SELECT DISTINCT ON (distance_km) distance_km, race_name, date, finish_time,
          finish_hr, finish_min, finish_sec, location
        FROM races
        WHERE is_pb = true AND (finish_hr IS NOT NULL OR finish_min IS NOT NULL OR finish_time IS NOT NULL)
        ORDER BY distance_km ASC,
          COALESCE(finish_hr, 0) * 3600 + COALESCE(finish_min, 0) * 60 + COALESCE(finish_sec, 0) ASC
      `);
    return rows.rows ?? rows;
  }),
  // Get all races enriched with matching running_log data (same date ± 1 day, distance within 10%)
  getRacesEnriched: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const raceRows = await db.execute(sql2`SELECT * FROM races ORDER BY date DESC`);
    const races3 = raceRows.rows ?? raceRows;
    const enriched = await Promise.all(races3.map(async (race) => {
      if (!race.date || !race.distance_km) return { ...race, runLog: null };
      const distKm = parseFloat(race.distance_km);
      const minDist = distKm * 0.9;
      const maxDist = distKm * 1.1;
      const logRows = await db.execute(sql2`
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
      const logData = (logRows.rows ?? logRows)[0] ?? null;
      return { ...race, runLog: logData };
    }));
    return enriched;
  }),
  analyzeRace: ownerProcedure.input(z2.object({ raceId: z2.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const raceRows = await db.execute(sql2`SELECT * FROM races WHERE id = ${input.raceId}`);
    const race = (raceRows.rows ?? raceRows)[0];
    if (!race) throw new Error("Race not found");
    const pbRows = await db.execute(sql2`
        SELECT distance_km, finish_time FROM races
        WHERE is_pb = true AND finish_time IS NOT NULL
        ORDER BY distance_km ASC
      `);
    const pbs = pbRows.rows ?? pbRows;
    const trainingRows = await db.execute(sql2`
        SELECT date, distance_km, average_pace, average_heart_rate, running_type
        FROM running_logs
        WHERE date >= (${race.date}::date - interval '12 weeks')::text
          AND date <= ${race.date}
        ORDER BY date DESC
        LIMIT 50
      `);
    const training = trainingRows.rows ?? trainingRows;
    const pbSummary = pbs.map((p) => `${parseFloat(p.distance_km).toFixed(1)}km: ${p.finish_time}`).join(", ");
    const trainingSummary = training.map(
      (r) => `${r.date}: ${parseFloat(r.distance_km || 0).toFixed(1)}km, \u914D\u901F${r.average_pace || "N/A"}, \u5FC3\u7387${r.average_heart_rate || "N/A"}bpm`
    ).join("\n");
    const res = await invokeLLM({
      messages: [
        { role: "system", content: "\u4F60\u662F\u4E00\u4F4D\u5C08\u696D\u99AC\u62C9\u677E\u6559\u7DF4\u548C\u904B\u52D5\u79D1\u5B78\u5206\u6790\u5E2B\u3002\u8ACB\u7528\u7E41\u9AD4\u4E2D\u6587\u56DE\u7B54\uFF0C\u7D50\u69CB\u6E05\u6670\u3002" },
        { role: "user", content: `\u8ACB\u5206\u6790\u4EE5\u4E0B\u8CFD\u4E8B\u8868\u73FE\u4E26\u63D0\u4F9B\u9810\u6E2C\u548C\u5EFA\u8B70\u3002

\u8CFD\u4E8B: ${race.race_name}
\u65E5\u671F: ${race.date}
\u8DDD\u96E2: ${race.distance_km}km
\u5B8C\u6210\u6642\u9593: ${race.finish_time || "\u5C1A\u672A\u5B8C\u6210"}
\u5730\u9EDE: ${race.location || "N/A"}
\u662F\u5426PB: ${race.is_pb ? "\u662F" : "\u5426"}
\u7E3D\u6392\u540D: ${race.overall_place || "N/A"}
\u6027\u5225\u6392\u540D: ${race.gender_group_place || "N/A"}
\u5E74\u9F61\u7D44\u6392\u540D: ${race.age_group_place || "N/A"}

\u500B\u4EBAPB\u8A18\u9304: ${pbSummary || "\u7121\u8A18\u9304"}

\u8CFD\u524D12\u9031\u8A13\u7DF4\u6458\u8981(\u6700\u8FD150\u6B21):
${trainingSummary || "\u7121\u8A13\u7DF4\u8A18\u9304"}

\u8ACB\u63D0\u4F9B:
1. \u8CFD\u4E8B\u8868\u73FE\u5206\u6790(\u8207PB\u6BD4\u8F03\u3001\u914D\u901F\u7B56\u7565\u8A55\u4F30)
2. \u8A13\u7DF4\u5145\u5206\u5EA6\u8A55\u4F30(\u8CFD\u524D\u6E96\u5099\u662F\u5426\u5145\u8DB3)
3. \u4E0B\u6B21\u540C\u8DDD\u96E2\u8CFD\u4E8B\u6642\u9593\u9810\u6E2C(\u57FA\u65BC\u8A13\u7DF4\u6578\u64DA)
4. \u5177\u9AD4\u6539\u9032\u5EFA\u8B70(3-5\u9805)` }
      ]
    });
    return { analysis: res.choices[0]?.message?.content ?? "\u5206\u6790\u5931\u6557\uFF0C\u8ACB\u7A0D\u5F8C\u518D\u8A66\u3002" };
  }),
  // ─── Running Log Photos ─────────────────────────────────────────────────────
  getLogPhotos: publicProcedure.input(z2.object({ runningLogId: z2.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(runningLogPhotos).where(and(eq2(runningLogPhotos.runningLogId, input.runningLogId), eq2(runningLogPhotos.userId, OWNER_USER_ID))).orderBy(runningLogPhotos.sortOrder, runningLogPhotos.createdAt);
  }),
  uploadLogPhoto: ownerProcedure.input(z2.object({ runningLogId: z2.number(), base64: z2.string(), mimeType: z2.string(), caption: z2.string().optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const buffer = Buffer.from(input.base64, "base64");
    const ext = input.mimeType.includes("png") ? "png" : "jpg";
    const key = `running-photos/${OWNER_USER_ID}/${input.runningLogId}/${nanoid()}.${ext}`;
    const { url } = await storagePut(key, buffer, input.mimeType);
    const existing = await db.select({ cnt: sql2`COUNT(*)` }).from(runningLogPhotos).where(and(eq2(runningLogPhotos.runningLogId, input.runningLogId), eq2(runningLogPhotos.userId, OWNER_USER_ID)));
    const sortOrder = Number(existing[0]?.cnt ?? 0);
    await db.insert(runningLogPhotos).values({ userId: OWNER_USER_ID, runningLogId: input.runningLogId, photoUrl: url, fileKey: key, caption: input.caption, sortOrder });
    return { url, key };
  }),
  deleteLogPhoto: ownerProcedure.input(z2.object({ photoId: z2.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.delete(runningLogPhotos).where(and(eq2(runningLogPhotos.id, input.photoId), eq2(runningLogPhotos.userId, OWNER_USER_ID)));
    return { success: true };
  })
});
var stepsRouter = router({
  getAll: publicProcedure.input(z2.object({ limit: z2.number().optional() }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.select().from(dailySteps).where(eq2(dailySteps.userId, OWNER_USER_ID)).orderBy(desc(dailySteps.date)).limit(input?.limit ?? 365);
    return rows;
  }),
  add: ownerProcedure.input(z2.object({
    date: z2.string(),
    steps: z2.number().optional(),
    floorsClimbed: z2.number().optional(),
    distanceKm: z2.string().optional(),
    activeMinutes: z2.number().optional(),
    calories: z2.number().optional(),
    notes: z2.string().optional()
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const [row] = await db.insert(dailySteps).values({
      userId: OWNER_USER_ID,
      date: input.date,
      steps: input.steps,
      floorsClimbed: input.floorsClimbed,
      distanceKm: input.distanceKm,
      activeMinutes: input.activeMinutes,
      calories: input.calories,
      notes: input.notes
    }).returning();
    return row;
  }),
  update: ownerProcedure.input(z2.object({
    id: z2.number(),
    date: z2.string().optional(),
    steps: z2.number().optional(),
    floorsClimbed: z2.number().optional(),
    distanceKm: z2.string().optional(),
    activeMinutes: z2.number().optional(),
    calories: z2.number().optional(),
    notes: z2.string().optional()
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const { id, ...rest } = input;
    const [row] = await db.update(dailySteps).set(rest).where(and(eq2(dailySteps.id, id), eq2(dailySteps.userId, OWNER_USER_ID))).returning();
    return row;
  }),
  delete: ownerProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.delete(dailySteps).where(and(eq2(dailySteps.id, input.id), eq2(dailySteps.userId, OWNER_USER_ID)));
    return { success: true };
  }),
  // ─── Step Log Photos ─────────────────────────────────────────────────────────
  getLogPhotos: publicProcedure.input(z2.object({ stepLogId: z2.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(stepLogPhotos).where(and(eq2(stepLogPhotos.stepLogId, input.stepLogId), eq2(stepLogPhotos.userId, OWNER_USER_ID))).orderBy(stepLogPhotos.sortOrder, stepLogPhotos.createdAt);
  }),
  uploadLogPhoto: ownerProcedure.input(z2.object({ stepLogId: z2.number(), base64: z2.string(), mimeType: z2.string(), caption: z2.string().optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const buffer = Buffer.from(input.base64, "base64");
    const ext = input.mimeType.includes("png") ? "png" : "jpg";
    const key = `step-photos/${OWNER_USER_ID}/${input.stepLogId}/${nanoid()}.${ext}`;
    const { url } = await storagePut(key, buffer, input.mimeType);
    const existing = await db.select({ cnt: sql2`COUNT(*)` }).from(stepLogPhotos).where(and(eq2(stepLogPhotos.stepLogId, input.stepLogId), eq2(stepLogPhotos.userId, OWNER_USER_ID)));
    const sortOrder = Number(existing[0]?.cnt ?? 0);
    await db.insert(stepLogPhotos).values({ userId: OWNER_USER_ID, stepLogId: input.stepLogId, photoUrl: url, fileKey: key, caption: input.caption, sortOrder });
    return { url, key };
  }),
  deleteLogPhoto: ownerProcedure.input(z2.object({ photoId: z2.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.delete(stepLogPhotos).where(and(eq2(stepLogPhotos.id, input.photoId), eq2(stepLogPhotos.userId, OWNER_USER_ID)));
    return { success: true };
  })
});
var medicalRouter = router({
  getConditions: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(medicalConditions).where(eq2(medicalConditions.userId, OWNER_USER_ID)).orderBy(desc(medicalConditions.createdAt));
  }),
  addCondition: ownerProcedure.input(z2.object({
    title: z2.string(),
    category: z2.string().optional(),
    status: z2.string().optional(),
    startDate: z2.string().optional(),
    endDate: z2.string().optional(),
    notes: z2.string().optional()
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const [row] = await db.insert(medicalConditions).values({
      userId: OWNER_USER_ID,
      title: input.title,
      category: input.category,
      status: input.status ?? "active",
      startDate: input.startDate,
      endDate: input.endDate,
      notes: input.notes
    }).returning();
    return row;
  }),
  updateCondition: ownerProcedure.input(z2.object({
    id: z2.number(),
    title: z2.string().optional(),
    category: z2.string().optional(),
    status: z2.string().optional(),
    startDate: z2.string().optional(),
    endDate: z2.string().optional(),
    notes: z2.string().optional()
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const { id, ...rest } = input;
    const [row] = await db.update(medicalConditions).set({ ...rest, updatedAt: /* @__PURE__ */ new Date() }).where(and(eq2(medicalConditions.id, id), eq2(medicalConditions.userId, OWNER_USER_ID))).returning();
    return row;
  }),
  deleteCondition: ownerProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.delete(medicalConditions).where(and(eq2(medicalConditions.id, input.id), eq2(medicalConditions.userId, OWNER_USER_ID)));
    return { success: true };
  }),
  getVisits: publicProcedure.input(z2.object({ conditionId: z2.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(medicalVisits).where(and(eq2(medicalVisits.conditionId, input.conditionId), eq2(medicalVisits.userId, OWNER_USER_ID))).orderBy(desc(medicalVisits.visitDate));
  }),
  addVisit: ownerProcedure.input(z2.object({
    conditionId: z2.number(),
    visitDate: z2.string(),
    visitType: z2.string().optional(),
    doctorName: z2.string().optional(),
    clinic: z2.string().optional(),
    diagnosis: z2.string().optional(),
    prescription: z2.string().optional(),
    followUpDate: z2.string().optional(),
    notes: z2.string().optional()
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const [row] = await db.insert(medicalVisits).values({
      conditionId: input.conditionId,
      userId: OWNER_USER_ID,
      visitDate: input.visitDate,
      visitType: input.visitType,
      doctorName: input.doctorName,
      clinic: input.clinic,
      diagnosis: input.diagnosis,
      prescription: input.prescription,
      followUpDate: input.followUpDate,
      notes: input.notes
    }).returning();
    return row;
  }),
  updateVisit: ownerProcedure.input(z2.object({
    id: z2.number(),
    visitDate: z2.string().optional(),
    visitType: z2.string().optional(),
    doctorName: z2.string().optional(),
    clinic: z2.string().optional(),
    diagnosis: z2.string().optional(),
    prescription: z2.string().optional(),
    followUpDate: z2.string().optional(),
    notes: z2.string().optional()
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const { id, ...rest } = input;
    const [row] = await db.update(medicalVisits).set(rest).where(and(eq2(medicalVisits.id, id), eq2(medicalVisits.userId, OWNER_USER_ID))).returning();
    return row;
  }),
  deleteVisit: ownerProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.delete(medicalVisits).where(and(eq2(medicalVisits.id, input.id), eq2(medicalVisits.userId, OWNER_USER_ID)));
    return { success: true };
  }),
  getAttachments: publicProcedure.input(z2.object({ visitId: z2.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(medicalAttachments).where(and(eq2(medicalAttachments.visitId, input.visitId), eq2(medicalAttachments.userId, OWNER_USER_ID))).orderBy(desc(medicalAttachments.createdAt));
  }),
  uploadAttachment: ownerProcedure.input(z2.object({
    visitId: z2.number(),
    fileName: z2.string(),
    fileType: z2.string(),
    fileBase64: z2.string(),
    attachmentType: z2.string().optional(),
    notes: z2.string().optional()
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const buffer = Buffer.from(input.fileBase64, "base64");
    const key = `medical/${OWNER_USER_ID}/${nanoid()}-${input.fileName}`;
    const { url } = await storagePut(key, buffer, input.fileType);
    const [row] = await db.insert(medicalAttachments).values({
      visitId: input.visitId,
      userId: OWNER_USER_ID,
      fileName: input.fileName,
      fileType: input.fileType,
      fileKey: key,
      fileUrl: url,
      attachmentType: input.attachmentType,
      notes: input.notes
    }).returning();
    return row;
  }),
  deleteAttachment: ownerProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.delete(medicalAttachments).where(and(eq2(medicalAttachments.id, input.id), eq2(medicalAttachments.userId, OWNER_USER_ID)));
    return { success: true };
  })
});
var supplementsRouter = router({
  getAll: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(supplements).where(eq2(supplements.userId, OWNER_USER_ID)).orderBy(supplements.name);
  }),
  add: publicProcedure.input(z2.object({
    name: z2.string(),
    brand: z2.string().optional(),
    category: z2.string().optional(),
    servingSize: z2.string().optional(),
    currentStock: z2.number().optional(),
    lowStockThreshold: z2.number().optional(),
    purchaseDate: z2.string().optional(),
    expiryDate: z2.string().optional(),
    notes: z2.string().optional(),
    reminderEnabled: z2.boolean().optional(),
    reminderTime: z2.string().max(5).optional(),
    description: z2.string().optional(),
    descriptionZh: z2.string().optional(),
    iherbUrl: z2.string().optional(),
    dailyDose: z2.number().optional(),
    timeOfDay: z2.string().optional()
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const [row] = await db.insert(supplements).values({
      userId: OWNER_USER_ID,
      ...input
    }).returning();
    return row;
  }),
  update: publicProcedure.input(z2.object({
    id: z2.number(),
    name: z2.string().optional(),
    brand: z2.string().optional(),
    category: z2.string().optional(),
    servingSize: z2.string().optional(),
    currentStock: z2.number().optional(),
    lowStockThreshold: z2.number().optional(),
    purchaseDate: z2.string().optional(),
    expiryDate: z2.string().optional(),
    notes: z2.string().optional(),
    isActive: z2.boolean().optional(),
    reminderEnabled: z2.boolean().optional(),
    reminderTime: z2.string().max(5).optional(),
    description: z2.string().optional(),
    descriptionZh: z2.string().optional(),
    iherbUrl: z2.string().optional(),
    dailyDose: z2.number().optional(),
    timeOfDay: z2.string().optional()
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const { id, ...rest } = input;
    const [row] = await db.update(supplements).set({ ...rest, updatedAt: /* @__PURE__ */ new Date() }).where(and(eq2(supplements.id, id), eq2(supplements.userId, OWNER_USER_ID))).returning();
    return row;
  }),
  delete: ownerProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.delete(supplements).where(and(eq2(supplements.id, input.id), eq2(supplements.userId, OWNER_USER_ID)));
    return { success: true };
  }),
  getLogs: publicProcedure.input(z2.object({ supplementId: z2.number().optional(), limit: z2.number().optional() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    const conditions = [eq2(supplementLogs.userId, OWNER_USER_ID)];
    if (input.supplementId) conditions.push(eq2(supplementLogs.supplementId, input.supplementId));
    return db.select().from(supplementLogs).where(and(...conditions)).orderBy(desc(supplementLogs.date)).limit(input.limit ?? 200);
  }),
  addLog: ownerProcedure.input(z2.object({
    supplementId: z2.number(),
    date: z2.string(),
    quantity: z2.number().optional(),
    timeOfDay: z2.string().optional(),
    notes: z2.string().optional()
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const [row] = await db.insert(supplementLogs).values({
      supplementId: input.supplementId,
      userId: OWNER_USER_ID,
      date: input.date,
      quantity: input.quantity ?? 1,
      timeOfDay: input.timeOfDay,
      notes: input.notes
    }).returning();
    await db.execute(sql2`UPDATE supplements SET current_stock = GREATEST(0, current_stock - ${input.quantity ?? 1}), "updatedAt" = NOW() WHERE id = ${input.supplementId} AND "userId" = ${OWNER_USER_ID}`);
    return row;
  }),
  deleteLog: ownerProcedure.input(z2.object({ id: z2.number(), quantity: z2.number().optional(), supplementId: z2.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.delete(supplementLogs).where(and(eq2(supplementLogs.id, input.id), eq2(supplementLogs.userId, OWNER_USER_ID)));
    await db.execute(sql2`UPDATE supplements SET current_stock = current_stock + ${input.quantity ?? 1}, "updatedAt" = NOW() WHERE id = ${input.supplementId} AND "userId" = ${OWNER_USER_ID}`);
    return { success: true };
  }),
  restockSupplement: ownerProcedure.input(z2.object({ id: z2.number(), quantity: z2.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const [supp] = await db.select({ stock: supplements.currentStock }).from(supplements).where(and(eq2(supplements.id, input.id), eq2(supplements.userId, OWNER_USER_ID)));
    const stockAfter = (supp?.stock ?? 0) + input.quantity;
    await db.execute(sql2`UPDATE supplements SET current_stock = current_stock + ${input.quantity}, "updatedAt" = NOW() WHERE id = ${input.id} AND "userId" = ${OWNER_USER_ID}`);
    await db.insert(supplementStockAdjustments).values({
      supplementId: input.id,
      userId: OWNER_USER_ID,
      adjustDate: todayHK(),
      adjustType: "manual_add",
      delta: input.quantity,
      stockAfter,
      reason: "Manual restock"
    });
    return { success: true };
  }),
  // ─── Purchase Records ───────────────────────────────────────────────────────
  getPurchases: publicProcedure.input(z2.object({ supplementId: z2.number().nullish() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    const conditions = [eq2(supplementPurchases.userId, OWNER_USER_ID)];
    if (input.supplementId) conditions.push(eq2(supplementPurchases.supplementId, input.supplementId));
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
      createdAt: supplementPurchases.createdAt
    }).from(supplementPurchases).leftJoin(supplements, eq2(supplementPurchases.supplementId, supplements.id)).where(and(...conditions)).orderBy(desc(supplementPurchases.purchaseDate));
  }),
  addPurchase: ownerProcedure.input(z2.object({
    supplementId: z2.number(),
    purchaseDate: z2.string(),
    quantity: z2.number(),
    unitPrice: z2.string().optional(),
    totalPrice: z2.string().optional(),
    currency: z2.string().optional(),
    source: z2.string().optional(),
    orderNo: z2.string().optional(),
    notes: z2.string().optional(),
    addToStock: z2.boolean().optional()
    // whether to add quantity to current stock
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const { addToStock, ...purchaseData } = input;
    const [row] = await db.insert(supplementPurchases).values({
      ...purchaseData,
      userId: OWNER_USER_ID
    }).returning();
    if (addToStock) {
      const [supp] = await db.select({ stock: supplements.currentStock }).from(supplements).where(eq2(supplements.id, input.supplementId));
      const stockAfter = (supp?.stock ?? 0) + input.quantity;
      await db.execute(sql2`UPDATE supplements SET current_stock = current_stock + ${input.quantity}, "updatedAt" = NOW() WHERE id = ${input.supplementId} AND "userId" = ${OWNER_USER_ID}`);
      await db.insert(supplementStockAdjustments).values({
        supplementId: input.supplementId,
        userId: OWNER_USER_ID,
        adjustDate: input.purchaseDate,
        adjustType: "purchase",
        delta: input.quantity,
        stockAfter,
        reason: `Purchase from ${input.source ?? "iHerb"}`
      });
    }
    return row;
  }),
  updatePurchase: ownerProcedure.input(z2.object({
    id: z2.number(),
    purchaseDate: z2.string().optional(),
    quantity: z2.number().optional(),
    unitPrice: z2.string().optional(),
    totalPrice: z2.string().optional(),
    currency: z2.string().optional(),
    source: z2.string().optional(),
    orderNo: z2.string().optional(),
    notes: z2.string().optional()
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const { id, ...rest } = input;
    const [row] = await db.update(supplementPurchases).set({ ...rest, updatedAt: /* @__PURE__ */ new Date() }).where(and(eq2(supplementPurchases.id, id), eq2(supplementPurchases.userId, OWNER_USER_ID))).returning();
    return row;
  }),
  deletePurchase: ownerProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.delete(supplementPurchases).where(and(eq2(supplementPurchases.id, input.id), eq2(supplementPurchases.userId, OWNER_USER_ID)));
    return { success: true };
  }),
  // ─── Stock Adjustments ──────────────────────────────────────────────────────
  getStockHistory: publicProcedure.input(z2.object({ supplementId: z2.number().nullish(), limit: z2.number().optional() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    const conditions = [eq2(supplementStockAdjustments.userId, OWNER_USER_ID)];
    if (input.supplementId) conditions.push(eq2(supplementStockAdjustments.supplementId, input.supplementId));
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
      createdAt: supplementStockAdjustments.createdAt
    }).from(supplementStockAdjustments).leftJoin(supplements, eq2(supplementStockAdjustments.supplementId, supplements.id)).where(and(...conditions)).orderBy(desc(supplementStockAdjustments.adjustDate)).limit(input.limit ?? 200);
  }),
  addStockAdjustment: ownerProcedure.input(z2.object({
    supplementId: z2.number(),
    adjustDate: z2.string(),
    adjustType: z2.string(),
    delta: z2.number(),
    reason: z2.string().optional(),
    notes: z2.string().optional()
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const [supp] = await db.select({ stock: supplements.currentStock }).from(supplements).where(and(eq2(supplements.id, input.supplementId), eq2(supplements.userId, OWNER_USER_ID)));
    const stockAfter = (supp?.stock ?? 0) + input.delta;
    await db.execute(sql2`UPDATE supplements SET current_stock = GREATEST(0, current_stock + ${input.delta}), "updatedAt" = NOW() WHERE id = ${input.supplementId} AND "userId" = ${OWNER_USER_ID}`);
    const [row] = await db.insert(supplementStockAdjustments).values({
      ...input,
      userId: OWNER_USER_ID,
      stockAfter: Math.max(0, stockAfter)
    }).returning();
    return row;
  })
});
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    })
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
  supplements: supplementsRouter
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/reminderHandler.ts
import { gte as gte2, sql as sql3 } from "drizzle-orm";
async function dailyReminderHandler(req, res) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) {
      return res.status(403).json({ error: "cron-only endpoint" });
    }
    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "DB unavailable" });
    }
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const todayStart = new Date(today);
    const [todayMeals, todayWorkouts, todayBody, todaySleepLogs] = await Promise.all([
      db.select().from(mealLogs).where(sql3`${mealLogs.loggedAt} >= ${today}`).limit(1),
      db.select().from(workoutSessions).where(sql3`${workoutSessions.startTime} >= ${todayStart}`).limit(1),
      db.select().from(bodyComposition).where(gte2(bodyComposition.date, today)).limit(1),
      db.select().from(sleepLogs).where(gte2(sleepLogs.date, today)).limit(1)
    ]);
    const missing = [];
    if (todayMeals.length === 0) missing.push("\u{1F37D}\uFE0F Meals");
    if (todayWorkouts.length === 0) missing.push("\u{1F4AA} Workout");
    if (todayBody.length === 0) missing.push("\u2696\uFE0F Body Metrics");
    if (todaySleepLogs.length === 0) missing.push("\u{1F634} Sleep");
    if (missing.length === 0) {
      return res.json({ ok: true, message: "All entries logged for today \u2014 great job!" });
    }
    const content = `You haven't logged the following today (${today}):

${missing.join("\n")}

Open BodyFit AI Hub to log your data and stay on track with your health goals! \u{1F4AA}`;
    await notifyOwner({
      title: "BodyFit Daily Reminder \u{1F3CB}\uFE0F",
      content
    });
    return res.json({ ok: true, reminded: missing });
  } catch (err) {
    const error = err;
    console.error("[daily-reminder] Error:", err);
    return res.status(500).json({
      error: error?.message ?? "Unknown error",
      stack: error?.stack,
      context: { url: req.url, taskUid: "unknown" },
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
}

// api/index.ts
import path from "path";
import fs from "fs";
var app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
registerStorageProxy(app);
registerOAuthRoutes(app);
app.get("/api/health", (_req, res) => res.json({ ok: true, version: "1.0.0" }));
app.post("/api/scheduled/daily-reminder", dailyReminderHandler);
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext
  })
);
var staticDir = path.join(process.cwd(), "dist/public");
if (fs.existsSync(staticDir)) {
  app.use(express.static(staticDir));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });
}
var index_default = app;
export {
  index_default as default
};
