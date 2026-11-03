import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { createEmptyInBodyReport } from "../shared/inbodyReport";
import { decodeInBodyPhoto, extractInBodyPhoto, INBODY_MAX_PHOTO_BYTES, saveInBodyReport, validateInBodySourceKey, validateReviewedInBodyReport } from "./inbodyImport";

const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(64, 4)]);
const key = "inbody-reports/2/safeSyntheticPhoto_1234abcd.jpg";
function report() {
  const r = createEmptyInBodyReport();
  r.date = "2020-02-29";
  r.time = "23:59:59";
  r.metrics.weight = 70;
  r.metrics.muscleMass = 28;
  r.metrics.bodyFatPct = 20;
  r.metrics.fatMass = 14;
  r.metrics.bmr = 1500;
  r.metrics.muscleControlKg = 0;
  r.metrics.fatControlKg = -4;
  return r;
}
function fakeDb(existing?: { id: number; date: string }) {
  const query = vi.fn(async (sql: string, _args?: unknown[]) => {
    if (sql.startsWith("SELECT id")) return { rows: existing ? [existing] : [] };
    if (sql.includes("INSERT INTO")) return { rows: [{ id: 77, date: "2020-02-29" }] };
    return { rows: [] };
  });
  const release = vi.fn();
  const connect = vi.fn(async () => ({ query, release }));
  const read = vi.fn(async () => jpeg);
  const initDb = vi.fn(async () => ({}));
  return { query, release, connect, read, initDb, deps: { read, initDb, pool: () => ({ connect }) } as any };
}

describe("InBody photo safety", () => {
  it("validates trusted owner-scoped source keys only", () => {
    expect(() => validateInBodySourceKey(key, 2)).not.toThrow();
    for (const bad of [key.replace("/2/", "/3/"), "https://other.example/photo.jpg", "../../secret.jpg", "inbody-reports/2/foo.jpg", key + "?url=evil"]) expect(() => validateInBodySourceKey(bad, 2)).toThrow();
  });
  it("decodes JPEG without mistaking another MIME", () => {
    expect(decodeInBodyPhoto(jpeg.toString("base64"), "image/jpeg")).toEqual(jpeg);
    expect(() => decodeInBodyPhoto(jpeg.toString("base64"), "image/png")).toThrow("格式");
  });
  it("rejects bad base64 and oversized images before storage", () => {
    for (const value of ["", "%%%invalid%%%", "abc", "a".repeat(Math.ceil(INBODY_MAX_PHOTO_BYTES / 3) * 4 + 4)]) expect(() => decodeInBodyPhoto(value, "image/jpeg")).toThrow();
  });
  it("accepts genuine PNG and WebP magic signatures", () => {
    const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(12)]);
    const webp = Buffer.from("RIFF1234WEBPvp8data");
    expect(decodeInBodyPhoto(png.toString("base64"), "image/png")).toEqual(png);
    expect(decodeInBodyPhoto(webp.toString("base64"), "image/webp")).toEqual(webp);
  });
  it("never substitutes today when no complete report date was found", () => {
    const r = report(); r.date = null;
    expect(() => validateReviewedInBodyReport(r)).toThrow("日期");
  });
  it("requires a primary metric and preserves printed HK date/time", () => {
    const empty = createEmptyInBodyReport(); empty.date = "2020-02-29"; empty.metrics.totalBodyWaterKg = 35;
    expect(() => validateReviewedInBodyReport(empty)).toThrow("主要");
    expect(validateReviewedInBodyReport(report()).time).toBe("23:59:59");
  });
  it("rejects invalid reviewed numbers rather than silently clamping them", () => {
    const r = report(); r.metrics.bodyFatPct = 500;
    expect(() => validateReviewedInBodyReport(r)).toThrow();
  });
  it("requires integer BMR before touching the PostgreSQL integer field", () => {
    const r = report(); r.metrics.bmr = 1500.5;
    expect(() => validateReviewedInBodyReport(r)).toThrow("整數");
  });
});

