/** Browser-only preparation: retain the entire photograph; never crop or annotate. */
export const MAX_REPORT_INPUT_BYTES = 25 * 1024 * 1024;
export const MAX_REPORT_LONG_EDGE = 2800;
export const MAX_REPORT_JPEG_BYTES = 2_400_000;
export const MAX_REPORT_JSON_BYTES = 4_500_000;

export type PreparedReportPhoto = {
  base64: string;
  mimeType: "image/jpeg";
  fileName: string;
  previewUrl?: string;
};

const DECODE_ERROR =
  "未能開啟這張相片。若是 HEIC／HEIF，請在相簿轉存為 JPEG，或以相機的「最相容」格式重新拍攝，再選取 JPEG／PNG／WebP 圖片。";

function loadPhoto(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      if (image.naturalWidth > 0 && image.naturalHeight > 0) resolve(image);
      else reject(new Error(DECODE_ERROR));
    };
    image.onerror = () => reject(new Error(DECODE_ERROR));
    // Modern browsers apply EXIF orientation when decoding an HTMLImageElement.
    // Do not apply an additional rotation, which would rotate oriented photos twice.
    image.src = url;
  });
}

function encodeJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (!blob || blob.type !== "image/jpeg") {
          reject(new Error("瀏覽器未能轉換 JPEG，請改用 JPEG 相片重試。"));
        } else resolve(blob);
      },
      "image/jpeg",
      quality
    );
  });
}

function blobBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("未能讀取壓縮後的相片，請重試。"));
    reader.onload = () => {
      if (
        typeof reader.result !== "string" ||
        !reader.result.startsWith("data:image/jpeg;base64,")
      ) {
        reject(new Error("相片編碼失敗，請改用 JPEG 相片重試。"));
        return;
      }
      resolve(reader.result.slice(reader.result.indexOf(",") + 1));
    };
    reader.readAsDataURL(blob);
  });
}

export async function prepareReportPhoto(
  file: File
): Promise<PreparedReportPhoto> {
  if (file.size > MAX_REPORT_INPUT_BYTES) {
    throw new Error("相片超過 25 MB，請先在相簿縮小或轉存為 JPEG 後重試。");
  }
  if (file.size === 0) throw new Error("這個相片檔案是空的，請重新選取。");
  const knownImageName = /\.(?:jpe?g|png|webp|heic|heif|avif|gif|bmp)$/i.test(
    file.name
  );
  if (
    (!file.type.startsWith("image/") &&
      !(file.type === "" && knownImageName)) ||
    file.type === "image/svg+xml" ||
    /\.svg$/i.test(file.name)
  ) {
    throw new Error(
      "請選取報告相片（JPEG／PNG／WebP；HEIC 需瀏覽器支援），而不是 PDF 或其他檔案。"
    );
  }

  const objectUrl = URL.createObjectURL(file);
  let canvas: HTMLCanvasElement | undefined;
  try {
    // Decode the actual bytes; never relabel unsupported HEIC bytes as JPEG.
    const image = await loadPhoto(objectUrl);
    const originalLongEdge = Math.max(image.naturalWidth, image.naturalHeight);
    let longEdge = Math.min(originalLongEdge, MAX_REPORT_LONG_EDGE);
    canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("瀏覽器不支援相片處理，請更換瀏覽器後重試。");

    let encoded: Blob | undefined;
    for (let resize = 0; resize < 9; resize += 1) {
      const scale = longEdge / originalLongEdge;
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      // JPEG has no alpha. White only provides a backdrop for transparent pixels.
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.9, 0.84, 0.78, 0.7, 0.6]) {
        const candidate = await encodeJpeg(canvas, quality);
        if (candidate.size <= MAX_REPORT_JPEG_BYTES) {
          encoded = candidate;
          break;
        }
      }
      if (encoded) break;
      // Reduce dimensions only after the quality floor has been tried.
      // Reject rather than making a full-page report too small to review.
      if (longEdge <= 1000) break;
      longEdge = Math.max(1000, Math.floor(longEdge * 0.82));
    }
    if (!encoded)
      throw new Error(
        "未能將整頁相片壓縮至安全大小，請以較低解像度重新拍攝，但保留報告四邊及清晰文字。"
      );

    // Only the bounded JPEG is read into base64; never read the large original.
    const base64 = await blobBase64(encoded);
    const stem =
      file.name
        .replace(/\.[^.]+$/, "")
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .slice(0, 100) || "inbody-report";
    const fileName = `${stem}.jpg`;
    const payload = { base64, mimeType: "image/jpeg" as const, fileName };
    if (new Blob([JSON.stringify(payload)]).size >= MAX_REPORT_JSON_BYTES) {
      throw new Error("壓縮後的相片仍超過傳送限制，請選取較小的 JPEG 相片。");
    }
    return payload;
  } finally {
    URL.revokeObjectURL(objectUrl);
    // Release backing-store memory, including on encoding/decoding failure.
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}

export default prepareReportPhoto;
