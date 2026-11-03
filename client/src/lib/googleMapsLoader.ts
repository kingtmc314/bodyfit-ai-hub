export type MapsWindow = { google?: { maps?: { Map?: unknown } } };

type LoaderOptions = {
  window: MapsWindow;
  document: Document;
  src: string;
  timeoutMs?: number;
};

/** One script per attempt. Failed/stale scripts must not trap subsequent retries. */
export function createGoogleMapsLoader({ window, document, src, timeoutMs = 12000 }: LoaderOptions) {
  let pending: Promise<void> | null = null;
  return function load(): Promise<void> {
    if (window.google?.maps?.Map) return Promise.resolve();
    if (pending) return pending;
    // A previous bundle or abandoned attempt may have left a dead script behind.
    document.querySelector('script[data-bodyfit-maps="true"]')?.remove();
    const attempt = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        script.onload = null;
        script.onerror = null;
        if (error) {
          script.remove();
          reject(error);
        } else {
          resolve();
        }
      };
      const timer = setTimeout(() => finish(new Error("Google Maps load timed out")), timeoutMs);
      script.dataset.bodyfitMaps = "true";
      script.src = src;
      script.async = true;
      script.crossOrigin = "anonymous";
      script.onload = () => finish(window.google?.maps?.Map ? undefined : new Error("Google Maps API unavailable"));
      script.onerror = () => finish(new Error("Google Maps script could not be loaded"));
      document.head.appendChild(script);
    });
    pending = attempt;
    void attempt.catch(() => { if (pending === attempt) pending = null; });
    return attempt;
  };
}
