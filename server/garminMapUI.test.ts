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

describe("map lifetime across countdown/parent rerenders", () => {
  it("keeps one ready map and its basemap DOM while callback props change", async () => {
    const construct = vi.fn();
    const clear = vi.fn();
    window.google = { maps: { Map: class { constructor(element: HTMLElement) { construct(); element.appendChild(document.createElement("canvas")); } }, event: { clearInstanceListeners: clear } } } as unknown as typeof google;
    const { MapView } = await import("../client/src/components/Map");
    const cleanupA = vi.fn(); const cleanupB = vi.fn();
    const firstRoute = vi.fn((_map: google.maps.Map) => cleanupA); const nextRoute = vi.fn((_map: google.maps.Map) => cleanupB);
    await act(async () => root.render(React.createElement(MapView, { onMapReady: firstRoute })));
    const canvas = host.querySelector("canvas");
    const map = firstRoute.mock.calls[0][0];
    await act(async () => root.render(React.createElement(MapView, { initialCenter: { lat: 22.31, lng: 114.18 }, onMapReady: nextRoute })));
    expect(construct).toHaveBeenCalledTimes(1);
    expect(host.querySelector("canvas")).toBe(canvas);
    expect(host.querySelector('[data-map-status="ready"]')).not.toBeNull();
    expect(nextRoute).toHaveBeenCalledWith(map);
    expect(cleanupA).toHaveBeenCalledTimes(1);
    expect(cleanupB).not.toHaveBeenCalled(); expect(clear).not.toHaveBeenCalled();
    await act(async () => root.unmount()); root = createRoot(host);
    expect(cleanupB).toHaveBeenCalledTimes(1); expect(clear).toHaveBeenCalledTimes(1);
  });
  it("preserves fallback DOM, zoom and failed state through twelve fresh callback renders", async () => {
    const { MapView } = await import("../client/src/components/Map");
    const { default: TileMap } = await import("../client/src/components/GarminRouteTileMap");
    const render = () => root.render(React.createElement(MapView, { onMapReady: () => {}, fallback: React.createElement(TileMap, { points }) }));
    await act(async () => render()); await failScript();
    await act(async () => (host.querySelector('[aria-label="放大路線地圖"]') as HTMLButtonElement).click());
    const node = host.querySelector('[data-route-basemap]');
    const route = node!.querySelector('polyline')!.getAttribute('points');
    for (let i = 0; i < 12; i++) await act(async () => render());
    expect(host.querySelector('[data-route-basemap]')).toBe(node);
    expect(node!.querySelector('polyline')!.getAttribute('points')).toBe(route);
    expect(host.querySelector('[data-map-status="error"]')).not.toBeNull();
    expect(host.textContent).not.toContain("正在載入路線地圖");
    expect(document.querySelector('script[data-bodyfit-maps]')).toBeNull();
  });
  it("uses only the latest route callback when parent renders during SDK loading", async () => {
    const { MapView } = await import("../client/src/components/Map");
    const oldRoute = vi.fn(); const newRoute = vi.fn(); const construct = vi.fn();
    await act(async () => root.render(React.createElement(MapView, { onMapReady: oldRoute })));
    const script = document.querySelector('script[data-bodyfit-maps]');
    await act(async () => root.render(React.createElement(MapView, { onMapReady: newRoute })));
    expect(document.querySelector('script[data-bodyfit-maps]')).toBe(script);
    window.google = { maps: { Map: class { constructor() { construct(); } }, event: { clearInstanceListeners: vi.fn() } } } as unknown as typeof google;
    await act(async () => script!.dispatchEvent(new Event("load")));
    expect(construct).toHaveBeenCalledTimes(1); expect(oldRoute).not.toHaveBeenCalled(); expect(newRoute).toHaveBeenCalledTimes(1);
  });
});
