import { describe, expect, it } from "vitest";
import {
  buildGarminVisionBatches,
  buildGarminVisionContent,
  mergeGarminExtractions,
  parseGarminExtraction,
} from "./garminImport";

const onePixelPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL5sgAAAABJRU5ErkJggg==";

describe("Garmin multi-screenshot vision import", () => {
  it("uses direct data-image URLs only, without unsupported content metadata", () => {
    const batches = buildGarminVisionBatches([
      { base64: onePixelPng, mimeType: "image/png" },
      { base64: onePixelPng, mimeType: "image/png" },
    ]);
    const content = buildGarminVisionContent(batches[0], "Extract one running activity.");

    expect(content).toHaveLength(3);
    expect(content[0]).toEqual({ type: "text", text: "Extract one running activity." });
    expect(content[1].type).toBe("image_url");
    if (content[1].type === "image_url") {
      expect(content[1].image_url.url).toMatch(/^data:image\/png;base64,/);
      expect(content[1].image_url.detail).toBe("high");
    }
    expect(JSON.stringify(content)).not.toContain('"name"');
  });

  it("splits a long sequence into batches of five while preserving image order", () => {
    const batches = buildGarminVisionBatches(Array.from({ length: 13 }, () => ({ base64: onePixelPng, mimeType: "image/png" })));
    expect(batches.map((batch) => batch.length)).toEqual([5, 5, 3]);
    expect(batches.flat()).toHaveLength(13);
    expect(() => buildGarminVisionBatches([{ base64: "invalid|value", mimeType: "image/png" }])).toThrow(/資料格式/);
  });

  it("parses a strict JSON result and tolerates a fenced response fallback", () => {
    const parsed = parseGarminExtraction("```json\n{\"date\":\"2026-11-01\",\"time\":null,\"running\":{\"distanceKm\":21.1},\"garminDetails\":{},\"laps\":[{\"lap\":1}],\"confidence\":\"high\",\"notes\":\"已讀取\"}\n```");
    expect(parsed.date).toBe("2026-11-01");
    expect(parsed.running.distanceKm).toBe(21.1);
    expect(parsed.laps).toHaveLength(1);
    expect(parsed.confidence).toBe("high");
  });

  it("merges only visible values, deduplicates laps, and keeps the lower confidence", () => {
    const merged = mergeGarminExtractions([
      { date: "2026-11-01", time: "07:00", running: { distanceKm: 21.1, avgHr: null }, garminDetails: { totalAscentM: 180 }, laps: [{ lap: 1, distanceKm: 1, avgPace: null }], confidence: "high", notes: "總覽" },
      { date: null, time: null, running: { distanceKm: 20.9, avgHr: 151 }, garminDetails: { maxPowerW: 310 }, laps: [{ lap: 1, distanceKm: 1, avgPace: "05:10" }, { lap: 2, distanceKm: 1, avgPace: "05:05" }], confidence: "medium", notes: "分段" },
    ]);
    expect(merged.running).toMatchObject({ distanceKm: 21.1, avgHr: 151 });
    expect(merged.garminDetails).toMatchObject({ totalAscentM: 180, maxPowerW: 310 });
    expect(merged.laps).toEqual([{ lap: 1, distanceKm: 1, avgPace: "05:10" }, { lap: 2, distanceKm: 1, avgPace: "05:05" }]);
    expect(merged.confidence).toBe("medium");
  });

  it("fails with a user-safe error when a model response is not readable JSON", () => {
    expect(() => parseGarminExtraction("not a JSON response")).toThrow(/格式/);
  });
});
