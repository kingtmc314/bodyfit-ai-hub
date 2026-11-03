import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import { saveGarminImport } from "./garminDirectSave";
import type { TrpcContext } from "./_core/context";

vi.mock("./garminDirectSave", () => ({ saveGarminImport: vi.fn() }));

const caller = appRouter.createCaller({
  user: null,
  req: { protocol: "https", headers: {} } as TrpcContext["req"],
  res: {} as TrpcContext["res"],
});

beforeEach(() => vi.resetAllMocks());

describe("running.saveGarminImport endpoint", () => {
  it("validates an original object key and passes only the save contract to the service", async () => {
    const input = {
      fileKey: "garmin-originals/2/activity_1234abcd.fit", fileName: "activity.fit", mimeType: "application/octet-stream", runningLogId: 17,
    };
    const result = { id: 17, action: "attached" as const, date: "2026-11-02", fields: { runningShoes: "preserved" }, sampleCount: 0, garminDetails: {}, laps: [], timeSeries: [] };
    vi.mocked(saveGarminImport).mockResolvedValue(result);
    await expect(caller.running.saveGarminImport(input)).resolves.toEqual(result);
    expect(saveGarminImport).toHaveBeenCalledWith(input);
  });

  it.each([
    "garmin-staging/2/activity1234.fit",
    "garmin-chunks/2/activity1234/0_1234abcd.part",
    "garmin-originals/2/activity.fit",
    "garmin-originals/2/../activity_1234abcd.fit",
    "https://example.com/activity_1234abcd.fit",
  ])("rejects untrusted source %s before reading/parsing or persistence", async fileKey => {
    await expect(caller.running.saveGarminImport({ fileKey, fileName: "activity.fit" })).rejects.toThrow(/原始檔來源/);
    expect(saveGarminImport).not.toHaveBeenCalled();
  });

  it("rejects a nonpositive edit target before calling the service", async () => {
    await expect(caller.running.saveGarminImport({ fileKey: "garmin-originals/2/activity_1234abcd.fit", fileName: "activity.fit", runningLogId: 0 })).rejects.toThrow();
    expect(saveGarminImport).not.toHaveBeenCalled();
  });
});
