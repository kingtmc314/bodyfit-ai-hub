import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { APP_VERSION } from "../client/src/lib/appMeta";
import { formatHKLongDate, getHKHour } from "../client/src/lib/hkTime";

describe("UI release metadata", () => {
  it("keeps the sidebar application version aligned with package metadata", () => {
    const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    expect(APP_VERSION).toBe("3.13.1");
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
