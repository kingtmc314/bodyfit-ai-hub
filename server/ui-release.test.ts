import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { APP_VERSION } from "../client/src/lib/appMeta";
import { formatHKLongDate, getHKHour } from "../client/src/lib/hkTime";

describe("UI release metadata", () => {
  it("keeps the sidebar application version aligned with package metadata", () => {
    const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    expect(APP_VERSION).toBe("3.14.0");
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
