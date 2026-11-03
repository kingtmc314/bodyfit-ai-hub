// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prepareReportPhoto, MAX_REPORT_INPUT_BYTES, MAX_REPORT_JSON_BYTES } from "../client/src/lib/prepareReportPhoto";
const drawImage = vi.fn(); const revoke = vi.fn(); const encodeSizes: number[][] = [];
beforeEach(() => {
  drawImage.mockClear(); revoke.mockClear(); encodeSizes.length=0;
  vi.stubGlobal("URL", class extends URL { static createObjectURL = vi.fn(() => "blob:synthetic-test"); static revokeObjectURL = revoke; });
  vi.stubGlobal("Image", class { naturalWidth=3024; naturalHeight=4032; decoding=""; onload?:()=>void; onerror?:()=>void; set src(_url:string) { queueMicrotask(() => this.onload?.()); } });
  vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockReturnValue({ fillStyle:"", fillRect:vi.fn(), imageSmoothingEnabled:false, imageSmoothingQuality:"", drawImage } as any);
  vi.spyOn(HTMLCanvasElement.prototype,"toBlob").mockImplementation(function(this: HTMLCanvasElement, callback:BlobCallback) { encodeSizes.push([this.width,this.height]); callback(new Blob([new Uint8Array(256000)],{type:"image/jpeg"})); });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe("whole-frame bounded report photo preparation", () => {
  it("normalizes the failing 3,672,029-byte original before reading bounded JPEG as base64", async () => {
    const reader=vi.spyOn(FileReader.prototype,"readAsDataURL");
    const original=new File([new Uint8Array(3672029)],"camera.jpg",{type:"image/jpeg"});
    const photo=await prepareReportPhoto(original);
    expect(photo.mimeType).toBe("image/jpeg"); expect(photo.base64.length).toBeLessThan(350000);
    expect(new Blob([JSON.stringify(photo)]).size).toBeLessThan(MAX_REPORT_JSON_BYTES);
    expect(reader).toHaveBeenCalledOnce(); expect(reader.mock.calls[0][0].size).toBe(256000);
    expect(reader.mock.calls[0][0]).not.toBe(original);
    expect(encodeSizes[0]).toEqual([2100,2800]);
    expect(drawImage.mock.calls[0]).toHaveLength(5); // destination only: no source crop rectangle
    expect(drawImage.mock.calls[0].slice(1)).toEqual([0,0,2100,2800]);
    expect(revoke).toHaveBeenCalledWith("blob:synthetic-test");
  });
  it("permits a camera image with empty MIME when its real decoder accepts a recognized filename", async () => {
    const photo=await prepareReportPhoto(new File(["synthetic"],"camera.HEIC",{type:""}));
    expect(photo.mimeType).toBe("image/jpeg"); expect(photo.fileName).toBe("camera.jpg");
  });
  it("rejects huge, empty and non-image input before decode", async () => {
    await expect(prepareReportPhoto({size:MAX_REPORT_INPUT_BYTES+1} as File)).rejects.toThrow("25 MB");
    await expect(prepareReportPhoto(new File([],"empty.jpg",{type:"image/jpeg"}))).rejects.toThrow("空的");
    await expect(prepareReportPhoto(new File(["pdf"],"file.pdf",{type:"application/pdf"}))).rejects.toThrow("報告相片");
  });
});
