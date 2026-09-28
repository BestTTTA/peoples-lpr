"use client";
import "maplibre-gl/dist/maplibre-gl.css";
import type {
  DataDrivenPropertyValueSpecification,
  ExpressionSpecification,
  FilterSpecification,
  GeoJSONSource,
  MapGeoJSONFeature,
  Map as MLMap,
  Popup,
  SymbolLayerSpecification,
} from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { BRAND, FONT, createMap } from "@/lib/maps";
import { RECENCY, type Recency, pinSvg, recencyOf } from "@/lib/recency";
import type { PublicReport } from "@/lib/types";
import { type Spot, toSpots } from "@/lib/spots";
import { href, searchPath } from "@/lib/urls";

export type Focus = { lat: number; lng: number; reportIds: string[] };

const SOURCE = "reports";
const PIN_PX = 36;

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const dateFmt = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" });

const POPUP_CHIPS = 60;

function popupHtml(spot: Spot): string {
  const { plates } = spot;
  const chips = plates
    .slice(0, POPUP_CHIPS)
    .map(
      (p) =>
        `<a class="plate-chip" href="${esc(href(searchPath(p.prefix, p.number, p.province)))}"><b>${esc(
          `${p.prefix} ${p.number}`,
        )}</b><small>${esc(p.province)}</small></a>`,
    )
    .join("");
  const more = plates.length - POPUP_CHIPS;
  return `<div>
    <div class="plate-popup-title">พบป้ายทะเบียน ${plates.length} ป้าย${
      spot.reportIds.length > 1 ? ` <small>(แจ้ง ${spot.reportIds.length} ครั้ง)</small>` : ""
    }</div>
    ${spot.place ? `<div class="plate-popup-place">${esc(spot.place)}</div>` : ""}
    <div class="plate-popup-date">ล่าสุด ${esc(dateFmt.format(new Date(spot.createdAt)))}</div>
    <div class="plate-popup-chips">${chips}</div>
    ${more > 0 ? `<div class="plate-popup-hint">และอีก ${more} ป้าย</div>` : ""}
    <div class="plate-popup-hint">แตะป้ายเพื่อดูจุดรับคืนและช่องทางติดต่อ</div>
  </div>`;
}

function toGeoJSON(reports: PublicReport[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const now = Date.now();
  return {
    type: "FeatureCollection",
    // One pin per spot, so stacked reports can't hide each other's counts.
    features: toSpots(reports).map((spot) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [spot.lng, spot.lat] },
      properties: {
        id: spot.id,
        // Delimited so a filter can test membership with a substring match.
        ids: `,${spot.reportIds.join(",")},`,
        plates: spot.plates.length,
        icon: `pin-${recencyOf(spot.createdAt, now)}`,
      },
    })),
  };
}

/** Rasterize an SVG pin at 2× for crisp icons. */
async function svgImage(svg: string, px: number): Promise<HTMLImageElement> {
  const sized = svg.replace(/width="\d+" height="\d+"/, `width="${px * 2}" height="${px * 2}"`);
  const img = new Image(px * 2, px * 2);
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(sized);
  await img.decode();
  return img;
}

/** Spots holding any of these reports. */
const byIds = (ids: string[]): FilterSpecification => [
  "all",
  ["!", ["has", "point_count"]],
  ["any", false, ...ids.map((id): ExpressionSpecification => ["in", `,${id},`, ["get", "ids"]])],
];

