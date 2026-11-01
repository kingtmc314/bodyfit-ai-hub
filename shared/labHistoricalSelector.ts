export type LabScenario = "100m" | "200m" | "400m" | "800m" | "1500m" | "3000m" | "easy";
export type LabEasyDistance = "10K" | "Half Marathon" | "Marathon";

export type LabHistoricalRun = {
  id?: number;
  date?: string;
  runningType?: string | null;
  routeType?: string | null;
  distanceKm?: number | null;
  paceSecPerKm?: number | null;
  averageHeartRate?: number | null;
  maximumHeartRate?: number | null;
};

export type LabHistorySelection = {
  selectedRuns: LabHistoricalRun[];
  consideredCount: number;
  eligibleCount: number;
  excludedTrailCount: number;
  excludedDistanceCount: number;
  fallback: "none" | "type-and-surface" | "distance-and-surface" | "non-trail-history" | "all-valid-history" | "reference";
  ruleLabel: string;
  fallbackReason: string | null;
  selectedTypeDistribution: Array<{ type: string; count: number }>;
  baselinePaceSecPerKm: number | null;
};

type ScenarioRule = {
  label: string;
  typeTerms: readonly string[];
  minDistance: number;
  maxDistance: number;
  surfaces: readonly string[];
};

const normalise = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();
const isTrail = (run: LabHistoricalRun) => normalise(run.routeType) === "trail" || normalise(run.runningType).includes("trail");
const hasPaceAndDistance = (run: LabHistoricalRun) => {
  const pace = Number(run.paceSecPerKm);
  const distance = Number(run.distanceKm);
  return Number.isFinite(pace) && pace >= 120 && pace <= 1800 && Number.isFinite(distance) && distance > 0;
};

function getScenarioRule(scenario: LabScenario, easyDistance: LabEasyDistance): ScenarioRule {
  if (scenario === "100m" || scenario === "200m") return {
    label: "短衝刺：Sprint／Interval／Time Trial，跑道或公路，0.05–3 km",
    typeTerms: ["sprint", "interval", "time trial"], minDistance: 0.05, maxDistance: 3, surfaces: ["track", "road"],
  };
  if (scenario === "400m") return {
    label: "400m：Sprint／Interval／Time Trial，跑道或公路，0.1–5 km",
    typeTerms: ["sprint", "interval", "time trial"], minDistance: 0.1, maxDistance: 5, surfaces: ["track", "road"],
  };
  if (scenario === "800m") return {
    label: "800m：Interval／Tempo／Fartlek／短賽，跑道或公路，0.4–8 km",
    typeTerms: ["interval", "tempo", "fartlek", "race"], minDistance: 0.4, maxDistance: 8, surfaces: ["track", "road"],
  };
  if (scenario === "1500m") return {
    label: "1500m：Interval／Tempo／Fartlek／賽事，跑道或公路，0.8–10 km",
    typeTerms: ["interval", "tempo", "fartlek", "race"], minDistance: 0.8, maxDistance: 10, surfaces: ["track", "road"],
  };
  if (scenario === "3000m") return {
    label: "3000m：Tempo／Interval／Fartlek／賽事，跑道或公路，1.5–12 km",
    typeTerms: ["tempo", "interval", "fartlek", "race"], minDistance: 1.5, maxDistance: 12, surfaces: ["track", "road"],
  };
  if (easyDistance === "10K") return {
    label: "10K：Easy／Long Run／Recovery／公路賽，非越野，5–15 km",
    typeTerms: ["easy", "long", "recovery", "race"], minDistance: 5, maxDistance: 15, surfaces: ["road", "treadmill", "mixed", "track"],
  };
  if (easyDistance === "Half Marathon") return {
    label: "半馬：Long Run／Easy／公路賽，非越野，12–30 km",
    typeTerms: ["long", "easy", "race"], minDistance: 12, maxDistance: 30, surfaces: ["road", "treadmill", "mixed", "track"],
  };
  return {
    label: "全馬：Long Run／Easy／公路賽，非越野，18 km 或以上",
    typeTerms: ["long", "easy", "race"], minDistance: 18, maxDistance: Number.POSITIVE_INFINITY, surfaces: ["road", "treadmill", "mixed", "track"],
  };
}

