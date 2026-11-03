import { afterEach, describe, expect, it, vi } from "vitest";
import { createGoogleMapsLoader, type MapsWindow } from "../client/src/lib/googleMapsLoader";

function setup() {
  const scripts: Array<{ onload: (() => void) | null; onerror: (() => void) | null; dataset: Record<string, string>; removed: boolean; remove: () => void }> = [];
  const window: MapsWindow = {};
  let staleRemoved = false;
  const document = {
    querySelector: vi.fn(() => ({ remove() { staleRemoved = true; } })),
    createElement: () => { const s = { onload: null, onerror: null, dataset: {}, removed: false, remove() { this.removed = true; } }; scripts.push(s); return s; },
    head: { appendChild: vi.fn() },
  } as unknown as Document;
  const load = createGoogleMapsLoader({ window, document, src: "https://example.com/maps.js", timeoutMs: 100 });
  return { load, scripts, window, document, staleRemoved: () => staleRemoved };
}

afterEach(() => vi.useRealTimers());
describe("Google Maps loader", () => {
  it("shares concurrent requests and waits for a usable Map constructor", async () => {
    const s = setup(); const a = s.load(); const b = s.load();
    expect(a).toBe(b); expect(s.scripts).toHaveLength(1);
    s.window.google = { maps: { Map: function Map() {} } }; s.scripts[0].onload?.();
    await expect(a).resolves.toBeUndefined();
    await s.load(); expect(s.scripts).toHaveLength(1);
  });
  it("uses an already-ready SDK without inserting a script", async () => {
    const s = setup(); s.window.google = { maps: { Map: function Map() {} } };
    await s.load(); expect(s.scripts).toHaveLength(0);
  });
  it("removes failed scripts so retry does not wait forever for an old load event", async () => {
    const s = setup(); const failed = s.load(); const rejection = expect(failed).rejects.toThrow("could not be loaded");
    s.scripts[0].onerror?.(); await rejection;
    expect(s.scripts[0].removed).toBe(true); expect(s.staleRemoved()).toBe(true);
    const retry = s.load(); expect(s.scripts).toHaveLength(2);
    s.window.google = { maps: { Map: function Map() {} } }; s.scripts[1].onload?.(); await retry;
  });
  it("rejects a script that loads without the actual SDK", async () => {
    const s = setup(); const p = s.load(); const rejection = expect(p).rejects.toThrow("unavailable");
    s.scripts[0].onload?.(); await rejection; expect(s.scripts[0].removed).toBe(true);
  });
  it("times out and allows a fresh attempt instead of leaving a blank map", async () => {
    vi.useFakeTimers(); const s = setup(); const p = s.load(); const rejection = expect(p).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(100); await rejection;
    expect(s.scripts[0].removed).toBe(true);
    const retry = s.load(); s.window.google = { maps: { Map: function Map() {} } }; s.scripts[1].onload?.(); await retry;
  });
});
