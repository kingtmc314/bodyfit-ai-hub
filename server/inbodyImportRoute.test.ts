import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import { extractInBodyPhoto, saveInBodyReport, INBODY_MAX_BASE64_LENGTH } from "./inbodyImport";
import { createEmptyInBodyReport } from "../shared/inbodyReport";
import type { TrpcContext } from "./_core/context";
vi.mock("./inbodyImport", async (original) => {
  const actual = await original<typeof import("./inbodyImport")>();
  return { ...actual, extractInBodyPhoto: vi.fn(), saveInBodyReport: vi.fn() };
});
const caller = appRouter.createCaller({ user: null, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] });
beforeEach(() => vi.resetAllMocks());
describe("InBody endpoints", () => {
  it("extracts into a review contract with no persistence call", async () => {
    const input = { base64: "abcd", mimeType: "image/jpeg" as const, fileName: "paper.jpg" };
    const report = createEmptyInBodyReport();
    vi.mocked(extractInBodyPhoto).mockResolvedValue({ report, sourceKey: "key", sourceHash: "hash", imageUrl: "/manus-storage/key", fileName: input.fileName });
    await expect(caller.imageImport.extractInBody(input)).resolves.toMatchObject({ report });
    expect(extractInBodyPhoto).toHaveBeenCalledWith(input, 2);
    expect(saveInBodyReport).not.toHaveBeenCalled();
  });
  it.each(["text/html", "image/svg+xml", "application/pdf", "image/heic"])("rejects non-normalized upload MIME %s", async (mimeType) => {
    await expect(caller.imageImport.extractInBody({ base64: "abcd", mimeType: mimeType as any, fileName: "bad" })).rejects.toThrow();
    expect(extractInBodyPhoto).not.toHaveBeenCalled();
  });
  it("rejects overlarge base64 before storage/vision", async () => {
    await expect(caller.imageImport.extractInBody({ base64: "a".repeat(INBODY_MAX_BASE64_LENGTH + 1), mimeType: "image/jpeg", fileName: "large.jpg" })).rejects.toThrow();
    expect(extractInBodyPhoto).not.toHaveBeenCalled();
  });
  it("passes reviewed typed report and source only after explicit save", async () => {
    const report = createEmptyInBodyReport(); report.date = "2020-01-01"; report.metrics.weight = 70;
    const input = { report, sourceKey: "inbody-reports/2/synthetic123_1234abcd.jpg", fileName: "paper.jpg" };
    vi.mocked(saveInBodyReport).mockResolvedValue({ id: 2, date: report.date, status: "created" });
    await expect(caller.body.saveInBodyReport(input)).resolves.toEqual({ id: 2, date: report.date, status: "created" });
    expect(saveInBodyReport).toHaveBeenCalledWith(input, 2);
    expect(extractInBodyPhoto).not.toHaveBeenCalled();
  });
  it("rejects malformed report dates or impossible values", async () => {
    const report = createEmptyInBodyReport(); report.date = "2020-02-30";
    await expect(caller.body.saveInBodyReport({ report, sourceKey: "key", fileName: "bad.jpg" })).rejects.toThrow();
    expect(saveInBodyReport).not.toHaveBeenCalled();
  });
});
