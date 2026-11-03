/** Validate transport metadata only; do not consume or alter tRPC's response body. */
export function validateTRPCResponse(response: Response): Response {
  if (response.status === 413) {
    throw new Error("相片超過上載大小限制。請重新選取相片，系統會先壓縮；如仍失敗，請改用較小的 JPEG 相片。");
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType && !contentType.toLowerCase().includes("json")) {
    throw new Error("伺服器未能回傳可辨識的資料。請重新整理 BodyFit 至最新版本後再試；如剛才正在儲存，請先核對紀錄以免重複新增。");
  }
  return response;
}

export function normalizeTRPCTransportError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  if (/string did not match the expected pattern|unexpected token.*(?:<|json)|json.*parse/i.test(message)) {
    return new Error("請求未完成或伺服器回應格式錯誤。請重新整理 BodyFit 後再試；相片會先壓縮。如剛才正在儲存，請先核對紀錄以免重複新增。");
  }
  return error instanceof Error ? error : new Error(message);
}
