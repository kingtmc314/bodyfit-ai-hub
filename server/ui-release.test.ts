import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { APP_VERSION } from "../client/src/lib/appMeta";
import { formatHKLongDate, getHKHour } from "../client/src/lib/hkTime";

describe("UI release metadata", () => {
  it("keeps the sidebar application version aligned with package metadata", () => {
    const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    expect(APP_VERSION).toBe("3.13.0");
    expect(packageJson.version).toBe(APP_VERSION);
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
