import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { APP_VERSION } from "../client/src/lib/appMeta";
import { formatHKLongDate, getHKHour } from "../client/src/lib/hkTime";

describe("UI release metadata", () => {
  it("keeps the sidebar application version aligned with package metadata", () => {
    const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    expect(APP_VERSION).toBe("3.14.8");
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
    expect(schemaSource).toContain('garminDetails: jsonb("garmin_details")');
    expect(schemaSource).toContain('laps: jsonb("laps")');
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

describe("v3.14.3 colour contrast and surface clarity", () => {
  const stylesheetSource = readFileSync(new URL("../client/src/index.css", import.meta.url), "utf8");
  const workoutSource = readFileSync(new URL("../client/src/pages/Workout.tsx", import.meta.url), "utf8");

  it("uses visibly distinct light-theme surfaces, borders and muted labels while preserving dark-theme support", () => {
    expect(stylesheetSource).toContain("--background: oklch(0.952 0.016 82)");
    expect(stylesheetSource).toContain("--border: oklch(0.815 0.027 82)");
    expect(stylesheetSource).toContain("--muted-foreground: oklch(0.415 0.026 250)");
    expect(stylesheetSource).toContain("Higher-contrast operational surfaces");
    expect(stylesheetSource).toContain(":focus-visible");
    expect(stylesheetSource).toContain(".dark {");
  });

  it("does not exclude older owner workout sessions through a client-side 90-day query window", () => {
    expect(workoutSource).toContain("trpc.workout.getSessions.useQuery();");
    expect(workoutSource).not.toContain("Date.now() - 90 * 86400000");
  });
});

describe("v3.14.4 complete import and history workflow", () => {
  const appSource = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");
  const layoutSource = readFileSync(new URL("../client/src/components/AppLayout.tsx", import.meta.url), "utf8");
  const releaseNotesSource = readFileSync(new URL("../client/src/lib/releaseNotes.ts", import.meta.url), "utf8");
  const workoutSource = readFileSync(new URL("../client/src/pages/Workout.tsx", import.meta.url), "utf8");
  const runningSource = readFileSync(new URL("../client/src/pages/Running.tsx", import.meta.url), "utf8");
  const routerSource = readFileSync(new URL("../server/routers.ts", import.meta.url), "utf8");
  const schemaSource = readFileSync(new URL("../drizzle/schema.ts", import.meta.url), "utf8");

  it("keeps Garmin FIT/CSV source parsing and per-sample data in the same reviewed running record", () => {
    expect(runningSource).toContain("GarminRawFileImporter");
    expect(runningSource).toContain("timeSeries");
    expect(routerSource).toContain("parseGarminRawFile");
    expect(routerSource).toContain("saveGarminRawSource");
    expect(schemaSource).toContain('timeSeries: jsonb("time_series")');
  });

  it("offers Hong Kong calendar history filters and comparable training summaries", () => {
    expect(workoutSource).toContain("historyYear");
    expect(workoutSource).toContain("historyMonth");
    expect(workoutSource).toContain("HistorySummaryCard");
    expect(workoutSource).toContain("Asia/Hong_Kong");
  });

  it("exposes fixed mobile navigation and a user-facing release history", () => {
    expect(appSource).toContain('path="/release-notes"');
    expect(layoutSource).toContain("mobile-bottom-nav");
    expect(layoutSource).toContain("safe-area-inset-bottom");
    expect(releaseNotesSource).toContain('version: "3.14.4"');
    expect(releaseNotesSource).toContain('status: "released"');
  });
});

describe("v3.14.5 Garmin vision reliability and time-series review", () => {
  const runningSource = readFileSync(new URL("../client/src/pages/Running.tsx", import.meta.url), "utf8");
  const chartSource = readFileSync(new URL("../client/src/components/GarminTimeSeriesChart.tsx", import.meta.url), "utf8");
  const importerSource = readFileSync(new URL("../client/src/components/GarminRunImporter.tsx", import.meta.url), "utf8");
  const rawImporterSource = readFileSync(new URL("../client/src/components/GarminRawFileImporter.tsx", import.meta.url), "utf8");
  const rawParserSource = readFileSync(new URL("../server/garminFileImport.ts", import.meta.url), "utf8");
  const storageSource = readFileSync(new URL("../server/storage.ts", import.meta.url), "utf8");
  const routerSource = readFileSync(new URL("../server/routers.ts", import.meta.url), "utf8");
  const releaseNotesSource = readFileSync(new URL("../client/src/lib/releaseNotes.ts", import.meta.url), "utf8");

  it("batches direct Garmin image data before the vision request instead of relying on transient signed URLs", () => {
    expect(routerSource).toContain("buildGarminVisionBatches(input.screenshots)");
    expect(importerSource).toContain("最多 16 張／合計 30MB");
    expect(importerSource).toContain("每 5 張自動分批");
  });

  it("offers reviewed FIT/CSV per-sample pace, heart-rate and elevation curves in the run history", () => {
    expect(runningSource).toContain("GarminTimeSeriesChart");
    expect(runningSource).toContain("查看 Garmin 逐秒曲線");
    expect(chartSource).toContain("配速");
    expect(chartSource).toContain("心率");
    expect(chartSource).toContain("海拔");
    expect(chartSource).toContain('timeZone: "Asia/Hong_Kong"');
    expect(chartSource).toContain("reversed={selectedMetric === \"pace\"}");
    expect(rawImporterSource).toContain("GarminTimeSeriesChart");
    expect(rawImporterSource).toContain("FIT／CSV／GPX／TCX");
    expect(rawParserSource).toContain("parseGarminGpx");
    expect(rawParserSource).toContain("parseGarminTcx");
    expect(rawParserSource).toContain("DOCTYPE");
    expect(rawImporterSource).toContain("uploadGarminRawChunk");
    expect(rawImporterSource).toContain("CHUNK_BYTES");
    expect(rawImporterSource).toContain("安全分段上載");
    expect(routerSource).toContain("uploadGarminRawChunk");
    expect(routerSource).toContain("validateGarminChunkKeys");
    expect(routerSource).toContain("Buffer.concat(chunks)");
    expect(storageSource).toContain("storageReadBuffer");
  });

  it("makes the customer-facing release history match the visible version", () => {
    expect(releaseNotesSource).toContain('version: "3.14.5"');
    expect(releaseNotesSource).toContain("逐秒曲線");
  });
});

describe("v3.14.6 GPX route intelligence and mobile drawer accessibility", () => {
  const chartSource = readFileSync(new URL("../client/src/components/GarminTimeSeriesChart.tsx", import.meta.url), "utf8");
  const routeSource = readFileSync(new URL("../client/src/components/GarminRouteAnalysis.tsx", import.meta.url), "utf8");
  const mapSource = readFileSync(new URL("../client/src/components/Map.tsx", import.meta.url), "utf8");
  const layoutSource = readFileSync(new URL("../client/src/components/AppLayout.tsx", import.meta.url), "utf8");
  const parserSource = readFileSync(new URL("../server/garminFileImport.ts", import.meta.url), "utf8");
  const routerSource = readFileSync(new URL("../server/routers.ts", import.meta.url), "utf8");
  const sheetsSource = readFileSync(new URL("../server/sheetsService.ts", import.meta.url), "utf8");
  const releaseNotesSource = readFileSync(new URL("../client/src/lib/releaseNotes.ts", import.meta.url), "utf8");

  it("keeps GPS coordinates through Garmin parsers and the reviewed running-record API", () => {
    expect(parserSource).toContain("latitude?: number");
    expect(parserSource).toContain("positionLat");
    expect(parserSource).toContain("latitudedegrees");
    expect(routerSource).toContain("latitude: z.number().min(-90).max(90).optional()");
    expect(routerSource).toContain("longitude: z.number().min(-180).max(180).optional()");
  });

  it("adds an original-route map, elevation profile, gradient distribution and distance segments beside time-series charts", () => {
    expect(chartSource).toContain("GarminRouteAnalysis");
    expect(routeSource).toContain("MapView");
    expect(routeSource).toContain("海拔剖面");
    expect(routeSource).toContain("坡度分布");
    expect(routeSource).toContain("距離分段坡度");
    expect(mapSource).toContain("className ?? \"h-[500px]\"");
  });

  it("keeps all specified running metrics in the Google Sheets row and makes the full mobile drawer touch-scrollable", () => {
    for (const requiredColumn of ["Max Cadence", "Avg Stride Length", "Avg Vertical Ratio", "Vertical Oscillation"]) {
      expect(sheetsSource).toContain(requiredColumn);
    }
    expect(sheetsSource).toContain("rowData.maxCadence");
    expect(sheetsSource).toContain("rowData.avgStrideLengthM");
    expect(sheetsSource).toContain("rowData.avgVerticalRatio");
    expect(sheetsSource).toContain("rowData.verticalOscillationCm");
    expect(layoutSource).toContain("flex-1 min-h-0 overflow-y-auto overscroll-contain");
    expect(layoutSource).toContain("[-webkit-overflow-scrolling:touch]");
    expect(layoutSource).toContain("h-[100dvh]");
  });

  it("records the visible route and mobile-navigation update in the release history", () => {
    expect(releaseNotesSource).toContain('version: "3.14.6"');
    expect(releaseNotesSource).toContain("路線地圖與坡度分段分析");
    expect(releaseNotesSource).toContain("更多");
  });
});

describe("v3.14.7 spreadsheet health entry and complete-history energy analysis", () => {
  const stepsSource = readFileSync(new URL("../client/src/pages/Steps.tsx", import.meta.url), "utf8");
  const heartRateSource = readFileSync(new URL("../client/src/pages/HeartRate.tsx", import.meta.url), "utf8");
  const bloodPressureSource = readFileSync(new URL("../client/src/pages/BloodPressure.tsx", import.meta.url), "utf8");
  const sleepSource = readFileSync(new URL("../client/src/pages/Sleep.tsx", import.meta.url), "utf8");
  const bodySource = readFileSync(new URL("../client/src/pages/BodyComposition.tsx", import.meta.url), "utf8");
  const spreadsheetSource = readFileSync(new URL("../client/src/components/HealthSpreadsheetEntry.tsx", import.meta.url), "utf8");
  const rowSource = readFileSync(new URL("../client/src/lib/healthSpreadsheetRows.ts", import.meta.url), "utf8");
  const sheetsSource = readFileSync(new URL("../server/sheetsService.ts", import.meta.url), "utf8");
  const routerSource = readFileSync(new URL("../server/routers.ts", import.meta.url), "utf8");
  const labSource = readFileSync(new URL("../client/src/components/RunningEnergyLab.tsx", import.meta.url), "utf8");
  const stylesheetSource = readFileSync(new URL("../client/src/index.css", import.meta.url), "utf8");

  it("offers one native spreadsheet paste grid for steps, heart rate, blood pressure, sleep and body composition", () => {
    for (const page of [stepsSource, heartRateSource, bloodPressureSource, sleepSource, bodySource]) {
      expect(page).toContain("HealthSpreadsheetEntry");
      expect(page).toContain("表格輸入");
    }
    expect(spreadsheetSource).toContain("Excel / Google Sheets 相容");
    expect(spreadsheetSource).toContain("onPaste");
    expect(spreadsheetSource).toContain("提交結果");
    expect(rowSource).toContain("normalizeHKDateTime");
  });

  it("uses Sheets first for body, sleep and heart-rate batch entries, while keeping chart-compatible database mirrors", () => {
    expect(routerSource).toContain("mirrorSheetFirstBatch");
    expect(routerSource).toContain('mirrorSheetFirstBatch("body"');
    expect(routerSource).toContain('mirrorSheetFirstBatch("sleep"');
    expect(routerSource).toContain('mirrorSheetFirstBatch("heartrate"');
    expect(sheetsSource).toContain("upsertRowsToSheetByDate");
    expect(sheetsSource).toContain("Sleep Score");
    expect(sheetsSource).toContain("Avg HR");
  });

  it("calculates the energy lab from all stored running data and keeps its analysis surfaces high contrast", () => {
    expect(routerSource).not.toContain("LIMIT 24");
    expect(routerSource).not.toContain("interval '180 days'");
    expect(routerSource).toContain("historicalRunCount");
    expect(labSource).toContain("不設日期或筆數截斷");
    expect(stylesheetSource).toContain("deliberately dark in every app theme");
    expect(stylesheetSource).toContain("#07111f");
  });
});

describe("v3.14.8 records-and-tools navigation cleanup", () => {
  const appSource = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");
  const layoutSource = readFileSync(new URL("../client/src/components/AppLayout.tsx", import.meta.url), "utf8");
  const bodySource = readFileSync(new URL("../client/src/pages/BodyComposition.tsx", import.meta.url), "utf8");
  const sleepSource = readFileSync(new URL("../client/src/pages/Sleep.tsx", import.meta.url), "utf8");
  const heartSource = readFileSync(new URL("../client/src/pages/HeartRate.tsx", import.meta.url), "utf8");
  const schemaSource = readFileSync(new URL("../drizzle/schema.ts", import.meta.url), "utf8");
  const releaseNotesSource = readFileSync(new URL("../client/src/lib/releaseNotes.ts", import.meta.url), "utf8");

  it("removes only the requested global records-and-tools routes and menu entries", () => {
    for (const source of [appSource, layoutSource]) {
      expect(source).not.toContain('path: "/photos"');
      expect(source).not.toContain('path: "/import"');
      expect(source).not.toContain('path="/photos"');
      expect(source).not.toContain('path="/import"');
    }
    expect(appSource).not.toContain('import("./pages/ProgressPhotos")');
    expect(appSource).not.toContain('import("./pages/Import")');
    expect(layoutSource).toContain('path: "/release-notes"');
  });

  it("preserves existing health data structures and page-local import workflows", () => {
    expect(schemaSource).toContain('pgTable("progress_photos"');
    for (const page of [bodySource, sleepSource, heartSource]) expect(page).toContain("QuickImportModal");
    expect(releaseNotesSource).toContain('version: "3.14.8"');
    expect(releaseNotesSource).toContain("跑步紀錄均完整保留");
  });
});
