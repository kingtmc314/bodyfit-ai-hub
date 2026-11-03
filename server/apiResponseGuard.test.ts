import { describe, expect, it } from "vitest";
import { normalizeTRPCTransportError, validateTRPCResponse } from "../client/src/lib/apiResponseGuard";
describe("tRPC non-JSON response safety", () => {
  it("identifies the exact Vercel 413 body before Safari JSON parsing", () => {
    const response = new Response("Request Entity Too Large\nFUNCTION_PAYLOAD_TOO_LARGE", { status: 413, headers: { "content-type": "text/plain" } });
    expect(() => validateTRPCResponse(response)).toThrow("相片超過上載大小限制");
    expect(response.bodyUsed).toBe(false);
  });
  it("does not parse HTML app shells or gateway failures as JSON", () => {
    expect(() => validateTRPCResponse(new Response("<!doctype html>", { headers: { "content-type": "text/html" } }))).toThrow("最新版本");
  });
  it("preserves valid JSON response body, identity and status", async () => {
    const response = Response.json({ result: { data: { json: { ok: true } } } });
    expect(validateTRPCResponse(response)).toBe(response);
    expect(response.bodyUsed).toBe(false);
    expect((await response.json()).result.data.json.ok).toBe(true);
    const error = Response.json({ error: "synthetic" }, { status: 400 });
    expect(validateTRPCResponse(error)).toBe(error);
  });
  it("translates Safari pattern failures without leaking raw server content", () => {
    expect(normalizeTRPCTransportError(new SyntaxError("The string did not match the expected pattern.")).message).toContain("重新整理 BodyFit");
    const e = new Error("synthetic existing error");
    expect(normalizeTRPCTransportError(e)).toBe(e);
  });
});
