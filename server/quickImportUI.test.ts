// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ extract: vi.fn(), save: vi.fn(), prepare: vi.fn(), inbody: vi.fn(), csv: vi.fn() }));
vi.mock("../client/src/lib/trpc", () => ({ trpc: {
  useUtils: () => ({ body: { getAll: { invalidate: vi.fn() } }, heartRate: { getAll: { invalidate: vi.fn() } }, sleep: { getAll: { invalidate: vi.fn() } } }),
  imageImport: {
    extract: { useMutation: () => ({ mutateAsync: mocks.extract }) },
    save: { useMutation: () => ({ mutate: mocks.save, isPending: false }) },
    extractInBody: { useMutation: () => ({ mutateAsync: mocks.inbody }) },
  },
  body: { saveInBodyReport: { useMutation: () => ({ mutateAsync: mocks.save }) } },
  csvImport: { preview: { useMutation: () => ({ mutate: mocks.csv }) }, importData: { useMutation: () => ({ mutate: mocks.csv }) } },
} }));
vi.mock("../client/src/lib/prepareReportPhoto", () => ({ prepareReportPhoto: mocks.prepare }));
let root: Root;
let host: HTMLDivElement;
const prepared = { base64: "/9j/safeBoundedJpeg", mimeType: "image/jpeg", fileName: "photo.jpg" };
beforeEach(() => {
  vi.resetAllMocks();
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
  mocks.prepare.mockResolvedValue(prepared);
  mocks.extract.mockResolvedValue({ detectedType: "sleep", date: null, sleep: { sleepScore: 0, deepSleep: 0 }, confidence: "high" });
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
async function render(dataType: "body" | "heartrate" | "sleep" = "sleep", open = true) {
  const { default: Modal } = await import("../client/src/components/QuickImportModal");
  await act(async () => root.render(React.createElement(Modal, { open, onClose: vi.fn(), dataType })));
}
function button(text: string) { return [...document.querySelectorAll("button")].find(b => b.textContent?.includes(text)) as HTMLButtonElement; }
async function photo(name = "large.png") {
  const input = document.querySelector('input[aria-label="從相簿選取圖片"]') as HTMLInputElement;
  const file = new File(["original large png"], name, { type: "image/png" });
  Object.defineProperty(input, "files", { configurable: true, value: [file] });
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
  return file;
}
async function choose(value: string) {
  const select = document.querySelector('select[aria-label="匯入範本"]') as HTMLSelectElement;
  await act(async () => { select.value = value; select.dispatchEvent(new Event("change", { bubbles: true })); });
}
describe("quick import upload safety and familiar body entry", () => {
  it("sends only normalized JPEG, preserves zero values, requires an explicit missing date, and never autosaves", async () => {
    await render(); const file = await photo();
    expect(mocks.prepare).toHaveBeenCalledWith(file);
    expect(mocks.extract).toHaveBeenCalledWith({ base64: prepared.base64, mimeType: "image/jpeg", dataType: "sleep" });
    expect(document.querySelector('input[capture="environment"]')).not.toBeNull();
    expect(document.body.textContent).toContain("睡眠評分");
    expect(document.body.textContent).toContain("深睡 (h)");
    expect((document.querySelector('#quick-import-date') as HTMLInputElement).value).toBe("");
    expect(button("儲存至").disabled).toBe(true);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("retries failed extraction from the same prepared bytes without reprocessing the original", async () => {
    mocks.extract.mockRejectedValueOnce(new Error("受控網絡失敗"));
    await render(); await photo();
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("受控網絡失敗");
    await act(async () => button("重試辨識").click());
    expect(mocks.prepare).toHaveBeenCalledOnce();
    expect(mocks.extract).toHaveBeenCalledTimes(2);
    expect(mocks.extract.mock.calls[1][0]).toEqual(mocks.extract.mock.calls[0][0]);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("ignores extraction results from an obsolete photo", async () => {
    let resolve!: (value: unknown) => void;
    mocks.extract.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    await render(); await photo("old.png"); await photo("new.png");
    await act(async () => resolve({ detectedType: "sleep", date: "2020-01-01", sleep: { sleepScore: 99 } }));
    expect((document.querySelector('#quick-import-date') as HTMLInputElement).value).toBe("");
    expect(document.body.textContent).not.toContain("99");
  });
  it("opens body import on InBody paper and offers CSV and screenshot paths with a way back", async () => {
    await render("body");
    expect((document.querySelector('#inbody-template') as HTMLSelectElement).value).toBe("inbody-paper-v1");
    expect(document.querySelector('#inbody-template')?.textContent).toContain("CSV 匯入");
    await choose("csv");
    expect(document.querySelector('textarea')?.placeholder).toContain("CSV");
    await act(async () => button("返回 InBody").click());
    expect(document.querySelector('#inbody-template')).not.toBeNull();
    await choose("generic");
    expect(document.querySelector('input[aria-label="從相簿選取圖片"]')).not.toBeNull();
    expect(button("返回 InBody")).toBeDefined();
    expect(mocks.inbody).not.toHaveBeenCalled(); expect(mocks.save).not.toHaveBeenCalled();
  });
  it("keeps heart-rate photo import available", async () => {
    mocks.extract.mockResolvedValue({ detectedType: "heartrate", date: "2020-01-01", heartrate: { restingHr: 55 } });
    await render("heartrate"); await photo();
    expect(mocks.extract.mock.calls[0][0].dataType).toBe("heartrate");
    expect(document.body.textContent).toContain("靜息心率");
    expect(button("儲存至").disabled).toBe(false);
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
