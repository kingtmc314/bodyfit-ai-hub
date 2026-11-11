import { and, desc, eq, inArray } from "drizzle-orm";
import { bodyComposition, userProfile, workoutSessions, workoutSets } from "../drizzle/schema";
import type { getDb } from "./db";
import {
  WORKOUT_CALORIE_VERSION, estimateWorkoutCalories, calorieEstimateSummary,
  validateWorkoutMinutes, validateBodyWeight, type CalorieWorkoutSet,
  type WorkoutCalorieDetails, type WorkoutIntensity, type WorkoutWeightSource,
} from "../shared/workoutCalories";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
export interface CalorieSession {
  id: number; userId?: number; startTime: Date | string | null; endTime?: Date | string | null;
  duration?: number | null; caloriesBurned?: number | null; totalVolume?: number | null;
  calorieDetails?: WorkoutCalorieDetails | unknown;
}
export interface WeightRecord { date: string; weight: number | null; id?: number }
export interface ReviewedWorkoutTiming {
  duration?: number; startTime?: string; endTime?: string;
  intensity?: WorkoutIntensity; bodyWeightKg?: number;
}
const HK_OFFSET = 8 * 60 * 60 * 1000;
export function sessionHKDate(time: Date | string): string {
  const parsed = new Date(time);
  if (!Number.isFinite(parsed.getTime())) throw new Error("訓練開始時間無效，請輸入含時區的實際開始時間。");
  return new Date(parsed.getTime() + HK_OFFSET).toISOString().slice(0, 10);
}
export function workoutWeekMonday(date: string): string {
  const day = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(day.getTime())) throw new Error("訓練週日期無效。");
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day.toISOString().slice(0, 10);
}
export function validateSessionDate(date: string, now = new Date()): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("訓練日期必須為 YYYY-MM-DD。");
  const parsed = new Date(`${date}T00:00:00+08:00`);
  if (!Number.isFinite(parsed.getTime()) || sessionHKDate(parsed) !== date) throw new Error("訓練日期無效，請確認年月日。");
  if (date > sessionHKDate(now)) throw new Error("未來日期不能記錄已完成運動；請改為今天或實際訓練日期。");
  return date;
}
export function parseWorkoutTimestamp(value: string): Date {
  if (!/T\d{2}:\d{2}.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)) throw new Error("開始／結束時間須包含時區，例如 2026-11-11T18:00:00+08:00。");
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("開始／結束時間無效。");
  return date;
}
function detailsOf(session: CalorieSession): WorkoutCalorieDetails | null {
  const details = session.calorieDetails as WorkoutCalorieDetails | null;
  return details?.version === WORKOUT_CALORIE_VERSION && details.timing ? details : null;
}
export function workoutVolume(sets: readonly CalorieWorkoutSet[]): number {
  return sets.reduce((sum, set) => {
    const reps = set.reps ?? 0, weight = set.weight ?? 0;
    return Number.isFinite(reps) && Number.isFinite(weight) && reps > 0 && weight >= 0 ? sum + reps * weight : sum;
  }, 0);
}
export function selectWorkoutWeight(sessionDate: string, weights: readonly WeightRecord[], profileWeight?: number | null) {
  const valid = (weight: number | null | undefined): weight is number => typeof weight === "number" && Number.isFinite(weight) && weight >= 20 && weight <= 350;
  const measured = weights.filter(row => row.date <= sessionDate && /^\d{4}-\d{2}-\d{2}$/.test(row.date) && valid(row.weight))
    .sort((a, b) => b.date.localeCompare(a.date) || (b.id ?? 0) - (a.id ?? 0))[0];
  if (measured) return { bodyWeightKg: measured.weight!, weightSource: "body_composition" as WorkoutWeightSource, weightDate: measured.date };
  if (valid(profileWeight)) return { bodyWeightKg: profileWeight, weightSource: "user_profile" as WorkoutWeightSource, weightDate: null };
  return { bodyWeightKg: 70, weightSource: "assumed_70kg" as WorkoutWeightSource, weightDate: null };
}
/** Recognize only the old algorithm's rounded fingerprint. Unknown provenance must not erase a reported/manual number. */
export function isLegacyAutomaticCalories(session: CalorieSession, sets: readonly CalorieWorkoutSet[]): boolean {
  const raw = session.caloriesBurned;
  if (raw == null) return true;
  if (raw === 0) return false; // Unknown legacy manual zero must not silently become an automatic estimate.
  const duration = session.duration;
  if (duration == null || !Number.isFinite(duration) || duration < 0) return false;
  const volumes = [workoutVolume(sets), session.totalVolume ?? 0];
  return volumes.some(volume => {
    const met = volume > 5000 ? 6 : volume > 2000 ? 5.5 : 5;
    return Math.abs(raw - Math.round(met * 70 * duration / 60)) <= 0.01;
  });
}
export function buildWorkoutCalorieReadModel<T extends CalorieSession>(
  session: T, sets: readonly CalorieWorkoutSet[], weights: readonly WeightRecord[] = [], profileWeight?: number | null,
) {
  const stored = detailsOf(session);
  const date = session.startTime ? sessionHKDate(session.startTime) : "";
  const weight = stored?.weightSource === "session_override"
    ? { bodyWeightKg: stored.bodyWeightKg, weightSource: stored.weightSource, weightDate: stored.weightDate }
    : selectWorkoutWeight(date, weights, profileWeight);
  const legacyAuto = !stored && isLegacyAutomaticCalories(session, sets);
  const manual = stored ? stored.manualCalories ?? null : !legacyAuto ? session.caloriesBurned : null;
  const details = estimateWorkoutCalories({
    sets, sessionDate: date, ...weight, intensity: stored?.intensity ?? "moderate",
    verifiedDurationMinutes: stored?.timing.verifiedDurationMinutes,
    availableMinutes: stored?.timing.availableMinutes,
    manualCalories: manual, mode: stored?.timing.mode ?? "historical", tolerateInvalid: true,
  });
  details.origin = stored?.origin ?? (stored ? "new" : "legacy");
  details.timing.finished = stored?.timing.finished ?? !!session.endTime;
  details.rawOriginalCalories = stored ? stored.rawOriginalCalories ?? null : session.caloriesBurned ?? null;
  if (!stored) {
    details.warnings.push(legacyAuto
      ? "舊版固定 70 kg／訓練量加成估算已在讀取時修正；原始數值保留，資料庫未回填。"
      : "舊紀錄缺少熱量來源，未能確認是估算或手動值；原始熱量保留，請確認來源。");
    if ((session.duration ?? 0) > 180) details.warnings.push("舊紀錄包含多小時／跨日時間，已忽略牆鐘時長，只使用已記錄活動。");
  }
  const calorieReadModel = manual != null ? "manual_preserved" as const : !stored || stored.origin === "legacy" ? "corrected_legacy" as const : "current" as const;
  return {
    ...session,
    rawOriginalCalories: details.rawOriginalCalories,
    rawCaloriesBurned: session.caloriesBurned ?? null,
    rawDuration: session.duration ?? null,
    caloriesBurned: details.activeKcal,
    duration: stored?.timing.verifiedDurationMinutes ?? Math.round(details.effectiveMinutes),
    totalVolume: workoutVolume(sets),
    calorieDetails: details,
    calorieEstimate: calorieEstimateSummary(details),
    calorieReadModel,
  };
}
/** Batch getter used by every workout calorie consumer; it performs NO writes, including legacy correction. */
export async function getWorkoutCalorieReadModels<T extends CalorieSession>(db: Db, sessions: T[], userId: number) {
  if (!sessions.length) return [];
  const ids = sessions.map(session => session.id);
  const [sets, weights, profiles] = await Promise.all([
    db.select().from(workoutSets).where(inArray(workoutSets.sessionId, ids)),
    db.select({ id: bodyComposition.id, date: bodyComposition.date, weight: bodyComposition.weight })
      .from(bodyComposition).where(eq(bodyComposition.userId, userId)).orderBy(desc(bodyComposition.date)),
    db.select().from(userProfile).where(eq(userProfile.userId, userId)).limit(1),
  ]);
  const grouped = new Map<number, CalorieWorkoutSet[]>();
  for (const set of sets) { const rows = grouped.get(set.sessionId) ?? []; rows.push(set); grouped.set(set.sessionId, rows); }
  const profileWeight = (profiles[0] as { weight?: number | null } | undefined)?.weight;
  return sessions.map(session => buildWorkoutCalorieReadModel(session, grouped.get(session.id) ?? [], weights, profileWeight));
}
export async function requireWorkoutSession(db: Db, id: number, userId: number) {
  const [session] = await db.select().from(workoutSessions).where(and(eq(workoutSessions.id, id), eq(workoutSessions.userId, userId))).limit(1);
  if (!session) throw new Error("找不到訓練紀錄。");
  return session;
}
export async function requireWorkoutSet(db: Db, id: number, userId: number) {
  const [row] = await db.select({ set: workoutSets }).from(workoutSets)
    .innerJoin(workoutSessions, eq(workoutSets.sessionId, workoutSessions.id))
    .where(and(eq(workoutSets.id, id), eq(workoutSessions.userId, userId))).limit(1);
  if (!row) throw new Error("找不到此用戶的訓練組。");
  return row.set;
}
export async function validateWorkoutSetChange(db: Db, session: CalorieSession, change: CalorieWorkoutSet, replaceId?: number) {
  estimateWorkoutCalories({ sets: [change] });
  const stored = detailsOf(session);
  if (stored?.origin !== "new") return; // Legacy corrupt sets cannot prevent correcting an individual record.
  const existing = await db.select().from(workoutSets).where(eq(workoutSets.sessionId, session.id));
  const proposed = replaceId == null ? [...existing, change] : existing.map(set => set.id === replaceId ? change : set);
  estimateWorkoutCalories({ sets: proposed, bodyWeightKg: stored.bodyWeightKg, intensity: stored.intensity,
    verifiedDurationMinutes: stored.timing.verifiedDurationMinutes, manualCalories: stored.manualCalories });
}
/** Refresh only versioned new sessions. Legacy estimates stay read-only; volume is maintained for every session. */
export async function refreshWorkoutSessionCalories(db: Db, id: number, userId: number) {
  const session = await requireWorkoutSession(db, id, userId);
  const [model] = await getWorkoutCalorieReadModels(db, [session], userId);
  const update: Record<string, unknown> = { totalVolume: model.totalVolume, updatedAt: new Date() };
  if (detailsOf(session)?.origin === "new") {
    update.caloriesBurned = model.caloriesBurned;
    update.calorieDetails = model.calorieDetails;
    update.duration = model.duration;
  }
  await db.update(workoutSessions).set(update).where(and(eq(workoutSessions.id, id), eq(workoutSessions.userId, userId)));
  return model;
}
export function planWorkoutCreation(input: ReviewedWorkoutTiming & { date: string }, now = new Date()) {
  const date = validateSessionDate(input.date, now);
  const mode = date === sessionHKDate(now) ? "live" as const : "historical" as const;
  const startTime = input.startTime ? parseWorkoutTimestamp(input.startTime) : mode === "live" ? now : new Date(`${date}T12:00:00+08:00`);
  if (sessionHKDate(startTime) !== date) throw new Error("開始時間與香港訓練日期不一致，請確認時區。");
  if (startTime > now) throw new Error("訓練開始時間不能在未來。");
  const endTime = input.endTime ? parseWorkoutTimestamp(input.endTime) : null;
  let verified = input.duration == null ? null : validateWorkoutMinutes(input.duration);
  if (endTime) {
    if (!input.startTime) throw new Error("請同時輸入實際開始及結束時間；歷史日期中午只是日期標記。");
    if (endTime > now) throw new Error("訓練結束時間不能在未來。");
    const elapsed = validateWorkoutMinutes((endTime.getTime() - startTime.getTime()) / 60000);
    if (verified != null && Math.abs(verified - elapsed) > 1) throw new Error("分鐘與開始／結束時間不一致，請核對實際訓練時間。");
    verified ??= elapsed;
  }
  if (input.bodyWeightKg != null) validateBodyWeight(input.bodyWeightKg);
  const details = estimateWorkoutCalories({ sets: [], sessionDate: date, mode, intensity: input.intensity,
    bodyWeightKg: input.bodyWeightKg, weightSource: input.bodyWeightKg != null ? "session_override" : undefined,
    verifiedDurationMinutes: verified });
  details.origin = "new"; details.timing.finished = !!endTime; details.rawOriginalCalories = null;
  return { startTime, endTime, duration: verified == null ? 0 : Math.round(verified), caloriesBurned: 0, calorieDetails: details };
}
/** Pure safe finish plan: no wallclock-calorie conversion and repeat finish is idempotent. */
export function planWorkoutFinish(session: CalorieSession, input: ReviewedWorkoutTiming, now = new Date()) {
  const stored = detailsOf(session);
  if (stored?.timing.finished || session.endTime) return { alreadyFinished: true as const };
  if (!session.startTime && !input.startTime) throw new Error("缺少開始時間，請輸入實際开始時間及訓練分鐘。");
  const startTime = input.startTime ? parseWorkoutTimestamp(input.startTime) : new Date(session.startTime!);
  const date = sessionHKDate(startTime);
  validateSessionDate(date, now);
  if (startTime > now) throw new Error("開始時間在未來，請確認實際開始時間及香港日期。");
  const mode = stored?.timing.mode ?? "historical";
  let verified = input.duration == null ? stored?.timing.verifiedDurationMinutes ?? null : validateWorkoutMinutes(input.duration);
  let endTime: Date;
  let available: number | null = null;
  if (input.endTime) {
    endTime = parseWorkoutTimestamp(input.endTime);
    if (mode === "historical" && !input.startTime) throw new Error("歷史紀錄請同時輸入實際開始與結束時間，或只輸入已確認分鐘。");
    if (endTime > now) throw new Error("結束時間在未來，請確認實際時間。");
    const elapsed = validateWorkoutMinutes((endTime.getTime() - startTime.getTime()) / 60000);
    if (verified != null && Math.abs(verified - elapsed) > 1) throw new Error("分鐘與開始／結束時間不一致，請核對實際訓練時間。");
    verified ??= elapsed; available = elapsed;
  } else if (verified != null) {
    // Historical noon is only a date anchor. Never subtract it from today's clock.
    endTime = mode === "live" && date === sessionHKDate(now)
      ? now : new Date(startTime.getTime() + verified * 60000);
    if (endTime > now) throw new Error("所填訓練分鐘會使結束時間落在未來，請確認時間。");
  } else {
    if (mode === "historical" || date !== sessionHKDate(now)) throw new Error("歷史／跨日訓練不可直接使用現在時間完成；請輸入實際訓練分鐘或開始／結束時間。");
    endTime = now;
    available = validateWorkoutMinutes((endTime.getTime() - startTime.getTime()) / 60000);
  }
  if (input.bodyWeightKg != null) validateBodyWeight(input.bodyWeightKg);
  return { alreadyFinished: false as const, startTime, endTime, verifiedDurationMinutes: verified, availableMinutes: available,
    intensity: input.intensity ?? stored?.intensity ?? "moderate", bodyWeightKg: input.bodyWeightKg, mode };
}
export async function finishWorkoutSession(db: Db, id: number, userId: number, input: ReviewedWorkoutTiming, now = new Date()) {
  const session = await requireWorkoutSession(db, id, userId);
  const plan = planWorkoutFinish(session, input, now);
  const sets = await db.select().from(workoutSets).where(eq(workoutSets.sessionId, id));
  if (plan.alreadyFinished) {
    const [model] = await getWorkoutCalorieReadModels(db, [session], userId);
    return { success: true, alreadyFinished: true, duration: model.duration, caloriesBurned: model.caloriesBurned,
      totalVolume: model.totalVolume, exerciseCount: new Set(sets.map(set => set.exerciseName ?? set.exerciseId)).size,
      calorieEstimate: model.calorieEstimate, session: model };
  }
  const prior = detailsOf(session);
  const timingDetails = prior ?? estimateWorkoutCalories({ sets: [], mode: plan.mode });
  const candidate = { ...session, startTime: plan.startTime, endTime: plan.endTime,
    calorieDetails: { ...timingDetails, intensity: plan.intensity, origin: prior?.origin ?? "legacy" as const,
      timing: { mode: plan.mode, verifiedDurationMinutes: plan.verifiedDurationMinutes, availableMinutes: plan.availableMinutes, finished: true },
      ...(plan.bodyWeightKg != null ? { bodyWeightKg: plan.bodyWeightKg, weightSource: "session_override" as const } : {}),
      manualCalories: prior?.manualCalories ?? (!prior && !isLegacyAutomaticCalories(session, sets) ? session.caloriesBurned : null),
      rawOriginalCalories: prior?.rawOriginalCalories ?? session.caloriesBurned ?? null,
    } };
  const [model] = await getWorkoutCalorieReadModels(db, [candidate], userId);
  // Strictly validate new reviewed inputs and set minutes before changing health data.
  estimateWorkoutCalories({ sets, sessionDate: model.calorieDetails.sessionDate, bodyWeightKg: model.calorieDetails.bodyWeightKg,
    weightSource: model.calorieDetails.weightSource, intensity: model.calorieDetails.intensity,
    verifiedDurationMinutes: plan.verifiedDurationMinutes, availableMinutes: plan.availableMinutes,
    manualCalories: model.calorieDetails.manualCalories });
  const update: Record<string, unknown> = { startTime: plan.startTime, endTime: plan.endTime, totalVolume: model.totalVolume, updatedAt: now };
  if (prior?.origin === "new") {
    update.duration = model.duration; update.caloriesBurned = model.caloriesBurned; update.calorieDetails = model.calorieDetails;
  }
  else if (input.duration != null || input.startTime != null || input.endTime != null || input.intensity != null || input.bodyWeightKg != null) {
    // User-confirmed legacy timing/intensity is provenance, not an automatic backfill.
    // Keep raw DB calories/duration intact; reads derive from the reviewed metadata.
    update.calorieDetails = model.calorieDetails;
  }
  await db.update(workoutSessions).set(update).where(and(eq(workoutSessions.id, id), eq(workoutSessions.userId, userId)));
  return { success: true, alreadyFinished: false, duration: model.duration, caloriesBurned: model.caloriesBurned,
    totalVolume: model.totalVolume, exerciseCount: new Set(sets.map(set => set.exerciseName ?? set.exerciseId)).size,
    calorieEstimate: model.calorieEstimate, session: model };
}

