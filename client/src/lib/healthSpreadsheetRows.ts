import {
  fieldNumberError,
  normalizeHKDate,
  normalizeHKDateTime,
  optionalNumber,
  type SpreadsheetCell,
  type SpreadsheetColumn,
} from "@shared/healthSpreadsheet";
import type { PreparedSpreadsheetRow } from "@/components/HealthSpreadsheetEntry";

export type HealthSpreadsheetType = "steps" | "heartRate" | "bloodPressure" | "sleep" | "body";

export const HEALTH_SPREADSHEET_COLUMNS: Record<HealthSpreadsheetType, SpreadsheetColumn[]> = {
  steps: [
    { key: "date", label: "日期 (YYYY-MM-DD)", aliases: ["date", "日期"] },
    { key: "steps", label: "步數", aliases: ["steps"] },
    { key: "floorsClimbed", label: "樓層", aliases: ["floors", "floors climbed", "樓梯"] },
    { key: "distanceKm", label: "距離 (km)", aliases: ["distance", "distance km"] },
    { key: "activeMinutes", label: "活動分鐘", aliases: ["active minutes", "minutes"] },
    { key: "calories", label: "卡路里", aliases: ["calories", "kcal"] },
    { key: "notes", label: "備註", aliases: ["notes", "note"] },
  ],
  heartRate: [
    { key: "date", label: "日期 (YYYY-MM-DD)", aliases: ["date", "日期"] },
    { key: "restingHr", label: "靜息心率 (bpm)", aliases: ["resting hr", "resting heart rate"] },
    { key: "highHr", label: "最高心率 (bpm)", aliases: ["high hr", "max hr", "maximum heart rate"] },
    { key: "avgHr", label: "平均心率 (bpm)", aliases: ["average hr", "avg hr"] },
    { key: "hrv", label: "HRV (ms)", aliases: ["hrv"] },
    { key: "notes", label: "備註", aliases: ["notes", "note"] },
  ],
  bloodPressure: [
    { key: "measuredAt", label: "量度時間 (HK)", aliases: ["measured at", "datetime", "日期時間"] },
    { key: "systolic", label: "收縮壓 (mmHg)", aliases: ["systolic"] },
    { key: "diastolic", label: "舒張壓 (mmHg)", aliases: ["diastolic"] },
    { key: "pulse", label: "脈搏 (bpm)", aliases: ["pulse"] },
    { key: "notes", label: "備註", aliases: ["notes", "note"] },
  ],
  sleep: [
    { key: "date", label: "日期 (YYYY-MM-DD)", aliases: ["date", "日期"] },
    { key: "score", label: "睡眠分數", aliases: ["sleep score", "score"] },
    { key: "duration", label: "時數 (小時)", aliases: ["duration", "duration h", "sleep duration"] },
    { key: "quality", label: "品質", aliases: ["quality", "sleep quality"] },
    { key: "hrv", label: "HRV (ms)", aliases: ["hrv"] },
    { key: "restingHr", label: "靜息心率 (bpm)", aliases: ["resting hr"] },
    { key: "bodyBattery", label: "Body Battery", aliases: ["body battery"] },
    { key: "pulseOx", label: "血氧 (%)", aliases: ["pulse ox", "spo2"] },
    { key: "respiration", label: "呼吸率", aliases: ["respiration", "respiration rate"] },
    { key: "bedtime", label: "就寢 (HH:MM)", aliases: ["bedtime"] },
    { key: "waketime", label: "起床 (HH:MM)", aliases: ["waketime", "wake time"] },
    { key: "notes", label: "備註", aliases: ["notes", "note"] },
  ],
  body: [
    { key: "date", label: "日期 (YYYY-MM-DD)", aliases: ["date", "日期"] },
    { key: "weight", label: "體重 (kg)", aliases: ["weight", "weight kg"] },
    { key: "bodyFatPct", label: "體脂 (%)", aliases: ["body fat", "body fat %"] },
    { key: "muscleMass", label: "肌肉量 (kg)", aliases: ["muscle mass", "muscle mass kg"] },
    { key: "bmi", label: "BMI", aliases: ["bmi"] },
    { key: "fatMass", label: "脂肪量 (kg)", aliases: ["fat mass", "fat mass kg"] },
    { key: "visceralFat", label: "內臟脂肪", aliases: ["visceral fat"] },
    { key: "bmr", label: "BMR (kcal)", aliases: ["bmr"] },
    { key: "notes", label: "備註", aliases: ["notes", "note"] },
  ],
};

type NumericRule = { key: string; label: string; min?: number; max?: number; integer?: boolean };

function numberPayload(row: SpreadsheetCell, rules: NumericRule[], errors: string[]) {
  const payload: Record<string, number | undefined> = {};
  for (const rule of rules) {
    const error = fieldNumberError(row[rule.key] ?? "", rule.label, rule.min, rule.max, rule.integer);
    if (error) errors.push(error);
    payload[rule.key] = optionalNumber(row[rule.key] ?? "");
  }
  return payload;
}

function needsMeasurement(payload: Record<string, unknown>, errors: string[]) {
  if (!Object.values(payload).some((value) => typeof value === "number")) errors.push("請至少輸入一項數值");
}

