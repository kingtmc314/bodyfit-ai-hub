import { describe, expect, it } from "vitest";
import { describeGarminRawImportFailure } from "../shared/garminRawImportStatus";
import { validateGarminChunkKeys } from "./routers";

describe("Garmin raw-file import reliability", () => {
  it("accepts the hash-suffixed 2MB chunk keys actually returned by storage", () => {
    const uploadId = "e2emvzd8cu0garmin";
    expect(() => validateGarminChunkKeys([
      `garmin-chunks/2/${uploadId}/0_5963cc61.part`,
      `garmin-chunks/2/${uploadId}/1_4a41dd6b.part`,
    ], uploadId)).not.toThrow();
  });

  it("rejects reordered, cross-upload, or non-part chunk keys before files are combined", () => {
    const uploadId = "e2emvzd8cu0garmin";
    expect(() => validateGarminChunkKeys([
      `garmin-chunks/2/${uploadId}/1_4a41dd6b.part`,
    ], uploadId)).toThrow(/分段來源無效/);
    expect(() => validateGarminChunkKeys([
      "garmin-chunks/2/another-upload/0_5963cc61.part",
    ], uploadId)).toThrow(/分段來源無效/);
    expect(() => validateGarminChunkKeys([
      `garmin-chunks/2/${uploadId}/0_5963cc61.bin`,
    ], uploadId)).toThrow(/分段來源無效/);
  });

  it("turns transient upload failures into a same-file retry instruction", () => {
    const result = describeGarminRawImportFailure(new Error("Storage upload to S3 failed (503)"));
    expect(result.retryable).toBe(true);
    expect(result.title).toContain("上載連線");
    expect(result.description).toContain("再次嘗試");
  });

  it("explains how to handle Garmin ZIP archives and malformed activity exports", () => {
    const zip = describeGarminRawImportFailure(new Error("請選擇 Garmin FIT、CSV、GPX 或 TCX 原始檔"));
    const invalidGpx = describeGarminRawImportFailure(new Error("無法讀取 GPX XML：Unexpected close tag"));
    expect(zip.retryable).toBe(false);
    expect(zip.description).toContain(".zip");
    expect(invalidGpx.retryable).toBe(false);
    expect(invalidGpx.description).toContain("Original FIT");
  });
});
