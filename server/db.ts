import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { InsertUser, users } from "../drizzle/schema";
import { ENV } from './_core/env';

const OWNER_EMAIL = "kingsleytsemc314@gmail.com";

const { Pool } = pg;

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: InstanceType<typeof Pool> | null = null;

// Lazily create the drizzle instance — prefer Supabase over built-in MySQL.
export async function getDb() {
  if (_db) return _db;

  const connStr = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
  if (!connStr) return null;

  // If it's a PostgreSQL URL, use pg driver
  if (connStr.startsWith("postgresql://") || connStr.startsWith("postgres://")) {
    try {
      _pool = new Pool({
        connectionString: connStr,
        ssl: { rejectUnauthorized: false },
        max: 5,
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

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    // Account merging: if the incoming email matches the owner email,
    // we always upsert into the canonical owner row (identified by OWNER_EMAIL).
    // This ensures Google, GitHub, Manus, and any other provider all share the same user record.
    const isOwnerEmail = user.email && user.email.toLowerCase() === OWNER_EMAIL.toLowerCase();
    const isOwnerOpenId = user.openId === ENV.ownerOpenId;

    if (isOwnerEmail || isOwnerOpenId) {
      // Check if an owner row already exists (by email or by ownerOpenId)
      let existingOwner = await db.select().from(users)
        .where(eq(users.email, OWNER_EMAIL)).limit(1).then(r => r[0] ?? null);

      if (!existingOwner && ENV.ownerOpenId) {
        existingOwner = await db.select().from(users)
          .where(eq(users.openId, ENV.ownerOpenId)).limit(1).then(r => r[0] ?? null);
      }

      if (existingOwner) {
        // If the incoming openId is already bound to this owner row, just update other fields.
        // If it's bound to a DIFFERENT row, we need to handle the conflict first.
        if (existingOwner.openId !== user.openId) {
          // Check if another row already has this openId (would cause unique constraint violation)
          const conflictRow = await db.select().from(users)
            .where(eq(users.openId, user.openId)).limit(1).then(r => r[0] ?? null);
          if (conflictRow && conflictRow.id !== existingOwner.id) {
            // Nullify the openId on the conflicting row so we can take it for the owner row
            await db.update(users).set({ openId: sql`NULL` }).where(eq(users.id, conflictRow.id));
            console.log(`[Auth] Cleared conflicting openId=${user.openId} from user.id=${conflictRow.id}`);
          }
        }
        // Update the existing owner row: update openId to the current login's openId
        // so that session token lookup (by openId) resolves to the owner row.
        await db.update(users).set({
          openId: user.openId, // bind this provider's openId to the owner row
          name: user.name ?? existingOwner.name,
          email: OWNER_EMAIL,
          loginMethod: user.loginMethod ?? existingOwner.loginMethod,
          lastSignedIn: new Date(),
          role: 'admin',
        }).where(eq(users.id, existingOwner.id));
        console.log(`[Auth] Owner account merged: openId=${user.openId} → user.id=${existingOwner.id}`);
        return;
      } else {
        // First-time owner login: create the owner row with admin role
        await db.insert(users).values({
          openId: user.openId,
          name: user.name ?? null,
          email: OWNER_EMAIL,
          loginMethod: user.loginMethod ?? null,
          lastSignedIn: new Date(),
          role: 'admin',
        }).onConflictDoUpdate({
          target: users.openId,
          set: { email: OWNER_EMAIL, role: 'admin', lastSignedIn: new Date() },
        });
        console.log(`[Auth] Owner account created: openId=${user.openId}`);
        return;
      }
    }

    // Regular (non-owner) user upsert
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    // PostgreSQL upsert using onConflictDoUpdate
    await db.insert(users)
      .values(values)
      .onConflictDoUpdate({
        target: users.openId,
        set: updateSet as Partial<InsertUser>,
      });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}
