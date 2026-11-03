// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyInBodyReport } from "../shared/inbodyReport";

const mocks = vi.hoisted(() => ({ extract: vi.fn(), save: vi.fn(), prepare: vi.fn() }));
vi.mock("../client/src/lib/trpc", () => ({ trpc: { imageImport: { extractInBody: { useMutation: () => ({ mutateAsync: mocks.extract }) } }, body: { saveInBodyReport: { useMutation: () => ({ mutateAsync: mocks.save }) } } } }));
vi.mock("../client/src/lib/prepareReportPhoto", () => ({ prepareReportPhoto: mocks.prepare }));
let root: Root; let host: HTMLDivElement;
const sourceKey = "inbody-reports/2/syntheticPhoto_1234abcd.jpg";
const onSaved = vi.fn(); const onOpenChange = vi.fn();
function result(date: string | null = "2020-02-29") {
  const report = createEmptyInBodyReport(); report.date = date; report.time = "23:59:59";
  report.metrics.weight = 70; report.metrics.bmr = 1500; report.metrics.muscleControlKg = 0; report.metrics.fatControlKg = -4;
  return { report, sourceKey, sourceHash: "hash", imageUrl: `/manus-storage/${sourceKey}`, fileName: "paper.jpg" };
}
beforeEach(() => {
  vi.resetAllMocks();
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  (URL as any).createObjectURL = vi.fn(() => "blob:private-preview");
  (URL as any).revokeObjectURL = vi.fn();
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
  mocks.prepare.mockResolvedValue({ base64: "safeCompressedBytes", mimeType: "image/jpeg", fileName: "paper.jpg" });
  mocks.extract.mockResolvedValue(result());
  mocks.save.mockResolvedValue({ id: 55, date: "2020-02-29", status: "created" });
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
async function render() {
  const { default: Importer } = await import("../client/src/components/InBodyReportImporter");
  await act(async () => root.render(React.createElement(Importer, { open: true, onOpenChange, onSaved })));
}
async function selectPhoto() {
  const input = document.querySelector('input[aria-label="從相簿選取 InBody 報告"]') as HTMLInputElement;
  Object.defineProperty(input, "files", { configurable: true, value: [new File(["photo"], "paper.jpg", { type: "image/jpeg" })] });
  await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); });
}
function button(text: string) { return [...document.querySelectorAll("button")].find(b => b.textContent?.includes(text)) as HTMLButtonElement; }

describe("InBody paper camera review", () => {
  it("offers rear camera and gallery plus a distinct InBody template", async () => {
    await render();
    expect(document.querySelector('input[capture="environment"]')?.getAttribute("accept")).toContain("image/");
    expect(document.querySelector('select[aria-label="匯入範本"]')?.textContent).toContain("InBody 紙本報告");
    expect(button("確認儲存").disabled).toBe(true);
  });
  it("photo extraction fills a review but does not save until confirmation", async () => {
    await render(); await selectPhoto();
    expect((document.querySelector("#inbody-weight") as HTMLInputElement).value).toBe("70");
    expect((document.querySelector("#inbody-date") as HTMLInputElement).value).toBe("2020-02-29");
    expect(mocks.extract).toHaveBeenCalledOnce(); expect(mocks.save).not.toHaveBeenCalled();
    await act(async () => button("確認儲存").click());
    expect(mocks.save).toHaveBeenCalledOnce(); expect(onSaved).toHaveBeenCalledOnce();
    expect(document.body.textContent).toContain("55");
  });
  it("save failure retains the same report/source, retry uses no new upload/OCR", async () => {
    mocks.save.mockRejectedValueOnce(new Error("受控網絡失敗"));
    await render(); await selectPhoto();
    await act(async () => button("確認儲存").click());
    expect(document.body.textContent).toContain("受控網絡失敗");
    await act(async () => button("重試儲存").click());
    expect(mocks.prepare).toHaveBeenCalledOnce(); expect(mocks.extract).toHaveBeenCalledOnce(); expect(mocks.save).toHaveBeenCalledTimes(2);
    expect(mocks.save.mock.calls[0][0]).toEqual(mocks.save.mock.calls[1][0]);
    expect(mocks.save.mock.calls[1][0].sourceKey).toBe(sourceKey);
  });
  it("missing report date remains blank and blocks save without guessing today", async () => {
    mocks.extract.mockResolvedValue(result(null));
    await render(); await selectPhoto();
    expect((document.querySelector("#inbody-date") as HTMLInputElement).value).toBe("");
    expect(button("確認儲存").disabled).toBe(true); expect(mocks.save).not.toHaveBeenCalled();
  });
  it("synchronous duplicate clicks cannot submit twice", async () => {
    let resolve!: (value: any) => void;
    mocks.save.mockImplementation(() => new Promise(r => { resolve = r; }));
    await render(); await selectPhoto();
    await act(async () => { const b = button("確認儲存"); b.click(); b.click(); });
    expect(mocks.save).toHaveBeenCalledOnce();
    await act(async () => resolve({ id: 55, date: "2020-02-29", status: "created" }));
    expect(onSaved).toHaveBeenCalledOnce();
  });
  it("selecting a new photo clears the prior source before the new extraction resolves", async () => {
    await render(); await selectPhoto();
    let resolve!: (value: any) => void;
    mocks.extract.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    await selectPhoto();
    expect(button("確認儲存").disabled).toBe(true); expect(document.querySelector("#inbody-weight")).toBeNull();
    await act(async () => resolve(result()));
    expect(button("確認儲存").disabled).toBe(false);
  });
});

describe("saved InBody report details", () => {
  async function showDetails(metadata: unknown, primary?: Record<string, unknown>) {
    const { default: Details } = await import("../client/src/components/InBodyReportDetails");
    await act(async () => root.render(React.createElement(Details, { reportDetails: metadata, primary })));
    const open = button("InBody 報告"); if (open) await act(async () => open.click());
  }
  it("shows printed HK date/time and current edited primary values without replacing metadata", async () => {
    await showDetails(result(), { weight: 71, bodyFatPct: null });
    expect(document.body.textContent).toContain("2020-02-29");
    expect(document.body.textContent).toContain("23:59:59");
    expect(document.body.textContent).toContain("71 kg");
    expect(document.body.textContent).not.toContain("NaN");
    expect(document.querySelector('img')?.getAttribute("src")).toBe(`/manus-storage/${sourceKey}`);
  });
  it("never embeds an arbitrary URL or other owner's photo from metadata", async () => {
    await showDetails({ ...result(), sourceKey: "https://bad.example/private.jpg" });
    expect(document.querySelector('img')).toBeNull();
    expect(document.body.textContent).toContain("InBody 報告");
  });
  it("ignores missing/malformed metadata without breaking older manual records", async () => {
    await showDetails(null);
    expect(button("InBody 報告")).toBeUndefined();
  });
});
