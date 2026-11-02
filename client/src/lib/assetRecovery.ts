export const STALE_ASSET_RELOAD_KEY = "bodyfit:stale-asset-reload-at";
export const STALE_ASSET_RELOAD_WINDOW_MS = 30_000;

/**
 * Vite splits pages into hashed files. During a deployment, a browser can hold
 * an older app shell that asks for a chunk removed by the new release.
 */
export function isStaleAssetError(error: unknown): boolean {
  const text = error instanceof Error
    ? `${error.message}\n${error.stack ?? ""}`
    : String(error ?? "");

  return /failed to fetch dynamically imported module|failed to fetch module script|error loading dynamically imported module|vite:preloaderror|importing a module script failed/i.test(text);
}

export function shouldAttemptStaleAssetReload(lastAttemptAt: number | null, now: number): boolean {
  return lastAttemptAt === null || !Number.isFinite(lastAttemptAt) || now - lastAttemptAt > STALE_ASSET_RELOAD_WINDOW_MS;
}

/**
 * Reload once for a stale hashed asset. The timestamp guard prevents a broken
 * network connection from putting the browser into a reload loop.
 */
export function recoverFromStaleAsset(error: unknown): boolean {
  if (typeof window === "undefined" || !isStaleAssetError(error)) return false;

  try {
    const now = Date.now();
    const stored = window.sessionStorage.getItem(STALE_ASSET_RELOAD_KEY);
    const lastAttemptAt = stored === null ? null : Number(stored);

    if (!shouldAttemptStaleAssetReload(lastAttemptAt, now)) return false;

    window.sessionStorage.setItem(STALE_ASSET_RELOAD_KEY, String(now));
    window.location.reload();
    return true;
  } catch {
    // Storage can be unavailable in strict private browsers. Keep the manual
    // retry button instead of risking an automatic reload loop.
    return false;
  }
}

export function installStaleAssetRecovery(): void {
  if (typeof window === "undefined") return;

  window.addEventListener("vite:preloadError", (event) => {
    if (recoverFromStaleAsset(event.payload)) event.preventDefault();
  });

  window.addEventListener("unhandledrejection", (event) => {
    if (recoverFromStaleAsset(event.reason)) event.preventDefault();
  });
}
