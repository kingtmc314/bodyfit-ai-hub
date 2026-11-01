import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { APP_VERSION } from "../client/src/lib/appMeta";
import { formatHKLongDate, getHKHour } from "../client/src/lib/hkTime";

describe("UI release metadata", () => {
  it("keeps the sidebar application version aligned with package metadata", () => {
    const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    expect(APP_VERSION).toBe("3.14.2");
    expect(packageJson.version).toBe(APP_VERSION);
  });
});

describe("Premium feature page hierarchy", () => {
  const heroSource = readFileSync(new URL("../client/src/components/PremiumFeatureHero.tsx", import.meta.url), "utf8");
  const nutritionSource = readFileSync(new URL("../client/src/pages/Nutrition.tsx", import.meta.url), "utf8");
  const workoutSource = readFileSync(new URL("../client/src/pages/Workout.tsx", import.meta.url), "utf8");
  const sleepSource = readFileSync(new URL("../client/src/pages/Sleep.tsx", import.meta.url), "utf8");

  it("supports balanced three, four, and many-metric header layouts", () => {
    expect(heroSource).toContain("feature-hero-metrics-three");
    expect(heroSource).toContain("feature-hero-metrics-four");
    expect(heroSource).toContain("feature-hero-metrics-many");
  });

  it("uses the shared premium hero on Nutrition, Workout, and Sleep", () => {
    expect(nutritionSource).toContain('tone="nutrition"');
    expect(workoutSource).toContain('tone="workout"');
    expect(sleepSource).toContain('tone="sleep"');
    expect(nutritionSource).toContain("todayHKString()");
    expect(workoutSource).toContain("selectedDaySessions");
    expect(sleepSource).toContain("latest?.sleepScore");
  });
});

describe("Hong Kong dashboard time helpers", () => {
  const referenceUtcTime = new Date("2026-10-14T15:30:00.000Z");

  it("uses Hong Kong time instead of the server local timezone for greetings", () => {
    expect(getHKHour(referenceUtcTime)).toBe(23);
  });

  it("formats the dashboard date in the Hong Kong calendar day", () => {
    const label = formatHKLongDate(referenceUtcTime, "en-GB");
    expect(label).toContain("14");
    expect(label).toContain("October");
    expect(label).toContain("2026");
  });
});

describe("v3.14 focused training scope", () => {
  const appSource = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");
  const layoutSource = readFileSync(new URL("../client/src/components/AppLayout.tsx", import.meta.url), "utf8");
  const workoutSource = readFileSync(new URL("../client/src/pages/Workout.tsx", import.meta.url), "utf8");
  const nutritionSource = readFileSync(new URL("../client/src/pages/Nutrition.tsx", import.meta.url), "utf8");
  const runningSource = readFileSync(new URL("../client/src/pages/Running.tsx", import.meta.url), "utf8");
  const routerSource = readFileSync(new URL("../server/routers.ts", import.meta.url), "utf8");
  const schemaSource = readFileSync(new URL("../drizzle/schema.ts", import.meta.url), "utf8");

  it("removes retired modules from routes, navigation, APIs, and schema without touching active data modules", () => {
    for (const removed of ["/fasting", "/supplements", "/medical", "/physio"]) {
      expect(appSource).not.toContain(removed);
      expect(layoutSource).not.toContain(removed);
    }
    for (const removed of ["fastingRouter", "supplementsRouter", "medicalRouter", "physioRouter"]) {
      expect(routerSource).not.toContain(removed);
    }
    for (const retained of ["mealLogs", "workoutSessions", "workoutSets", "runningLogs", "runningShoes", "sleepLogs", "heartRateLogs", "bodyComposition"]) {
      expect(schemaSource).toContain(retained);
    }
  });

  it("keeps a photo-first nutrition flow and a guided strength session workflow", () => {
    expect(nutritionSource).toContain("SMART FOOD FLOW");
    expect(nutritionSource).toContain("拍照分析");
    expect(nutritionSource).toContain("常用食物");
    expect(workoutSource).toContain("下一組 · 一鍵預填");
    expect(workoutSource).toContain("休息計時器");
    expect(workoutSource).not.toContain("exerciseLibMode === 'physio'");
  });

  it("exposes shoe-level performance analysis and the interactive energy lab without replacing AI coaching", () => {
    expect(runningSource).toContain("shoePerformanceData");
    expect(runningSource).toContain("各跑鞋效能統計");
    expect(runningSource).toContain("RunningEnergyLab");
    expect(runningSource).toContain("AI 教練");
  });
});

