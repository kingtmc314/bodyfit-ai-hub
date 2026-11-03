import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("./storage", () => ({ storagePut: vi.fn().mockResolvedValue({ key: "import-images/2/source_hash.jpg", url: "/manus-storage/import-images/2/source_hash.jpg" }), storageReadBuffer: vi.fn() }));
vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn() }));
import { appRouter } from "./routers";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import { INBODY_MAX_BASE64_LENGTH } from "./inbodyImport";
import type { TrpcContext } from "./_core/context";
const caller = appRouter.createCaller({ user: null, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] });
const jpeg = Buffer.from([255,216,255,224,...new Array(20).fill(0)]).toString("base64");
beforeEach(() => { vi.clearAllMocks(); vi.mocked(invokeLLM).mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ detectedType: "body", date: "2020-02-29", body: { weight: 70, bodyFatPct: 0 } }) } }] } as any); });
describe("bounded generic photo extraction", () => {
  it("sends actual validated bytes to vision rather than a relative private-storage URL", async () => {
    const result = await caller.imageImport.extract({ base64: jpeg, mimeType: "image/jpeg", dataType: "body" });
    expect(result.body.bodyFatPct).toBe(0); expect(result.date).toBe("2020-02-29");
    const call = vi.mocked(invokeLLM).mock.calls[0][0];
    const content = call.messages[1].content as any[];
    expect(content[0].image_url.url).toBe(`data:image/jpeg;base64,${jpeg}`);
    expect(call.model).toBe("gpt-6.1-sol"); expect(call.timeoutMs).toBe(45000);
    expect(storagePut).toHaveBeenCalledOnce();
  });
  it("rejects overlarge, corrupt and falsely relabeled files before storage or AI", async () => {
    for (const input of [{ base64: "a".repeat(INBODY_MAX_BASE64_LENGTH+1), mimeType: "image/jpeg" }, { base64: "aW52YWxpZA==", mimeType: "image/jpeg" }, { base64: jpeg, mimeType: "image/png" }, { base64: jpeg, mimeType: "image/heic" }]) {
      await expect(caller.imageImport.extract({ ...input, dataType: "body" })).rejects.toThrow();
    }
    expect(storagePut).not.toHaveBeenCalled(); expect(invokeLLM).not.toHaveBeenCalled();
  });
  it("returns a readable retry message for empty and invalid provider JSON", async () => {
    for (const content of [null, "not-json"]) {
      vi.mocked(invokeLLM).mockResolvedValueOnce({ choices: [{ message: { content } }] } as any);
      await expect(caller.imageImport.extract({ base64: jpeg, mimeType: "image/jpeg", dataType: "body" })).rejects.toThrow("不用重新上載");
    }
  });
});
