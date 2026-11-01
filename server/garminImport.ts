export type GarminVisionContent =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail: "high" } };

export type GarminExtraction = {
  date: string | null;
  time: string | null;
  running: Record<string, unknown>;
  garminDetails: Record<string, unknown>;
  laps: Array<Record<string, unknown>>;
  confidence: "high" | "medium" | "low";
  notes: string;
};

/**
 * Vision providers require absolute URLs. Keep provider-specific request details
 * in one place and deliberately omit unsupported content metadata such as `name`.
 */
export function buildGarminVisionContent(
  signedImageUrls: string[],
  prompt: string,
): GarminVisionContent[] {
  if (!signedImageUrls.length) throw new Error("請至少提供一張 Garmin 截圖");

  for (const url of signedImageUrls) {
    if (!/^https:\/\//i.test(url)) {
      throw new Error("Garmin 截圖未取得可供分析的安全網址，請重新選擇圖片後再試");
    }
  }

  return [
    { type: "text", text: prompt },
    ...signedImageUrls.map((url) => ({
      type: "image_url" as const,
      image_url: { url, detail: "high" as const },
    })),
  ];
}

function getResponseText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((part): part is { type?: string; text?: unknown } => typeof part === "object" && part !== null)
      .filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text as string)
      .join("\n");
  }
  return "";
}

/** Parse plain JSON as well as a defensive JSON-code-fence fallback. */
export function parseGarminExtraction(content: unknown): GarminExtraction {
  const source = getResponseText(content).trim();
  if (!source) throw new Error("分析服務沒有回傳可讀取的資料，請重試");

  const withoutFence = source
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("分析服務回傳的資料格式不完整，請重試");

  let parsed: unknown;
  try {
    parsed = JSON.parse(withoutFence.slice(start, end + 1));
  } catch {
    throw new Error("分析服務回傳的資料格式無法讀取，請重試");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("分析服務沒有回傳跑步紀錄，請重試");
  }

  const value = parsed as Record<string, unknown>;
  const confidence = value.confidence === "high" || value.confidence === "low" ? value.confidence : "medium";
  return {
    date: typeof value.date === "string" ? value.date : null,
    time: typeof value.time === "string" ? value.time : null,
    running: typeof value.running === "object" && value.running !== null && !Array.isArray(value.running) ? value.running as Record<string, unknown> : {},
    garminDetails: typeof value.garminDetails === "object" && value.garminDetails !== null && !Array.isArray(value.garminDetails) ? value.garminDetails as Record<string, unknown> : {},
    laps: Array.isArray(value.laps)
      ? value.laps.filter((lap): lap is Record<string, unknown> => typeof lap === "object" && lap !== null && !Array.isArray(lap))
      : [],
    confidence,
    notes: typeof value.notes === "string" ? value.notes : "請核對從 Garmin 截圖讀取的數據。",
  };
}

export function describeGarminImportError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/expected pattern|invalid url|image_url|url/i.test(message)) {
    return "Garmin 截圖傳送格式已失效；請重新嘗試分析。若問題持續，請保留總覽及 Stats 畫面並分兩次上載。";
  }
  if (/json|format|parse/i.test(message)) {
    return "Garmin 截圖已送出，但分析結果格式不完整；請重試或減少至 6–8 張最清晰的畫面。";
  }
  return "Garmin 截圖暫時未能完成分析，請重試；你的已選圖片仍會保留在此視窗。";
}
