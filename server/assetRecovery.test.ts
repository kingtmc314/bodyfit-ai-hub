import { describe, expect, it } from "vitest";
import {
  isStaleAssetError,
  shouldAttemptStaleAssetReload,
  STALE_ASSET_RELOAD_WINDOW_MS,
} from "../client/src/lib/assetRecovery";

describe("stale deployment asset recovery", () => {
  it("recognises lazy-module errors produced when an old app shell requests a replaced Vite chunk", () => {
    expect(isStaleAssetError(new TypeError("Failed to fetch dynamically imported module: https://bodyfit-ai-hub.vercel.app/assets/Steps-old.js"))).toBe(true);
    expect(isStaleAssetError(new Error("Error loading dynamically imported module"))).toBe(true);
    expect(isStaleAssetError(new Error("Request failed with status 500"))).toBe(false);
  });

  it("allows exactly one recovery reload within the cooldown window", () => {
    const now = 1_800_000_000_000;
    expect(shouldAttemptStaleAssetReload(null, now)).toBe(true);
    expect(shouldAttemptStaleAssetReload(now - STALE_ASSET_RELOAD_WINDOW_MS - 1, now)).toBe(true);
    expect(shouldAttemptStaleAssetReload(now - STALE_ASSET_RELOAD_WINDOW_MS, now)).toBe(false);
    expect(shouldAttemptStaleAssetReload(now - 1, now)).toBe(false);
  });
});