function normalizeQuality(value: string): "Poor" | "Fair" | "Good" | "Excellent" | undefined | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  const qualityByText: Record<string, "Poor" | "Fair" | "Good" | "Excellent"> = {
    poor: "Poor", 差: "Poor", fair: "Fair", 普通: "Fair", good: "Good", 良好: "Good", excellent: "Excellent", 優秀: "Excellent", 極佳: "Excellent",
  };
  return qualityByText[normalized] ?? null;
}

function timeError(value: string, label: string): string | null {
  if (!value.trim()) return null;
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value.trim()) ? null : `${label} 須為 HH:MM`;
}

export function prepareHealthSpreadsheetRow(type: HealthSpreadsheetType, row: SpreadsheetCell, rowIndex: number): PreparedSpreadsheetRow {
  const errors: string[] = [];
  const base = { rowIndex, errors };

  if (type === "bloodPressure") {
    const measuredAt = normalizeHKDateTime(row.measuredAt ?? "");
    if (!measuredAt) errors.push("量度時間須為 YYYY-MM-DD HH:MM（香港時間）");
    const values = numberPayload(row, [
      { key: "systolic", label: "收縮壓", min: 50, max: 300, integer: true },
      { key: "diastolic", label: "舒張壓", min: 30, max: 200, integer: true },
      { key: "pulse", label: "脈搏", min: 30, max: 300, integer: true },
    ], errors);
    if (values.systolic === undefined) errors.push("請輸入收縮壓");
    if (values.diastolic === undefined) errors.push("請輸入舒張壓");
    return { ...base, data: measuredAt ? { measuredAt, ...values, notes: row.notes?.trim() || undefined } : undefined };
  }

  const date = normalizeHKDate(row.date ?? "");
  if (!date) errors.push("日期須為 YYYY-MM-DD 或 DD/MM/YYYY（香港日期）");

  if (type === "steps") {
    const values = numberPayload(row, [
      { key: "steps", label: "步數", min: 0, max: 200000, integer: true },
      { key: "floorsClimbed", label: "樓層", min: 0, max: 1000, integer: true },
      { key: "distanceKm", label: "距離", min: 0, max: 500 },
      { key: "activeMinutes", label: "活動分鐘", min: 0, max: 1440, integer: true },
      { key: "calories", label: "卡路里", min: 0, max: 20000, integer: true },
    ], errors);
    needsMeasurement(values, errors);
    return { ...base, data: date ? { date, ...values, distanceKm: values.distanceKm?.toString(), notes: row.notes?.trim() || undefined } : undefined };
  }

  if (type === "heartRate") {
    const values = numberPayload(row, [
      { key: "restingHr", label: "靜息心率", min: 25, max: 250, integer: true },
      { key: "highHr", label: "最高心率", min: 25, max: 260, integer: true },
      { key: "avgHr", label: "平均心率", min: 25, max: 250, integer: true },
      { key: "hrv", label: "HRV", min: 0, max: 500, integer: true },
    ], errors);
    needsMeasurement(values, errors);
    return { ...base, data: date ? { date, ...values, notes: row.notes?.trim() || undefined } : undefined };
  }

  if (type === "sleep") {
    const values = numberPayload(row, [
      { key: "score", label: "睡眠分數", min: 0, max: 100, integer: true },
      { key: "duration", label: "睡眠時數", min: 0, max: 24 },
      { key: "hrv", label: "HRV", min: 0, max: 500, integer: true },
      { key: "restingHr", label: "靜息心率", min: 25, max: 250, integer: true },
      { key: "bodyBattery", label: "Body Battery", min: 0, max: 100, integer: true },
      { key: "pulseOx", label: "血氧", min: 50, max: 100 },
      { key: "respiration", label: "呼吸率", min: 4, max: 60 },
    ], errors);
    needsMeasurement(values, errors);
    const quality = normalizeQuality(row.quality ?? "");
    if (quality === null) errors.push("品質須為 Poor、Fair、Good 或 Excellent");
    const bedtimeError = timeError(row.bedtime ?? "", "就寢時間");
    const waketimeError = timeError(row.waketime ?? "", "起床時間");
    if (bedtimeError) errors.push(bedtimeError);
    if (waketimeError) errors.push(waketimeError);
    return { ...base, data: date ? { date, ...values, quality: quality ?? undefined, bedtime: row.bedtime?.trim() || undefined, waketime: row.waketime?.trim() || undefined, notes: row.notes?.trim() || undefined } : undefined };
  }

  const values = numberPayload(row, [
    { key: "weight", label: "體重", min: 10, max: 500 },
    { key: "bodyFatPct", label: "體脂", min: 0, max: 100 },
    { key: "muscleMass", label: "肌肉量", min: 0, max: 250 },
    { key: "bmi", label: "BMI", min: 5, max: 100 },
    { key: "fatMass", label: "脂肪量", min: 0, max: 300 },
    { key: "visceralFat", label: "內臟脂肪", min: 0, max: 100, integer: true },
    { key: "bmr", label: "BMR", min: 300, max: 10000, integer: true },
  ], errors);
  needsMeasurement(values, errors);
  return { ...base, data: date ? { date, ...values, notes: row.notes?.trim() || undefined } : undefined };
}
