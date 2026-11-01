import { describe, expect, it } from "vitest";
import { buildGarminVisionContent, parseGarminExtraction } from "./garminImport";

describe("Garmin multi-screenshot vision import", () => {
  it("uses only signed HTTPS image URLs and no unsupported content metadata", () => {
    const content = buildGarminVisionContent(
      ["https://storage.example.test/signed-image-1.png", "https://storage.example.test/signed-image-2.png"],
      "Extract one running activity.",
    );

    expect(content).toHaveLength(3);
    expect(content[0]).toEqual({ type: "text", text: "Extract one running activity." });
    expect(content[1]).toEqual({ type: "image_url", image_url: { url: "https://storage.example.test/signed-image-1.png", detail: "high" } });
    expect(JSON.stringify(content)).not.toContain('"name"');
    expect(() => buildGarminVisionContent(["/manus-storage/not-absolute.png"], "x")).toThrow(/安全網址/);
  });

  it("parses a strict JSON result and tolerates a fenced response fallback", () => {
    const parsed = parseGarminExtraction("```json\n{\"date\":\"2026-11-01\",\"time\":null,\"running\":{\"distanceKm\":21.1},\"garminDetails\":{},\"laps\":[{\"lap\":1}],\"confidence\":\"high\",\"notes\":\"已讀取\"}\n```");
    expect(parsed.date).toBe("2026-11-01");
    expect(parsed.running.distanceKm).toBe(21.1);
    expect(parsed.laps).toHaveLength(1);
    expect(parsed.confidence).toBe("high");
  });

  it("fails with a user-safe error when a model response is not readable JSON", () => {
    expect(() => parseGarminExtraction("not a JSON response")).toThrow(/格式/);
  });
});
