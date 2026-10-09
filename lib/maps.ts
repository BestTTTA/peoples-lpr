"use client";
import type { Map as MLMap, StyleSpecification } from "maplibre-gl";

// OpenFreeMap "Positron" (light) — https://openfreemap.org/
export const MAP_STYLE = "https://tiles.openfreemap.org/styles/positron";

// Thailand overview. MapLibre takes [lng, lat].
export const DEFAULT_CENTER: [number, number] = [100.9, 13.2];
export const DEFAULT_ZOOM = 4.8;

export const BRAND = "#2f8fe6";
export const HIGHLIGHT = "#f59e0b";
export const INK = "#2b3336";
export const FONT = ["Noto Sans Bold"];

// Loaded on demand: maplibre-gl touches `window` and must stay out of SSR.
export function loadMapLibre() {
  return import("maplibre-gl");
}

export type { MLMap, StyleSpecification };

/**
 * Shared map setup: Positron style, no rotation. Resolves to null if `signal` aborted while
 * MapLibre was loading — building then removing a map would strip the container's classes
 * from under the map that replaced it (React StrictMode mounts effects twice in dev).
 */
export async function createMap(container: HTMLElement, signal: AbortSignal) {
  const ml = await loadMapLibre();
  if (signal.aborted) return null;
  // Copied into /public by scripts/copy-maplibre-worker.mjs.
  ml.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
  const map = new ml.Map({
    container,
    style: MAP_STYLE,
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    attributionControl: { compact: true },
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
  });
  map.touchZoomRotate.disableRotation();
  map.addControl(new ml.NavigationControl({ showCompass: false }), "bottom-right");
  // Compact attribution starts expanded; keep it folded so it doesn't cover small maps.
  map.once("load", () =>
    container.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show"),
  );
  return { ml, map };
}
