"use client";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MLMap, Marker } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import type { Place } from "@/lib/geocode";
import { BRAND, createMap } from "@/lib/maps";

export type LatLng = { lat: number; lng: number };

/** Tap the map or drag the pin, search a place by name, or jump to the device's current position. */
export default function LocationPicker({
  value,
  onChange,
}: {
  value: LatLng | null;
  onChange: (v: LatLng) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MLMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState("");
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    const abort = new AbortController();
    let instance: MLMap | undefined;
    createMap(el.current!, abort.signal).then((created) => {
      if (!created) return;
      const { ml, map } = created;
      instance = map;
      const pin = new ml.Marker({ color: BRAND, draggable: true });
      pin.on("dragend", () => {
        const p = pin.getLngLat();
        onChangeRef.current({ lat: p.lat, lng: p.lng });
      });
      map.on("click", (e) => onChangeRef.current({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
      marker.current = pin;
      setMap(map);
    });
    return () => {
      abort.abort();
      instance?.remove();
    };
  }, []);

  useEffect(() => {
    if (!map || !marker.current) return;
    if (!value) {
      marker.current.remove();
      return;
    }
    marker.current.setLngLat([value.lng, value.lat]).addTo(map);
  }, [map, value]);

  async function search() {
    const q = query.trim();
    if (q.length < 2) return setSearchError("พิมพ์ชื่อสถานที่อย่างน้อย 2 ตัวอักษร");
    setSearching(true);
    setSearchError("");
    const params = new URLSearchParams({ q });
    const c = map?.getCenter();
    if (c && map!.getZoom() >= 8) {
      params.set("lat", c.lat.toFixed(3));
      params.set("lng", c.lng.toFixed(3));
    }
    try {
      const res = await fetch(`/api/places?${params}`);
      const data = await res.json().catch(() => ({ error: "ค้นหาสถานที่ไม่สำเร็จ ลองใหม่อีกครั้ง" }));
      if (!res.ok) throw new Error(data.error);
      setPlaces(data.places);
    } catch (err) {
      setPlaces(null);
      setSearchError(err instanceof Error && err.message ? err.message : "ค้นหาสถานที่ไม่สำเร็จ");
    } finally {
      setSearching(false);
    }
  }

  function pick(p: Place) {
    onChange({ lat: p.lat, lng: p.lng });
    setPlaces(null);
    setQuery(p.name);
    // Areas (a province, a district) fit their outline; spots zoom right in.
    const [w, s, e, n] = p.bbox ?? [0, 0, 0, 0];
    if (p.bbox && (e - w > 0.005 || n - s > 0.005)) map?.fitBounds([[w, s], [e, n]], { padding: 30, maxZoom: 17 });
    else map?.flyTo({ center: [p.lng, p.lat], zoom: 17 });
  }

  function locate() {
    if (!navigator.geolocation) {
      setGeoError("อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง");
      return;
    }
    setLocating(true);
    setGeoError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        onChange(p);
        map?.flyTo({ center: [p.lng, p.lat], zoom: 17 });
        setLocating(false);
      },
      () => {
        setGeoError("ไม่ได้รับอนุญาตให้เข้าถึงตำแหน่ง — แตะบนแผนที่เพื่อเลือกเองได้");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary" onClick={locate} disabled={locating}>
          {locating ? "กำลังหาตำแหน่ง…" : "📍 ใช้ตำแหน่งปัจจุบัน"}
        </button>
        <span className="text-sm text-ink-3">หรือค้นหาชื่อสถานที่ / แตะบนแผนที่ / ลากหมุด</span>
      </div>
      {geoError && <p className="text-sm text-warn">{geoError}</p>}
      <div className="relative">
        <div className="flex gap-2">
          <input
            className="field min-w-0 flex-1"
            type="search"
            enterKeyHint="search"
            placeholder="ค้นหาสถานที่ เช่น ซอยลาดพร้าว 101, เซ็นทรัลบางนา, บางเมือง สมุทรปราการ"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!e.target.value) setPlaces(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                search();
              }
              if (e.key === "Escape") setPlaces(null);
            }}
          />
          <button type="button" className="btn-ghost shrink-0" onClick={search} disabled={searching}>
            {searching ? "กำลังค้นหา…" : "ค้นหา"}
          </button>
        </div>
        {searchError && <p className="mt-1 text-sm text-warn">{searchError}</p>}
        {places && (
          <ul className="card absolute inset-x-0 top-full z-10 mt-1 max-h-72 overflow-y-auto p-1">
            {places.length === 0 && (
              <li className="px-3 py-2 text-sm text-ink-3">
                ไม่พบสถานที่นี้ ลองพิมพ์ชื่อสั้นลง หรือใส่อำเภอ/จังหวัด แล้วแตะบนแผนที่แทน
              </li>
            )}
            {places.map((p, i) => (
              <li key={`${p.lat},${p.lng},${i}`}>
                <button
                  type="button"
                  onClick={() => pick(p)}
                  className="w-full rounded-lg px-3 py-2 text-left hover:bg-surface-2"
                >
                  <span className="block text-sm font-semibold">{p.name}</span>
                  {p.detail && <span className="block truncate text-xs text-ink-3">{p.detail}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="relative h-[340px] overflow-hidden rounded-xl border border-line">
        <div className="absolute inset-0">
          <div ref={el} className="h-full w-full bg-[#45516e]" />
        </div>
      </div>
      <p className="text-xs text-ink-3">
        {value ? `ตำแหน่งที่เลือก: ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}` : "ยังไม่ได้ปักหมุด"}
      </p>
    </div>
  );
}
