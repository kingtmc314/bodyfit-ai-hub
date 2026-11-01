export type GarminRouteSample = {
  elapsedSec?: unknown;
  distanceKm?: unknown;
  altitudeM?: unknown;
  latitude?: unknown;
  longitude?: unknown;
};

export type RoutePoint = {
  elapsedSec: number;
  distanceKm: number;
  altitudeM?: number;
  latitude: number;
  longitude: number;
};

export type GradientBand = "陡下坡" | "下坡" | "平路" | "上坡" | "陡上坡";

export type GradientSegment = {
  index: number;
  startKm: number;
  endKm: number;
  distanceKm: number;
  elevationChangeM: number | null;
  gradePct: number | null;
  band: GradientBand | "未有海拔";
};

export type GradientDistribution = {
  band: GradientBand;
  distanceKm: number;
  sharePct: number;
};

export type RouteAnalysis = {
  points: RoutePoint[];
  totalDistanceKm: number;
  ascentM: number;
  descentM: number;
  maxUphillPct: number | null;
  maxDownhillPct: number | null;
  segments: GradientSegment[];
  gradientDistribution: GradientDistribution[];
};

const EARTH_RADIUS_M = 6_371_000;
const SEGMENT_KM = 1;
const BANDS: GradientBand[] = ["陡下坡", "下坡", "平路", "上坡", "陡上坡"];

function numberOrUndefined(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function isLatitude(value: number | undefined): value is number {
  return value !== undefined && value >= -90 && value <= 90;
}

function isLongitude(value: number | undefined): value is number {
  return value !== undefined && value >= -180 && value <= 180;
}

function haversineMeters(first: Pick<RoutePoint, "latitude" | "longitude">, second: Pick<RoutePoint, "latitude" | "longitude">) {
  const radians = Math.PI / 180;
  const latDelta = (second.latitude - first.latitude) * radians;
  const lonDelta = (second.longitude - first.longitude) * radians;
  const a = Math.sin(latDelta / 2) ** 2
    + Math.cos(first.latitude * radians) * Math.cos(second.latitude * radians) * Math.sin(lonDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function gradientBand(gradePct: number): GradientBand {
  if (gradePct <= -3) return "陡下坡";
  if (gradePct <= -0.8) return "下坡";
  if (gradePct < 0.8) return "平路";
  if (gradePct < 3) return "上坡";
  return "陡上坡";
}

function rounded(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** Normalizes coordinate-bearing time-series samples and derives distance where needed. */
export function normalizeRoutePoints(samples: GarminRouteSample[]): RoutePoint[] {
  const points: RoutePoint[] = [];
  let derivedDistanceKm = 0;

  samples.forEach((sample, index) => {
    const latitude = numberOrUndefined(sample.latitude);
    const longitude = numberOrUndefined(sample.longitude);
    if (!isLatitude(latitude) || !isLongitude(longitude)) return;

    const elapsedSec = Math.max(0, Math.round(numberOrUndefined(sample.elapsedSec) ?? index));
    const suppliedDistanceKm = numberOrUndefined(sample.distanceKm);
    const previous = points.at(-1);
    if (suppliedDistanceKm !== undefined && suppliedDistanceKm >= 0) {
      derivedDistanceKm = Math.max(derivedDistanceKm, suppliedDistanceKm);
    } else if (previous) {
      derivedDistanceKm += haversineMeters(previous, { latitude, longitude }) / 1000;
    }

    points.push({
      elapsedSec,
      distanceKm: derivedDistanceKm,
      latitude,
      longitude,
      ...(numberOrUndefined(sample.altitudeM) !== undefined ? { altitudeM: numberOrUndefined(sample.altitudeM) } : {}),
    });
  });

  return points;
}

export function analyzeRoute(samples: GarminRouteSample[]): RouteAnalysis | null {
  const points = normalizeRoutePoints(samples);
  if (points.length < 2) return null;

  let ascentM = 0;
  let descentM = 0;
  let maxUphillPct: number | null = null;
  let maxDownhillPct: number | null = null;
  const distributionDistance = new Map<GradientBand, number>(BANDS.map(band => [band, 0]));

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const distanceM = Math.max(0, (current.distanceKm - previous.distanceKm) * 1000);
    if (distanceM <= 0) continue;

    if (previous.altitudeM !== undefined && current.altitudeM !== undefined) {
      const elevationDelta = current.altitudeM - previous.altitudeM;
      if (elevationDelta > 0) ascentM += elevationDelta;
      if (elevationDelta < 0) descentM += Math.abs(elevationDelta);
      const gradePct = elevationDelta / distanceM * 100;
      if (gradePct > 0) maxUphillPct = maxUphillPct === null ? gradePct : Math.max(maxUphillPct, gradePct);
      if (gradePct < 0) maxDownhillPct = maxDownhillPct === null ? gradePct : Math.min(maxDownhillPct, gradePct);
      const band = gradientBand(gradePct);
      distributionDistance.set(band, (distributionDistance.get(band) ?? 0) + distanceM / 1000);
    }
  }

  const firstDistance = points[0].distanceKm;
  const lastDistance = points.at(-1)!.distanceKm;
  const totalDistanceKm = Math.max(0, lastDistance - firstDistance);
  const segments: GradientSegment[] = [];
  for (let startKm = firstDistance, index = 1; startKm < lastDistance; startKm += SEGMENT_KM, index += 1) {
    const endKm = Math.min(startKm + SEGMENT_KM, lastDistance);
    const segmentPoints = points.filter(point => point.distanceKm >= startKm && point.distanceKm <= endKm);
    const start = segmentPoints[0] ?? points.find(point => point.distanceKm >= startKm);
    const end = segmentPoints.at(-1) ?? points.find(point => point.distanceKm >= endKm);
    const distanceKm = Math.max(0, (end?.distanceKm ?? endKm) - (start?.distanceKm ?? startKm));
    const hasAltitude = start?.altitudeM !== undefined && end?.altitudeM !== undefined && distanceKm > 0;
    const elevationChangeM = hasAltitude ? end.altitudeM! - start.altitudeM! : null;
    const gradePct = hasAltitude ? elevationChangeM! / (distanceKm * 1000) * 100 : null;
    segments.push({
      index,
      startKm: rounded(startKm, 2),
      endKm: rounded(endKm, 2),
      distanceKm: rounded(distanceKm, 2),
      elevationChangeM: elevationChangeM === null ? null : rounded(elevationChangeM),
      gradePct: gradePct === null ? null : rounded(gradePct),
      band: gradePct === null ? "未有海拔" : gradientBand(gradePct),
    });
  }

  const classifiedDistanceKm = BANDS.reduce((sum, band) => sum + (distributionDistance.get(band) ?? 0), 0);
  return {
    points,
    totalDistanceKm: rounded(totalDistanceKm, 2),
    ascentM: rounded(ascentM),
    descentM: rounded(descentM),
    maxUphillPct: maxUphillPct === null ? null : rounded(maxUphillPct),
    maxDownhillPct: maxDownhillPct === null ? null : rounded(maxDownhillPct),
    segments,
    gradientDistribution: BANDS.map(band => {
      const distanceKm = distributionDistance.get(band) ?? 0;
      return { band, distanceKm: rounded(distanceKm, 2), sharePct: classifiedDistanceKm > 0 ? rounded(distanceKm / classifiedDistanceKm * 100) : 0 };
    }),
  };
}