function matchesType(run: LabHistoricalRun, rule: ScenarioRule) {
  const type = normalise(run.runningType);
  return rule.typeTerms.some(term => type.includes(term));
}

function matchesSurface(run: LabHistoricalRun, rule: ScenarioRule) {
  const route = normalise(run.routeType);
  // Older data may not have a route type; it remains usable only as a fallback, never as exact evidence.
  return rule.surfaces.includes(route);
}

function matchesDistance(run: LabHistoricalRun, rule: ScenarioRule) {
  const distance = Number(run.distanceKm);
  return distance >= rule.minDistance && distance <= rule.maxDistance;
}

function distribution(runs: LabHistoricalRun[]) {
  const counts = new Map<string, number>();
  for (const run of runs) {
    const label = run.runningType?.trim() || "未分類";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([type, count]) => ({ type, count }));
}

function averagePace(runs: LabHistoricalRun[]) {
  const paces = runs.map(run => Number(run.paceSecPerKm)).filter((pace): pace is number => Number.isFinite(pace));
  return paces.length ? paces.reduce((sum, pace) => sum + pace, 0) / paces.length : null;
}

/**
 * Considers the entire valid history, but selects only exercise evidence compatible
 * with the requested event. It favours exact type + terrain + distance matching and
 * falls back transparently when the athlete has not recorded an exact analogue.
 */
export function selectLabHistoricalRuns(
  history: LabHistoricalRun[],
  scenario: LabScenario,
  easyDistance: LabEasyDistance,
): LabHistorySelection {
  const rule = getScenarioRule(scenario, easyDistance);
  const valid = history.filter(hasPaceAndDistance);
  const nonTrail = valid.filter(run => !isTrail(run));
  const excludedTrailCount = valid.length - nonTrail.length;
  const exact = nonTrail.filter(run => matchesType(run, rule) && matchesSurface(run, rule) && matchesDistance(run, rule));
  const typeAndSurface = nonTrail.filter(run => matchesType(run, rule) && matchesSurface(run, rule));
  const distanceAndSurface = nonTrail.filter(run => matchesDistance(run, rule) && matchesSurface(run, rule));
  const excludedDistanceCount = nonTrail.filter(run => matchesType(run, rule) && !matchesDistance(run, rule)).length;

  let selectedRuns = exact;
  let fallback: LabHistorySelection["fallback"] = "none";
  let fallbackReason: string | null = null;
  if (!selectedRuns.length && typeAndSurface.length) {
    selectedRuns = typeAndSurface;
    fallback = "type-and-surface";
    fallbackReason = "暫未有相同距離區間，改用相同訓練類型及路面。";
  } else if (!selectedRuns.length && distanceAndSurface.length) {
    selectedRuns = distanceAndSurface;
    fallback = "distance-and-surface";
    fallbackReason = "暫未有相同訓練類型，改用相同距離區間及路面。";
  } else if (!selectedRuns.length && nonTrail.length) {
    selectedRuns = nonTrail;
    fallback = "non-trail-history";
    fallbackReason = "暫未有相符項目；僅以非越野歷史跑步作保守校準。";
  } else if (!selectedRuns.length && valid.length) {
    selectedRuns = valid;
    fallback = "all-valid-history";
    fallbackReason = "只有未標示路線的歷史資料；已採最保守的全量校準。";
  } else if (!selectedRuns.length) {
    fallback = "reference";
    fallbackReason = "尚未有可用配速及距離的歷史跑步，使用參考值。";
  }

  return {
    selectedRuns,
    consideredCount: valid.length,
    eligibleCount: exact.length,
    excludedTrailCount,
    excludedDistanceCount,
    fallback,
    ruleLabel: rule.label,
    fallbackReason,
    selectedTypeDistribution: distribution(selectedRuns),
    baselinePaceSecPerKm: averagePace(selectedRuns),
  };
}
