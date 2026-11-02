export type GarminRawImportFailure = {
  title: string;
  description: string;
  retryable: boolean;
};

/**
 * Turns low-level tRPC/storage/parser errors into an actionable message for the
 * reviewed Garmin raw-file import flow. It is deliberately conservative: a
 * network or chunk transport failure can be retried with the same File; an
 * unsupported or malformed export should be replaced by a real activity file.
 */
export function describeGarminRawImportFailure(error: unknown): GarminRawImportFailure {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();

  if (normalized.includes("超過 25mb") || normalized.includes("超過 25 mb")) {
    return {
      title: "原始檔超過 25MB",
      description: "請在 Garmin Connect 匯出單次活動的 Original FIT、GPX、TCX 或 CSV；較大的活動可先在 Garmin Connect 重新匯出單次檔案。",
      retryable: false,
    };
  }

  if (normalized.includes("fit、csv、gpx 或 tcx") || normalized.includes("格式與副檔名不一致")) {
    return {
      title: "不支援的 Garmin 檔案格式",
      description: "請選擇單次活動的 .fit、.csv、.gpx 或 .tcx 檔；如下載的是 .zip 壓縮檔，請先解壓並選取其中的活動原始檔。",
      retryable: false,
    };
  }

  if (normalized.includes("dtd") || normalized.includes("xml") || normalized.includes("不是有效的") || normalized.includes("沒有可讀取")) {
    return {
      title: "活動資料無法解析",
      description: "請確認這是 Garmin Connect 的活動記錄，而不是路線規劃檔、摘要檔或已損壞檔案；可改匯出同一活動的 Original FIT 再試。",
      retryable: false,
    };
  }

  if (
    normalized.includes("fetch") ||
    normalized.includes("network") ||
    normalized.includes("storage") ||
    normalized.includes("分段") ||
    normalized.includes("timeout") ||
    normalized.includes("failed to")
  ) {
    return {
      title: "上載連線暫時中斷",
      description: "已保留你選擇的檔案。請直接按「再次嘗試」；系統會重新以 2MB 分段安全上載，不需要重新選檔。",
      retryable: true,
    };
  }

  return {
    title: "未能讀取 Garmin 原始檔",
    description: "已保留你選擇的檔案。可先按「再次嘗試」；若仍失敗，請改匯出該單次活動的 Original FIT、GPX、TCX 或 CSV。",
    retryable: true,
  };
}
