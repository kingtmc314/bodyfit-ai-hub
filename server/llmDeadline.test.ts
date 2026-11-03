import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("./_core/env", () => ({ ENV: { forgeApiUrl: "https://example.invalid", forgeApiKey: "synthetic-test-key" } }));
import { invokeLLM } from "./_core/llm";
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
const params = { model: "gpt-6.1-sol", messages: [{ role: "user" as const, content: "synthetic fixture" }], maxTokens: 2200, reasoning: { effort: "low" as const }, timeoutMs: 45 };
describe("interactive LLM deadlines", () => {
  it("aborts a pending request and returns a safe actionable message", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn((_url: unknown, init: RequestInit) => new Promise((_resolve, reject) => init.signal!.addEventListener("abort", () => reject(new Error("aborted")))));
    vi.stubGlobal("fetch", fetcher);
    const pending = invokeLLM(params);
    const checked = expect(pending).rejects.toThrow("健康紀錄沒有變更");
    await vi.advanceTimersByTimeAsync(45); await checked;
    expect((fetcher.mock.calls[0][1].signal as AbortSignal).aborted).toBe(true);
  });
  it("preserves GPT token shape and clears deadlines after success", async () => {
    vi.useFakeTimers();
    const response = { choices: [{ message: { content: "fixture response" } }] };
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => response });
    vi.stubGlobal("fetch", fetcher);
    await expect(invokeLLM(params)).resolves.toEqual(response);
    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(body.max_completion_tokens).toBe(2200); expect(body.max_tokens).toBeUndefined();
    expect(body.timeoutMs).toBeUndefined(); expect(body.reasoning.effort).toBe("low");
    expect(vi.getTimerCount()).toBe(0);
  });
  it("leaves existing callers without an optional deadline unchanged", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [] }) });
    vi.stubGlobal("fetch", fetcher);
    await invokeLLM({ model: "gpt-6.1-sol", messages: [{ role: "user", content: "fixture" }] });
    expect(fetcher.mock.calls[0][1].signal).toBeUndefined();
  });
});