describe("InBody structured extraction", () => {
  it("uses direct image bytes, explicit model/schema and returns review without DB writes", async () => {
    const vision = vi.fn(async () => ({ choices: [{ message: { content: JSON.stringify(report()) } }] }));
    const store = vi.fn(async () => ({ key, url: `/manus-storage/${key}` }));
    const result = await extractInBodyPhoto({ base64: jpeg.toString("base64"), mimeType: "image/jpeg", fileName: "paper.jpg" }, 2, { vision, store } as any);
    expect(result.report.metrics.muscleMass).toBe(28);
    expect(result.sourceHash).toBe(createHash("sha256").update(jpeg).digest("hex"));
    const request = vision.mock.calls[0] as any;
    expect(request[0].model).toBe("gpt-6.1-sol");
    expect(request[0].messages[1].content[0].image_url.url).toBe(`data:image/jpeg;base64,${jpeg.toString("base64")}`);
    expect(request[0].response_format.json_schema.strict).toBe(true);
  });
  it("fails clearly for blank or irrelevant photos rather than producing empty records", async () => {
    const store = vi.fn(async () => ({ key, url: `/manus-storage/${key}` }));
    const vision = vi.fn(async () => ({ choices: [{ message: { content: JSON.stringify(createEmptyInBodyReport()) } }] }));
    await expect(extractInBodyPhoto({ base64: jpeg.toString("base64"), mimeType: "image/jpeg", fileName: "blank.jpg" }, 2, { vision, store } as any)).rejects.toThrow("實測");
  });
});

describe("InBody Supabase transaction and duplicate retries", () => {
  it("commits reviewed fields and source JSONB without raw bytes or Sheets dependency", async () => {
    const f = fakeDb();
    expect(await saveInBodyReport({ report: report(), sourceKey: key, fileName: "paper.jpg" }, 2, f.deps)).toEqual({ id: 77, date: "2020-02-29", status: "created" });
    const insert = f.query.mock.calls.find(([sql]) => sql.includes("INSERT INTO"))!;
    expect(insert[0]).toContain("public.body_composition");
    const args = insert[1] as unknown[];
    expect(args.slice(0, 9)).toEqual([2, "2020-02-29", 70, 20, 28, null, 14, 1500, null]);
    const metadata = JSON.parse(args[10] as string);
    expect(metadata.report.metrics.fatControlKg).toBe(-4);
    expect(metadata.report.metrics.muscleControlKg).toBe(0);
    expect(metadata.sourceHash).toBe(createHash("sha256").update(jpeg).digest("hex"));
    expect(metadata.sourceKey).toBe(key);
    expect(JSON.stringify(metadata)).not.toContain(jpeg.toString("base64"));
    expect(f.query.mock.calls.map(([sql]) => sql)).toContain("COMMIT");
    expect(f.release).toHaveBeenCalledOnce();
  });
  it("same photo retries return the existing record without inserting or overwriting manual data", async () => {
    const f = fakeDb({ id: 66, date: "2020-02-29" });
    expect(await saveInBodyReport({ report: report(), sourceKey: key, fileName: "retry.jpg" }, 2, f.deps)).toEqual({ id: 66, date: "2020-02-29", status: "duplicate" });
    expect(f.query.mock.calls.some(([sql]) => sql.includes("INSERT") || sql.includes("UPDATE"))).toBe(false);
    expect(f.query.mock.calls[1][0]).toContain("pg_advisory_xact_lock");
    expect(f.release).toHaveBeenCalledOnce();
  });
  it("recomputes hash from trusted stored bytes rather than trusting client metadata", async () => {
    const f = fakeDb();
    await saveInBodyReport({ report: report(), sourceKey: key, fileName: "hash.jpg", sourceHash: "spoof" } as any, 2, f.deps);
    const select = f.query.mock.calls.find(([sql]) => sql.startsWith("SELECT id"))!;
    expect(select[1]).toEqual([2, createHash("sha256").update(jpeg).digest("hex")]);
  });
  it("validates missing dates and untrusted keys before reading storage or touching DB", async () => {
    const f = fakeDb(); const r = report(); r.date = null;
    await expect(saveInBodyReport({ report: r, sourceKey: key, fileName: "date.jpg" }, 2, f.deps)).rejects.toThrow("日期");
    await expect(saveInBodyReport({ report: report(), sourceKey: "https://bad.example/a", fileName: "bad.jpg" }, 2, f.deps)).rejects.toThrow("來源");
    expect(f.read).not.toHaveBeenCalled(); expect(f.connect).not.toHaveBeenCalled();
  });
  it("rolls back failures and always releases connection so retry is safe", async () => {
    const f = fakeDb();
    f.query.mockImplementation(async (sql: string) => { if (sql.includes("INSERT")) throw new Error("network save failed"); return { rows: [] }; });
    await expect(saveInBodyReport({ report: report(), sourceKey: key, fileName: "retry.jpg" }, 2, f.deps)).rejects.toThrow("network save failed");
    expect(f.query.mock.calls.map(([sql]) => sql)).toContain("ROLLBACK");
    expect(f.release).toHaveBeenCalledOnce();
  });
  it("rejects missing DB without losing the reviewed report", async () => {
    const f = fakeDb(); f.deps.pool = () => null;
    await expect(saveInBodyReport({ report: report(), sourceKey: key, fileName: "retry.jpg" }, 2, f.deps)).rejects.toThrow("不用重新上載");
    expect(f.connect).not.toHaveBeenCalled();
  });
});
