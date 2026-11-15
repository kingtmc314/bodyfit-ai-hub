// @vitest-environment jsdom
import React, { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GarminRawFileImporter, { type GarminDirectSaved } from "../client/src/components/GarminRawFileImporter";

const api = vi.hoisted(() => ({ upload: vi.fn(), parse: vi.fn(), save: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("@/lib/trpc", () => ({
  trpc: { running: {
    uploadGarminRawChunk: { useMutation: () => ({ mutateAsync: api.upload, isPending: false }) },
    parseGarminRawFile: { useMutation: () => ({ mutateAsync: api.parse, isPending: false }) },
    saveGarminImport: { useMutation: () => ({ mutateAsync: api.save, isPending: false }) },
  } },
}));
vi.mock("sonner", () => ({ toast: { success: api.success, error: api.error } }));
vi.mock("@/components/GarminTimeSeriesChart", () => ({ default: () => React.createElement("div", { "data-testid": "raw-chart" }, "原始曲線預覽") }));

const originalKey = "garmin-originals/2/activity_1234abcd.fit";
const preview = {
  sourceFormat: "FIT", fields: { distanceKm: "5.2", averagePace: "5:30" },
  garminDetails: {}, laps: [], timeSeries: [{ elapsedSec: 0, heartRate: 140 }], warnings: [], rawFileKey: originalKey,
};
function result(id = 42): GarminDirectSaved {
  return {
    id, action: "created", date: "2026-11-02", sampleCount: 1,
    fields: { date: "2026-11-02", distanceKm: "5.2", runningShoes: "existing shoes", notes: "existing notes", temperature: "24" },
    garminDetails: {}, laps: [], timeSeries: preview.timeSeries,
  };
}
function conflict(message = "原始檔身份存在衝突") {
  return Object.assign(new Error(message), { data: { code: "CONFLICT" } });
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

type ImporterProps = React.ComponentProps<typeof GarminRawFileImporter>;
let root: Root;
let host: HTMLDivElement;
let onSaved: ReturnType<typeof vi.fn>;
let onBusyChange: ReturnType<typeof vi.fn>;
let onUnconfirmedChange: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.resetAllMocks();
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  // Deterministic file reading only; render and all user events use real React DOM.
  vi.stubGlobal("FileReader", class {
    result = "data:application/octet-stream;base64,Zml0";
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    readAsDataURL() { queueMicrotask(() => this.onload?.()); }
  });
  api.upload.mockResolvedValue({ fileKey: "garmin-chunks/2/upload/0_1234abcd.part" });
  api.parse.mockResolvedValue(preview);
  api.save.mockResolvedValue(result());
  onSaved = vi.fn(); onBusyChange = vi.fn(); onUnconfirmedChange = vi.fn();
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove(); vi.unstubAllGlobals();
  delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT;
});
async function render(props: Partial<ImporterProps> = {}) {
  await act(async () => root.render(React.createElement(GarminRawFileImporter, { onSaved, onBusyChange, onUnconfirmedChange, ...props })));
}
async function choose(name = "first.fit") {
  const input = host.querySelector('input[type="file"]') as HTMLInputElement;
  await act(async () => {
    Object.defineProperty(input, "files", { configurable: true, value: [new File(["fit"], name, { type: "application/octet-stream" })] });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
function button(label: string) {
  const found = [...host.querySelectorAll("button")].find(node => node.textContent?.includes(label));
  expect(found, `button ${label}`).toBeDefined();
  return found!;
}
async function click(label: string) { await act(async () => button(label).click()); }
function expectPayload(index: number, id: number | undefined, fileKey = originalKey, fileName = "first.fit") {
  // Exact existing contract: no confirm-replace, forced-new/separate, or overwrite flags.
  expect(api.save.mock.calls[index][0]).toEqual({ fileKey, fileName, mimeType: "application/octet-stream", runningLogId: id });
}

describe("Garmin raw import conflict recovery (real React DOM)", () => {
  it("keeps the preview on a structured permanent conflict without offering same-target retry", async () => {
    api.save.mockRejectedValueOnce(conflict());
    await render({ runningLogId: 17 }); await choose();
    expectPayload(0, 17);
    expect(host.textContent).toContain("匯入模式：指定紀錄 #17");
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("原檔衝突，資料未更改");
    expect(host.textContent).toContain("查看全部");
    expect(host.querySelector('[data-testid="raw-chart"]')).not.toBeNull();
    expect(host.textContent).toContain("改為自動配對（保留現有紀錄）");
    expect(host.textContent).not.toContain("重試儲存（不用重新上載）");
    expect(onSaved).not.toHaveBeenCalled();
    expect(onUnconfirmedChange).toHaveBeenLastCalledWith(true);
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
    await click("清除");
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(host.querySelector('[data-testid="raw-chart"]')).toBeNull();
    expect(api.save).toHaveBeenCalledTimes(1);
    expect(onSaved).not.toHaveBeenCalled();
    expect(onUnconfirmedChange).toHaveBeenLastCalledWith(false);
  });

  it.each([
    "這筆跑步紀錄已連結不同的 Garmin 原始檔，為免覆蓋現有曲線，本次未更改資料；請檢查所選歷史紀錄。",
    "這個 Garmin 原始檔已連結另一筆跑步紀錄，不能覆蓋目前選取的紀錄；請編輯已連結的紀錄。",
  ])("recognizes the precise older permanent message without requiring a code: %s", async message => {
    api.save.mockRejectedValueOnce(new Error(message));
    await render({ runningLogId: 17 }); await choose();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("原檔衝突，資料未更改");
    expect(host.textContent).not.toContain("重試儲存（不用重新上載）");
    expect(onUnconfirmedChange).toHaveBeenLastCalledWith(true);
  });

  it.each([
    new Error("Network request failed (503)"),
    Object.assign(new Error("其他資料衝突或未知錯誤"), { data: { code: "INTERNAL_SERVER_ERROR" } }),
  ])("does not misclassify ordinary errors and retries the identical staged key/id exactly once", async error => {
    api.save.mockRejectedValueOnce(error);
    await render({ runningLogId: 17 }); await choose();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("跑步紀錄尚未確認儲存");
    expect(host.textContent).not.toContain("原檔衝突，資料未更改");
    expect(host.textContent).not.toContain("改為自動配對（保留現有紀錄）");
    expect(onUnconfirmedChange).toHaveBeenLastCalledWith(true);
    await render({ runningLogId: 99 });
    expect(host.textContent).toContain("匯入模式：指定紀錄 #17");
    const retry = deferred<GarminDirectSaved>();
    api.save.mockImplementationOnce(() => retry.promise);
    // The synchronous ref guard prevents two events in the same React batch.
    await act(async () => { const retryButton = button("重試儲存"); retryButton.click(); retryButton.click(); });
    expect(api.save).toHaveBeenCalledTimes(2);
    expectPayload(0, 17); expectPayload(1, 17);
    expect(button("清除").disabled).toBe(true);
    expect(button("正在保存跑步與圖表").disabled).toBe(true);
    expect(onBusyChange).toHaveBeenLastCalledWith(true);
    expect(onUnconfirmedChange).toHaveBeenLastCalledWith(true);
    await act(async () => retry.resolve(result()));
    expect(api.upload).toHaveBeenCalledTimes(1); expect(api.parse).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledWith(result());
    expect(api.success).toHaveBeenCalledTimes(1);
    expect(onUnconfirmedChange).toHaveBeenLastCalledWith(false);
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });

  it("switches an explicit conflict to automatic using the staged key, preserving manual state until success", async () => {
    const automatic = deferred<GarminDirectSaved>();
    api.save.mockRejectedValueOnce(conflict()).mockImplementationOnce(() => automatic.promise);
    const onAutomatic = vi.fn();
    function Parent() {
      const [target, setTarget] = useState<number | undefined>(17);
      const [manualId, setManualId] = useState(17);
      const [manualForm, setManualForm] = useState("original shoes / notes / weather");
      return React.createElement(React.Fragment, null,
        React.createElement("output", { "data-testid": "manual" }, `${manualId}: ${manualForm}`),
        React.createElement(GarminRawFileImporter, {
          runningLogId: target, onUnconfirmedChange,
          onUseAutomaticMatch: () => { onAutomatic(); setTarget(undefined); },
          onSaved: saved => { onSaved(saved); setManualId(saved.id); setManualForm(saved.fields.runningShoes!); },
        }),
      );
    }
    await act(async () => root.render(React.createElement(Parent)));
    await choose();
    const manual = () => host.querySelector('[data-testid="manual"]')?.textContent;
    expect(manual()).toBe("17: original shoes / notes / weather");
    await act(async () => { const action = button("改為自動配對"); action.click(); action.click(); });
    expect(onAutomatic).toHaveBeenCalledTimes(1);
    expectPayload(0, 17); expectPayload(1, undefined);
    expect(api.upload).toHaveBeenCalledTimes(1); expect(api.parse).toHaveBeenCalledTimes(1);
    expect(manual()).toBe("17: original shoes / notes / weather");
    expect(onSaved).not.toHaveBeenCalled();
    expect(onUnconfirmedChange).toHaveBeenLastCalledWith(true);
    expect(host.textContent).toContain("匯入模式：自動配對");
    expect(button("清除").disabled).toBe(true);
    await act(async () => automatic.resolve(result(81)));
    expect(manual()).toBe("81: existing shoes");
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledWith(result(81));
    expect(onUnconfirmedChange).toHaveBeenLastCalledWith(false);
    expect(host.textContent).toContain("下一個檔案仍會自動配對");
  });

  it("allows an automatic recheck to remain conflicted without forced-create, overwrite, or another retry", async () => {
    const onAutomatic = vi.fn();
    api.save.mockRejectedValue(conflict());
    await render({ runningLogId: 17, onUseAutomaticMatch: onAutomatic }); await choose();
    await click("改為自動配對");
    expectPayload(0, 17); expectPayload(1, undefined);
    expect(onAutomatic).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain("原檔衝突，資料未更改");
    expect(host.textContent).toContain("查看全部");
    expect(host.textContent).not.toContain("重試儲存（不用重新上載）");
    expect(host.textContent).not.toContain("改為自動配對（保留現有紀錄）");
    expect(host.querySelector('[data-testid="raw-chart"]')).not.toBeNull();
    expect(onSaved).not.toHaveBeenCalled();
    expect(onUnconfirmedChange).toHaveBeenLastCalledWith(true);
    await click("清除");
    expect(api.save).toHaveBeenCalledTimes(2); expect(api.upload).toHaveBeenCalledTimes(1); expect(api.parse).toHaveBeenCalledTimes(1);
    expect(onUnconfirmedChange).toHaveBeenLastCalledWith(false);
  });

  it("an initial automatic conflict only offers history/clear, not explicit-target recovery", async () => {
    api.save.mockRejectedValueOnce(conflict());
    await render(); await choose();
    expectPayload(0, undefined);
    expect(host.textContent).toContain("原檔衝突，資料未更改");
    expect(host.textContent).toContain("查看全部");
    expect(host.textContent).not.toContain("重試儲存（不用重新上載）");
    expect(host.textContent).not.toContain("改為自動配對（保留現有紀錄）");
    expect(host.querySelector('[data-testid="raw-chart"]')).not.toBeNull();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("captures the target when choosing a file even if the parent id changes during upload and before retry", async () => {
    const uploading = deferred<{ fileKey: string }>();
    api.upload.mockImplementationOnce(() => uploading.promise);
    api.save.mockRejectedValueOnce(new Error("Connection lost"));
    await render({ runningLogId: 17 }); await choose();
    expect(api.save).not.toHaveBeenCalled();
    expect(button("清除").disabled).toBe(true);
    await render({ runningLogId: 99 });
    expect(host.textContent).toContain("匯入模式：指定紀錄 #17");
    await choose("ignored-while-busy.fit");
    expect(api.upload).toHaveBeenCalledTimes(1);
    await act(async () => uploading.resolve({ fileKey: "garmin-chunks/2/upload/0_1234abcd.part" }));
    expectPayload(0, 17);
    await render({ runningLogId: undefined });
    await click("重試儲存");
    expectPayload(1, 17);
    expect(api.upload).toHaveBeenCalledTimes(1); expect(api.parse).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it("automatic onSaved updates only the manual id: the next file stays automatic and failures keep that manual form", async () => {
    const second = deferred<GarminDirectSaved>();
    api.parse.mockResolvedValueOnce(preview).mockResolvedValueOnce({ ...preview, rawFileKey: "garmin-originals/2/second_5678abcd.fit" });
    api.save.mockResolvedValueOnce(result(42)).mockRejectedValueOnce(new Error("Network lost")).mockImplementationOnce(() => second.promise);
    function Parent() {
      const [target, setTarget] = useState<number | undefined>(undefined);
      const [manualId, setManualId] = useState<number | undefined>(undefined);
      const [manualForm, setManualForm] = useState("unsaved manual form");
      return React.createElement(React.Fragment, null,
        React.createElement("output", { "data-testid": "manual" }, `${manualId}: ${manualForm}`),
        React.createElement(GarminRawFileImporter, {
          runningLogId: target, onUnconfirmedChange,
          onUseAutomaticMatch: () => setTarget(undefined),
          onSaved: saved => { onSaved(saved); setManualId(saved.id); setManualForm(saved.fields.runningShoes!); },
        }),
      );
    }
    await act(async () => root.render(React.createElement(Parent)));
    await choose();
    expectPayload(0, undefined);
    expect(host.querySelector('[data-testid="manual"]')?.textContent).toBe("42: existing shoes");
    await choose("second.fit");
    expectPayload(1, undefined, "garmin-originals/2/second_5678abcd.fit", "second.fit");
    expect(host.querySelector('[data-testid="manual"]')?.textContent).toBe("42: existing shoes");
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onUnconfirmedChange).toHaveBeenLastCalledWith(true);
    await click("重試儲存");
    expectPayload(2, undefined, "garmin-originals/2/second_5678abcd.fit", "second.fit");
    expect(host.querySelector('[data-testid="manual"]')?.textContent).toBe("42: existing shoes");
    await act(async () => second.resolve(result(82)));
    expect(host.querySelector('[data-testid="manual"]')?.textContent).toBe("82: existing shoes");
    expect(onSaved).toHaveBeenCalledTimes(2);
    expect(api.upload).toHaveBeenCalledTimes(2); expect(api.parse).toHaveBeenCalledTimes(2);
    expect(onUnconfirmedChange).toHaveBeenLastCalledWith(false);
    await click("清除");
    expect(host.querySelector('[data-testid="manual"]')?.textContent).toBe("82: existing shoes");
    expect(api.save).toHaveBeenCalledTimes(3);
  });
});

describe("Running Garmin/manual target integration contract", () => {
  const source = readFileSync(resolve(process.cwd(), "client/src/pages/Running.tsx"), "utf8");
  it("uses an independent explicit import target while saved results still become manual UPDATE ids", () => {
    expect(source).toContain("const [garminImportTargetId, setGarminImportTargetId] = useState<number | undefined>(undefined)");
    expect(source).toContain("runningLogId={garminImportTargetId}");
    expect(source).not.toContain("runningLogId={editEntry ? Number(editEntry.id) : undefined}");
    expect(source).toContain("onUseAutomaticMatch={() => setGarminImportTargetId(undefined)}");
    const savedCallback = source.split("onSaved={(saved) => {")[1].split("}}\n")[0];
    expect(savedCallback).toContain("setEditEntry({ id: saved.id })");
    expect(savedCallback).toContain("setForm({ ...defaultForm, ...saved.fields");
    expect(savedCallback).not.toContain("setGarminImportTargetId(");
    expect(source).toContain("updateMutation.mutate({ id: Number(editEntry.id), ...payload })");
    const openEdit = source.split("const openEdit = (row: any) => {")[1].split("const handleSave")[0];
    expect(openEdit).toContain("setGarminImportTargetId(Number(row.id))");
  });

  it("clears the import target via every add/reset/close path including the footer, preserving busy and unconfirmed guards", () => {
    const reset = source.split("const resetRunningDialog = () => {")[1].split("};")[0];
    expect(reset).toContain("setEditEntry(null)");
    expect(reset).toContain("setGarminImportTargetId(undefined)");
    expect(reset).toContain("setForm(defaultForm)");
    expect(reset).toContain("setGarminDirectSaved(false)");
    expect(reset).toContain("setGarminUnconfirmed(false)");
    const close = source.split("const closeRunningDialog = () => {")[1].split("};")[0];
    expect(close).toContain("if (garminImportBusy) return");
    expect(close).toContain("resetRunningDialog()");
    const openAdd = source.split("const openAdd = () => {")[1].split("};")[0];
    expect(openAdd).toContain("resetRunningDialog()");
    for (const mutation of ["addMutation", "updateMutation"]) {
      const block = source.split(`const ${mutation} =`)[1].split("onError:")[0];
      expect(block).toContain("setShowDialog(false)");
      expect(block).toContain("resetRunningDialog()");
    }
    expect(source).toContain("else closeRunningDialog()");
    const footer = source.split("<DialogFooter>")[1].split("</DialogFooter>")[0];
    expect(footer).toContain("disabled={garminImportBusy} onClick={closeRunningDialog}");
    expect(footer).toContain("garminImportBusy || garminUnconfirmed || addMutation.isPending || updateMutation.isPending");
    expect(footer).toContain("請先處理原始檔匯入");
    expect(source).toContain("if (garminImportBusy || garminUnconfirmed) return");
  });
});
