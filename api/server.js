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
  date,
  serial
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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull()
});
var workoutSets = pgTable("workout_sets", {
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
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var bodyComposition = pgTable("body_composition", {
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
  updatedAt: timestamp("updatedAt").defaultNow().notNull()
});
var heartRateLogs = pgTable("heart_rate_logs", {
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
  updatedAt: timestamp("updatedAt").defaultNow().notNull()
});
var sleepLogs = pgTable("sleep_logs", {
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
  updatedAt: timestamp("updatedAt").defaultNow().notNull()
});
var progressPhotos = pgTable("progress_photos", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  photoUrl: text("photoUrl").notNull(),
  fileKey: text("fileKey").notNull(),
  angle: varchar("angle", { length: 50 }).default("front"),
  notes: text("notes"),
  weight: real("weight"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var aiInsights = pgTable("ai_insights", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  period: varchar("period", { length: 50 }).notNull().default("weekly"),
  content: text("content").notNull(),
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
  weekStart: date("weekStart"),
  weekEnd: date("weekEnd")
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
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? ""
};

// server/db.ts
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
    const values = {
      openId: user.openId
    };
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
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
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

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app2) {
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
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
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

// server/routers.ts
import { nanoid } from "nanoid";

// server/sheetsService.ts
import { google } from "googleapis";
var SPREADSHEET_ID = "16MzWHNx9Njww8Ml3eq5tJEspmSkHcWxmaI9I5xTqsEU";
var SHEET_TABS = {
  body: "Body Fitness",
  sleep: "Sleep",
  heartrate: "Heart Rate"
};
var BODY_COLUMNS = ["Date", "Weight (kg)", "BMI", "Body Fat %", "Fat Mass (kg)", "Muscle Mass (kg)", "BMR", "Visceral Fat", "Source", "Notes"];
var SLEEP_COLUMNS = ["Date", "Sleep Score", "Resting HR", "Body Battery", "Pulse Ox (%)", "Respiration", "Stress", "Quality", "Duration (h)", "Source"];
var HR_COLUMNS = ["Date", "Resting HR", "High HR", "HRV", "Source", "Notes"];
function getAuth() {
  const credJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not set");
  const credentials = JSON.parse(credJson);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
}
async function readSheetData(type) {
  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: "v4", auth });
    const sheetName = SHEET_TABS[type];
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:Z`
    });
    const rows = response.data.values;
    if (!rows || rows.length < 2) return [];
    const headers = rows[0].map((h) => String(h).trim());
    const data = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.every((cell) => !cell)) continue;
      const obj = {};
      headers.forEach((header, idx) => {
        obj[header] = row[idx] ?? "";
      });
      if (type === "body") {
        data.push({
          date: String(obj["Date"] ?? ""),
          weight: parseFloat(String(obj["Weight (kg)"] ?? "")) || void 0,
          bmi: parseFloat(String(obj["BMI"] ?? "")) || void 0,
          bodyFatPct: parseFloat(String(obj["Body Fat %"] ?? "")) || void 0,
          fatMass: parseFloat(String(obj["Fat Mass (kg)"] ?? "")) || void 0,
          muscleMass: parseFloat(String(obj["Muscle Mass (kg)"] ?? "")) || void 0,
          bmr: parseFloat(String(obj["BMR"] ?? "")) || void 0,
          visceralFat: parseFloat(String(obj["Visceral Fat"] ?? "")) || void 0,
          notes: String(obj["Notes"] ?? "") || void 0,
          source: "sheets"
        });
      } else if (type === "sleep") {
        data.push({
          date: String(obj["Date"] ?? ""),
          score: parseFloat(String(obj["Sleep Score"] ?? "")) || void 0,
          restingHr: parseFloat(String(obj["Resting HR"] ?? "")) || void 0,
          bodyBattery: parseFloat(String(obj["Body Battery"] ?? "")) || void 0,
          pulseOx: parseFloat(String(obj["Pulse Ox (%)"] ?? "")) || void 0,
          respiration: parseFloat(String(obj["Respiration"] ?? "")) || void 0,
          stress: parseFloat(String(obj["Stress"] ?? "")) || void 0,
          quality: String(obj["Quality"] ?? "") || void 0,
          duration: parseFloat(String(obj["Duration (h)"] ?? "")) || void 0,
          source: "sheets"
        });
      } else if (type === "heartrate") {
        data.push({
          date: String(obj["Date"] ?? ""),
          restingHr: parseFloat(String(obj["Resting HR"] ?? "")) || void 0,
          highHr: parseFloat(String(obj["High HR"] ?? "")) || void 0,
          hrv: parseFloat(String(obj["HRV"] ?? "")) || void 0,
          notes: String(obj["Notes"] ?? "") || void 0,
          source: "sheets"
        });
      }
    }
    return data.filter((d) => d.date);
  } catch (err) {
    console.error(`[Sheets] readSheetData(${type}) error:`, err?.message);
    throw err;
  }
}
async function writeRowToSheet(type, rowData) {
  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: "v4", auth });
    const sheetName = SHEET_TABS[type];
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
        rowData.stress !== void 0 ? Number(rowData.stress) : "",
        String(rowData.quality ?? ""),
        rowData.duration !== void 0 ? Number(rowData.duration) : "",
        String(rowData.source ?? "app")
      ];
    } else {
      values = [
        String(rowData.date ?? ""),
        rowData.restingHr !== void 0 ? Number(rowData.restingHr) : "",
        rowData.highHr !== void 0 ? Number(rowData.highHr) : "",
        rowData.hrv !== void 0 ? Number(rowData.hrv) : "",
        String(rowData.source ?? "app"),
        String(rowData.notes ?? "")
      ];
    }
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:Z`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [values]
      }
    });
  } catch (err) {
    console.error(`[Sheets] writeRowToSheet(${type}) error:`, err?.message);
    throw err;
  }
}
async function ensureSheetHeaders(type) {
  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: "v4", auth });
    const sheetName = SHEET_TABS[type];
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1:Z1`
    });
    const firstRow = response.data.values?.[0];
    if (firstRow && firstRow.length > 0) return;
    const headers = type === "body" ? BODY_COLUMNS : type === "sleep" ? SLEEP_COLUMNS : HR_COLUMNS;
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

// server/routers.ts
var nutritionRouter = router({
  // Search food database
  searchFoods: protectedProcedure.input(z2.object({ query: z2.string().min(1) })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(foodItems).where(or(like(foodItems.name, `%${input.query}%`), like(foodItems.nameZh, `%${input.query}%`))).limit(20);
  }),
  // Get meal logs for a date
  getMealLogs: protectedProcedure.input(z2.object({ date: z2.string() })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(mealLogs).where(and(eq2(mealLogs.userId, ctx.user.id), sql2`${mealLogs.loggedAt} >= ${/* @__PURE__ */ new Date(input.date + "T00:00:00")}`, sql2`${mealLogs.loggedAt} <= ${/* @__PURE__ */ new Date(input.date + "T23:59:59")}`)).orderBy(mealLogs.createdAt);
  }),
  // Get meal logs for date range
  getMealLogsRange: protectedProcedure.input(z2.object({ startDate: z2.string(), endDate: z2.string() })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(mealLogs).where(and(
      eq2(mealLogs.userId, ctx.user.id),
      sql2`${mealLogs.loggedAt} >= ${new Date(input.startDate)}`,
      sql2`${mealLogs.loggedAt} <= ${new Date(input.endDate)}`
    )).orderBy(desc(mealLogs.loggedAt));
  }),
  // Add meal log
  addMealLog: protectedProcedure.input(z2.object({
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
    await db.insert(mealLogs).values({ ...input, userId: ctx.user.id });
    return { success: true };
  }),
  // Update meal log
  updateMealLog: protectedProcedure.input(z2.object({
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
    await db.update(mealLogs).set(data).where(and(eq2(mealLogs.id, id), eq2(mealLogs.userId, ctx.user.id)));
    return { success: true };
  }),
  // Delete meal log
  deleteMealLog: protectedProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.delete(mealLogs).where(and(eq2(mealLogs.id, input.id), eq2(mealLogs.userId, ctx.user.id)));
    return { success: true };
  }),
  // AI food photo analysis
  analyzeFoodPhoto: protectedProcedure.input(z2.object({ imageUrl: z2.string(), imageBase64: z2.string().optional() })).mutation(async ({ input }) => {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a professional nutritionist and food recognition AI. Analyze the food in the image and provide accurate nutritional estimates. Always respond with valid JSON only.`
        },
        {
          role: "user",
          content: `[IMAGE:${input.imageUrl}] Identify all food items visible in this image and estimate their nutritional content. Provide the response as JSON with this exact structure: {"foods":[{"name":"Food Name","nameZh":"\u98DF\u7269\u4E2D\u6587\u540D","quantity":150,"unit":"g","calories":250,"protein":15,"carbs":30,"fat":8,"fiber":2}],"totalCalories":250,"totalProtein":15,"totalCarbs":30,"totalFat":8,"confidence":"high","notes":"Brief description"}`
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
  uploadFoodPhoto: protectedProcedure.input(z2.object({ base64: z2.string(), mimeType: z2.string() })).mutation(async ({ ctx, input }) => {
    const buffer = Buffer.from(input.base64, "base64");
    const key = `food-photos/${ctx.user.id}/${nanoid()}.jpg`;
    const { url } = await storagePut(key, buffer, input.mimeType);
    return { url, key };
  })
});
var workoutRouter = router({
  // Get all exercises (built-in + user's custom)
  getExercises: protectedProcedure.input(z2.object({ muscleGroup: z2.string().optional() }).optional()).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return [];
    const conditions = [
      or(eq2(exercises.isCustom, false), eq2(exercises.userId, ctx.user.id))
    ];
    if (input?.muscleGroup) {
      conditions.push(eq2(exercises.muscleGroup, input.muscleGroup));
    }
    return db.select().from(exercises).where(and(...conditions)).orderBy(exercises.name);
  }),
  // Add custom exercise
  addExercise: protectedProcedure.input(z2.object({
    name: z2.string(),
    nameZh: z2.string().optional(),
    muscleGroup: z2.string(),
    equipment: z2.string().optional(),
    instructions: z2.string().optional()
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.insert(exercises).values({ ...input, isCustom: true, userId: ctx.user.id });
    return { success: true };
  }),
  // Get workout sessions
  getSessions: protectedProcedure.input(z2.object({ startDate: z2.string().optional(), endDate: z2.string().optional() }).optional()).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return [];
    const conditions = [eq2(workoutSessions.userId, ctx.user.id)];
    if (input?.startDate) conditions.push(sql2`${workoutSessions.startTime} >= ${new Date(input.startDate)}`);
    if (input?.endDate) conditions.push(sql2`${workoutSessions.startTime} <= ${new Date(input.endDate)}`);
    return db.select().from(workoutSessions).where(and(...conditions)).orderBy(desc(workoutSessions.startTime));
  }),
  // Get session with sets
  getSessionWithSets: protectedProcedure.input(z2.object({ sessionId: z2.number() })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return null;
    const sessions = await db.select().from(workoutSessions).where(and(eq2(workoutSessions.id, input.sessionId), eq2(workoutSessions.userId, ctx.user.id))).limit(1);
    if (!sessions[0]) return null;
    const sets = await db.select().from(workoutSets).where(eq2(workoutSets.sessionId, input.sessionId)).orderBy(workoutSets.exerciseName, workoutSets.setNumber);
    return { session: sessions[0], sets };
  }),
  // Create workout session
  createSession: protectedProcedure.input(z2.object({
    date: z2.string(),
    name: z2.string().optional(),
    duration: z2.number().optional(),
    notes: z2.string().optional()
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const result = await db.insert(workoutSessions).values({ ...input, userId: ctx.user.id }).returning({ id: workoutSessions.id });
    return { success: true, id: result[0]?.id ?? 0 };
  }),
  // Update session
  updateSession: protectedProcedure.input(z2.object({
    id: z2.number(),
    name: z2.string().optional(),
    duration: z2.number().optional(),
    notes: z2.string().optional(),
    totalVolume: z2.number().optional()
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const { id, ...data } = input;
    await db.update(workoutSessions).set(data).where(and(eq2(workoutSessions.id, id), eq2(workoutSessions.userId, ctx.user.id)));
    return { success: true };
  }),
  // Delete session
  deleteSession: protectedProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.delete(workoutSets).where(eq2(workoutSets.sessionId, input.id));
    await db.delete(workoutSessions).where(and(eq2(workoutSessions.id, input.id), eq2(workoutSessions.userId, ctx.user.id)));
    return { success: true };
  }),
  // Add workout set
  addSet: protectedProcedure.input(z2.object({
    sessionId: z2.number(),
    exerciseId: z2.number(),
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
    await db.insert(workoutSets).values(input);
    return { success: true };
  }),
  // Update set
  updateSet: protectedProcedure.input(z2.object({
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
  deleteSet: protectedProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.delete(workoutSets).where(eq2(workoutSets.id, input.id));
    return { success: true };
  })
});
var bodyRouter = router({
  getAll: protectedProcedure.input(z2.object({ limit: z2.number().optional() }).optional()).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(bodyComposition).where(eq2(bodyComposition.userId, ctx.user.id)).orderBy(desc(bodyComposition.date)).limit(input?.limit || 100);
  }),
  add: protectedProcedure.input(z2.object({
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
    await db.insert(bodyComposition).values({ ...input, userId: ctx.user.id });
    return { success: true };
  }),
  update: protectedProcedure.input(z2.object({
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
    await db.update(bodyComposition).set(data).where(and(eq2(bodyComposition.id, id), eq2(bodyComposition.userId, ctx.user.id)));
    return { success: true };
  }),
  delete: protectedProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.delete(bodyComposition).where(and(eq2(bodyComposition.id, input.id), eq2(bodyComposition.userId, ctx.user.id)));
    return { success: true };
  }),
  // Bulk import from Google Sheets
  bulkImport: protectedProcedure.input(z2.array(z2.object({
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
      await db.insert(bodyComposition).values({ ...row, userId: ctx.user.id, source: "sheets" }).onConflictDoNothing().catch(() => {
      });
    }
    return { success: true, count: input.length };
  })
});
var heartRateRouter = router({
  getAll: protectedProcedure.input(z2.object({ limit: z2.number().optional() }).optional()).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(heartRateLogs).where(eq2(heartRateLogs.userId, ctx.user.id)).orderBy(desc(heartRateLogs.date)).limit(input?.limit || 200);
  }),
  add: protectedProcedure.input(z2.object({
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
    await db.insert(heartRateLogs).values({ ...input, userId: ctx.user.id });
    return { success: true };
  }),
  update: protectedProcedure.input(z2.object({
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
    await db.update(heartRateLogs).set(data).where(and(eq2(heartRateLogs.id, id), eq2(heartRateLogs.userId, ctx.user.id)));
    return { success: true };
  }),
  delete: protectedProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.delete(heartRateLogs).where(and(eq2(heartRateLogs.id, input.id), eq2(heartRateLogs.userId, ctx.user.id)));
    return { success: true };
  }),
  bulkImport: protectedProcedure.input(z2.array(z2.object({
    date: z2.string(),
    restingHr: z2.number().optional(),
    highHr: z2.number().optional()
  }))).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    for (const row of input) {
      await db.insert(heartRateLogs).values({ ...row, userId: ctx.user.id, source: "sheets" }).catch(() => {
      });
    }
    return { success: true, count: input.length };
  })
});
var sleepRouter = router({
  getAll: protectedProcedure.input(z2.object({ limit: z2.number().optional() }).optional()).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(sleepLogs).where(eq2(sleepLogs.userId, ctx.user.id)).orderBy(desc(sleepLogs.date)).limit(input?.limit || 200);
  }),
  add: protectedProcedure.input(z2.object({
    date: z2.string(),
    score: z2.number().optional(),
    restingHr: z2.number().optional(),
    bodyBattery: z2.number().optional(),
    pulseOx: z2.number().optional(),
    respiration: z2.number().optional(),
    stress: z2.number().optional(),
    quality: z2.enum(["Poor", "Fair", "Good", "Excellent"]).optional(),
    duration: z2.number().optional(),
    deepSleep: z2.number().optional(),
    remSleep: z2.number().optional(),
    notes: z2.string().optional(),
    source: z2.string().optional()
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const { score, quality, duration, restingHr: _rhr, ...rest } = input;
    await db.insert(sleepLogs).values({
      ...rest,
      userId: ctx.user.id,
      sleepScore: score,
      sleepQuality: quality,
      sleepDuration: duration
    });
    return { success: true };
  }),
  update: protectedProcedure.input(z2.object({
    id: z2.number(),
    date: z2.string().optional(),
    score: z2.number().optional(),
    restingHr: z2.number().optional(),
    bodyBattery: z2.number().optional(),
    pulseOx: z2.number().optional(),
    respiration: z2.number().optional(),
    quality: z2.enum(["Poor", "Fair", "Good", "Excellent"]).optional(),
    duration: z2.number().optional(),
    notes: z2.string().optional()
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const { id, score, quality, duration, restingHr: _rhr, ...rest } = input;
    const data = { ...rest, sleepScore: score, sleepQuality: quality, sleepDuration: duration };
    await db.update(sleepLogs).set(data).where(and(eq2(sleepLogs.id, id), eq2(sleepLogs.userId, ctx.user.id)));
    return { success: true };
  }),
  delete: protectedProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.delete(sleepLogs).where(and(eq2(sleepLogs.id, input.id), eq2(sleepLogs.userId, ctx.user.id)));
    return { success: true };
  }),
  bulkImport: protectedProcedure.input(z2.array(z2.object({
    date: z2.string(),
    score: z2.number().optional(),
    restingHr: z2.number().optional(),
    bodyBattery: z2.number().optional(),
    pulseOx: z2.number().optional(),
    respiration: z2.number().optional(),
    stress: z2.number().optional(),
    quality: z2.enum(["Poor", "Fair", "Good", "Excellent"]).optional()
  }))).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    for (const row of input) {
      await db.insert(sleepLogs).values({ ...row, userId: ctx.user.id, source: "sheets" }).catch(() => {
      });
    }
    return { success: true, count: input.length };
  })
});
var photosRouter = router({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(progressPhotos).where(eq2(progressPhotos.userId, ctx.user.id)).orderBy(desc(progressPhotos.date));
  }),
  upload: protectedProcedure.input(z2.object({
    base64: z2.string(),
    mimeType: z2.string(),
    date: z2.string(),
    angle: z2.enum(["front", "back", "side_left", "side_right", "other"]).optional(),
    weight: z2.number().optional(),
    notes: z2.string().optional()
  })).mutation(async ({ ctx, input }) => {
    const buffer = Buffer.from(input.base64, "base64");
    const key = `progress-photos/${ctx.user.id}/${nanoid()}.jpg`;
    const { url } = await storagePut(key, buffer, input.mimeType);
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.insert(progressPhotos).values({
      userId: ctx.user.id,
      date: input.date,
      photoUrl: url,
      fileKey: key,
      angle: input.angle || "front",
      weight: input.weight,
      notes: input.notes
    });
    return { success: true, url };
  }),
  delete: protectedProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.delete(progressPhotos).where(and(eq2(progressPhotos.id, input.id), eq2(progressPhotos.userId, ctx.user.id)));
    return { success: true };
  })
});
var insightsRouter = router({
  getLatest: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;
    const results = await db.select().from(aiInsights).where(eq2(aiInsights.userId, ctx.user.id)).orderBy(desc(aiInsights.weekStart)).limit(4);
    return results;
  }),
  generate: protectedProcedure.input(z2.object({ type: z2.enum(["nutrition", "workout", "recovery", "overall"]).optional() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const today = /* @__PURE__ */ new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1e3);
    const weekAgoStr = weekAgo.toISOString().split("T")[0];
    const todayStr = today.toISOString().split("T")[0];
    const [meals, sessions, body, sleep, hr] = await Promise.all([
      db.select().from(mealLogs).where(and(eq2(mealLogs.userId, ctx.user.id), sql2`${mealLogs.loggedAt} >= ${weekAgo}`)).limit(50),
      db.select().from(workoutSessions).where(and(eq2(workoutSessions.userId, ctx.user.id), sql2`${workoutSessions.startTime} >= ${weekAgo}`)),
      db.select().from(bodyComposition).where(eq2(bodyComposition.userId, ctx.user.id)).orderBy(desc(bodyComposition.date)).limit(5),
      db.select().from(sleepLogs).where(and(eq2(sleepLogs.userId, ctx.user.id), gte(sleepLogs.date, weekAgoStr))),
      db.select().from(heartRateLogs).where(and(eq2(heartRateLogs.userId, ctx.user.id), gte(heartRateLogs.date, weekAgoStr)))
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
      userId: ctx.user.id,
      weekStart,
      content,
      period: input.type || "overall"
    });
    return { content, weekStart };
  })
});
var dashboardRouter = router({
  getSummary: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;
    const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const todayStart = /* @__PURE__ */ new Date(todayStr + "T00:00:00");
    const todayEnd = /* @__PURE__ */ new Date(todayStr + "T23:59:59");
    const weekAgoDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1e3);
    const weekAgoStr = weekAgoDate.toISOString().split("T")[0];
    const [todayMeals, recentSessions, latestBody, latestSleep, latestHr, weekMeals] = await Promise.all([
      db.select().from(mealLogs).where(and(eq2(mealLogs.userId, ctx.user.id), sql2`${mealLogs.loggedAt} >= ${todayStart}`, sql2`${mealLogs.loggedAt} <= ${todayEnd}`)),
      db.select().from(workoutSessions).where(and(eq2(workoutSessions.userId, ctx.user.id), sql2`${workoutSessions.startTime} >= ${weekAgoDate}`)).orderBy(desc(workoutSessions.startTime)).limit(7),
      db.select().from(bodyComposition).where(eq2(bodyComposition.userId, ctx.user.id)).orderBy(desc(bodyComposition.date)).limit(2),
      db.select().from(sleepLogs).where(eq2(sleepLogs.userId, ctx.user.id)).orderBy(desc(sleepLogs.date)).limit(1),
      db.select().from(heartRateLogs).where(eq2(heartRateLogs.userId, ctx.user.id)).orderBy(desc(heartRateLogs.date)).limit(1),
      db.select().from(mealLogs).where(and(eq2(mealLogs.userId, ctx.user.id), sql2`${mealLogs.loggedAt} >= ${weekAgoDate}`))
    ]);
    const todayCalories = todayMeals.reduce((s, m) => s + (m.calories ?? 0), 0);
    const todayProtein = todayMeals.reduce((s, m) => s + (m.protein ?? 0), 0);
    const todayCarbs = todayMeals.reduce((s, m) => s + (m.carbs ?? 0), 0);
    const todayFat = todayMeals.reduce((s, m) => s + (m.fat ?? 0), 0);
    let streak = 0;
    const sessionDates = new Set(recentSessions.map((s) => new Date(s.startTime).toISOString().split("T")[0]));
    for (let i = 0; i < 7; i++) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1e3).toISOString().split("T")[0];
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
      weekMeals
    };
  })
});
var sheetsRouter = router({
  // Pull data FROM Google Sheets → local DB
  pullFromSheets: protectedProcedure.input(z2.object({ type: z2.enum(["body", "sleep", "heartrate"]) })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const rows = await readSheetData(input.type);
    let count = 0;
    if (input.type === "body") {
      for (const row of rows) {
        const dateVal = String(row.date ?? "");
        if (!dateVal) continue;
        await db.insert(bodyComposition).values({
          userId: ctx.user.id,
          date: dateVal,
          weight: row.weight !== void 0 ? Number(row.weight) : void 0,
          bmi: row.bmi !== void 0 ? Number(row.bmi) : void 0,
          bodyFatPct: row.bodyFatPct !== void 0 ? Number(row.bodyFatPct) : void 0,
          fatMass: row.fatMass !== void 0 ? Number(row.fatMass) : void 0,
          muscleMass: row.muscleMass !== void 0 ? Number(row.muscleMass) : void 0,
          bmr: row.bmr !== void 0 ? Number(row.bmr) : void 0,
          visceralFat: row.visceralFat !== void 0 ? Number(row.visceralFat) : void 0,
          source: "sheets"
        }).catch(() => {
        });
        count++;
      }
    } else if (input.type === "sleep") {
      for (const row of rows) {
        const dateVal = String(row.date ?? "");
        if (!dateVal) continue;
        const qualityVal = String(row.quality ?? "");
        await db.insert(sleepLogs).values({
          userId: ctx.user.id,
          date: dateVal,
          sleepScore: row.score !== void 0 ? Number(row.score) : void 0,
          bodyBattery: row.bodyBattery !== void 0 ? Number(row.bodyBattery) : void 0,
          pulseOx: row.pulseOx !== void 0 ? Number(row.pulseOx) : void 0,
          respiration: row.respiration !== void 0 ? Number(row.respiration) : void 0,
          sleepQuality: ["Poor", "Fair", "Good", "Excellent"].includes(qualityVal ?? "") ? qualityVal : void 0,
          source: "sheets"
        }).catch(() => {
        });
        count++;
      }
    } else if (input.type === "heartrate") {
      for (const row of rows) {
        const dateVal = String(row.date ?? "");
        if (!dateVal) continue;
        await db.insert(heartRateLogs).values({
          userId: ctx.user.id,
          date: dateVal,
          highHr: row.highHr !== void 0 ? Number(row.highHr) : void 0,
          hrv: row.hrv !== void 0 ? Number(row.hrv) : void 0,
          source: "sheets"
        }).catch(() => {
        });
        count++;
      }
    }
    return { success: true, count, rows: rows.length };
  }),
  // Push data FROM local DB → Google Sheets (write-back)
  pushToSheets: protectedProcedure.input(z2.object({
    type: z2.enum(["body", "sleep", "heartrate"]),
    data: z2.record(z2.string(), z2.unknown())
  })).mutation(async ({ input }) => {
    await ensureSheetHeaders(input.type);
    await writeRowToSheet(input.type, input.data);
    return { success: true };
  }),
  // Legacy: accept manually pasted data array (for users without API access)
  syncFromSheets: protectedProcedure.input(z2.object({
    type: z2.enum(["body", "sleep", "heartrate"]),
    data: z2.array(z2.record(z2.string(), z2.unknown()))
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    let count = 0;
    for (const row of input.data) {
      const dateVal = String(row.date ?? "");
      if (!dateVal) continue;
      if (input.type === "body") {
        await db.insert(bodyComposition).values({
          userId: ctx.user.id,
          date: dateVal,
          weight: row.weight !== void 0 ? Number(row.weight) : void 0,
          bmi: row.bmi !== void 0 ? Number(row.bmi) : void 0,
          bodyFatPct: row.bodyFatPct !== void 0 ? Number(row.bodyFatPct) : void 0,
          fatMass: row.fatMass !== void 0 ? Number(row.fatMass) : void 0,
          muscleMass: row.muscleMass !== void 0 ? Number(row.muscleMass) : void 0,
          bmr: row.bmr !== void 0 ? Number(row.bmr) : void 0,
          visceralFat: row.visceralFat !== void 0 ? Number(row.visceralFat) : void 0,
          source: "sheets"
        }).catch(() => {
        });
      } else if (input.type === "sleep") {
        const qualityVal = String(row.quality ?? "");
        await db.insert(sleepLogs).values({
          userId: ctx.user.id,
          date: dateVal,
          sleepScore: row.score !== void 0 ? Number(row.score) : void 0,
          bodyBattery: row.bodyBattery !== void 0 ? Number(row.bodyBattery) : void 0,
          pulseOx: row.pulseOx !== void 0 ? Number(row.pulseOx) : void 0,
          respiration: row.respiration !== void 0 ? Number(row.respiration) : void 0,
          sleepQuality: ["Poor", "Fair", "Good", "Excellent"].includes(qualityVal ?? "") ? qualityVal : void 0,
          source: "sheets"
        }).catch(() => {
        });
      } else if (input.type === "heartrate") {
        await db.insert(heartRateLogs).values({
          userId: ctx.user.id,
          date: dateVal,
          highHr: row.highHr !== void 0 ? Number(row.highHr) : void 0,
          source: "sheets"
        }).catch(() => {
        });
      }
      count++;
    }
    return { success: true, count };
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
  sheets: sheetsRouter
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
