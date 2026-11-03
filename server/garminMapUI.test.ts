// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let root: Root;
let host: HTMLDivElement;
const points = [{ latitude: 22.3, longitude: 114.17 }, { latitude: 22.31, longitude: 114.18 }];
beforeEach(() => {
  vi.resetModules();
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  delete window.google; delete window.gm_authFailure;
  document.head.querySelectorAll('script[data-bodyfit-maps]').forEach(s => s.remove());
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
async function renderMap() {
  const { MapView } = await import("../client/src/components/Map");
  const { default: TileMap } = await import("../client/src/components/GarminRouteTileMap");
  await act(async () => root.render(React.createElement(MapView, {
    className: "h-[320px]", fallback: React.createElement(TileMap, { points }),
  })));
}
async function failScript() { await act(async () => document.querySelector('script[data-bodyfit-maps]')!.dispatchEvent(new Event("error"))); }

describe("Garmin map failure recovery", () => {
  it("shows an explicit loading state rather than a blank rectangle", async () => {
    await renderMap(); expect(host.textContent).toContain("正在載入路線地圖");
    await failScript();
  });
  it("renders street tiles, actual GPS route and attribution when the SDK is rejected", async () => {
    await renderMap(); await failScript();
    expect(host.querySelector('[data-route-basemap="openstreetmap"]')).not.toBeNull();
    expect(host.querySelector('img')?.getAttribute("src")).toMatch(/^https:\/\/tile\.openstreetmap\.org\//);
    expect(host.querySelectorAll('svg[role="img"] polyline')).toHaveLength(2);
    expect(host.textContent).toContain("起"); expect(host.textContent).toContain("終");
    expect(host.textContent).toContain("© OpenStreetMap contributors");
    expect(host.textContent).toContain("重試 Google 地圖");
  });
  it("retains GPS when the basemap images also fail and allows retry", async () => {
    await renderMap(); await failScript();
    const before = host.querySelector('svg[role="img"] polyline')?.getAttribute("points");
    await act(async () => host.querySelectorAll('img').forEach(img => img.dispatchEvent(new Event("error"))));
    expect(host.textContent).toContain("GPS 路線仍然保留");
    expect(host.querySelector('svg[role="img"] polyline')?.getAttribute("points")).toBe(before);
    const button = [...host.querySelectorAll('button')].find(b => b.textContent?.includes("重試底圖"))!;
    await act(async () => button.click());
    expect(host.textContent).not.toContain("街道底圖暫時未能載入");
  });
  it("fits and zooms the original route without altering its point count", async () => {
    await renderMap(); await failScript();
    const original = host.querySelector('svg[role="img"] polyline')!.getAttribute("points");
    await act(async () => (host.querySelector('[aria-label="放大路線地圖"]') as HTMLButtonElement).click());
    expect(host.querySelector('svg[role="img"] polyline')!.getAttribute("points")).not.toBe(original);
    await act(async () => (host.querySelector('[aria-label="顯示完整路線"]') as HTMLButtonElement).click());
    expect(host.querySelector('svg[role="img"] polyline')!.getAttribute("points")).toBe(original);
  });
  it("creates a new SDK request on retry and recovers to Google Maps", async () => {
    await renderMap(); const firstScript = document.querySelector('script[data-bodyfit-maps]'); await failScript();
    await act(async () => [...host.querySelectorAll('button')].find(b => b.textContent?.includes("重試 Google"))!.click());
    const secondScript = document.querySelector('script[data-bodyfit-maps]'); expect(secondScript).not.toBe(firstScript);
    const construct = vi.fn();
    window.google = { maps: { Map: class { constructor() { construct(); } }, event: { clearInstanceListeners: vi.fn() } } } as unknown as typeof google;
    await act(async () => secondScript!.dispatchEvent(new Event("load")));
    expect(construct).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[data-map-status="ready"]')).not.toBeNull();
    expect(host.querySelector('[data-route-basemap]')).toBeNull();
    await act(async () => window.gm_authFailure?.());
    expect(host.querySelector('[data-route-basemap]')).not.toBeNull();
    expect(host.querySelector('[data-map-status] > div[aria-hidden="true"]')?.className).toContain("invisible");
  });
});
