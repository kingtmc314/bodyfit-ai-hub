import { and, asc, eq, lt, gte, or, sql } from "drizzle-orm";
import {
  customExercises,
  exercises,
  workoutSessions,
  workoutSets,
} from "../drizzle/schema";
import {
  getExerciseMuscles,
  type ExerciseMuscles,
} from "../shared/exerciseMuscles";
import { CARDIO_EXERCISE_NAMES } from "../shared/workoutCalories";
import {
  getMuscleAnalysisBounds,
  muscleAnalysisHKDate,
  type MuscleAnalysisInput,
  type MuscleAnalysisRow,
  type MuscleAnalysisWarning,
  type UnmappedMuscleSource,
  type WorkoutMuscleAnalysis,
} from "../shared/workoutMuscleAnalytics";
import type { getDb } from "./db";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
export interface MuscleAnalyticsSession {
  id: number;
  startTime: Date | string;
  endTime?: Date | string | null;
  finished?: boolean;
}
export interface MuscleAnalyticsSet {
  id: number;
  sessionId: number;
  exerciseId?: number | null;
  exerciseName?: string | null;
  reps?: number | null;
  weight?: number | null;
  /** Saved duration is minutes, including explicitly timed strength work. */
  duration?: number | null;
}
export interface MuscleAnalyticsExercise {
  id: number;
  name: string;
  nameZh?: string | null;
  muscleGroup?: string | null;
  category?: string | null;
  equipment?: string | null;
  source: "exercises" | "custom_exercises";
  isCustom?: boolean;
}
const PAGE_SIZE = 500;
const normalize = (value: string | null | undefined) =>
  (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
const knownMuscles = new Set([
  "chest",
  "back",
  "lats",
  "shoulders",
  "biceps",
  "triceps",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "abs",
  "obliques",
  "traps",
  "forearms",
  "adductors",
  "abductors",
  "glute_medius",
  "lower_back",
]);
const knownActivityCategories = new Set([
  "strength",
  "resistance",
  "cardio",
  "bodyweight",
]);
const cardioNames = new Set<string>(CARDIO_EXERCISE_NAMES.map(normalize));
const validNumber = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
const positive = (value: number | null | undefined): value is number =>
  validNumber(value) && value > 0;
const percent = (numerator: number, denominator: number) =>
  denominator > 0 ? (numerator / denominator) * 100 : 0;

function exerciseIndex(catalog: readonly MuscleAnalyticsExercise[]) {
  const ids = new Map<number, MuscleAnalyticsExercise>();
  const names = new Map<string, MuscleAnalyticsExercise>();
  // Name collisions prefer the owner's custom entry; actual persisted exercises.id always wins.
  const ordered = [...catalog].sort(
    (a, b) =>
      Number(a.source === "custom_exercises" || a.isCustom) -
        Number(b.source === "custom_exercises" || b.isCustom) || a.id - b.id
  );
  for (const exercise of ordered) {
    if (exercise.source === "exercises") ids.set(exercise.id, exercise);
    names.set(normalize(exercise.name), exercise);
    if (exercise.nameZh) names.set(normalize(exercise.nameZh), exercise);
  }
  return { ids, names };
}
function resolveSet(
  set: MuscleAnalyticsSet,
  index: ReturnType<typeof exerciseIndex>
) {
  const metadata =
    (set.exerciseId != null ? index.ids.get(set.exerciseId) : undefined) ??
    index.names.get(normalize(set.exerciseName));
  const muscleGroup = normalize(metadata?.muscleGroup);
  const category = normalize(metadata?.category);
  // Canonical exercise mapping outranks a persisted broad/miscategorized muscle group.
  // Keep this boundary shared with the anatomical viewer; do not duplicate its mapping table.
  const candidates = [metadata?.name, set.exerciseName].filter(
    (name): name is string => !!name
  );
  let muscles: ExerciseMuscles = {
    primary: [],
    secondary: [],
    basis: "category",
  };
  for (const name of candidates) {
    const result = getExerciseMuscles({
      name: name.trim().replace(/\s+/g, " "),
      muscleGroup,
      equipment: metadata?.equipment ?? undefined,
    });
    if (result.basis === "exercise") {
      muscles = result;
      break;
    }
  }
  if (
    muscles.basis !== "exercise" &&
    (knownMuscles.has(muscleGroup) || muscleGroup === "core")
  ) {
    muscles = getExerciseMuscles({
      name: metadata?.name ?? set.exerciseName ?? "",
      muscleGroup,
      equipment: metadata?.equipment ?? undefined,
    });
  }
  const primary = Array.from(new Set(muscles.primary.filter(Boolean)));
  const secondary = Array.from(
    new Set(
      muscles.secondary.filter(muscle => !!muscle && !primary.includes(muscle))
    )
  );
  const canonicalStrength = muscles.basis === "exercise" && primary.length > 0;
  const isCardio =
    !canonicalStrength &&
    (cardioNames.has(normalize(metadata?.name)) ||
      cardioNames.has(normalize(set.exerciseName)) ||
      category === "cardio" ||
      muscleGroup === "cardio");
  // Duration alone does not imply cardio: unmapped timed work stays unclassified.
  const kind = isCardio
    ? "cardio"
    : primary.length ||
        ["strength", "resistance", "bodyweight"].includes(category) ||
        positive(set.reps)
      ? "strength"
      : "unclassified";
  return { metadata, muscles, primary, secondary, kind, muscleGroup, category };
}

/** Pure aggregation of saved rows: never reads cached session totals, modifies rows or estimates physiology. */
export function buildWorkoutMuscleAnalysis(
  input: MuscleAnalysisInput,
  sessions: readonly MuscleAnalyticsSession[],
  sets: readonly MuscleAnalyticsSet[],
  catalog: readonly MuscleAnalyticsExercise[] = []
): WorkoutMuscleAnalysis {
  const bounds = getMuscleAnalysisBounds(input);
  const selected = new Map<number, MuscleAnalyticsSession>();
  for (const session of sessions) {
    const time = new Date(session.startTime).getTime();
    if (!Number.isFinite(time)) continue;
    if (bounds.startTimeInclusive && time < bounds.startTimeInclusive.getTime())
      continue;
    if (bounds.endTimeExclusive && time >= bounds.endTimeExclusive.getTime())
      continue;
    selected.set(session.id, session);
  }
  const selectedSessions = Array.from(selected.values());
  const dates = selectedSessions
    .map(session => muscleAnalysisHKDate(session.startTime))
    .sort();
  const result: WorkoutMuscleAnalysis = {
    period: input.period,
    anchorDate: input.anchorDate,
    timeZone: "Asia/Hong_Kong",
    weekStartsOn: "monday",
    range:
      input.period === "all"
        ? { startDate: dates[0] ?? null, endDate: dates.at(-1) ?? null }
        : bounds.range,
    sessionCount: selected.size,
    completedSessionCount: selectedSessions.filter(
      session => session.finished === true || !!session.endTime
    ).length,
    setCount: 0,
    totalReps: 0,
    totalVolumeKg: 0,
    strengthSetCount: 0,
    cardioSetCount: 0,
    unclassifiedSetCount: 0,
    strengthVolumeKg: 0,
    cardioVolumeKg: 0,
    unclassifiedVolumeKg: 0,
    mappedVolumeKg: 0,
    unmappedVolumeKg: 0,
    unattributedVolumeKg: 0,
    timedStrengthSetCount: 0,
    timedStrengthMinutes: 0,
    bodyweightSetCount: 0,
    missingWeightSetCount: 0,
    muscles: [],
    coverage: {
      mappedStrengthSetCount: 0,
      exerciseMappedSetCount: 0,
      categoryMappedSetCount: 0,
      unmappedSetCount: 0,
      unmappedSourceCount: 0,
      mappedSetCoveragePct: 0,
      mappedVolumeCoveragePct: 0,
      weightedSetCount: 0,
      unweightedStrengthSetCount: 0,
      invalidValueSetCount: 0,
    },
    unmappedSources: [],
    warnings: [],
    definitions: {
      volume:
        "Each saved set's finite non-negative external weight (kg) × valid positive integer reps, counted once. Missing loads and timed/bodyweight work are not assigned an estimated kg load.",
      directAttribution:
        "Logged strength volume is divided equally between the exercise's primary muscles. directVolumeSharePct divides by ALL logged valid kg volume; unmapped/cardio work can leave the muscle shares below 100%. This is attribution, not measured activation, growth or fatigue.",
      primarySets:
        "primarySetCount counts each saved strength set for every named primary muscle and can overlap. allocatedPrimarySetCount divides each set equally among primaries; primarySetSharePct divides allocated sets by ALL strength sets.",
      secondaryParticipation:
        "secondarySetCount records involvement only, excluding primary muscles. Per-muscle combined participation is primarySetCount + secondarySetCount, divided by ALL strength sets for its percentage. Primary and secondary duplicates are removed per set. Counts and percentages overlap across muscles and must not be summed as unique overall sets or merged into direct volume; setCount and totalVolumeKg count each saved set once.",
      coverage:
        "Mapped-set coverage is mapped strength sets / all strength sets; mapped-volume coverage is allocated strength volume / all logged valid volume. Explicit zero load counts as zero external load, not a measurement of body mass moved. Null load is missing, not assumed bodyweight. Timed strength duration is saved minutes only.",
      completedSessions:
        "Saved endTime or explicit saved timing.finished=true. Sessions without either remain included; no completion is inferred from age or set count.",
      scope:
        "All saved sets in every owner gym session whose startTime falls in the selected HK calendar range, including incomplete sessions and warm-up sets. All-history ignores anchorDate as a cutoff and covers every saved session. No running or step records are included.",
    },
  };
  const index = exerciseIndex(catalog);
  const rows = new Map<string, MuscleAnalysisRow>();
  const unknown = new Map<string, UnmappedMuscleSource>();
  const warnings = new Map<string, MuscleAnalysisWarning>();
  const warn = (warning: MuscleAnalysisWarning) => {
    const key = JSON.stringify([
      warning.code,
      warning.rawCategory,
      warning.exerciseName,
    ]);
    const existing = warnings.get(key);
    if (existing) existing.setCount += warning.setCount;
    else warnings.set(key, { ...warning });
  };
  const row = (muscle: string) => {
    let value = rows.get(muscle);
    if (!value) {
      value = {
        muscle,
        directVolumeKg: 0,
        primarySetCount: 0,
        allocatedPrimarySetCount: 0,
        secondarySetCount: 0,
        directTimedMinutes: 0,
        directVolumeSharePct: 0,
        primarySetSharePct: 0,
        secondaryParticipationPct: 0,
      };
      rows.set(muscle, value);
    }
    return value;
  };
  const seen = new Set<number>();
  for (const set of sets) {
    if (!selected.has(set.sessionId) || seen.has(set.id)) continue;
    seen.add(set.id);
    result.setCount++;
    const validReps = positive(set.reps) && Number.isInteger(set.reps);
    const product =
      validReps && validNumber(set.weight) ? set.reps! * set.weight : 0;
    const volume = Number.isFinite(product) ? product : 0;
    if (validReps) result.totalReps += set.reps!;
    result.totalVolumeKg += volume;
    const invalid =
      (set.reps != null &&
        (!validNumber(set.reps) || !Number.isInteger(set.reps))) ||
      (set.weight != null && !validNumber(set.weight)) ||
      (set.duration != null && !validNumber(set.duration)) ||
      !Number.isFinite(product);
    if (invalid) {
      result.coverage.invalidValueSetCount++;
      warn({
        code: "invalid_set_values",
        message:
          "Invalid recorded values were excluded from their respective totals; original saved records were not changed.",
        setCount: 1,
      });
    }
    const resolved = resolveSet(set, index);
    const { metadata, primary, secondary, kind, muscleGroup, category } =
      resolved;
    if (
      metadata?.muscleGroup &&
      muscleGroup !== "cardio" &&
      muscleGroup !== "core" &&
      !knownMuscles.has(muscleGroup)
    ) {
      warn({
        code: "unknown_muscle_category",
        message:
          "Unrecognized persisted muscle category; a canonical exercise mapping, when available, takes priority.",
        rawCategory: metadata.muscleGroup,
        exerciseName: set.exerciseName ?? metadata.name,
        setCount: 1,
      });
    }
    if (metadata?.category && !knownActivityCategories.has(category)) {
      warn({
        code: "unknown_activity_category",
        message:
          "Unrecognized persisted activity category; classification uses the exercise name, muscle mapping or recorded reps instead.",
        rawCategory: metadata.category,
        exerciseName: set.exerciseName ?? metadata.name,
        setCount: 1,
      });
    }
    if (kind === "cardio") {
      result.cardioSetCount++;
      result.cardioVolumeKg += volume;
      continue;
    }
    if (kind === "strength") {
      result.strengthSetCount++;
      result.strengthVolumeKg += volume;
      if (positive(set.weight) && validReps) result.coverage.weightedSetCount++;
      else result.coverage.unweightedStrengthSetCount++;
      if (set.weight == null) result.missingWeightSetCount++;
      if (
        set.weight === 0 ||
        ["bodyweight", "body weight"].includes(
          normalize(metadata?.equipment)
        ) ||
        category === "bodyweight"
      )
        result.bodyweightSetCount++;
      if (positive(set.duration)) {
        result.timedStrengthSetCount++;
        result.timedStrengthMinutes += set.duration;
      }
    } else {
      result.unclassifiedSetCount++;
      result.unclassifiedVolumeKg += volume;
    }
    if (kind === "strength" && primary.length) {
      result.coverage.mappedStrengthSetCount++;
      if (resolved.muscles.basis === "exercise")
        result.coverage.exerciseMappedSetCount++;
      else result.coverage.categoryMappedSetCount++;
      result.mappedVolumeKg += volume;
      for (const muscle of primary) {
        const value = row(muscle);
        value.directVolumeKg += volume / primary.length;
        value.primarySetCount++;
        value.allocatedPrimarySetCount += 1 / primary.length;
        if (positive(set.duration))
          value.directTimedMinutes += set.duration / primary.length;
      }
      for (const muscle of secondary) row(muscle).secondarySetCount++;
    } else {
      result.coverage.unmappedSetCount++;
      if (kind === "strength") result.unmappedVolumeKg += volume;
      const reason: UnmappedMuscleSource["reason"] =
        kind === "unclassified"
          ? "unclassified_activity"
          : metadata
            ? "unknown_muscle_category"
            : "missing_metadata";
      const source: UnmappedMuscleSource = {
        exerciseId: set.exerciseId ?? null,
        exerciseName: set.exerciseName ?? metadata?.name ?? null,
        muscleGroup: metadata?.muscleGroup ?? null,
        category: metadata?.category ?? null,
        reason,
        setCount: 1,
        volumeKg: volume,
      };
      const key = JSON.stringify([
        source.exerciseId,
        normalize(source.exerciseName),
        source.muscleGroup,
        source.category,
        reason,
      ]);
      const existing = unknown.get(key);
      if (existing) {
        existing.setCount++;
        existing.volumeKg += volume;
      } else unknown.set(key, source);
    }
  }
  result.unattributedVolumeKg =
    result.unmappedVolumeKg +
    result.cardioVolumeKg +
    result.unclassifiedVolumeKg;
  result.coverage.unmappedSourceCount = unknown.size;
  result.coverage.mappedSetCoveragePct = percent(
    result.coverage.mappedStrengthSetCount,
    result.strengthSetCount
  );
  result.coverage.mappedVolumeCoveragePct = percent(
    result.mappedVolumeKg,
    result.totalVolumeKg
  );
  for (const value of Array.from(rows.values())) {
    value.directVolumeSharePct = percent(
      value.directVolumeKg,
      result.totalVolumeKg
    );
    value.primarySetSharePct = percent(
      value.allocatedPrimarySetCount,
      result.strengthSetCount
    );
    value.secondaryParticipationPct = percent(
      value.secondarySetCount,
      result.strengthSetCount
    );
  }
  result.muscles = Array.from(rows.values()).sort(
    (a, b) =>
      b.directVolumeKg - a.directVolumeKg ||
      b.allocatedPrimarySetCount - a.allocatedPrimarySetCount ||
      a.muscle.localeCompare(b.muscle)
  );
  result.unmappedSources = Array.from(unknown.values()).sort(
    (a, b) =>
      b.setCount - a.setCount ||
      (a.exerciseName ?? "").localeCompare(b.exerciseName ?? "")
  );
  if (unknown.size)
    warn({
      code: "unmapped_sources",
      message:
        "Some saved non-cardio sets lack a primary muscle mapping; they remain in totals and coverage without being assigned to an invented muscle.",
      setCount: result.coverage.unmappedSetCount,
    });
  if (result.unattributedVolumeKg > 0)
    warn({
      code: "unattributed_volume",
      message:
        "Some logged kg volume is unmapped or non-strength work. Direct muscle shares therefore need not total 100%.",
      setCount: result.coverage.unmappedSetCount + result.cardioSetCount,
    });
  result.warnings = Array.from(warnings.values());
  return result;
}

/** Stable, bounded pages with no arbitrary all-history cutoff; no per-session or per-set metadata queries. */
async function readPages<T>(
  page: (offset: number) => PromiseLike<T[]>
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const batch = await page(offset);
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
  }
}
export async function getWorkoutMuscleAnalysis(
  db: Db,
  userId: number,
  input: MuscleAnalysisInput
): Promise<WorkoutMuscleAnalysis> {
  const bounds = getMuscleAnalysisBounds(input);
  const conditions = [eq(workoutSessions.userId, userId)];
  if (bounds.startTimeInclusive)
    conditions.push(gte(workoutSessions.startTime, bounds.startTimeInclusive));
  if (bounds.endTimeExclusive)
    conditions.push(lt(workoutSessions.startTime, bounds.endTimeExclusive));
  const sessions = await readPages(offset =>
    db
      .select({
        id: workoutSessions.id,
        startTime: workoutSessions.startTime,
        endTime: workoutSessions.endTime,
        finished: sql<boolean>`coalesce((${workoutSessions.calorieDetails}->'timing'->>'finished') = 'true', false)`,
      })
      .from(workoutSessions)
      .where(and(...conditions))
      .orderBy(asc(workoutSessions.id))
      .limit(PAGE_SIZE)
      .offset(offset)
  );
  if (!sessions.length) return buildWorkoutMuscleAnalysis(input, [], []);
  const [sets, persisted, custom] = await Promise.all([
    readPages(offset =>
      db
        .select({
          id: workoutSets.id,
          sessionId: workoutSets.sessionId,
          exerciseId: workoutSets.exerciseId,
          exerciseName: workoutSets.exerciseName,
          reps: workoutSets.reps,
          weight: workoutSets.weight,
          duration: workoutSets.duration,
        })
        .from(workoutSets)
        .innerJoin(
          workoutSessions,
          eq(workoutSessions.id, workoutSets.sessionId)
        )
        .where(and(...conditions))
        .orderBy(asc(workoutSets.id))
        .limit(PAGE_SIZE)
        .offset(offset)
    ),
    readPages(offset =>
      db
        .select({
          id: exercises.id,
          name: exercises.name,
          muscleGroup: exercises.muscleGroup,
          category: exercises.category,
          equipment: exercises.equipment,
          isCustom: exercises.isCustom,
        })
        .from(exercises)
        .where(or(eq(exercises.isCustom, false), eq(exercises.userId, userId)))
        .orderBy(asc(exercises.id))
        .limit(PAGE_SIZE)
        .offset(offset)
    ),
    readPages(offset =>
      db
        .select({
          id: customExercises.id,
          name: customExercises.name,
          nameZh: customExercises.nameZh,
          muscleGroup: customExercises.muscleGroup,
          equipment: customExercises.equipment,
        })
        .from(customExercises)
        .where(eq(customExercises.userId, userId))
        .orderBy(asc(customExercises.id))
        .limit(PAGE_SIZE)
        .offset(offset)
    ),
  ]);
  return buildWorkoutMuscleAnalysis(input, sessions, sets, [
    ...persisted.map(exercise => ({
      ...exercise,
      source: "exercises" as const,
    })),
    ...custom.map(exercise => ({
      ...exercise,
      source: "custom_exercises" as const,
    })),
  ]);
}
