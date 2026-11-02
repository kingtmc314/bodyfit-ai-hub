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
  json,
  jsonb,
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
  openId: varchar("open_id", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("login_method", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastSignedIn: timestamp("last_signed_in").defaultNow().notNull()
});
var userProfile = pgTable("user_profile", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  height: real("height"),
  // cm
  birthYear: integer("birth_year"),
  gender: varchar("gender", { length: 10 }),
  // 'male' | 'female'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var foodItems = pgTable("food_items", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  nameZh: varchar("name_zh", { length: 255 }),
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
  servingSize: real("serving_size"),
  servingUnit: varchar("serving_unit", { length: 50 }),
  isCustom: boolean("is_custom").notNull().default(false),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var mealLogs = pgTable("meal_logs", {
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
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var exercises = pgTable("exercises", {
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
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var workoutSessions = pgTable("workout_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }),
  notes: text("notes"),
  duration: integer("duration"),
  startTime: timestamp("start_time").defaultNow().notNull(),
  endTime: timestamp("end_time"),
  totalVolume: real("total_volume"),
  caloriesBurned: real("calories_burned"),
  templateKey: text("template_key"),
  plannedExercises: json("planned_exercises").$type(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var workoutSets = pgTable("workout_sets", {
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
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var bodyComposition = pgTable("body_composition", {
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
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var heartRateLogs = pgTable("heart_rate_logs", {
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
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var sleepLogs = pgTable("sleep_logs", {
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
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var progressPhotos = pgTable("progress_photos", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  photoUrl: text("photo_url").notNull(),
  fileKey: text("file_key").notNull(),
  angle: varchar("angle", { length: 50 }).default("front"),
  notes: text("notes"),
  weight: real("weight"),
  bodyFatPct: real("body_fat_pct"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var aiInsights = pgTable("ai_insights", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  period: varchar("period", { length: 50 }).notNull().default("weekly"),
  content: text("content").notNull(),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
  weekStart: text("week_start"),
  weekEnd: text("week_end")
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
  precipitation: real("precipitation"),
  weatherCode: integer("weather_code"),
  weatherCondition: text("weather_condition"),
  weatherLocation: text("weather_location"),
  weatherObservedAt: text("weather_observed_at"),
  weatherSource: text("weather_source"),
  garminDetails: jsonb("garmin_details").$type(),
  laps: jsonb("laps").$type(),
  timeSeries: jsonb("time_series").$type(),
  status: text("status"),
  notes: text("notes"),
  routeType: text("route_type"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var runningLabScenarios = pgTable("running_lab_scenarios", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  runningScenario: text("running_scenario").notNull(),
  easyRunDistance: text("easy_run_distance"),
  temperatureC: real("temperature_c").notNull(),
  humidityPct: integer("humidity_pct").notNull(),
  windKph: real("wind_kph").notNull(),
  baselinePaceSecPerKm: real("baseline_pace_sec_per_km"),
  baselineFinishSeconds: real("baseline_finish_seconds").notNull(),
  weatherPaceSecPerKm: real("weather_pace_sec_per_km").notNull(),
  weatherFinishSeconds: real("weather_finish_seconds").notNull(),
  weatherLoadPercent: real("weather_load_percent").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
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
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  goalType: goalTypeEnum("goal_type").notNull(),
  targetValue: real("target_value").notNull(),
  unit: varchar("unit", { length: 30 }),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
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
  temperature: real("temperature"),
  humidity: real("humidity"),
  windSpeed: real("wind_speed"),
  apparentTemp: real("apparent_temp"),
  precipitation: real("precipitation"),
  weatherCode: integer("weather_code"),
  weatherCondition: text("weather_condition"),
  weatherLocation: text("weather_location"),
  weatherObservedAt: text("weather_observed_at"),
  weatherSource: text("weather_source"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var favouriteExercises = pgTable("favourite_exercises", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  exerciseName: text("exercise_name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var dailySteps = pgTable("daily_steps", {
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
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var runningLogPhotos = pgTable("running_log_photos", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  runningLogId: integer("running_log_id").notNull().references(() => runningLogs.id, { onDelete: "cascade" }),
  photoUrl: text("photo_url").notNull(),
  fileKey: text("file_key").notNull(),
  caption: text("caption"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var stepLogPhotos = pgTable("step_log_photos", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  stepLogId: integer("step_log_id").notNull().references(() => dailySteps.id, { onDelete: "cascade" }),
  photoUrl: text("photo_url").notNull(),
  fileKey: text("file_key").notNull(),
  caption: text("caption"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var customExercises = pgTable("custom_exercises", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  nameZh: text("name_zh").default(""),
  muscleGroup: text("muscle_group").notNull().default("other"),
  equipment: text("equipment").notNull().default("Other"),
  instructions: text("instructions").default(""),
  photoUrl: text("photo_url"),
  fileKey: text("file_key"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var bloodPressureLogs = pgTable("blood_pressure_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  measuredAt: timestamp("measured_at").notNull(),
  systolic: integer("systolic").notNull(),
  diastolic: integer("diastolic").notNull(),
  pulse: integer("pulse"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var foodFavorites = pgTable("food_favorites", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  foodName: varchar("food_name", { length: 255 }).notNull(),
  calories: real("calories"),
  protein: real("protein"),
  carbs: real("carbs"),
  fat: real("fat"),
  servingSize: real("serving_size"),
  servingUnit: varchar("serving_unit", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var foodAnalysisHistory = pgTable("food_analysis_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  photoUrl: text("photo_url"),
  analysisResult: text("analysis_result").notNull(),
  totalCalories: real("total_calories"),
  analyzedAt: timestamp("analyzed_at").defaultNow().notNull()
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
function getPool() {
  return _pool;
}
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
        if (existingOwner.openId !== user.openId) {
          const conflictRow = await db.select().from(users).where(eq(users.openId, user.openId)).limit(1).then((r) => r[0] ?? null);
          if (conflictRow && conflictRow.id !== existingOwner.id) {
            const placeholderOpenId = `_merged_${conflictRow.id}_${Date.now()}`;
            await db.update(users).set({ openId: placeholderOpenId }).where(eq(users.id, conflictRow.id));
            console.log(`[Auth] Reassigned conflicting openId=${user.openId} from user.id=${conflictRow.id} to placeholder`);
          }
        }
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
var ownerProcedure = t.procedure;

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
import { eq as eq2, and, desc, gte, like, or, sql as sql2, inArray } from "drizzle-orm";

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
    model,
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
    maxTokens,
    max_tokens,
    reasoning,
    thinking
  } = params;
  const selectedModel = model || "gemini-2.5-flash";
  const usesOpenAiTokenShape = selectedModel.startsWith("gpt-");
  const payload = {
    model: selectedModel,
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
  if (usesOpenAiTokenShape) {
    payload.max_completion_tokens = maxTokens ?? max_tokens ?? 32768;
    if (reasoning) payload.reasoning = reasoning;
  } else {
    payload.max_tokens = maxTokens ?? max_tokens ?? 32768;
    payload.thinking = thinking ?? { budget_tokens: 128 };
  }
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
  return relKey.replace(/^\/+/, "").split("/").map(
    (seg) => seg.split("").map((ch) => ch.charCodeAt(0) > 127 ? encodeURIComponent(ch) : ch).join("")
  ).join("/");
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
async function storageReadBuffer(relKey) {
  const signedUrl = await storageGetSignedUrl(relKey);
  const response = await fetch(signedUrl);
  if (!response.ok) throw new Error(`Storage download failed (${response.status})`);
  return Buffer.from(await response.arrayBuffer());
}

// server/routers.ts
import { nanoid } from "nanoid";

// server/garminImport.ts
var MAX_GARMIN_SCREENSHOTS = 16;
var MAX_GARMIN_SCREENSHOT_BYTES = 10 * 1024 * 1024;
var MAX_GARMIN_BATCH_SIZE = 5;
var MAX_GARMIN_TOTAL_BYTES = 30 * 1024 * 1024;
var SUPPORTED_IMAGE_TYPES = /* @__PURE__ */ new Set(["image/png", "image/jpeg", "image/webp"]);
function asDataImageUrl(screenshot) {
  const mimeType = screenshot.mimeType.toLowerCase().trim();
  if (!SUPPORTED_IMAGE_TYPES.has(mimeType)) {
    throw new Error("Garmin \u622A\u5716\u53EA\u652F\u63F4 PNG\u3001JPG \u6216 WEBP \u683C\u5F0F");
  }
  const payload = screenshot.base64.replace(/\s/g, "");
  if (!payload || !/^[A-Za-z0-9+/]+={0,2}$/.test(payload)) {
    throw new Error("Garmin \u622A\u5716\u8CC7\u6599\u683C\u5F0F\u7121\u6CD5\u8B80\u53D6\uFF0C\u8ACB\u91CD\u65B0\u9078\u64C7\u5716\u7247");
  }
  const bytes = Buffer.byteLength(payload, "base64");
  if (bytes > MAX_GARMIN_SCREENSHOT_BYTES) {
    throw new Error(`\u55AE\u5F35 Garmin \u622A\u5716\u4E0D\u53EF\u8D85\u904E ${MAX_GARMIN_SCREENSHOT_BYTES / 1024 / 1024}MB`);
  }
  return `data:${mimeType};base64,${payload}`;
}
function buildGarminVisionBatches(screenshots, batchSize = MAX_GARMIN_BATCH_SIZE) {
  if (!screenshots.length) throw new Error("\u8ACB\u81F3\u5C11\u63D0\u4F9B\u4E00\u5F35 Garmin \u622A\u5716");
  if (screenshots.length > MAX_GARMIN_SCREENSHOTS) {
    throw new Error(`\u4E00\u6B21\u6700\u591A\u5206\u6790 ${MAX_GARMIN_SCREENSHOTS} \u5F35 Garmin \u622A\u5716`);
  }
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > MAX_GARMIN_BATCH_SIZE) {
    throw new Error(`\u6BCF\u6279 Garmin \u622A\u5716\u6700\u591A ${MAX_GARMIN_BATCH_SIZE} \u5F35`);
  }
  let totalBytes = 0;
  const dataImageUrls = screenshots.map((screenshot) => {
    const url = asDataImageUrl(screenshot);
    totalBytes += Buffer.byteLength(screenshot.base64.replace(/\s/g, ""), "base64");
    return url;
  });
  if (totalBytes > MAX_GARMIN_TOTAL_BYTES) {
    throw new Error("\u9019\u6279 Garmin \u622A\u5716\u5408\u8A08\u8D85\u904E 30MB\uFF0C\u8ACB\u5206\u5169\u6B21\u5206\u6790\u6216\u4FDD\u7559\u6700\u6E05\u6670\u7684\u7E3D\u89BD\u3001Stats \u8207 Laps \u756B\u9762");
  }
  return Array.from(
    { length: Math.ceil(dataImageUrls.length / batchSize) },
    (_, index) => dataImageUrls.slice(index * batchSize, (index + 1) * batchSize)
  );
}
function buildGarminVisionContent(dataImageUrls, prompt) {
  if (!dataImageUrls.length) throw new Error("\u8ACB\u81F3\u5C11\u63D0\u4F9B\u4E00\u5F35 Garmin \u622A\u5716");
  for (const url of dataImageUrls) {
    if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/i.test(url)) {
      throw new Error("Garmin \u622A\u5716\u672A\u53D6\u5F97\u53EF\u4F9B\u5206\u6790\u7684\u5716\u7247\u8CC7\u6599\uFF0C\u8ACB\u91CD\u65B0\u9078\u64C7\u5716\u7247\u5F8C\u518D\u8A66");
    }
  }
  return [
    { type: "text", text: prompt },
    ...dataImageUrls.map((url) => ({
      type: "image_url",
      image_url: { url, detail: "high" }
    }))
  ];
}
function getResponseText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.filter((part) => typeof part === "object" && part !== null).filter((part) => part.type === "text" && typeof part.text === "string").map((part) => part.text).join("\n");
  }
  return "";
}
function parseGarminExtraction(content) {
  const source = getResponseText(content).trim();
  if (!source) throw new Error("\u5206\u6790\u670D\u52D9\u6C92\u6709\u56DE\u50B3\u53EF\u8B80\u53D6\u7684\u8CC7\u6599\uFF0C\u8ACB\u91CD\u8A66");
  const withoutFence = source.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("\u5206\u6790\u670D\u52D9\u56DE\u50B3\u7684\u8CC7\u6599\u683C\u5F0F\u4E0D\u5B8C\u6574\uFF0C\u8ACB\u91CD\u8A66");
  let parsed;
  try {
    parsed = JSON.parse(withoutFence.slice(start, end + 1));
  } catch {
    throw new Error("\u5206\u6790\u670D\u52D9\u56DE\u50B3\u7684\u8CC7\u6599\u683C\u5F0F\u7121\u6CD5\u8B80\u53D6\uFF0C\u8ACB\u91CD\u8A66");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("\u5206\u6790\u670D\u52D9\u6C92\u6709\u56DE\u50B3\u8DD1\u6B65\u7D00\u9304\uFF0C\u8ACB\u91CD\u8A66");
  }
  const value = parsed;
  const confidence = value.confidence === "high" || value.confidence === "low" ? value.confidence : "medium";
  return {
    date: typeof value.date === "string" ? value.date : null,
    time: typeof value.time === "string" ? value.time : null,
    running: typeof value.running === "object" && value.running !== null && !Array.isArray(value.running) ? value.running : {},
    garminDetails: typeof value.garminDetails === "object" && value.garminDetails !== null && !Array.isArray(value.garminDetails) ? value.garminDetails : {},
    laps: Array.isArray(value.laps) ? value.laps.filter((lap) => typeof lap === "object" && lap !== null && !Array.isArray(lap)) : [],
    confidence,
    notes: typeof value.notes === "string" ? value.notes : "\u8ACB\u6838\u5C0D\u5F9E Garmin \u622A\u5716\u8B80\u53D6\u7684\u6578\u64DA\u3002"
  };
}
function hasValue(value) {
  return value !== null && value !== void 0 && value !== "";
}
function mergeRecordValues(records) {
  return records.reduce((merged, record) => {
    for (const [key, value] of Object.entries(record)) {
      if (!hasValue(merged[key]) && hasValue(value)) merged[key] = value;
    }
    return merged;
  }, {});
}
function completedValueCount(record) {
  return Object.values(record).filter(hasValue).length;
}
function mergeGarminExtractions(extractions) {
  if (!extractions.length) throw new Error("\u6C92\u6709\u53EF\u5408\u4F75\u7684 Garmin \u5206\u6790\u7D50\u679C");
  const firstValue = (values, empty) => values.find((value) => hasValue(value)) ?? empty;
  const lapByNumber = /* @__PURE__ */ new Map();
  for (const extraction of extractions) {
    for (const lap of extraction.laps) {
      const number = typeof lap.lap === "number" && Number.isFinite(lap.lap) ? lap.lap : null;
      if (number === null) continue;
      const existing = lapByNumber.get(number);
      if (!existing || completedValueCount(lap) > completedValueCount(existing)) lapByNumber.set(number, lap);
    }
  }
  const confidenceRank = { high: 2, medium: 1, low: 0 };
  const confidence = extractions.reduce(
    (lowest, extraction) => confidenceRank[extraction.confidence] < confidenceRank[lowest] ? extraction.confidence : lowest,
    "high"
  );
  const notes = Array.from(new Set(extractions.map((item) => item.notes.trim()).filter(Boolean))).join(" ");
  return {
    date: firstValue(extractions.map((item) => item.date), null),
    time: firstValue(extractions.map((item) => item.time), null),
    running: mergeRecordValues(extractions.map((item) => item.running)),
    garminDetails: mergeRecordValues(extractions.map((item) => item.garminDetails)),
    laps: Array.from(lapByNumber.entries()).sort(([left], [right]) => left - right).map(([, lap]) => lap),
    confidence,
    notes: notes || "\u5DF2\u5408\u4F75\u591A\u5F35 Garmin \u622A\u5716\uFF0C\u8ACB\u6838\u5C0D\u6578\u64DA\u5F8C\u518D\u5132\u5B58\u3002"
  };
}

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
  const routeType = (keys["routetype"] ?? keys["surface"] ?? keys["surfaceinterval"] ?? (actType.includes("trail") ? "Trail" : actType.includes("treadmill") ? "Treadmill" : void 0))?.trim();
  return {
    date: date2,
    runningType,
    routeType,
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
    windSpeed: toNum(keys["windspeed"] ?? keys["windspeedkmh"]),
    apparentTemp: toNum(keys["apparenttemp"] ?? keys["feelslike"] ?? keys["feelsliketemperature"]),
    precipitation: toNum(keys["precipitation"] ?? keys["rain"]),
    weatherCode: toNum(keys["weathercode"] ?? keys["wmocode"]),
    weatherCondition: keys["weathercondition"] ?? keys["conditions"] ?? keys["weather"] ?? void 0,
    weatherLocation: keys["weatherlocation"] ?? keys["location"] ?? void 0,
    weatherObservedAt: keys["weatherobservedat"] ?? keys["weatherdatetime"] ?? void 0,
    weatherSource: keys["weathersource"] ?? void 0,
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

// server/sheetsService.ts
import { google } from "googleapis";
var SPREADSHEET_ID = "16MzWHNx9Njww8Ml3eq5tJEspmSkHcWxmaI9I5xTqsEU";
var SHEET_TABS = {
  body: "Body Fitness",
  sleep: "Sleep",
  heartrate: "Heart Rate",
  running: "Running"
};
var BODY_COLUMNS = ["Date", "Weight (kg)", "BMI", "Body Fat %", "Fat Mass (kg)", "Muscle Mass (kg)", "BMR", "Visceral Fat", "Source", "Notes"];
var SLEEP_COLUMNS = ["Date", "Sleep Score", "Resting HR", "Body Battery", "Pulse Ox (%)", "Respiration", "HRV", "Quality", "Duration (h)", "Source", "Bedtime", "Wake Time", "Notes"];
var HR_COLUMNS = ["Date", "Resting HR", "High HR", "HRV", "Source", "Notes", "Avg HR"];
var RUNNING_COLUMNS = ["Date", "Running Type", "Route Type", "Running Shoes", "Distance (km)", "Duration (h)", "Duration (min)", "Duration (sec)", "Avg Pace", "Best Pace", "Avg HR", "Max HR", "Avg Cadence", "Max Cadence", "Avg Stride Length (m)", "Avg Vertical Ratio", "Vertical Oscillation (cm)", "Avg Ground Contact Time (ms)", "Calories", "Temperature (\xB0C)", "Humidity (%)", "Notes", "Wind Speed (km/h)", "Feels Like (\xB0C)", "Precipitation (mm)", "Weather Condition", "Weather Location", "Weather Observed At (HK)", "Weather Source", "Garmin Details", "Laps"];
function getAuth() {
  const credJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not set");
  const credentials = JSON.parse(credJson);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
}
function toSheetValues(type, rowData) {
  let values;
  if (type === "body") {
    values = [
      String(rowData.date ?? ""),
      rowData.weight !== void 0 ? Number(rowData.weight) : "",
      rowData.bmi !== void 0 ? Number(rowData.bmi) : "",
      rowData.bodyFatPct !== void 0 ? Number(rowData.bodyFatPct) : "",
      rowData.fatMass !== void 0 ? Number(rowData.fatMass) : "",
      rowData.muscleMass !== void 0 ? Number(rowData.muscleMass) : "",
      rowData.bmr !== void 0 ? Number(rowData.bmr) : "",
      rowData.visceralFat !== void 0 ? Number(rowData.visceralFat) : "",
      String(rowData.source ?? "app"),
      String(rowData.notes ?? "")
    ];
  } else if (type === "sleep") {
    values = [
      String(rowData.date ?? ""),
      rowData.score !== void 0 ? Number(rowData.score) : "",
      rowData.restingHr !== void 0 ? Number(rowData.restingHr) : "",
      rowData.bodyBattery !== void 0 ? Number(rowData.bodyBattery) : "",
      rowData.pulseOx !== void 0 ? Number(rowData.pulseOx) : "",
      rowData.respiration !== void 0 ? Number(rowData.respiration) : "",
      rowData.hrv !== void 0 ? Number(rowData.hrv) : "",
      String(rowData.quality ?? ""),
      rowData.duration !== void 0 ? Number(rowData.duration) : "",
      String(rowData.source ?? "app"),
      String(rowData.bedtime ?? ""),
      String(rowData.waketime ?? ""),
      String(rowData.notes ?? "")
    ];
  } else if (type === "heartrate") {
    values = [
      String(rowData.date ?? ""),
      rowData.restingHr !== void 0 ? Number(rowData.restingHr) : "",
      rowData.highHr !== void 0 ? Number(rowData.highHr) : "",
      rowData.hrv !== void 0 ? Number(rowData.hrv) : "",
      String(rowData.source ?? "app"),
      String(rowData.notes ?? ""),
      rowData.avgHr !== void 0 ? Number(rowData.avgHr) : ""
    ];
  } else {
    values = [
      String(rowData.date ?? ""),
      String(rowData.runningType ?? ""),
      String(rowData.routeType ?? ""),
      String(rowData.runningShoes ?? ""),
      rowData.distanceKm !== void 0 ? Number(rowData.distanceKm) : "",
      rowData.hour !== void 0 ? Number(rowData.hour) : "",
      rowData.minutes !== void 0 ? Number(rowData.minutes) : "",
      rowData.second !== void 0 ? Number(rowData.second) : "",
      String(rowData.averagePace ?? ""),
      String(rowData.bestPace ?? ""),
      rowData.averageHeartRate !== void 0 ? Number(rowData.averageHeartRate) : "",
      rowData.maximumHeartRate !== void 0 ? Number(rowData.maximumHeartRate) : "",
      rowData.averageCadence !== void 0 ? Number(rowData.averageCadence) : "",
      rowData.maxCadence !== void 0 ? Number(rowData.maxCadence) : "",
      rowData.avgStrideLengthM !== void 0 ? Number(rowData.avgStrideLengthM) : "",
      rowData.avgVerticalRatio !== void 0 ? Number(rowData.avgVerticalRatio) : "",
      rowData.verticalOscillationCm !== void 0 ? Number(rowData.verticalOscillationCm) : "",
      rowData.avgGroundContactTimeMs !== void 0 ? Number(rowData.avgGroundContactTimeMs) : "",
      rowData.calories !== void 0 ? Number(rowData.calories) : "",
      rowData.temperature !== void 0 ? Number(rowData.temperature) : "",
      rowData.humidity !== void 0 ? Number(rowData.humidity) : "",
      String(rowData.notes ?? ""),
      rowData.windSpeed !== void 0 ? Number(rowData.windSpeed) : "",
      rowData.apparentTemp !== void 0 ? Number(rowData.apparentTemp) : "",
      rowData.precipitation !== void 0 ? Number(rowData.precipitation) : "",
      String(rowData.weatherCondition ?? ""),
      String(rowData.weatherLocation ?? ""),
      String(rowData.weatherObservedAt ?? ""),
      String(rowData.weatherSource ?? ""),
      rowData.garminDetails ? JSON.stringify(rowData.garminDetails) : "",
      rowData.laps ? JSON.stringify(rowData.laps) : ""
    ];
  }
  return values;
}
async function writeRowsToSheet(type, rows) {
  if (!rows.length) return;
  try {
    await ensureSheetHeaders(type);
    const auth = getAuth();
    const sheets = google.sheets({ version: "v4", auth });
    const sheetName = SHEET_TABS[type];
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:Z`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: rows.map((row) => toSheetValues(type, row))
      }
    });
  } catch (err) {
    console.error(`[Sheets] writeRowsToSheet(${type}) error:`, err?.message);
    throw err;
  }
}
async function upsertRowsToSheetByDate(type, rows) {
  if (!rows.length) return;
  try {
    await ensureSheetHeaders(type);
    const auth = getAuth();
    const sheets = google.sheets({ version: "v4", auth });
    const sheetName = SHEET_TABS[type];
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A2:A`
    });
    const rowForDate = /* @__PURE__ */ new Map();
    (existing.data.values ?? []).forEach((entry, index) => {
      const date2 = String(entry[0] ?? "").trim();
      if (date2) rowForDate.set(date2, index + 2);
    });
    const updates = [];
    const appended = [];
    rows.forEach((row) => {
      const date2 = String(row.date ?? "").trim();
      const existingRow = rowForDate.get(date2);
      if (existingRow) {
        updates.push({ range: `${sheetName}!A${existingRow}`, values: [toSheetValues(type, row)] });
      } else {
        appended.push(row);
      }
    });
    if (updates.length) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { valueInputOption: "USER_ENTERED", data: updates }
      });
    }
    if (appended.length) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A:Z`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: appended.map((row) => toSheetValues(type, row)) }
      });
    }
  } catch (err) {
    console.error(`[Sheets] upsertRowsToSheetByDate(${type}) error:`, err?.message);
    throw err;
  }
}
async function writeRowToSheet(type, rowData) {
  await writeRowsToSheet(type, [rowData]);
}
async function ensureSheetHeaders(type) {
  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: "v4", auth });
    const sheetName = SHEET_TABS[type];
    const headers = type === "body" ? BODY_COLUMNS : type === "sleep" ? SLEEP_COLUMNS : type === "heartrate" ? HR_COLUMNS : RUNNING_COLUMNS;
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A1:ZZ1`
      });
      const firstRow = response.data.values?.[0];
      if (firstRow && firstRow.length > 0) {
        if (firstRow.length < headers.length) {
          const columnNumber = firstRow.length + 1;
          let columnName = "";
          let remainder = columnNumber;
          while (remainder > 0) {
            remainder -= 1;
            columnName = String.fromCharCode(65 + remainder % 26) + columnName;
            remainder = Math.floor(remainder / 26);
          }
          await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!${columnName}1`,
            valueInputOption: "USER_ENTERED",
            requestBody: { values: [headers.slice(firstRow.length)] }
          });
        }
        return;
      }
    } catch {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { requests: [{ addSheet: { properties: { title: sheetName } } }] }
      }).catch(() => void 0);
    }
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [headers] }
    });
  } catch (err) {
    console.warn(`[Sheets] ensureSheetHeaders(${type}):`, err?.message);
  }
}

// shared/progression.ts
function buildProgressionSuggestion(rawSets) {
  const sets = rawSets.map((set) => ({ reps: Number(set.reps ?? 0), weight: Number(set.weight ?? 0) })).filter((set) => Number.isFinite(set.reps) && Number.isFinite(set.weight) && set.reps > 0 && set.weight > 0);
  if (!sets.length) {
    return { available: false, detail: "\u5B8C\u6210\u7B2C\u4E00\u7D44\u5F8C\uFF0C\u7CFB\u7D71\u6703\u4F9D\u4F60\u7684\u5BE6\u969B\u8868\u73FE\u63D0\u51FA\u4E0B\u4E00\u6B21\u5EFA\u8B70\u3002" };
  }
  const latest = sets[0];
  const comparable = sets.filter((set) => Math.abs(set.weight - latest.weight) < 0.01).slice(0, 3);
  const averageReps = comparable.reduce((sum, set) => sum + set.reps, 0) / comparable.length;
  const increment = latest.weight >= 100 ? 5 : latest.weight >= 30 ? 2.5 : 1;
  const roundedIncrement = Math.round(increment * 10) / 10;
  if (averageReps >= 10) {
    const targetWeightKg = Math.round((latest.weight + roundedIncrement) * 10) / 10;
    return {
      available: true,
      strategy: "increase_weight",
      targetWeightKg,
      targetReps: Math.max(6, latest.reps - 2),
      detail: `\u6700\u8FD1 ${comparable.length} \u7D44\u65BC ${latest.weight} kg \u5E73\u5747\u5B8C\u6210 ${averageReps.toFixed(1)} \u6B21\uFF0C\u53EF\u5617\u8A66\u52A0\u91CD ${roundedIncrement} kg\u3002`
    };
  }
  if (averageReps < 6) {
    return {
      available: true,
      strategy: "maintain",
      targetWeightKg: latest.weight,
      targetReps: Math.max(6, latest.reps),
      detail: `\u5148\u4EE5 ${latest.weight} kg \u7A69\u5B9A\u5B8C\u6210\u81F3\u5C11 6 \u6B21\uFF0C\u4FDD\u7559 1\u20132 \u6B21\u9918\u529B\u4E26\u512A\u5148\u78BA\u8A8D\u52D5\u4F5C\u63A7\u5236\u3002`
    };
  }
  return {
    available: true,
    strategy: "increase_reps",
    targetWeightKg: latest.weight,
    targetReps: Math.min(12, latest.reps + 1),
    detail: `\u7DAD\u6301 ${latest.weight} kg\uFF0C\u4E0B\u4E00\u7D44\u76EE\u6A19\u591A\u5B8C\u6210 1 \u6B21\uFF1B\u9054\u5230 10\u201312 \u6B21\u5F8C\u518D\u5C0F\u5E45\u52A0\u91CD\u3002`
  };
}

// shared/runningBackfill.ts
function normaliseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const valueString = String(value);
  const matched = valueString.match(/^\d{4}-\d{2}-\d{2}/);
  return matched?.[0] ?? null;
}
function hasValue2(value) {
  return value !== null && value !== void 0 && value !== "";
}
function recordHasWeather(record) {
  return [
    record.weather_condition,
    record.weather_code,
    record.temperature,
    record.humidity,
    record.wind_speed,
    record.apparent_temp,
    record.precipitation
  ].some(hasValue2);
}
function buildHistoricalBackfillCandidates(runningLogs2, races3, options, todayHK2) {
  const includeLogs = options.scope === "logs" || options.scope === "both";
  const includeRaces = options.scope === "races" || options.scope === "both";
  const candidates = [];
  let skippedFuture = 0;
  const collect = (records, kind) => {
    for (const record of records) {
      const date2 = normaliseDate(record.date);
      if (!date2 || date2 < options.startDate || date2 > options.endDate) continue;
      if (date2 > todayHK2) {
        skippedFuture += 1;
        continue;
      }
      const needsRouteType = kind === "log" && Boolean(options.routeType) && (options.overwriteRouteType || !record.route_type);
      const needsWeather = options.overwriteWeather || !recordHasWeather(record);
      if (!needsRouteType && !needsWeather) continue;
      candidates.push({ id: Number(record.id), date: date2, kind, needsRouteType, needsWeather });
    }
  };
  if (includeLogs) collect(runningLogs2, "log");
  if (includeRaces) collect(races3, "race");
  return { candidates, skippedFuture };
}
function summariseHistoricalBackfill(candidates, skippedFuture) {
  const logs = candidates.filter((candidate) => candidate.kind === "log");
  const races3 = candidates.filter((candidate) => candidate.kind === "race");
  return {
    selectedLogs: logs.length,
    selectedRaces: races3.length,
    routeTypeUpdates: logs.filter((candidate) => candidate.needsRouteType).length,
    weatherUpdates: candidates.filter((candidate) => candidate.needsWeather).length,
    skippedFuture,
    total: candidates.length
  };
}

// server/weatherService.ts
var HONG_KONG_WEATHER_LOCATION = {
  label: "\u9999\u6E2F",
  latitude: 22.3193,
  longitude: 114.1694
};
var WEATHER_CONDITIONS = {
  0: "\u6674\u6717",
  1: "\u5927\u81F4\u6674\u6717",
  2: "\u5C40\u90E8\u591A\u96F2",
  3: "\u591A\u96F2",
  45: "\u9727",
  48: "\u971C\u9727",
  51: "\u5FAE\u96E8",
  53: "\u4E2D\u5EA6\u6BDB\u6BDB\u96E8",
  55: "\u6FC3\u6BDB\u6BDB\u96E8",
  56: "\u5FAE\u51CD\u96E8",
  57: "\u6FC3\u51CD\u96E8",
  61: "\u5C0F\u96E8",
  63: "\u4E2D\u96E8",
  65: "\u5927\u96E8",
  66: "\u5FAE\u51CD\u96E8",
  67: "\u5927\u51CD\u96E8",
  71: "\u5C0F\u96EA",
  73: "\u4E2D\u96EA",
  75: "\u5927\u96EA",
  77: "\u7C73\u96EA",
  80: "\u9663\u96E8",
  81: "\u4E2D\u5EA6\u9663\u96E8",
  82: "\u5F37\u9663\u96E8",
  85: "\u9663\u96EA",
  86: "\u5F37\u9663\u96EA",
  95: "\u96F7\u66B4",
  96: "\u96F7\u66B4\u4F34\u5C0F\u51B0\u96F9",
  97: "\u5F37\u96F7\u66B4",
  99: "\u5F37\u96F7\u66B4\u4F34\u5927\u51B0\u96F9"
};
function weatherConditionFromCode(code) {
  if (code === null || code === void 0 || !Number.isFinite(code)) return null;
  return WEATHER_CONDITIONS[code] ?? `WMO ${code}`;
}
function isHongKongDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
function normaliseTime(value) {
  return /^\d{2}:\d{2}$/.test(value ?? "") ? value : "07:00";
}
function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
function dayKey(date2, time) {
  return `${date2}T${time}`;
}
function nearestHourIndex(times, date2, time) {
  const exact = times.indexOf(dayKey(date2, time));
  if (exact >= 0) return exact;
  const dayMatches = times.map((candidate, index) => ({ candidate, index })).filter(({ candidate }) => candidate.startsWith(`${date2}T`));
  if (!dayMatches.length) return -1;
  const [targetHour, targetMinute] = time.split(":").map(Number);
  const targetMinutes = targetHour * 60 + targetMinute;
  return dayMatches.reduce((best, item) => {
    const [, rawTime = "00:00"] = item.candidate.split("T");
    const [hour, minute] = rawTime.split(":").map(Number);
    const delta = Math.abs(hour * 60 + minute - targetMinutes);
    return delta < best.delta ? { index: item.index, delta } : best;
  }, { index: dayMatches[0].index, delta: Number.POSITIVE_INFINITY }).index;
}
function selectHourlyWeather(hourly, date2, time, coordinates) {
  const index = nearestHourIndex(hourly.time ?? [], date2, normaliseTime(time));
  if (index < 0) return null;
  const code = safeNumber(hourly.weather_code?.[index]);
  const observedAt = hourly.time?.[index] ?? dayKey(date2, normaliseTime(time));
  return {
    weatherCode: code,
    weatherCondition: weatherConditionFromCode(code),
    temperature: safeNumber(hourly.temperature_2m?.[index]),
    humidity: safeNumber(hourly.relative_humidity_2m?.[index]),
    apparentTemp: safeNumber(hourly.apparent_temperature?.[index]),
    windSpeed: safeNumber(hourly.wind_speed_10m?.[index]),
    precipitation: safeNumber(hourly.precipitation?.[index]),
    weatherLocation: coordinates.label,
    weatherObservedAt: observedAt,
    weatherSource: "Open-Meteo \u6B77\u53F2\u5929\u6C23\uFF08\u9010\u5C0F\u6642\uFF09"
  };
}
async function resolveWeatherLocation(input) {
  const latitude = input.latitude;
  const longitude = input.longitude;
  if (latitude !== null && latitude !== void 0 && longitude !== null && longitude !== void 0) {
    return {
      label: input.location?.trim() || HONG_KONG_WEATHER_LOCATION.label,
      latitude,
      longitude
    };
  }
  const location = input.location?.trim();
  if (!location || location === "\u9999\u6E2F" || location.toLowerCase() === "hong kong") {
    return HONG_KONG_WEATHER_LOCATION;
  }
  try {
    const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
    url.searchParams.set("name", location);
    url.searchParams.set("count", "1");
    url.searchParams.set("language", "zh");
    url.searchParams.set("format", "json");
    const response = await fetch(url, { signal: AbortSignal.timeout(1e4) });
    if (!response.ok) throw new Error(`Geocoding request failed (${response.status})`);
    const result = await response.json();
    const match = result.results?.[0];
    if (!match || !Number.isFinite(match.latitude) || !Number.isFinite(match.longitude)) {
      throw new Error("Location not found");
    }
    const label = [match.name, match.admin1, match.country].filter(Boolean).join(" \xB7 ") || location;
    return { label, latitude: Number(match.latitude), longitude: Number(match.longitude) };
  } catch {
    return { ...HONG_KONG_WEATHER_LOCATION, label: location };
  }
}
async function fetchHistoricalWeatherRange(input) {
  if (!isHongKongDate(input.startDate) || !isHongKongDate(input.endDate)) {
    throw new Error("\u6B77\u53F2\u5929\u6C23\u67E5\u8A62\u9700\u8981\u6709\u6548\u7684 YYYY-MM-DD \u65E5\u671F");
  }
  if (input.startDate > input.endDate) {
    throw new Error("\u958B\u59CB\u65E5\u671F\u4E0D\u53EF\u665A\u65BC\u7D50\u675F\u65E5\u671F");
  }
  const url = new URL("https://archive-api.open-meteo.com/v1/archive");
  url.searchParams.set("latitude", String(input.coordinates.latitude));
  url.searchParams.set("longitude", String(input.coordinates.longitude));
  url.searchParams.set("start_date", input.startDate);
  url.searchParams.set("end_date", input.endDate);
  url.searchParams.set("hourly", "weather_code,temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,wind_speed_10m");
  url.searchParams.set("timezone", "Asia/Hong_Kong");
  url.searchParams.set("wind_speed_unit", "kmh");
  const response = await fetch(url, { signal: AbortSignal.timeout(3e4) });
  if (!response.ok) throw new Error(`\u6B77\u53F2\u5929\u6C23\u8CC7\u6599\u66AB\u6642\u7121\u6CD5\u53D6\u5F97\uFF08${response.status}\uFF09`);
  const payload = await response.json();
  if (!payload.hourly?.time?.length) throw new Error("\u6B77\u53F2\u5929\u6C23\u4F86\u6E90\u6C92\u6709\u50B3\u56DE\u9010\u5C0F\u6642\u8CC7\u6599");
  const result = /* @__PURE__ */ new Map();
  const dates = Array.from(new Set(payload.hourly.time.map((value) => value.slice(0, 10))));
  for (const date2 of dates) {
    const observation = selectHourlyWeather(payload.hourly, date2, normaliseTime(input.time), input.coordinates);
    if (observation) result.set(date2, observation);
  }
  return result;
}
async function fetchHistoricalWeatherForDate(input) {
  const observations = await fetchHistoricalWeatherRange({
    coordinates: input.coordinates,
    startDate: input.date,
    endDate: input.date,
    time: input.time
  });
  const observation = observations.get(input.date);
  if (!observation) throw new Error("\u627E\u4E0D\u5230\u6307\u5B9A\u65E5\u671F\u53CA\u6642\u9593\u7684\u5929\u6C23\u8CC7\u6599");
  return observation;
}
function buildDateChunks(dates, maximumSpanDays = 31) {
  const ordered = Array.from(new Set(dates.filter(isHongKongDate))).sort();
  if (!ordered.length) return [];
  const chunks = [];
  let startDate = ordered[0];
  let selected = [ordered[0]];
  for (const date2 of ordered.slice(1)) {
    const start = (/* @__PURE__ */ new Date(`${startDate}T00:00:00Z`)).getTime();
    const current = (/* @__PURE__ */ new Date(`${date2}T00:00:00Z`)).getTime();
    const spanDays = Math.floor((current - start) / 864e5);
    if (spanDays >= maximumSpanDays) {
      chunks.push({ startDate, endDate: selected[selected.length - 1], dates: selected });
      startDate = date2;
      selected = [date2];
    } else {
      selected.push(date2);
    }
  }
  chunks.push({ startDate, endDate: selected[selected.length - 1], dates: selected });
  return chunks;
}

// server/garminFileImport.ts
import { Decoder, Stream } from "@garmin/fitsdk";
import Papa from "papaparse";
import sax from "sax";
var MAX_SAMPLES = 1e4;
var asNumber = (value) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : void 0;
};
var asDate = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
var toHKDate = (date2) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Hong_Kong", year: "numeric", month: "2-digit", day: "2-digit" }).format(date2);
var toHKTime = (date2) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Hong_Kong", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date2);
var decimalPace = (secondsPerKm) => secondsPerKm && secondsPerKm > 0 ? (secondsPerKm / 60).toFixed(2) : void 0;
function toCoordinateDegrees(value, maximum) {
  const parsed = asNumber(value);
  if (parsed === void 0) return void 0;
  const degrees = Math.abs(parsed) <= maximum ? parsed : parsed * 180 / 2 ** 31;
  return Math.abs(degrees) <= maximum ? Number(degrees.toFixed(7)) : void 0;
}
function keepChartSamples(items) {
  if (items.length <= MAX_SAMPLES) return items;
  return Array.from({ length: MAX_SAMPLES }, (_, index) => {
    const sourceIndex = Math.round(index * (items.length - 1) / (MAX_SAMPLES - 1));
    return items[sourceIndex];
  });
}
function metricFields(session, samples, sourceFormat) {
  const first = samples[0];
  const last = samples.at(-1);
  const durationSec = asNumber(session.totalTimerTime) ?? (last ? last.elapsedSec : void 0);
  const distanceM = asNumber(session.totalDistance);
  const distanceKm = distanceM && distanceM > 100 ? distanceM / 1e3 : asNumber(session.distanceKm) ?? last?.distanceKm;
  const avgSpeed = asNumber(session.avgSpeed) ?? asNumber(session.averageSpeed);
  const maxSpeed = asNumber(session.maxSpeed) ?? asNumber(session.maximumSpeed);
  const paceSeconds = distanceKm && durationSec ? durationSec / distanceKm : avgSpeed ? 1e3 / avgSpeed : void 0;
  const bestPaceSeconds = maxSpeed ? 1e3 / maxSpeed : void 0;
  const start = first ? new Date(first.timestamp) : asDate(session.startTime) ?? asDate(session.timestamp);
  const fields = {};
  if (start) {
    fields.date = toHKDate(start);
    fields.weatherTime = toHKTime(start);
  }
  if (distanceKm) fields.distanceKm = distanceKm.toFixed(2);
  if (durationSec !== void 0) {
    fields.hour = String(Math.floor(durationSec / 3600));
    fields.minutes = String(Math.floor(durationSec % 3600 / 60));
    fields.second = String(Math.round(durationSec % 60));
  }
  const averagePace = decimalPace(paceSeconds);
  const bestPace = decimalPace(bestPaceSeconds);
  if (averagePace) fields.averagePace = averagePace;
  if (bestPace) fields.bestPace = bestPace;
  const pairs = [
    ["avgHeartRate", "averageHeartRate"],
    ["maxHeartRate", "maximumHeartRate"],
    ["avgRunningCadence", "averageCadence"],
    ["maxRunningCadence", "maxCadence"],
    ["totalCalories", "calories"],
    ["avgStepLength", "avgStrideLengthM"],
    ["avgVerticalRatio", "avgVerticalRatio"],
    ["avgVerticalOscillation", "verticalOscillationCm"],
    ["avgStanceTime", "avgGroundContactTimeMs"],
    ["avgTemperature", "temperature"]
  ];
  for (const [source, target] of pairs) {
    const value = asNumber(session[source]);
    if (value !== void 0) fields[target] = String(value);
  }
  const warnings = [];
  if (!samples.length) warnings.push("\u539F\u59CB\u6A94\u6C92\u6709\u53EF\u8B80\u53D6\u7684\u9010\u79D2 Record \u6A23\u672C\uFF1B\u5DF2\u53EA\u586B\u5165\u6D3B\u52D5\u6458\u8981\u3002");
  if (samples.length >= MAX_SAMPLES) warnings.push(`\u70BA\u7DAD\u6301\u64CD\u4F5C\u6548\u80FD\uFF0C\u9019\u6B21\u6D3B\u52D5\u5DF2\u5747\u52FB\u4FDD\u7559\u5168\u7A0B ${MAX_SAMPLES.toLocaleString()} \u500B\u66F2\u7DDA\u6A23\u672C\uFF1B\u539F\u59CB\u6A94\u4ECD\u6703\u96A8\u7D00\u9304\u4FDD\u5B58\u3002`);
  return {
    sourceFormat,
    fields,
    garminDetails: {
      sourceFormat,
      rawSampleCount: samples.length,
      avgPowerW: asNumber(session.avgPower) ?? null,
      maxPowerW: asNumber(session.maxPower) ?? null,
      totalAscentM: asNumber(session.totalAscent) ?? null,
      totalDescentM: asNumber(session.totalDescent) ?? null,
      avgTemperatureC: asNumber(session.avgTemperature) ?? null,
      totalMovingTimeSec: asNumber(session.totalMovingTime) ?? null
    },
    laps: [],
    timeSeries: samples,
    warnings
  };
}
function mapFitRecord(record, startedAt) {
  const timestamp2 = asDate(record.timestamp);
  if (!timestamp2) return null;
  const speed = asNumber(record.enhancedSpeed) ?? asNumber(record.speed);
  const distanceM = asNumber(record.distance);
  const altitudeM = asNumber(record.enhancedAltitude) ?? asNumber(record.altitude);
  const latitude = toCoordinateDegrees(record.positionLat, 90);
  const longitude = toCoordinateDegrees(record.positionLong, 180);
  return {
    elapsedSec: Math.max(0, Math.round((timestamp2.getTime() - startedAt.getTime()) / 1e3)),
    timestamp: timestamp2.toISOString(),
    ...distanceM !== void 0 ? { distanceKm: Number((distanceM / 1e3).toFixed(4)) } : {},
    ...latitude !== void 0 ? { latitude } : {},
    ...longitude !== void 0 ? { longitude } : {},
    ...speed && speed > 0 ? { paceSecPerKm: Number((1e3 / speed).toFixed(2)) } : {},
    ...asNumber(record.heartRate) !== void 0 ? { heartRate: asNumber(record.heartRate) } : {},
    ...asNumber(record.cadence) !== void 0 ? { cadence: asNumber(record.cadence) } : {},
    ...asNumber(record.power) !== void 0 ? { power: asNumber(record.power) } : {},
    ...altitudeM !== void 0 ? { altitudeM } : {},
    ...asNumber(record.temperature) !== void 0 ? { temperatureC: asNumber(record.temperature) } : {}
  };
}
function parseGarminFit(buffer) {
  const stream = Stream.fromBuffer(buffer);
  if (!Decoder.isFIT(stream)) throw new Error("\u9019\u4E0D\u662F\u6709\u6548\u7684 Garmin FIT \u6A94\u6848");
  const decoder = new Decoder(stream);
  const { messages, errors } = decoder.read({ applyScaleAndOffset: true, expandComponents: true, convertDateTimesToDates: true, mergeHeartRates: true });
  const recordMessages = messages.recordMesgs ?? [];
  const firstTimestamp = recordMessages.map((record) => asDate(record.timestamp)).find((date2) => !!date2) ?? asDate(messages.sessionMesgs?.[0]?.startTime) ?? /* @__PURE__ */ new Date();
  const sourceSamples = recordMessages.map((record) => mapFitRecord(record, firstTimestamp)).filter((sample) => !!sample);
  const samples = keepChartSamples(sourceSamples);
  const session = messages.sessionMesgs?.[0] ?? {};
  const preview = metricFields(session, samples, "FIT");
  preview.laps = (messages.lapMesgs ?? []).map((lap, index) => {
    const distance = asNumber(lap.totalDistance);
    const duration = asNumber(lap.totalTimerTime) ?? asNumber(lap.totalElapsedTime);
    const speed = asNumber(lap.avgSpeed);
    return { lap: index + 1, durationSec: duration ? Math.round(duration) : null, distanceKm: distance ? Number((distance / 1e3).toFixed(3)) : null, avgPace: decimalPace(speed ? 1e3 / speed : void 0) ?? null };
  });
  preview.garminDetails.rawSampleCount = sourceSamples.length;
  if (errors.length) preview.warnings.push(`FIT \u6A94\u6848\u6709 ${errors.length} \u9805\u53EF\u6062\u5FA9\u7684\u89E3\u6790\u63D0\u793A\uFF1B\u5DF2\u4FDD\u7559\u80FD\u5B89\u5168\u8B80\u53D6\u7684\u8CC7\u6599\u3002`);
  return preview;
}
function valueFor(row, names) {
  const lookup = {};
  for (const [key, value] of Object.entries(row)) lookup[key.toLowerCase().replace(/[^a-z0-9]/g, "")] = value;
  return names.map((name) => lookup[name]).find((value) => value !== void 0 && value !== "");
}
function parseGarminCsv(buffer) {
  const parsed = Papa.parse(buffer.toString("utf8"), { header: true, skipEmptyLines: true });
  if (parsed.errors.length && !parsed.data.length) throw new Error("CSV \u683C\u5F0F\u7121\u6CD5\u8B80\u53D6\uFF0C\u8ACB\u4F7F\u7528 Garmin \u532F\u51FA\u7684\u539F\u59CB CSV \u6A94");
  const raw = parsed.data;
  const timed = raw.map((row) => {
    const timestampRaw = valueFor(row, ["timestamp", "time", "datetime"]);
    const timestamp2 = timestampRaw ? new Date(timestampRaw) : null;
    const distance = asNumber(valueFor(row, ["distance", "distancekm"]));
    const speed = asNumber(valueFor(row, ["enhancedspeed", "speed"]));
    return timestamp2 && !Number.isNaN(timestamp2.getTime()) ? { timestamp: timestamp2, distance, speed, row } : null;
  }).filter(Boolean);
  const start = timed[0]?.timestamp ?? /* @__PURE__ */ new Date();
  const sourceSamples = timed.map((item) => ({
    elapsedSec: Math.max(0, Math.round((item.timestamp.getTime() - start.getTime()) / 1e3)),
    timestamp: item.timestamp.toISOString(),
    ...item.distance !== void 0 ? { distanceKm: item.distance > 100 ? Number((item.distance / 1e3).toFixed(4)) : item.distance } : {},
    ...toCoordinateDegrees(valueFor(item.row, ["latitude", "lat", "positionlat"]), 90) !== void 0 ? { latitude: toCoordinateDegrees(valueFor(item.row, ["latitude", "lat", "positionlat"]), 90) } : {},
    ...toCoordinateDegrees(valueFor(item.row, ["longitude", "lon", "lng", "positionlong"]), 180) !== void 0 ? { longitude: toCoordinateDegrees(valueFor(item.row, ["longitude", "lon", "lng", "positionlong"]), 180) } : {},
    ...item.speed && item.speed > 0 ? { paceSecPerKm: Number((1e3 / item.speed).toFixed(2)) } : {},
    ...asNumber(valueFor(item.row, ["heartrate", "heart_rate"])) !== void 0 ? { heartRate: asNumber(valueFor(item.row, ["heartrate", "heart_rate"])) } : {},
    ...asNumber(valueFor(item.row, ["cadence"])) !== void 0 ? { cadence: asNumber(valueFor(item.row, ["cadence"])) } : {},
    ...asNumber(valueFor(item.row, ["power", "watts"])) !== void 0 ? { power: asNumber(valueFor(item.row, ["power", "watts"])) } : {},
    ...asNumber(valueFor(item.row, ["altitude", "enhancedaltitude"])) !== void 0 ? { altitudeM: asNumber(valueFor(item.row, ["altitude", "enhancedaltitude"])) } : {},
    ...asNumber(valueFor(item.row, ["temperature", "temp"])) !== void 0 ? { temperatureC: asNumber(valueFor(item.row, ["temperature", "temp"])) } : {}
  }));
  const samples = keepChartSamples(sourceSamples);
  const last = samples.at(-1);
  const session = { startTime: start, totalDistance: last?.distanceKm ? last.distanceKm * 1e3 : void 0, totalTimerTime: last?.elapsedSec };
  const preview = metricFields(session, samples, "CSV");
  preview.garminDetails.rawSampleCount = sourceSamples.length;
  preview.warnings.push("CSV \u6B04\u4F4D\u6703\u56E0 Garmin \u532F\u51FA\u8A2D\u5B9A\u800C\u4E0D\u540C\uFF1B\u8ACB\u5148\u6838\u5C0D\u6458\u8981\u8207\u9010\u79D2\u6A23\u672C\u6578\u91CF\u3002", ...!timed.length ? ["\u6B64 CSV \u672A\u5305\u542B\u53EF\u8B58\u5225\u7684 timestamp \u8A18\u9304\uFF0C\u56E0\u6B64\u672A\u4FDD\u5B58\u9010\u79D2\u66F2\u7DDA\u3002"] : []);
  return preview;
}
function localName(name) {
  const segments = name.split(":");
  return segments.at(-1)?.toLowerCase() ?? name.toLowerCase();
}
function parseXmlNumber(value) {
  return value === void 0 ? void 0 : asNumber(value.trim());
}
function parseXmlDate(value) {
  if (!value) return void 0;
  const parsed = asDate(value.trim());
  return parsed ?? void 0;
}
function xmlAttribute(tag, name) {
  const value = tag.attributes[name];
  if (typeof value === "string") return value;
  return value?.value;
}
function distanceBetweenMeters(first, second) {
  if (first.latitude === void 0 || first.longitude === void 0 || second.latitude === void 0 || second.longitude === void 0) return void 0;
  const radians = Math.PI / 180;
  const latDistance = (second.latitude - first.latitude) * radians;
  const lonDistance = (second.longitude - first.longitude) * radians;
  const a = Math.sin(latDistance / 2) ** 2 + Math.cos(first.latitude * radians) * Math.cos(second.latitude * radians) * Math.sin(lonDistance / 2) ** 2;
  return 6371e3 * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
function toTimeSeries(points) {
  const visiblePoints = keepChartSamples(points);
  const startedAt = visiblePoints[0]?.timestamp;
  if (!startedAt) return [];
  let cumulativeDistanceM = 0;
  let previous;
  return visiblePoints.map((point) => {
    if (point.distanceM !== void 0) cumulativeDistanceM = point.distanceM;
    else if (previous) cumulativeDistanceM += distanceBetweenMeters(previous, point) ?? 0;
    const elapsedSec = Math.max(0, Math.round((point.timestamp.getTime() - startedAt.getTime()) / 1e3));
    const segmentSeconds = previous ? Math.max(0, (point.timestamp.getTime() - previous.timestamp.getTime()) / 1e3) : 0;
    const segmentDistanceM = previous ? point.distanceM !== void 0 && previous.distanceM !== void 0 ? point.distanceM - previous.distanceM : distanceBetweenMeters(previous, point) ?? 0 : 0;
    const paceSecPerKm = segmentSeconds > 0 && segmentDistanceM > 1 ? Number((segmentSeconds * 1e3 / segmentDistanceM).toFixed(2)) : void 0;
    previous = point;
    return {
      elapsedSec,
      timestamp: point.timestamp.toISOString(),
      ...cumulativeDistanceM > 0 ? { distanceKm: Number((cumulativeDistanceM / 1e3).toFixed(4)) } : {},
      ...point.latitude !== void 0 ? { latitude: point.latitude } : {},
      ...point.longitude !== void 0 ? { longitude: point.longitude } : {},
      ...paceSecPerKm && paceSecPerKm < 7200 ? { paceSecPerKm } : {},
      ...point.heartRate !== void 0 ? { heartRate: point.heartRate } : {},
      ...point.cadence !== void 0 ? { cadence: point.cadence } : {},
      ...point.power !== void 0 ? { power: point.power } : {},
      ...point.altitudeM !== void 0 ? { altitudeM: point.altitudeM } : {},
      ...point.temperatureC !== void 0 ? { temperatureC: point.temperatureC } : {}
    };
  });
}
function calculateAscentDescent(points) {
  let ascent = 0;
  let descent = 0;
  for (let index = 1; index < points.length; index += 1) {
    const before = points[index - 1].altitudeM;
    const after = points[index].altitudeM;
    if (before === void 0 || after === void 0) continue;
    const delta = after - before;
    if (delta > 0) ascent += delta;
    if (delta < 0) descent += Math.abs(delta);
  }
  return { ascent: Number(ascent.toFixed(1)), descent: Number(descent.toFixed(1)) };
}
function averageOf(values) {
  const valid = values.filter((value) => value !== void 0 && Number.isFinite(value));
  return valid.length ? Number((valid.reduce((total, value) => total + value, 0) / valid.length).toFixed(1)) : void 0;
}
function xmlPreview(points, laps, sourceFormat) {
  const samples = toTimeSeries(points);
  const lastPoint = points.at(-1);
  const distanceFromTrack = samples.at(-1)?.distanceKm;
  const totalLapTime = laps.reduce((total, lap) => total + (lap.totalTimeSec ?? 0), 0);
  const totalLapDistance = laps.reduce((total, lap) => total + (lap.distanceM ?? 0), 0);
  const elevation = calculateAscentDescent(points);
  const session = {
    startTime: points[0]?.timestamp,
    totalTimerTime: totalLapTime || samples.at(-1)?.elapsedSec,
    totalDistance: totalLapDistance || (distanceFromTrack ? distanceFromTrack * 1e3 : void 0),
    totalCalories: laps.reduce((total, lap) => total + (lap.calories ?? 0), 0) || void 0,
    avgHeartRate: averageOf(points.map((point) => point.heartRate)) ?? averageOf(laps.map((lap) => lap.avgHeartRate)),
    maxHeartRate: Math.max(...points.map((point) => point.heartRate ?? 0), ...laps.map((lap) => lap.maxHeartRate ?? 0), 0) || void 0,
    avgRunningCadence: averageOf(points.map((point) => point.cadence)),
    totalAscent: elevation.ascent || void 0,
    totalDescent: elevation.descent || void 0,
    avgTemperature: averageOf(points.map((point) => point.temperatureC))
  };
  const preview = metricFields(session, samples, sourceFormat);
  preview.garminDetails.rawSampleCount = points.length;
  preview.laps = laps.map((lap, index) => {
    const durationSec = lap.totalTimeSec ?? null;
    const distanceKm = lap.distanceM !== void 0 ? Number((lap.distanceM / 1e3).toFixed(3)) : null;
    return {
      lap: index + 1,
      durationSec: durationSec ? Math.round(durationSec) : null,
      distanceKm,
      avgPace: durationSec && distanceKm && distanceKm > 0 ? decimalPace(durationSec / distanceKm) ?? null : null
    };
  });
  if (!points.length) preview.warnings.push(`${sourceFormat} \u6A94\u672A\u5305\u542B\u6709\u6548\u7684\u6642\u9593\u8ECC\u8DE1\u9EDE\uFF1B\u8ACB\u78BA\u8A8D\u9019\u662F\u6D3B\u52D5\u8A18\u9304\u800C\u4E0D\u662F\u8DEF\u7DDA\u898F\u5283\u6A94\u3002`);
  if (sourceFormat === "GPX") preview.warnings.push("GPX \u6A19\u6E96\u53EF\u5305\u542B\u6642\u9593\u8207\u6D77\u62D4\uFF0C\u4F46\u5FC3\u7387\u3001\u6B65\u983B\u53CA\u529F\u7387\u6703\u8996 Garmin \u64F4\u5145\u6B04\u4F4D\u662F\u5426\u5B58\u5728\u800C\u5B9A\u3002");
  if (sourceFormat === "TCX" && !preview.laps.length) preview.warnings.push("\u6B64 TCX \u6C92\u6709\u5B8C\u6574 Lap \u8CC7\u8A0A\uFF1B\u5DF2\u4FDD\u7559\u53EF\u8B80\u53D6\u7684\u9010\u9EDE\u6642\u9593\u5E8F\u5217\u3002 ");
  if (!lastPoint) preview.warnings.push("\u8ACB\u5148\u6838\u5C0D\u6458\u8981\uFF0C\u518D\u5C07\u539F\u59CB\u6A94\u5957\u7528\u5230\u9019\u6B21\u8DD1\u6B65\u3002 ");
  return preview;
}
function parseActivityXml(buffer, sourceFormat) {
  const source = buffer.toString("utf8");
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error("GPX\uFF0FTCX \u6A94\u4E0D\u53EF\u5305\u542B\u5916\u90E8\u5BE6\u9AD4\u6216 DTD \u5BA3\u544A");
  const parser = sax.parser(true, { trim: true, normalize: false, position: false });
  const points = [];
  const laps = [];
  const tagStack = [];
  let rootName = "";
  let activePoint = null;
  let activeLap = null;
  let currentText = "";
  parser.onerror = (error) => {
    throw error;
  };
  parser.ondoctype = () => {
    throw new Error("GPX\uFF0FTCX \u6A94\u4E0D\u53EF\u5305\u542B DTD \u5BA3\u544A");
  };
  parser.onopentag = (tag) => {
    const name = localName(tag.name);
    tagStack.push(name);
    currentText = "";
    if (!rootName) rootName = name;
    if (sourceFormat === "GPX" && name === "trkpt" || sourceFormat === "TCX" && name === "trackpoint") {
      activePoint = {
        latitude: parseXmlNumber(xmlAttribute(tag, "lat")),
        longitude: parseXmlNumber(xmlAttribute(tag, "lon"))
      };
    }
    if (sourceFormat === "TCX" && name === "lap") {
      activeLap = { startedAt: parseXmlDate(xmlAttribute(tag, "starttime")) };
    }
  };
  parser.ontext = (text2) => {
    currentText += text2;
  };
  parser.oncdata = (text2) => {
    currentText += text2;
  };
  parser.onclosetag = (rawName) => {
    const name = localName(rawName);
    const parent = tagStack.at(-2) ?? "";
    const grandparent = tagStack.at(-3) ?? "";
    const value = currentText.trim();
    if (activePoint && value) {
      if (name === "time") activePoint.timestamp = parseXmlDate(value);
      if (name === "ele" || name === "altitudemeters") activePoint.altitudeM = parseXmlNumber(value);
      if (name === "distancemeters") activePoint.distanceM = parseXmlNumber(value);
      if (name === "latitudedegrees") activePoint.latitude = parseXmlNumber(value);
      if (name === "longitudedegrees") activePoint.longitude = parseXmlNumber(value);
      if (name === "value" && (parent === "heartratebpm" || grandparent === "heartratebpm") || name === "hr") activePoint.heartRate = parseXmlNumber(value);
      if (name === "cadence" || name === "runcadence" || name === "cad") activePoint.cadence = parseXmlNumber(value);
      if (name === "watts" || name === "power") activePoint.power = parseXmlNumber(value);
      if (name === "atemp" || name === "temperature") activePoint.temperatureC = parseXmlNumber(value);
    }
    if (activeLap && value) {
      if (name === "totaltimeseconds") activeLap.totalTimeSec = parseXmlNumber(value);
      if (name === "distancemeters") activeLap.distanceM = parseXmlNumber(value);
      if (name === "calories") activeLap.calories = parseXmlNumber(value);
      if (name === "value" && (parent === "averageheartratebpm" || grandparent === "averageheartratebpm")) activeLap.avgHeartRate = parseXmlNumber(value);
      if (name === "value" && (parent === "maximumheartratebpm" || grandparent === "maximumheartratebpm")) activeLap.maxHeartRate = parseXmlNumber(value);
    }
    if (sourceFormat === "GPX" && name === "trkpt" || sourceFormat === "TCX" && name === "trackpoint") {
      if (activePoint?.timestamp) points.push(activePoint);
      activePoint = null;
    }
    if (sourceFormat === "TCX" && name === "lap") {
      laps.push(activeLap ?? {});
      activeLap = null;
    }
    tagStack.pop();
    currentText = "";
  };
  try {
    parser.write(source).close();
  } catch (error) {
    throw new Error(`\u7121\u6CD5\u8B80\u53D6 ${sourceFormat} XML\uFF1A${error instanceof Error ? error.message : "\u6A94\u6848\u683C\u5F0F\u4E0D\u6B63\u78BA"}`);
  }
  if (sourceFormat === "GPX" && rootName !== "gpx") throw new Error("\u9019\u4E0D\u662F\u6709\u6548\u7684 GPX \u6D3B\u52D5\u6A94");
  if (sourceFormat === "TCX" && rootName !== "trainingcenterdatabase") throw new Error("\u9019\u4E0D\u662F\u6709\u6548\u7684 TCX \u6D3B\u52D5\u6A94");
  return xmlPreview(points, laps, sourceFormat);
}
function parseGarminGpx(buffer) {
  return parseActivityXml(buffer, "GPX");
}
function parseGarminTcx(buffer) {
  return parseActivityXml(buffer, "TCX");
}
function parseGarminRawFile(buffer, filename) {
  if (buffer.length > 25 * 1024 * 1024) throw new Error("\u539F\u59CB Garmin \u6A94\u6848\u8D85\u904E 25MB \u9650\u5236");
  if (/\.fit$/i.test(filename)) return parseGarminFit(buffer);
  if (/\.csv$/i.test(filename)) return parseGarminCsv(buffer);
  if (/\.gpx$/i.test(filename)) return parseGarminGpx(buffer);
  if (/\.tcx$/i.test(filename)) return parseGarminTcx(buffer);
  throw new Error("\u8ACB\u9078\u64C7 Garmin FIT\u3001CSV\u3001GPX \u6216 TCX \u539F\u59CB\u6A94");
}

// shared/healthSpreadsheet.ts
function isRealCalendarDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  const date2 = new Date(Date.UTC(year, month - 1, day));
  return date2.getUTCFullYear() === year && date2.getUTCMonth() === month - 1 && date2.getUTCDate() === day;
}
function normalizeHKDate(value) {
  const trimmed = value.trim();
  const iso = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (iso) {
    const normalized = `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
    return isRealCalendarDate(normalized) ? normalized : null;
  }
  const dmy = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy) {
    const normalized = `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
    return isRealCalendarDate(normalized) ? normalized : null;
  }
  return null;
}

// server/routers.ts
import Papa2 from "papaparse";
var OWNER_USER_ID = 2;
var MAX_GARMIN_RAW_FILE_BYTES = 25 * 1024 * 1024;
var GARMIN_RAW_UPLOAD_CHUNK_BYTES = 2 * 1024 * 1024;
var MAX_GARMIN_RAW_UPLOAD_CHUNKS = Math.ceil(MAX_GARMIN_RAW_FILE_BYTES / GARMIN_RAW_UPLOAD_CHUNK_BYTES);
var GARMIN_RAW_FILE_FORMATS = ["FIT", "CSV", "GPX", "TCX"];
function garminRawFormatFromFilename(fileName) {
  const extension = fileName.split(".").at(-1)?.toUpperCase();
  return extension && GARMIN_RAW_FILE_FORMATS.includes(extension) ? extension : null;
}
function validateGarminChunkKeys(chunkKeys, uploadId) {
  const prefix = `garmin-chunks/${OWNER_USER_ID}/${uploadId}/`;
  if (!chunkKeys.length || chunkKeys.length > MAX_GARMIN_RAW_UPLOAD_CHUNKS) throw new Error("Garmin \u539F\u59CB\u6A94\u5206\u6BB5\u6578\u91CF\u7121\u6548");
  for (let index = 0; index < chunkKeys.length; index += 1) {
    const key = chunkKeys[index];
    if (!key.startsWith(`${prefix}${index}_`) || !key.endsWith(".part")) throw new Error("Garmin \u539F\u59CB\u6A94\u5206\u6BB5\u4F86\u6E90\u7121\u6548");
  }
}
function validateGarminOriginalKey(key) {
  if (!/^garmin-originals\/\d+\/[a-zA-Z0-9_-]+_[a-f0-9]{8}\.(fit|csv|gpx|tcx)$/i.test(key)) {
    throw new Error("\u7121\u6548\u7684 Garmin \u539F\u59CB\u6A94\u4F86\u6E90");
  }
}
function isGarminLegacyStagingKey(key) {
  return /^garmin-staging\/\d+\/[a-zA-Z0-9_-]{8,}\.(fit|csv|gpx|tcx)$/i.test(key);
}
function decodeGarminChunk(base64) {
  const normalized = base64.replace(/\s/g, "");
  if (!normalized || normalized.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
    throw new Error("Garmin \u539F\u59CB\u6A94\u5206\u6BB5\u8CC7\u6599\u683C\u5F0F\u7121\u6548");
  }
  const chunk = Buffer.from(normalized, "base64");
  if (!chunk.length || chunk.length > GARMIN_RAW_UPLOAD_CHUNK_BYTES) throw new Error("Garmin \u539F\u59CB\u6A94\u5206\u6BB5\u5927\u5C0F\u7121\u6548");
  return chunk;
}
async function mirrorSheetFirstBatch(sheetType, rows, mirrorRow) {
  try {
    await upsertRowsToSheetByDate(sheetType, rows.map(({ data }) => ({ ...data, source: "app_spreadsheet" })));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google Sheets \u540C\u6B65\u5931\u6557";
    return rows.map(({ rowIndex }) => ({ rowIndex, status: "failed", message: `\u672A\u5BEB\u5165\uFF1A${message}` }));
  }
  const results = [];
  for (const { rowIndex, data } of rows) {
    try {
      results.push({ rowIndex, status: await mirrorRow(data) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "\u8CC7\u6599\u5EAB\u93E1\u50CF\u5931\u6557";
      results.push({ rowIndex, status: "synced", message: `\u8A66\u7B97\u8868\u5DF2\u540C\u6B65\uFF1B\u8CC7\u6599\u5EAB\u93E1\u50CF\u7A0D\u5F8C\u91CD\u8A66\uFF08${message}\uFF09` });
    }
  }
  return results;
}
var CARDIO_EXERCISE_NAMES = [
  "Stationary Bike",
  "Treadmill",
  "Stair Climber",
  "Elliptical Trainer",
  "Rowing Machine",
  "Ski Erg",
  "Air Bike",
  "Jacob's Ladder"
];
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
    return db.select().from(mealLogs).where(and(eq2(mealLogs.userId, OWNER_USER_ID), eq2(mealLogs.logDate, input.date))).orderBy(mealLogs.createdAt);
  }),
  // Get meal logs for date range
  getMealLogsRange: publicProcedure.input(z2.object({ startDate: z2.string(), endDate: z2.string() })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(mealLogs).where(and(
      eq2(mealLogs.userId, OWNER_USER_ID),
      sql2`${mealLogs.logDate} >= ${input.startDate}::date`,
      sql2`${mealLogs.logDate} <= ${input.endDate}::date`
    )).orderBy(desc(mealLogs.logDate));
  }),
  // Add meal log
  addMealLog: publicProcedure.input(z2.object({
    date: z2.string(),
    // YYYY-MM-DD in HK timezone
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
    const { date: date2, ...rest } = input;
    const loggedAt = /* @__PURE__ */ new Date(date2 + "T12:00:00+08:00");
    await db.insert(mealLogs).values({ ...rest, userId: OWNER_USER_ID, logDate: date2, loggedAt });
    return { success: true };
  }),
  // Update meal log
  updateMealLog: ownerProcedure.input(z2.object({
    id: z2.number(),
    date: z2.string().optional(),
    // YYYY-MM-DD in HK timezone
    foodName: z2.string().optional(),
    quantity: z2.number().optional(),
    calories: z2.number().optional(),
    protein: z2.number().optional(),
    carbs: z2.number().optional(),
    fat: z2.number().optional(),
    fiber: z2.number().optional(),
    notes: z2.string().optional(),
    mealType: z2.enum(["breakfast", "lunch", "dinner", "snack"]).optional()
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const { id, date: date2, ...rest } = input;
    const updateData = { ...rest };
    if (date2) {
      updateData.logDate = date2;
      updateData.loggedAt = /* @__PURE__ */ new Date(date2 + "T12:00:00+08:00");
    }
    await db.update(mealLogs).set(updateData).where(and(eq2(mealLogs.id, id), eq2(mealLogs.userId, OWNER_USER_ID)));
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
  analyzeFoodPhoto: ownerProcedure.input(z2.object({
    imageUrl: z2.string().optional(),
    imageBase64: z2.string().optional(),
    mimeType: z2.string().optional()
  })).mutation(async ({ input }) => {
    let resolvedImageUrl;
    if (input.imageBase64) {
      const mime = input.mimeType || "image/jpeg";
      resolvedImageUrl = `data:${mime};base64,${input.imageBase64}`;
    } else if (input.imageUrl?.startsWith("/manus-storage/")) {
      const key = input.imageUrl.replace("/manus-storage/", "");
      try {
        resolvedImageUrl = await storageGetSignedUrl(key);
      } catch (e) {
        console.error("[analyzeFoodPhoto] Failed to get signed URL:", e);
        resolvedImageUrl = input.imageUrl;
      }
    } else {
      resolvedImageUrl = input.imageUrl ?? "";
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
  }),
  // AI text-based food nutrition lookup: restaurant name + food name -> macros
  lookupFoodNutrition: ownerProcedure.input(z2.object({
    restaurantName: z2.string().optional(),
    foodName: z2.string().min(1),
    quantity: z2.number().optional()
  })).mutation(async ({ input }) => {
    const context = input.restaurantName ? `The food is from restaurant/brand: "${input.restaurantName}". Food item: "${input.foodName}".` : `Food item: "${input.foodName}".`;
    const qty = input.quantity ?? 100;
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a professional nutritionist with extensive knowledge of restaurant menus and food databases worldwide, including Hong Kong restaurants. Provide accurate nutritional estimates based on the food name and restaurant context. Always respond with valid JSON only.`
        },
        {
          role: "user",
          content: `${context} Estimate the nutritional content for ${qty}g (or 1 serving if weight is unclear). Provide the response as JSON with this exact structure: {"name":"Food Name","nameZh":"\u98DF\u7269\u4E2D\u6587\u540D","quantity":${qty},"unit":"g","calories":250,"protein":15,"carbs":30,"fat":8,"fiber":2,"confidence":"high","notes":"Brief note about the estimate"}`
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "food_nutrition_lookup",
          strict: true,
          schema: {
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
              fiber: { type: "number" },
              confidence: { type: "string" },
              notes: { type: "string" }
            },
            required: ["name", "nameZh", "quantity", "unit", "calories", "protein", "carbs", "fat", "fiber", "confidence", "notes"],
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
    if (!db) return { caloriesBurned: 0, sessions: [], runningBurned: 0, stepsBurned: 0, totalBurned: 0 };
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
    const runningRows = await db.select({ calories: runningLogs.calories }).from(runningLogs).where(sql2`${runningLogs.date} = ${input.date}`);
    const runningBurned = runningRows.reduce((s, r) => s + (r.calories ?? 0), 0);
    const stepsRows = await db.select({ calories: dailySteps.calories }).from(dailySteps).where(and(
      eq2(dailySteps.userId, OWNER_USER_ID),
      sql2`${dailySteps.date} = ${input.date}`
    ));
    const stepsBurned = stepsRows.reduce((s, r) => s + (r.calories ?? 0), 0);
    const totalBurned = caloriesBurned + runningBurned + stepsBurned;
    return { caloriesBurned, sessions, runningBurned, stepsBurned, totalBurned };
  }),
  // Create workout session
  createSession: ownerProcedure.input(z2.object({
    date: z2.string(),
    name: z2.string().optional(),
    duration: z2.number().optional(),
    notes: z2.string().optional(),
    templateKey: z2.string().optional(),
    plannedExercises: z2.array(z2.object({
      name: z2.string(),
      nameZh: z2.string().optional(),
      targetSets: z2.number().int().min(1).max(12),
      targetReps: z2.string(),
      equipment: z2.string().optional()
    })).optional()
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const { date: date2, ...sessionInput } = input;
    const result = await db.insert(workoutSessions).values({
      ...sessionInput,
      userId: OWNER_USER_ID,
      startTime: /* @__PURE__ */ new Date(`${date2}T12:00:00+08:00`)
    }).returning({ id: workoutSessions.id });
    return { success: true, id: result[0]?.id ?? 0 };
  }),
  // Update session
  updateSession: ownerProcedure.input(z2.object({
    id: z2.number(),
    name: z2.string().optional(),
    duration: z2.number().optional(),
    notes: z2.string().optional(),
    totalVolume: z2.number().optional(),
    startTime: z2.string().optional(),
    // ISO string
    endTime: z2.string().optional(),
    // ISO string
    caloriesBurned: z2.number().optional()
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const { id, startTime, endTime, ...rest } = input;
    const data = { ...rest };
    if (startTime) data.startTime = new Date(startTime);
    if (endTime) data.endTime = new Date(endTime);
    if (startTime || endTime) {
      const rows = await db.select().from(workoutSessions).where(and(eq2(workoutSessions.id, id), eq2(workoutSessions.userId, OWNER_USER_ID))).limit(1);
      if (rows.length) {
        const session = rows[0];
        const newStart = data.startTime ?? (session.startTime ? new Date(session.startTime) : null);
        const newEnd = data.endTime ?? (session.endTime ? new Date(session.endTime) : null);
        if (newStart && newEnd && newEnd > newStart) {
          const durationMin = Math.max(1, Math.round((newEnd.getTime() - newStart.getTime()) / 6e4));
          data.duration = durationMin;
          const volumeResult = await db.execute(sql2`
              SELECT COALESCE(SUM(reps * weight), 0) as total
              FROM workout_sets WHERE session_id = ${id}
              AND reps IS NOT NULL AND weight IS NOT NULL
            `);
          const totalVolume = Number((volumeResult.rows?.[0] ?? volumeResult[0])?.total ?? 0);
          const met = totalVolume > 5e3 ? 6 : totalVolume > 2e3 ? 5.5 : 5;
          data.caloriesBurned = Math.round(met * 70 * (durationMin / 60));
        }
      }
    }
    const updateData = {};
    if (data.name !== void 0) updateData.name = data.name;
    if (data.duration !== void 0) updateData.duration = data.duration;
    if (data.notes !== void 0) updateData.notes = data.notes;
    if (data.totalVolume !== void 0) updateData.totalVolume = data.totalVolume;
    if (data.caloriesBurned !== void 0) updateData.caloriesBurned = data.caloriesBurned;
    if (data.startTime !== void 0) updateData.startTime = data.startTime;
    if (data.endTime !== void 0) updateData.endTime = data.endTime;
    updateData.updatedAt = /* @__PURE__ */ new Date();
    if (Object.keys(updateData).length > 1) {
      await db.update(workoutSessions).set(updateData).where(and(eq2(workoutSessions.id, id), eq2(workoutSessions.userId, OWNER_USER_ID)));
    }
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
    avgHr: z2.number().optional(),
    calories: z2.number().optional(),
    notes: z2.string().optional()
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const { exerciseId, ...rest } = input;
    await db.insert(workoutSets).values({
      sessionId: rest.sessionId,
      exerciseId: exerciseId ?? null,
      exerciseName: rest.exerciseName,
      setNumber: rest.setNumber,
      reps: rest.reps ?? null,
      weight: rest.weight ?? null,
      duration: rest.duration ?? null,
      distance: rest.distance ?? null,
      avgHr: rest.avgHr ?? null,
      calories: rest.calories ?? null,
      notes: rest.notes ?? null
    });
    const volumeResult = await db.execute(sql2`
        SELECT COALESCE(SUM(reps * weight), 0) as total
        FROM workout_sets
        WHERE session_id = ${rest.sessionId} AND reps IS NOT NULL AND weight IS NOT NULL
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
    distance: z2.number().optional(),
    avgHr: z2.number().optional(),
    calories: z2.number().optional(),
    notes: z2.string().optional()
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const { id, reps, weight, duration, distance, avgHr, calories, notes } = input;
    const updateData = {};
    if (reps !== void 0) updateData.reps = reps;
    if (weight !== void 0) updateData.weight = weight;
    if (duration !== void 0) updateData.duration = duration;
    if (distance !== void 0) updateData.distance = distance;
    if (avgHr !== void 0) updateData.avgHr = avgHr;
    if (calories !== void 0) updateData.calories = calories;
    if (notes !== void 0) updateData.notes = notes;
    if (Object.keys(updateData).length === 0) return { success: true };
    await db.update(workoutSets).set(updateData).where(eq2(workoutSets.id, id));
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
        WHERE user_id = ${OWNER_USER_ID}
        ORDER BY created_at DESC
      `);
    return (rows.rows ?? rows).map((r) => r.exercise_name);
  }),
  toggleFavourite: ownerProcedure.input(z2.object({ exerciseName: z2.string().min(1) })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const existing = await db.execute(sql2`
        SELECT id FROM favourite_exercises
        WHERE user_id = ${OWNER_USER_ID} AND exercise_name = ${input.exerciseName}
      `);
    const rows = existing.rows ?? existing;
    if (rows.length > 0) {
      await db.execute(sql2`
          DELETE FROM favourite_exercises
          WHERE user_id = ${OWNER_USER_ID} AND exercise_name = ${input.exerciseName}
        `);
      return { isFavourite: false };
    } else {
      await db.execute(sql2`
          INSERT INTO favourite_exercises (user_id, exercise_name)
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
        FROM workout_sets WHERE session_id = ${input.id}
        AND reps IS NOT NULL AND weight IS NOT NULL
      `);
    const totalVolume = Number((volumeResult.rows?.[0] ?? volumeResult[0])?.total ?? 0);
    const met = totalVolume > 5e3 ? 6 : totalVolume > 2e3 ? 5.5 : 5;
    const caloriesBurned = Math.round(met * 70 * (durationMin / 60));
    await db.update(workoutSessions).set({
      endTime,
      duration: durationMin,
      caloriesBurned,
      totalVolume,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq2(workoutSessions.id, input.id));
    const exerciseCountResult = await db.execute(sql2`
        SELECT COUNT(DISTINCT exercise_id) as cnt
        FROM workout_sets WHERE session_id = ${input.id}
      `);
    const exerciseCount = Number((exerciseCountResult.rows?.[0] ?? exerciseCountResult[0])?.cnt ?? 0);
    return { success: true, duration: durationMin, caloriesBurned, totalVolume, exerciseCount };
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
  }),
  // Get personal records (max weight per exercise) for the owner
  getExercisePRs: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return {};
    const rows = await db.execute(sql2`
        SELECT ws.exercise_name, MAX(ws.weight) as max_weight
        FROM workout_sets ws
        INNER JOIN workout_sessions sess ON ws.session_id = sess.id
        WHERE sess.user_id = ${OWNER_USER_ID}
          AND ws.weight IS NOT NULL
          AND ws.weight > 0
        GROUP BY ws.exercise_name
      `);
    const prMap = {};
    const resultRows = rows.rows ?? rows;
    for (const row of resultRows) {
      prMap[row.exercise_name] = Number(row.max_weight);
    }
    return prMap;
  }),
  // Get full PR history: each exercise's all-time best set with date achieved + previous PR for delta
  getPRHistory: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.execute(sql2`
        WITH ranked_weights AS (
          SELECT
            ws.exercise_name,
            ws.weight,
            ws.reps,
            sess.start_time as achieved_at,
            sess.name as session_name,
            DENSE_RANK() OVER (PARTITION BY ws.exercise_name ORDER BY ws.weight DESC) as weight_rank
          FROM workout_sets ws
          INNER JOIN workout_sessions sess ON ws.session_id = sess.id
          WHERE sess.user_id = ${OWNER_USER_ID}
            AND ws.weight IS NOT NULL
            AND ws.weight > 0
        )
        SELECT * FROM ranked_weights WHERE weight_rank <= 2
        ORDER BY weight DESC, achieved_at DESC
      `);
    const resultRows = rows.rows ?? rows;
    const prMap = /* @__PURE__ */ new Map();
    for (const row of resultRows) {
      const name = row.exercise_name;
      const rank = Number(row.weight_rank);
      if (rank === 1 && !prMap.has(name)) {
        prMap.set(name, {
          prWeight: Number(row.weight),
          prReps: row.reps ? Number(row.reps) : null,
          achievedAt: row.achieved_at ? new Date(row.achieved_at).toISOString() : null,
          sessionName: row.session_name ?? null,
          prevWeight: null
        });
      } else if (rank === 2 && prMap.has(name)) {
        const entry = prMap.get(name);
        entry.prevWeight = Number(row.weight);
      }
    }
    return Array.from(prMap.values()).map((v, i) => ({
      exerciseName: Array.from(prMap.keys())[i],
      ...v
    }));
  }),
  getProgressionSuggestion: publicProcedure.input(z2.object({ exerciseName: z2.string().min(1) })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return buildProgressionSuggestion([]);
    const rows = await db.select({
      reps: workoutSets.reps,
      weight: workoutSets.weight,
      createdAt: workoutSets.createdAt
    }).from(workoutSets).innerJoin(workoutSessions, eq2(workoutSets.sessionId, workoutSessions.id)).where(and(
      eq2(workoutSessions.userId, OWNER_USER_ID),
      eq2(workoutSets.exerciseName, input.exerciseName),
      sql2`${workoutSessions.endTime} IS NOT NULL`,
      sql2`${workoutSets.reps} IS NOT NULL`,
      sql2`${workoutSets.weight} IS NOT NULL`
    )).orderBy(desc(workoutSets.createdAt)).limit(12);
    return buildProgressionSuggestion(rows);
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
  // Get the most recent weight record on or before a given date
  getWeightOnOrBefore: publicProcedure.input(z2.object({ date: z2.string() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select({
      date: bodyComposition.date,
      weight: bodyComposition.weight
    }).from(bodyComposition).where(and(
      eq2(bodyComposition.userId, OWNER_USER_ID),
      sql2`${bodyComposition.date} <= ${input.date}`,
      sql2`${bodyComposition.weight} IS NOT NULL`
    )).orderBy(desc(bodyComposition.date)).limit(1);
    return rows[0] ?? null;
  }),
  batchUpsert: ownerProcedure.input(z2.object({ rows: z2.array(z2.object({
    rowIndex: z2.number().int().min(0),
    data: z2.object({
      date: z2.string().refine((value) => normalizeHKDate(value) !== null, "\u65E5\u671F\u9808\u70BA\u9999\u6E2F YYYY-MM-DD"),
      weight: z2.number().min(10).max(500).optional(),
      bmi: z2.number().min(5).max(100).optional(),
      bodyFatPct: z2.number().min(0).max(100).optional(),
      fatMass: z2.number().min(0).max(300).optional(),
      muscleMass: z2.number().min(0).max(250).optional(),
      bmr: z2.number().int().min(300).max(1e4).optional(),
      visceralFat: z2.number().int().min(0).max(100).optional(),
      notes: z2.string().max(500).optional()
    }).refine((row) => Object.entries(row).some(([key, value]) => key !== "date" && key !== "notes" && value !== void 0), "\u8ACB\u81F3\u5C11\u8F38\u5165\u4E00\u9805\u8EAB\u9AD4\u6578\u64DA")
  })).min(1).max(100) })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    return mirrorSheetFirstBatch("body", input.rows, async (row) => {
      const existing = await db.select({ id: bodyComposition.id }).from(bodyComposition).where(and(eq2(bodyComposition.userId, OWNER_USER_ID), eq2(bodyComposition.date, row.date))).limit(1);
      const data = { ...row, userId: OWNER_USER_ID, source: "sheets" };
      if (existing[0]) {
        await db.update(bodyComposition).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(bodyComposition.id, existing[0].id));
        return "updated";
      }
      await db.insert(bodyComposition).values(data);
      return "created";
    });
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
  batchUpsert: ownerProcedure.input(z2.object({ rows: z2.array(z2.object({
    rowIndex: z2.number().int().min(0),
    data: z2.object({
      date: z2.string().refine((value) => normalizeHKDate(value) !== null, "\u65E5\u671F\u9808\u70BA\u9999\u6E2F YYYY-MM-DD"),
      restingHr: z2.number().int().min(25).max(250).optional(),
      highHr: z2.number().int().min(25).max(260).optional(),
      avgHr: z2.number().int().min(25).max(250).optional(),
      hrv: z2.number().int().min(0).max(500).optional(),
      notes: z2.string().max(500).optional()
    }).refine((row) => Object.entries(row).some(([key, value]) => key !== "date" && key !== "notes" && value !== void 0), "\u8ACB\u81F3\u5C11\u8F38\u5165\u4E00\u9805\u5FC3\u8DF3\u6578\u64DA")
  })).min(1).max(100) })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    return mirrorSheetFirstBatch("heartrate", input.rows, async (row) => {
      const existing = await db.select({ id: heartRateLogs.id }).from(heartRateLogs).where(and(eq2(heartRateLogs.userId, OWNER_USER_ID), eq2(heartRateLogs.date, row.date))).limit(1);
      const data = { ...row, userId: OWNER_USER_ID, source: "sheets" };
      if (existing[0]) {
        await db.update(heartRateLogs).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(heartRateLogs.id, existing[0].id));
        return "updated";
      }
      await db.insert(heartRateLogs).values(data);
      return "created";
    });
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
    bedtime: z2.string().optional(),
    waketime: z2.string().optional(),
    notes: z2.string().optional(),
    source: z2.string().optional()
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const { score, quality, duration, restingHr, ...rest } = input;
    await db.insert(sleepLogs).values({
      ...rest,
      userId: OWNER_USER_ID,
      sleepScore: score,
      sleepQuality: quality,
      sleepDuration: duration,
      restingHr
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
    bedtime: z2.string().optional(),
    waketime: z2.string().optional(),
    notes: z2.string().optional()
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const { id, score, quality, duration, restingHr, ...rest } = input;
    const data = { ...rest, sleepScore: score, sleepQuality: quality, sleepDuration: duration, restingHr };
    await db.update(sleepLogs).set(data).where(and(eq2(sleepLogs.id, id), eq2(sleepLogs.userId, OWNER_USER_ID)));
    return { success: true };
  }),
  delete: ownerProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.delete(sleepLogs).where(and(eq2(sleepLogs.id, input.id), eq2(sleepLogs.userId, OWNER_USER_ID)));
    return { success: true };
  }),
  batchUpsert: ownerProcedure.input(z2.object({ rows: z2.array(z2.object({
    rowIndex: z2.number().int().min(0),
    data: z2.object({
      date: z2.string().refine((value) => normalizeHKDate(value) !== null, "\u65E5\u671F\u9808\u70BA\u9999\u6E2F YYYY-MM-DD"),
      score: z2.number().int().min(0).max(100).optional(),
      restingHr: z2.number().int().min(25).max(250).optional(),
      bodyBattery: z2.number().int().min(0).max(100).optional(),
      pulseOx: z2.number().min(50).max(100).optional(),
      respiration: z2.number().min(4).max(60).optional(),
      hrv: z2.number().int().min(0).max(500).optional(),
      quality: z2.enum(["Poor", "Fair", "Good", "Excellent"]).optional(),
      duration: z2.number().min(0).max(24).optional(),
      bedtime: z2.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
      waketime: z2.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
      notes: z2.string().max(500).optional()
    }).refine((row) => Object.entries(row).some(([key, value]) => !["date", "quality", "bedtime", "waketime", "notes"].includes(key) && value !== void 0), "\u8ACB\u81F3\u5C11\u8F38\u5165\u4E00\u9805\u7761\u7720\u6578\u64DA")
  })).min(1).max(100) })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    return mirrorSheetFirstBatch("sleep", input.rows, async (row) => {
      const existing = await db.select({ id: sleepLogs.id }).from(sleepLogs).where(and(eq2(sleepLogs.userId, OWNER_USER_ID), eq2(sleepLogs.date, row.date))).limit(1);
      const { score, quality, duration, restingHr, ...rest } = row;
      const data = {
        ...rest,
        userId: OWNER_USER_ID,
        source: "sheets",
        sleepScore: score,
        sleepQuality: quality,
        sleepDuration: duration,
        restingHr
      };
      if (existing[0]) {
        await db.update(sleepLogs).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(sleepLogs.id, existing[0].id));
        return "updated";
      }
      await db.insert(sleepLogs).values(data);
      return "created";
    });
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
      const { score, quality, duration, restingHr, ...rest } = row;
      await db.insert(sleepLogs).values({
        ...rest,
        userId: OWNER_USER_ID,
        source: "sheets",
        sleepScore: score,
        sleepQuality: quality,
        sleepDuration: duration,
        restingHr
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
    const monthAgoStr = daysAgoHK(30);
    const [meals, sessions, workoutSetRows, body, sleep, hr, running, steps, bloodPressure, goals, profile] = await Promise.all([
      db.select().from(mealLogs).where(and(eq2(mealLogs.userId, OWNER_USER_ID), sql2`${mealLogs.logDate} >= ${weekAgoStr}::date`)).limit(50),
      db.select().from(workoutSessions).where(and(eq2(workoutSessions.userId, OWNER_USER_ID), sql2`${workoutSessions.startTime} >= ${weekAgo}`)),
      db.select().from(workoutSets).innerJoin(workoutSessions, eq2(workoutSets.sessionId, workoutSessions.id)).where(and(eq2(workoutSessions.userId, OWNER_USER_ID), sql2`${workoutSessions.startTime} >= ${weekAgo}`)).limit(100),
      db.select().from(bodyComposition).where(eq2(bodyComposition.userId, OWNER_USER_ID)).orderBy(desc(bodyComposition.date)).limit(10),
      db.select().from(sleepLogs).where(and(eq2(sleepLogs.userId, OWNER_USER_ID), gte(sleepLogs.date, weekAgoStr))),
      db.select().from(heartRateLogs).where(and(eq2(heartRateLogs.userId, OWNER_USER_ID), gte(heartRateLogs.date, weekAgoStr))),
      db.select().from(runningLogs).where(sql2`${runningLogs.date} >= ${weekAgoStr}`).orderBy(desc(runningLogs.date)).limit(10),
      db.select().from(dailySteps).where(and(eq2(dailySteps.userId, OWNER_USER_ID), sql2`${dailySteps.date} >= ${weekAgoStr}::date`)),
      db.select().from(bloodPressureLogs).where(and(eq2(bloodPressureLogs.userId, OWNER_USER_ID), sql2`${bloodPressureLogs.measuredAt} >= ${weekAgo}`)).orderBy(desc(bloodPressureLogs.measuredAt)).limit(20),
      db.select().from(healthGoals).where(and(eq2(healthGoals.userId, OWNER_USER_ID), eq2(healthGoals.isActive, true))).limit(10),
      db.select().from(userProfile).where(eq2(userProfile.userId, OWNER_USER_ID)).limit(1)
    ]);
    const cardioSets = workoutSetRows.filter((s) => s.workout_sets.duration && s.workout_sets.duration > 0);
    const strengthSets = workoutSetRows.filter((s) => s.workout_sets.reps && s.workout_sets.reps > 0);
    const avgSleepDuration = sleep.length > 0 ? (sleep.reduce((a, s) => a + (s.sleepDuration ?? 0), 0) / sleep.length).toFixed(1) : null;
    const avgSleepScore = sleep.length > 0 ? Math.round(sleep.reduce((a, s) => a + (s.sleepScore ?? 0), 0) / sleep.length) : null;
    const avgHRV = sleep.filter((s) => s.hrv).length > 0 ? Math.round(sleep.filter((s) => s.hrv).reduce((a, s) => a + (s.hrv ?? 0), 0) / sleep.filter((s) => s.hrv).length) : null;
    const avgDailyCalories = meals.length > 0 ? Math.round(meals.reduce((a, m) => a + (m.calories ?? 0), 0) / 7) : null;
    const avgDailyProtein = meals.length > 0 ? Math.round(meals.reduce((a, m) => a + (m.protein ?? 0), 0) / 7) : null;
    const bpSummary = bloodPressure.length > 0 ? {
      count: bloodPressure.length,
      latestSystolic: bloodPressure[0]?.systolic,
      latestDiastolic: bloodPressure[0]?.diastolic,
      latestPulse: bloodPressure[0]?.pulse,
      avgSystolic: Math.round(bloodPressure.reduce((a, b) => a + (b.systolic ?? 0), 0) / bloodPressure.length),
      avgDiastolic: Math.round(bloodPressure.reduce((a, b) => a + (b.diastolic ?? 0), 0) / bloodPressure.length)
    } : null;
    const totalSteps = steps.reduce((a, s) => a + (s.steps ?? 0), 0);
    const avgDailySteps = steps.length > 0 ? Math.round(totalSteps / steps.length) : null;
    const totalFloors = steps.reduce((a, s) => a + (s.floorsClimbed ?? 0), 0);
    const totalRunDistance = running.reduce((a, r) => a + (r.distanceKm ?? 0), 0);
    const avgRunPace = running.filter((r) => r.averagePace).length > 0 ? running.filter((r) => r.averagePace).map((r) => r.averagePace).join(", ") : null;
    const activeGoals = goals.map((g) => ({ type: g.goalType, target: g.targetValue, unit: g.unit, notes: g.notes }));
    const dataContext = JSON.stringify({
      profile: profile[0] ? { birthYear: profile[0].birthYear, gender: profile[0].gender, height: profile[0].height } : null,
      period: `${weekAgoStr} to ${todayStr} (HKT)`,
      nutrition: { avgDailyCalories, avgDailyProtein, mealCount: meals.length, meals: meals.slice(0, 20) },
      workout: { sessions: sessions.length, strengthSets: strengthSets.length, cardioSets: cardioSets.length, sessions_detail: sessions },
      sleep: { records: sleep.length, avgDurationHrs: avgSleepDuration, avgScore: avgSleepScore, avgHRV_ms: avgHRV, records_detail: sleep },
      heartRate: { records: hr.length, records_detail: hr },
      bloodPressure: bpSummary,
      running: { runs: running.length, totalDistanceKm: totalRunDistance.toFixed(1), avgPace: avgRunPace },
      steps: { avgDailySteps, totalFloors, daysTracked: steps.length },
      bodyComposition: body.slice(0, 5),
      activeGoals
    }, null, 2);
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `\u4F60\u662F\u4E00\u4F4D\u5C08\u696D\u7684\u500B\u4EBA\u5065\u5EB7\u6559\u7DF4\u3001\u71DF\u990A\u5E2B\u53CA\u904B\u52D5\u79D1\u5B78\u5BB6\u3002\u4F60\u5FC5\u9808\u5B8C\u5168\u4F7F\u7528\u7E41\u9AD4\u4E2D\u6587\uFF08Traditional Chinese\uFF09\u56DE\u7B54\uFF0C\u4E0D\u5F97\u4F7F\u7528\u82F1\u6587\u6BB5\u843D\u6216\u82F1\u6587\u6A19\u984C\u3002\u4F60\u53EF\u4EE5\u5728\u62EC\u865F\u5167\u9644\u4E0A\u82F1\u6587\u8853\u8A9E\u4F5C\u88DC\u5145\u8AAA\u660E\uFF0C\u4F46\u4E3B\u8981\u5167\u5BB9\u5FC5\u9808\u5168\u90E8\u70BA\u7E41\u9AD4\u4E2D\u6587\u3002\u8ACB\u4F7F\u7528 Markdown \u683C\u5F0F\uFF08\u6A19\u984C\u3001\u7C97\u9AD4\u3001\u5217\u8868\uFF09\u3002\u4F60\u53EF\u4EE5\u67E5\u95B1\u7528\u6236\u7684\u5168\u9762\u5065\u5EB7\u6578\u64DA\uFF0C\u5305\u62EC\u98F2\u98DF\u3001\u529B\u91CF\u8A13\u7DF4\u3001\u6709\u6C27\u904B\u52D5\u3001\u7761\u7720\u3001\u5FC3\u7387\u3001\u8840\u58D3\u3001\u8DD1\u6B65\u3001\u6BCF\u65E5\u6B65\u6578\u3001\u8EAB\u9AD4\u6210\u4EFD\u53CA\u5065\u5EB7\u76EE\u6A19\uFF0C\u8ACB\u5F9E\u6574\u9AD4\u89D2\u5EA6\u5206\u6790\u6240\u6709\u6578\u64DA\uFF0C\u627E\u51FA\u898F\u5F8B\u548C\u5404\u6307\u6A19\u4E4B\u9593\u7684\u95DC\u806F\uFF0C\u4E26\u63D0\u4F9B\u500B\u4EBA\u5316\u3001\u5177\u9AD4\u53EF\u884C\u7684\u5EFA\u8B70\u3002`
        },
        {
          role: "user",
          content: `\u4EE5\u4E0B\u662F\u6211\u904E\u53BB7\u5929\u7684\u5168\u9762\u5065\u5EB7\u6578\u64DA\uFF0C\u8ACB\u63D0\u4F9B\u8A73\u76E1\u7684${input.type === "nutrition" ? "\u98F2\u98DF" : input.type === "workout" ? "\u8A13\u7DF4" : input.type === "recovery" ? "\u6062\u5FA9\u8207\u7761\u7720" : "\u6574\u9AD4\u5065\u5EB7"}\u5206\u6790\uFF1A

${dataContext}

\u8ACB\u7528\u7E41\u9AD4\u4E2D\u6587\u5206\u6790\u4EE5\u4E0B\u5404\u9805\uFF08\u5FC5\u9808\u5168\u90E8\u4F7F\u7528\u7E41\u9AD4\u4E2D\u6587\uFF09\uFF1A
1. **\u6574\u9AD4\u5065\u5EB7\u6982\u6CC1** \u2014 \u672C\u9031\u95DC\u9375\u6307\u6A19\u53CA\u8DA8\u52E2
2. **\u98F2\u98DF\u5206\u6790** \u2014 \u5361\u8DEF\u91CC/\u5B8F\u91CF\u71DF\u990A\u7D20\u5E73\u8861\u3001\u98F2\u98DF\u6A21\u5F0F
3. **\u8A13\u7DF4\u5206\u6790** \u2014 \u8A13\u7DF4\u983B\u7387\u3001\u8A13\u7DF4\u91CF\u3001\u6709\u6C27\u8207\u529B\u91CF\u8A13\u7DF4\u6BD4\u4F8B
4. **\u6062\u5FA9\u8207\u7761\u7720** \u2014 \u7761\u7720\u8CEA\u91CF\u3001HRV\u3001\u8EAB\u9AD4\u6062\u5FA9\u8DA8\u52E2
5. **\u5FC3\u8840\u7BA1\u5065\u5EB7** \u2014 \u5FC3\u7387\u3001\u8840\u58D3\u6A21\u5F0F\uFF08\u5982\u6709\u6578\u64DA\uFF09
6. **\u6D3B\u52D5\u91CF** \u2014 \u6B65\u6578\u3001\u8DD1\u6B65\u3001\u6574\u9AD4\u6D3B\u52D5\u60C5\u6CC1
7. **\u88DC\u5145\u54C1\u4F9D\u5F9E\u6027** \u2014 \u88DC\u5145\u54C1\u8A08\u5283\u7684\u4E00\u81F4\u6027
8. **\u76EE\u6A19\u9032\u5EA6** \u2014 \u73FE\u6709\u5065\u5EB7\u76EE\u6A19\u7684\u9032\u5C55
9. **\u672C\u9031\u91CD\u9EDE\u5EFA\u8B70** \u2014 3\u81F35\u9805\u5177\u9AD4\u53EF\u884C\u7684\u6539\u5584\u5EFA\u8B70
10. **\u4E0B\u9031\u76EE\u6A19** \u2014 \u4E0B\u9031\u61C9\u9054\u6210\u7684\u5177\u9AD4\u76EE\u6A19`
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
    const [todayMeals, recentSessions, latestBody, latestSleep, latestHr, weekMeals, todayWorkouts, todayRunning, todayStepsRows, profileRows, todayCardioSets] = await Promise.all([
      db.select().from(mealLogs).where(and(eq2(mealLogs.userId, OWNER_USER_ID), eq2(mealLogs.logDate, todayStr))),
      db.select().from(workoutSessions).where(and(eq2(workoutSessions.userId, OWNER_USER_ID), sql2`${workoutSessions.startTime} >= ${weekAgoDate}`)).orderBy(desc(workoutSessions.startTime)).limit(7),
      db.select().from(bodyComposition).where(eq2(bodyComposition.userId, OWNER_USER_ID)).orderBy(desc(bodyComposition.date)).limit(2),
      db.select().from(sleepLogs).where(eq2(sleepLogs.userId, OWNER_USER_ID)).orderBy(desc(sleepLogs.date)).limit(1),
      db.select().from(heartRateLogs).where(eq2(heartRateLogs.userId, OWNER_USER_ID)).orderBy(desc(heartRateLogs.date)).limit(1),
      db.select().from(mealLogs).where(and(eq2(mealLogs.userId, OWNER_USER_ID), sql2`${mealLogs.logDate} >= ${weekAgoStr}::date`)),
      // Today's workout sessions
      db.select({ id: workoutSessions.id, name: workoutSessions.name, duration: workoutSessions.duration, caloriesBurned: workoutSessions.caloriesBurned }).from(workoutSessions).where(and(eq2(workoutSessions.userId, OWNER_USER_ID), sql2`${workoutSessions.startTime} >= ${todayStart}`, sql2`${workoutSessions.startTime} <= ${todayEnd}`)),
      // Today's running logs
      db.select({ id: runningLogs.id, distanceKm: runningLogs.distanceKm, calories: runningLogs.calories }).from(runningLogs).where(sql2`${runningLogs.date} = ${todayStr}`),
      // Today's steps
      db.select({ id: dailySteps.id, steps: dailySteps.steps, floorsClimbed: dailySteps.floorsClimbed, calories: dailySteps.calories }).from(dailySteps).where(and(eq2(dailySteps.userId, OWNER_USER_ID), sql2`${dailySteps.date} = ${todayStr}`)),
      // User profile for Mifflin-St Jeor BMR
      db.select().from(userProfile).where(eq2(userProfile.userId, OWNER_USER_ID)).limit(1),
      // Today's cardio sets calories (from workout_sets joined with today's sessions)
      db.select({ calories: workoutSets.calories, exerciseName: workoutSets.exerciseName, duration: workoutSets.duration, distance: workoutSets.distance }).from(workoutSets).innerJoin(workoutSessions, eq2(workoutSets.sessionId, workoutSessions.id)).where(and(
        eq2(workoutSessions.userId, OWNER_USER_ID),
        sql2`${workoutSessions.startTime} >= ${todayStart}`,
        sql2`${workoutSessions.startTime} <= ${todayEnd}`,
        sql2`${workoutSets.exerciseName} = ANY(${sql2.raw(`ARRAY[${CARDIO_EXERCISE_NAMES.map((n) => `'${n.replace(/'/g, "''")}' `).join(",")}]::text[]`)})`
      ))
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
    const cardioCaloriesBurned = todayCardioSets.reduce((s, set) => s + (set.calories ?? 0), 0);
    const cardioTotalDuration = todayCardioSets.reduce((s, set) => s + (set.duration ?? 0), 0);
    const cardioTotalDistance = todayCardioSets.reduce((s, set) => s + (set.distance ?? 0), 0);
    const totalCaloriesBurned = workoutCaloriesBurned + runningCaloriesBurned + stepsCaloriesBurned + cardioCaloriesBurned;
    const netCalories = todayCalories - totalCaloriesBurned;
    const profile = profileRows[0] ?? null;
    const weight = latestBody[0]?.weight ? Number(latestBody[0].weight) : null;
    const height = profile?.height ? Number(profile.height) : null;
    const birthYear = profile?.birthYear ?? null;
    const gender = profile?.gender ?? null;
    const age = birthYear ? (/* @__PURE__ */ new Date()).getFullYear() - birthYear : null;
    const genderOffset = gender === "female" ? -161 : 5;
    const calculatedBmr = weight && height && age ? Math.round(9.99 * weight + 6.25 * height - 4.92 * age + genderOffset) : null;
    const storedBmr = latestBody[0]?.bmr ? Number(latestBody[0].bmr) : null;
    const bmr = calculatedBmr ?? storedBmr;
    const baseTdee = bmr ?? 2e3;
    const dailyCalorieTarget = baseTdee;
    const activityFactor = 1;
    return {
      today: { calories: todayCalories, protein: todayProtein, carbs: todayCarbs, fat: todayFat, mealCount: todayMeals.length },
      exercise: {
        totalBurned: totalCaloriesBurned,
        workoutBurned: workoutCaloriesBurned,
        runningBurned: runningCaloriesBurned,
        stepsBurned: stepsCaloriesBurned,
        cardioBurned: cardioCaloriesBurned,
        cardioTotalDuration,
        cardioTotalDistance,
        netCalories,
        todayWorkouts,
        todayRunning,
        todaySteps: todayStepsRows[0] || null
      },
      tdee: {
        bmr: bmr ?? null,
        calculatedBmr,
        storedBmr,
        baseTdee,
        dailyCalorieTarget,
        hasBmr: !!bmr,
        hasProfile: !!(profile?.height && profile?.birthYear && profile?.gender),
        profile: profile ? { height: profile.height, birthYear: profile.birthYear, gender: profile.gender } : null
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
    const parsed = Papa2.parse(input.csvText, {
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
    const parsed = Papa2.parse(input.csvText, {
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
            restingHr: r.restingHr,
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
            logDate: r.date,
            loggedAt: /* @__PURE__ */ new Date(r.date + "T12:00:00+08:00"),
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
                date, running_type, route_type, running_shoes, distance_km, hour, minutes, second,
                average_pace, best_pace, average_heart_rate, maximum_heart_rate,
                average_cadence, max_cadence, avg_stride_length_m, avg_vertical_ratio,
                vertical_oscillation_cm, avg_ground_contact_time_ms, calories,
                temperature, humidity, wind_speed, apparent_temp, precipitation,
                weather_code, weather_condition, weather_location, weather_observed_at, weather_source, notes
              ) VALUES (
                ${r.date},
                ${r.runningType ?? null},
                ${r.routeType ?? null},
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
                ${r.windSpeed ?? null},
                ${r.apparentTemp ?? null},
                ${r.precipitation ?? null},
                ${r.weatherCode ?? null},
                ${r.weatherCondition ?? null},
                ${r.weatherLocation ?? null},
                ${r.weatherObservedAt ?? null},
                ${r.weatherSource ?? null},
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
  // Weekly exercise calories burned breakdown (workout + running + steps)
  weeklyExerciseCalories: publicProcedure.input(z2.object({ weeks: z2.number().int().min(1).max(26).default(8) })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    const sinceDate = new Date(Date.now() - input.weeks * 7 * 864e5);
    const sinceDateStr = sinceDate.toISOString().slice(0, 10);
    const workoutRows = await db.select({
      date: sql2`TO_CHAR(${workoutSessions.startTime} AT TIME ZONE 'Asia/Hong_Kong', 'YYYY-MM-DD')`.as("date"),
      calories: sql2`COALESCE(SUM(${workoutSessions.caloriesBurned}), 0)`.as("calories")
    }).from(workoutSessions).where(and(
      eq2(workoutSessions.userId, OWNER_USER_ID),
      sql2`${workoutSessions.startTime} >= ${sinceDate}`,
      sql2`${workoutSessions.endTime} IS NOT NULL`
    )).groupBy(sql2`TO_CHAR(${workoutSessions.startTime} AT TIME ZONE 'Asia/Hong_Kong', 'YYYY-MM-DD')`);
    const runningRows = await db.select({
      date: runningLogs.date,
      calories: sql2`COALESCE(SUM(${runningLogs.calories}), 0)`.as("calories")
    }).from(runningLogs).where(sql2`${runningLogs.date} >= ${sinceDateStr}`).groupBy(runningLogs.date);
    const stepsRows = await db.select({
      date: dailySteps.date,
      calories: sql2`COALESCE(SUM(${dailySteps.calories}), 0)`.as("calories")
    }).from(dailySteps).where(and(
      eq2(dailySteps.userId, OWNER_USER_ID),
      sql2`${dailySteps.date} >= ${sinceDateStr}`
    )).groupBy(dailySteps.date);
    const weekMap = {};
    const getWeekLabel = (dateStr) => {
      const d = /* @__PURE__ */ new Date(dateStr + "T12:00:00+08:00");
      const day = d.getDay();
      const monday = new Date(d);
      monday.setDate(d.getDate() - (day + 6) % 7);
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
    return Object.entries(weekMap).sort(([a], [b]) => a.localeCompare(b)).map(([week, v]) => ({
      week,
      label: week.slice(5),
      // MM-DD
      workout: Math.round(v.workout),
      running: Math.round(v.running),
      steps: Math.round(v.steps),
      total: Math.round(v.workout + v.running + v.steps)
    }));
  }),
  // Cardio training history (calories + duration per day from workout_sets)
  cardioHistory: publicProcedure.input(z2.object({ days: z2.number().int().min(7).max(365).default(90) })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    const sinceDate = new Date(Date.now() - input.days * 864e5);
    const CARDIO_NAMES_LIST = [
      "Stationary Bike",
      "Treadmill",
      "Stair Climber",
      "Elliptical Trainer",
      "Rowing Machine",
      "Ski Erg",
      "Air Bike",
      "Jacob's Ladder"
    ];
    const cardioSets = await db.select({
      date: sql2`TO_CHAR(${workoutSessions.startTime} AT TIME ZONE 'Asia/Hong_Kong', 'YYYY-MM-DD')`.as("date"),
      calories: workoutSets.calories,
      duration: workoutSets.duration,
      exerciseName: workoutSets.exerciseName
    }).from(workoutSets).innerJoin(workoutSessions, eq2(workoutSets.sessionId, workoutSessions.id)).where(and(
      eq2(workoutSessions.userId, OWNER_USER_ID),
      sql2`${workoutSessions.startTime} >= ${sinceDate}`,
      inArray(workoutSets.exerciseName, CARDIO_NAMES_LIST)
    ));
    const dayMap = {};
    for (const r of cardioSets) {
      if (!dayMap[r.date]) dayMap[r.date] = { calories: 0, duration: 0 };
      dayMap[r.date].calories += Number(r.calories) || 0;
      dayMap[r.date].duration += Number(r.duration) || 0;
    }
    return Object.entries(dayMap).sort(([a], [b]) => a.localeCompare(b)).map(([date2, v]) => ({
      date: date2,
      label: date2.slice(5),
      calories: Math.round(v.calories),
      durationMin: Math.round(v.duration)
    }));
  }),
  // Fetch daily calorie totals for charting
  calorieHistory: publicProcedure.input(z2.object({ days: z2.number().int().min(7).max(365).default(30) })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return [];
    const sinceStr = daysAgoHK(input.days);
    const rows = await db.select({
      date: sql2`TO_CHAR(${mealLogs.logDate}, 'YYYY-MM-DD')`.as("date"),
      totalCalories: sql2`COALESCE(SUM(${mealLogs.calories}), 0)`.as("totalCalories"),
      totalProtein: sql2`COALESCE(SUM(${mealLogs.protein}), 0)`.as("totalProtein"),
      totalCarbs: sql2`COALESCE(SUM(${mealLogs.carbs}), 0)`.as("totalCarbs"),
      totalFat: sql2`COALESCE(SUM(${mealLogs.fat}), 0)`.as("totalFat")
    }).from(mealLogs).where(and(
      eq2(mealLogs.userId, OWNER_USER_ID),
      sql2`${mealLogs.logDate} >= ${sinceStr}::date`
    )).groupBy(sql2`TO_CHAR(${mealLogs.logDate}, 'YYYY-MM-DD')`).orderBy(sql2`TO_CHAR(${mealLogs.logDate}, 'YYYY-MM-DD')`);
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
   * Merge a sequence of Garmin overview, statistics, laps, and chart screenshots
   * into one reviewable running record. It deliberately does not persist the run:
   * the user confirms values in the form and keeps original screenshots on save.
   */
  extractGarminRun: ownerProcedure.input(z2.object({
    screenshots: z2.array(z2.object({
      base64: z2.string(),
      mimeType: z2.string().default("image/jpeg")
    })).min(1).max(16)
  })).mutation(async ({ input }) => {
    const systemPrompt = `You extract Garmin Connect screenshots into exactly one running activity. Return only strict JSON. Do not invent values from a graph. Prefer explicit numbers on Overview/Stats/Laps; if screenshots conflict, choose the value from Overview or Stats and explain the conflict briefly in Traditional Chinese notes. A displayed day and month without a year must produce null date. All extracted metric labels and notes must be understandable to a Traditional Chinese user.`;
    const basePrompt = `These screenshots belong to ONE Garmin running activity. Extract only visibly stated metrics. Convert duration into hour/minute/second and keep pace in MM:SS. Preserve every visible full-lap row (lap number, duration, distance and average pace); partial laps are valid. Screenshots cannot faithfully reconstruct second-by-second chart samples, so never fabricate curves. Return null for absent or unclear values.

Required JSON fields:
- date: YYYY-MM-DD only if a full date including year is visible, else null
- time: local activity start HH:MM if visible, else null
- running: distance, time, pace, heart rate, cadence, calories, running dynamics, temperature, activity type, and route name
- garminDetails: Stats values such as moving/elapsed/run/walk/idle time, ascent/descent/elevation, speed, calories, sweat loss, intensity, Body Battery, training effect/load, power and performance condition
- laps: each visible split row
- confidence and concise Traditional Chinese notes.`;
    const batches = buildGarminVisionBatches(input.screenshots);
    const extractions = [];
    for (let index = 0; index < batches.length; index += 1) {
      const batch = batches[index];
      const userPrompt = `${basePrompt}

This is image batch ${index + 1} of ${batches.length}. Return values visible in this batch only. The server will safely merge non-conflicting fields across batches.`;
      const response = await invokeLLM({
        model: "gpt-6.1-sol",
        maxTokens: 8e3,
        reasoning: { effort: "medium" },
        messages: [{
          role: "system",
          content: systemPrompt
        }, {
          role: "user",
          content: buildGarminVisionContent(batch, userPrompt)
        }],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "garmin_run_sequence",
            strict: true,
            schema: {
              type: "object",
              properties: {
                date: { type: ["string", "null"] },
                time: { type: ["string", "null"] },
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
                    avgGroundContactTimeMs: { type: ["number", "null"] },
                    temperatureC: { type: ["number", "null"] },
                    runningType: { type: ["string", "null"] },
                    routeName: { type: ["string", "null"] }
                  },
                  required: ["distanceKm", "durationHour", "durationMin", "durationSec", "avgPace", "bestPace", "avgHr", "maxHr", "avgCadence", "maxCadence", "calories", "avgStrideLengthM", "avgVerticalRatio", "verticalOscillationCm", "avgGroundContactTimeMs", "temperatureC", "runningType", "routeName"],
                  additionalProperties: false
                },
                garminDetails: {
                  type: "object",
                  properties: {
                    avgMovingPace: { type: ["string", "null"] },
                    avgGradeAdjustedPace: { type: ["string", "null"] },
                    maxSpeedKph: { type: ["number", "null"] },
                    avgSpeedKph: { type: ["number", "null"] },
                    avgMovingSpeedKph: { type: ["number", "null"] },
                    avgGradeAdjustedSpeedKph: { type: ["number", "null"] },
                    movingTimeSec: { type: ["number", "null"] },
                    elapsedTimeSec: { type: ["number", "null"] },
                    runTimeSec: { type: ["number", "null"] },
                    walkTimeSec: { type: ["number", "null"] },
                    idleTimeSec: { type: ["number", "null"] },
                    totalAscentM: { type: ["number", "null"] },
                    totalDescentM: { type: ["number", "null"] },
                    minElevationM: { type: ["number", "null"] },
                    maxElevationM: { type: ["number", "null"] },
                    restingCalories: { type: ["number", "null"] },
                    activeCalories: { type: ["number", "null"] },
                    sweatLossMl: { type: ["number", "null"] },
                    moderateIntensityMinutes: { type: ["number", "null"] },
                    vigorousIntensityMinutes: { type: ["number", "null"] },
                    bodyBatteryImpact: { type: ["number", "null"] },
                    aerobicTrainingEffect: { type: ["number", "null"] },
                    anaerobicTrainingEffect: { type: ["number", "null"] },
                    exerciseLoad: { type: ["number", "null"] },
                    avgPowerW: { type: ["number", "null"] },
                    maxPowerW: { type: ["number", "null"] },
                    performanceCondition: { type: ["number", "null"] }
                  },
                  required: ["avgMovingPace", "avgGradeAdjustedPace", "maxSpeedKph", "avgSpeedKph", "avgMovingSpeedKph", "avgGradeAdjustedSpeedKph", "movingTimeSec", "elapsedTimeSec", "runTimeSec", "walkTimeSec", "idleTimeSec", "totalAscentM", "totalDescentM", "minElevationM", "maxElevationM", "restingCalories", "activeCalories", "sweatLossMl", "moderateIntensityMinutes", "vigorousIntensityMinutes", "bodyBatteryImpact", "aerobicTrainingEffect", "anaerobicTrainingEffect", "exerciseLoad", "avgPowerW", "maxPowerW", "performanceCondition"],
                  additionalProperties: false
                },
                laps: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: { lap: { type: "number" }, durationSec: { type: ["number", "null"] }, distanceKm: { type: ["number", "null"] }, avgPace: { type: ["string", "null"] } },
                    required: ["lap", "durationSec", "distanceKm", "avgPace"],
                    additionalProperties: false
                  }
                },
                confidence: { type: "string" },
                notes: { type: "string" }
              },
              required: ["date", "time", "running", "garminDetails", "laps", "confidence", "notes"],
              additionalProperties: false
            }
          }
        }
      });
      extractions.push(parseGarminExtraction(response.choices[0]?.message?.content));
    }
    return mergeGarminExtractions(extractions);
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
      hrv: z2.number().nullable().optional(),
      restingHr: z2.number().nullable().optional()
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
        restingHr: input.sleep.restingHr ?? void 0,
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
        logDate: input.date,
        loggedAt: /* @__PURE__ */ new Date(input.date + "T12:00:00+08:00"),
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
        SELECT id, shoes_name, brand, status, firstusedate, retirement_date
        FROM running_shoes
        WHERE status != 'Retired'
        ORDER BY status ASC, shoes_name ASC
      `);
    return rows.rows ?? rows;
  }),
  getLogs: publicProcedure.input(z2.object({ limit: z2.number().int().min(1).max(1e3).optional().default(200) })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.execute(
      sql2`SELECT * FROM running_logs ORDER BY date DESC, id DESC LIMIT ${input.limit}`
    );
    return rows.rows ?? rows;
  }),
  getLogsPage: publicProcedure.input(z2.object({
    page: z2.number().int().min(1).default(1),
    pageSize: z2.number().int().min(10).max(100).default(30),
    runningType: z2.string().default("all"),
    search: z2.string().trim().max(100).default(""),
    sort: z2.enum(["date_desc", "date_asc", "distance_desc", "pace_asc", "hr_asc"]).default("date_desc")
  })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { rows: [], total: 0, page: input.page, pageSize: input.pageSize, totalPages: 0 };
    const conditions = [];
    if (input.runningType !== "all") conditions.push(sql2`running_type = ${input.runningType}`);
    if (input.search) {
      const pattern = `%${input.search}%`;
      conditions.push(sql2`(
          COALESCE(running_type, '') ILIKE ${pattern}
          OR COALESCE(running_shoes, '') ILIKE ${pattern}
          OR COALESCE(route_type, '') ILIKE ${pattern}
          OR COALESCE(notes, '') ILIKE ${pattern}
        )`);
    }
    const whereClause = conditions.length ? sql2.join(conditions, sql2` AND `) : sql2`TRUE`;
    const orderBy = input.sort === "date_asc" ? sql2`date ASC, id ASC` : input.sort === "distance_desc" ? sql2`distance_km DESC NULLS LAST, date DESC, id DESC` : input.sort === "pace_asc" ? sql2`
              CASE
                WHEN TRIM(COALESCE(average_pace, '')) ~ '^[0-9]+:[0-9]{2}(\\.[0-9]+)?$'
                  THEN SPLIT_PART(TRIM(average_pace), ':', 1)::numeric * 60 + SPLIT_PART(TRIM(average_pace), ':', 2)::numeric
                WHEN TRIM(COALESCE(average_pace, '')) ~ '^[0-9]+(\\.[0-9]+)?$'
                  THEN TRIM(average_pace)::numeric * 60
                ELSE NULL
              END ASC NULLS LAST, date DESC, id DESC` : input.sort === "hr_asc" ? sql2`average_heart_rate ASC NULLS LAST, date DESC, id DESC` : sql2`date DESC, id DESC`;
    const countResult = await db.execute(sql2`SELECT COUNT(*)::int AS total FROM running_logs WHERE ${whereClause}`);
    const total = Number((countResult.rows ?? countResult)[0]?.total ?? 0);
    const totalPages = Math.max(1, Math.ceil(total / input.pageSize));
    const page = Math.min(input.page, totalPages);
    const offset = (page - 1) * input.pageSize;
    const rows = await db.execute(sql2`
        SELECT * FROM running_logs
        WHERE ${whereClause}
        ORDER BY ${orderBy}
        LIMIT ${input.pageSize} OFFSET ${offset}
      `);
    return { rows: rows.rows ?? rows, total, page, pageSize: input.pageSize, totalPages };
  }),
  getShoePerformance: publicProcedure.input(z2.object({
    distanceBand: z2.enum(["all", "short", "medium", "long", "ultra"]).default("all"),
    routeType: z2.string().default("all")
  })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    const distanceWhere = input.distanceBand === "short" ? sql2`distance_km < 5` : input.distanceBand === "medium" ? sql2`distance_km >= 5 AND distance_km < 10` : input.distanceBand === "long" ? sql2`distance_km >= 10 AND distance_km < 21.1` : input.distanceBand === "ultra" ? sql2`distance_km >= 21.1` : sql2`TRUE`;
    const routeWhere = input.routeType === "all" ? sql2`TRUE` : sql2`route_type = ${input.routeType}`;
    const rows = await db.execute(sql2`
        SELECT
          running_shoes AS shoe,
          COUNT(*)::int AS runs,
          ROUND(COALESCE(SUM(distance_km), 0)::numeric, 1) AS distance,
          AVG(CASE WHEN average_pace ~ '^[0-9]+(\\.[0-9]+)?$' THEN average_pace::numeric END) AS avg_pace,
          ROUND(AVG(average_heart_rate)::numeric, 0) AS avg_hr,
          ROUND(AVG(average_cadence)::numeric, 0) AS avg_cadence
        FROM running_logs
        WHERE running_shoes IS NOT NULL
          AND running_shoes <> ''
          AND distance_km IS NOT NULL
          AND ${distanceWhere}
          AND ${routeWhere}
        GROUP BY running_shoes
        ORDER BY SUM(distance_km) DESC, running_shoes ASC
      `);
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
  getGarminHealthBrief: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;
    const [runResult, sleepResult, heartResult, bodyResult] = await Promise.all([
      db.execute(sql2`
          SELECT id, date, running_type, route_type, distance_km, hour, minutes, second,
                 average_pace, best_pace, average_heart_rate, maximum_heart_rate,
                 average_cadence, max_cadence, avg_stride_length_m, avg_vertical_ratio,
                 vertical_oscillation_cm, avg_ground_contact_time_ms, calories,
                 garmin_details,
                 COALESCE(jsonb_array_length(time_series), 0) AS time_series_count,
                 COALESCE(time_series::text LIKE '%"latitude"%', false) AND COALESCE(time_series::text LIKE '%"longitude"%', false) AS has_gps,
                 COALESCE(time_series::text LIKE '%"power"%', false) AS has_power_samples,
                 COALESCE(time_series::text LIKE '%"altitudeM"%', false) AS has_altitude_samples
          FROM running_logs
          ORDER BY date DESC, id DESC
        `),
      db.execute(sql2`
          SELECT date, sleep_score, sleep_duration, body_battery, hrv, resting_hr, pulse_ox, respiration
          FROM sleep_logs
          WHERE user_id = ${OWNER_USER_ID}
          ORDER BY date DESC
          LIMIT 120
        `),
      db.execute(sql2`
          SELECT date, resting_hr, high_hr, hrv, avg_hr,
                 zone1_minutes, zone2_minutes, zone3_minutes, zone4_minutes, zone5_minutes
          FROM heart_rate_logs
          WHERE user_id = ${OWNER_USER_ID}
          ORDER BY date DESC
          LIMIT 120
        `),
      db.execute(sql2`
          SELECT date, weight, body_fat_pct, muscle_mass, bmi
          FROM body_composition
          WHERE user_id = ${OWNER_USER_ID}
          ORDER BY date DESC
          LIMIT 120
        `)
    ]);
    const rawRuns = runResult.rows ?? runResult;
    const sleeps = sleepResult.rows ?? sleepResult;
    const hearts = heartResult.rows ?? heartResult;
    const bodies = bodyResult.rows ?? bodyResult;
    const finite = (value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };
    const parsePaceSeconds = (value) => {
      const source = String(value ?? "").trim();
      const clock = source.match(/^(\d{1,2}):(\d{2})(?:\.\d+)?$/);
      if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
      const numeric2 = finite(source);
      return numeric2 !== null && numeric2 >= 2 && numeric2 <= 30 ? numeric2 * 60 : null;
    };
    const asRecord = (value) => {
      if (typeof value === "object" && value !== null && !Array.isArray(value)) return value;
      if (typeof value === "string") {
        try {
          const parsed = JSON.parse(value);
          return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : {};
        } catch {
          return {};
        }
      }
      return {};
    };
    const runs = rawRuns.map((row) => {
      const details = asRecord(row.garmin_details);
      const sampleCount = finite(row.time_series_count) ?? 0;
      const durationSec = (finite(row.hour) ?? 0) * 3600 + (finite(row.minutes) ?? 0) * 60 + (finite(row.second) ?? 0);
      const sourceFormat = typeof details.rawFileFormat === "string" ? details.rawFileFormat : typeof details.sourceFormat === "string" ? details.sourceFormat : null;
      return {
        id: Number(row.id),
        date: String(row.date ?? ""),
        runningType: row.running_type ?? null,
        routeType: row.route_type ?? null,
        distanceKm: finite(row.distance_km),
        durationSec: durationSec || null,
        paceSecPerKm: parsePaceSeconds(row.average_pace),
        bestPaceSecPerKm: parsePaceSeconds(row.best_pace),
        averageHeartRate: finite(row.average_heart_rate),
        maximumHeartRate: finite(row.maximum_heart_rate),
        averageCadence: finite(row.average_cadence),
        maxCadence: finite(row.max_cadence),
        avgStrideLengthM: finite(row.avg_stride_length_m),
        avgVerticalRatio: finite(row.avg_vertical_ratio),
        verticalOscillationCm: finite(row.vertical_oscillation_cm),
        avgGroundContactTimeMs: finite(row.avg_ground_contact_time_ms),
        calories: finite(row.calories),
        sourceFormat,
        rawSampleCount: (finite(details.rawSampleCount) ?? sampleCount) || null,
        hasTimeSeries: sampleCount > 0,
        hasGps: Boolean(row.has_gps),
        hasPower: Boolean(row.has_power_samples) || finite(details.avgPowerW) !== null,
        hasAltitude: Boolean(row.has_altitude_samples) || finite(details.totalAscentM) !== null
      };
    });
    const mean = (values) => {
      const usable = values.filter((value) => value !== null);
      return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : null;
    };
    const totalDistanceKm = runs.reduce((sum, run) => sum + (run.distanceKm ?? 0), 0);
    const sourceRuns = runs.filter((run) => run.sourceFormat || run.hasTimeSeries);
    const dates = runs.map((run) => run.date).filter(Boolean).sort();
    const recentRuns = [...runs].reverse().slice(-24);
    const weeklyMap = /* @__PURE__ */ new Map();
    for (const run of runs) {
      const key = run.date ? run.date.slice(0, 7) : "\u672A\u6A19\u793A\u65E5\u671F";
      const current = weeklyMap.get(key) ?? { week: key, distanceKm: 0, runs: 0, calories: 0 };
      current.distanceKm += run.distanceKm ?? 0;
      current.runs += 1;
      current.calories += run.calories ?? 0;
      weeklyMap.set(key, current);
    }
    const trainingLoad = Array.from(weeklyMap.values()).sort((first, second) => first.week.localeCompare(second.week)).slice(-12);
    const recoverySleep = sleeps.slice(0, 30).reverse().map((row) => ({
      date: String(row.date ?? ""),
      sleepScore: finite(row.sleep_score),
      sleepDurationHours: finite(row.sleep_duration),
      bodyBattery: finite(row.body_battery),
      hrv: finite(row.hrv),
      restingHr: finite(row.resting_hr)
    }));
    const recoveryHeart = hearts.slice(0, 30).reverse().map((row) => ({
      date: String(row.date ?? ""),
      restingHr: finite(row.resting_hr),
      highHr: finite(row.high_hr),
      hrv: finite(row.hrv),
      averageHr: finite(row.avg_hr)
    }));
    const recoveryBody = bodies.slice(0, 30).reverse().map((row) => ({
      date: String(row.date ?? ""),
      weightKg: finite(row.weight),
      bodyFatPct: finite(row.body_fat_pct),
      muscleMassKg: finite(row.muscle_mass),
      bmi: finite(row.bmi)
    }));
    const latestHeart = hearts[0];
    const maxHeartRate = (finite(latestHeart?.high_hr) ?? Math.max(...runs.map((run) => run.maximumHeartRate ?? 0), 0)) || null;
    const restingHeartRate = finite(latestHeart?.resting_hr) ?? finite(sleeps[0]?.resting_hr);
    const zoneCounts = [1, 2, 3, 4, 5].map((zone) => hearts.reduce((sum, row) => sum + (finite(row[`zone${zone}_minutes`]) ?? 0), 0));
    const totalZoneMinutes = zoneCounts.reduce((sum, count) => sum + count, 0);
    const dynamics = recentRuns.map((run) => ({
      date: run.date,
      cadence: run.averageCadence,
      strideLengthM: run.avgStrideLengthM,
      verticalRatioPct: run.avgVerticalRatio,
      verticalOscillationCm: run.verticalOscillationCm,
      groundContactTimeMs: run.avgGroundContactTimeMs
    }));
    const recentPaces = recentRuns.map((run) => run.paceSecPerKm).filter((value) => value !== null);
    const earlierPaces = runs.slice(8, 16).map((run) => run.paceSecPerKm).filter((value) => value !== null);
    const recentHeartRates = recentRuns.map((run) => run.averageHeartRate).filter((value) => value !== null);
    const earlierHeartRates = runs.slice(8, 16).map((run) => run.averageHeartRate).filter((value) => value !== null);
    const observations = [];
    if (recentPaces.length >= 2 && earlierPaces.length >= 2) {
      const delta = Math.round((mean(recentPaces) - mean(earlierPaces)) * -1);
      observations.push(delta === 0 ? "\u6700\u8FD1\u8DD1\u6B65\u7684\u5E73\u5747\u914D\u901F\u8207\u8F03\u65E9\u6A23\u672C\u5927\u81F4\u76F8\u82E5\u3002" : `\u6700\u8FD1\u8DD1\u6B65\u7684\u5E73\u5747\u914D\u901F\u8F03\u8F03\u65E9\u6A23\u672C${delta > 0 ? "\u5FEB" : "\u6162"}${Math.abs(delta)} \u79D2\uFF0F\u516C\u91CC\u3002`);
    }
    if (recentHeartRates.length >= 2 && earlierHeartRates.length >= 2) {
      const delta = Math.round(mean(recentHeartRates) - mean(earlierHeartRates));
      observations.push(delta === 0 ? "\u6700\u8FD1\u8DD1\u6B65\u7684\u5E73\u5747\u5FC3\u7387\u8207\u8F03\u65E9\u6A23\u672C\u5927\u81F4\u76F8\u82E5\u3002" : `\u6700\u8FD1\u8DD1\u6B65\u7684\u5E73\u5747\u5FC3\u7387\u8F03\u8F03\u65E9\u6A23\u672C${delta > 0 ? "\u9AD8" : "\u4F4E"}${Math.abs(delta)} bpm\u3002`);
    }
    if (sourceRuns.length) observations.push(`${sourceRuns.length} \u6B21\u8DD1\u6B65\u542B Garmin \u539F\u59CB\u6216\u9010\u79D2\u8CC7\u6599\uFF1B\u8A73\u7D30\u5716\u8868\u53EA\u986F\u793A\u5BE6\u6E2C\u6B04\u4F4D\u3002`);
    if (!observations.length) observations.push("\u8A18\u9304\u66F4\u591A\u542B\u8DDD\u96E2\u3001\u914D\u901F\u6216\u5FC3\u7387\u7684\u8DD1\u6B65\u5F8C\uFF0C\u7C21\u5831\u6703\u81EA\u52D5\u7522\u751F\u53EF\u6BD4\u8F03\u7684\u8A13\u7DF4\u8DA8\u52E2\u3002");
    return {
      period: { from: dates[0] ?? null, to: dates[dates.length - 1] ?? null, timeZone: "Asia/Hong_Kong" },
      overview: {
        totalRuns: runs.length,
        totalDistanceKm,
        averagePaceSecPerKm: mean(runs.map((run) => run.paceSecPerKm)),
        averageHeartRate: mean(runs.map((run) => run.averageHeartRate)),
        averageCadence: mean(runs.map((run) => run.averageCadence)),
        totalCalories: runs.reduce((sum, run) => sum + (run.calories ?? 0), 0)
      },
      trainingLoad,
      runs: runs.slice(0, 200),
      heartRate: {
        trend: recentRuns.map((run) => ({ date: run.date, averageHeartRate: run.averageHeartRate, maximumHeartRate: run.maximumHeartRate, paceSecPerKm: run.paceSecPerKm })),
        zones: zoneCounts.map((minutes, index) => ({ zone: `Z${index + 1}`, minutes, pct: totalZoneMinutes ? Math.round(minutes / totalZoneMinutes * 100) : null })),
        restingHeartRate,
        maxHeartRate,
        zoneMinuteCount: totalZoneMinutes
      },
      dynamics,
      recovery: { sleep: recoverySleep, heart: recoveryHeart, body: recoveryBody },
      dataQuality: {
        sourceRunCount: sourceRuns.length,
        timeSeriesRunCount: runs.filter((run) => run.hasTimeSeries).length,
        gpsRunCount: runs.filter((run) => run.hasGps).length,
        powerRunCount: runs.filter((run) => run.hasPower).length,
        elevationRunCount: runs.filter((run) => run.hasAltitude).length,
        heartRateRunCount: runs.filter((run) => run.averageHeartRate !== null).length,
        cadenceRunCount: runs.filter((run) => run.averageCadence !== null).length,
        dynamicsRunCount: runs.filter((run) => run.avgGroundContactTimeMs !== null || run.avgStrideLengthM !== null || run.avgVerticalRatio !== null || run.verticalOscillationCm !== null).length,
        sleepRecordCount: sleeps.length,
        heartRecordCount: hearts.length,
        bodyRecordCount: bodies.length
      },
      observations
    };
  }),
  getGarminRunDetail: publicProcedure.input(z2.object({ id: z2.number().int().positive() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return null;
    const result = await db.execute(sql2`
        SELECT id, date, running_type, route_type, distance_km, hour, minutes, second,
               average_pace, best_pace, average_heart_rate, maximum_heart_rate,
               average_cadence, max_cadence, avg_stride_length_m, avg_vertical_ratio,
               vertical_oscillation_cm, avg_ground_contact_time_ms, calories, garmin_details, laps, time_series
        FROM running_logs
        WHERE id = ${input.id}
        LIMIT 1
      `);
    return (result.rows ?? result)[0] ?? null;
  }),
  uploadGarminRawChunk: ownerProcedure.input(z2.object({
    uploadId: z2.string().regex(/^[A-Za-z0-9_-]{12,80}$/),
    chunkIndex: z2.number().int().min(0).max(MAX_GARMIN_RAW_UPLOAD_CHUNKS - 1),
    base64: z2.string().min(4).max(Math.ceil(GARMIN_RAW_UPLOAD_CHUNK_BYTES * 4 / 3) + 32)
  })).mutation(async ({ input }) => {
    const chunk = decodeGarminChunk(input.base64);
    const stored = await storagePut(
      `garmin-chunks/${OWNER_USER_ID}/${input.uploadId}/${input.chunkIndex}.part`,
      chunk,
      "application/octet-stream"
    );
    return { fileKey: stored.key, sizeBytes: chunk.length };
  }),
  parseGarminRawFile: ownerProcedure.input(z2.object({
    fileName: z2.string().trim().min(5).max(180),
    mimeType: z2.string().trim().max(120).optional(),
    uploadId: z2.string().regex(/^[A-Za-z0-9_-]{12,80}$/).optional(),
    chunkKeys: z2.array(z2.string().trim().min(20).max(500)).min(1).max(MAX_GARMIN_RAW_UPLOAD_CHUNKS).optional(),
    // Only accepted to let an already-open old client finish its in-flight import.
    fileKey: z2.string().trim().min(20).max(500).optional()
  }).refine((input) => Boolean(input.fileKey) || Boolean(input.uploadId && input.chunkKeys), {
    message: "\u8ACB\u5148\u5B89\u5168\u4E0A\u8F09 Garmin \u539F\u59CB\u6A94"
  })).mutation(async ({ input }) => {
    const sourceFormat = garminRawFormatFromFilename(input.fileName);
    if (!sourceFormat) throw new Error("\u8ACB\u9078\u64C7 Garmin FIT\u3001CSV\u3001GPX \u6216 TCX \u539F\u59CB\u6A94");
    let buffer;
    if (input.fileKey) {
      if (!isGarminLegacyStagingKey(input.fileKey)) throw new Error("\u7121\u6548\u7684 Garmin \u66AB\u5B58\u6A94\u4F86\u6E90");
      buffer = await storageReadBuffer(input.fileKey);
    } else {
      validateGarminChunkKeys(input.chunkKeys, input.uploadId);
      const chunks = await Promise.all(input.chunkKeys.map((key) => storageReadBuffer(key)));
      buffer = Buffer.concat(chunks);
    }
    if (buffer.length > MAX_GARMIN_RAW_FILE_BYTES) throw new Error("\u539F\u59CB Garmin \u6A94\u6848\u8D85\u904E 25MB \u9650\u5236");
    const stored = await storagePut(`garmin-originals/${OWNER_USER_ID}/${nanoid()}.${sourceFormat.toLowerCase()}`, buffer, input.mimeType || "application/octet-stream");
    const preview = parseGarminRawFile(buffer, input.fileName);
    return { ...preview, rawFileKey: stored.key };
  }),
  saveGarminRawSource: ownerProcedure.input(z2.object({
    runningLogId: z2.number().int().positive(),
    fileName: z2.string().trim().min(1).max(180),
    mimeType: z2.string().trim().max(120),
    sourceFormat: z2.enum(["FIT", "CSV", "GPX", "TCX"]),
    fileKey: z2.string().trim().min(20).max(500),
    sampleCount: z2.number().int().min(0).max(1e4)
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const detectedFormat = garminRawFormatFromFilename(input.fileName);
    if (detectedFormat !== input.sourceFormat) throw new Error("\u539F\u59CB\u6A94\u683C\u5F0F\u8207\u526F\u6A94\u540D\u4E0D\u4E00\u81F4");
    let rawFileKey = input.fileKey;
    if (isGarminLegacyStagingKey(rawFileKey)) {
      const legacyBuffer = await storageReadBuffer(rawFileKey);
      if (legacyBuffer.length > MAX_GARMIN_RAW_FILE_BYTES) throw new Error("\u539F\u59CB Garmin \u6A94\u6848\u8D85\u904E 25MB \u9650\u5236");
      const stored = await storagePut(`garmin-originals/${OWNER_USER_ID}/${nanoid()}.${input.sourceFormat.toLowerCase()}`, legacyBuffer, input.mimeType || "application/octet-stream");
      rawFileKey = stored.key;
    } else {
      validateGarminOriginalKey(rawFileKey);
    }
    const metadata = JSON.stringify({
      rawFileKey,
      rawFileUrl: `/manus-storage/${rawFileKey}`,
      rawFileName: input.fileName,
      rawFileFormat: input.sourceFormat,
      rawSampleCount: input.sampleCount
    });
    await db.execute(sql2`
        UPDATE running_logs
        SET garmin_details = COALESCE(garmin_details, '{}'::jsonb) || ${metadata}::jsonb
        WHERE id = ${input.runningLogId}
      `);
    return { success: true, fileUrl: `/manus-storage/${rawFileKey}` };
  }),
  addLog: publicProcedure.input(z2.object({
    date: z2.string(),
    runningType: z2.string().optional(),
    routeType: z2.string().optional(),
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
    windSpeed: z2.number().optional(),
    apparentTemp: z2.number().optional(),
    precipitation: z2.number().optional(),
    weatherCode: z2.number().int().optional(),
    weatherCondition: z2.string().max(120).optional(),
    weatherLocation: z2.string().max(160).optional(),
    weatherObservedAt: z2.string().max(40).optional(),
    weatherSource: z2.string().max(160).optional(),
    garminDetails: z2.record(z2.string(), z2.union([z2.string(), z2.number(), z2.null()])).optional(),
    laps: z2.array(z2.object({
      lap: z2.number(),
      durationSec: z2.number().nullable(),
      distanceKm: z2.number().nullable(),
      avgPace: z2.string().nullable()
    })).optional(),
    timeSeries: z2.array(z2.object({
      elapsedSec: z2.number().int().nonnegative(),
      timestamp: z2.string().min(1).max(40),
      distanceKm: z2.number().optional(),
      latitude: z2.number().min(-90).max(90).optional(),
      longitude: z2.number().min(-180).max(180).optional(),
      paceSecPerKm: z2.number().optional(),
      heartRate: z2.number().optional(),
      cadence: z2.number().optional(),
      power: z2.number().optional(),
      altitudeM: z2.number().optional(),
      temperatureC: z2.number().optional()
    })).max(1e4).optional(),
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
          date, running_type, route_type, running_shoes, shoes_id, distance_km, hour, minutes, second,
          average_pace, best_pace, average_heart_rate, maximum_heart_rate,
          average_cadence, max_cadence, avg_stride_length_m, avg_vertical_ratio,
          vertical_oscillation_cm, avg_ground_contact_time_ms,
          calories, temperature, humidity, wind_speed, apparent_temp, precipitation,
          weather_code, weather_condition, weather_location, weather_observed_at, weather_source, garmin_details, laps, time_series, notes
        ) VALUES (
          ${input.date},
          ${input.runningType ?? null},
          ${input.routeType ?? null},
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
          ${input.windSpeed ?? null},
          ${input.apparentTemp ?? null},
          ${input.precipitation ?? null},
          ${input.weatherCode ?? null},
          ${input.weatherCondition ?? null},
          ${input.weatherLocation ?? null},
          ${input.weatherObservedAt ?? null},
          ${input.weatherSource ?? null},
          ${input.garminDetails ? JSON.stringify(input.garminDetails) : null}::jsonb,
          ${input.laps ? JSON.stringify(input.laps) : null}::jsonb,
          ${input.timeSeries ? JSON.stringify(input.timeSeries) : null}::jsonb,
          ${input.notes ?? null}
        ) RETURNING id
      `);
    const rows = result.rows ?? result;
    const newId = rows[0]?.id ? Number(rows[0].id) : 0;
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      await ensureSheetHeaders("running");
      await writeRowToSheet("running", input).catch((error) => {
        console.warn("[Sheets] Running log saved locally but could not be appended:", error instanceof Error ? error.message : error);
      });
    }
    return { success: true, id: newId };
  }),
  updateLog: publicProcedure.input(z2.object({
    id: z2.number(),
    date: z2.string().optional(),
    runningType: z2.string().optional(),
    routeType: z2.string().optional(),
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
    windSpeed: z2.number().optional(),
    apparentTemp: z2.number().optional(),
    precipitation: z2.number().optional(),
    weatherCode: z2.number().int().optional(),
    weatherCondition: z2.string().max(120).optional(),
    weatherLocation: z2.string().max(160).optional(),
    weatherObservedAt: z2.string().max(40).optional(),
    weatherSource: z2.string().max(160).optional(),
    garminDetails: z2.record(z2.string(), z2.union([z2.string(), z2.number(), z2.null()])).optional(),
    laps: z2.array(z2.object({
      lap: z2.number(),
      durationSec: z2.number().nullable(),
      distanceKm: z2.number().nullable(),
      avgPace: z2.string().nullable()
    })).optional(),
    timeSeries: z2.array(z2.object({
      elapsedSec: z2.number().int().nonnegative(),
      timestamp: z2.string().min(1).max(40),
      distanceKm: z2.number().optional(),
      latitude: z2.number().min(-90).max(90).optional(),
      longitude: z2.number().min(-180).max(180).optional(),
      paceSecPerKm: z2.number().optional(),
      heartRate: z2.number().optional(),
      cadence: z2.number().optional(),
      power: z2.number().optional(),
      altitudeM: z2.number().optional(),
      temperatureC: z2.number().optional()
    })).max(1e4).optional(),
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
      if (k === "garminDetails" || k === "laps" || k === "timeSeries") {
        return sql2`${sql2.raw(col)} = ${JSON.stringify(v)}::jsonb`;
      }
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
  getLabPersonalization: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { body: null, baselinePaceSecPerKm: null, maxHeartRate: null, restingHeartRate: null, runTypeDistribution: [], historicalRunCount: 0, baselineRunCount: 0, historicalRuns: [] };
    const [profileRows, bodyRows, heartRows, runningRows, typeRows] = await Promise.all([
      db.execute(sql2`SELECT height FROM user_profile WHERE user_id = ${OWNER_USER_ID} LIMIT 1`),
      db.execute(sql2`SELECT weight, body_fat_pct, muscle_mass, date FROM body_composition WHERE user_id = ${OWNER_USER_ID} ORDER BY date DESC LIMIT 1`),
      db.execute(sql2`SELECT resting_hr, high_hr FROM heart_rate_logs WHERE user_id = ${OWNER_USER_ID} ORDER BY date DESC LIMIT 1`),
      db.execute(sql2`
          SELECT id, average_pace, average_heart_rate, maximum_heart_rate, distance_km, running_type, route_type, date
          FROM running_logs
          WHERE NULLIF(TRIM(COALESCE(average_pace, '')), '') IS NOT NULL
          ORDER BY date ASC
        `),
      db.execute(sql2`
          SELECT COALESCE(running_type, '未分類') AS running_type, COUNT(*) AS count
          FROM running_logs
          GROUP BY COALESCE(running_type, '未分類')
          ORDER BY count DESC, running_type ASC
        `)
    ]);
    const profile = (profileRows.rows ?? profileRows)[0] ?? null;
    const body = (bodyRows.rows ?? bodyRows)[0] ?? null;
    const heart = (heartRows.rows ?? heartRows)[0] ?? null;
    const running = runningRows.rows ?? runningRows;
    const types = typeRows.rows ?? typeRows;
    const parsePaceSeconds = (raw) => {
      const value = String(raw ?? "").trim();
      if (!value) return null;
      const clock = value.match(/^(\d{1,2}):(\d{2})(?:\.\d+)?$/);
      if (clock) {
        const seconds = Number(clock[1]) * 60 + Number(clock[2]);
        return seconds >= 120 && seconds <= 1800 ? seconds : null;
      }
      const numeric2 = Number(value);
      return Number.isFinite(numeric2) && numeric2 >= 2 && numeric2 <= 30 ? numeric2 * 60 : null;
    };
    const paceRows = running.map((row) => ({ ...row, paceSeconds: parsePaceSeconds(row.average_pace) })).filter((row) => row.paceSeconds !== null);
    const endurancePaceRows = paceRows.filter((row) => Number(row.distance_km) >= 3);
    const baselineRows = endurancePaceRows.length ? endurancePaceRows : paceRows;
    const paces = baselineRows.map((row) => row.paceSeconds);
    const maxFromRuns = running.map((row) => Number(row.maximum_heart_rate)).filter(Number.isFinite);
    const restFromRuns = running.map((row) => Number(row.average_heart_rate)).filter(Number.isFinite);
    const baselinePaceSecPerKm = paces.length ? paces.reduce((sum, pace) => sum + pace, 0) / paces.length : null;
    const maxHeartRate = Number.isFinite(Number(heart?.high_hr)) ? Number(heart.high_hr) : maxFromRuns.length ? Math.max(...maxFromRuns) : null;
    const restingHeartRate = Number.isFinite(Number(heart?.resting_hr)) ? Number(heart.resting_hr) : restFromRuns.length ? Math.min(...restFromRuns) : null;
    return {
      body: body || profile ? {
        heightCm: profile?.height ? Number(profile.height) : null,
        weightKg: body?.weight ? Number(body.weight) : null,
        bodyFatPct: body?.body_fat_pct ? Number(body.body_fat_pct) : null,
        muscleMassKg: body?.muscle_mass ? Number(body.muscle_mass) : null,
        recordedDate: body?.date ?? null
      } : null,
      baselinePaceSecPerKm,
      maxHeartRate,
      restingHeartRate,
      runTypeDistribution: types.map((row) => ({ type: row.running_type, count: Number(row.count) })),
      historicalRunCount: running.length,
      baselineRunCount: baselineRows.length,
      historicalRuns: paceRows.map((row) => ({
        id: Number(row.id),
        date: String(row.date ?? ""),
        runningType: row.running_type ?? null,
        routeType: row.route_type ?? null,
        distanceKm: Number(row.distance_km),
        paceSecPerKm: row.paceSeconds,
        averageHeartRate: Number.isFinite(Number(row.average_heart_rate)) ? Number(row.average_heart_rate) : null,
        maximumHeartRate: Number.isFinite(Number(row.maximum_heart_rate)) ? Number(row.maximum_heart_rate) : null
      }))
    };
  }),
  lookupHistoricalWeather: ownerProcedure.input(z2.object({
    date: z2.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z2.string().regex(/^\d{2}:\d{2}$/).optional(),
    location: z2.string().trim().max(160).optional(),
    latitude: z2.number().min(-90).max(90).optional(),
    longitude: z2.number().min(-180).max(180).optional()
  })).mutation(async ({ input }) => {
    if (input.date > todayHK()) throw new Error("\u5C1A\u672A\u767C\u751F\u7684\u65E5\u671F\u6C92\u6709\u6B77\u53F2\u5929\u6C23\u8CC7\u6599");
    const coordinates = await resolveWeatherLocation(input);
    return fetchHistoricalWeatherForDate({ coordinates, date: input.date, time: input.time });
  }),
  previewHistoricalBackfill: ownerProcedure.input(z2.object({
    scope: z2.enum(["logs", "races", "both"]),
    startDate: z2.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z2.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    routeType: z2.enum(["Road", "Track", "Trail", "Treadmill", "Mixed"]).optional(),
    overwriteRouteType: z2.boolean().default(false),
    overwriteWeather: z2.boolean().default(false)
  })).mutation(async ({ input }) => {
    if (input.startDate > input.endDate) throw new Error("\u958B\u59CB\u65E5\u671F\u4E0D\u53EF\u665A\u65BC\u7D50\u675F\u65E5\u671F");
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const [logRows, raceRows] = await Promise.all([
      input.scope === "races" ? Promise.resolve([]) : db.execute(sql2`
          SELECT id, date, route_type, temperature, humidity, wind_speed, apparent_temp, precipitation,
                 weather_code, weather_condition, weather_location
          FROM running_logs WHERE date BETWEEN ${input.startDate} AND ${input.endDate} ORDER BY date DESC
        `),
      input.scope === "logs" ? Promise.resolve([]) : db.execute(sql2`
          SELECT id, date, temperature, humidity, wind_speed, apparent_temp, precipitation,
                 weather_code, weather_condition, weather_location
          FROM races WHERE date BETWEEN ${input.startDate} AND ${input.endDate} ORDER BY date DESC
        `)
    ]);
    const logs = logRows.rows ?? logRows;
    const races3 = raceRows.rows ?? raceRows;
    const { candidates, skippedFuture } = buildHistoricalBackfillCandidates(logs, races3, input, todayHK());
    return { ...summariseHistoricalBackfill(candidates, skippedFuture), samples: candidates.slice(0, 8) };
  }),
  applyHistoricalBackfill: ownerProcedure.input(z2.object({
    scope: z2.enum(["logs", "races", "both"]),
    startDate: z2.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z2.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    routeType: z2.enum(["Road", "Track", "Trail", "Treadmill", "Mixed"]).optional(),
    overwriteRouteType: z2.boolean().default(false),
    overwriteWeather: z2.boolean().default(false),
    location: z2.string().trim().max(160).optional(),
    latitude: z2.number().min(-90).max(90).optional(),
    longitude: z2.number().min(-180).max(180).optional(),
    time: z2.string().regex(/^\d{2}:\d{2}$/).default("07:00"),
    useRecordLocation: z2.boolean().default(true)
  })).mutation(async ({ input }) => {
    if (input.startDate > input.endDate) throw new Error("\u958B\u59CB\u65E5\u671F\u4E0D\u53EF\u665A\u65BC\u7D50\u675F\u65E5\u671F");
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const [logRows, raceRows] = await Promise.all([
      input.scope === "races" ? Promise.resolve([]) : db.execute(sql2`
          SELECT id, date, route_type, temperature, humidity, wind_speed, apparent_temp, precipitation,
                 weather_code, weather_condition, weather_location
          FROM running_logs WHERE date BETWEEN ${input.startDate} AND ${input.endDate} ORDER BY date ASC
        `),
      input.scope === "logs" ? Promise.resolve([]) : db.execute(sql2`
          SELECT id, date, location, temperature, humidity, wind_speed, apparent_temp, precipitation,
                 weather_code, weather_condition, weather_location
          FROM races WHERE date BETWEEN ${input.startDate} AND ${input.endDate} ORDER BY date ASC
        `)
    ]);
    const logs = logRows.rows ?? logRows;
    const races3 = raceRows.rows ?? raceRows;
    const { candidates, skippedFuture } = buildHistoricalBackfillCandidates(logs, races3, input, todayHK());
    const rowsByKey = /* @__PURE__ */ new Map();
    logs.forEach((row) => rowsByKey.set(`log:${row.id}`, row));
    races3.forEach((row) => rowsByKey.set(`race:${row.id}`, row));
    const coordinatesByKey = /* @__PURE__ */ new Map();
    const datesByLocation = /* @__PURE__ */ new Map();
    for (const candidate of candidates.filter((candidate2) => candidate2.needsWeather)) {
      const row = rowsByKey.get(`${candidate.kind}:${candidate.id}`);
      const explicitLocation = input.useRecordLocation ? candidate.kind === "race" ? row?.location : row?.weather_location : void 0;
      const coordinates = await resolveWeatherLocation({
        location: explicitLocation || input.location || HONG_KONG_WEATHER_LOCATION.label,
        latitude: input.latitude,
        longitude: input.longitude
      });
      const locationKey = `${coordinates.latitude},${coordinates.longitude},${coordinates.label}`;
      coordinatesByKey.set(`${candidate.kind}:${candidate.id}`, coordinates);
      if (!datesByLocation.has(locationKey)) datesByLocation.set(locationKey, /* @__PURE__ */ new Set());
      datesByLocation.get(locationKey).add(candidate.date);
    }
    const weatherByLocationDate = /* @__PURE__ */ new Map();
    for (const [locationKey, dateSet] of Array.from(datesByLocation.entries())) {
      const [latitude, longitude, label] = locationKey.split(",");
      const coordinates = { latitude: Number(latitude), longitude: Number(longitude), label };
      for (const chunk of buildDateChunks(Array.from(dateSet))) {
        const weatherByDate = await fetchHistoricalWeatherRange({ coordinates, startDate: chunk.startDate, endDate: chunk.endDate, time: input.time });
        weatherByDate.forEach((weather, date2) => weatherByLocationDate.set(`${locationKey}|${date2}`, weather));
      }
    }
    let routeTypeUpdates = 0;
    let weatherUpdates = 0;
    let skippedNoData = 0;
    const failures = [];
    for (const candidate of candidates) {
      try {
        const sets = [];
        if (candidate.needsRouteType && input.routeType) {
          sets.push(sql2`route_type = ${input.routeType}`);
          routeTypeUpdates += 1;
        }
        if (candidate.needsWeather) {
          const coordinates = coordinatesByKey.get(`${candidate.kind}:${candidate.id}`);
          const locationKey = coordinates ? `${coordinates.latitude},${coordinates.longitude},${coordinates.label}` : "";
          const weather = weatherByLocationDate.get(`${locationKey}|${candidate.date}`);
          if (!weather) {
            skippedNoData += 1;
          } else {
            sets.push(
              sql2`temperature = ${weather.temperature}`,
              sql2`humidity = ${weather.humidity}`,
              sql2`wind_speed = ${weather.windSpeed}`,
              sql2`apparent_temp = ${weather.apparentTemp}`,
              sql2`precipitation = ${weather.precipitation}`,
              sql2`weather_code = ${weather.weatherCode}`,
              sql2`weather_condition = ${weather.weatherCondition}`,
              sql2`weather_location = ${weather.weatherLocation}`,
              sql2`weather_observed_at = ${weather.weatherObservedAt}`,
              sql2`weather_source = ${weather.weatherSource}`
            );
            weatherUpdates += 1;
          }
        }
        if (!sets.length) continue;
        sets.push(sql2`updated_at = NOW()`);
        const table = candidate.kind === "log" ? "running_logs" : "races";
        await db.execute(sql2`UPDATE ${sql2.raw(table)} SET ${sql2.join(sets, sql2`, `)} WHERE id = ${candidate.id}`);
      } catch (error) {
        failures.push({ id: candidate.id, kind: candidate.kind, message: error instanceof Error ? error.message : "\u66F4\u65B0\u5931\u6557" });
      }
    }
    return {
      ...summariseHistoricalBackfill(candidates, skippedFuture),
      routeTypeUpdates,
      weatherUpdates,
      skippedNoData,
      failures
    };
  }),
  getLabScenarios: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(runningLabScenarios).where(eq2(runningLabScenarios.userId, OWNER_USER_ID)).orderBy(desc(runningLabScenarios.createdAt)).limit(12);
  }),
  saveLabScenario: ownerProcedure.input(z2.object({
    name: z2.string().trim().min(1).max(80),
    runningScenario: z2.string().min(1),
    easyRunDistance: z2.string().optional(),
    temperatureC: z2.number().min(0).max(45),
    humidityPct: z2.number().int().min(10).max(100),
    windKph: z2.number().min(0).max(80),
    baselinePaceSecPerKm: z2.number().optional(),
    baselineFinishSeconds: z2.number().positive(),
    weatherPaceSecPerKm: z2.number().positive(),
    weatherFinishSeconds: z2.number().positive(),
    weatherLoadPercent: z2.number().min(0).max(100)
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const [row] = await db.insert(runningLabScenarios).values({
      ...input,
      userId: OWNER_USER_ID,
      updatedAt: /* @__PURE__ */ new Date()
    }).returning();
    return row;
  }),
  deleteLabScenario: ownerProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.delete(runningLabScenarios).where(and(
      eq2(runningLabScenarios.id, input.id),
      eq2(runningLabScenarios.userId, OWNER_USER_ID)
    ));
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
      vals.push(fields.purchaseDate || null);
    }
    if (fields.retirementDate !== void 0) {
      sets.push(`retirement_date = $${sets.length + 1}`);
      vals.push(fields.retirementDate || null);
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
      vals.push(fields.firstUseDate || null);
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
          overall_place, age_group_place, gender_group_place, running_shoes, shoes_id,
          temperature, humidity, wind_speed, apparent_temp, precipitation,
          weather_code, weather_condition, weather_location, weather_observed_at, weather_source, notes,
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
    temperature: z2.number().optional(),
    humidity: z2.number().optional(),
    windSpeed: z2.number().optional(),
    apparentTemp: z2.number().optional(),
    precipitation: z2.number().optional(),
    weatherCode: z2.number().int().optional(),
    weatherCondition: z2.string().max(120).optional(),
    weatherLocation: z2.string().max(160).optional(),
    weatherObservedAt: z2.string().max(40).optional(),
    weatherSource: z2.string().max(160).optional(),
    notes: z2.string().optional()
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.execute(sql2`
        INSERT INTO races (race_name, date, distance_km, location, registration, bib_no, is_pb, finish_time,
          finish_hr, finish_min, finish_sec, target_hr, target_min, target_sec,
          overall_place, age_group_place, gender_group_place, running_shoes, shoes_id,
          temperature, humidity, wind_speed, apparent_temp, precipitation,
          weather_code, weather_condition, weather_location, weather_observed_at, weather_source, notes)
        VALUES (${input.raceName}, ${input.date}, ${input.distanceKm ?? null}, ${input.location ?? null},
          ${input.registration ?? null}, ${input.bibNo ?? null}, ${input.isPb ?? false}, ${input.finishTime ?? null},
          ${input.finishHr ?? null}, ${input.finishMin ?? null}, ${input.finishSec ?? null},
          ${input.targetHr ?? null}, ${input.targetMin ?? null}, ${input.targetSec ?? null},
          ${input.overallPlace ?? null}, ${input.ageGroupPlace ?? null}, ${input.genderGroupPlace ?? null},
          ${input.runningShoes ?? null}, ${input.shoesId ?? null},
          ${input.temperature ?? null}, ${input.humidity ?? null}, ${input.windSpeed ?? null},
          ${input.apparentTemp ?? null}, ${input.precipitation ?? null},
          ${input.weatherCode ?? null}, ${input.weatherCondition ?? null}, ${input.weatherLocation ?? null},
          ${input.weatherObservedAt ?? null}, ${input.weatherSource ?? null}, ${input.notes ?? null})
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
    temperature: z2.number().optional(),
    humidity: z2.number().optional(),
    windSpeed: z2.number().optional(),
    apparentTemp: z2.number().optional(),
    precipitation: z2.number().optional(),
    weatherCode: z2.number().int().optional(),
    weatherCondition: z2.string().max(120).optional(),
    weatherLocation: z2.string().max(160).optional(),
    weatherObservedAt: z2.string().max(40).optional(),
    weatherSource: z2.string().max(160).optional(),
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
    if (f.temperature !== void 0) {
      sets.push(`temperature = $${sets.length + 1}`);
      vals.push(f.temperature);
    }
    if (f.humidity !== void 0) {
      sets.push(`humidity = $${sets.length + 1}`);
      vals.push(f.humidity);
    }
    if (f.windSpeed !== void 0) {
      sets.push(`wind_speed = $${sets.length + 1}`);
      vals.push(f.windSpeed);
    }
    if (f.apparentTemp !== void 0) {
      sets.push(`apparent_temp = $${sets.length + 1}`);
      vals.push(f.apparentTemp);
    }
    if (f.precipitation !== void 0) {
      sets.push(`precipitation = $${sets.length + 1}`);
      vals.push(f.precipitation);
    }
    if (f.weatherCode !== void 0) {
      sets.push(`weather_code = $${sets.length + 1}`);
      vals.push(f.weatherCode);
    }
    if (f.weatherCondition !== void 0) {
      sets.push(`weather_condition = $${sets.length + 1}`);
      vals.push(f.weatherCondition);
    }
    if (f.weatherLocation !== void 0) {
      sets.push(`weather_location = $${sets.length + 1}`);
      vals.push(f.weatherLocation);
    }
    if (f.weatherObservedAt !== void 0) {
      sets.push(`weather_observed_at = $${sets.length + 1}`);
      vals.push(f.weatherObservedAt);
    }
    if (f.weatherSource !== void 0) {
      sets.push(`weather_source = $${sets.length + 1}`);
      vals.push(f.weatherSource);
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
  batchUpsert: ownerProcedure.input(z2.object({ rows: z2.array(z2.object({
    rowIndex: z2.number().int().min(0),
    data: z2.object({
      date: z2.string().refine((value) => normalizeHKDate(value) !== null, "\u65E5\u671F\u9808\u70BA\u9999\u6E2F YYYY-MM-DD"),
      steps: z2.number().int().min(0).max(2e5).optional(),
      floorsClimbed: z2.number().int().min(0).max(1e3).optional(),
      distanceKm: z2.string().refine((value) => Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 500, "\u8DDD\u96E2\u7121\u6548").optional(),
      activeMinutes: z2.number().int().min(0).max(1440).optional(),
      calories: z2.number().int().min(0).max(2e4).optional(),
      notes: z2.string().max(500).optional()
    }).refine((row) => Object.entries(row).some(([key, value]) => key !== "date" && key !== "notes" && value !== void 0), "\u8ACB\u81F3\u5C11\u8F38\u5165\u4E00\u9805\u6B65\u6578\u6216\u6A13\u68AF\u6578\u64DA")
  })).min(1).max(100) })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const results = [];
    for (const { rowIndex, data } of input.rows) {
      try {
        const existing = await db.select({ id: dailySteps.id }).from(dailySteps).where(and(eq2(dailySteps.userId, OWNER_USER_ID), eq2(dailySteps.date, data.date))).limit(1);
        if (existing[0]) {
          await db.update(dailySteps).set(data).where(eq2(dailySteps.id, existing[0].id));
          results.push({ rowIndex, status: "updated" });
        } else {
          await db.insert(dailySteps).values({ ...data, userId: OWNER_USER_ID });
          results.push({ rowIndex, status: "created" });
        }
      } catch (error) {
        results.push({ rowIndex, status: "failed", message: error instanceof Error ? error.message : "\u672A\u80FD\u5132\u5B58" });
      }
    }
    return results;
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
  }),
  // Backfill calories for ALL steps records using updated formula (steps + floors bonus)
  // Uses body weight on or before each step record's date for accurate estimation
  // Formula: steps × 0.0004 × weightKg + floors × 0.17 × weightKg
  backfillCalories: ownerProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const stepsToFill = await db.select().from(dailySteps).where(and(
      eq2(dailySteps.userId, OWNER_USER_ID),
      sql2`${dailySteps.steps} > 0`
    )).orderBy(dailySteps.date);
    if (stepsToFill.length === 0) return { updated: 0 };
    const bodyRecords = await db.select({
      date: bodyComposition.date,
      weight: bodyComposition.weight
    }).from(bodyComposition).where(and(
      eq2(bodyComposition.userId, OWNER_USER_ID),
      sql2`${bodyComposition.weight} IS NOT NULL`
    )).orderBy(bodyComposition.date);
    let updated = 0;
    for (const step of stepsToFill) {
      const weightRecord = bodyRecords.filter((b) => b.date <= step.date).at(-1);
      const weightKg = weightRecord?.weight ?? 70;
      const floors = step.floorsClimbed ?? 0;
      const estimated = Math.round((step.steps ?? 0) * 4e-4 * weightKg + floors * 0.17 * weightKg);
      if (estimated > 0) {
        await db.update(dailySteps).set({ calories: estimated }).where(eq2(dailySteps.id, step.id));
        updated++;
      }
    }
    return { updated, total: stepsToFill.length };
  })
});
var profileRouter = router({
  get: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select().from(userProfile).where(eq2(userProfile.userId, OWNER_USER_ID)).limit(1);
    return rows[0] ?? null;
  }),
  upsert: publicProcedure.input(z2.object({
    height: z2.number().min(50).max(300).optional(),
    birthYear: z2.number().min(1900).max((/* @__PURE__ */ new Date()).getFullYear()).optional(),
    gender: z2.enum(["male", "female"]).optional()
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const existing = await db.select({ id: userProfile.id }).from(userProfile).where(eq2(userProfile.userId, OWNER_USER_ID)).limit(1);
    if (existing.length > 0) {
      await db.update(userProfile).set({ ...input, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(userProfile.userId, OWNER_USER_ID));
    } else {
      await db.insert(userProfile).values({ userId: OWNER_USER_ID, ...input });
    }
    const rows = await db.select().from(userProfile).where(eq2(userProfile.userId, OWNER_USER_ID)).limit(1);
    return rows[0];
  })
});
var bloodPressureRouter = router({
  getAll: publicProcedure.input(z2.object({ days: z2.number().int().min(1).max(365).default(90) })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    const sinceStr = daysAgoHK(input.days);
    const sinceDate = /* @__PURE__ */ new Date(sinceStr + "T00:00:00+08:00");
    return db.select().from(bloodPressureLogs).where(and(
      eq2(bloodPressureLogs.userId, OWNER_USER_ID),
      sql2`${bloodPressureLogs.measuredAt} >= ${sinceDate}`
    )).orderBy(desc(bloodPressureLogs.measuredAt));
  }),
  add: ownerProcedure.input(z2.object({
    measuredAt: z2.string(),
    // ISO string in HK time
    systolic: z2.number().int().min(50).max(300),
    diastolic: z2.number().int().min(30).max(200),
    pulse: z2.number().int().min(30).max(300).optional(),
    notes: z2.string().max(500).optional()
  })).mutation(async ({ input }) => {
    const pool = getPool();
    if (!pool) throw new Error("DB unavailable");
    const measuredAt = new Date(input.measuredAt);
    const result = await pool.query(
      `INSERT INTO blood_pressure_logs (user_id, measured_at, systolic, diastolic, pulse, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [OWNER_USER_ID, measuredAt, input.systolic, input.diastolic, input.pulse ?? null, input.notes ?? null]
    );
    return result.rows[0];
  }),
  update: ownerProcedure.input(z2.object({
    id: z2.number().int(),
    measuredAt: z2.string().optional(),
    systolic: z2.number().int().min(50).max(300).optional(),
    diastolic: z2.number().int().min(30).max(200).optional(),
    pulse: z2.number().int().min(30).max(300).nullable().optional(),
    notes: z2.string().max(500).nullable().optional()
  })).mutation(async ({ input }) => {
    const pool = getPool();
    if (!pool) throw new Error("DB unavailable");
    const { id, measuredAt, systolic, diastolic, pulse, notes } = input;
    const setClauses = [];
    const params = [];
    if (measuredAt !== void 0) {
      params.push(new Date(measuredAt));
      setClauses.push(`measured_at = $${params.length}`);
    }
    if (systolic !== void 0) {
      params.push(systolic);
      setClauses.push(`systolic = $${params.length}`);
    }
    if (diastolic !== void 0) {
      params.push(diastolic);
      setClauses.push(`diastolic = $${params.length}`);
    }
    if (pulse !== void 0) {
      params.push(pulse);
      setClauses.push(`pulse = $${params.length}`);
    }
    if (notes !== void 0) {
      params.push(notes);
      setClauses.push(`notes = $${params.length}`);
    }
    if (setClauses.length === 0) return { success: true };
    params.push(id);
    await pool.query(`UPDATE blood_pressure_logs SET ${setClauses.join(", ")} WHERE id = $${params.length}`, params);
    return { success: true };
  }),
  batchUpsert: ownerProcedure.input(z2.object({ rows: z2.array(z2.object({
    rowIndex: z2.number().int().min(0),
    data: z2.object({
      measuredAt: z2.string().datetime({ offset: true }),
      systolic: z2.number().int().min(50).max(300),
      diastolic: z2.number().int().min(30).max(200),
      pulse: z2.number().int().min(30).max(300).optional(),
      notes: z2.string().max(500).optional()
    })
  })).min(1).max(100) })).mutation(async ({ input }) => {
    const pool = getPool();
    if (!pool) throw new Error("DB unavailable");
    const results = [];
    for (const { rowIndex, data } of input.rows) {
      try {
        const measuredAt = new Date(data.measuredAt);
        const existing = await pool.query(
          "SELECT id FROM blood_pressure_logs WHERE user_id = $1 AND measured_at = $2 LIMIT 1",
          [OWNER_USER_ID, measuredAt]
        );
        if (existing.rows[0]) {
          await pool.query(
            "UPDATE blood_pressure_logs SET systolic = $1, diastolic = $2, pulse = $3, notes = $4 WHERE id = $5 AND user_id = $6",
            [data.systolic, data.diastolic, data.pulse ?? null, data.notes ?? null, existing.rows[0].id, OWNER_USER_ID]
          );
          results.push({ rowIndex, status: "updated" });
        } else {
          await pool.query(
            "INSERT INTO blood_pressure_logs (user_id, measured_at, systolic, diastolic, pulse, notes) VALUES ($1, $2, $3, $4, $5, $6)",
            [OWNER_USER_ID, measuredAt, data.systolic, data.diastolic, data.pulse ?? null, data.notes ?? null]
          );
          results.push({ rowIndex, status: "created" });
        }
      } catch (error) {
        results.push({ rowIndex, status: "failed", message: error instanceof Error ? error.message : "\u672A\u80FD\u5132\u5B58" });
      }
    }
    return results;
  }),
  delete: ownerProcedure.input(z2.object({ id: z2.number().int() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.delete(bloodPressureLogs).where(eq2(bloodPressureLogs.id, input.id));
    return { success: true };
  })
});
var foodFavoritesRouter = router({
  list: ownerProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db || !ctx.user) return [];
    return db.select().from(foodFavorites).where(eq2(foodFavorites.userId, ctx.user.id)).orderBy(desc(foodFavorites.createdAt));
  }),
  add: ownerProcedure.input(z2.object({
    foodName: z2.string(),
    calories: z2.number().optional(),
    protein: z2.number().optional(),
    carbs: z2.number().optional(),
    fat: z2.number().optional(),
    servingSize: z2.number().optional(),
    servingUnit: z2.string().optional()
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db || !ctx.user) throw new Error("DB not available");
    const existing = await db.select().from(foodFavorites).where(and(eq2(foodFavorites.userId, ctx.user.id), eq2(foodFavorites.foodName, input.foodName))).limit(1);
    if (existing.length > 0) return existing[0];
    const [row] = await db.insert(foodFavorites).values({
      userId: ctx.user.id,
      foodName: input.foodName,
      calories: input.calories,
      protein: input.protein,
      carbs: input.carbs,
      fat: input.fat,
      servingSize: input.servingSize,
      servingUnit: input.servingUnit
    }).returning();
    return row;
  }),
  remove: ownerProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db || !ctx.user) throw new Error("DB not available");
    await db.delete(foodFavorites).where(and(eq2(foodFavorites.id, input.id), eq2(foodFavorites.userId, ctx.user.id)));
    return { success: true };
  }),
  removeByName: ownerProcedure.input(z2.object({ foodName: z2.string() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db || !ctx.user) throw new Error("DB not available");
    await db.delete(foodFavorites).where(and(eq2(foodFavorites.foodName, input.foodName), eq2(foodFavorites.userId, ctx.user.id)));
    return { success: true };
  }),
  rename: ownerProcedure.input(z2.object({ id: z2.number(), newName: z2.string().min(1) })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db || !ctx.user) throw new Error("DB not available");
    await db.update(foodFavorites).set({ foodName: input.newName }).where(and(eq2(foodFavorites.id, input.id), eq2(foodFavorites.userId, ctx.user.id)));
    return { success: true };
  }),
  bulkRemove: ownerProcedure.input(z2.object({ ids: z2.array(z2.number()) })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db || !ctx.user) throw new Error("DB not available");
    if (input.ids.length === 0) return { success: true };
    await db.delete(foodFavorites).where(and(inArray(foodFavorites.id, input.ids), eq2(foodFavorites.userId, ctx.user.id)));
    return { success: true };
  })
});
var foodAnalysisHistoryRouter = router({
  list: ownerProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db || !ctx.user) return [];
    const rows = await db.select().from(foodAnalysisHistory).where(eq2(foodAnalysisHistory.userId, ctx.user.id)).orderBy(desc(foodAnalysisHistory.analyzedAt)).limit(20);
    return rows.map((r) => ({
      ...r,
      foods: (() => {
        try {
          return JSON.parse(r.analysisResult);
        } catch {
          return [];
        }
      })()
    }));
  }),
  save: ownerProcedure.input(z2.object({
    photoUrl: z2.string().optional(),
    analysisResult: z2.string(),
    // JSON string
    totalCalories: z2.number().optional()
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db || !ctx.user) throw new Error("DB not available");
    const [row] = await db.insert(foodAnalysisHistory).values({
      userId: ctx.user.id,
      photoUrl: input.photoUrl,
      analysisResult: input.analysisResult,
      totalCalories: input.totalCalories
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
  profile: profileRouter,
  bloodPressure: bloodPressureRouter,
  foodFavorites: foodFavoritesRouter,
  foodAnalysisHistory: foodAnalysisHistoryRouter
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