export default function FoundMap({
  reports,
  focus,
  onSelect,
}: {
  reports: PublicReport[];
  focus: Focus | null;
  onSelect?: (id: string) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MLMap | null>(null);
  const reportsRef = useRef(reports);
  const onSelectRef = useRef(onSelect);
  const popupRef = useRef<Popup | null>(null);
  const mlRef = useRef<typeof import("maplibre-gl") | null>(null);

  useEffect(() => {
    reportsRef.current = reports;
    onSelectRef.current = onSelect;
  });

  useEffect(() => {
    const abort = new AbortController();
    let instance: MLMap | undefined;
    createMap(el.current!, abort.signal).then((created) => {
      if (!created) return;
      const { ml, map } = created;
      instance = map;
      mlRef.current = ml;

      map.on("load", async () => {
        for (const k of Object.keys(RECENCY) as Recency[])
          map.addImage(`pin-${k}`, await svgImage(pinSvg(RECENCY[k].color), PIN_PX), { pixelRatio: 2 });

        map.addSource(SOURCE, {
          type: "geojson",
          data: toGeoJSON([]),
          cluster: true,
          clusterRadius: 48,
          clusterMaxZoom: 15,
          // Bubbles count plates, not pins.
          clusterProperties: { plates: ["+", ["get", "plates"]] },
        });

        const clustered: FilterSpecification = ["has", "point_count"];
        const bubble: DataDrivenPropertyValueSpecification<number> = ["step", ["get", "plates"], 18, 10, 23, 100, 29];
        const pinLayout = (size: number): SymbolLayerSpecification["layout"] => ({
          "icon-image": ["get", "icon"],
          "icon-size": size,
          "icon-allow-overlap": true,
          // Plate count as a small tag on multi-plate pins.
          "text-field": ["case", [">", ["get", "plates"], 1], ["concat", "×", ["to-string", ["get", "plates"]]], ""],
          "text-font": FONT,
          "text-size": 11,
          "text-offset": [1.35 * size, -1.1 * size],
          "text-allow-overlap": true,
        });
        const pinPaint = { "text-color": "#ffffff", "text-halo-color": "#202020", "text-halo-width": 2 };

        map.addLayer({
          id: "clusters",
          type: "circle",
          source: SOURCE,
          filter: clustered,
          paint: {
            "circle-color": BRAND,
            "circle-radius": bubble,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 3,
          },
        });
        map.addLayer({
          id: "cluster-count",
          type: "symbol",
          source: SOURCE,
          filter: clustered,
          layout: { "text-field": ["to-string", ["get", "plates"]], "text-font": FONT, "text-size": 13 },
          paint: { "text-color": "#ffffff" },
        });
        map.addLayer({
          id: "points",
          type: "symbol",
          source: SOURCE,
          filter: ["!", ["has", "point_count"]],
          layout: pinLayout(1),
          paint: pinPaint,
        });
        // The selected pin, drawn larger on top.
        map.addLayer({
          id: "points-selected",
          type: "symbol",
          source: SOURCE,
          filter: byIds([]),
          layout: pinLayout(1.4),
          paint: pinPaint,
        });

        map.on("click", "clusters", async (e) => {
          const f = e.features?.[0];
          if (!f) return;
          const zoom = await map.getSource<GeoJSONSource>(SOURCE)!.getClusterExpansionZoom(f.properties.cluster_id);
          map.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom });
        });
        const select = (e: { features?: MapGeoJSONFeature[] }) => {
          const id = e.features?.[0]?.properties.id as string | undefined;
          if (id) onSelectRef.current?.(id);
        };
        map.on("click", "points", select);
        map.on("click", "points-selected", select);
        for (const layer of ["clusters", "points", "points-selected"]) {
          map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
          map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
        }
        setMap(map);
      });
    });
    return () => {
      abort.abort();
      instance?.remove();
    };
  }, []);

  useEffect(() => {
    map?.getSource<GeoJSONSource>(SOURCE)?.setData(toGeoJSON(reports));
  }, [map, reports]);

  // Fly to the selected report(s), enlarge their pins, and open a popup for a single one.
  useEffect(() => {
    if (!map) return;
    map.setFilter("points-selected", byIds(focus?.reportIds ?? []));
    popupRef.current?.remove();
    if (!focus) return;
    map.flyTo({ center: [focus.lng, focus.lat], zoom: Math.max(map.getZoom(), 16.5), essential: true });
    const r = focus.reportIds.length === 1 ? reportsRef.current.find((x) => x.id === focus.reportIds[0]) : undefined;
    if (r && mlRef.current) {
      // The popup covers the whole spot, like the pin does.
      const spot = toSpots(reportsRef.current).find((x) => x.reportIds.includes(r.id)) ?? { ...r, reportIds: [r.id] };
      popupRef.current = new mlRef.current.Popup({ offset: 28, maxWidth: "300px" })
        .setLngLat([spot.lng, spot.lat])
        .setHTML(popupHtml(spot))
        .addTo(map);
    }
  }, [map, focus]);

  return (
    <div className="relative h-full w-full">
      {/* maplibre-gl.css makes the map container position:relative, so it fills an absolute wrapper. */}
      <div className="absolute inset-0">
        <div ref={el} className="h-full w-full bg-[#45516e]" />
      </div>
    </div>
  );
}