export async function updateWorkoutSession(db: Db, id: number, userId: number, input: ReviewedWorkoutTiming & {
  name?: string; notes?: string; location?: string; totalVolume?: number;
  caloriesBurned?: number; clearManualCalories?: boolean;
}, now = new Date()) {
  const session = await requireWorkoutSession(db, id, userId);
  const prior = detailsOf(session);
  const sets = await db.select().from(workoutSets).where(eq(workoutSets.sessionId, id));
  const startTime = input.startTime ? parseWorkoutTimestamp(input.startTime) : new Date(session.startTime);
  validateSessionDate(sessionHKDate(startTime), now);
  if (startTime > now) throw new Error("開始時間不能在未來。");
  const endTime = input.endTime ? parseWorkoutTimestamp(input.endTime) : session.endTime ? new Date(session.endTime) : null;
  let verified = input.duration == null ? prior?.timing.verifiedDurationMinutes ?? null : validateWorkoutMinutes(input.duration);
  if (input.startTime || input.endTime) {
    if (endTime) {
      if (endTime > now) throw new Error("結束時間不能在未來。");
      const elapsed = validateWorkoutMinutes((endTime.getTime() - startTime.getTime()) / 60000);
      if (input.duration != null && Math.abs(input.duration - elapsed) > 1) throw new Error("分鐘與開始／結束時間不一致，請核對時間。");
      verified = input.duration ?? elapsed;
    }
  }
  if (input.bodyWeightKg != null) validateBodyWeight(input.bodyWeightKg);
  if (input.caloriesBurned != null && input.clearManualCalories) throw new Error("請選擇手動熱量或清除手動熱量，不可同時提交。");
  const manual = input.clearManualCalories ? null : input.caloriesBurned ?? prior?.manualCalories
    ?? (!prior && !isLegacyAutomaticCalories(session, sets) ? session.caloriesBurned : null);
  const base = prior ?? estimateWorkoutCalories({ sets: [], mode: "historical" });
  const candidate = { ...session, startTime, endTime, calorieDetails: {
    ...base, origin: prior?.origin ?? "legacy" as const,
    intensity: input.intensity ?? base.intensity, manualCalories: manual,
    rawOriginalCalories: prior?.rawOriginalCalories ?? session.caloriesBurned ?? null,
    timing: { ...base.timing, verifiedDurationMinutes: verified, finished: base.timing.finished || !!endTime },
    ...(input.bodyWeightKg != null ? { bodyWeightKg: input.bodyWeightKg, weightSource: "session_override" as const } : {}),
  } };
  const [model] = await getWorkoutCalorieReadModels(db, [candidate], userId);
  estimateWorkoutCalories({ sets, sessionDate: model.calorieDetails.sessionDate,
    bodyWeightKg: model.calorieDetails.bodyWeightKg, weightSource: model.calorieDetails.weightSource,
    intensity: model.calorieDetails.intensity, verifiedDurationMinutes: verified, manualCalories: manual });
  const update: Record<string, unknown> = { totalVolume: model.totalVolume, updatedAt: now };
  for (const key of ["name", "notes", "location"] as const) if (input[key] !== undefined) update[key] = input[key];
  if (input.startTime) update.startTime = startTime;
  if (input.endTime) update.endTime = endTime;
  const explicitCorrection = input.duration != null || input.startTime != null || input.endTime != null || input.caloriesBurned != null || input.clearManualCalories || input.intensity != null || input.bodyWeightKg != null;
  if (prior?.origin === "new" || explicitCorrection) {
    // Explicit user correction is not an automatic migration/backfill. Preserve original evidence in metadata.
    update.duration = model.duration; update.caloriesBurned = model.caloriesBurned; update.calorieDetails = model.calorieDetails;
  }
  await db.update(workoutSessions).set(update).where(and(eq(workoutSessions.id, id), eq(workoutSessions.userId, userId)));
  return { success: true, session: { ...model, ...input, caloriesBurned: model.caloriesBurned }, calorieEstimate: model.calorieEstimate };
}
