/// <reference types="@types/google.maps" />

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2, MapPinned, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { createGoogleMapsLoader } from "@/lib/googleMapsLoader";

declare global {
  interface Window {
    google?: typeof google;
    gm_authFailure?: () => void;
  }
}

const baseUrl = (import.meta.env.VITE_FRONTEND_FORGE_API_URL || "https://forge.butterfly-effect.dev").replace(/\/+$/, "");
const source = `${baseUrl}/v1/maps/proxy/maps/api/js?${new URLSearchParams({
  key: import.meta.env.VITE_FRONTEND_FORGE_API_KEY || "",
  v: "weekly", libraries: "marker,places,geocoding,geometry",
})}`;
let loader: ReturnType<typeof createGoogleMapsLoader> | undefined;
const loadMapScript = () => (loader ??= createGoogleMapsLoader({ window, document, src: source }))();

interface MapViewProps {
  className?: string;
  initialCenter?: google.maps.LatLngLiteral;
  initialZoom?: number;
  onMapReady?: (map: google.maps.Map) => void | (() => void);
  fallback?: ReactNode;
}

export function MapView({
  className,
  initialCenter = { lat: 22.3193, lng: 114.1694 },
  initialZoom = 12,
  onMapReady,
  fallback,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const overlayCleanup = useRef<void | (() => void)>(undefined);
  const latest = useRef({ initialCenter, initialZoom, onMapReady });
  latest.current = { initialCenter, initialZoom, onMapReady };
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const currentStatus = useRef(status);
  currentStatus.current = status;

  const updateOverlays = useCallback((map: google.maps.Map) => {
    overlayCleanup.current?.();
    overlayCleanup.current = undefined;
    overlayCleanup.current = latest.current.onMapReady?.(map);
  }, []);

  // Map lifetime is mount + explicit Retry only. Countdown ticks, query renders,
  // fresh callbacks and initial-center objects must never tear down a live map.
  useEffect(() => {
    let active = true;
    let map: google.maps.Map | undefined;
    const container = mapContainer.current;
    const previousAuthFailure = window.gm_authFailure;
    const authFailure = () => {
      if (active) setStatus("error");
      previousAuthFailure?.();
    };
    window.gm_authFailure = authFailure;
    setStatus("loading");
    void (async () => {
      try {
        await loadMapScript();
        if (!active || !container) return;
        if (!window.google?.maps?.Map) throw new Error("Google Maps SDK unavailable");
        map = new window.google.maps.Map(container, {
          zoom: latest.current.initialZoom,
          center: latest.current.initialCenter,
          mapTypeControl: true,
          fullscreenControl: true,
          zoomControl: true,
          streetViewControl: false,
        });
        mapInstance.current = map;
        updateOverlays(map);
        if (active) setStatus("ready");
      } catch {
        if (active) setStatus("error");
      }
    })();
    return () => {
      active = false;
      overlayCleanup.current?.();
      overlayCleanup.current = undefined;
      mapInstance.current = null;
      if (map) window.google?.maps?.event.clearInstanceListeners(map);
      container?.replaceChildren();
      if (window.gm_authFailure === authFailure) window.gm_authFailure = previousAuthFailure;
    };
  }, [attempt, updateOverlays]);

  // A genuinely new route may replace overlays on the SAME Google map. Never
  // reset loading/provider state or clear the basemap on callback-only updates.
  useEffect(() => {
    if (mapInstance.current && currentStatus.current === "ready") {
      try { updateOverlays(mapInstance.current); } catch { setStatus("error"); }
    }
  }, [onMapReady, updateOverlays]);

  return (
    <div className={cn("relative isolate w-full", className ?? "h-[500px]")} data-map-status={status}>
      <div ref={mapContainer} className={cn("absolute inset-0 z-0", status !== "ready" && "invisible")} aria-hidden={status !== "ready"} />
      {status === "loading" && <div role="status" className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-muted text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />正在載入路線地圖…</div>}
      {status === "error" && (fallback ? (
        <div className="absolute inset-0 z-10">
          {fallback}
          <button type="button" className="absolute left-2 top-2 z-20 flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-card/95 px-2.5 text-[11px] font-semibold text-card-foreground shadow-sm" onClick={() => setAttempt(value => value + 1)}><RotateCcw className="h-3.5 w-3.5" />重試 Google 地圖</button>
        </div>
      ) : (
        <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted px-4 text-center text-muted-foreground"><MapPinned className="h-7 w-7" /><p className="text-sm font-semibold">地圖暫時未能載入，GPS 資料仍然保留。</p><button type="button" className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-card-foreground" onClick={() => setAttempt(value => value + 1)}>重新載入地圖</button></div>
      ))}
    </div>
  );
}
