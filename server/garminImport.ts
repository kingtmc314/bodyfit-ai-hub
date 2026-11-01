export type GarminVisionContent =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail: "high" } };

export type GarminVisionScreenshot = {
  base64: string;
  mimeType: string;
};

export type GarminExtraction = {
  date: string | null;
  time: string | null;
  running: Record<string, unknown>;
  garminDetails: Record<string, unknown>;
  laps: Array<Record<string, unknown>>;
  confidence: "high" | "medium" | "low";
  notes: string;
};

export const MAX_GARMIN_SCREENSHOTS = 16;
export const MAX_GARMIN_SCREENSHOT_BYTES = 10 * 1024 * 1024;
export const MAX_GARMIN_BATCH_SIZE = 5;
export const MAX_GARMIN_TOTAL_BYTES = 30 * 1024 * 1024;

const SUPPORTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function asDataImageUrl(screenshot: GarminVisionScreenshot): string {
  const mimeType = screenshot.mimeType.toLowerCase().trim();
  if (!SUPPORTED_IMAGE_TYPES.has(mimeType)) {
    throw new Error("Garmin 截圖只支援 PNG、JPG 或 WEBP 格式");
  }
  const payload = screenshot.base64.replace(/\s/g, "");
  if (!payload || !/^[A-Za-z0-9+/]+={0,2}$/.test(payload)) {
    throw new Error("Garmin 截圖資料格式無法讀取，請重新選擇圖片");
  }
  const bytes = Buffer.byteLength(payload, "base64");
  if (bytes > MAX_GARMIN_SCREENSHOT_BYTES) {
    throw new Error(`單張 Garmin 截圖不可超過 ${MAX_GARMIN_SCREENSHOT_BYTES / 1024 / 1024}MB`);
  }
  return `data:${mimeType};base64,${payload}`;
}

/**
 * Direct data-image URLs avoid signed storage URL validation and expiry issues in
 * vision providers.  The API uses this only for the active analysis request;
 * sources are still stored only after a user reviews and saves the run.
 */
export function buildGarminVisionBatches(
  screenshots: GarminVisionScreenshot[],
  batchSize = MAX_GARMIN_BATCH_SIZE,
): string[][] {
  if (!screenshots.length) throw new Error("請至少提供一張 Garmin 截圖");
  if (screenshots.length > MAX_GARMIN_SCREENSHOTS) {
    throw new Error(`一次最多分析 ${MAX_GARMIN_SCREENSHOTS} 張 Garmin 截圖`);
  }
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > MAX_GARMIN_BATCH_SIZE) {
    throw new Error(`每批 Garmin 截圖最多 ${MAX_GARMIN_BATCH_SIZE} 張`);
  }

  let totalBytes = 0;
  const dataImageUrls = screenshots.map((screenshot) => {
    const url = asDataImageUrl(screenshot);
    totalBytes += Buffer.byteLength(screenshot.base64.replace(/\s/g, ""), "base64");
    return url;
  });
  if (totalBytes > MAX_GARMIN_TOTAL_BYTES) {
    throw new Error("這批 Garmin 截圖合計超過 30MB，請分兩次分析或保留最清晰的總覽、Stats 與 Laps 畫面");
  }

  return Array.from({ length: Math.ceil(dataImageUrls.length / batchSize) }, (_, index) =>
    dataImageUrls.slice(index * batchSize, (index + 1) * batchSize),
  );
}

/** Vision request content deliberately contains only OpenAI-compatible text and image_url parts. */
export function buildGarminVisionContent(
  dataImageUrls: string[],
  prompt: string,
): GarminVisionContent[] {
  if (!dataImageUrls.length) throw new Error("請至少提供一張 Garmin 截圖");
  for (const url of dataImageUrls) {
    if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/i.test(url)) {
      throw new Error("Garmin 截圖未取得可供分析的圖片資料，請重新選擇圖片後再試");
    }
  }

  return [
    { type: "text", text: prompt },
    ...dataImageUrls.map((url) => ({
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

function hasValue(value: unknown): boolean {
  return value !== null && value !== undefined && value !== "";
}

function mergeRecordValues(records: Array<Record<string, unknown>>): Record<string, unknown> {
  return records.reduce<Record<string, unknown>>((merged, record) => {
    for (const [key, value] of Object.entries(record)) {
      if (!hasValue(merged[key]) && hasValue(value)) merged[key] = value;
    }
    return merged;
  }, {});
}

function completedValueCount(record: Record<string, unknown>): number {
  return Object.values(record).filter(hasValue).length;
}

/**
 * Merge sequential vision batches without inventing values. Earlier batches win
 * (the UI asks users to place Overview/Stats first); later batches only complete
 * blanks. Laps are de-duplicated by their explicit Garmin lap number.
 */
export function mergeGarminExtractions(extractions: GarminExtraction[]): GarminExtraction {
  if (!extractions.length) throw new Error("沒有可合併的 Garmin 分析結果");
  const firstValue = <T>(values: T[], empty: T) => values.find((value) => hasValue(value)) ?? empty;
  const lapByNumber = new Map<number, Record<string, unknown>>();

  for (const extraction of extractions) {
    for (const lap of extraction.laps) {
      const number = typeof lap.lap === "number" && Number.isFinite(lap.lap) ? lap.lap : null;
      if (number === null) continue;
      const existing = lapByNumber.get(number);
      if (!existing || completedValueCount(lap) > completedValueCount(existing)) lapByNumber.set(number, lap);
    }
  }

  const confidenceRank = { high: 2, medium: 1, low: 0 } as const;
  const confidence = extractions.reduce<GarminExtraction["confidence"]>(
    (lowest, extraction) => confidenceRank[extraction.confidence] < confidenceRank[lowest] ? extraction.confidence : lowest,
    "high",
  );
  const notes = Array.from(new Set(extractions.map((item) => item.notes.trim()).filter(Boolean))).join(" ");

  return {
    date: firstValue(extractions.map((item) => item.date), null),
    time: firstValue(extractions.map((item) => item.time), null),
    running: mergeRecordValues(extractions.map((item) => item.running)),
    garminDetails: mergeRecordValues(extractions.map((item) => item.garminDetails)),
    laps: Array.from(lapByNumber.entries()).sort(([left], [right]) => left - right).map(([, lap]) => lap),
    confidence,
    notes: notes || "已合併多張 Garmin 截圖，請核對數據後再儲存。",
  };
}

export function describeGarminImportError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/total.*30mb|超過 30mb/i.test(message)) {
    return "這批 Garmin 截圖合計超過 30MB；請分兩次分析，或保留總覽、Stats、Laps 與最重要的 Charts 畫面。";
  }
  if (/png、jpg|webp|圖片資料|base64/i.test(message)) {
    return "請使用 PNG、JPG 或 WEBP 的 Garmin 截圖後重試。";
  }
  if (/json|format|parse/i.test(message)) {
    return "分析服務回傳格式不完整；請重試。系統會將多於 5 張的截圖自動分批合併。";
  }
  return "Garmin 截圖暫時未能完成分析，請重試；系統會自動分批處理已選圖片。";
}