describe("v3.14.1 performance workflow", () => {
  const runningSource = readFileSync(new URL("../client/src/pages/Running.tsx", import.meta.url), "utf8");
  const labSource = readFileSync(new URL("../client/src/components/RunningEnergyLab.tsx", import.meta.url), "utf8");
  const workoutSource = readFileSync(new URL("../client/src/pages/Workout.tsx", import.meta.url), "utf8");
  const routerSource = readFileSync(new URL("../server/routers.ts", import.meta.url), "utf8");
  const schemaSource = readFileSync(new URL("../drizzle/schema.ts", import.meta.url), "utf8");

  it("filters shoe intelligence by distance and route without replacing historical metrics", () => {
    expect(runningSource).toContain("DISTANCE_BANDS");
    expect(runningSource).toContain("shoeDistanceBand");
    expect(runningSource).toContain("shoeRouteType");
    expect(routerSource).toContain("getShoePerformance");
    expect(schemaSource).toContain("routeType: text(\"route_type\")");
  });

  it("keeps planned templates separate from logged sets and exposes overload guidance", () => {
    expect(workoutSource).toContain("WORKOUT_TEMPLATES");
    expect(workoutSource).toContain("plannedExercises");
    expect(workoutSource).toContain("漸進超負荷建議");
    expect(routerSource).toContain("getProgressionSuggestion");
    expect(schemaSource).toContain("plannedExercises: json(\"planned_exercises\")");
  });

  it("persists named weather comparisons in the running energy lab", () => {
    expect(labSource).toContain("儲存比較");
    expect(labSource).toContain("已儲存的天氣比較");
    expect(routerSource).toContain("saveLabScenario");
    expect(schemaSource).toContain("runningLabScenarios");
  });
});

describe("v3.14.2 complete running record workflow", () => {
  const runningSource = readFileSync(new URL("../client/src/pages/Running.tsx", import.meta.url), "utf8");
  const labSource = readFileSync(new URL("../client/src/components/RunningEnergyLab.tsx", import.meta.url), "utf8");
  const importerSource = readFileSync(new URL("../client/src/components/GarminRunImporter.tsx", import.meta.url), "utf8");
  const routerSource = readFileSync(new URL("../server/routers.ts", import.meta.url), "utf8");
  const schemaSource = readFileSync(new URL("../drizzle/schema.ts", import.meta.url), "utf8");
  const stylesheetSource = readFileSync(new URL("../client/src/index.css", import.meta.url), "utf8");

  it("keeps complete weather context and preview-first backfill available for both runs and races", () => {
    expect(runningSource).toContain("比賽天氣狀況");
    expect(runningSource).toContain("RunningHistoricalBackfill");
    expect(routerSource).toContain("lookupHistoricalWeather");
    expect(routerSource).toContain("applyHistoricalBackfill");
    expect(schemaSource).toContain('weatherCondition: text("weather_condition")');
    expect(schemaSource).toContain('weatherObservedAt: text("weather_observed_at")');
  });

  it("merges reviewed Garmin screenshots into one traceable record with per-lap values", () => {
    expect(runningSource).toContain("GarminRunImporter");
    expect(importerSource).toContain("要保留逐秒配速／心率／功率曲線");
    expect(routerSource).toContain("extractGarminRun");
    expect(schemaSource).toContain('garminDetails: json("garmin_details")');
    expect(schemaSource).toContain('laps: json("laps")');
  });

  it("consolidates shoe analysis under trends, supports combined locker filters, and themes the lab", () => {
    expect(runningSource).toContain("ShoePerformanceTrendPanel");
    expect(runningSource).toContain("跑步數據趨勢");
    expect(runningSource).toContain("shoeStatusFilters");
    expect(runningSource).toContain("shoeBrandFilters");
    expect(stylesheetSource).toContain(".running-lab");
    expect(labSource).toContain("running-lab");
  });
});
